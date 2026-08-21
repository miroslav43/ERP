"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TIPURI_ZI_ALEGERE, type TipZi } from "@/schemas/attendance";
import { oreLucrateDinInterval, oreSuplimentareDinLucrate } from "@/domain/attendance/calcul-ore";
import { ETICHETE_TIP_ZI } from "./etichete";
import { salveazaZiPontaj, stergeZiPontaj } from "./actions";
import type { IntrareZiClient } from "./foaie-colectiva";

interface Proprietati {
  readonly angajatId: string | null;
  readonly data: string;
  readonly eticheta: string;
  readonly intrare: IntrareZiClient | null;
  readonly poateSterge: boolean;
  /** Pragul de ore/zi al organizației (`attendance_settings.ore_pe_zi`) — peste el, orele devin suplimentare automat. */
  readonly orePeZi: number;
  readonly onInchide: () => void;
}

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

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

        <div aria-live="polite">
          {eroare === null ? null : (
            <p className="text-sm text-danger">{eroare}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {intrare !== null && poateSterge ? (
            <button
              type="button"
              onClick={sterge}
              disabled={inCurs}
              className="rounded-md border border-danger px-3 py-2 text-sm text-danger hover:bg-danger hover:text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
            >
              Șterge ziua
            </button>
          ) : null}
          <button
            type="button"
            onClick={onInchide}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            Renunță
          </button>
          <button
            type="submit"
            disabled={inCurs}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            {inCurs ? "Se salvează…" : "Salvează"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
