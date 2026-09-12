"use client";

import { useMemo, useState, type ReactElement } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

import { StareGoala } from "@/components/ui/stare-goala";
import { clasaBifa } from "@/components/ui/camp";
import { formatDate } from "@/lib/format/date";
import { formatOre } from "@/lib/format/ore";
import type { SursaIntrare, TipZi } from "@/schemas/attendance";

import { AprobareBloc } from "./aprobare-bloc";
import { ETICHETE_SURSA } from "../etichete";

/** O zi neaprobată, aşa cum o vede aprobatorul înainte să semneze. */
export interface ZiDeAprobat {
  readonly id: string;
  readonly data: string;
  readonly ore: number;
  readonly oraInceput: string | null;
  readonly oraSfarsit: string | null;
  readonly tipZi: TipZi;
  readonly sursa: SursaIntrare;
}

export interface RandAprobare {
  readonly id: string;
  readonly nume: string;
  readonly zile: readonly ZiDeAprobat[];
}

/**
 * Lista de aprobat — pe ZILE, grupate pe om — cu butonul care spune ce aprobă.
 *
 * ── DE CE PE ZI, DUPĂ CE A FOST PE ANGAJAT ──────────────────────────────────
 * Versiunea anterioară bifa OMUL, iar rezumatul spunea „1 zi, de la 1 angajat,
 * însumând 8:00 ore". Adevărat, și insuficient: aprobatorul nu vedea CARE zi,
 * cu ce interval, scrisă de cine — și nu putea aproba patru zile dintr-o
 * săptămână și lăsa a cincea. Alegerea era, pe fiecare om, tot sau nimic.
 *
 * Aprobarea intră în statul de plată. Ce se semnează trebuie să se vadă.
 *
 * Argumentul de atunci împotriva bifei pe zi era real: o lună de 46 de oameni
 * înseamnă peste o mie de casete pe ecran. De-aia zilele stau PLIATE sub om:
 * cine aprobă în bloc vede lista scurtă, ca înainte; cine vrea să se uite,
 * desface un rând și vede exact zilele lui. Ambele nevoi, un singur ecran.
 *
 * ── DE CE TOATE SUNT BIFATE LA ÎNCEPUT ──────────────────────────────────────
 * Fiindcă asta făcea butonul înainte, iar reparația nu trebuie să schimbe tăcut
 * ce se întâmplă la o apăsare. Ce se schimbă e că acum SCRIE ce se întâmplă.
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
  const toateZilele = useMemo(() => randuri.flatMap((r) => r.zile.map((z) => z.id)), [randuri]);
  const [alese, setAlese] = useState<ReadonlySet<string>>(() => new Set(toateZilele));
  const [desfacute, setDesfacute] = useState<ReadonlySet<string>>(() => new Set<string>());

  /*
   * Lista se poate schimba sub selecție: filtrul de departament o reîncarcă, iar
   * un `useState` inițializat o dată ar păstra zile care nu mai sunt pe ecran.
   * Intersecția o ține curată fără un efect care resetează bifele la fiecare
   * randare.
   */
  const zileValide = useMemo(() => toateZilele.filter((id) => alese.has(id)), [toateZilele, alese]);
  const setAles = useMemo(() => new Set(zileValide), [zileValide]);

  const totaluri = useMemo(() => {
    let zile = 0;
    let ore = 0;
    const oameni = new Set<string>();
    for (const rand of randuri) {
      for (const zi of rand.zile) {
        if (!setAles.has(zi.id)) continue;
        zile += 1;
        ore += zi.ore;
        oameni.add(rand.id);
      }
    }
    return { zile, ore, angajati: oameni.size };
  }, [randuri, setAles]);

  const toateBifate = zileValide.length === toateZilele.length && toateZilele.length > 0;

  function comutaZile(ids: readonly string[], catre: boolean): void {
    setAlese((precedente) => {
      const urmator = new Set(precedente);
      for (const id of ids) {
        if (catre) urmator.add(id);
        else urmator.delete(id);
      }
      return urmator;
    });
  }

  function comutaDesfacerea(id: string): void {
    setDesfacute((precedente) => {
      const urmator = new Set(precedente);
      if (urmator.has(id)) urmator.delete(id);
      else urmator.add(id);
      return urmator;
    });
  }

  /*
   * Lista intră ÎNĂUNTRUL casetei de aprobare, sub buton.
   *
   * Stătea sub casetă, despărțită de buton prin blocul de sincronizare cu
   * concediile — o acțiune fără legătură cu lotul. „Se aprobă 1 zi de la 1
   * angajat" și rândul care spune CARE zi ajungeau de o parte și de alta a
   * altui subiect, iar propoziția părea să nu descrie nimic de pe ecran.
   */
  const lista =
    randuri.length === 0 ? (
      <StareGoala
        fel="initiala"
        pictograma={CheckCircle2}
        titlu={numarSaptamaniDeAprobat === 0 ? "Nimic de aprobat" : "Nicio zi de aprobat separat"}
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
    ) : (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAlese(new Set(toateBifate ? [] : toateZilele));
            }}
            className="text-corp underline underline-offset-2"
          >
            {toateBifate ? "Scoate toate zilele din lot" : "Include toate zilele în lot"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDesfacute(
                desfacute.size === randuri.length ? new Set() : new Set(randuri.map((r) => r.id)),
              );
            }}
            className="text-corp underline underline-offset-2"
          >
            {desfacute.size === randuri.length ? "Pliază toate zilele" : "Arată toate zilele"}
          </button>
          <span className="text-muted-foreground text-nota">
            <span className="tabular-nums">{zileValide.length}</span> din{" "}
            <span className="tabular-nums">{toateZilele.length}</span>{" "}
            {toateZilele.length === 1 ? "zi aleasă" : "zile alese"}
          </span>
        </div>

        <ul className="border-border rounded-panou divide-border divide-y overflow-hidden border">
          {randuri.map((rand) => (
            <GrupAngajat
              key={rand.id}
              rand={rand}
              alese={setAles}
              desfacut={desfacute.has(rand.id)}
              laDesfacere={() => {
                comutaDesfacerea(rand.id);
              }}
              laComutare={comutaZile}
            />
          ))}
        </ul>
      </div>
    );

  return (
    <AprobareBloc
      periodId={periodId}
      departmentId={departmentId}
      an={an}
      luna={luna}
      poateSincroniza={poateSincroniza}
      /*
       * `null` = „tot ce e pe ecran acum", nu lista întreagă: între încărcare
       * și apăsare cineva mai poate ponta o zi, iar cine n-a atins bifele o
       * vrea și pe aia. Vezi nota din `aprobaPontajBlocSchema`.
       */
      idZileAlese={toateBifate ? null : zileValide}
      /* Respingerea cere lista enumerată — v. nota din `AprobareBloc`. */
      idZileExplicit={zileValide}
      numarAngajati={totaluri.angajati}
      numarZile={totaluri.zile}
      oreTotale={totaluri.ore}
      lista={lista}
      areCeAproba={randuri.length > 0}
    />
  );
}

/** Un om, cu totalurile lui și zilele pliate dedesubt. */
function GrupAngajat({
  rand,
  alese,
  desfacut,
  laDesfacere,
  laComutare,
}: {
  readonly rand: RandAprobare;
  readonly alese: ReadonlySet<string>;
  readonly desfacut: boolean;
  readonly laDesfacere: () => void;
  readonly laComutare: (ids: readonly string[], catre: boolean) => void;
}): ReactElement {
  const idZile = rand.zile.map((z) => z.id);
  const bifate = idZile.filter((id) => alese.has(id));
  const toate = bifate.length === idZile.length;
  const niciuna = bifate.length === 0;
  const ore = rand.zile.reduce((s, z) => (alese.has(z.id) ? s + z.ore : s), 0);

  return (
    <li>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          className={clasaBifa}
          checked={toate}
          /* Parțial: nici bifat, nici gol. Fără asta, un om cu 3 zile din 5 alese
             ar arăta identic cu unul scos complet din lot. */
          ref={(el) => {
            if (el !== null) el.indeterminate = !toate && !niciuna;
          }}
          onChange={() => {
            laComutare(idZile, !toate);
          }}
          aria-label={`Include toate zilele lui ${rand.nume} în lotul de aprobare`}
        />
        <button
          type="button"
          onClick={laDesfacere}
          aria-expanded={desfacut}
          className="text-corp flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {desfacut ? (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className="truncate font-medium">{rand.nume}</span>
        </button>
        <span className="text-muted-foreground text-nota tabular-nums">
          {bifate.length} din {idZile.length} {idZile.length === 1 ? "zi" : "zile"} ·{" "}
          {formatOre(ore)}
        </span>
      </div>

      {desfacut ? (
        <ul className="border-border divide-border bg-surface/40 divide-y border-t">
          {rand.zile.map((zi) => (
            <RandZi
              key={zi.id}
              zi={zi}
              ales={alese.has(zi.id)}
              laComutare={() => {
                laComutare([zi.id], !alese.has(zi.id));
              }}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

const ETICHETA_TIP_ZI: Readonly<Record<TipZi, string>> = {
  lucratoare: "",
  weekend: "weekend",
  sarbatoare: "sărbătoare legală",
  concediu: "concediu",
  medical: "concediu medical",
  absenta_nemotivata: "absență nemotivată",
  delegatie: "delegație",
};

/** O zi, cu tot ce trebuie știut înainte de semnătură. */
function RandZi({
  zi,
  ales,
  laComutare,
}: {
  readonly zi: ZiDeAprobat;
  readonly ales: boolean;
  readonly laComutare: () => void;
}): ReactElement {
  /*
   * Zi ÎNCEPUTĂ ȘI NEÎNCHISĂ. `aprobaPontajBloc` o sare deliberat — aprobată cu
   * 0 ore, ar îngheța acolo, iar „Am ieșit" de la 17 ar fi respins tăcut de
   * clauza `USING`. Ecranul o spune ÎNAINTE de apăsare, nu după.
   */
  const inCurs = zi.oraInceput !== null && zi.oraSfarsit === null;
  const interval =
    zi.oraInceput === null
      ? "fără interval"
      : `${zi.oraInceput.slice(0, 5)}–${zi.oraSfarsit === null ? "…" : zi.oraSfarsit.slice(0, 5)}`;
  const tip = ETICHETA_TIP_ZI[zi.tipZi];

  return (
    <li className="flex flex-wrap items-center gap-3 py-2 pr-4 pl-11">
      <input
        type="checkbox"
        className={clasaBifa}
        checked={ales}
        disabled={inCurs}
        onChange={laComutare}
        aria-label={`Aprobă ziua de ${formatDate(zi.data)}`}
      />
      <span className="text-corp min-w-0 flex-1 tabular-nums">
        {formatDate(zi.data)}
        <span className="text-muted-foreground"> · {interval}</span>
      </span>
      <span className="text-muted-foreground text-nota">
        {tip === "" ? null : <span className="mr-2">{tip}</span>}
        {ETICHETE_SURSA[zi.sursa]}
      </span>
      <span className="text-corp tabular-nums">{formatOre(zi.ore)}</span>
      {inCurs ? (
        <span className="text-warning text-nota basis-full pl-8">
          Ziua e începută și neînchisă — aprobarea o sare, ca să nu rămână la zero ore.
        </span>
      ) : null}
    </li>
  );
}
