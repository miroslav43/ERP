"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { confirmaAnomalie } from "../actions";

/**
 * Confirmarea unei anomalii — o explicație, nu o corecție.
 *
 * Cifrele constatate rămân neatinse: `internal.anomalii_protejeaza` respinge
 * modificarea lor. Se scrie doar nota și momentul confirmării.
 */
export function ConfirmaAnomalie({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idNota = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    const nota = String(formular.get("nota") ?? "").trim();
    porneste(async () => {
      const rezultat = await confirmaAnomalie({ id, nota: nota.length > 0 ? nota : null });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={trimite} className="flex flex-wrap items-center gap-2">
      <label htmlFor={idNota} className="sr-only">
        Explicația diferenței de kilometraj
      </label>
      <input
        id={idNota}
        name="nota"
        type="text"
        maxLength={500}
        placeholder="Ex. cursă necompletată pe 14 septembrie"
        className="border-foreground/60 rounded-control text-corp min-w-40 flex-1 border px-3 py-1.5"
      />
      <Buton type="submit" varianta="secundar" inCurs={inCurs} textInCurs="Se salvează…">
        Confirmă
      </Buton>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota w-full">
          {eroare}
        </p>
      )}
    </form>
  );
}
