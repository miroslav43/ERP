"use client";

import { useId, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";

import { Buton } from "@/components/ui/buton";
import { IntrareDurata, IntrareOra } from "@/components/ui/intrare-ora";
import { formatOre } from "@/lib/format/ore";
import { intervalulPropus, oreleZilei } from "@/domain/attendance/calcul-ore";
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
  valoare,
  onSchimba,
}: {
  readonly nume: string;
  readonly eticheta: string;
  readonly descriere: string;
  readonly implicit: number | undefined;
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
  const idMod = useId();
  const idProgramStart = useId();
  const idVerificare = useId();
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

  // Pontarea rapidă (0096). Implicitul `oprit` NU e prudență de formular: e chiar
  // implicitul coloanei din migrare. O firmă care n-a ales nimic nu capătă tăcut
  // o cale nouă prin care angajații îi scriu în pontaj.
  const [modPontare, setModPontare] = useState<string>(
    setariCurente?.mod_pontare_rapida ?? "oprit",
  );
  const [verificare, setVerificare] = useState<string>(setariCurente?.verificare_pontare ?? "fara");
  const [programStart, setProgramStart] = useState(
    (setariCurente?.program_start ?? "").slice(0, 5),
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
        // Din stare, ca și comutatoarele de mai sus: `<select>` și `<input
        // type="time">` ar veni oricum din `FormData`, dar ora goală trebuie să
        // ajungă `null`, nu `""` — schema o trece prin `optional()`.
        program_start: programStart === "" ? null : programStart,
        mod_pontare_rapida: modPontare,
        verificare_pontare: verificare,
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

  const intervalPropus =
    programStart === ""
      ? null
      : intervalulPropus(programStart, {
          orePeZi: orePeZi ?? 8,
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
          />
          <Durata
            nume="ore_maxime_saptamanale"
            eticheta="Maxim săptămânal cu ore suplimentare"
            descriere="Limita legală, inclusiv suplimentarele."
            implicit={setariCurente?.ore_maxime_saptamanale}
          />
          <Numeric
            nume="perioada_referinta_luni"
            eticheta="Perioada de referință (luni)"
            descriere="Intervalul pe care se face media săptămânală."
            implicit={setariCurente?.perioada_referinta_luni}
            pas="1"
            minim={1}
            maxim={12}
          />
          <Durata
            nume="repaus_zilnic_minim_ore"
            eticheta="Repaus zilnic minim"
            descriere="Între sfârșitul unei zile și începutul următoarei."
            implicit={setariCurente?.repaus_zilnic_minim_ore}
          />
          <Durata
            nume="repaus_saptamanal_minim_ore"
            eticheta="Repaus săptămânal minim"
            descriere="Neîntrerupt, în fiecare săptămână."
            implicit={setariCurente?.repaus_saptamanal_minim_ore}
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

      <fieldset className="space-y-4">
        <legend className="text-corp font-medium">Pontarea de pe telefon</legend>
        <p className="text-muted-foreground text-corp">
          Angajatul își poate ponta ziua dintr-o atingere, din aplicația de pe ecranul telefonului.
          Cifrele se calculează pe server, din setările de mai sus — omul declară doar că a fost la
          muncă.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={idMod} className="text-corp">
              Cum se pontează
            </label>
            <select
              id={idMod}
              value={modPontare}
              onChange={(e) => {
                setModPontare(e.target.value);
              }}
              className={CAMP}
            >
              <option value="oprit">Oprit — numai formularul cu ore</option>
              <option value="confirmare">Confirmarea zilei standard — o atingere</option>
              <option value="ceas">Ceas: „Am intrat” / „Am ieșit” — două atingeri</option>
              <option value="ambele">Amândouă, angajatul alege</option>
            </select>
            <p className="text-muted-foreground text-nota">
              Ceasul scrie ora reală de la serverul nostru. Confirmarea scrie programul de mai jos.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idProgramStart} className="text-corp">
              Ora de început a programului
            </label>
            <input
              id={idProgramStart}
              type="time"
              value={programStart}
              onChange={(e) => {
                setProgramStart(e.target.value);
              }}
              className={CAMP}
            />
            <p className="text-muted-foreground text-nota">
              Ora de sfârșit NU se completează: se calculează din norma zilnică și din pauză, ca să
              nu existe două cifre care se pot contrazice.
            </p>
          </div>
        </div>

        {/*
          Aceeași disciplină ca la exemplul de mai sus: ecranul arată CE VA SCRIE
          butonul, nu doar ce s-a configurat. Un patron care alege „confirmare”
          fără să vadă intervalul rezultat n-are cum să prindă o normă pusă
          greșit.
        */}
        {intervalPropus === null ? (
          modPontare === "confirmare" || modPontare === "ambele" ? (
            <p className="text-warning text-corp">
              {programStart === ""
                ? "Completați ora de început: fără ea, butonul de confirmare nu se poate afișa."
                : "Programul nu încape într-o singură zi calendaristică."}
            </p>
          ) : null
        ) : (
          <p className="text-muted-foreground text-corp">
            Butonul va propune{" "}
            <span className="text-foreground font-medium tabular-nums">
              {intervalPropus.inceput}–{intervalPropus.sfarsit}
            </span>{" "}
            și va înregistra{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatOre(orePeZi ?? 8)} h
            </span>{" "}
            lucrate.
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={idVerificare} className="text-corp">
            Verificarea prezenței
          </label>
          <select
            id={idVerificare}
            value={verificare}
            onChange={(e) => {
              setVerificare(e.target.value);
            }}
            className={CAMP}
          >
            <option value="fara">Pe încredere — ca formularul de azi</option>
            <option value="cod_qr">Cod QR afișat la punctul de lucru</option>
          </select>
          <p className="text-muted-foreground text-nota">
            Codul QR dovedește că cineva a fost lângă afiș, nu că angajatul era acolo. E o frână, nu
            o probă — pontajul rămâne declarația angajatului, ca și până acum.
          </p>
        </div>
      </fieldset>

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
