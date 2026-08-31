"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { IntrareDurata, IntrareOra } from "@/components/ui/intrare-ora";
import {
  TIPURI_PREZENTA,
  TIPURI_ZI_ALEGERE,
  type TipPrezenta,
  type TipZi,
} from "@/schemas/attendance";
import {
  oreleZilei,
  type ConfigZi,
  oreSuplimentareDinLucrate,
} from "@/domain/attendance/calcul-ore";
import { ETICHETE_TIP_PREZENTA, ETICHETE_TIP_ZI } from "./etichete";
import { decideZiPontaj, salveazaZiPontaj, stergeZiPontaj } from "./actions";
import type { IntrareZiClient } from "./intrare-client";

interface Proprietati {
  readonly angajatId: string | null;
  readonly data: string;
  readonly eticheta: string;
  readonly intrare: IntrareZiClient | null;
  /**
   * Intervalul tras pe grila orară, pentru o zi care încă n-are unul — sau
   * pentru una căreia omul tocmai i-l redefinește prin tragere.
   *
   * Bate `intrare`: cine trage peste un bloc existent vrea intervalul TRAS, nu
   * pe cel salvat. Grila trimite proprietățile astea NUMAI după o tragere
   * adevărată; un click simplu pe o zi deja pontată le lasă nedefinite, deci
   * dialogul se deschide pe valorile ei.
   */
  readonly oraInceputInitiala?: string | undefined;
  readonly oraSfarsitInitiala?: string | undefined;
  readonly poateSterge: boolean;
  /** Pragul de ore/zi al organizației (`attendance_settings.ore_pe_zi`) — peste el, orele devin suplimentare automat. */
  /** Fereastra de noapte a organizației (`attendance_settings.noapte_start/_sfarsit`). */
  /** Parametrii de derivare — aceiași pentru tot produsul. */
  readonly config: ConfigZi;
  /** Aprobatorul vede secțiunea de decizie pe zi; ceilalți, doar rezultatul ei. */
  readonly poateAproba: boolean;
  readonly onInchide: () => void;
}

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

/**
 * Clasele casetei. `m-auto` NU e cosmetic — fără el, dialogul stă în colțul
 * stânga-sus, peste antetul paginii.
 *
 * Un `<dialog>` deschis cu `showModal()` se centrează prin `margin: auto` din
 * foaia BROWSERULUI. Preflight-ul Tailwind pune `margin: 0` pe `*`, deci o
 * anulează. Componenta partajată (`ui/dialog.tsx`) scrie clasa explicit și
 * explică de ce; ecranul ăsta își cheamă `showModal()` de mână și n-o avea.
 *
 * E aceeași clasă de defect ca `popover="manual"`, care primește `inset: 0` tot
 * din foaia browserului: nu se vede într-un test de DOM, fiindcă acolo clasa E
 * prezentă și doar stilul CALCULAT diferă. Regula se apără prin comentariul
 * ăsta și prin garda din `celula-zi.test.tsx`.
 *
 * `max-h` + `overflow-y-auto`: dialogul are opt câmpuri, iar un `<dialog>`
 * centrat prin margini automate NU derulează — crește în ambele direcții
 * deodată, deci pe telefon antetul iese pe sus și „Salvează" pe jos, de
 * neatins. `dvh`, nu `vh`, pentru bara de adrese care se retrage pe iOS.
 */
const CLASA_DIALOG =
  "border-border bg-surface text-foreground rounded-panou m-auto max-h-[calc(100dvh-4rem)] " +
  "w-full max-w-md overflow-y-auto border p-0 backdrop:bg-black/40";

/**
 * Editorul unei zile de pontaj, ca `<dialog>` nativ — focus trap și Escape
 * gratuite. Refuri atinse EXCLUSIV într-un efect (tiparul din
 * `command-palette.tsx`): handlerele schimbă doar starea.
 *
 * Instanțiat cu `key={angajatId+data}` din `foaie-colectiva.tsx`, deci fiecare
 * celulă selectată pornește cu o instanță NOUĂ — nu trebuie sincronizată
 * starea internă la schimbarea selecției.
 */
export function CelulaZi({
  angajatId,
  data,
  eticheta,
  intrare,
  oraInceputInitiala,
  oraSfarsitInitiala,
  poateSterge,
  config,
  poateAproba,
  onInchide,
}: Proprietati) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  /*
    Orele de pornire, când intervalul vine dintr-o selecție trasă pe grilă.

    Se derivă DOAR pentru intervalul precompletat, niciodată pentru cel citit
    din `intrare`: o zi salvată de cineva cu `attendance:create = all` poate avea
    dinadins alte ore decât cele care ies din interval (pauză neobișnuită, tură
    peste miezul nopții), iar o derivare la deschidere i le-ar rescrie tăcut,
    fără ca omul să atingă vreun câmp.
  */
  const derivateInitiale =
    oraInceputInitiala === undefined || oraSfarsitInitiala === undefined
      ? null
      : oreleZilei(oraInceputInitiala, oraSfarsitInitiala, config);

  const [oraInceput, setOraInceput] = useState(oraInceputInitiala ?? intrare?.oraInceput ?? "");
  const [oraSfarsit, setOraSfarsit] = useState(oraSfarsitInitiala ?? intrare?.oraSfarsit ?? "");
  const [oreLucrate, setOreLucrate] = useState<number | null>(
    derivateInitiale?.lucrate ?? intrare?.oreLucrate ?? 8,
  );
  const [oreSuplimentare, setOreSuplimentare] = useState<number | null>(
    derivateInitiale?.suplimentare ?? intrare?.oreSuplimentare ?? 0,
  );
  const [oreNoapte, setOreNoapte] = useState<number | null>(
    derivateInitiale?.noapte ?? intrare?.oreNoapte ?? 0,
  );
  const [motivRespingere, setMotivRespingere] = useState("");
  const [ceareMotiv, setCereMotiv] = useState(false);
  const [tipZi, setTipZi] = useState<string>(
    intrare !== null && (TIPURI_ZI_ALEGERE as readonly string[]).includes(intrare.tipZi)
      ? intrare.tipZi
      : "",
  );
  /*
    Locul de muncă al zilei (0118).

    Implicitul pentru o zi NOUĂ e „La birou", fiindcă e cazul obișnuit și
    fiindcă tragerea peste grilă trebuie să ducă la o zi completă dintr-o
    singură apăsare. O zi EXISTENTĂ își păstrează însă valoarea, inclusiv
    absența ei: `?? ""` la citire, nu `?? "birou"` — altfel deschiderea unei
    zile vechi ar fi propus tăcut o declarație pe care apoi „Salvează" ar fi
    scris-o ca și cum ar fi fost a omului.
  */
  const [tipPrezenta, setTipPrezenta] = useState<string>(
    intrare === null ? "birou" : (intrare.tipPrezenta ?? ""),
  );
  const [observatii, setObservatii] = useState(intrare?.observatii ?? "");

  const idTitlu = useId();
  const idOraInceput = useId();
  const idOraSfarsit = useId();
  const idOreLucrate = useId();
  const idOreSuplimentare = useId();
  const idOreNoapte = useId();
  const idTipZi = useId();
  const idTipPrezenta = useId();
  const idObservatii = useId();
  const idMotivRespingere = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (el !== null && !el.open) el.showModal();
  }, []);

  function trimite(eveniment: React.FormEvent<HTMLFormElement>): void {
    eveniment.preventDefault();
    setEroare(null);
    porneste(async () => {
      const rezultat = await salveazaZiPontaj({
        employee_id: angajatId,
        data,
        ora_inceput: oraInceput.length === 0 ? null : oraInceput,
        ora_sfarsit: oraSfarsit.length === 0 ? null : oraSfarsit,
        ore_lucrate: oreLucrate ?? 0,
        ore_suplimentare: oreSuplimentare ?? 0,
        ore_noapte: oreNoapte ?? 0,
        tip_zi: tipZi.length === 0 ? null : (tipZi as TipZi),
        tip_prezenta: tipPrezenta.length === 0 ? null : (tipPrezenta as TipPrezenta),
        observatii: observatii.length === 0 ? null : observatii,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      onInchide();
      router.refresh();
    });
  }

  /**
   * Recalculează orele la fiecare modificare a intervalului — doar o SUGESTIE:
   * câmpurile rămân editabile manual pentru corecții (ture peste miezul nopții,
   * pauze neobișnuite). Ce se schimbă e sugestia însăși.
   *
   * ── PAUZA DE MASĂ SE SCADE ȘI AICI ─────────────────────────────────────
   * Până acum, ecranul ăsta chema `oreLucrateDinInterval`, care dă intervalul
   * BRUT, în timp ce portalul angajatului chema `oreleZilei`, care scade pauza
   * configurată de firmă. Aceeași zi, 08:30–17:00, ieșea cu 8,00 ore când o
   * ponta angajatul și cu 8,50 când o ponta responsabilul de pontaj — iar
   * jumătatea de oră diferență devenea oră suplimentară, cu spor, în fiecare zi
   * completată de aici. O regulă a firmei nu se poate aplica pe jumătate de
   * produs.
   */
  function actualizeazaInterval(capat: "inceput" | "sfarsit", valoare: string): void {
    const nouaInceput = capat === "inceput" ? valoare : oraInceput;
    const nouaSfarsit = capat === "sfarsit" ? valoare : oraSfarsit;
    if (capat === "inceput") setOraInceput(valoare);
    else setOraSfarsit(valoare);

    // Un singur apel pentru toate cele trei cifre: lucrate (cu pauza scăzută),
    // suplimentare (peste normă, DUPĂ pauză) și de noapte (din fereastra
    // firmei, plafonate la orele lucrate).
    const derivate = oreleZilei(nouaInceput, nouaSfarsit, config);
    if (derivate !== null) {
      setOreLucrate(derivate.lucrate);
      setOreSuplimentare(derivate.suplimentare);
      setOreNoapte(derivate.noapte);
    }
  }

  /** Editare manuală a orelor lucrate — recalculează doar suplimentarul. */
  function actualizeazaOreLucrateManual(ore: number | null): void {
    setOreLucrate(ore);
    if (ore !== null) {
      setOreSuplimentare(oreSuplimentareDinLucrate(ore, config.orePeZi));
    }
  }

  /**
   * Aprobă sau respinge ziua curentă.
   *
   * Până în 0067 exista numai aprobarea în BLOC, pe toată luna, și nicio cale
   * de respingere: aprobatorul care găsea o zi greșită putea aproba tot,
   * inclusiv greșeala, sau nimic.
   */
  function decide(aproba: boolean): void {
    if (intrare === null) return;
    if (!aproba && motivRespingere.trim().length < 5) {
      setCereMotiv(true);
      setEroare("Respingerea cere un motiv de cel puțin 5 caractere.");
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await decideZiPontaj({
        entry_id: intrare.id,
        aproba,
        motiv: aproba ? null : motivRespingere,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      onInchide();
      router.refresh();
    });
  }

  function sterge(): void {
    if (intrare === null) return;
    setEroare(null);
    porneste(async () => {
      const rezultat = await stergeZiPontaj({ id: intrare.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      onInchide();
      router.refresh();
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={idTitlu}
      onClose={onInchide}
      className={CLASA_DIALOG}
    >
      <form onSubmit={trimite} className="space-y-4 p-5" noValidate>
        <h2 id={idTitlu} className="text-sectiune font-semibold">
          {eticheta}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={idOraInceput} className="text-corp block font-medium">
              Ora început
            </label>
            <IntrareOra
              id={idOraInceput}
              valoare={oraInceput}
              onSchimba={(v) => {
                actualizeazaInterval("inceput", v);
              }}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOraSfarsit} className="text-corp block font-medium">
              Ora sfârșit
            </label>
            <IntrareOra
              id={idOraSfarsit}
              valoare={oraSfarsit}
              onSchimba={(v) => {
                actualizeazaInterval("sfarsit", v);
              }}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOreLucrate} className="text-corp block font-medium">
              Ore lucrate
            </label>
            <IntrareDurata
              id={idOreLucrate}
              valoare={oreLucrate}
              onSchimba={actualizeazaOreLucrateManual}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOreSuplimentare} className="text-corp block font-medium">
              Ore suplimentare
            </label>
            <IntrareDurata
              id={idOreSuplimentare}
              valoare={oreSuplimentare}
              onSchimba={setOreSuplimentare}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOreNoapte} className="text-corp block font-medium">
              Ore noapte
            </label>
            <IntrareDurata
              id={idOreNoapte}
              valoare={oreNoapte}
              onSchimba={setOreNoapte}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idTipZi} className="text-corp block font-medium">
              Tip special
            </label>
            <select
              id={idTipZi}
              value={tipZi}
              onChange={(e) => {
                setTipZi(e.target.value);
              }}
              className={CLASA_CAMP}
            >
              <option value="">Automat (după calendar)</option>
              {TIPURI_ZI_ALEGERE.map((t) => (
                <option key={t} value={t}>
                  {ETICHETE_TIP_ZI[t]}
                </option>
              ))}
            </select>
          </div>
          {/*
            Locul de muncă (0118) — același vocabular ca „Planul săptămânii",
            ajuns și pe ziua pontată efectiv.

            Opțiunea goală rămâne prima și e o VALOARE, nu un câmp neatins:
            coloana e nullable, iar o zi de dinainte de 0118 sau una pusă de pe
            telefon chiar nu declară nimic. Colapsată în „La birou", ar fi
            afirmat, pentru toate zilele din trecut, ceva ce n-a spus nimeni.
          */}
          <div>
            <label htmlFor={idTipPrezenta} className="text-corp block font-medium">
              Loc de muncă
            </label>
            <select
              id={idTipPrezenta}
              value={tipPrezenta}
              onChange={(e) => {
                setTipPrezenta(e.target.value);
              }}
              className={CLASA_CAMP}
            >
              <option value="">Nedeclarat</option>
              {TIPURI_PREZENTA.map((t) => (
                <option key={t} value={t}>
                  {ETICHETE_TIP_PREZENTA[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={idObservatii} className="text-corp block font-medium">
            Observații
          </label>
          <textarea
            id={idObservatii}
            rows={2}
            maxLength={1000}
            value={observatii}
            onChange={(e) => {
              setObservatii(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        {intrare !== null && intrare.respins ? (
          <p className="border-danger/40 bg-danger/10 rounded-control text-corp border p-3">
            <strong>Zi respinsă.</strong> {intrare.motivRespingere ?? "Fără motiv înregistrat."}{" "}
            Corectați-o și salvați din nou.
          </p>
        ) : null}

        {intrare !== null && poateAproba ? (
          <fieldset className="border-border rounded-panou border p-3">
            <legend className="text-corp px-1 font-medium">Decizia pe ziua asta</legend>
            <p className="text-muted-foreground text-corp mb-2">
              {intrare.aprobat
                ? "Ziua e aprobată. O poți respinge dacă ai găsit o problemă."
                : "Ziua nu e încă decisă. Aprobarea în bloc, din ecranul de aprobări, decide toată luna deodată."}
            </p>

            {ceareMotiv ? (
              <div className="mb-2">
                <label htmlFor={idMotivRespingere} className="text-corp block font-medium">
                  Motivul respingerii
                </label>
                <input
                  id={idMotivRespingere}
                  type="text"
                  value={motivRespingere}
                  maxLength={500}
                  onChange={(e) => {
                    setMotivRespingere(e.target.value);
                  }}
                  placeholder="Ex. orele nu corespund cu foaia de prezență"
                  className={CLASA_CAMP}
                />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Buton
                varianta="secundar"
                onClick={() => {
                  decide(true);
                }}
                disabled={inCurs || intrare.aprobat}
              >
                Aprobă ziua
              </Buton>
              <Buton
                varianta="distructiv"
                onClick={() => {
                  if (!ceareMotiv) {
                    setCereMotiv(true);
                    return;
                  }
                  decide(false);
                }}
                disabled={inCurs}
              >
                {ceareMotiv ? "Confirmă respingerea" : "Respinge ziua"}
              </Buton>
            </div>
          </fieldset>
        ) : null}

        <div aria-live="polite">
          {eroare === null ? null : <p className="text-danger text-corp">{eroare}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {intrare !== null && poateSterge ? (
            <Buton varianta="distructiv" onClick={sterge} disabled={inCurs}>
              Șterge ziua
            </Buton>
          ) : null}
          <Buton varianta="secundar" onClick={onInchide}>
            Renunță
          </Buton>
          <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
            Salvează
          </Buton>
        </div>
      </form>
    </dialog>
  );
}
