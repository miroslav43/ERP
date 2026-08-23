// src/components/onboarding/pas-4-structura.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import { JUDETE, type OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

export const CAMPURI_PAS_4 = [
  "punct_lucru_denumire",
  "punct_lucru_adresa",
  "punct_lucru_judet",
  "punct_lucru_oras",
  "punct_lucru_cod_postal",
  "zile_concediu_anual_implicit",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function Pas4Structura({ formular, idFormular }: Proprietati) {
  const {
    register,
    formState: { errors },
  } = formular;

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">
          Punct de lucru principal
        </legend>
        <p className="text-muted-foreground text-corp">
          Relevant pentru pontaj (geofencing/terminale per locație) și parc auto. Alte puncte de
          lucru se adaugă ulterior.
        </p>
        <div>
          <label htmlFor={`${idFormular}-pl-denumire`} className={claseLabel}>
            Denumire
          </label>
          <input
            id={`${idFormular}-pl-denumire`}
            {...register("punct_lucru_denumire")}
            placeholder="Sediu central"
            className={claseCamp}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-pl-judet`} className={claseLabel}>
              Județ
            </label>
            <select
              id={`${idFormular}-pl-judet`}
              {...register("punct_lucru_judet")}
              className={claseCamp}
            >
              <option value="">— Alegeți —</option>
              {JUDETE.map((judet) => (
                <option key={judet} value={judet}>
                  {judet}
                </option>
              ))}
            </select>
            <Eroare
              id={`${idFormular}-pl-judet-eroare`}
              mesaj={errors.punct_lucru_judet?.message}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-pl-oras`} className={claseLabel}>
              Localitate
            </label>
            <input
              id={`${idFormular}-pl-oras`}
              {...register("punct_lucru_oras")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-pl-adresa`} className={claseLabel}>
              Adresă
            </label>
            <input
              id={`${idFormular}-pl-adresa`}
              {...register("punct_lucru_adresa")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-pl-cod-postal`} className={claseLabel}>
              Cod poștal
            </label>
            <input
              id={`${idFormular}-pl-cod-postal`}
              {...register("punct_lucru_cod_postal")}
              className={claseCamp}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Politica de concediu</legend>
        <div>
          <label htmlFor={`${idFormular}-zile-concediu`} className={claseLabel}>
            Zile de concediu anual, implicit
          </label>
          <input
            id={`${idFormular}-zile-concediu`}
            type="number"
            min={0}
            max={60}
            {...register("zile_concediu_anual_implicit")}
            aria-invalid={Boolean(errors.zile_concediu_anual_implicit)}
            className={claseCamp}
          />
          <p className="text-muted-foreground text-nota mt-1">
            Valoarea implicită folosită la înrolarea fiecărui angajat nou.
          </p>
          <Eroare
            id={`${idFormular}-zile-concediu-eroare`}
            mesaj={errors.zile_concediu_anual_implicit?.message}
          />
        </div>
      </fieldset>
    </div>
  );
}
