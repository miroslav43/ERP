// src/app/api/export/salarizare/bancar/route.ts
//
// Fișierul de plată SEPA pentru o perioadă de salarizare.
//
// GENERAREA LUI DECRIPTEAZĂ IBAN-UL FIECĂRUI ANGAJAT. Nu e un export oarecare:
// e singura operațiune din aplicație care scoate în clar, dintr-o dată, datele
// bancare ale tuturor. De aceea are trei porți, nu una:
//
//   1. `payroll:export` cu scope `all` — dreptul de a exporta salarii;
//   2. `employees:read = all` — cerut oricum de RPC-ul `hr_read_sensitive`,
//      care refuză altfel și scrie un rând de audit la FIECARE apel;
//   3. perioada trebuie să fie APROBATĂ sau ÎNCHISĂ — dintr-o ciornă nu se
//      plătește nimic.
//
// Se plătește `rest_de_plata`, NICIODATĂ `net`: restul de plată scade
// avantajele primite în natură și adaugă sumele neimpozabile. Confuzia dintre
// ele ar vira bani care nu se cuvin sau ar reține bani cuveniți.

import { decrypt, dinBytea } from "@/lib/crypto/aes-gcm";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { genereazaSepa, type PlataSepa } from "@/domain/payroll/bancar/sepa";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(cerere: Request): Promise<Response> {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "payroll:export", "all")) {
    return raspunsText("Nu aveți dreptul de a exporta salarii.", 403);
  }
  // A doua poartă, separată: RPC-ul de decriptare o cere oricum, dar un refuz
  // aici e explicit, nu o eroare de bază greu de citit.
  if (!can(permisiuni, "employees:read", "all")) {
    return raspunsText(
      "Generarea fișierului bancar cere acces complet la datele de personal, fiindcă decriptează IBAN-urile.",
      403,
    );
  }

  const periodId = new URL(cerere.url).searchParams.get("perioada");
  if (periodId === null) return raspunsText("Lipsește identificatorul perioadei.", 400);

  const db = await createServerSupabase();

  const { data: perioada, error: eroarePerioada } = await db
    .from("payroll_periods")
    .select("id, an, luna, status, data_plata")
    .eq("organization_id", tenant.organizationId)
    .eq("id", periodId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      an: number;
      luna: number;
      status: string;
      data_plata: string | null;
    }>();
  if (eroarePerioada !== null) return raspunsText("Perioada nu a putut fi citită.", 500);
  if (perioada === null) return raspunsText("Perioada nu există sau nu aveți acces la ea.", 404);
  if (perioada.status !== "aprobat" && perioada.status !== "inchis") {
    return raspunsText(
      "Perioada nu e aprobată. Dintr-o ciornă nu se plătește nimic — aprobați-o mai întâi.",
      409,
    );
  }

  const { data: randuri, error: eroareRanduri } = await db
    .from("payroll_entries")
    .select("employee_id, rest_de_plata, angajat:employees!employee_id(full_name, marca)")
    .eq("organization_id", tenant.organizationId)
    .eq("period_id", perioada.id)
    .is("deleted_at", null)
    .returns<
      {
        employee_id: string;
        rest_de_plata: number;
        angajat: { full_name: string; marca: string } | null;
      }[]
    >();
  if (eroareRanduri !== null)
    return raspunsText("Rândurile de salariu nu au putut fi citite.", 500);

  const eticheta = `${String(perioada.luna).padStart(2, "0")}.${String(perioada.an)}`;
  const plati: PlataSepa[] = [];
  const faraIban: string[] = [];

  for (const rand of randuri ?? []) {
    const { data: sensibile } = await db.rpc("hr_read_sensitive", {
      p_employee: rand.employee_id,
    });
    const s = sensibile?.[0];
    const areIban =
      s?.iban_ciphertext !== undefined &&
      s.iban_ciphertext !== null &&
      s.iban_iv !== null &&
      s.iban_tag !== null &&
      s.iban_key_version !== null;
    const nume = rand.angajat?.full_name ?? rand.angajat?.marca ?? "";
    if (!areIban) {
      faraIban.push(nume || rand.employee_id);
      continue;
    }
    plati.push({
      referinta: `${rand.employee_id.slice(0, 8)}-${eticheta}`,
      numeBeneficiar: nume,
      iban: decrypt({
        ciphertext: dinBytea(s.iban_ciphertext as string),
        iv: dinBytea(s.iban_iv as string),
        tag: dinBytea(s.iban_tag as string),
        keyVersion: String(s.iban_key_version),
      }),
      suma: rand.rest_de_plata,
      explicatie: `Salariu ${eticheta}`,
    });
  }

  const { data: organizatie } = await db
    .from("organizations")
    .select("name, legal_name")
    .eq("id", tenant.organizationId)
    .maybeSingle<{ name: string; legal_name: string | null }>();

  const acum = new Date().toISOString().slice(0, 19);
  const rezultat = genereazaSepa({
    mesajId: `SAL-${eticheta}-${perioada.id.slice(0, 8)}`,
    creatLa: acum,
    dataExecutiei: perioada.data_plata ?? acum.slice(0, 10),
    numePlatitor: organizatie?.legal_name ?? organizatie?.name ?? "",
    // IBAN-ul plătitorului se configurează separat; până atunci fișierul se
    // generează cu câmpul gol, iar banca îl completează la încărcare.
    ibanPlatitor: "",
    bicPlatitor: null,
    moneda: "RON",
    plati,
  });

  if (rezultat.xml === "") {
    const motive = rezultat.probleme.map((p) => `${p.cod}: ${p.detalii}`).join("\n");
    return raspunsText(
      `Fișierul ar fi gol, deci nu a fost generat.\n\n${motive}${
        faraIban.length === 0 ? "" : `\n\nFără IBAN: ${faraIban.join(", ")}.`
      }`,
      409,
    );
  }

  return new Response(rezultat.xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="salarii-${eticheta}.xml"`,
      "cache-control": "no-store",
      // Antetele spun ce NU a intrat în fișier, ca omul să afle fără să
      // deschidă XML-ul și să numere.
      "x-plati-incluse": String(rezultat.numarPlati),
      "x-suma-control": rezultat.sumaControl.toFixed(2),
      "x-fara-iban": String(faraIban.length),
    },
  });
}
