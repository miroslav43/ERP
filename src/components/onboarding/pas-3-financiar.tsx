// src/components/onboarding/pas-3-financiar.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { FURNIZORI_TICHETE, type OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { cn } from "@/lib/ui/cn";

import { mesajeEroare } from "./campuri-comune";

export const CAMPURI_PAS_3 = [
  "banca_nume",
  "banca_iban",
  "plata_avans",
  "ziua_plata_avans",
  "ziua_plata_lichidare",
  "tichete_furnizor",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

const ETICHETE_TICHETE: Record<(typeof FURNIZORI_TICHETE)[number], string> = {
  edenred: "Edenred",
  pluxee: "Pluxee",
  up: "Up",
  sodexo: "Sodexo",
  altul: "Alt furnizor",
};

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function Pas3Financiar({ formular, idFormular }: Proprietati) {
  const {
    register,
    control,
    formState: { errors },
  } = formular;
  // `useWatch`, nu `formular.watch(…)` — vezi nota din `pas-1-identitate.tsx`:
  // pașii primesc props stabile, sunt memoizați de React Compiler și nu se
  // re-randează la schimbarea valorii, deci câmpul condiționat nu apărea.
  const seDaAvans = useWatch({ control, name: "plata_avans" });

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">
          Cont bancar principal
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="banca_nume"
            id={`${idFormular}-banca-nume`}
            eticheta="Banca"
            erori={mesajeEroare(errors.banca_nume?.message)}
          >
            {(a) => <input {...a} {...register("banca_nume")} placeholder="Banca Transilvania" />}
          </Camp>
          <Camp
            nume="banca_iban"
            id={`${idFormular}-banca-iban`}
            eticheta="IBAN"
            erori={mesajeEroare(errors.banca_iban?.message)}
          >
            {(a) => (
              <input
                {...a}
                // IBAN-ul e un identificator care se citește caracter cu
                // caracter și se compară cu un extras de cont: cifre de lățime
                // egală, ca 1 și 7 să nu se confunde.
                className={cn(a.className, "font-mono")}
                {...register("banca_iban")}
                placeholder="RO49AAAA1B31007593840000"
              />
            )}
          </Camp>
        </div>
        <p className="text-muted-foreground text-nota">
          Necesar pentru fișierul de plată a salariilor. Se pot adăuga alte conturi ulterior.
        </p>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">
          Program de plată a salariilor
        </legend>
        <div className="flex items-center gap-2">
          <input
            id={`${idFormular}-avans`}
            type="checkbox"
            {...register("plata_avans")}
            className={clasaBifa}
          />
          <label htmlFor={`${idFormular}-avans`} className="text-foreground text-corp">
            Se dă avans, separat de lichidare
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {seDaAvans && (
            <Camp
              nume="ziua_plata_avans"
              id={`${idFormular}-ziua-avans`}
              eticheta="Ziua din lună — avans"
              erori={mesajeEroare(errors.ziua_plata_avans?.message)}
            >
              {(a) => (
                <input {...a} type="number" min={1} max={31} {...register("ziua_plata_avans")} />
              )}
            </Camp>
          )}
          <Camp
            nume="ziua_plata_lichidare"
            id={`${idFormular}-ziua-lichidare`}
            eticheta="Ziua din lună — lichidare"
            erori={mesajeEroare(errors.ziua_plata_lichidare?.message)}
          >
            {(a) => (
              <input {...a} type="number" min={1} max={31} {...register("ziua_plata_lichidare")} />
            )}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Tichete de masă</legend>
        <Camp
          nume="tichete_furnizor"
          id={`${idFormular}-tichete`}
          eticheta="Furnizor"
          fel="select"
          ajutor="Valoarea per tichet se stabilește din setările de salarizare, după activarea modulului."
          erori={mesajeEroare(errors.tichete_furnizor?.message)}
        >
          {(a) => (
            <select {...a} {...register("tichete_furnizor")}>
              <option value="">— Fără tichete de masă —</option>
              {FURNIZORI_TICHETE.map((furnizor) => (
                <option key={furnizor} value={furnizor}>
                  {ETICHETE_TICHETE[furnizor]}
                </option>
              ))}
            </select>
          )}
        </Camp>
      </fieldset>
    </div>
  );
}
