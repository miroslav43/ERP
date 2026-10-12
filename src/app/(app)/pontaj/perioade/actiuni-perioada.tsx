"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, LockOpen, PlusCircle } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { ButonConfirmare } from "@/components/ui/buton-confirmare";
import { formatMonthYear } from "@/lib/format/date";
import type { StatusPerioada } from "@/schemas/attendance";
import { blocheazaPerioada, deschidePerioada, redeschidePerioada } from "../actions";

interface Proprietati {
  readonly an: number;
  readonly luna: number;
  readonly periodId: string | null;
  readonly status: StatusPerioada | null;
  readonly poateDeschide: boolean;
  readonly poateBloca: boolean;
  /**
   * Liniile perioadei încă neaprobate — cifra din caseta de blocare. Se
   * calculează la randare, deci poate fi veche cu câteva secunde: e un
   * avertisment, nu o poartă; acțiunea nu primește niciun flag de confirmare.
   */
  readonly liniiNeaprobate: number;
}

/** „3 linii rămân neaprobate” / „1 linie rămâne neaprobată”. */
function propozitiaNeaprobate(n: number): string {
  return n === 1
    ? "1 linie rămâne neaprobată și nu mai poate fi aprobată cât timp luna e blocată."
    : `${String(n)} linii rămân neaprobate și nu mai pot fi aprobate cât timp luna e blocată.`;
}

/**
 * Acțiunile unei luni de pontaj: deschidere, sau blocare/redeschidere pentru
 * o lună deja deschisă. „Blocarea perioadei ESTE aprobarea ei" — nu există o
 * stare separată „aprobată".
 *
 * Blocarea și redeschiderea trec printr-o casetă de confirmare (QA oct 2026:
 * ADM-033, FLX-009): blocarea îngheață pontajele ȘI aprobarea lor, iar o lună
 * blocată cu linii neaprobate le lasă pe acelea în aer — caseta spune câte.
 * „Deschide luna” rămâne directă: nu ia nimic nimănui.
 */
export function ActiuniPerioada({
  an,
  luna,
  periodId,
  status,
  poateDeschide,
  poateBloca,
  liniiNeaprobate,
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

  const eticheta = formatMonthYear(an, luna);
  const consecintaBlocarii = [
    "Pontajele lunii nu se mai pot modifica, nici aproba.",
    liniiNeaprobate > 0 ? propozitiaNeaprobate(liniiNeaprobate) : null,
    "Luna se poate redeschide de aici dacă e nevoie de corecții.",
  ]
    .filter((p) => p !== null)
    .join(" ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/pontaj/perioade/${periodId}`}
        className="text-corp underline-offset-2 hover:underline"
      >
        Detalii
      </Link>
      {poateBloca && status !== "blocata" ? (
        <ButonConfirmare
          eticheta="Blochează"
          pictograma={<Lock aria-hidden="true" className="size-4" />}
          titlu={`Blocați luna ${eticheta}?`}
          consecinta={consecintaBlocarii}
          cifre={[{ eticheta: "Linii neaprobate", valoare: String(liniiNeaprobate) }]}
          etichetaConfirmare="Blochează luna"
          executa={() => blocheazaPerioada({ id: periodId })}
          mesajReusita={`Luna ${eticheta} a fost blocată.`}
        />
      ) : null}
      {poateBloca && status === "blocata" ? (
        <ButonConfirmare
          eticheta="Redeschide"
          pictograma={<LockOpen aria-hidden="true" className="size-4" />}
          titlu={`Redeschideți luna ${eticheta}?`}
          // Salarizarea citește pontajul la CALCUL (`pontajAgregatPerioada`),
          // nu printr-un trigger: o corecție făcută după calcul nu ajunge în
          // stat decât printr-o recalculare cerută explicit.
          consecinta="Pontajele se pot modifica din nou. Dacă statul de plată al lunii a fost deja calculat, el nu se recalculează singur."
          etichetaConfirmare="Redeschide luna"
          executa={() => redeschidePerioada({ id: periodId })}
          mesajReusita={`Luna ${eticheta} a fost redeschisă.`}
        />
      ) : null}
    </div>
  );
}
