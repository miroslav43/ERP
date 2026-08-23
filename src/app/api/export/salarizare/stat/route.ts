// src/app/api/export/salarizare/stat/route.ts
//
// Statul de plată al unei perioade, ca PDF.
//
// Documentul central al lunii: detaliază per salariat zilele, brutul,
// contribuțiile, impozitul, netul și restul de plată, cu totaluri pe firmă. Se
// întocmește lunar, se semnează de angajator și se arhivează.
//
// Două porți, nu trei ca la fișierul bancar: statul NU decriptează IBAN-uri,
// deci nu cere `employees:read = all`. Cere însă aceleași lucruri ca orice
// export de salarii — dreptul `payroll:export` și o perioadă care nu mai e în
// ciornă. Un stat de plată dintr-o ciornă ar fi un document oficial peste cifre
// care se mai pot schimba.
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { genereazaStatDePlata, numeLuna, type RandStatPlata } from "@/lib/pdf/stat-plata";
import { numeFisier } from "@/lib/pdf/document";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { formatDateTime } from "@/lib/format/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(cerere: Request): Promise<Response> {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:export", "all")) {
    return raspunsText("Nu aveți dreptul de a exporta salarii.", 403);
  }

  const periodId = new URL(cerere.url).searchParams.get("perioada");
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
    return raspunsText(
      "Perioada nu e aprobată. Un stat de plată dintr-o ciornă ar fi un document oficial peste cifre care se mai pot schimba.",
      409,
    );
  }

  const { data: randuri, error: eroareRanduri } = await db
    .from("payroll_entries")
    .select(
      "zile_lucrate, zile_concediu_odihna, brut, cas, cass, impozit, net, retineri_total, rest_de_plata, cost_total_angajator, angajat:employees!employee_id(full_name, marca)",
    )
    .eq("organization_id", tenant.organizationId)
    .eq("period_id", perioada.id)
    .is("deleted_at", null)
    .returns<
      {
        zile_lucrate: number;
        zile_concediu_odihna: number;
        brut: number;
        cas: number;
        cass: number;
        impozit: number;
        net: number;
        retineri_total: number;
        rest_de_plata: number;
        cost_total_angajator: number;
        angajat: { full_name: string; marca: string } | null;
      }[]
    >();
  if (eroareRanduri !== null) {
    return raspunsText("Rândurile de salariu nu au putut fi citite.", 500);
  }
  if ((randuri ?? []).length === 0) {
    return raspunsText("Perioada nu are niciun rând calculat.", 409);
  }

  const linii: RandStatPlata[] = (randuri ?? [])
    .map((r) => ({
      marca: r.angajat?.marca ?? "",
      nume: r.angajat?.full_name ?? "—",
      zileLucrate: r.zile_lucrate,
      zileConcediu: r.zile_concediu_odihna,
      brut: r.brut,
      cas: r.cas,
      cass: r.cass,
      impozit: r.impozit,
      net: r.net,
      retineri: r.retineri_total,
      restDePlata: r.rest_de_plata,
      costAngajator: r.cost_total_angajator,
    }))
    // Ordonarea pe marcă, nu pe uuid: statul se verifică rând cu rând față de
    // pontaj, iar acolo oamenii sunt tot pe marcă.
    .sort((a, b) => a.marca.localeCompare(b.marca, "ro"));

  const pdf = await genereazaStatDePlata({
    organizatie: await antetOrganizatie(db, tenant.organizationId, tenant.name),
    an: perioada.an,
    luna: perioada.luna,
    randuri: linii,
    intocmitDe: user.fullName ?? user.email,
    generatLa: formatDateTime(new Date().toISOString()),
  });

  const nume = numeFisier(`stat-plata-${numeLuna(perioada.luna)}-${String(perioada.an)}`);
  return new Response(pdf as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nume}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
