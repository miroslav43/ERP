"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, RefreshCw } from "lucide-react";

import { Buton } from "@/components/ui/buton";

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
    <div className="border-border rounded-panou space-y-4 border p-4">
      <div className="space-y-2">
        <label htmlFor={idObservatii} className="text-corp block font-medium">
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
          className="border-foreground/60 rounded-control text-corp w-full border px-3 py-2"
        />
        <Buton
          varianta="primar"
          onClick={aproba}
          disabled={numarLiniiNeaprobate === 0}
          inCurs={inCursAprobare}
          textInCurs="Se aprobă…"
        >
          <CheckCheck aria-hidden="true" className="size-4" />
          {`Aprobă în bloc (${String(numarLiniiNeaprobate)} linii)`}
        </Buton>
        {eroareAprobare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroareAprobare}
          </p>
        )}
      </div>

      {poateSincroniza ? (
        <div className="border-border space-y-2 border-t pt-4">
          <p className="text-muted-foreground text-corp">
            Completează automat zilele de concediu aprobat lipsă din foaie, fără să atingă vreo zi
            introdusă manual.
          </p>
          <Buton
            varianta="secundar"
            onClick={sincronizeaza}
            inCurs={inCursSincronizare}
            textInCurs="Se sincronizează…"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Sincronizează cu concediile aprobate
          </Buton>
          <div aria-live="polite">
            {eroareSincronizare !== null ? (
              <p role="alert" className="text-danger text-corp">
                {eroareSincronizare}
              </p>
            ) : rezultatSincronizare !== null ? (
              <p className="text-muted-foreground text-corp">{rezultatSincronizare}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
