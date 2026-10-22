// src/app/api/export/flota/carduri/route.ts
//
// Raportul de nepotriviri al cardurilor de combustibil pe o lună (0214, F12b):
// tranzacțiile care NU sunt potrivite pe o alimentare declarată, ca CSV.
//
// Poarta: modulul `fleet` și `vehicles:update = all` + `vehicles:read = all`
// (poarta ecranului de tranzacții; `tranzactii_card_select` cere `read = all`).
// Organizația vine din tenant, niciodată din parametri; luna e obligatorie.
// Plafon explicit, nu tăcut: `nepotrivirileLunii` refuză la 1000 de rânduri.
import { getEnabledFeatures } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { lunaValida } from "@/domain/fleet/rapoarte";
import { etichetaEmitent } from "@/domain/fleet/carduri/emitenti";
import { ActionDenied } from "@/lib/actions/errors";
import { vehiculeDupaId } from "@/lib/queries/fleet";
import { nepotrivirileLunii } from "@/lib/queries/fleet-carduri";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

import { ETICHETE_CATEGORIE, ETICHETE_STARE_POTRIVIRE } from "@/app/(app)/flota/carduri/etichete";

export const dynamic = "force-dynamic";

const ANTET: readonly string[] = [
  "Data și ora (ora României)",
  "Emitent",
  "Card (ultimele cifre)",
  "Nr. auto din extras",
  "Vehicul",
  "Produs",
  "Categorie",
  "Cantitate (L)",
  "Valoare",
  "Moneda",
  "Stația",
  "Localitatea",
  "Km la pompă",
  "Bon",
  "Stare",
  "Motiv",
  "Notă",
];

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

/** Excel interpretează „=", „+", „-", „@" ca formule: textele din extras pot începe așa. */
const celula = (valoare: string): string => {
  const curat = valoare.replace(/\r?\n/g, " ");
  const protejat = /^[=+\-@\t]/.test(curat) ? `'${curat}` : curat;
  return `"${protejat.replace(/"/g, '""')}"`;
};

const ORA = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const NUMAR = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export async function GET(request: Request): Promise<Response> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return raspunsText("Trebuie să vă autentificați.", 401);
  }
  if (rezolvare.status !== "ok") return raspunsText("Alegeți mai întâi o organizație.", 403);
  const { tenant } = rezolvare;
  if (!(await getEnabledFeatures(tenant.organizationId)).has("fleet")) {
    return raspunsText("Modulul Parc auto nu este activ pentru organizație.", 404);
  }
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  if (!can(permisiuni, "vehicles:update", "all") || !can(permisiuni, "vehicles:read", "all")) {
    return raspunsText("Raportul tranzacțiilor de card îl descarcă administratorul parcului.", 403);
  }
  const luna = new URL(request.url).searchParams.get("luna");
  if (!lunaValida(luna)) {
    return raspunsText("Luna se dă în forma `luna=2026-09`.", 400);
  }

  let randuri: Awaited<ReturnType<typeof nepotrivirileLunii>>;
  try {
    randuri = await nepotrivirileLunii(tenant.organizationId, luna);
  } catch (err: unknown) {
    // DOAR plafonul (`limitExceeded` din citire). O eroare a bazei NU se
    // deghizează în „prea multe rânduri”: urcă, ca la orice rută.
    if (err instanceof ActionDenied && err.code === "LIMITA_DEPASITA") {
      return raspunsText(
        "Luna are prea multe tranzacții pentru un singur raport. Contactați administratorul aplicației.",
        413,
      );
    }
    throw err;
  }
  const vehicule = await vehiculeDupaId(
    tenant.organizationId,
    randuri.map((r) => r.vehicle_id).filter((v): v is string => v !== null),
  );

  const linii = randuri.map((r) =>
    [
      r.are_ora
        ? ORA.format(new Date(r.efectuat_la))
        : ORA.format(new Date(r.efectuat_la)).slice(0, 10),
      etichetaEmitent(r.emitent),
      r.card_ultimele_cifre ?? "",
      r.nr_inmatriculare_extras ?? "",
      r.vehicle_id === null ? "" : (vehicule.get(r.vehicle_id)?.nr_inmatriculare ?? ""),
      r.produs,
      ETICHETE_CATEGORIE[r.categorie],
      NUMAR(r.cantitate),
      NUMAR(r.valoare_bruta),
      r.moneda,
      r.statie ?? "",
      r.localitate ?? "",
      r.km_declarat === null ? "" : String(r.km_declarat),
      r.numar_bon ?? "",
      ETICHETE_STARE_POTRIVIRE[r.stare_potrivire],
      r.motiv ?? "",
      r.nota ?? "",
    ]
      .map(celula)
      .join(";"),
  );
  const continut = `﻿${[ANTET.map(celula).join(";"), ...linii].join("\r\n")}`;
  return new Response(continut, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="nepotriviri-carduri-${luna}.csv"`,
      "cache-control": "no-store",
    },
  });
}
