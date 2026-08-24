// src/components/ui/formular.tsx
"use client";

import { useActionState, useEffect, useRef, type ReactElement, type ReactNode } from "react";

import type { ActionResult } from "@/lib/actions/types";
import { cn } from "@/lib/ui/cn";

import { Callout } from "./callout";
import { arataToast } from "./toast";

/**
 * Învelișul unui formular. Desface `ActionResult` o singură dată și predă
 * fiecărui câmp exact erorile lui.
 *
 * ── PROBLEMA PE CARE O REZOLVĂ ────────────────────────────────────────────
 * Serverul construiește deja `fieldErrors` la FIECARE acțiune
 * (`create-action.ts`, pasul 5: `z.flattenError` → hartă câmp → mesaje). Din
 * cele ~99 de formulare ale aplicației, aproximativ 7 le citesc. Restul afișează
 * un singur `<p>` roșu la baza formularului.
 *
 * Cazul cel mai limpede: `schemaParolaNoua` produce „Parolele nu coincid." pe
 * câmpul `confirma_parola`, iar utilizatorul citea sub buton „Datele introduse
 * nu sunt valide." — mesajul exact exista și se arunca.
 *
 * ── DE CE `useActionState` ȘI NU `useTransition` ──────────────────────────
 * Cu `<form action={fn}>` și câmpuri necontrolate, React 19 RESETEAZĂ
 * formularul după ce acțiunea se încheie. Pe o eroare de validare, asta
 * înseamnă că omul pierde tot ce a scris fiindcă a greșit un cod COR — defect
 * real, observat azi în nomenclatoare, exact în fișierele care foloseau
 * tiparul „corect".
 *
 * `useActionState` păstrează starea întoarsă între randări, iar `valoriTrimise`
 * de mai jos le dă înapoi copiilor ca `defaultValue`. Formularul își reia forma
 * exactă în care a fost trimis.
 *
 * ── PRECEDENȚA ERORILOR ───────────────────────────────────────────────────
 * Un câmp poate avea două surse de eroare: serverul (`fieldErrors`) și
 * validarea de client (react-hook-form, în 17 fișiere). Regula, scrisă o dată
 * aici: **eroarea de server o suprascrie pe cea de client până la următoarea
 * tastă.** Serverul a văzut datele întregi și baza; clientul a văzut un câmp.
 */
export type StareFormular<TData> = Readonly<{
  inCurs: boolean;
  /** Erorile pe câmp, exact cum le-a trimis serverul. */
  erori: Readonly<Record<string, readonly string[]>>;
  /** Mesajul de nivel de formular, când eroarea nu aparține unui câmp anume. */
  eroareGenerala: string | null;
  /** Ce s-a trimis ultima dată, pentru `defaultValue` — vezi comentariul de sus. */
  valoriTrimise: Readonly<Record<string, string>>;
  data: TData | null;
}>;

type StareInterna<TData> = Readonly<{
  rezultat: ActionResult<TData> | null;
  valori: Readonly<Record<string, string>>;
}>;

export type PropsFormular<TData> = Readonly<{
  actiune: (date: FormData) => Promise<ActionResult<TData>>;
  laReusita?: (data: TData) => void;
  /** Textul notificării de confirmare. Fără el, nu apare nicio notificare. */
  mesajReusita?: string;
  className?: string;
  children: (stare: StareFormular<TData>) => ReactNode;
}>;

export function Formular<TData>({
  actiune,
  laReusita,
  mesajReusita,
  className,
  children,
}: PropsFormular<TData>): ReactElement {
  const ref = useRef<HTMLFormElement | null>(null);

  const [stare, trimite, inCurs] = useActionState<StareInterna<TData>, FormData>(
    async (_precedent, date) => {
      // Valorile se citesc ÎNAINTE de `await`: după el, React poate să fi
      // resetat deja formularul, iar `FormData` ar fi golit.
      const valori: Record<string, string> = {};
      for (const [cheie, valoare] of date.entries()) {
        if (typeof valoare === "string") valori[cheie] = valoare;
      }
      const rezultat = await actiune(date);
      return { rezultat, valori };
    },
    { rezultat: null, valori: {} },
  );

  const rezultat = stare.rezultat;

  useEffect(() => {
    if (rezultat === null || !rezultat.ok) return;
    if (mesajReusita !== undefined) arataToast({ fel: "reusita", text: mesajReusita });
    laReusita?.(rezultat.data);
    // `rezultat` e stabil între randări cât timp acțiunea nu s-a mai executat.
  }, [rezultat, mesajReusita, laReusita]);

  const erori = rezultat !== null && !rezultat.ok ? (rezultat.error.fieldErrors ?? {}) : {};

  // Mesajul general apare DOAR dacă nu e deja pe un câmp. Altfel omul citește
  // aceeași propoziție de două ori, o dată lângă câmp și o dată sub buton.
  const eroareGenerala =
    rezultat !== null && !rezultat.ok && Object.keys(erori).length === 0
      ? rezultat.error.message
      : null;

  // Focusul merge pe primul câmp invalid. Fără asta, pe un formular de 30 de
  // câmpuri mesajul poate fi sub linia de plutire, iar ecranul pare inert.
  useEffect(() => {
    const primul = Object.keys(erori)[0];
    if (primul === undefined || ref.current === null) return;
    const el = ref.current.querySelector<HTMLElement>(`[name="${CSS.escape(primul)}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Se declanșează la fiecare rezultat nou, nu la fiecare randare.
  }, [rezultat]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      ref={ref}
      action={trimite}
      // `noValidate`: validarea nativă a browserului afișează bule în engleză,
      // cu texte pe care nu le controlăm, și oprește trimiterea înainte ca Zod
      // să apuce să spună ceva mai bun în română.
      noValidate
      className={cn("flex flex-col gap-4", className)}
    >
      {eroareGenerala === null ? null : <Callout fel="eroare">{eroareGenerala}</Callout>}
      {children({
        inCurs,
        erori,
        eroareGenerala,
        valoriTrimise: stare.valori,
        data: rezultat !== null && rezultat.ok ? rezultat.data : null,
      })}
    </form>
  );
}
