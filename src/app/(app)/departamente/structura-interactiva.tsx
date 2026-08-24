// src/app/(app)/departamente/structura-interactiva.tsx
"use client";

import { useCallback, useMemo, useState } from "react";

import { PanouDepartament, type PersoanaPanou } from "./panou-departament";
import { VizualizareLista } from "./vizualizare-lista";
import type { NodDepartament, OptiuneAngajat, OptiuneDepartament } from "./tipuri";

/**
 * Învelișul care ține starea panoului.
 *
 * ── DE CE E CLIENT, DEȘI PAGINA E SERVER ──────────────────────────────────
 * Panoul poate fi deschis din ORICE card, deci starea „ce departament e
 * deschis" trebuie să stea într-un strămoș comun al tuturor cardurilor — adică
 * pe arbore. Alternativa ar fi un panou per card, cu tot marcajul lui duplicat
 * de N ori în DOM.
 *
 * Costul e că arborele se randează pe client. E acceptabil aici, și motivul e
 * măsurat, nu presupus: cea mai mare organizație din producție are opt angajați
 * și o mână de departamente. Preambulul de porți, citirile și construcția
 * arborelui rămân pe server; aici coboară doar rezultatul, deja calculat.
 *
 * `NUL` ca valoare de stare înseamnă „panoul nerepartizaților", nu „închis" —
 * închis e `deschis === false`. Cele două stări sunt separate tocmai fiindcă
 * `null` e o selecție legitimă.
 */

const NEREPARTIZATI = "__nerepartizati__";

export type PropsStructuraInteractiva = Readonly<{
  arbore: readonly NodDepartament[];
  nerepartizati: readonly PersoanaPanou[];
  toatePersoanele: readonly PersoanaPanou[];
  departamente: readonly OptiuneDepartament[];
  angajati: readonly OptiuneAngajat[];
  poateEdita: boolean;
  poateMutaPersoane: boolean;
}>;

export function StructuraInteractiva({
  arbore,
  nerepartizati,
  toatePersoanele,
  departamente,
  angajati,
  poateEdita,
  poateMutaPersoane,
}: PropsStructuraInteractiva) {
  const [deschisId, setDeschisId] = useState<string | null>(null);

  /** Toate nodurile, aplatizate, ca panoul să găsească departamentul din O(1). */
  const dupaId = useMemo(() => {
    const harta = new Map<string, NodDepartament>();
    const coboara = (noduri: readonly NodDepartament[]): void => {
      for (const nod of noduri) {
        harta.set(nod.date.id, nod);
        coboara(nod.copii);
      }
    };
    coboara(arbore);
    return harta;
  }, [arbore]);

  const inchide = useCallback((): void => {
    setDeschisId(null);
  }, []);

  const nodDeschis = deschisId === null ? null : (dupaId.get(deschisId) ?? null);
  const esteNerepartizati = deschisId === NEREPARTIZATI;

  const persoanePanou = esteNerepartizati ? nerepartizati : (nodDeschis?.date.persoane ?? []);
  const idUriInPanou = new Set(persoanePanou.map((p) => p.id));
  const candidati = toatePersoanele.filter((p) => !idUriInPanou.has(p.id));

  return (
    <>
      <VizualizareLista
        noduri={arbore}
        nivel={1}
        departamente={departamente}
        angajati={angajati}
        poateEdita={poateEdita}
        poateMutaPersoane={poateMutaPersoane}
        laDeschiderePanou={setDeschisId}
      />

      <PanouDepartament
        deschis={deschisId !== null}
        laInchidere={inchide}
        departament={
          esteNerepartizati || nodDeschis === null
            ? null
            : {
                id: nodDeschis.date.id,
                denumire: nodDeschis.date.denumire,
                cod: nodDeschis.date.cod,
              }
        }
        persoane={persoanePanou}
        candidati={candidati}
        departamente={departamente}
        poateMuta={poateMutaPersoane}
      />
    </>
  );
}

export { NEREPARTIZATI };
