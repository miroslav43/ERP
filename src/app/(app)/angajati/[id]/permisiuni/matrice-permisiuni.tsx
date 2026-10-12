"use client";

import { useId, useState, useTransition } from "react";

import { Rotita } from "@/components/incarcare/rotita";
import { useSemnalIncarcare } from "@/components/incarcare/use-incarcare";
import { useRouter } from "next/navigation";

import type { PermissionScope } from "@/config/permissions";
import { incapeInPlafon } from "@/domain/permisiuni/plafon-acordare";

import { suprascriePermisiunea } from "./actions";

/**
 * Matricea de suprascrieri, un rând per permisiune.
 *
 * Fiecare rând arată DOUĂ lucruri, nu unul: ce dă rolul și ce s-a decis peste el.
 * Fără prima, cine acordă nu poate ști dacă schimbarea lui adaugă ceva sau doar
 * repetă implicitul — iar o suprascriere identică cu rolul e zgomot care va
 * rămâne în urmă când rolul se schimbă.
 */

export interface RandPermisiune {
  readonly cheie: string;
  /** Cheia stabilă a grupării; nu se afișează. */
  readonly resursa: string;
  readonly actiune: string;
  /**
   * Etichetele vin GATA din pagina de server (`descriePermisiunea`), ca
   * dicționarul să nu intre în pachetul de client. Cheia brută nu se mai
   * afișează (QA UX-016, ADM-012): rămâne doar în `data-cheie`.
   */
  /** Denumirea modulului, sau „Nucleu”. */
  readonly grup: string;
  readonly etichetaResursa: string;
  readonly descriereResursa: string;
  /** Ex.: „Aprobare”. */
  readonly etichetaActiune: string;
  /** Fraza întreagă, ex.: „Aprobă sau respinge cereri de concediu.” */
  readonly descriere: string;
  /** Ce dă rolul, fără nicio suprascriere. `null` = nimic. */
  readonly implicit: PermissionScope | null;
  /** Ce s-a decis pentru acest membru. `null` = fără suprascriere. */
  readonly suprascris: PermissionScope | null;
  /**
   * Cel mai larg scope pe care cititorul îl poate acorda pe cheia asta
   * (`plafonulAcordarii`, calculat pe server). Opțiunile de peste el apar, dar
   * inactive: managerul vede că „Toată firma” există, nu că lipsește.
   */
  readonly plafon: PermissionScope;
}

const ETICHETE_SCOPE: Readonly<Record<PermissionScope, string>> = {
  none: "Refuzat explicit",
  own: "Doar ale lui",
  team: "Echipa lui",
  all: "Toată firma",
};

const OPTIUNI: readonly PermissionScope[] = ["none", "own", "team", "all"];

export function MatricePermisiuni({
  memberId,
  randuri,
  poateScrie,
}: {
  readonly memberId: string;
  readonly randuri: readonly RandPermisiune[];
  readonly poateScrie: boolean;
}) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inLucru, setInLucru] = useState<string | null>(null);
  const [, porneste] = useTransition();
  // Salvarea unei permisiuni reface harta pe server; voalul global acoperă
  // intervalul în care rândul e blocat și nimic altceva nu se mișcă.
  useSemnalIncarcare(inLucru !== null, "permisiunile");
  const idBaza = useId();

  function schimba(cheie: string, valoare: string): void {
    setEroare(null);
    setInLucru(cheie);
    porneste(async () => {
      const rezultat = await suprascriePermisiunea({
        memberId,
        cheie,
        scope: valoare === "implicit" ? null : (valoare as PermissionScope),
      });
      setInLucru(null);
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  // Grupate pe resursă: nimeni nu caută „inventory:update" printre 68 de rânduri
  // plate, dar toată lumea caută „inventar". Gruparea rămâne pe cheia stabilă;
  // titlul vine din etichete. Ordinea o dă pagina (nucleul, apoi modulele).
  const peResursa = new Map<string, RandPermisiune[]>();
  for (const rand of randuri) {
    const grup = peResursa.get(rand.resursa) ?? [];
    grup.push(rand);
    peResursa.set(rand.resursa, grup);
  }

  return (
    <div className="space-y-6">
      {eroare === null ? null : (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-3"
        >
          {eroare}
        </p>
      )}

      {[...peResursa.entries()].map(([resursa, grup]) => {
        const primul = grup[0];
        if (primul === undefined) return null;
        // „Pontaj”, nu „Pontaj — Pontaj”; dar „Parc auto — Foi de parcurs”.
        const titlu =
          primul.grup === primul.etichetaResursa
            ? primul.grup
            : `${primul.grup} — ${primul.etichetaResursa}`;
        return (
          <section key={resursa} className="space-y-2">
            <div>
              <h2 className="text-foreground text-corp font-semibold">{titlu}</h2>
              <p className="text-muted-foreground text-nota">{primul.descriereResursa}</p>
            </div>
            <ul className="divide-border border-border rounded-panou divide-y border">
              {grup.map((rand) => {
                const idCamp = `${idBaza}-${rand.cheie}`;
                const valoare = rand.suprascris ?? "implicit";
                const modificat = rand.suprascris !== null;
                return (
                  <li
                    key={rand.cheie}
                    data-cheie={rand.cheie}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <label htmlFor={idCamp} className="text-foreground text-corp font-medium">
                        {rand.etichetaActiune}
                      </label>
                      <p className="text-foreground text-nota">{rand.descriere}</p>
                      <p className="text-muted-foreground text-nota">
                        Rolul dă: {rand.implicit === null ? "nimic" : ETICHETE_SCOPE[rand.implicit]}
                        {modificat ? " · suprascris" : null}
                      </p>
                    </div>
                    {/*
                    Un `<select>` dezactivat arată la fel ca unul fără drept de
                    scriere: gri, inert. Rotița de lângă el e singurul lucru care
                    deosebește „se salvează" de „nu ai voie".
                  */}
                    {inLucru === rand.cheie ? (
                      <Rotita className="text-primary self-center" />
                    ) : null}
                    <select
                      id={idCamp}
                      value={valoare}
                      aria-busy={inLucru === rand.cheie ? true : undefined}
                      disabled={!poateScrie || inLucru === rand.cheie}
                      onChange={(e) => {
                        schimba(rand.cheie, e.target.value);
                      }}
                      className={
                        "rounded-control text-corp disabled:bg-surface disabled:text-muted-foreground min-h-11 border px-3 py-2 disabled:cursor-not-allowed " +
                        (modificat ? "border-primary text-foreground" : "border-foreground/40")
                      }
                    >
                      <option value="implicit">Ca la rol</option>
                      {OPTIUNI.map((scope) => (
                        <option
                          key={scope}
                          value={scope}
                          // Aceeași regulă ca în bază (0197) și în acțiune;
                          // o suprascriere existentă peste plafon rămâne
                          // afișată ca valoare, doar nu se mai poate alege.
                          disabled={!incapeInPlafon(scope, rand.plafon)}
                        >
                          {ETICHETE_SCOPE[scope]}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
