"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TIPURI_ZI_ALEGERE, type TipZi } from "@/schemas/attendance";
import {
  oreLucrateDinInterval,
  oreNoapteDinInterval,
  oreSuplimentareDinLucrate,
} from "@/domain/attendance/calcul-ore";
import type { IntervalNoapte } from "./interval-noapte";
import { ETICHETE_TIP_ZI } from "./etichete";
import { decideZiPontaj, salveazaZiPontaj, stergeZiPontaj } from "./actions";
import type { IntrareZiClient } from "./foaie-colectiva";

interface Proprietati {
  readonly angajatId: string | null;
  readonly data: string;
  readonly eticheta: string;
  readonly intrare: IntrareZiClient | null;
  readonly poateSterge: boolean;
  /** Pragul de ore/zi al organizației (`attendance_settings.ore_pe_zi`) — peste el, orele devin suplimentare automat. */
  readonly orePeZi: number;
  /** Fereastra de noapte a organizației (`attendance_settings.noapte_start/_sfarsit`). */
  readonly intervalNoapte: IntervalNoapte;
  /** Aprobatorul vede secțiunea de decizie pe zi; ceilalți, doar rezultatul ei. */
  readonly poateAproba: boolean;
  readonly onInchide: () => void;
}

const CLASA_CAMP = "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

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
  poateSterge,
  orePeZi,
  intervalNoapte,
  poateAproba,
  onInchide,
}: Proprietati) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [oraInceput, setOraInceput] = useState(intrare?.oraInceput ?? "");
  const [oraSfarsit, setOraSfarsit] = useState(intrare?.oraSfarsit ?? "");
  const [oreLucrate, setOreLucrate] = useState(String(intrare?.oreLucrate ?? 8));
  const [oreSuplimentare, setOreSuplimentare] = useState(String(intrare?.oreSuplimentare ?? 0));
  const [oreNoapte, setOreNoapte] = useState(String(intrare?.oreNoapte ?? 0));
  const [motivRespingere, setMotivRespingere] = useState("");
  const [ceareMotiv, setCereMotiv] = useState(false);
  const [tipZi, setTipZi] = useState<string>(
    intrare !== null && (TIPURI_ZI_ALEGERE as readonly string[]).includes(intrare.tipZi)
      ? intrare.tipZi
      : "",
  );
  const [observatii, setObservatii] = useState(intrare?.observatii ?? "");

  const idTitlu = useId();
  const idOraInceput = useId();
  const idOraSfarsit = useId();
  const idOreLucrate = useId();
  const idOreSuplimentare = useId();
  const idOreNoapte = useId();
  const idTipZi = useId();
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
        ore_lucrate: Number(oreLucrate),
        ore_suplimentare: Number(oreSuplimentare),
        ore_noapte: Number(oreNoapte),
        tip_zi: tipZi.length === 0 ? null : (tipZi as TipZi),
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
   * Recalculează ore lucrate + ore suplimentare la fiecare modificare a
   * intervalului — doar o SUGESTIE: ambele câmpuri rămân editabile manual
   * pentru corecții (pauze neplătite, ture peste miezul nopții etc.).
   */
  function actualizeazaInterval(capat: "inceput" | "sfarsit", valoare: string): void {
    const nouaInceput = capat === "inceput" ? valoare : oraInceput;
    const nouaSfarsit = capat === "sfarsit" ? valoare : oraSfarsit;
    if (capat === "inceput") setOraInceput(valoare);
    else setOraSfarsit(valoare);

    const calculate = oreLucrateDinInterval(nouaInceput, nouaSfarsit);
    if (calculate !== null) {
      setOreLucrate(String(calculate));
      setOreSuplimentare(String(oreSuplimentareDinLucrate(calculate, orePeZi)));
      // Orele de noapte se DERIVĂ din interval, nu se mai tastează. Coloanele
      // `noapte_start`/`noapte_sfarsit` existau din 0013 și nu le citea nimic:
      // cine uita să completeze pierdea sporul de 25%, cine exagera îl încasa
      // nemeritat, iar nimic nu compara cifra cu tura efectiv lucrată.
      const noaptea = oreNoapteDinInterval(
        nouaInceput,
        nouaSfarsit,
        intervalNoapte.start,
        intervalNoapte.sfarsit,
      );
      if (noaptea !== null) setOreNoapte(String(noaptea));
    }
  }

  /** Editare manuală a orelor lucrate — recalculează doar suplimentarul. */
  function actualizeazaOreLucrateManual(valoare: string): void {
    setOreLucrate(valoare);
    const numar = Number(valoare);
    if (valoare.trim().length > 0 && Number.isFinite(numar)) {
      setOreSuplimentare(String(oreSuplimentareDinLucrate(numar, orePeZi)));
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
      className="border-border bg-surface text-foreground w-full max-w-md rounded-lg border p-0 backdrop:bg-black/40"
    >
      <form onSubmit={trimite} className="space-y-4 p-5" noValidate>
        <h2 id={idTitlu} className="text-base font-semibold">
          {eticheta}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={idOraInceput} className="block text-sm font-medium">
              Ora început
            </label>
            <input
              id={idOraInceput}
              type="time"
              lang="ro-RO"
              value={oraInceput}
              onChange={(e) => {
                actualizeazaInterval("inceput", e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOraSfarsit} className="block text-sm font-medium">
              Ora sfârșit
            </label>
            <input
              id={idOraSfarsit}
              type="time"
              lang="ro-RO"
              value={oraSfarsit}
              onChange={(e) => {
                actualizeazaInterval("sfarsit", e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOreLucrate} className="block text-sm font-medium">
              Ore lucrate
            </label>
            <input
              id={idOreLucrate}
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={oreLucrate}
              onChange={(e) => {
                actualizeazaOreLucrateManual(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOreSuplimentare} className="block text-sm font-medium">
              Ore suplimentare
            </label>
            <input
              id={idOreSuplimentare}
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={oreSuplimentare}
              onChange={(e) => {
                setOreSuplimentare(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idOreNoapte} className="block text-sm font-medium">
              Ore noapte
            </label>
            <input
              id={idOreNoapte}
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={oreNoapte}
              onChange={(e) => {
                setOreNoapte(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>
          <div>
            <label htmlFor={idTipZi} className="block text-sm font-medium">
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
        </div>

        <div>
          <label htmlFor={idObservatii} className="block text-sm font-medium">
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
          <p className="border-danger/40 bg-danger/10 rounded-md border p-3 text-sm">
            <strong>Zi respinsă.</strong> {intrare.motivRespingere ?? "Fără motiv înregistrat."}{" "}
            Corectați-o și salvați din nou.
          </p>
        ) : null}

        {intrare !== null && poateAproba ? (
          <fieldset className="border-border rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Decizia pe ziua asta</legend>
            <p className="text-muted-foreground mb-2 text-sm">
              {intrare.aprobat
                ? "Ziua e aprobată. O poți respinge dacă ai găsit o problemă."
                : "Ziua nu e încă decisă. Aprobarea în bloc, din ecranul de aprobări, decide toată luna deodată."}
            </p>

            {ceareMotiv ? (
              <div className="mb-2">
                <label htmlFor={idMotivRespingere} className="block text-sm font-medium">
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
              <button
                type="button"
                onClick={() => {
                  decide(true);
                }}
                disabled={inCurs || intrare.aprobat}
                className="border-border rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Aprobă ziua
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!ceareMotiv) {
                    setCereMotiv(true);
                    return;
                  }
                  decide(false);
                }}
                disabled={inCurs}
                className="border-danger text-danger hover:bg-danger hover:text-danger-foreground rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ceareMotiv ? "Confirmă respingerea" : "Respinge ziua"}
              </button>
            </div>
          </fieldset>
        ) : null}

        <div aria-live="polite">
          {eroare === null ? null : <p className="text-danger text-sm">{eroare}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {intrare !== null && poateSterge ? (
            <button
              type="button"
              onClick={sterge}
              disabled={inCurs}
              className="border-danger text-danger hover:bg-danger hover:text-danger-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed"
            >
              Șterge ziua
            </button>
          ) : null}
          <button
            type="button"
            onClick={onInchide}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          >
            Renunță
          </button>
          <button
            type="submit"
            disabled={inCurs}
            className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
          >
            {inCurs ? "Se salvează…" : "Salvează"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
