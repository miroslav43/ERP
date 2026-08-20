// src/app/(app)/angajati/nou/_components/pas-4-fisa-postului.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import type { InroleazaAngajatInput } from "@/schemas/employee";
import { claseCamp, claseLabel } from "./campuri-comune";

export const CAMPURI_PAS_4 = [
  "subordonare",
  "atributii",
  "competente",
] as const satisfies readonly (keyof InroleazaAngajatInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
  readonly idFormular: string;
}

export function Pas4FisaPostului({ formular, idFormular }: Proprietati) {
  const { register } = formular;

  return (
    <fieldset className="border-border space-y-4 rounded-lg border p-4">
      <legend className="text-foreground px-1 text-sm font-medium">
        Fișa postului (opțională)
      </legend>
      <p className="text-muted-foreground text-sm">
        Dacă se completează, fișa postului se generează automat ca document, gata de semnat.
        Necompletată, se poate adăuga oricând ulterior de pe fișa angajatului.
      </p>

      <div>
        <label htmlFor={`${idFormular}-subordonare`} className={claseLabel}>
          Subordonare
        </label>
        <input
          id={`${idFormular}-subordonare`}
          {...register("subordonare")}
          placeholder="ex. Directorul de departament"
          className={claseCamp}
        />
      </div>

      <div>
        <label htmlFor={`${idFormular}-atributii`} className={claseLabel}>
          Atribuții (câte una pe linie)
        </label>
        <textarea
          id={`${idFormular}-atributii`}
          {...register("atributii")}
          rows={6}
          className={claseCamp}
        />
      </div>

      <div>
        <label htmlFor={`${idFormular}-competente`} className={claseLabel}>
          Competențe necesare (câte una pe linie)
        </label>
        <textarea
          id={`${idFormular}-competente`}
          {...register("competente")}
          rows={6}
          className={claseCamp}
        />
      </div>
    </fieldset>
  );
}
