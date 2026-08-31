"use client";

import { useRef, useState } from "react";

import { formatOre } from "@/lib/format/ore";
import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import {
  type IntervalGrila,
  type SelectieOrara,
  inaltimeaInOre,
  liniileOrare,
  minutulDinFractie,
  pozitiaBlocului,
  selectiaDinTragere,
} from "@/domain/attendance/grila-orara";

import { CelulaZi } from "./celula-zi";
import { CODURI_TIP_ZI, ETICHETE_TIP_PREZENTA, ETICHETE_TIP_ZI } from "./etichete";
import type { IntrareZiClient } from "./intrare-client";

/**
 * Săptămâna proprie de pontaj, desenată pe ore.
 *
 * ── CE FACE, ȘI CE NU ─────────────────────────────────────────────────────
 * Tragi peste o zonă dintr-o zi, iar la eliberare se deschide dialogul zilei cu
 * intervalul precompletat. Toată aritmetica — fracțiune → minut, minut → oră,
 * alinierea la sfert, poziția blocului — stă în `domain/attendance/grila-orara.ts`,
 * unde are teste. Aici rămâne strict ce nu se poate muta: `getBoundingClientRect`,
 * `clientY`, captura de pointer.
 *
 * ── O SINGURĂ INTRARE PE ZI ───────────────────────────────────────────────
 * `attendance_entries_zi_uq` e unic (parțial) pe `(organizație, angajat, zi)`,
 * deci într-o zi nu pot exista două blocuri. A doua tragere peste o zi deja
 * pontată nu adaugă nimic: EDITEAZĂ intervalul existent. De aceea nici nu există
 * cod care să deseneze blocuri suprapuse — n-ar avea ce reprezenta.
 *
 * ── UN SINGUR ELEMENT FOCUSABIL PE ZI ─────────────────────────────────────
 * Coloana zilei ESTE butonul; blocul dinăuntru e desen, cu `pointer-events-none`.
 * Regula e cea scrisă în `(portal)/…/grila-luna.tsx`: niciodată un element
 * interactiv într-altul. Consecința bună e că o săptămână are șapte opriri de
 * Tab, nu paisprezece.
 *
 * Nu se anunță `role="grid"`: ar promite navigare cu săgețile, pe care n-o
 * implementăm — exact promisiunea neonorată către cititoarele de ecran pe care o
 * condamnă în scris `components/ui/comutator-vizualizare.tsx`.
 *
 * ── DE CE TRAGEREA E DOAR CU MAUSUL ───────────────────────────────────────
 * Ca tragerea să meargă cu degetul, coloana ar avea nevoie de
 * `touch-action: none` — iar atunci degetul pus pe grilă nu mai poate derula
 * pagina, pe un ecran unde grila ocupă aproape tot. Pe telefon, atingerea
 * deschide dialogul cu intervalul obișnuit al firmei și se corectează acolo, în
 * câmpuri care au deja mască de tastare. Aceeași cale o folosește și tastatura.
 */

/** Înălțimea unei ore, în `rem`. Sub asta, un sfert de oră devine de neatins. */
const INALTIME_ORA_REM = 3;

export interface ZiGrila {
  readonly data: string;
  /** „Luni”, „Marți”… */
  readonly zi: string;
  /** Numărul zilei din lună, ca text. */
  readonly numarZi: string;
  /** Numele accesibil al zilei: „luni, 24 august 2026”. */
  readonly etichetaLunga: string;
  readonly intrare: IntrareZiClient | null;
  /** Sărbătoare sau weekend — ce scrie sub numărul zilei, sau `null`. */
  readonly nelucratoare: string | null;
  readonly editabila: boolean;
  /** De ce nu se poate ponta ziua asta. Text gata scris, intră în numele accesibil. */
  readonly motivBlocare: string | null;
}

interface Proprietati {
  readonly zile: readonly ZiGrila[];
  readonly interval: IntervalGrila;
  readonly config: ConfigZi;
  /** Intervalul propus la o simplă atingere, când firma și-a declarat programul. */
  readonly intervalPropus: SelectieOrara | null;
  /** `null` = fișa proprie: `salveazaZiPontaj` o rezolvă din sesiune. */
  readonly angajatId: string | null;
  readonly eticheta: string;
  readonly poateAproba: boolean;
  readonly poateSterge: boolean;
  /** Ziua curentă, calculată pe SERVER cu fusul București. */
  readonly azi: string;
}

interface Tragere {
  readonly data: string;
  readonly de: number;
  readonly pana: number;
  readonly miscat: boolean;
}

interface Deschisa {
  readonly zi: ZiGrila;
  /** Intervalul cu care se deschide dialogul, sau `null` = valorile zilei. */
  readonly interval: SelectieOrara | null;
}

export function GrilaSaptamana({
  zile,
  interval,
  config,
  intervalPropus,
  angajatId,
  eticheta,
  poateAproba,
  poateSterge,
  azi,
}: Proprietati) {
  const [deschisa, setDeschisa] = useState<Deschisa | null>(null);
  const [tragere, setTragere] = useState<Tragere | null>(null);
  /*
    O tragere adevărată se termină cu `pointerup`, care e URMAT de un `click` pe
    același buton. Fără steagul ăsta, dialogul s-ar deschide de două ori — o dată
    cu intervalul tras, o dată peste el cu cel propus.
  */
  const suprimaClick = useRef(false);

  const ore = liniileOrare(interval);
  const numarOre = inaltimeaInOre(interval);

  function fractia(element: HTMLElement, clientY: number): number {
    const chenar = element.getBoundingClientRect();
    if (chenar.height === 0) return 0;
    return (clientY - chenar.top) / chenar.height;
  }

  function deschide(zi: ZiGrila, tras: SelectieOrara | null): void {
    if (!zi.editabila) return;
    // Ziua goală se deschide pe intervalul obișnuit al firmei; una deja pontată,
    // pe al ei — altfel un click nevinovat i-ar rescrie ora.
    const implicit = zi.intrare === null ? intervalPropus : null;
    setDeschisa({ zi, interval: tras ?? implicit });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[48rem]">
          {/* Antetul zilelor. Aceeași grilă de coloane ca și corpul. */}
          <div className="grid" style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}>
            <div aria-hidden="true" />
            {zile.map((zi) => (
              <div
                key={zi.data}
                className={`border-border border-b border-l px-2 py-1.5 ${
                  zi.data === azi ? "bg-surface" : ""
                }`}
              >
                <span className="text-nota text-muted-foreground block font-medium">{zi.zi}</span>
                <span className="text-corp text-foreground block tabular-nums">{zi.numarZi}</span>
                {zi.nelucratoare === null ? null : (
                  <span className="text-nota text-muted-foreground block truncate">
                    {zi.nelucratoare}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div
            className="border-border relative border-b"
            style={{ height: `${String(numarOre * INALTIME_ORA_REM)}rem` }}
          >
            {/* Liniile de ceas, un singur strat peste toată lățimea. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {ore.map((_, index) => (
                <div
                  key={index}
                  className="border-border/60 absolute inset-x-0 border-t"
                  style={{ top: `${String((index / numarOre) * 100)}%` }}
                />
              ))}
            </div>

            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}
            >
              {/* Jgheabul cu orele. `aria-hidden`: ora e deja în numele fiecărui buton. */}
              <div aria-hidden="true" className="relative">
                {ore.map((ora, index) => (
                  <span
                    key={ora}
                    className="text-nota text-muted-foreground absolute right-2 -translate-y-1/2 tabular-nums"
                    style={{ top: `${String((index / numarOre) * 100)}%` }}
                  >
                    {ora}
                  </span>
                ))}
              </div>

              {zile.map((zi) => (
                <ColoanaZi
                  key={zi.data}
                  zi={zi}
                  interval={interval}
                  esteAzi={zi.data === azi}
                  tragere={tragere?.data === zi.data ? tragere : null}
                  onPointerDown={(element, clientY, pointerId, pointerType) => {
                    if (pointerType === "touch") return;
                    element.setPointerCapture(pointerId);
                    const minut = minutulDinFractie(fractia(element, clientY), interval);
                    setTragere({ data: zi.data, de: minut, pana: minut, miscat: false });
                  }}
                  onPointerMove={(element, clientY) => {
                    if (tragere === null || tragere.data !== zi.data) return;
                    const minut = minutulDinFractie(fractia(element, clientY), interval);
                    if (minut === tragere.pana) return;
                    setTragere({ ...tragere, pana: minut, miscat: true });
                  }}
                  onPointerUp={() => {
                    if (tragere === null || tragere.data !== zi.data) return;
                    const tras =
                      tragere.miscat && tragere.de !== tragere.pana
                        ? selectiaDinTragere(tragere.de, tragere.pana, interval)
                        : null;
                    setTragere(null);
                    if (tras === null) return;
                    suprimaClick.current = true;
                    deschide(zi, tras);
                  }}
                  onPointerCancel={() => {
                    setTragere(null);
                  }}
                  onClick={() => {
                    if (suprimaClick.current) {
                      suprimaClick.current = false;
                      return;
                    }
                    deschide(zi, null);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-nota">
        Trageți peste o zonă dintr-o zi ca să pontați intervalul, sau atingeți ziua ca să completați
        dialogul. Selecția se aliniază la sferturi de oră.
      </p>

      {deschisa === null ? null : (
        /*
          `key` poartă și intervalul: două trageri diferite pe aceeași zi trebuie
          să dea două instanțe, altfel a doua ar refolosi starea primei și
          dialogul s-ar deschide cu ora dinainte.
        */
        <CelulaZi
          key={`${deschisa.zi.data}-${deschisa.interval?.inceput ?? ""}-${deschisa.interval?.sfarsit ?? ""}`}
          angajatId={angajatId}
          data={deschisa.zi.data}
          eticheta={`${eticheta} — ${deschisa.zi.etichetaLunga}`}
          intrare={deschisa.zi.intrare}
          {...(deschisa.interval === null
            ? {}
            : {
                oraInceputInitiala: deschisa.interval.inceput,
                oraSfarsitInitiala: deschisa.interval.sfarsit,
              })}
          poateSterge={poateSterge && deschisa.zi.intrare !== null}
          config={config}
          poateAproba={poateAproba}
          onInchide={() => {
            setDeschisa(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * O zi din grilă: fundalul, blocul desenat, previzualizarea tragerii și butonul
 * care le acoperă pe toate.
 *
 * Ordinea straturilor contează: butonul e DEASUPRA, iar desenul are
 * `pointer-events-none`. Altfel un click fix pe bloc n-ar ajunge la buton, iar
 * ziua ar avea o zonă moartă exact acolo unde omul apasă cel mai des.
 */
function ColoanaZi({
  zi,
  interval,
  esteAzi,
  tragere,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
}: {
  readonly zi: ZiGrila;
  readonly interval: IntervalGrila;
  readonly esteAzi: boolean;
  readonly tragere: Tragere | null;
  readonly onPointerDown: (
    element: HTMLElement,
    clientY: number,
    pointerId: number,
    pointerType: string,
  ) => void;
  readonly onPointerMove: (element: HTMLElement, clientY: number) => void;
  readonly onPointerUp: () => void;
  readonly onPointerCancel: () => void;
  readonly onClick: () => void;
}) {
  const pozitie =
    zi.intrare === null
      ? null
      : pozitiaBlocului(zi.intrare.oraInceput, zi.intrare.oraSfarsit, interval);

  const selectie = tragere === null ? null : selectiaDinTragere(tragere.de, tragere.pana, interval);
  const pozitieSelectie =
    selectie === null || tragere === null || !tragere.miscat
      ? null
      : pozitiaBlocului(selectie.inceput, selectie.sfarsit, interval);

  const fundal = esteAzi ? "bg-surface/60" : zi.nelucratoare === null ? "" : "bg-surface";

  return (
    <div className={`border-border relative border-l ${fundal}`}>
      {zi.intrare === null || pozitie === null ? null : (
        <BlocZi intrare={zi.intrare} pozitie={pozitie} taiat={pozitie.taiat} />
      )}

      {/* Ziua fără interval, dar cu tip special: codul, centrat. */}
      {zi.intrare !== null && pozitie === null ? (
        <span className="text-nota text-muted-foreground pointer-events-none absolute inset-x-1 top-2 text-center">
          {CODURI_TIP_ZI[zi.intrare.tipZi]}
        </span>
      ) : null}

      {pozitieSelectie === null ? null : (
        <div
          aria-hidden="true"
          className="border-primary bg-primary/20 pointer-events-none absolute inset-x-1 rounded border-2 border-dashed"
          style={{
            top: `${String(pozitieSelectie.susProcent)}%`,
            height: `${String(pozitieSelectie.inaltimeProcent)}%`,
          }}
        />
      )}

      {zi.editabila ? (
        <button
          type="button"
          aria-label={numeAccesibil(zi, selectie)}
          className="focus-visible:ring-primary absolute inset-0 h-full w-full cursor-pointer rounded-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            onPointerDown(e.currentTarget, e.clientY, e.pointerId, e.pointerType);
          }}
          onPointerMove={(e) => {
            onPointerMove(e.currentTarget, e.clientY);
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={onClick}
        />
      ) : (
        <div aria-disabled="true" className="absolute inset-0" title={zi.motivBlocare ?? undefined}>
          <span className="sr-only">{numeAccesibil(zi, null)}</span>
        </div>
      )}
    </div>
  );
}

function BlocZi({
  intrare,
  pozitie,
  taiat,
}: {
  readonly intrare: IntrareZiClient;
  readonly pozitie: { readonly susProcent: number; readonly inaltimeProcent: number };
  readonly taiat: boolean;
}) {
  const inCurs = intrare.oraInceput !== null && intrare.oraSfarsit === null;
  // Starea se poartă prin FORMĂ, nu prin transparență: `disabled:opacity-*` e
  // interzis în produs (vezi `concedii/calendar/grila-calendar.tsx`).
  const chenar = intrare.aprobat
    ? "border-success bg-success/15"
    : intrare.respins
      ? "border-danger border-dashed bg-danger/10"
      : inCurs
        ? "border-warning border-dashed bg-warning/15"
        : "border-primary bg-primary/15";

  return (
    <div
      aria-hidden="true"
      /*
        `min-h-9`: înălțimea vine din durată, dar sub un prag nu mai încape
        nicio literă. O zi deschisă cu ceasul și neînchisă valorează un sfert de
        oră — 1,5 % dintr-o fereastră de 16 ore, adică 12 px — iar textul ei se
        tăia prin mijlocul rândului. Un bloc scurt desenat puțin mai înalt decât
        e minte cu câteva minute; unul ilizibil nu spune nimic.
      */
      className={`pointer-events-none absolute inset-x-1 min-h-9 overflow-hidden rounded border px-1 py-0.5 ${chenar} ${
        taiat ? "border-t-transparent" : ""
      }`}
      style={{
        top: `${String(pozitie.susProcent)}%`,
        height: `${String(pozitie.inaltimeProcent)}%`,
      }}
    >
      <span className="text-nota text-foreground block truncate tabular-nums">
        {inCurs ? "în curs" : `${intrare.oraInceput ?? ""}–${intrare.oraSfarsit ?? ""}`}
      </span>
      {intrare.oreLucrate > 0 ? (
        <span className="text-nota text-muted-foreground block truncate tabular-nums">
          {formatOre(intrare.oreLucrate)} h
        </span>
      ) : null}
      {/*
        Locul de muncă (0118) se scrie doar când NU e „la birou".

        Aceeași disciplină ca `tipZi` în numele accesibil de mai jos: se anunță
        EXCEPȚIA. Un „La birou" pe fiecare bloc din săptămână ar fi al treilea
        rând de text în casete de 12 px înălțime, și ar acoperi tocmai zilele
        care chiar au ceva de spus.
      */}
      {intrare.tipPrezenta !== null && intrare.tipPrezenta !== "birou" ? (
        <span className="text-nota text-muted-foreground block truncate">
          {ETICHETE_TIP_PREZENTA[intrare.tipPrezenta]}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Ce aude cineva la cititorul de ecran. Poartă tot ce culoarea și poziția spun
 * văzând: ziua, intervalul, orele, starea deciziei — și, cât timp se trage,
 * intervalul curent, ca selecția să nu fie o informație exclusiv vizuală.
 */
function numeAccesibil(zi: ZiGrila, selectie: SelectieOrara | null): string {
  const bucati: string[] = [zi.etichetaLunga];

  if (selectie !== null) {
    bucati.push(`selecție ${selectie.inceput}–${selectie.sfarsit}`);
  } else if (zi.intrare === null) {
    bucati.push("fără pontaj, adaugă");
  } else {
    const { intrare } = zi;
    if (intrare.oraInceput !== null && intrare.oraSfarsit !== null) {
      bucati.push(`${intrare.oraInceput}–${intrare.oraSfarsit}`);
    }
    if (intrare.oraInceput !== null && intrare.oraSfarsit === null) bucati.push("în curs");
    if (intrare.oreLucrate > 0) bucati.push(`${formatOre(intrare.oreLucrate)} ore`);
    if (intrare.tipZi !== "lucratoare") bucati.push(ETICHETE_TIP_ZI[intrare.tipZi]);
    if (intrare.tipPrezenta !== null && intrare.tipPrezenta !== "birou") {
      bucati.push(ETICHETE_TIP_PREZENTA[intrare.tipPrezenta]);
    }
    if (intrare.aprobat) bucati.push("aprobat");
    if (intrare.respins) bucati.push("respins");
  }

  if (zi.motivBlocare !== null) bucati.push(zi.motivBlocare);
  return bucati.join(" · ");
}
