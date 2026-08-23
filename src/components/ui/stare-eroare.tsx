// src/components/ui/stare-eroare.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { Buton, buton } from "./buton";

/**
 * Ecranul de eroare al unei rute, într-un singur exemplar. Înlocuiește trei
 * implementări concurente: `StareEroare` (11 fișiere), `ErrorState` (cod mort,
 * zero importuri) și 39 de copii manuale, octet cu octet, prin `error.tsx`-uri.
 *
 * ── DE CE BUTONUL FACE DOUĂ LUCRURI ───────────────────────────────────────
 * `error.tsx` primește de la Next un `reset()`. Singur, el doar reîncarcă
 * limita de eroare — dar dacă eroarea a venit dintr-o citire de pe server,
 * rezultatul cache-uit e tot cel stricat, deci ecranul se reface identic și
 * butonul „Reîncearcă” pare mut. De aceea aici se cheamă întâi
 * `router.refresh()`, care aruncă rezultatul de pe server, și abia apoi
 * `reset()`.
 *
 * Cele 11 fișiere „corecte” trimiteau `reset` direct și aveau exact acest
 * defect; cele 39 de copii „proaste” își scriau propriul handler care făcea
 * ambele lucruri și funcționau. Consolidarea păstrează comportamentul copiilor,
 * nu pe cel al originalului.
 *
 * ── DE CE CODUL DE INCIDENT E VIZIBIL ─────────────────────────────────────
 * `digest` e singura punte între ce a văzut omul și ce s-a scris în jurnalul
 * serverului. Fără el, un raport de problemă începe cu „nu mergea nimic”.
 */
export type PropsStareEroare = Readonly<{
  titlu?: string;
  descriere?: string;
  eroare: Error & { digest?: string };
  /** `reset` primit de `error.tsx` de la Next. */
  reset: () => void;
  /** O ieșire în plus, când reîncercarea probabil nu ajută. */
  inapoi?: Readonly<{ eticheta: string; href: string }>;
  className?: string;
}>;

export function StareEroare({
  titlu = "Nu am putut încărca datele",
  descriere = "A apărut o eroare de rețea sau de server. Încercați din nou; dacă se repetă, transmiteți codul de mai jos.",
  eroare,
  reset,
  inapoi,
  className,
}: PropsStareEroare): ReactElement {
  const router = useRouter();

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
        <Buton
          varianta="primar"
          onClick={() => {
            router.refresh();
            reset();
          }}
        >
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
        reset={() => this.setState({ eroare: null })}
        {...(this.props.titlu === undefined ? {} : { titlu: this.props.titlu })}
        {...(this.props.descriere === undefined ? {} : { descriere: this.props.descriere })}
      />
    );
  }
}
