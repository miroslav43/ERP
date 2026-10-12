// src/app/api/export/flota/amenzi/[id]/scrisoare/route.ts
//
// Scrisoarea de răspuns către autoritate (0203): firma comunică cine conducea
// vehiculul, cu datele cerute de OUG 195/2002 art. 39 alin. (2) — nume, CNP,
// domiciliu sau reședință, act de identitate.
//
// ── DE CE ARE TREI PORȚI ────────────────────────────────────────────────────
//   1. `vehicle_fines:read = all` — dreptul de a vedea amenda; RLS-ul
//      (`vehicle_fines_select`) o judecă oricum, iar o amendă invizibilă dă 404;
//   2. `employees:read = all` — cerut de RPC-ul `hr_read_sensitive`, care
//      refuză altfel și scrie un rând de audit la FIECARE apel: scrisoarea
//      poartă CNP-ul întreg al unui om, deci citirea lui lasă urmă. Fără poarta
//      asta, cineva cu amenzile, dar fără fișele angajaților, ar primi o
//      scrisoare cu linie goală la CNP și fără să știe de ce;
//   3. amenda are un șofer desemnat (stadiul „șofer desemnat” sau mai departe).
//
// Scrisoarea NU marchează amenda „răspuns trimis”: asta o face omul, după ce a
// semnat și a trimis-o (`trimiteRaspuns`). Ruta doar citește.
//
// Ce lipsește din fișă (CNP, adresă, act) nu se inventează: documentul lasă
// linie de completat și o spune sus, iar răspunsul HTTP rămâne 200.
import { adresaPentruScrisoare, modelScrisoareDesemnare } from "@/domain/fleet/amenzi";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { cnpComplet } from "@/lib/documents/inrolare";
import {
  formatDate,
  formatDateTime,
  oraInBucharest,
  toBucharestDateString,
} from "@/lib/format/date";
import { numeFisier } from "@/lib/pdf/document";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { genereazaScrisoareDesemnare } from "@/lib/pdf/scrisoare-desemnare";
import { citesteAmenda, datePersonaleSofer } from "@/lib/queries/flota-amenzi";
import { vehiculeDupaId } from "@/lib/queries/fleet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPAR_CNP = /^\d{13}$/;

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface ProprietatiRuta {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_cerere: Request, { params }: ProprietatiRuta): Promise<Response> {
  const { id } = await params;
  if (!TIPAR_UUID.test(id)) return raspunsText("Amenda nu există.", 404);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  if (!can(permisiuni, "vehicle_fines:read", "all")) {
    return raspunsText("Nu aveți dreptul de a consulta amenzile.", 403);
  }
  if (!can(permisiuni, "employees:read", "all")) {
    return raspunsText(
      "Scrisoarea cuprinde CNP-ul șoferului, pe care îl citesc doar cei cu acces la toate fișele angajaților. Cereți administratorului organizației.",
      403,
    );
  }

  const amenda = await citesteAmenda(tenant.organizationId, id);
  if (amenda === null) return raspunsText("Amenda nu există sau nu vă este accesibilă.", 404);
  if (amenda.sofer_desemnat_id === null) {
    return raspunsText(
      "Amenda nu are un șofer desemnat. Alegeți întâi șoferul, apoi generați scrisoarea.",
      409,
    );
  }

  const [vehicule, sofer] = await Promise.all([
    vehiculeDupaId(tenant.organizationId, [amenda.vehicle_id]),
    datePersonaleSofer(tenant.organizationId, amenda.sofer_desemnat_id),
  ]);
  if (sofer === null) {
    return raspunsText("Fișa șoferului desemnat nu există sau nu vă este accesibilă.", 404);
  }
  const vehicul = vehicule.get(amenda.vehicle_id);

  const db = await createServerSupabase();
  // `hr_read_sensitive` scrie rândul de audit al consultării. Un CNP lipsă sau
  // nedecriptabil nu oprește scrisoarea: iese linie de completat.
  const cnp = await cnpComplet(db, amenda.sofer_desemnat_id).catch(() => "");
  const momentFapta = new Date(amenda.constatata_la);
  const azi = new Date();

  const model = modelScrisoareDesemnare({
    organizatie: tenant.name,
    autoritate: amenda.autoritate,
    numarPv: amenda.numar_pv,
    dataPv: amenda.data_pv === null ? null : formatDate(amenda.data_pv),
    vehiculNr: vehicul?.nr_inmatriculare ?? "—",
    momentFapta: `${formatDate(toBucharestDateString(momentFapta))}, ora ${oraInBucharest(momentFapta)}`,
    locul: amenda.locul,
    fapta: amenda.fapta,
    sofer: {
      nume: sofer.full_name ?? sofer.marca ?? "",
      cnp: TIPAR_CNP.test(cnp) ? cnp : null,
      adresa: adresaPentruScrisoare(sofer),
      tipAct: sofer.tip_act_identitate,
      serieAct: sofer.serie_act,
      numarAct: sofer.numar_act,
    },
    dataScrisorii: formatDate(toBucharestDateString(azi)),
    numarIesire: amenda.raspuns_numar,
  });

  const pdf = await genereazaScrisoareDesemnare({
    organizatie: await antetOrganizatie(db, tenant.organizationId, tenant.name),
    model,
    generatLa: formatDateTime(azi),
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
