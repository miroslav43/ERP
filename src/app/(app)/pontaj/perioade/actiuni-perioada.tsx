"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, LockOpen, PlusCircle } from "lucide-react";

import { Buton } from "@/components/ui/buton";
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
export function ActiuniPerioada({
  an,
  luna,
  periodId,
  status,
  poateDeschide,
  poateBloca,
}: Proprietati) {
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
    if (!poateDeschide) return <span className="text-muted-foreground text-nota">—</span>;
    return (
      <div className="space-y-1">
        <Buton varianta="secundar" onClick={deschide} inCurs={inCurs} textInCurs="Se deschide…">
          <PlusCircle aria-hidden="true" className="size-4" />
          Deschide luna
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-nota max-w-xs">
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
        className="text-corp underline-offset-2 hover:underline"
      >
        Detalii
      </Link>
      {poateBloca && status !== "blocata" ? (
        <Buton varianta="secundar" onClick={blocheaza} inCurs={inCurs} textInCurs="Se blochează…">
          <Lock aria-hidden="true" className="size-4" />
          Blochează
        </Buton>
      ) : null}
      {poateBloca && status === "blocata" ? (
        <Buton varianta="secundar" onClick={redeschide} inCurs={inCurs} textInCurs="Se redeschide…">
          <LockOpen aria-hidden="true" className="size-4" />
          Redeschide
        </Buton>
      ) : null}
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota w-full">
          {eroare}
        </p>
      )}
    </div>
  );
}
