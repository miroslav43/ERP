// src/app/api/export/salarizare/fluturas/route.ts
//
// Fluturașul unui salariat, ca PDF.
//
// Spre deosebire de statul de plată, ruta asta NU cere `payroll:export`:
// angajatul își descarcă PROPRIUL fluturaș din portal, iar el n-are și n-o să
// aibă vreodată dreptul de a exporta salarii. Poarta e alta, și e mai bună —
// RLS-ul lui `payroll_entries` (`app.poate_accesa_salariul`) decide singur cine
// vede care rând: `own` întoarce doar rândul propriu, `all` pe toate. Ruta nu
// face nicio verificare de identitate în plus, fiindcă orice verificare paralelă
// ar putea diverge de politică.
//
// Perioada trebuie să fie aprobată sau închisă: un fluturaș dintr-o ciornă ar
// da angajatului o cifră care se mai poate schimba.
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { genereazaFluturas } from "@/lib/pdf/fluturas";
import { numeLuna } from "@/lib/pdf/stat-plata";
import { numeFisier } from "@/lib/pdf/document";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { castigurileFluturasului, retinerileFluturasului } from "@/lib/pdf/linii-fluturas";
import { formatDateTime } from "@/lib/format/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface RandFluturas {
  readonly id: string;
  readonly baza_salariu: number;
  readonly suma_ore_suplimentare: number;
  readonly spor_noapte: number;
  readonly prime_total: number;
  readonly valoare_tichete: number;
  readonly brut: number;
  readonly cas: number;
  readonly cass: number;
  readonly deducere_personala: number;
  readonly scutire_fiscala: number;
  readonly impozit: number;
  readonly net: number;
  readonly retineri_total: number;
  readonly net_de_plata: number;
  readonly rest_de_plata: number;
  readonly zile_lucratoare_luna: number;
  readonly zile_lucrate: number;
  readonly zile_concediu_odihna: number;
  readonly zile_concediu_medical: number;
  readonly ore_lucrate: number;
  readonly ore_suplimentare: number;
  readonly ore_noapte: number;
  readonly calc_warnings: readonly { readonly mesaj: string }[] | null;
  readonly perioada: { readonly an: number; readonly luna: number; readonly status: string } | null;
  readonly angajat: {
    readonly full_name: string | null;
    readonly marca: string;
    readonly functie: string | null;
  } | null;
}

const COLOANE =
  "id, baza_salariu, suma_ore_suplimentare, spor_noapte, prime_total, valoare_tichete, brut, cas, cass, deducere_personala, scutire_fiscala, impozit, net, retineri_total, net_de_plata, rest_de_plata, zile_lucratoare_luna, zile_lucrate, zile_concediu_odihna, zile_concediu_medical, ore_lucrate, ore_suplimentare, ore_noapte, calc_warnings, " +
  "perioada:payroll_periods!period_id(an, luna, status), " +
  "angajat:employees!employee_id(full_name, marca, functie)";

export async function GET(cerere: Request): Promise<Response> {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // Poarta minimă: cine n-are `payroll:read` deloc nu are ce căuta aici. Cine
  // are `own` primește, prin RLS, exact rândul lui.
  // `getPermissionMap` scoate `none` din hartă (`permissions.ts`), iar
  // `scopeFor` întoarce `null` pentru o cheie absentă — comparația doar cu
  // `"none"` nu era NICIODATĂ adevărată, deci poarta nu refuza pe nimeni.
  const scopeSalarii = scopeFor(permisiuni, "payroll:read");
  if (scopeSalarii === null || scopeSalarii === "none") {
    return raspunsText("Nu aveți dreptul de a consulta salarii.", 403);
  }

  const entryId = new URL(cerere.url).searchParams.get("inregistrare");
  if (entryId === null) return raspunsText("Lipsește identificatorul înregistrării.", 400);

  const db = await createServerSupabase();
  const { data: rand, error } = await db
    .from("payroll_entries")
    .select(COLOANE)
    .eq("organization_id", tenant.organizationId)
    .eq("id", entryId)
    .is("deleted_at", null)
    .maybeSingle<RandFluturas>();
  if (error !== null) return raspunsText("Fluturașul nu a putut fi citit.", 500);
  // `null` acoperă și „nu există", și „RLS nu ți-l arată" — deliberat același
  // răspuns, ca 404-ul să nu confirme existența salariului altcuiva.
  if (rand === null) return raspunsText("Fluturașul nu există sau nu vă este accesibil.", 404);

  const perioada = rand.perioada;
  if (perioada === null) return raspunsText("Perioada fluturașului nu a putut fi citită.", 500);
  if (perioada.status !== "aprobat" && perioada.status !== "inchis") {
    return raspunsText(
      "Perioada nu e aprobată încă. Fluturașul devine disponibil după aprobarea statului de plată.",
      409,
    );
  }

  const pdf = await genereazaFluturas({
    organizatie: await antetOrganizatie(db, tenant.organizationId, tenant.name),
    an: perioada.an,
    luna: perioada.luna,
    angajatNume: rand.angajat?.full_name ?? "—",
    angajatMarca: rand.angajat?.marca ?? "",
    functie: rand.angajat?.functie ?? null,
    zileLucratoareLuna: rand.zile_lucratoare_luna,
    zileLucrate: rand.zile_lucrate,
    zileConcediuOdihna: rand.zile_concediu_odihna,
    zileConcediuMedical: rand.zile_concediu_medical,
    oreLucrate: rand.ore_lucrate,
    oreSuplimentare: rand.ore_suplimentare,
    oreNoapte: rand.ore_noapte,
    castiguri: castigurileFluturasului(rand),
    retineri: retinerileFluturasului(rand),
    restDePlata: rand.rest_de_plata,
    avertismente: (rand.calc_warnings ?? []).map((w) => w.mesaj),
    generatLa: formatDateTime(new Date().toISOString()),
  });

  const nume = numeFisier(
    `fluturas-${numeLuna(perioada.luna)}-${String(perioada.an)}-${rand.angajat?.marca ?? ""}`,
  );
  return new Response(pdf as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nume}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
