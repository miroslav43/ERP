// src/app/(app)/flota/foi/filtre-foi.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { filtreFoiSchema, STATUS_FOAIE } from "@/schemas/fleet";

import { ETICHETE_STATUS_FOAIE } from "../etichete";

/**
 * Filtrele foilor de parcurs.
 *
 * ── DE CE N-AU EXISTAT PÂNĂ ACUM ──────────────────────────────────────────
 * `filtreFoiSchema` avea dintotdeauna `status` și `vehicul`, `listeazaFoi` le
 * aplica, iar pagina calcula `areFiltre` pentru o ramură de stare goală pe care
 * niciun control din ecran nu o putea declanșa: „Niciun rezultat pentru filtrele
 * alese” era text mort. Filtrele se puteau pune doar scriind adresa de mână.
 *
 * Fișa vehiculului trimite acum aici cu `?vehicul=<id>`, deci drumul
 * vehicul → cursele lui există și el.
 */
export type VehiculOptiune = Readonly<{ id: string; nr_inmatriculare: string }>;

export type PropsFiltreFoi = Readonly<{
  /** `await searchParams` din pagină — aceeași sursă pe care o citește tabelul. */
  parametri: Record<string, string | string[] | undefined>;
  /**
   * Vehiculele pe care le poate vedea utilizatorul. Poate fi GOALĂ fără nicio
   * eroare: un `manager` are `trip_sheets:read` la scope „team”, dar niciun
   * drept pe `vehicles`, iar RLS îi întoarce zero rânduri. Un `<select>` cu
   * „Toate” și nimic altceva ar fi arătat ca un filtru stricat, deci în cazul
   * ăla câmpul nu se randează deloc.
   */
  vehicule: readonly VehiculOptiune[];
}>;

/** Exact cheile pe care le administrează bara. Nici una în plus, nici una în minus. */
const CHEI_PROPRII = ["status", "vehicul"] as const;

export function FiltreFoi({ parametri, vehicule }: PropsFiltreFoi): ReactElement {
  const filtre = filtreDinUrl(filtreFoiSchema, parametri);
  const numarVehicul = new Map(vehicule.map((v) => [v.id, v.nr_inmatriculare]));

  const active: FiltruActiv[] = [];
  if (filtre.status !== null) {
    active.push({ cheie: "status", eticheta: `Stare: ${ETICHETE_STATUS_FOAIE[filtre.status]}` });
  }
  if (filtre.vehicul !== null) {
    // Pastila poartă NUMĂRUL, nu identificatorul. Când vehiculul nu e vizibil —
    // filtrul a venit dintr-un link — se spune asta, nu se afișează un UUID.
    active.push({
      cheie: "vehicul",
      eticheta: `Vehicul: ${numarVehicul.get(filtre.vehicul) ?? "altul decât cele vizibile"}`,
    });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <Camp nume="status" eticheta="Stare" fel="select" className="w-full sm:w-56">
        {(atribute) => (
          // `key` legat de valoarea din adresă: un control necontrolat își ia
          // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi
          // rămas cu valoarea veche și ar fi reaplicat-o la următoarea trimitere.
          <select {...atribute} key={filtre.status ?? ""} defaultValue={filtre.status ?? ""}>
            <option value="">Toate</option>
            {STATUS_FOAIE.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS_FOAIE[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      {vehicule.length === 0 ? null : (
        <Camp nume="vehicul" eticheta="Vehicul" fel="select" className="w-full sm:w-48">
          {(atribute) => (
            <select {...atribute} key={filtre.vehicul ?? ""} defaultValue={filtre.vehicul ?? ""}>
              <option value="">Toate</option>
              {vehicule.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nr_inmatriculare}
                </option>
              ))}
            </select>
          )}
        </Camp>
      )}
    </BaraFiltre>
  );
}
