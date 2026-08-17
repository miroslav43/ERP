// src/lib/documents/adeverinte.ts
// Generare adeverințe din șabloane: HTML printabil (fără PDF în Faza 2),
// numerotare pe serie și amprentă SHA-256 peste conținutul final.
import { createHash, randomBytes } from "node:crypto";
import { escapeHtml } from "@/lib/email/templates/layout";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { businessRule, notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export const SABLOANE_ADEVERINTA = {
  venit: "adeverinta_venit",
  salariat: "adeverinta_salariat",
  vechime: "adeverinta_vechime",
} as const;
export type CodSablon = (typeof SABLOANE_ADEVERINTA)[keyof typeof SABLOANE_ADEVERINTA];

export type ParametriAdeverinta = {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly codSablon: CodSablon;
  readonly emisDe: string;
  readonly scop?: string;
};
export type AdeverintaGenerata = {
  readonly id: string;
  readonly numarAfisat: string;
  readonly html: string;
  readonly hash: string;
  readonly codVerificare: string;
};

const RE_VARIABILA = /\{\{\s*([a-z_]+)\s*\}\}/g;

function randeaza(
  sablon: string,
  valori: ReadonlyMap<string, string>,
): { html: string; lipsa: readonly string[] } {
  const lipsa: string[] = [];
  const html = sablon.replace(RE_VARIABILA, (_potrivire, cheie: string) => {
    const valoare = valori.get(cheie);
    if (valoare === undefined || valoare.length === 0) {
      lipsa.push(cheie);
      return "";
    }
    return escapeHtml(valoare); // conținutul e HTML de șablon; valorile sunt mereu evadate
  });
  return { html, lipsa };
}

function vechimeInText(deLa: string, panaLa: string): string {
  const inceput = new Date(`${deLa}T00:00:00Z`);
  const sfarsit = new Date(`${panaLa}T00:00:00Z`);
  let luni =
    (sfarsit.getUTCFullYear() - inceput.getUTCFullYear()) * 12 +
    (sfarsit.getUTCMonth() - inceput.getUTCMonth());
  if (sfarsit.getUTCDate() < inceput.getUTCDate()) luni -= 1;
  const ani = Math.max(0, Math.floor(luni / 12));
  const rest = Math.max(0, luni % 12);
  const parti = [
    ani > 0 ? `${ani} ${ani === 1 ? "an" : "ani"}` : "",
    rest > 0 ? `${rest} ${rest === 1 ? "lună" : "luni"}` : "",
  ];
  const text = parti.filter((p) => p.length > 0).join(" și ");
  return text.length > 0 ? text : "mai puțin de o lună";
}

/** Numerotare pe (organizație, serie). Coliziunile sunt prinse de indexul unic și reîncercate. */
async function urmatorulNumar(
  supabase: ServerSupabase,
  organizationId: string,
  serie: string,
): Promise<number> {
  const { data } = await supabase
    .from("hr_issued_documents")
    .select("numar")
    .eq("organization_id", organizationId)
    .eq("serie", serie)
    .order("numar", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.numar ?? 0) + 1;
}

export async function genereazaAdeverinta(
  supabase: ServerSupabase,
  parametri: ParametriAdeverinta,
): Promise<AdeverintaGenerata> {
  const { organizationId, employeeId, codSablon } = parametri;

  const { data: sablon } = await supabase
    .from("hr_document_templates")
    .select("id, denumire, continut_html, serie")
    .eq("cod", codSablon)
    .eq("activ", true)
    .is("deleted_at", null)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("organization_id", { ascending: true, nullsFirst: false }) // varianta organizației are prioritate
    .limit(1)
    .maybeSingle();
  if (sablon === null)
    throw notFound("Șablonul de adeverință nu este configurat pentru organizația ta.");

  const { data: angajat } = await supabase
    .from("employees")
    .select("id, full_name, hired_on, terminated_on, job_position_id")
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (angajat === null) throw notFound("Angajatul nu există sau nu îți este accesibil.");
  if (angajat.hired_on === null)
    throw businessRule("Fișa nu are data angajării completată, deci adeverința nu poate fi emisă.");

  const { data: dateSensibile } = await supabase
    .from("employee_sensitive_data")
    .select("cnp_last4")
    .eq("employee_id", employeeId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: functie } =
    angajat.job_position_id === null
      ? { data: null }
      : await supabase
          .from("job_positions")
          .select("denumire")
          .eq("id", angajat.job_position_id)
          .maybeSingle();

  const { data: contract } = await supabase
    .from("employment_contracts")
    .select("id, salariu_baza, valabil_de_la")
    .eq("employee_id", employeeId)
    .eq("este_act_aditional", false)
    .is("deleted_at", null)
    .in("status", ["activ", "suspendat"])
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: organizatie } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizatie === null) throw notFound("Organizația nu a putut fi citită.");

  const azi = todayInBucharest();
  const sfarsit = angajat.terminated_on ?? azi;
  const ultima4 = dateSensibile?.cnp_last4 ?? null;

  const valori = new Map<string, string>([
    ["angajat_nume", angajat.full_name ?? ""],
    ["organizatie_denumire", organizatie.name],
    ["data_angajarii", formatDate(angajat.hired_on)],
    ["functie", functie?.denumire ?? "nespecificată"],
    [
      "perioada",
      `${formatDate(angajat.hired_on)} – ${angajat.terminated_on === null ? "prezent" : formatDate(angajat.terminated_on)}`,
    ],
    ["vechime", vechimeInText(angajat.hired_on, sfarsit)],
    ...(ultima4 === null ? [] : [["cnp_mascat", `*********${ultima4}`] as const]),
    ...(contract === null
      ? []
      : [["salariu_brut", formatLei(Number(contract.salariu_baza))] as const]),
    ...(parametri.scop === undefined ? [] : [["scop", parametri.scop] as const]),
  ]);

  const { html, lipsa } = randeaza(sablon.continut_html, valori);
  if (lipsa.length > 0) {
    throw businessRule(
      `Adeverința nu poate fi emisă: lipsesc date din fișă (${lipsa.join(", ")}). Completează-le și încearcă din nou.`,
    );
  }

  const hash = createHash("sha256").update(html, "utf8").digest("hex");
  const codVerificare = randomBytes(16).toString("base64url");
  const an = azi.slice(0, 4);

  for (let incercare = 0; incercare < 5; incercare += 1) {
    const numar = await urmatorulNumar(supabase, organizationId, sablon.serie);
    const numarAfisat = `${sablon.serie} ${an}/${String(numar).padStart(6, "0")}`;
    const { data, error } = await supabase
      .from("hr_issued_documents")
      .insert({
        organization_id: organizationId,
        template_id: sablon.id,
        employee_id: employeeId,
        serie: sablon.serie,
        numar,
        numar_afisat: numarAfisat,
        titlu: sablon.denumire,
        emis_la: azi,
        continut_html: html,
        continut_checksum: hash,
        cod_verificare: codVerificare,
        emis_de: parametri.emisDe,
        date_document: Object.fromEntries(valori),
        ...(parametri.scop === undefined ? {} : { scop: parametri.scop }),
        ...(contract === null ? {} : { contract_id: contract.id }),
      })
      .select("id")
      .single();

    if (error === null && data !== null) {
      return { id: data.id, numarAfisat, html, hash, codVerificare };
    }
    if (error?.code !== "23505") {
      throw businessRule("Adeverința nu a putut fi înregistrată. Încearcă din nou.");
    }
    // 23505 = alt utilizator a luat între timp același număr: reluăm alocarea.
  }
  throw businessRule(
    "Numerotarea adeverințelor este ocupată. Încearcă din nou peste câteva secunde.",
  );
}

/** HTML complet, pregătit pentru tipărire din browser (Ctrl+P). Fără resurse externe. */
export function paginaTiparibila(
  adeverinta: AdeverintaGenerata,
  denumireOrganizatie: string,
): string {
  return [
    '<!doctype html><html lang="ro"><head><meta charset="utf-8">',
    `<title>${escapeHtml(adeverinta.numarAfisat)}</title>`,
    "<style>body{font-family:Georgia,serif;max-width:18cm;margin:2cm auto;line-height:1.6;color:#111}",
    "footer{margin-top:3cm;font-size:.8rem;color:#555;border-top:1px solid #ccc;padding-top:.5cm}",
    "@media print{body{margin:0}}</style></head><body>",
    `<p>${escapeHtml(denumireOrganizatie)} — nr. ${escapeHtml(adeverinta.numarAfisat)}</p>`,
    adeverinta.html,
    `<footer>Cod de verificare: ${escapeHtml(adeverinta.codVerificare)} · amprentă SHA-256: ${adeverinta.hash.slice(0, 16)}…</footer>`,
    "</body></html>",
  ].join("");
}
