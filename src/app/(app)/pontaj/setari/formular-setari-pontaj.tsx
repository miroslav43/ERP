"use client";

import { useId, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";

import { Buton } from "@/components/ui/buton";
import { IntrareDurata, IntrareOra } from "@/components/ui/intrare-ora";
import { formatOre } from "@/lib/format/ore";
import { oreleZilei } from "@/domain/attendance/calcul-ore";
import type { SetariPontajComplete } from "@/lib/queries/attendance";

import { salveazaSetariPontaj } from "./actions";

const CAMP = "border-foreground/60 rounded-control border px-3 py-2 text-corp";

/**
 * Fiecare câmp are o descriere sub el, nu doar o etichetă. Sunt parametri de
 * dreptul muncii: cine îi completează trebuie să știe CE anume confirmă, nu
 * doar unde să scrie o cifră.
 */
function Numeric({
  nume,
  eticheta,
  descriere,
  implicit,
  pas = "0.01",
  minim = 0,
  maxim,
  valoare,
  onSchimba,
}: {
  readonly nume: string;
  readonly eticheta: string;
  readonly descriere: string;
  readonly implicit: number | undefined;
  readonly pas?: string;
  readonly minim?: number;
  readonly maxim?: number;
  /** Când e dată, câmpul devine CONTROLAT — pentru cele care hrănesc exemplul viu. */
  readonly valoare?: string;
  readonly onSchimba?: (v: string) => void;
}) {
  const id = useId();
  const controlat = valoare !== undefined && onSchimba !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-corp">
        {eticheta}
      </label>
      <input
        id={id}
        name={nume}
        type="number"
        step={pas}
        min={minim}
        max={maxim}
        {...(controlat
          ? {
              value: valoare,
              onChange: (e: ChangeEvent<HTMLInputElement>) => {
                onSchimba(e.target.value);
              },
            }
          : { defaultValue: implicit })}
        required
        className={CAMP}
      />
      <p className="text-muted-foreground text-nota">{descriere}</p>
    </div>
  );
}

/**
 * Aceeași structură ca `Numeric`, dar pentru un câmp în care cifra nu e liberă:
 * are câteva valori pe care legea le recunoaște, și niciuna în afara lor.
 *
 * Un `<input type="number">` de la 1 la 12 lăsa să se scrie 5 sau 7 luni —
 * perioade de referință care nu există nicăieri în Codul muncii și pe care
 * nimic din produs nu le-ar fi respins mai târziu.
 */
type Optiune = Readonly<{ valoare: number; eticheta: string }>;

function Alegere({
  nume,
  eticheta,
  descriere,
  implicit,
  optiuni,
}: {
  readonly nume: string;
  readonly eticheta: string;
  readonly descriere: string;
  readonly implicit: number | undefined;
  readonly optiuni: readonly Optiune[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-corp">
        {eticheta}
      </label>
      {/*
        Fără preselecție când nu există nimic salvat. Ar fi fost comod să se
        deschidă pe „4 luni", dar e aceeași greșeală ca implicitele ascunse de
        mai jos (`pastreaza`): o valoare juridică pe care n-a ales-o nimeni,
        salvată ca și cum ar fi fost confirmată.
      */}
      <select id={id} name={nume} defaultValue={implicit ?? ""} required className={CAMP}>
        <option value="">Alegeți…</option>
        {optiuni.map((optiune) => (
          <option key={optiune.valoare} value={optiune.valoare}>
            {optiune.eticheta}
          </option>
        ))}
      </select>
      <p className="text-muted-foreground text-nota">{descriere}</p>
    </div>
  );
}

/**
 * Aceeași structură ca `Numeric`, dar pentru un câmp care măsoară TIMP.
 *
 * Norma zilnică de șapte ore și jumătate se scrie `7:30`, nu `7,5`: sunt
 * parametri de dreptul muncii, iar contractul individual de muncă scrie tot
 * ore și minute. Ce pleacă spre server rămâne zecimal — `z.coerce.number()`
 * din `schemas/attendance.ts` primește exact ce primea și înainte.
 */
function Durata({
  nume,
  eticheta,
  descriere,
  implicit,
  exemplu,
  valoare,
  onSchimba,
}: {
  readonly nume: string;
  readonly eticheta: string;
  readonly descriere: string;
  readonly implicit: number | undefined;
  /**
   * Exemplul din câmpul gol. Fiecare parametru are alt ordin de mărime — 8 ore
   * pe zi, 48 pe săptămână, 12 de repaus zilnic — iar un exemplu de `8:00` sub
   * „maxim săptămânal" nu e doar nefolositor: sugerează cifra greșită într-un
   * câmp în care cifra greșită e o încălcare a legii.
   */
  readonly exemplu?: string;
  /** Când e dată, câmpul devine CONTROLAT — pentru cele care hrănesc exemplul viu. */
  readonly valoare?: number | null;
  readonly onSchimba?: (ore: number | null) => void;
}) {
  const id = useId();
  const controlat = valoare !== undefined && onSchimba !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-corp">
        {eticheta}
      </label>
      <IntrareDurata
        id={id}
        name={nume}
        required
        placeholder={exemplu}
        {...(controlat ? { valoare, onSchimba } : { implicit: implicit ?? null })}
        className={CAMP}
      />
      <p className="text-muted-foreground text-nota">{descriere}</p>
    </div>
  );
}

/** Durata pe ceas: `8.5` → `8:30`. */
const ore = formatOre;

/**
 * Perioadele de referință pe care se face media săptămânală.
 *
 * Patru luni e regula; șase se poate pentru activitățile la care legea o
 * permite; douăsprezece, numai prin contract colectiv de muncă. Între ele nu
 * există nimic — de-aia sunt trei variante, nu un câmp liber de la 1 la 12 în
 * care se putea scrie „7 luni", o perioadă pe care n-o recunoaște nimeni și pe
 * care nimic din produs n-ar fi respins-o mai târziu.
 *
 * ⚠ DE VERIFICAT DE JURIST, ca toate valorile legale din ecranul ăsta.
 */
const PERIOADE_REFERINTA: readonly Optiune[] = [
  { valoare: 4, eticheta: "4 luni — regula generală" },
  { valoare: 6, eticheta: "6 luni — activitățile pentru care legea permite prelungirea" },
  { valoare: 12, eticheta: "12 luni — numai prin contract colectiv de muncă" },
];

/**
 * Lista de mai sus, plus valoarea DEJA SALVATĂ când ea nu e printre cele trei.
 *
 * O firmă care are 3 luni în bază n-are voie să găsească selectorul deschis pe
 * altceva: ar salva tăcut altă perioadă decât cea confirmată cândva, dintr-o
 * apăsare pe „Salvează versiunea" care nu avea legătură cu câmpul ăsta.
 */
function perioadeCu(salvata: number | undefined): readonly Optiune[] {
  if (salvata === undefined || PERIOADE_REFERINTA.some((p) => p.valoare === salvata)) {
    return PERIOADE_REFERINTA;
  }
  return [
    ...PERIOADE_REFERINTA,
    { valoare: salvata, eticheta: `${salvata} luni — valoarea salvată` },
  ].sort((a, b) => a.valoare - b.valoare);
}

/**
 * Un comutator „ce feluri de muncă are firma".
 *
 * NU e „ce sporuri acord": sporurile din art. 123, 137 alin. (2) și 142 alin.
 * (2) sunt obligatorii CÂND munca s-a prestat, deci un comutator care le-ar
 * stinge ar invita la o ilegalitate. Comutatorul declară doar dacă munca aceea
 * se prestează, iar ecranul încetează să ceară parametri care nu se aplică.
 */
function Comutator({
  eticheta,
  descriere,
  pornit,
  onSchimba,
}: {
  readonly eticheta: string;
  readonly descriere: string;
  readonly pornit: boolean;
  readonly onSchimba: (valoare: boolean) => void;
}) {
  const id = useId();
  const idDescriere = useId();
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        checked={pornit}
        aria-describedby={idDescriere}
        onChange={(e) => {
          onSchimba(e.target.checked);
        }}
        className="mt-1 size-4 shrink-0"
      />
      <div>
        <label htmlFor={id} className="text-corp">
          {eticheta}
        </label>
        <p id={idDescriere} className="text-muted-foreground text-nota">
          {descriere}
        </p>
      </div>
    </div>
  );
}

/**
 * Valoarea unui câmp ascuns de un comutator oprit.
 *
 * Coloanele sunt NOT NULL, iar schema Zod le cere oricum: un câmp scos de pe
 * ecran tot trebuie să trimită ceva. Se trimite valoarea DEJA SALVATĂ, nu una
 * inventată — cine stinge tura de noapte și o reaprinde peste trei luni își
 * găsește parametrii cum i-a lăsat. Când nu există nimic salvat, `0`: un
 * implicit „legal" strecurat pe ascuns ar fi exact cifra presupusă pe care
 * ecranul ăsta o refuză din construcție.
 */
function pastreaza(valoare: number | undefined): string {
  return String(valoare ?? 0);
}

function Rand({
  eticheta,
  valoare,
  nota,
  accent = false,
}: {
  readonly eticheta: string;
  readonly valoare: number;
  readonly nota?: string;
  readonly accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={accent ? "text-foreground" : "text-muted-foreground"}>
        {eticheta}
        {nota === undefined ? null : (
          <span className="text-muted-foreground text-nota"> ({nota})</span>
        )}
      </dt>
      <dd
        className={`tabular-nums ${accent ? "text-foreground font-medium" : "text-muted-foreground"}`}
      >
        {ore(valoare)} h
      </dd>
    </div>
  );
}

export function FormularSetariPontaj({
  setariCurente,
}: {
  readonly setariCurente: SetariPontajComplete | null;
}) {
  const idDeLa = useId();
  const idNoapteStart = useId();
  const idNoapteSfarsit = useId();
  const idObservatii = useId();
  const [seTrimite, porneste] = useTransition();
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);

  // Implicitul `true` pentru o firmă fără setări salvate: ecranul arată tot,
  // ca până acum. Nimic nu dispare fără ca cineva să bifeze deliberat.
  /*
    Cele patru câmpuri care decid câte ore ies dintr-un interval sunt CONTROLATE,
    nu doar `defaultValue`: exemplul de mai jos se recalculează la fiecare tastă,
    cu aceeași funcție pe care o rulează serverul la salvarea unei zile.

    Fără el, ecranul îi cere patronului să confirme juridic niște cifre și nu-i arată
    niciodată ce fac. Exact așa s-a salvat o regulă cu „pauza inclusă în program"
    bifată și prag de 8 ore, adică o pauză de 30 de minute care nu se scade
    niciodată — iar cele 30 de minute deveneau oră suplimentară în fiecare zi.
  */
  const [orePeZi, setOrePeZi] = useState<number | null>(setariCurente?.ore_pe_zi ?? 8);
  const [pauzaMinute, setPauzaMinute] = useState(String(setariCurente?.pauza_masa_minute ?? 0));
  const [pauzaPrag, setPauzaPrag] = useState<number | null>(
    setariCurente?.pauza_obligatorie_peste_ore ?? 0,
  );
  const [pauzaInclusa, setPauzaInclusa] = useState(
    setariCurente?.pauza_masa_inclusa_in_program ?? false,
  );

  const [noaptea, setNoaptea] = useState(setariCurente?.lucreaza_noaptea ?? true);
  const [weekend, setWeekend] = useState(setariCurente?.lucreaza_weekend ?? true);
  const [sarbatori, setSarbatori] = useState(setariCurente?.lucreaza_sarbatori ?? true);
  const [suplimentare, setSuplimentare] = useState(setariCurente?.admite_ore_suplimentare ?? true);

  function trimite(formular: FormData): void {
    setMesaj(null);
    setEroare(null);
    porneste(async () => {
      const rezultat = await salveazaSetariPontaj({
        valabil_de_la: formular.get("valabil_de_la"),
        ore_pe_zi: orePeZi ?? 0,
        ore_pe_saptamana: formular.get("ore_pe_saptamana"),
        ore_maxime_saptamanale: formular.get("ore_maxime_saptamanale"),
        perioada_referinta_luni: formular.get("perioada_referinta_luni"),
        repaus_zilnic_minim_ore: formular.get("repaus_zilnic_minim_ore"),
        repaus_saptamanal_minim_ore: formular.get("repaus_saptamanal_minim_ore"),
        // Din stare, nu din `FormData`: o casetă nebifată NU apare deloc în
        // `FormData`, iar `z.coerce.boolean()` ar primi `null` — care e `false`,
        // dar din alt motiv decât o alegere. Aici starea e sursa.
        lucreaza_noaptea: noaptea,
        lucreaza_weekend: weekend,
        lucreaza_sarbatori: sarbatori,
        admite_ore_suplimentare: suplimentare,
        // `spor_*_procent` NU se mai trimit (0082): coloanele au `default 0`,
        // iar sporurile care plătesc trăiesc în `payroll_settings`.
        noapte_start: formular.get("noapte_start"),
        noapte_sfarsit: formular.get("noapte_sfarsit"),
        prag_ore_noapte: formular.get("prag_ore_noapte"),
        termen_compensare_suplimentare_zile: formular.get("termen_compensare_suplimentare_zile"),
        termen_compensare_sarbatoare_zile: formular.get("termen_compensare_sarbatoare_zile"),
        pauza_masa_minute: pauzaMinute,
        pauza_masa_inclusa_in_program: pauzaInclusa,
        pauza_obligatorie_peste_ore: pauzaPrag ?? 0,
        observatii_juridice: formular.get("observatii_juridice"),
      });
      if (rezultat.ok) setMesaj("Versiunea a fost salvată.");
      else setEroare(rezultat.error.message);
    });
  }

  /** Ziua-etalon pe care se arată efectul. Ora de referință din discuție. */
  const EXEMPLU = { inceput: "08:30", sfarsit: "17:00" } as const;
  const numar = (v: string, rezerva: number) => (Number.isFinite(Number(v)) ? Number(v) : rezerva);
  const exemplu = oreleZilei(EXEMPLU.inceput, EXEMPLU.sfarsit, {
    orePeZi: orePeZi ?? 8,
    // Fereastra de noapte nu contează pentru o zi de 08:30–17:00; se trimit
    // valorile reale oricum, ca exemplul să nu mintă dacă cineva o mută.
    noapteStart: setariCurente?.noapte_start.slice(0, 5) ?? "22:00",
    noapteSfarsit: setariCurente?.noapte_sfarsit.slice(0, 5) ?? "06:00",
    pauzaMinute: numar(pauzaMinute, 0),
    pauzaInclusaInProgram: pauzaInclusa,
    pauzaObligatoriePesteOre: pauzaPrag ?? 0,
  });

  // Configurație care se anulează singură: minute de pauză declarate, dar care nu
  // se scad niciodată. E legală (pauză plătită), dar cine o alege din greșeală
  // n-are cum să-și dea seama din câmpuri.
  const pauzaNuSeAplica = numar(pauzaMinute, 0) > 0 && exemplu !== null && exemplu.pauza === 0;

  return (
    <form action={trimite} className="border-border rounded-panou space-y-6 border p-4">
      {/*
        CE ÎNSEAMNĂ CIFRELE DE MAI JOS — recalculat la fiecare tastă, cu aceeași
        funcție (`oreleZilei`) pe care o rulează serverul când cineva își salvează
        ziua. Nu e o ilustrație: dacă panoul ăsta arată 8,50, atunci 8,50 se scrie
        în bază.

        Motivul pentru care există: ecranul cerea confirmarea juridică a unor
        parametri fără să arate vreodată ce fac. Din „pauză 30 min" + „inclusă în
        program" + „prag 8 ore" iese o pauză care NU se scade niciodată, iar
        diferența devine oră suplimentară în fiecare zi. Din câmpuri nu se vedea.
      */}
      <section
        aria-live="polite"
        aria-label="Efectul setărilor pe o zi obișnuită"
        className="bg-surface border-border rounded-panou border p-4"
      >
        <h2 className="text-corp mb-2 font-medium">
          Ce înseamnă asta pentru o zi de {EXEMPLU.inceput}–{EXEMPLU.sfarsit}
        </h2>
        {exemplu === null ? (
          <p className="text-muted-foreground text-corp">
            Completați norma zilnică și parametrii pauzei ca să vedeți efectul.
          </p>
        ) : (
          <dl className="text-corp space-y-1">
            <Rand eticheta="Interval" valoare={exemplu.brut} />
            <Rand
              eticheta="Pauză de masă"
              valoare={-exemplu.pauza}
              nota={
                exemplu.pauza > 0
                  ? "se scade"
                  : pauzaInclusa
                    ? "inclusă în program, nu se scade"
                    : "sub pragul de obligativitate"
              }
            />
            <div className="border-border mt-2 border-t pt-2">
              <Rand eticheta="Ore lucrate" valoare={exemplu.lucrate} accent />
            </div>
            <Rand eticheta="Din care suplimentare" valoare={exemplu.suplimentare} />
          </dl>
        )}

        {pauzaNuSeAplica ? (
          <p
            role="note"
            className="border-warning/40 bg-warning/8 text-corp rounded-control mt-3 border p-3"
          >
            <strong>Pauza configurată nu se scade niciodată.</strong> Ați declarat {pauzaMinute} de
            minute de pauză, dar{" "}
            {pauzaInclusa
              ? "caseta „Pauza de masă e inclusă în programul plătit” e bifătă, deci pauza e timp plătit"
              : `pragul de obligativitate (${ore(
                  pauzaPrag ?? 0,
                )} h) e mai mare decât ziua din exemplu`}
            . E o configurație validă, dar dacă intenția era ca cele {pauzaMinute} de minute să se
            SCADĂ din program, debifați caseta și coborâți pragul.
          </p>
        ) : null}
      </section>
      <div className="flex flex-col gap-1">
        <label htmlFor={idDeLa} className="text-corp">
          În vigoare de la
        </label>
        <input id={idDeLa} name="valabil_de_la" type="date" required className={CAMP} />
        <p className="text-muted-foreground text-nota">
          Lunile calculate înainte de această dată rămân pe versiunea anterioară.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-corp font-medium">Ce feluri de muncă are firma</legend>
        <p className="text-muted-foreground text-nota">
          Ce debifați aici dispare din formular și nu vi se mai cere. Comutatoarele descriu
          PROGRAMUL, nu plata: sporurile pentru ore suplimentare (art. 123), pentru repausul
          săptămânal (art. 137 alin. 2) și pentru sărbătoarea legală (art. 142 alin. 2) rămân
          obligatorii dacă munca s-a prestat totuși. Dacă apar ore într-un fel de muncă debifat,
          salarizarea vă semnalează, nu le ascunde.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Comutator
            eticheta="Se lucrează în tura de noapte"
            descriere="Debifat, dispare intervalul nocturn și pragul de ore. Orele de noapte se înregistrează în continuare dacă apar."
            pornit={noaptea}
            onSchimba={setNoaptea}
          />
          <Comutator
            eticheta="Se lucrează în repausul săptămânal"
            descriere="Sâmbăta sau duminica, ca program obișnuit sau ocazional."
            pornit={weekend}
            onSchimba={setWeekend}
          />
          <Comutator
            eticheta="Se lucrează de sărbătorile legale"
            descriere="Producție continuă, gardă, retail — orice program care nu se oprește de 1 Decembrie."
            pornit={sarbatori}
            onSchimba={setSarbatori}
          />
          <Comutator
            eticheta="Se admit ore suplimentare"
            descriere="Peste norma zilnică, cu acordul salariatului."
            pornit={suplimentare}
            onSchimba={setSuplimentare}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-corp font-medium">Timp de lucru</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Durata
            nume="ore_pe_zi"
            eticheta="Ore pe zi"
            descriere="Norma zilnică obișnuită."
            implicit={setariCurente?.ore_pe_zi}
            valoare={orePeZi}
            onSchimba={setOrePeZi}
          />
          <Durata
            nume="ore_pe_saptamana"
            eticheta="Ore pe săptămână"
            descriere="Norma săptămânală obișnuită."
            implicit={setariCurente?.ore_pe_saptamana}
            exemplu="40:00"
          />
          <Durata
            nume="ore_maxime_saptamanale"
            eticheta="Maxim săptămânal cu ore suplimentare"
            descriere="Limita legală, inclusiv suplimentarele."
            implicit={setariCurente?.ore_maxime_saptamanale}
            exemplu="48:00"
          />
          <Alegere
            nume="perioada_referinta_luni"
            eticheta="Perioada de referință (luni)"
            descriere="Intervalul pe care se face media săptămânală."
            implicit={setariCurente?.perioada_referinta_luni}
            optiuni={perioadeCu(setariCurente?.perioada_referinta_luni)}
          />
          <Durata
            nume="repaus_zilnic_minim_ore"
            eticheta="Repaus zilnic minim"
            descriere="Între sfârșitul unei zile și începutul următoarei."
            implicit={setariCurente?.repaus_zilnic_minim_ore}
            exemplu="12:00"
          />
          <Durata
            nume="repaus_saptamanal_minim_ore"
            eticheta="Repaus săptămânal minim"
            descriere="Neîntrerupt, în fiecare săptămână."
            implicit={setariCurente?.repaus_saptamanal_minim_ore}
            exemplu="48:00"
          />
        </div>
      </fieldset>

      {/*
        Sporurile NU se mai setează aici (0082). Erau patru procente duplicate
        din `payroll_settings`, în altă scară (0–300 față de fracție), care nu
        plăteau nimic: alimentau `app.sporuri_pontaj()`, funcție fără apelanți.
        Ecranul cerea patronului să confirme aceleași cifre de două ori, iar cea
        de aici arăta la fel de oficial ca cea care chiar intră pe fluturaș.

        Rămâne un INDICATOR, nu o setare — oamenii le-au căutat aici ani de zile
        și un ecran care tace îi trimite să caute prin tot produsul.
      */}
      <div
        role="note"
        className="border-border rounded-panou text-nota text-muted-foreground border p-3"
      >
        <strong className="text-foreground">Sporurile nu se setează aici.</strong> Procentele care
        intră pe fluturaș — ore suplimentare, noapte, repaus săptămânal, sărbătoare — se
        configurează într-un singur loc,{" "}
        <Link href="/salarizare/setari" className="underline underline-offset-2">
          Salarizare → Setări
        </Link>
        . Aici rămân doar parametrii care descriu cum se înregistrează timpul.
      </div>

      {noaptea ? (
        <fieldset className="space-y-4">
          <legend className="text-corp font-medium">Munca de noapte</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={idNoapteStart} className="text-corp">
                Începutul intervalului
              </label>
              <IntrareOra
                id={idNoapteStart}
                name="noapte_start"
                implicit={setariCurente?.noapte_start}
                required
                className={CAMP}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={idNoapteSfarsit} className="text-corp">
                Sfârșitul intervalului
              </label>
              <IntrareOra
                id={idNoapteSfarsit}
                name="noapte_sfarsit"
                implicit={setariCurente?.noapte_sfarsit}
                required
                className={CAMP}
              />
            </div>
            <Durata
              nume="prag_ore_noapte"
              eticheta="Prag ore de noapte"
              descriere="Minimul de ore nocturne dintr-o zi pentru a da drept la spor. Zero = fără prag."
              implicit={setariCurente?.prag_ore_noapte}
            />
          </div>
        </fieldset>
      ) : (
        /*
          Fereastra nocturnă se PĂSTREAZĂ chiar cu tura de noapte oprită: ea e
          definiția legală a intervalului (art. 125), nu o preferință. O oră
          lucrată la 23:00 rămâne oră de noapte și trebuie să se poată recunoaște
          ca atare — altfel debifarea unei căsuțe ar șterge un drept.
        */
        <>
          <input
            type="hidden"
            name="noapte_start"
            value={setariCurente?.noapte_start.slice(0, 5) ?? "22:00"}
          />
          <input
            type="hidden"
            name="noapte_sfarsit"
            value={setariCurente?.noapte_sfarsit.slice(0, 5) ?? "06:00"}
          />
          <input
            type="hidden"
            name="prag_ore_noapte"
            value={pastreaza(setariCurente?.prag_ore_noapte)}
          />
        </>
      )}

      <fieldset className="space-y-4">
        <legend className="text-corp font-medium">Compensare și pauze</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numeric
            nume="termen_compensare_suplimentare_zile"
            eticheta="Termen compensare ore suplimentare (zile)"
            descriere="După expirare, orele se plătesc obligatoriu cu spor."
            implicit={setariCurente?.termen_compensare_suplimentare_zile}
            pas="1"
            maxim={365}
          />
          <Numeric
            nume="termen_compensare_sarbatoare_zile"
            eticheta="Termen acordare zi liberă pentru sărbătoare (zile)"
            descriere="După expirare se plătește sporul."
            implicit={setariCurente?.termen_compensare_sarbatoare_zile}
            pas="1"
            maxim={365}
          />
          <Numeric
            nume="pauza_masa_minute"
            eticheta="Pauză de masă (minute)"
            descriere="Durata pauzei obligatorii."
            implicit={setariCurente?.pauza_masa_minute}
            pas="1"
            maxim={240}

            valoare={pauzaMinute}
            onSchimba={setPauzaMinute}
          />
          <Durata
            nume="pauza_obligatorie_peste_ore"
            eticheta="Pauza devine obligatorie peste"
            descriere="Durata zilei de la care pauza e impusă."
            implicit={setariCurente?.pauza_obligatorie_peste_ore}
            valoare={pauzaPrag}
            onSchimba={setPauzaPrag}
          />
        </div>
        <label className="text-corp flex items-center gap-2">
          <input
            type="checkbox"
            name="pauza_masa_inclusa_in_program"
            checked={pauzaInclusa}
            onChange={(e) => {
              setPauzaInclusa(e.target.checked);
            }}
          />
          Pauza de masă e inclusă în programul plătit
        </label>
      </fieldset>

      {/*
        Secțiunea „Pontarea de pe telefon” a plecat de aici în 0115, pe fila
        „Pontarea”. Motivul e chiar forma formularului ăstuia: e o scriere
        VERSIONATĂ, care cere o dată de intrare în vigoare și toți parametrii
        juridici deodată. Ca să pornești un buton de pontare trebuia deci să
        reconfirmi optsprezece cifre de dreptul muncii — iar cele trei setări
        n-au nevoie de istoric: nimeni nu recalculează martie din „era codul QR
        obligatoriu atunci”.
      */}

      <div className="flex flex-col gap-1">
        <label htmlFor={idObservatii} className="text-corp">
          Observații juridice
        </label>
        <textarea
          id={idObservatii}
          name="observatii_juridice"
          rows={3}
          defaultValue={setariCurente?.observatii_juridice ?? ""}
          className={CAMP}
        />
        <p className="text-muted-foreground text-nota">
          Cine a confirmat valorile și pe ce temei. Peste un an, cifra fără sursă nu mai poate fi
          apărată.
        </p>
      </div>

      <Buton type="submit" varianta="primar" inCurs={seTrimite} textInCurs="Se salvează…">
        Salvează versiunea
      </Buton>

      {mesaj !== null ? <p className="text-success text-corp">{mesaj}</p> : null}
      {eroare !== null ? <p className="text-danger text-corp">{eroare}</p> : null}
    </form>
  );
}
