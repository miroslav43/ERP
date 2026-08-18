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
    <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={aproba}
          disabled={inCursAprobare || numarLiniiNeaprobate === 0}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          <CheckCheck aria-hidden="true" className="size-4" />
          {inCursAprobare
            ? "Se aprobă…"
            : `Aprobă în bloc (${String(numarLiniiNeaprobate)} linii)`}
        </button>
        {eroareAprobare === null ? null : (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {eroareAprobare}
          </p>
        )}
      </div>

      {poateSincroniza ? (
        <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Completează automat zilele de concediu aprobat lipsă din foaie, fără să atingă vreo
            zi introdusă manual.
          </p>
          <button
            type="button"
            onClick={sincronizeaza}
            disabled={inCursSincronizare}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {inCursSincronizare ? "Se sincronizează…" : "Sincronizează cu concediile aprobate"}
          </button>
          <div aria-live="polite">
            {eroareSincronizare !== null ? (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                {eroareSincronizare}
              </p>
            ) : rezultatSincronizare !== null ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{rezultatSincronizare}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
