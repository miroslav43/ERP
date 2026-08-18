"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, LockOpen, PlusCircle } from "lucide-react";

import type { StatusPerioada } from "@/schemas/attendance";
import { blocheazaPerioada, deschidePerioada, redeschidePerioada } from "../actions";

interface Proprietati {
  readonly an: number;
  readonly luna: number;
  readonly periodId: string | null;
  readonly status: StatusPerioada | null;
  readonly poateDeschide: boolean;
  readonly poateBloca: boolean;
}

/**
 * Acțiunile unei luni de pontaj: deschidere, sau blocare/redeschidere pentru
 * o lună deja deschisă. „Blocarea perioadei ESTE aprobarea ei" — nu există o
 * stare separată „aprobată".
 */
export function ActiuniPerioada({ an, luna, periodId, status, poateDeschide, poateBloca }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function deschide(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await deschidePerioada({ an, luna, observatii: null });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function blocheaza(): void {
    if (periodId === null) return;
    setEroare(null);
    porneste(async () => {
      const rezultat = await blocheazaPerioada({ id: periodId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function redeschide(): void {
    if (periodId === null) return;
    setEroare(null);
    porneste(async () => {
      const rezultat = await redeschidePerioada({ id: periodId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (periodId === null) {
    if (!poateDeschide) return <span className="text-xs text-zinc-500">—</span>;
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={deschide}
          disabled={inCurs}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <PlusCircle aria-hidden="true" className="size-4" />
          {inCurs ? "Se deschide…" : "Deschide luna"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="max-w-xs text-xs text-rose-700 dark:text-rose-300">
            {eroare}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/pontaj/perioade/${periodId}`}
        className="text-sm underline-offset-2 hover:underline"
      >
        Detalii
      </Link>
      {poateBloca && status !== "blocata" ? (
        <button
          type="button"
          onClick={blocheaza}
          disabled={inCurs}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <Lock aria-hidden="true" className="size-4" />
          {inCurs ? "Se blochează…" : "Blochează"}
        </button>
      ) : null}
      {poateBloca && status === "blocata" ? (
        <button
          type="button"
          onClick={redeschide}
          disabled={inCurs}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <LockOpen aria-hidden="true" className="size-4" />
          {inCurs ? "Se redeschide…" : "Redeschide"}
        </button>
      ) : null}
      {eroare === null ? null : (
        <p role="alert" className="w-full text-xs text-rose-700 dark:text-rose-300">
          {eroare}
        </p>
      )}
    </div>
  );
}
