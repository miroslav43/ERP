"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { aprobaPerioada, calculeazaPerioada, inchidePerioada, trimiteFluturasii } from "../actions";

interface Proprietati {
  readonly id: string;
  readonly status: string;
  readonly poateCalcula: boolean;
  readonly poateAproba: boolean;
  readonly poateExporta: boolean;
}

/**
 * Un singur buton vizibil per stare, ca să nu existe cale de a apăsa
 * „Aprobă” pe o ciornă necalculată — gardat oricum de trigger, dar butonul
 * ascuns evită round-trip-ul inutil și mesajul confuz.
 */
export function ActiuniPerioada({
  id,
  status,
  poateCalcula,
  poateAproba,
  poateExporta,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [raportTrimitere, setRaportTrimitere] = useState<string | null>(null);

  /**
   * Trimiterea fluturașilor nu folosește `ruleaza`: are un rezultat de raportat
   * — câți au plecat, câți n-au adresă, câți au eșuat. Un „gata” fără cifre ar
   * ascunde exact cazul care contează, cel al angajatului rămas fără fluturaș.
   */
  function trimite(): void {
    setEroare(null);
    setRaportTrimitere(null);
    porneste(async () => {
      const rezultat = await trimiteFluturasii({ id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      const { trimise, faraAdresa, esuate } = rezultat.data;
      const parti = [`${String(trimise)} trimise`];
      if (faraAdresa > 0) parti.push(`${String(faraAdresa)} fără adresă de e-mail`);
      if (esuate > 0) parti.push(`${String(esuate)} eșuate`);
      setRaportTrimitere(`Fluturași: ${parti.join(", ")}.`);
      router.refresh();
    });
  }

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

      {(status === "aprobat" || status === "inchis") && poateExporta ? (
        <button
          type="button"
          disabled={inCurs}
          onClick={trimite}
          className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inCurs ? "Se trimit…" : "Trimite fluturașii pe e-mail"}
        </button>
      ) : null}

      {raportTrimitere === null ? null : (
        <p aria-live="polite" className="text-muted-foreground w-full text-sm">
          {raportTrimitere}
        </p>
      )}

      {eroare === null ? null : (
        <p role="alert" className="text-danger w-full text-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
