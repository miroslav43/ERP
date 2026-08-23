// src/components/ui/stare-eroare.tsx
"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { Buton, buton } from "./buton";

/**
 * Ecranul de eroare al unei rute, într-un singur exemplar. Înlocuiește trei
 * implementări concurente: `StareEroare` (11 fișiere), `ErrorState` (cod mort,
 * zero importuri) și 39 de copii manuale, octet cu octet, prin `error.tsx`-uri.
 *
 * ── DE CE `retry`, NU `reset` ─────────────────────────────────────────────
 * Next 16.3 dă lui `error.tsx` DOUĂ funcții, iar diferența dintre ele e chiar
 * miza butonului. Citat din `node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/error.md`:
 *
 *   `retry` — „will try to RE-FETCH and re-render the error boundary's children”
 *   `reset` — „In most cases, you should use retry() instead. However, if you
 *              have a specific reason to clear the error state and re-render the
 *              error boundary's children WITHOUT RE-FETCHING…”
 *
 * Aproape toate erorile din produs vin dintr-o citire de pe server care a
 * eșuat. `reset()` singur reface exact aceleași date stricate, deci butonul
 * pare mut. Componenta asta compensa chemând `router.refresh()` înainte de
 * `reset()` — adică rescria de mână ce face `retry()`, stabil din v16.3.0
 * (`error.md:331`).
 *
 * Prop-ul se numește acum `reincearca` și nu mai presupune de unde vine:
 * `error.tsx` îi dă `retry`-ul lui Next, iar `LimitaEroare` de mai jos — o
 * limită de eroare de CLIENT, unde n-are ce reîncărca de pe server — îi dă
 * propria golire de stare. Fiecare apelant știe ce înseamnă „încă o dată" la el.
 *
 * ── DE CE CODUL DE INCIDENT E VIZIBIL ─────────────────────────────────────
 * `digest` e singura punte între ce a văzut omul și ce s-a scris în jurnalul
 * serverului. Fără el, un raport de problemă începe cu „nu mergea nimic”.
 */
export type PropsStareEroare = Readonly<{
  titlu?: string;
  descriere?: string;
  eroare: Error & { digest?: string };
  /**
   * Ce înseamnă „încă o dată" pentru apelant: `retry`-ul lui Next în
   * `error.tsx`, golirea de stare într-o limită de eroare de client.
   */
  reincearca: () => void;
  /** O ieșire în plus, când reîncercarea probabil nu ajută. */
  inapoi?: Readonly<{ eticheta: string; href: string }>;
  className?: string;
}>;

export function StareEroare({
  titlu = "Nu am putut încărca datele",
  descriere = "A apărut o eroare de rețea sau de server. Încercați din nou; dacă se repetă, transmiteți codul de mai jos.",
  eroare,
  reincearca,
  inapoi,
  className,
}: PropsStareEroare): ReactElement {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn("border-danger/40 bg-danger/8 rounded-panou border p-6 text-center", className)}
    >
      <AlertTriangle aria-hidden="true" className="text-danger mx-auto mb-3 size-7" />
      <p className="text-foreground text-sectiune font-semibold">{titlu}</p>
      <p className="text-muted-foreground text-corp mx-auto mt-1 max-w-prose text-pretty">
        {descriere}
      </p>
      <p className="text-muted-foreground text-nota mt-3 font-mono">
        Cod incident: {eroare.digest ?? "indisponibil"}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Buton varianta="primar" onClick={reincearca}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Reîncearcă
        </Buton>
        {inapoi === undefined ? null : (
          <Link href={inapoi.href} className={buton({ varianta: "secundar" })}>
            {inapoi.eticheta}
          </Link>
        )}
      </div>
    </div>
  );
}

type PropsLimita = Readonly<{ children: ReactNode; titlu?: string; descriere?: string }>;
type StareLimita = Readonly<{ eroare: Error | null }>;

/**
 * Limită de eroare pentru o SECȚIUNE, nu pentru o rută.
 *
 * `error.tsx` prinde doar căderea întregii pagini. Panoul principal e compus
 * din opt surse independente, iar una care cade nu are de ce să le doboare pe
 * celelalte șapte: mai bine o secțiune cu „nu s-a putut încărca” decât un ecran
 * gol în locul cozii de lucru.
 */
export class LimitaEroare extends Component<PropsLimita, StareLimita> {
  override state: StareLimita = { eroare: null };

  static getDerivedStateFromError(eroare: Error): StareLimita {
    return { eroare };
  }

  override componentDidCatch(eroare: Error, info: ErrorInfo): void {
    console.error("[ui] eroare de randare", eroare.message, info.componentStack);
  }

  override render(): ReactNode {
    const { eroare } = this.state;
    if (eroare === null) return this.props.children;
    return (
      <StareEroare
        eroare={eroare}
        reincearca={() => this.setState({ eroare: null })}
        {...(this.props.titlu === undefined ? {} : { titlu: this.props.titlu })}
        {...(this.props.descriere === undefined ? {} : { descriere: this.props.descriere })}
      />
    );
  }
}
