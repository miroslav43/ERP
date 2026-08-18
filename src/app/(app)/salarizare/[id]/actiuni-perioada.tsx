"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { aprobaPerioada, calculeazaPerioada, inchidePerioada } from "../actions";

interface Proprietati {
  readonly id: string;
  readonly status: string;
  readonly poateCalcula: boolean;
  readonly poateAproba: boolean;
}

/**
 * Un singur buton vizibil per stare, ca să nu existe cale de a apăsa
 * „Aprobă” pe o ciornă necalculată — gardat oricum de trigger, dar butonul
 * ascuns evită round-trip-ul inutil și mesajul confuz.
 */
export function ActiuniPerioada({ id, status, poateCalcula, poateAproba }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function ruleaza(actiune: () => Promise<{ ok: boolean; error?: { message: string } }>): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await actiune();
      if (!rezultat.ok) {
        setEroare(rezultat.error?.message ?? "A apărut o eroare.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "draft" && poateCalcula ? (
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            ruleaza(() => calculeazaPerioada({ id }));
          }}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se calculează…" : "Calculează"}
        </button>
      ) : null}

      {status === "calculat" && poateCalcula ? (
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            ruleaza(() => calculeazaPerioada({ id }));
          }}
          className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inCurs ? "Se recalculează…" : "Recalculează"}
        </button>
      ) : null}

      {status === "calculat" && poateAproba ? (
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            ruleaza(() => aprobaPerioada({ id }));
          }}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se aprobă…" : "Aprobă"}
        </button>
      ) : null}

      {status === "aprobat" && poateAproba ? (
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            ruleaza(() => inchidePerioada({ id }));
          }}
          className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inCurs ? "Se închide…" : "Închide perioada"}
        </button>
      ) : null}

      {eroare === null ? null : (
        <p role="alert" className="text-danger w-full text-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
