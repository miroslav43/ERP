// src/app/(app)/angajati/nou/_components/pas-4-fisa-postului.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import { Camp } from "@/components/ui/camp";
import type { InroleazaAngajatInput } from "@/schemas/employee";
import { mesajCamp } from "./erori-formular";

export const CAMPURI_PAS_4 = [
  "subordonare",
  "atributii",
  "competente",
] as const satisfies readonly (keyof InroleazaAngajatInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
}

export function Pas4FisaPostului({ formular }: Proprietati) {
  const {
    register,
    formState: { errors },
  } = formular;

  return (
    <fieldset className="border-border rounded-panou space-y-4 border p-4">
      <legend className="text-foreground text-corp px-1 font-medium">
        Fișa postului (opțională)
      </legend>
      <p className="text-muted-foreground text-corp">
        Dacă se completează, fișa postului se generează automat ca document, gata de semnat.
        Necompletată, se poate adăuga oricând ulterior de pe fișa angajatului.
      </p>

      <Camp nume="subordonare" eticheta="Subordonare" erori={mesajCamp(errors.subordonare)}>
        {(atribute) => (
          <input
            {...atribute}
            {...register("subordonare")}
            placeholder="ex. Directorul de departament"
          />
        )}
      </Camp>

      <Camp
        nume="atributii"
        eticheta="Atribuții (câte una pe linie)"
        fel="textarea"
        erori={mesajCamp(errors.atributii)}
      >
        {(atribute) => <textarea {...atribute} {...register("atributii")} rows={6} />}
      </Camp>

      <Camp
        nume="competente"
        eticheta="Competențe necesare (câte una pe linie)"
        fel="textarea"
        erori={mesajCamp(errors.competente)}
      >
        {(atribute) => <textarea {...atribute} {...register("competente")} rows={6} />}
      </Camp>
    </fieldset>
  );
}
