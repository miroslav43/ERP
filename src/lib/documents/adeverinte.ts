// src/lib/documents/adeverinte.ts
// Generare adeverințe: adună datele angajatului/organizației într-o hartă de
// variabile, apoi deleagă randarea/numerotarea/checksum-ul motorului comun
// din `generator.ts` (folosit și de contractul de muncă și de fișa postului).
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { businessRule, notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { genereazaDocument } from "./generator";
import type { DocumentGenerat } from "./generator";

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
export type AdeverintaGenerata = DocumentGenerat;

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

export async function genereazaAdeverinta(
  supabase: ServerSupabase,
  parametri: ParametriAdeverinta,
): Promise<AdeverintaGenerata> {
  const { organizationId, employeeId, codSablon } = parametri;

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
    .select("name, legal_name")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizatie === null) throw notFound("Organizația nu a putut fi citită.");

  const azi = todayInBucharest();
  const sfarsit = angajat.terminated_on ?? azi;
  const ultima4 = dateSensibile?.cnp_last4 ?? null;

  const valori = new Map<string, string>([
    ["angajat_nume", angajat.full_name ?? ""],
    // Documentul e oficial: forma juridică completă dacă a fost completată,
    // altfel denumirea uzuală — niciodată nesetat.
    ["organizatie_denumire", organizatie.legal_name ?? organizatie.name],
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

  return genereazaDocument(supabase, {
    organizationId,
    employeeId,
    codSablon,
    emisDe: parametri.emisDe,
    valori,
    ...(parametri.scop === undefined ? {} : { scop: parametri.scop }),
    ...(contract === null ? {} : { contractId: contract.id }),
  });
}

export { paginaTiparibila } from "./generator";
