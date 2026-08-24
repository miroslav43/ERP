// src/app/(app)/diurna/filtre-deplasari.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { filtreDeplasariSchema, STATUSURI_DEPLASARE } from "@/schemas/per-diem";

import { ETICHETE_STATUS_DEPLASARE } from "./etichete";

/**
 * Filtrele listei de deplasări.
 *
 * ── CE ȘTERGEA VECHIUL `aplica()` ─────────────────────────────────────────
 * Pornea din `new URLSearchParams()` GOL și repunea numai `status`. Cum
 * `filtreDeplasariSchema` citește din adresă și `sort`, și `limita`, orice
 * apăsare pe „Filtrează” arunca ordinea aleasă din tabel ȘI mărimea paginii,
 * fără nicio indicație că s-a întâmplat ceva. `cursor` pleca și el, dar acela
 * TREBUIE să plece — de aceea îl șterge acum bara, la fiecare schimbare.
 *
 * ── DE CE NU MAI E COMPONENTĂ DE CLIENT ───────────────────────────────────
 * Trimiterea, pastilele și navigarea stau în `<BaraFiltre>`. Aici nu mai rămâne
 * nicio stare și niciun handler, doar marcaj — deci fișierul pleacă din
 * pachetul de JavaScript al rutei și citește parametrii direct din `page.tsx`.
 */
export type PropsFiltreDeplasari = Readonly<{
  /** `await searchParams` din pagină — aceeași sursă pe care o citește tabelul. */
  parametri: Record<string, string | string[] | undefined>;
}>;

/**
 * Exact cheile pe care le administra vechiul `aplica()`. Nici una în plus — ar
 * șterge ce nu e al ei; nici una în minus — ar rămâne lipită în adresă.
 */
const CHEI_PROPRII = ["status"] as const;

export function FiltreDeplasari({ parametri }: PropsFiltreDeplasari): ReactElement {
  // Aceeași citire ca a tabelului: dacă adresa e nevalidă, bara și lista de sub
  // ea arată aceeași interpretare, nu două.
  const filtre = filtreDinUrl(filtreDeplasariSchema, parametri);

  const active: FiltruActiv[] = [];
  if (filtre.status !== null) {
    active.push({
      cheie: "status",
      eticheta: `Stare: ${ETICHETE_STATUS_DEPLASARE[filtre.status]}`,
    });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <Camp nume="status" eticheta="Stare" fel="select" className="w-full sm:w-56">
        {(atribute) => (
          // `key` legat de valoarea din adresă: un `<select>` necontrolat își
          // ia `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi
          // rămas cu opțiunea veche selectată — și ar fi reaplicat-o la
          // următoarea apăsare pe „Filtrează”.
          <select {...atribute} key={filtre.status ?? ""} defaultValue={filtre.status ?? ""}>
            <option value="">Toate</option>
            {STATUSURI_DEPLASARE.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS_DEPLASARE[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>
    </BaraFiltre>
  );
}
