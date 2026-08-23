"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
        <Buton
          varianta="primar"
          inCurs={inCurs}
          textInCurs="Se calculează…"
          onClick={() => {
            ruleaza(() => calculeazaPerioada({ id }));
          }}
        >
          Calculează
        </Buton>
      ) : null}

      {status === "calculat" && poateCalcula ? (
        <Buton
          varianta="secundar"
          inCurs={inCurs}
          textInCurs="Se recalculează…"
          onClick={() => {
            ruleaza(() => calculeazaPerioada({ id }));
          }}
        >
          Recalculează
        </Buton>
      ) : null}

      {status === "calculat" && poateAproba ? (
        <Buton
          varianta="primar"
          inCurs={inCurs}
          textInCurs="Se aprobă…"
          onClick={() => {
            ruleaza(() => aprobaPerioada({ id }));
          }}
        >
          Aprobă
        </Buton>
      ) : null}

      {status === "aprobat" && poateAproba ? (
        <Buton
          varianta="secundar"
          inCurs={inCurs}
          textInCurs="Se închide…"
          onClick={() => {
            ruleaza(() => inchidePerioada({ id }));
          }}
        >
          Închide perioada
        </Buton>
      ) : null}

      {(status === "aprobat" || status === "inchis") && poateExporta ? (
        <Buton varianta="secundar" inCurs={inCurs} textInCurs="Se trimit…" onClick={trimite}>
          Trimite fluturașii pe e-mail
        </Buton>
      ) : null}

      {raportTrimitere === null ? null : (
        <p aria-live="polite" className="text-muted-foreground text-corp w-full">
          {raportTrimitere}
        </p>
      )}

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp w-full">
          {eroare}
        </p>
      )}
    </div>
  );
}
