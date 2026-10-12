// src/app/api/export/flota/foaie/[id]/route.ts
//
// Foaia de parcurs zilnică, ca PDF (0197): documentul justificativ pentru
// combustibilul dedus.
//
// Poarta minimă e `trip_sheets:read` cel puțin `own`; restul îl decide RLS-ul
// (`foi_select`, `curse_select`, `alimentari_select`): șoferul își descarcă
// foaia proprie, managerul pe ale echipei, administratorul orice foaie. Ca la
// fluturaș, nicio verificare paralelă de identitate, fiindcă ar putea diverge
// de politică. Foaia altcuiva și foaia inexistentă dau același 404.
//
// Vehiculul se citește din INSTANTANEUL de la trimitere (`vehicul_nr`,
// `vehicul_categorie`, `norma_l_100km`): foaia aprobată nu se schimbă
// retroactiv dacă mașina își schimbă norma mâine. Pe o ciornă, instantaneul
// nu există încă, deci se ia vehiculul de azi.
//
// Foaia nu se înregistrează aici în registru: o face triggerul de registru la
// trimitere (0142, `col_numar = numar`), o singură dată pe foaie.
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { numeFisier } from "@/lib/pdf/document";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { genereazaFoaieParcurs } from "@/lib/pdf/foaie-parcurs";
import { formatDate, formatDateTime, oraInBucharest } from "@/lib/format/date";
import { modelFoaieParcurs } from "@/domain/fleet/foaie";
import {
  alimentarileFoii,
  angajatiDupaId,
  citesteFoaie,
  curseleFoii,
  numeleContului,
  vehiculeDupaId,
} from "@/lib/queries/fleet";
import { ETICHETE_CATEGORIE, ETICHETE_COMBUSTIBIL } from "@/app/(app)/flota/etichete";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface ProprietatiRuta {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_cerere: Request, { params }: ProprietatiRuta): Promise<Response> {
  const { id } = await params;
  if (!TIPAR_UUID.test(id)) return raspunsText("Foaia de parcurs nu există.", 404);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return raspunsText("Nu aveți dreptul de a consulta foile de parcurs.", 403);
  }

  const foaie = await citesteFoaie(tenant.organizationId, id);
  if (foaie === null) {
    return raspunsText("Foaia de parcurs nu există sau nu vă este accesibilă.", 404);
  }

  const [curse, alimentari, vehicule, soferi, aprobator] = await Promise.all([
    curseleFoii(tenant.organizationId, foaie.id),
    alimentarileFoii(foaie.id),
    vehiculeDupaId(tenant.organizationId, [foaie.vehicle_id]),
    angajatiDupaId(tenant.organizationId, foaie.employee_id === null ? [] : [foaie.employee_id]),
    foaie.aprobat_de === null ? Promise.resolve(null) : numeleContului(foaie.aprobat_de),
  ]);
  const vehicul = vehicule.get(foaie.vehicle_id);
  const sofer = foaie.employee_id === null ? undefined : soferi.get(foaie.employee_id);
  const categorie = foaie.vehicul_categorie ?? vehicul?.categorie ?? null;
  const combustibil = foaie.vehicul_combustibil ?? vehicul?.tip_combustibil ?? null;
  const areInstantaneu = foaie.vehicul_nr !== null;

  const model = modelFoaieParcurs({
    numar: foaie.numar,
    data: foaie.data,
    status: foaie.status,
    vehiculNr: foaie.vehicul_nr ?? vehicul?.nr_inmatriculare ?? "—",
    vehiculCategorie: categorie === null ? null : ETICHETE_CATEGORIE[categorie],
    vehiculCombustibil: combustibil === null ? null : ETICHETE_COMBUSTIBIL[combustibil],
    normaL100km: areInstantaneu ? foaie.norma_l_100km : (vehicul?.consum_mediu_declarat ?? null),
    unitate: combustibil === "electric" ? "kWh" : "l",
    sofer: sofer?.full_name ?? sofer?.marca ?? "—",
    kmPlecare: foaie.km_plecare,
    kmSosire: foaie.km_sosire,
    observatii: foaie.observatii,
    trimisLa: foaie.trimis_la,
    aprobatDe: aprobator,
    aprobatLa: foaie.aprobat_la,
    curse,
    alimentari,
    ora: (moment) => oraInBucharest(new Date(moment)),
    dataSiOra: (moment) => formatDateTime(new Date(moment)),
    ziua: formatDate,
  });

  const db = await createServerSupabase();
  const pdf = await genereazaFoaieParcurs({
    organizatie: await antetOrganizatie(db, tenant.organizationId, tenant.name),
    model,
    generatLa: formatDateTime(new Date().toISOString()),
  });

  return new Response(pdf as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${numeFisier(model.numeFisier)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
