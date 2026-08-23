// src/app/(app)/angajati/filtre-angajati.tsx
import type { ReactElement } from "react";
import { Search } from "lucide-react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { STATUSURI_ANGAJAT, type FiltreAngajati as ValoriFiltre } from "@/schemas/employee";
import { ETICHETE_STATUS } from "./etichete";

/**
 * Filtrele listei de angajați.
 *
 * ── CE REPARĂ MIGRAREA ────────────────────────────────────────────────────
 * Vechiul `aplica()` pornea dintr-un `new URLSearchParams()` GOL și îl
 * repopula doar cu `q` și `status`. Verificat pe adresa
 * `q=Popescu&status=activ&sort=-nume&limita=50&department_id=…&job_position_id=…`,
 * o apăsare pe „Aplică filtrele” lăsa în urmă exact `q=Popescu&status=activ`:
 * sortarea, mărimea paginii, departamentul și funcția dispăreau tăcut.
 *
 * Acum `<BaraFiltre>` pornește ÎNTOTDEAUNA din adresa curentă și atinge numai
 * cheile din `CHEI_PROPRII`. Restul supraviețuiesc prin construcție.
 *
 * Fișierul nu mai are stare, handler sau navigare proprie, deci nu mai e
 * `"use client"`: marcajul se randează pe server și pleacă din pachetul de
 * JavaScript al rutei.
 *
 * ── DE CE PRIMEȘTE FILTRELE VALIDATE, NU PARAMETRII BRUȚI ─────────────────
 * Bara citea adresa direct, iar lista o citea prin `filtreDinUrl`. Cele două
 * nu spun același lucru: `filtreDinUrl` cade pe implicitele ÎNTREGULUI obiect
 * la o SINGURĂ cheie nevalidă. Verificat rulând schema:
 * `filtreAngajatiSchema.safeParse({ status: "inventat", q: "Popescu" })`
 * întoarce `success: false`, deci lista primea `{ q: null, status: null }` —
 * complet nefiltrată — în timp ce bara afișa pastilele „Caută: Popescu” și
 * „Stare: inventat”. O pastilă e o afirmație POZITIVĂ: „filtrul ăsta e activ".
 * Ecranul spunea, cu încredere, ceva ce nu era adevărat.
 *
 * Acum ambele primesc ACELAȘI obiect. Adresa poate minți; ecranul nu.
 */

/** Cheile pe care le administrează bara — exact cele două câmpuri de mai jos. */
const CHEI_PROPRII = ["q", "status"] as const;

// Fără `useId`: componenta e un Server Component și apare o singură dată pe pagină.
const ID_CAUTARE = "filtre-angajati-cautare";
const ID_STATUS = "filtre-angajati-status";

/**
 * Pastilele — filtrele efectiv APLICATE, cu etichete citibile. Starea se
 * traduce prin `ETICHETE_STATUS`: „Stare: Activ”, nu „status=activ”.
 */
function filtreActive(filtre: ValoriFiltre): readonly FiltruActiv[] {
  const active: FiltruActiv[] = [];
  if (filtre.q !== null) active.push({ cheie: "q", eticheta: `Caută: ${filtre.q}` });
  if (filtre.status !== null) {
    active.push({ cheie: "status", eticheta: `Stare: ${ETICHETE_STATUS[filtre.status]}` });
  }
  return active;
}

export function FiltreAngajati({
  filtre,
}: {
  /** Filtrele deja trecute prin `filtreDinUrl` — exact ce a folosit lista. */
  readonly filtre: ValoriFiltre;
}): ReactElement {
  return (
    // Reperul de căutare stă pe înveliș: `<BaraFiltre>` își randează singură
    // formularul, iar pastilele fac parte din aceeași treabă.
    <div role="search" aria-label="Filtrare angajați">
      <BaraFiltre
        active={filtreActive(filtre)}
        cheiProprii={[...CHEI_PROPRII]}
        textAplica="Aplică filtrele"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor={ID_CAUTARE} className="text-corp block font-medium">
            Caută după nume
          </label>
          <div className="border-foreground/60 rounded-control mt-1 flex items-center gap-2 border px-2 focus-within:outline-2">
            <Search aria-hidden="true" className="text-muted-foreground size-4" />
            <input
              // `key` legat de valoarea din adresă: un control NECONTROLAT își ia
              // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi
              // rămas cu valoarea veche în câmp — și ar fi reaplicat-o la
              // următoarea apăsare pe „Aplică filtrele”.
              key={filtre.q ?? ""}
              id={ID_CAUTARE}
              name="q"
              type="search"
              defaultValue={filtre.q ?? ""}
              placeholder="Ex. Popescu"
              className="text-corp w-full bg-transparent py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor={ID_STATUS} className="text-corp block font-medium">
            Stare
          </label>
          <select
            key={filtre.status ?? ""}
            id={ID_STATUS}
            name="status"
            defaultValue={filtre.status ?? ""}
            className="border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2"
          >
            <option value="">Toate</option>
            {STATUSURI_ANGAJAT.map((status) => (
              <option key={status} value={status}>
                {ETICHETE_STATUS[status]}
              </option>
            ))}
          </select>
        </div>
      </BaraFiltre>
    </div>
  );
}
