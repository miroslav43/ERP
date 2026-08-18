"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, RefreshCw } from "lucide-react";

import { aprobaPontajBloc, sincronizeazaConcediile } from "../actions";

interface Proprietati {
  readonly periodId: string;
  readonly departmentId: string | null;
  readonly numarLiniiNeaprobate: number;
  readonly an: number;
  readonly luna: number;
  readonly poateSincroniza: boolean;
}

/**
 * Aprobarea în bloc a liniilor de pontaj neaprobate ale lunii (opțional
 * restrânsă la un departament), plus — separat — sincronizarea cu concediile
 * aprobate. Ambele acțiuni sunt independente: sincronizarea NU aprobă nimic,
 * doar completează zilele de concediu lipsă din foaie.
 */
export function AprobareBloc({
  periodId,
  departmentId,
  numarLiniiNeaprobate,
  an,
  luna,
  poateSincroniza,
}: Proprietati) {
  const router = useRouter();
  const [observatii, setObservatii] = useState("");
  const [inCursAprobare, pornesteAprobare] = useTransition();
  const [inCursSincronizare, pornesteSincronizare] = useTransition();
  const [eroareAprobare, setEroareAprobare] = useState<string | null>(null);
  const [eroareSincronizare, setEroareSincronizare] = useState<string | null>(null);
  const [rezultatSincronizare, setRezultatSincronizare] = useState<string | null>(null);
  const idObservatii = useId();

  function aproba(): void {
    setEroareAprobare(null);
    pornesteAprobare(async () => {
      const rezultat = await aprobaPontajBloc({
        period_id: periodId,
        department_id: departmentId,
        observatii: observatii.trim().length === 0 ? null : observatii.trim(),
      });
      if (!rezultat.ok) {
        setEroareAprobare(rezultat.error.message);
        return;
      }
      setObservatii("");
      router.refresh();
    });
  }

  function sincronizeaza(): void {
    setEroareSincronizare(null);
    setRezultatSincronizare(null);
    pornesteSincronizare(async () => {
      const rezultat = await sincronizeazaConcediile({ an, luna });
      if (!rezultat.ok) {
        setEroareSincronizare(rezultat.error.message);
        return;
      }
      setRezultatSincronizare(
        `${String(rezultat.data.create)} zile noi, ${String(rezultat.data.actualizate)} actualizate, ${String(rezultat.data.pastrate)} păstrate neschimbate.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <label htmlFor={idObservatii} className="block text-sm font-medium">
          Observații lot (opțional)
        </label>
        <textarea
          id={idObservatii}
          rows={2}
          maxLength={1000}
          value={observatii}
          onChange={(e) => {
            setObservatii(e.target.value);
          }}
          className="w-full rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={aproba}
          disabled={inCursAprobare || numarLiniiNeaprobate === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          <CheckCheck aria-hidden="true" className="size-4" />
          {inCursAprobare
            ? "Se aprobă…"
            : `Aprobă în bloc (${String(numarLiniiNeaprobate)} linii)`}
        </button>
        {eroareAprobare === null ? null : (
          <p role="alert" className="text-sm text-danger">
            {eroareAprobare}
          </p>
        )}
      </div>

      {poateSincroniza ? (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Completează automat zilele de concediu aprobat lipsă din foaie, fără să atingă vreo
            zi introdusă manual.
          </p>
          <button
            type="button"
            onClick={sincronizeaza}
            disabled={inCursSincronizare}
            className="inline-flex items-center gap-2 rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {inCursSincronizare ? "Se sincronizează…" : "Sincronizează cu concediile aprobate"}
          </button>
          <div aria-live="polite">
            {eroareSincronizare !== null ? (
              <p role="alert" className="text-sm text-danger">
                {eroareSincronizare}
              </p>
            ) : rezultatSincronizare !== null ? (
              <p className="text-sm text-muted-foreground">{rezultatSincronizare}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
