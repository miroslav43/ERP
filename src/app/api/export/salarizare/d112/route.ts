// src/app/api/export/salarizare/d112/route.ts
//
// Declarația 112, ca fișier XML pentru portalul ANAF.
//
// TREI PORȚI, ca la fișierul bancar, și din același motiv: generarea
// DECRIPTEAZĂ CNP-UL fiecărui angajat. D112 e evidența nominală a persoanelor
// asigurate — fără CNP nu există declarație, dar asta o face a doua operațiune
// din aplicație care scoate în clar, dintr-o dată, date personale ale tuturor.
//
//   1. `payroll:export` cu scope `all`;
//   2. `employees:read = all` — cerut oricum de `hr_read_sensitive`, care
//      refuză altfel și scrie un rând de audit la FIECARE apel;
//   3. perioada aprobată sau închisă — dintr-o ciornă nu se declară nimic.
//
// Fișierul NU se depune direct: contabilul îl validează cu DUKIntegrator,
// aplicația ANAF, îl semnează electronic și îl încarcă pe e-Guvernare. Ce
// scutim e tastarea a câteva sute de cifre, nu validarea oficială.
//
// Când validările blocante găsesc ceva, ruta întoarce 409 cu lista problemelor,
// NU un XML incomplet: un fișier respins de ANAF după depunere costă mai mult
// decât unul care nu s-a generat.
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { decrypt, dinBytea } from "@/lib/crypto/aes-gcm";
import { genereazaD112 } from "@/domain/payroll/d112/genereaza";
import {
  CODURI_OBLIGATIE,
  TIP_ASIGURAT_SALARIAT,
  normaZilnicaD112,
  tipContractD112,
} from "@/domain/payroll/d112/coduri";
import type { AsiguratD112, CreantaD112 } from "@/domain/payroll/d112/structura";
import { numeFisier } from "@/lib/pdf/document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface RandD112 {
  readonly employee_id: string;
  readonly impozit: number;
  readonly cas: number;
  readonly cass: number;
  readonly cam_angajator: number;
  readonly brut: number;
  readonly ore_lucrate: number;
  readonly zile_absenta_nemotivata: number;
  readonly zile_fara_plata: number;
  readonly angajat: {
    readonly full_name: string | null;
    readonly first_name: string | null;
    readonly last_name: string | null;
    readonly hired_on: string | null;
    readonly terminated_on: string | null;
  } | null;
}

export async function GET(cerere: Request): Promise<Response> {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:export", "all")) {
    return raspunsText("Nu aveți dreptul de a exporta salarii.", 403);
  }
  if (!can(permisiuni, "employees:read", "all")) {
    return raspunsText(
      "Generarea D112 cere acces complet la datele de personal, fiindcă declarația conține CNP-ul fiecărui asigurat.",
      403,
    );
  }

  const url = new URL(cerere.url);
  const periodId = url.searchParams.get("perioada");
  const rectificativa = url.searchParams.get("rectificativa") === "1";
  if (periodId === null) return raspunsText("Lipsește identificatorul perioadei.", 400);

  const db = await createServerSupabase();

  const { data: perioada, error: eroarePerioada } = await db
    .from("payroll_periods")
    .select("id, an, luna, status")
    .eq("organization_id", tenant.organizationId)
    .eq("id", periodId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; an: number; luna: number; status: string }>();
  if (eroarePerioada !== null) return raspunsText("Perioada nu a putut fi citită.", 500);
  if (perioada === null) return raspunsText("Perioada nu există sau nu aveți acces la ea.", 404);
  if (perioada.status !== "aprobat" && perioada.status !== "inchis") {
    return raspunsText("Perioada nu e aprobată. Dintr-o ciornă nu se declară nimic.", 409);
  }

  const { data: firma } = await db
    .from("organizations")
    .select("name, legal_name, cui_normalizat, reg_com, cod_caen, adresa, oras, judet")
    .eq("id", tenant.organizationId)
    .maybeSingle<{
      name: string;
      legal_name: string | null;
      cui_normalizat: string | null;
      reg_com: string | null;
      cod_caen: string | null;
      adresa: string | null;
      oras: string | null;
      judet: string | null;
    }>();

  // `casaAng` și `functie_declar` vin din setările de salarizare (0068): sunt
  // parametri ai declarației, versionați odată cu restul calculului, nu date de
  // identificare ale firmei.
  const { data: setari } = await db
    .from("payroll_settings")
    .select("casa_sanatate_angajator, functie_declarant")
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle<{ casa_sanatate_angajator: string | null; functie_declarant: string }>();

  const { data: randuri, error: eroareRanduri } = await db
    .from("payroll_entries")
    .select(
      "employee_id, impozit, cas, cass, cam_angajator, brut, ore_lucrate, " +
        "zile_absenta_nemotivata, zile_fara_plata, " +
        "angajat:employees!employee_id(full_name, first_name, last_name, hired_on, terminated_on)",
    )
    .eq("organization_id", tenant.organizationId)
    .eq("period_id", perioada.id)
    .is("deleted_at", null)
    .returns<RandD112[]>();
  if (eroareRanduri !== null) {
    return raspunsText("Rândurile de salariu nu au putut fi citite.", 500);
  }
  if ((randuri ?? []).length === 0) {
    return raspunsText("Perioada nu are niciun rând calculat.", 409);
  }

  // Norma zilnică din contractul activ — `A_4` și `A_3` depind de ea.
  const { data: contracte } = await db
    .from("employment_contracts")
    .select("employee_id, norma_ore_zi")
    .eq("organization_id", tenant.organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .returns<{ employee_id: string; norma_ore_zi: number }[]>();
  const normaPerAngajat = new Map((contracte ?? []).map((c) => [c.employee_id, c.norma_ore_zi]));

  const asigurati: AsiguratD112[] = [];
  const faraCnp: string[] = [];
  const zileLuna = new Date(Date.UTC(perioada.an, perioada.luna, 0)).getUTCDate();

  for (const rand of randuri ?? []) {
    const { data: sensibile } = await db.rpc("hr_read_sensitive", {
      p_employee: rand.employee_id,
    });
    const s = sensibile?.[0];
    const nume = rand.angajat?.full_name ?? rand.employee_id;
    if (
      s?.cnp_ciphertext === undefined ||
      s.cnp_ciphertext === null ||
      s.cnp_iv === null ||
      s.cnp_tag === null ||
      s.cnp_key_version === null
    ) {
      faraCnp.push(nume);
      continue;
    }

    const cnp = decrypt({
      ciphertext: dinBytea(s.cnp_ciphertext),
      iv: dinBytea(s.cnp_iv),
      tag: dinBytea(s.cnp_tag),
      keyVersion: String(s.cnp_key_version),
    });

    const norma = normaZilnicaD112(normaPerAngajat.get(rand.employee_id) ?? 8);
    // Ore efective pe zi, pentru clasificarea normă întreagă / timp parțial.
    const orePeZi = zileLuna > 0 ? rand.ore_lucrate / Math.max(1, zileLuna * (5 / 7)) : norma;

    asigurati.push({
      cnp,
      nume: rand.angajat?.last_name ?? "",
      prenume: rand.angajat?.first_name ?? "",
      dataAngajarii: rand.angajat?.hired_on ?? "",
      // `dataSf` se declară DOAR dacă încetarea cade în luna raportată.
      dataIncetarii:
        rand.angajat?.terminated_on !== null &&
        rand.angajat?.terminated_on !== undefined &&
        rand.angajat.terminated_on.slice(0, 7) ===
          `${String(perioada.an)}-${String(perioada.luna).padStart(2, "0")}`
          ? rand.angajat.terminated_on
          : null,
      tipAsigurat: TIP_ASIGURAT_SALARIAT,
      pensionar: false,
      tipContract: tipContractD112(orePeZi, norma),
      oreNormaZilnica: norma,
      bazaCam: rand.brut,
      oreLucrate: Math.round(rand.ore_lucrate),
      /*
       * `A_7` — orele suspendate FĂRĂ acoperire medicală: concediu fără plată,
       * creștere copil, acomodare (toate `tip_zi = 'fara_plata'` în pontaj) și
       * absențele nemotivate. Medicalul și maternitatea NU intră: au rubrica
       * lor în declarație, iar numărate aici s-ar declara de două ori.
       *
       * Zilele se convertesc în ore cu norma contractului, ca `A_4`: o zi
       * suspendată are `ore_lucrate = 0` prin definiție, deci nu există ore
       * măsurate de adunat. Perioadele calculate ÎNAINTE de 0126 au coloana pe
       * zero — pentru ele numărul chiar n-a fost măsurat niciodată.
       */
      oreSuspendate: Math.round((rand.zile_absenta_nemotivata + rand.zile_fara_plata) * norma),
    });
  }

  const suma = (camp: keyof RandD112): number =>
    (randuri ?? []).reduce((total, r) => total + (r[camp] as number), 0);

  const creante: CreantaD112[] = [
    {
      ...CODURI_OBLIGATIE.impozitSalarii,
      codObligatie: CODURI_OBLIGATIE.impozitSalarii.cod,
      suma: suma("impozit"),
    },
    {
      ...CODURI_OBLIGATIE.casAngajat,
      codObligatie: CODURI_OBLIGATIE.casAngajat.cod,
      suma: suma("cas"),
    },
    {
      ...CODURI_OBLIGATIE.cassAngajat,
      codObligatie: CODURI_OBLIGATIE.cassAngajat.cod,
      suma: suma("cass"),
    },
    {
      ...CODURI_OBLIGATIE.camAngajator,
      codObligatie: CODURI_OBLIGATIE.camAngajator.cod,
      suma: suma("cam_angajator"),
    },
  ].filter((c) => c.suma > 0);

  const adresa = [firma?.adresa, firma?.oras, firma?.judet]
    .filter((v): v is string => v !== null && v !== undefined && v.trim().length > 0)
    .join(", ");

  const rezultat = genereazaD112({
    luna: perioada.luna,
    an: perioada.an,
    rectificativa,
    declarantNume: user.fullName?.split(" ").slice(-1)[0] ?? "",
    declarantPrenume: user.fullName?.split(" ")[0] ?? "",
    declarantFunctie: setari?.functie_declarant ?? "Administrator",
    angajator: {
      cif: firma?.cui_normalizat ?? "",
      denumire: firma?.legal_name ?? firma?.name ?? tenant.name,
      registruComert: firma?.reg_com ?? null,
      caen: firma?.cod_caen ?? null,
      adresaSediu: adresa.length > 0 ? adresa : null,
      casaSanatate: setari?.casa_sanatate_angajator ?? null,
      datoreazaCam: suma("cam_angajator") > 0,
    },
    creante,
    asigurati,
  });

  const blocante = rezultat.probleme.filter((p) => p.blocant);
  if (blocante.length > 0 || faraCnp.length > 0) {
    const linii = [
      "Declarația 112 nu a putut fi generată — ANAF ar respinge fișierul:",
      "",
      ...blocante.map((p) => `• [${p.camp}] ${p.mesaj}`),
      ...faraCnp.map((n) => `• [cnpAsig] ${n} nu are CNP înregistrat.`),
    ];
    return raspunsText(linii.join("\n"), 409);
  }

  const atentionari = rezultat.probleme.filter((p) => !p.blocant);
  const nume = numeFisier(
    `d112-${String(perioada.an)}-${String(perioada.luna).padStart(2, "0")}${rectificativa ? "-rectificativa" : ""}`,
  );
  return new Response(rezultat.xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="${nume}.xml"`,
      "cache-control": "no-store",
      // Atenționările nu opresc descărcarea, dar nu trebuie nici să dispară:
      // ANAF le preia cu mesaj, iar contabilul trebuie să le vadă.
      ...(atentionari.length === 0 ? {} : { "x-atentionari": String(atentionari.length) }),
    },
  });
}
