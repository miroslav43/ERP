// src/app/(app)/flota/rezervari/rand-rezervare.tsx
//
// Rândul unei rezervări (componentă de server): mașina, intervalul, scopul,
// starea afișată și acțiunile. Același rând în `/flota/rezervari`, în portal
// și pe fișa vehiculului.
//
// Drepturile pe rând se calculează AICI, din scope-urile paginii și din fișa
// proprie: baza rămâne cea care refuză (auto-decizia, motivul lipsă, foaia
// legată), butoanele doar nu oferă ce n-ar trece.
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { RANK as RANG, type PermissionScope } from "@/config/permissions";
import { stareAfisata } from "@/domain/fleet/rezervari";
import { formatInterval } from "@/lib/format/date";
import type { RandRezervare } from "@/lib/queries/fleet-rezervari";

import { ActiuniRezervare } from "./actiuni-rezervare";
import { ETICHETE_STARE_AFISATA, TONURI_STARE_AFISATA } from "./etichete";

export type DrepturiRezervari = Readonly<{
  /** `vehicle_reservations:update`; `null` = absent. */
  update: PermissionScope | null;
  /** `vehicle_reservations:approve`; `null` = absent. */
  approve: PermissionScope | null;
  /** `trip_sheets:create` ≥ own: „Începe foaia zilei”. */
  poateCreaFoaie: boolean;
}>;

export type PropsRandRezervare = Readonly<{
  rezervare: RandRezervare;
  azi: string;
  fisaMeaId: string | null;
  drepturi: DrepturiRezervari;
  /** Ruta casetei „Foaie nouă” (`/flota/foi` sau `/portal/masina-mea`). */
  bazaFoaie: string;
  afiseazaAngajat?: boolean;
  afiseazaVehicul?: boolean;
}>;

const rang = (s: PermissionScope | null): number => (s === null ? 0 : RANG[s]);

export function RandRezervareCard({
  rezervare: r,
  azi,
  fisaMeaId,
  drepturi,
  bazaFoaie,
  afiseazaAngajat = true,
  afiseazaVehicul = true,
}: PropsRandRezervare): ReactElement {
  const stare = stareAfisata(r, azi);
  const esteAMea = fisaMeaId !== null && r.employee_id === fisaMeaId;
  // Rândul e vizibil prin RLS, deci sub `team` angajatul e în subarborele meu.
  const poateDecide = rang(drepturi.approve) >= RANG.team && !esteAMea;
  const poateModifica =
    rang(drepturi.update) >= RANG.all ||
    (esteAMea && rang(drepturi.update) >= RANG.own) ||
    (!esteAMea && rang(drepturi.approve) >= RANG.team);
  const hrefFoaieZilei =
    esteAMea &&
    drepturi.poateCreaFoaie &&
    r.status === "confirmata" &&
    r.de_la <= azi &&
    azi <= r.pana_la
      ? `${bazaFoaie}?foaie=noua&vehicul=${r.vehicle_id}`
      : null;

  const vehicul =
    r.vehicul === null
      ? "Mașina nu mai e în pool"
      : `${r.vehicul.nr_inmatriculare} · ${r.vehicul.marca} ${r.vehicul.model}`;

  return (
    <li className="bg-surface border-border rounded-panou border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {afiseazaVehicul ? (
            <p className="text-foreground text-corp font-medium">{vehicul}</p>
          ) : null}
          <p className="text-corp tabular-nums">{formatInterval(r.de_la, r.pana_la)}</p>
          {afiseazaAngajat ? (
            <p className="text-muted-foreground text-corp">
              {esteAMea ? "Rezervarea dumneavoastră" : (r.angajat?.full_name ?? "—")}
            </p>
          ) : null}
          <p className="text-muted-foreground text-nota">
            Scop: {r.scop}
            {r.destinatie === null ? "" : ` · ${r.destinatie}`}
          </p>
          {r.status === "respinsa" && r.motiv_respingere !== null ? (
            <p className="text-nota text-danger">Motiv: {r.motiv_respingere}</p>
          ) : null}
          {r.status === "anulata" && r.motiv_anulare !== null ? (
            <p className="text-nota text-muted-foreground">Motiv: {r.motiv_anulare}</p>
          ) : null}
        </div>
        <Badge ton={TONURI_STARE_AFISATA[stare]}>{ETICHETE_STARE_AFISATA[stare]}</Badge>
      </div>
      <div className="mt-3 empty:hidden">
        <ActiuniRezervare
          rezervare={{
            id: r.id,
            vehicle_id: r.vehicle_id,
            status: r.status,
            de_la: r.de_la,
            pana_la: r.pana_la,
          }}
          azi={azi}
          poateDecide={poateDecide}
          poateModifica={poateModifica}
          esteAMea={esteAMea}
          hrefFoaieZilei={hrefFoaieZilei}
        />
      </div>
    </li>
  );
}
