// src/app/api/export/flota/pv/[id]/route.ts
//
// Procesul-verbal de predare-primire a vehiculului, ca PDF (0215, F12c).
//
// Poarta e modulul `fleet` plus RLS (`pv_vehicul_select`), FĂRĂ o poartă pe
// `vehicles:read`: decizia 3 a lui Miro (B3) îi dă omului fără `vehicles:read`
// (de regulă `hr`) care conduce o mașină a firmei PV-urile la care e PARTE.
// O poartă pe `vehicles:read` l-ar fi lăsat fără hârtia pe care o semnează.
// Ca la foaia de parcurs, nicio verificare paralelă de identitate: PV-ul
// altcuiva și PV-ul inexistent dau același 404.
//
// Doar PV-ul FINALIZAT (inclusiv anulat, cu banda „ANULAT”): o hârtie care se
// semnează are număr (Ordinul 217/1996; `document-generat.ts`: „fără număr,
// fără document”). Conținutul vine din INSTANTANEUL de la finalizare, deci
// aceeași hârtie de fiecare dată; antetul firmei e citit viu, ca la fluturaș.
//
// NU se înregistrează aici în registru: o face triggerul la finalizare.
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { numeFisier } from "@/lib/pdf/document";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { genereazaPvVehicul } from "@/lib/pdf/proces-verbal-vehicul";
import { formatDateTime } from "@/lib/format/date";
import { citestePv } from "@/lib/queries/fleet-pv";
import { esteIdDeRuta } from "@/lib/rute/parametri";
import { modelPv, numeFisierPv } from "@/domain/fleet/proces-verbal";
import { intrareModelDinRand } from "@/app/(app)/flota/[id]/pv/model-din-rand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface ProprietatiRuta {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(cerere: Request, { params }: ProprietatiRuta): Promise<Response> {
  const { id } = await params;
  if (!esteIdDeRuta(id)) return raspunsText("Procesul-verbal nu există.", 404);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");

  const pv = await citestePv(tenant.organizationId, id);
  if (pv === null) {
    return raspunsText("Procesul-verbal nu există sau nu vă este accesibil.", 404);
  }
  if (pv.stare === "ciorna" || pv.snapshot === null) {
    return raspunsText(
      "Procesul-verbal este încă ciornă. Finalizați-l ca să primească număr.",
      409,
    );
  }

  const intrare = intrareModelDinRand(pv, {
    vehicul: null,
    documente: [],
    firma: tenant.legalName ?? tenant.name,
  });
  const model = modelPv(intrare);

  const db = await createServerSupabase();
  const pdf = await genereazaPvVehicul({
    organizatie: await antetOrganizatie(db, tenant.organizationId, tenant.name),
    model,
    numar: pv.numar,
    generatLa: formatDateTime(new Date().toISOString()),
  });

  const inline = new URL(cerere.url).searchParams.get("inline") === "1";
  const nume = numeFisier(numeFisierPv(pv.tip, intrare.vehicul.nr_inmatriculare, pv.numar));
  return new Response(pdf as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${nume}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
