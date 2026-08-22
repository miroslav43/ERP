// src/app/(platform)/super-admin/organizatii/nou/_components/pas-3-financiar.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { FURNIZORI_TICHETE, type OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

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
      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Cont bancar principal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-banca-nume`} className={claseLabel}>
              Banca
            </label>
            <input
              id={`${idFormular}-banca-nume`}
              {...register("banca_nume")}
              placeholder="Banca Transilvania"
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-banca-iban`} className={claseLabel}>
              IBAN
            </label>
            <input
              id={`${idFormular}-banca-iban`}
              {...register("banca_iban")}
              placeholder="RO49AAAA1B31007593840000"
              aria-invalid={Boolean(errors.banca_iban)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-banca-iban-eroare`} mesaj={errors.banca_iban?.message} />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Necesar pentru fișierul de plată a salariilor. Se pot adăuga alte conturi ulterior.
        </p>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">
          Program de plată a salariilor
        </legend>
        <div className="flex items-center gap-2">
          <input
            id={`${idFormular}-avans`}
            type="checkbox"
            {...register("plata_avans")}
            className="border-border size-4 rounded"
          />
          <label htmlFor={`${idFormular}-avans`} className="text-foreground text-sm">
            Se dă avans, separat de lichidare
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {seDaAvans && (
            <div>
              <label htmlFor={`${idFormular}-ziua-avans`} className={claseLabel}>
                Ziua din lună — avans
              </label>
              <input
                id={`${idFormular}-ziua-avans`}
                type="number"
                min={1}
                max={31}
                {...register("ziua_plata_avans")}
                aria-invalid={Boolean(errors.ziua_plata_avans)}
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-ziua-avans-eroare`}
                mesaj={errors.ziua_plata_avans?.message}
              />
            </div>
          )}
          <div>
            <label htmlFor={`${idFormular}-ziua-lichidare`} className={claseLabel}>
              Ziua din lună — lichidare
            </label>
            <input
              id={`${idFormular}-ziua-lichidare`}
              type="number"
              min={1}
              max={31}
              {...register("ziua_plata_lichidare")}
              aria-invalid={Boolean(errors.ziua_plata_lichidare)}
              className={claseCamp}
            />
            <Eroare
              id={`${idFormular}-ziua-lichidare-eroare`}
              mesaj={errors.ziua_plata_lichidare?.message}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Tichete de masă</legend>
        <div>
          <label htmlFor={`${idFormular}-tichete`} className={claseLabel}>
            Furnizor
          </label>
          <select
            id={`${idFormular}-tichete`}
            {...register("tichete_furnizor")}
            className={claseCamp}
          >
            <option value="">— Fără tichete de masă —</option>
            {FURNIZORI_TICHETE.map((furnizor) => (
              <option key={furnizor} value={furnizor}>
                {ETICHETE_TICHETE[furnizor]}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            Valoarea per tichet se stabilește din setările de salarizare, după activarea modulului.
          </p>
          <Eroare id={`${idFormular}-tichete-eroare`} mesaj={errors.tichete_furnizor?.message} />
        </div>
      </fieldset>
    </div>
  );
}
