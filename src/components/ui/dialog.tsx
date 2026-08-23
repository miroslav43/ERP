// src/components/ui/dialog.tsx
"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { Buton } from "./buton";
import { Camp } from "./camp";

/**
 * Dialogul, pe `<dialog>` NATIV cu `showModal()`.
 *
 * De ce nu o bibliotecă: `showModal()` dă gratuit exact ce se implementează
 * greșit de obicei — capcană de focus, închidere pe Escape, inertizarea
 * restului paginii și `::backdrop`. Tiparul e deja folosit corect în două
 * locuri din depozit (`command-palette.tsx`, `pontaj/celula-zi.tsx`), deci nu e
 * o pariere pe ceva nou.
 *
 * Ce trebuie ținut minte: elementul intră în TOP LAYER, deasupra oricărui
 * `z-index`. De aceea notificările (`toast.tsx`) folosesc API-ul `popover` —
 * altfel „Anulează" dintr-o confirmare n-ar fi vizibil niciodată.
 */
export type PropsDialog = Readonly<{
  deschis: boolean;
  laInchidere: () => void;
  titlu: string;
  descriere?: string;
  children?: ReactNode;
  subsol?: ReactNode;
  marime?: "mic" | "mediu" | "mare";
}>;

const LATIME = { mic: "max-w-sm", mediu: "max-w-lg", mare: "max-w-2xl" } as const;

export function Dialog({
  deschis,
  laInchidere,
  titlu,
  descriere,
  children,
  subsol,
  marime = "mediu",
}: PropsDialog): ReactElement {
  const ref = useRef<HTMLDialogElement | null>(null);
  const idTitlu = useId();
  const idDescriere = useId();

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (deschis && !el.open) el.showModal();
    if (!deschis && el.open) el.close();
  }, [deschis]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitlu}
      aria-describedby={descriere === undefined ? undefined : idDescriere}
      // `cancel` e evenimentul pentru Escape. Fără el, dialogul s-ar închide în
      // DOM iar starea din React ar rămâne „deschis" — a doua deschidere n-ar
      // mai face nimic, fiindcă `deschis` nu s-ar fi schimbat.
      onCancel={(e) => {
        e.preventDefault();
        laInchidere();
      }}
      onClick={(e) => {
        // Clic pe `::backdrop`: ținta e chiar `<dialog>`, nu un copil al lui.
        if (e.target === ref.current) laInchidere();
      }}
      className={cn(
        "bg-background text-foreground rounded-panou shadow-plutitor border-border m-auto w-[calc(100vw-2rem)] border p-0",
        "backdrop:bg-foreground/50",
        LATIME[marime],
      )}
    >
      <div className="border-border flex items-start justify-between gap-4 border-b p-4">
        <div className="min-w-0">
          <h2 id={idTitlu} className="text-sectiune font-semibold text-balance">
            {titlu}
          </h2>
          {descriere === undefined ? null : (
            <p id={idDescriere} className="text-muted-foreground text-corp mt-1 text-pretty">
              {descriere}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={laInchidere}
          aria-label="Închide"
          className="text-muted-foreground hover:bg-surface hover:text-foreground rounded-control -m-1 shrink-0 p-1 transition-colors"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      {children === undefined ? null : <div className="p-4">{children}</div>}
      {subsol === undefined ? null : (
        <div className="border-border bg-surface flex flex-wrap justify-end gap-2 border-t p-4">
          {subsol}
        </div>
      )}
    </dialog>
  );
}

/**
 * Confirmarea unei acțiuni ireversibile.
 *
 * Sunt ~30 în aplicație, în 14 module, și niciuna nu întreabă nimic: aprobarea
 * unei perioade de salarizare, aprobarea în bloc a pontajului (fără acțiune
 * inversă în `actions.ts`), blocarea lunii, „Marchează decontată" (din care nu
 * se mai iese, prin trigger), casarea unui obiect de inventar, dezactivarea
 * unei grile de concediu care schimbă dreptul anual al zecilor de angajați, și
 * ștergerea unui pas de șablon aflată la 4 px de butonul de editare.
 *
 * ── DE CE `consecinta` E OBLIGATORIE ──────────────────────────────────────
 * „Sigur doriți să continuați?" nu e o confirmare, e o formalitate — omul dă
 * clic pe „Da" fără s-o citească. Ce oprește greșeala e propoziția care spune
 * CE se întâmplă și pe CÂȚI îi atinge. De aceea `consecinta` e obligatorie și
 * `cifre` există: „48 de angajați își schimbă dreptul anual" e o frână, „Sigur?"
 * nu e.
 *
 * ── `cereTastare` ─────────────────────────────────────────────────────────
 * Pentru ireversibilul peste bani. Cere scrierea unui cuvânt înainte de a
 * debloca butonul. Nu se folosește peste tot: dacă apare la fiecare confirmare,
 * devine tot un reflex.
 */
export type PropsConfirmare = Readonly<{
  deschis: boolean;
  laInchidere: () => void;
  titlu: string;
  consecinta: string;
  cifre?: readonly Readonly<{ eticheta: string; valoare: string }>[];
  etichetaConfirmare: string;
  distructiv?: boolean;
  /** Cuvântul care trebuie tastat ca să se deblocheze confirmarea. */
  cereTastare?: string;
  inCurs?: boolean;
  laConfirmare: () => void;
}>;

export function ConfirmareActiune({
  deschis,
  laInchidere,
  titlu,
  consecinta,
  cifre,
  etichetaConfirmare,
  distructiv,
  cereTastare,
  inCurs,
  laConfirmare,
}: PropsConfirmare): ReactElement {
  const [tastat, setTastat] = useState("");
  const [deschisPrecedent, setDeschisPrecedent] = useState(deschis);
  const blocat = cereTastare !== undefined && tastat.trim() !== cereTastare;

  // Ajustare de stare la schimbarea unei prop, în timpul randării — tiparul
  // documentat de React pentru cazul ăsta. Un `useEffect` ar fi randat o dată
  // cu textul vechi înainte să-l șteargă, iar dialogul redeschis ar fi arătat
  // pentru o clipă cuvântul tastat data trecută, cu butonul deja deblocat.
  if (deschis !== deschisPrecedent) {
    setDeschisPrecedent(deschis);
    setTastat("");
  }

  return (
    <Dialog
      deschis={deschis}
      laInchidere={laInchidere}
      titlu={titlu}
      descriere={consecinta}
      marime="mic"
      subsol={
        <>
          <Buton varianta="secundar" onClick={laInchidere} disabled={inCurs === true}>
            Renunță
          </Buton>
          <Buton
            varianta={distructiv === true ? "distructiv" : "primar"}
            onClick={laConfirmare}
            disabled={blocat}
            inCurs={inCurs === true}
            textInCurs="Se execută…"
          >
            {etichetaConfirmare}
          </Buton>
        </>
      }
    >
      {cifre === undefined || cifre.length === 0 ? null : (
        <dl className="border-border divide-border rounded-panou divide-y border">
          {cifre.map((c) => (
            <div key={c.eticheta} className="flex items-baseline justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground text-corp">{c.eticheta}</dt>
              <dd className="text-foreground text-corp font-mono font-semibold tabular-nums">
                {c.valoare}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {cereTastare === undefined ? null : (
        <div className={cifre === undefined || cifre.length === 0 ? "" : "mt-4"}>
          <Camp
            nume="confirmare"
            eticheta={`Scrieți „${cereTastare}” ca să confirmați`}
            obligatoriu
          >
            {(a) => (
              <input
                {...a}
                type="text"
                autoComplete="off"
                value={tastat}
                onChange={(e) => setTastat(e.target.value)}
              />
            )}
          </Camp>
        </div>
      )}
    </Dialog>
  );
}

/**
 * Panoul lateral, pentru formularele care azi stau permanent deschise în flux.
 *
 * Sunt ~15 în aplicație; fișa echipamentului are PATRU simultan, unul cu 15
 * câmpuri. Efectul pe ecran: pagina e mai mult formular gol decât conținut, iar
 * secțiunile de dedesubt sunt împinse afară din prima privire.
 *
 * Panou, nu dialog, fiindcă multe dintre ele sunt lungi și au nevoie de
 * derulare proprie fără să acopere contextul din stânga.
 */
export function PanouLateral({
  deschis,
  laInchidere,
  titlu,
  descriere,
  children,
  subsol,
}: Omit<PropsDialog, "marime">): ReactElement {
  const ref = useRef<HTMLDialogElement | null>(null);
  const idTitlu = useId();

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (deschis && !el.open) el.showModal();
    if (!deschis && el.open) el.close();
  }, [deschis]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitlu}
      onCancel={(e) => {
        e.preventDefault();
        laInchidere();
      }}
      onClick={(e) => {
        if (e.target === ref.current) laInchidere();
      }}
      className={cn(
        "bg-background text-foreground shadow-plutitor border-border ms-auto me-0 h-dvh max-h-dvh w-full max-w-xl border-s p-0",
        "backdrop:bg-foreground/50",
        "flex flex-col",
      )}
    >
      <div className="border-border flex shrink-0 items-start justify-between gap-4 border-b p-4">
        <div className="min-w-0">
          <h2 id={idTitlu} className="text-sectiune font-semibold text-balance">
            {titlu}
          </h2>
          {descriere === undefined ? null : (
            <p className="text-muted-foreground text-corp mt-1 text-pretty">{descriere}</p>
          )}
        </div>
        <button
          type="button"
          onClick={laInchidere}
          aria-label="Închide"
          className="text-muted-foreground hover:bg-surface hover:text-foreground rounded-control -m-1 shrink-0 p-1 transition-colors"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

      {subsol === undefined ? null : (
        <div className="border-border bg-surface flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
          {subsol}
        </div>
      )}
    </dialog>
  );
}
