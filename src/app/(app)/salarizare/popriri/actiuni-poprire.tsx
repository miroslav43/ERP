// src/app/(app)/salarizare/popriri/actiuni-poprire.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { inchidePoprire } from "./actions";

export function ActiuniPoprire({ id, activa }: { readonly id: string; readonly activa: boolean }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function comuta(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await inchidePoprire({ id, activa: !activa });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Buton varianta="secundar" onClick={comuta} inCurs={inCurs} textInCurs="Se salvează…">
        {activa ? "Închide dosarul" : "Redeschide dosarul"}
      </Buton>
      {eroare !== null ? (
        <p role="alert" className="text-danger text-corp">
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
