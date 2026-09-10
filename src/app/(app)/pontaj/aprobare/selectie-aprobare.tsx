"use client";

import { useMemo, useState, type ReactElement } from "react";
import { CheckCircle2 } from "lucide-react";

import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { formatOre } from "@/lib/format/ore";
import { clasaBifa } from "@/components/ui/camp";

import { AprobareBloc } from "./aprobare-bloc";

export interface RandAprobare {
  readonly id: string;
  readonly nume: string;
  readonly zile: number;
  readonly ore: number;
}

/**
 * Lista de aprobat, cu bifă pe fiecare om, și butonul care spune exact ce
 * aprobă.
 *
 * ── DE CE O SINGURĂ COMPONENTĂ ──────────────────────────────────────────────
 * Butonul stătea deasupra tabelului, iar cele două nu se cunoșteau: scria
 * „Aprobă în bloc (412 linii)" peste o listă pe care n-o descria. Ca butonul
 * să spună ce aprobă, selecția trebuie să fie a AMÂNDURORA — deci starea stă
 * aici, iar `AprobareBloc` o primește gata numărată.
 *
 * ── DE CE PE ANGAJAT, ȘI NU PE ZI ───────────────────────────────────────────
 * O bifă per zi ar însemna, pe o lună de 46 de oameni, peste o mie de casete pe
 * ecran. Decizia pe ZI se ia în „Prezența", unde fiecare celulă își poartă
 * culoarea stării și se deschide cu un clic. Aici granularitatea firească e
 * omul: „pe ăsta îl aprob, pe ăsta îl las până vorbesc cu el".
 *
 * ── DE CE TOȚI SUNT BIFAȚI LA ÎNCEPUT ───────────────────────────────────────
 * Fiindcă asta făcea butonul înainte, iar reparația nu trebuie să schimbe
 * tăcut ce se întâmplă la o apăsare. Ce se schimbă e că acum SCRIE ce se
 * întâmplă, și că se poate scoate cineva din lot.
 */
export function SelectieAprobare({
  randuri,
  periodId,
  departmentId,
  an,
  luna,
  poateSincroniza,
  numarSaptamaniDeAprobat,
}: {
  readonly randuri: readonly RandAprobare[];
  readonly periodId: string;
  readonly departmentId: string | null;
  readonly an: number;
  readonly luna: number;
  readonly poateSincroniza: boolean;
  readonly numarSaptamaniDeAprobat: number;
}): ReactElement {
  const toateIdurile = useMemo(() => randuri.map((r) => r.id), [randuri]);
  const [alesi, setAlesi] = useState<ReadonlySet<string>>(() => new Set(toateIdurile));

  /*
    Lista se poate schimba sub selecție: filtrul de departament o reîncarcă, iar
    un `useState` inițializat o dată ar păstra oameni care nu mai sunt pe ecran.
    Intersecția o ține curată fără un efect care resetează bifele la fiecare
    randare — iar `null` (toți) rămâne posibil abia jos, la trimitere.
  */
  const aleseValide = useMemo(
    () => toateIdurile.filter((id) => alesi.has(id)),
    [toateIdurile, alesi],
  );

  const totaluri = useMemo(() => {
    const set = new Set(aleseValide);
    return randuri
      .filter((r) => set.has(r.id))
      .reduce((acc, r) => ({ zile: acc.zile + r.zile, ore: acc.ore + r.ore }), { zile: 0, ore: 0 });
  }, [randuri, aleseValide]);

  const totiBifati = aleseValide.length === toateIdurile.length && toateIdurile.length > 0;

  function comuta(id: string): void {
    setAlesi((precedenti) => {
      const urmator = new Set(precedenti);
      if (urmator.has(id)) urmator.delete(id);
      else urmator.add(id);
      return urmator;
    });
  }

  const coloane: readonly Coloana<RandAprobare>[] = [
    {
      cheie: "bifa",
      antet: "Intră în lot",
      antetAscuns: true,
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (rand) => (
        <input
          type="checkbox"
          className={clasaBifa}
          checked={alesi.has(rand.id)}
          onChange={() => {
            comuta(rand.id);
          }}
          aria-label={`Include ${rand.nume} în lotul de aprobare`}
        />
      ),
    },
    { cheie: "angajat", antet: "Angajat", peTelefon: "titlu", celula: (r) => r.nume },
    {
      cheie: "zile",
      antet: "Zile neaprobate",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => r.zile,
    },
    {
      cheie: "ore",
      antet: "Ore lucrate",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatOre(r.ore),
    },
  ];

  return (
    <div className="space-y-4">
      <AprobareBloc
        periodId={periodId}
        departmentId={departmentId}
        an={an}
        luna={luna}
        poateSincroniza={poateSincroniza}
        // `null` = „toți cei de pe ecran", nu lista întreagă: între încărcare și
        // apăsare cineva mai poate ponta o zi, iar cine n-a atins bifele o vrea
        // și pe aia. Vezi nota din `aprobaPontajBlocSchema`.
        idAngajatiAlesi={totiBifati ? null : aleseValide}
        numarAngajati={aleseValide.length}
        numarZile={totaluri.zile}
        oreTotale={totaluri.ore}
      />

      {randuri.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAlesi(new Set(totiBifati ? [] : toateIdurile));
            }}
            className="text-corp underline underline-offset-2"
          >
            {totiBifati ? "Scoate toți din lot" : "Include toți în lot"}
          </button>
          <span className="text-muted-foreground text-nota">
            <span className="tabular-nums">{aleseValide.length}</span> din{" "}
            <span className="tabular-nums">{toateIdurile.length}</span>{" "}
            {toateIdurile.length === 1 ? "angajat ales" : "angajați aleși"}
          </span>
        </div>
      )}

      <Tabel
        caption="Angajații cu linii de pontaj neaprobate. Bifa alege cine intră în lotul de aprobare."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(rand) => rand.id}
        gol={
          <StareGoala
            fel="initiala"
            pictograma={CheckCircle2}
            titlu={
              numarSaptamaniDeAprobat === 0 ? "Nimic de aprobat" : "Nicio zi de aprobat separat"
            }
            descriere={
              numarSaptamaniDeAprobat === 0
                ? "Toate zilele de pontaj ale acestei luni au fost deja aprobate."
                : `Zilele lunii sunt aprobate. ${
                    numarSaptamaniDeAprobat === 1
                      ? "Mai există o fișă săptămânală de aprobat"
                      : `Mai există ${String(numarSaptamaniDeAprobat)} fișe săptămânale de aprobat`
                  }, în capul paginii — aprobarea ei scrie zilele direct în pontaj, gata aprobate.`
            }
          />
        }
      />
    </div>
  );
}
