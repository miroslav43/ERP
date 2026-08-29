"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { salveazaZiPontaj } from "@/app/(app)/pontaj/actions";
import { Buton } from "@/components/ui/buton";
import { IntrareOra } from "@/components/ui/intrare-ora";
import { formatOre } from "@/lib/format/ore";
import { oreleZilei, type ConfigZi } from "@/domain/attendance/calcul-ore";

/**
 * Completarea unei singure zile de pontaj, pentru telefon.
 *
 * În aplicația mare, aceleași date se introduc într-o foaie colectivă cu o
 * coloană pe zi și un rând pe angajat — o formă care pe un ecran de telefon fie
 * se derulează orizontal, fie își strivește celulele. Aici e o zi, un interval,
 * un buton.
 *
 * ── DE CE INTERVAL, NU ORE ────────────────────────────────────────────────
 * Omul știe la ce oră a intrat și la ce oră a plecat; nu știe câte ore
 * suplimentare i se cuvin, nici ce înseamnă „ore de noapte" în firma lui.
 * Înainte, formularul cerea exact cifrele pe care angajatul nu le poate
 * calcula, și trimitea `ora_inceput: null, ora_sfarsit: null, ore_noapte: 0`.
 * Comentariul de aici spunea că orele de noapte „se calculează din interval de
 * către bază" — NU e adevărat: `internal.pontaj_intrare_pregateste`
 * (0013:275-309) atinge doar `period_id` și `tip_zi`. Consecința era că oricine
 * se ponta din portal avea zero ore de noapte în bază, deci zero spor de 25%,
 * fără ca nimic să semnaleze.
 *
 * ── CIFRELE DE AICI SUNT DOAR O OGLINDĂ ───────────────────────────────────
 * `salveazaZiPontaj` recalculează totul pe server, din același `oreleZilei`,
 * pentru oricine scrie în scope `own`. Ce se vede mai jos e ce se va scrie —
 * dar autoritatea nu e ecranul.
 */

const CLASA_CAMP =
  "mt-1 min-h-11 w-full rounded-control border border-foreground/60 bg-background px-3 py-2 text-corp";

/** Durata pe ceas: `8.5` → `8:30`. Zecimala nu ajunge pe ecran. */
const ore = formatOre;

export function FormularZi({
  data,
  config,
  regulaFirmei,
  inceputInitial,
  sfarsitInitial,
  oreSalvate,
  observatiiInitiale,
}: {
  readonly data: string;
  readonly config: ConfigZi;
  /** Regula după care ies cifrele, scrisă în cuvinte — `rezumatRegulaPontaj`. */
  readonly regulaFirmei: string;
  readonly inceputInitial: string;
  readonly sfarsitInitial: string;
  /** Orele deja în bază, pentru zilele scrise înainte ca intervalul să existe. */
  readonly oreSalvate: number | null;
  readonly observatiiInitiale: string;
}) {
  const router = useRouter();
  const [inceput, setInceput] = useState(inceputInitial);
  const [sfarsit, setSfarsit] = useState(sfarsitInitial);
  const [observatii, setObservatii] = useState(observatiiInitiale);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const idInceput = useId();
  const idSfarsit = useId();
  const idObservatii = useId();
  const idRezumat = useId();

  const derivate = oreleZilei(inceput, sfarsit, config);
  const ambele = inceput.length > 0 && sfarsit.length > 0;

  function salveaza(): void {
    setEroare(null);
    if (derivate === null) return;
    porneste(async () => {
      const rezultat = await salveazaZiPontaj({
        // `null` = pentru mine. Acțiunea rezolvă fișa pe server: un identificator
        // venit din formular ar putea fi al altcuiva.
        employee_id: null,
        data,
        ora_inceput: inceput,
        ora_sfarsit: sfarsit,
        // Trimise fiindcă schema le cere, dar serverul le rescrie din interval
        // pentru scope `own`. Nu sunt sursa de adevăr, nici aici, nici acolo.
        ore_lucrate: derivate.lucrate,
        ore_suplimentare: derivate.suplimentare,
        ore_noapte: derivate.noapte,
        tip_zi: null,
        observatii: observatii.length === 0 ? null : observatii,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push("/portal/pontajul-meu");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(eveniment) => {
        eveniment.preventDefault();
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={idInceput} className="text-foreground text-corp font-medium">
            Ora de intrare
          </label>
          <IntrareOra
            id={idInceput}
            required
            valoare={inceput}
            aria-describedby={idRezumat}
            onSchimba={setInceput}
            className={CLASA_CAMP}
          />
        </div>
        <div>
          <label htmlFor={idSfarsit} className="text-foreground text-corp font-medium">
            Ora de ieșire
          </label>
          <IntrareOra
            id={idSfarsit}
            required
            valoare={sfarsit}
            aria-describedby={idRezumat}
            onSchimba={setSfarsit}
            className={CLASA_CAMP}
          />
        </div>
      </div>

      {/*
        Rezumatul e o REGIUNE VIE, nu un text care se schimbă tăcut: cine
        completează orele cu cititorul de ecran trebuie să audă cifra rezultată
        fără să plece din câmp. De aceea și `aria-describedby` pe amândouă
        câmpurile — cifra e consecința lor, nu un panou separat.
      */}
      <section
        id={idRezumat}
        aria-live="polite"
        aria-label="Orele rezultate"
        className="bg-surface border-border rounded-panou border p-3"
      >
        {derivate === null ? (
          <p className="text-muted-foreground text-corp">
            {!ambele
              ? "Completați ora de intrare și ora de ieșire; orele se calculează singure."
              : "Ora de ieșire trebuie să fie după ora de intrare, în aceeași zi. Tura care trece de miezul nopții se înregistrează de responsabilul de pontaj."}
            {oreSalvate === null ? null : (
              <>
                {" "}
                Ziua e înregistrată acum cu{" "}
                <span className="text-foreground tabular-nums">{ore(oreSalvate)}</span> ore, fără
                interval.
              </>
            )}
          </p>
        ) : (
          <dl className="text-corp space-y-1">
            <Rand eticheta="Interval" valoare={derivate.brut} />
            {derivate.pauza > 0 ? (
              <Rand eticheta="Pauză de masă" valoare={-derivate.pauza} discret />
            ) : null}
            <div className="border-border mt-2 border-t pt-2">
              <Rand eticheta="Ore lucrate" valoare={derivate.lucrate} accent />
            </div>
            <Rand eticheta="Din care suplimentare" valoare={derivate.suplimentare} />
            {derivate.noapte > 0 ? (
              <Rand eticheta="Din care de noapte" valoare={derivate.noapte} />
            ) : null}
          </dl>
        )}

        {/*
          Regula stă ÎN rezumat, nu sub el: e explicația cifrelor de deasupra,
          iar `aria-live` o citește odată cu ele. Un om care vede 8:30 lucrate
          în loc de 8:00 află pe loc dacă e regula firmei sau un defect — și,
          fiindcă setările au istoric, dacă regula asta e chiar cea de azi.
        */}
        <p className="border-border text-muted-foreground text-nota mt-3 border-t pt-2">
          {regulaFirmei}
        </p>
      </section>

      <div>
        <label htmlFor={idObservatii} className="text-foreground text-corp font-medium">
          Observații <span className="text-muted-foreground font-normal">(opțional)</span>
        </label>
        <textarea
          id={idObservatii}
          value={observatii}
          rows={2}
          maxLength={1000}
          onChange={(e) => {
            setObservatii(e.target.value);
          }}
          className={`${CLASA_CAMP} min-h-20`}
        />
      </div>

      {eroare === null ? null : (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-3"
        >
          {eroare}
        </p>
      )}

      {/*
        Butonul se dezactivează pe un interval imposibil, nu duce într-un refuz
        de server: acțiunea ar ridica oricum aceeași regulă de business, dar un
        buton care eșuează sigur e un defect de ecran. `aria-disabled` fiindcă
        motivul e deja scris în regiunea vie de mai sus.
      */}
      <Buton
        varianta="primar"
        className="w-full"
        inCurs={inCurs}
        textInCurs="Se salvează…"
        disabled={derivate === null}
        onClick={salveaza}
      >
        Salvează ziua
      </Buton>
    </form>
  );
}

/** Un rând din rezumat: eticheta la stânga, cifra aliniată la dreapta. */
function Rand({
  eticheta,
  valoare,
  accent = false,
  discret = false,
}: {
  readonly eticheta: string;
  readonly valoare: number;
  readonly accent?: boolean;
  readonly discret?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={discret ? "text-muted-foreground" : "text-foreground"}>{eticheta}</dt>
      <dd
        className={`tabular-nums ${accent ? "text-foreground font-medium" : "text-muted-foreground"}`}
      >
        {ore(valoare)} h
      </dd>
    </div>
  );
}
