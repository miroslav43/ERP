// src/app/(app)/concedii/setari/buton-aplica-drepturi.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { aplicaDrepturileConcediu } from "./actions";

export function ButonAplicaDrepturi({
  an,
  nrModificari,
}: {
  readonly an: number;
  readonly nrModificari: number;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [confirma, setConfirma] = useState(false);

  function aplica(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await aplicaDrepturileConcediu({ an });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        setConfirma(false);
        return;
      }
      setConfirma(false);
      router.refresh();
    });
  }

  if (!confirma) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Buton
          varianta="primar"
          onClick={() => {
            setConfirma(true);
          }}
        >
          Aplică pe angajați ({String(nrModificari)})
        </Buton>
      </div>
    );
  }

  return (
    <div className="border-warning/40 bg-warning/8 rounded-control flex flex-wrap items-center gap-3 border p-3">
      <p className="text-corp">
        Se scriu {String(nrModificari)} solduri pentru anul {String(an)}. Confirmați?
      </p>
      <Buton varianta="primar" inCurs={inCurs} textInCurs="Se aplică…" onClick={aplica}>
        Da, aplică
      </Buton>
      <Buton
        varianta="secundar"
        disabled={inCurs}
        onClick={() => {
          setConfirma(false);
        }}
      >
        Anulează
      </Buton>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp">
          {eroare}
        </p>
      )}
    </div>
  );
}
