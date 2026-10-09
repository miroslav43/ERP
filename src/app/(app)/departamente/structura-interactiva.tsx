// src/app/(app)/departamente/structura-interactiva.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { UserRoundX } from "lucide-react";

import { PanouDepartament, type LegaturiPanou, type PersoanaPanou } from "./panou-departament";
import { VizualizareLista } from "./vizualizare-lista";
import { VizualizareOrganigrama } from "./vizualizare-organigrama";
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
  poateInvita: boolean;
  /** `users:update = all`: „rol de Angajat" devine link spre permisiunile șefului. */
  poateSchimbaRoluri: boolean;
  /** Porțile paginilor-țintă ale railului din panou (calculate pe server). */
  legaturi: LegaturiPanou;
  vizualizare: "lista" | "organigrama";
}>;

export function StructuraInteractiva({
  arbore,
  nerepartizati,
  toatePersoanele,
  departamente,
  angajati,
  poateEdita,
  poateMutaPersoane,
  poateInvita,
  poateSchimbaRoluri,
  legaturi,
  vizualizare,
}: PropsStructuraInteractiva) {
  /*
   * Panoul deschis se derivă din ADRESĂ (`?departament=<id>` sau
   * `?departament=nerepartizati`), nu dintr-un `useState`: așa are un link pe
   * care îl poate trimite orice alt modul, supraviețuiește reîncărcării și se
   * închide cu butonul „înapoi". Scrierea se face cu `history.replaceState`,
   * pe care `useSearchParams` îl urmărește fără un drum la server.
   */
  const parametri = useSearchParams();
  const brut = parametri.get("departament");
  const deschisId = brut === null ? null : brut === "nerepartizati" ? NEREPARTIZATI : brut;
  const setDeschisId = useCallback((id: string | null): void => {
    const p = new URLSearchParams(window.location.search);
    if (id === null) p.delete("departament");
    else p.set("departament", id === NEREPARTIZATI ? "nerepartizati" : id);
    const interogare = p.toString();
    window.history.replaceState(
      null,
      "",
      interogare === "" ? window.location.pathname : `?${interogare}`,
    );
  }, []);

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
  }, [setDeschisId]);

  const nodDeschis = deschisId === null ? null : (dupaId.get(deschisId) ?? null);
  const esteNerepartizati = deschisId === NEREPARTIZATI;

  const persoanePanou = esteNerepartizati ? nerepartizati : (nodDeschis?.date.persoane ?? []);
  // Vecinii din arbore: departamentul superior și subordonatele, pentru rail.
  const parinte =
    nodDeschis?.date.parent_id == null ? null : (dupaId.get(nodDeschis.date.parent_id) ?? null);
  const subordonate = (nodDeschis?.copii ?? []).map((c) => ({
    id: c.date.id,
    denumire: c.date.denumire,
    efectiv: c.efectivCumulat,
  }));
  const idUriInPanou = new Set(persoanePanou.map((p) => p.id));
  const candidati = toatePersoanele.filter((p) => !idUriInPanou.has(p.id));

  return (
    <>
      {/*
       * Banda nerepartizaților.
       *
       * `department_id is null` era complet invizibil pe ecranul ăsta, deși tot
       * oamenii ăștia sunt cei pe care `dezactiveazaDepartament` îți cere să-i
       * muți înainte de a închide un departament. E singurul loc din pagină unde
       * apare auriul de accent: dacă ar fi folosit și altundeva, n-ar mai însemna
       * nimic aici.
       */}
      {nerepartizati.length === 0 ? null : (
        <div className="border-accent/40 bg-accent/8 rounded-panou flex flex-wrap items-center gap-3 border px-4 py-3">
          <span className="bg-background rounded-control flex size-9 shrink-0 items-center justify-center">
            <UserRoundX aria-hidden="true" className="text-accent-foreground size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-corp block font-medium">
              <span className="tabular-nums">{nerepartizati.length}</span>{" "}
              {nerepartizati.length === 1
                ? "persoană fără departament"
                : "persoane fără departament"}
            </span>
            <span className="text-muted-foreground text-nota block">
              Nu apar în structură și nu intră în niciun efectiv.
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setDeschisId(NEREPARTIZATI);
            }}
            className="border-foreground/60 rounded-control text-nota hover:bg-background inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-medium transition-colors active:translate-y-px"
          >
            {poateMutaPersoane ? "Repartizează" : "Vezi lista"}
          </button>
        </div>
      )}

      {vizualizare === "organigrama" ? (
        <VizualizareOrganigrama noduri={arbore} laDeschiderePanou={setDeschisId} />
      ) : (
        <VizualizareLista
          noduri={arbore}
          nivel={1}
          departamente={departamente}
          angajati={angajati}
          poateEdita={poateEdita}
          poateMutaPersoane={poateMutaPersoane}
          poateSchimbaRoluri={poateSchimbaRoluri}
          laDeschiderePanou={setDeschisId}
        />
      )}

      <PanouDepartament
        // Un id necunoscut (străin sau ascuns de RLS) lasă panoul închis.
        deschis={esteNerepartizati || nodDeschis !== null}
        laInchidere={inchide}
        departament={
          esteNerepartizati || nodDeschis === null
            ? null
            : {
                id: nodDeschis.date.id,
                denumire: nodDeschis.date.denumire,
                cod: nodDeschis.date.cod,
                activ: nodDeschis.date.activ,
              }
        }
        managerId={esteNerepartizati ? null : (nodDeschis?.date.manager_employee_id ?? null)}
        manager={esteNerepartizati ? null : (nodDeschis?.date.manager ?? null)}
        persoane={persoanePanou}
        candidati={candidati}
        departamente={departamente}
        poateMuta={poateMutaPersoane}
        poateInvita={poateInvita}
        legaturi={legaturi}
        parinte={parinte === null ? null : { id: parinte.date.id, denumire: parinte.date.denumire }}
        subordonate={subordonate}
        laDeschidere={setDeschisId}
      />
    </>
  );
}

export { NEREPARTIZATI };
