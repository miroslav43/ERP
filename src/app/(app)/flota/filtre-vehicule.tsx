// src/app/(app)/flota/filtre-vehicule.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { CATEGORII_VEHICUL, filtreVehiculeSchema, STATUS_VEHICUL } from "@/schemas/fleet";

import { ETICHETE_CATEGORIE, ETICHETE_STATUS_VEHICUL } from "./etichete";

/**
 * Filtrele parcului auto.
 *
 * ── CE ȘTERGEA VECHIUL `aplica()` ─────────────────────────────────────────
 * Pornea din `new URLSearchParams()` GOL și repunea numai `cauta`, `status` și
 * `categorie`. `filtreVehiculeSchema` citește din adresă și `sort`, și
 * `limita`, deci fiecare apăsare pe „Filtrează” arunca ordinea coloanelor și
 * mărimea paginii. `cursor` pleca și el, dar acela TREBUIE să plece — îl șterge
 * acum bara, la fiecare schimbare de filtru.
 *
 * ── DE CE NU MAI E COMPONENTĂ DE CLIENT ───────────────────────────────────
 * Trimiterea, pastilele și navigarea stau în `<BaraFiltre>`. Aici nu mai rămâne
 * nicio stare și niciun handler, doar marcaj.
 */
export type PropsFiltreVehicule = Readonly<{
  /** `await searchParams` din pagină — aceeași sursă pe care o citește tabelul. */
  parametri: Record<string, string | string[] | undefined>;
}>;

/**
 * Exact cheile pe care le administra vechiul `aplica()`. Nici una în plus — ar
 * șterge ce nu e al ei; nici una în minus — ar rămâne lipită în adresă.
 */
const CHEI_PROPRII = ["cauta", "status", "categorie"] as const;

export function FiltreVehicule({ parametri }: PropsFiltreVehicule): ReactElement {
  // Aceeași citire ca a tabelului: dacă adresa e nevalidă, bara și lista de sub
  // ea arată aceeași interpretare, nu două.
  const filtre = filtreDinUrl(filtreVehiculeSchema, parametri);

  const active: FiltruActiv[] = [];
  if (filtre.cauta !== null) {
    active.push({ cheie: "cauta", eticheta: `Număr: ${filtre.cauta}` });
  }
  if (filtre.status !== null) {
    active.push({
      cheie: "status",
      eticheta: `Stare: ${ETICHETE_STATUS_VEHICUL[filtre.status]}`,
    });
  }
  if (filtre.categorie !== null) {
    // Pastila poartă DENUMIREA, nu valoarea din enum: „Categorie:
    // Autoutilitară”, nu „categorie=autoutilitara”.
    active.push({
      cheie: "categorie",
      eticheta: `Categorie: ${ETICHETE_CATEGORIE[filtre.categorie]}`,
    });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <Camp nume="cauta" eticheta="Număr de înmatriculare" className="w-full sm:w-56">
        {(atribute) => (
          // `key` legat de valoarea din adresă: un control necontrolat își ia
          // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi
          // rămas cu valoarea veche în câmp — și ar fi reaplicat-o la
          // următoarea apăsare pe „Filtrează”.
          <input
            {...atribute}
            key={filtre.cauta ?? ""}
            type="search"
            defaultValue={filtre.cauta ?? ""}
            placeholder="B 123 ABC"
          />
        )}
      </Camp>

      <Camp nume="status" eticheta="Stare" fel="select" className="w-full sm:w-44">
        {(atribute) => (
          <select {...atribute} key={filtre.status ?? ""} defaultValue={filtre.status ?? ""}>
            <option value="">Toate</option>
            {STATUS_VEHICUL.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS_VEHICUL[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="categorie" eticheta="Categorie" fel="select" className="w-full sm:w-44">
        {(atribute) => (
          <select {...atribute} key={filtre.categorie ?? ""} defaultValue={filtre.categorie ?? ""}>
            <option value="">Toate</option>
            {CATEGORII_VEHICUL.map((c) => (
              <option key={c} value={c}>
                {ETICHETE_CATEGORIE[c]}
              </option>
            ))}
          </select>
        )}
      </Camp>
    </BaraFiltre>
  );
}
