"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format/date";

import { confirmaSemnaturaInstruire } from "../actions";

/**
 * Celula matricei de instruiri, cu previzualizare la deschidere.
 *
 * Celula arăta doar starea și data; detaliile instruirii (durata, scadența,
 * semnătura) nu se vedeau nicăieri în aplicație, iar portalul îi spunea
 * angajatului „semnătura nu a fost înregistrată, verificați cu responsabilul
 * SSM” fără ca responsabilul să aibă vreo acțiune care s-o înregistreze
 * (analiza 2026-10-08, ssm-L19/P12). `<details>`, nu `popover`: foaia UA pune
 * `inset:0` + `fit-content` pe popover, iar un `<details>` se deschide la
 * tastatură fără nimic de suprascris.
 */
export function CelulaInstruire({
  instruire,
  poateConfirma,
  children,
}: Readonly<{
  instruire: Readonly<{
    id: string;
    data_instruirii: string;
    durata_ore: number;
    urmatoarea_scadenta: string | null;
    semnatura_confirmata: boolean;
  }>;
  /** `ssm:update ≥ team`: butonul „Confirmă semnătura”. */
  poateConfirma: boolean;
  /** Insigna de stare, randată de pagină (server). */
  children: ReactNode;
}>): ReactElement {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await confirmaSemnaturaInstruire({ id: instruire.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      arataToast({ fel: "reusita", text: "Semnătura de confirmare a fost înregistrată." });
      router.refresh();
    });
  }

  return (
    <details className="group relative inline-block">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xs [&::-webkit-details-marker]:hidden">
        {children}
        <span className="text-muted-foreground text-nota">
          {formatDate(instruire.data_instruirii)}
        </span>
      </summary>
      <div className="border-border bg-surface rounded-panou shadow-ridicat absolute left-0 z-20 mt-1 w-64 space-y-2 border p-3 text-left whitespace-normal">
        <dl className="text-nota space-y-1">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Efectuată</dt>
            <dd>{formatDate(instruire.data_instruirii)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Durata</dt>
            <dd>{instruire.durata_ore} h</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Următoarea</dt>
            <dd>
              {instruire.urmatoarea_scadenta === null
                ? "—"
                : formatDate(instruire.urmatoarea_scadenta)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Semnătura</dt>
            <dd>{instruire.semnatura_confirmata ? "confirmată" : "neconfirmată"}</dd>
          </div>
        </dl>
        {!instruire.semnatura_confirmata && poateConfirma ? (
          <Buton
            varianta="secundar"
            disabled={inCurs}
            onClick={confirma}
            inCurs={inCurs}
            textInCurs="Se confirmă…"
          >
            Confirmă semnătura
          </Buton>
        ) : null}
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-nota">
            {eroare}
          </p>
        )}
      </div>
    </details>
  );
}
