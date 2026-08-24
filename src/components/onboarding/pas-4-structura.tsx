// src/components/onboarding/pas-4-structura.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import { JUDETE, type OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { Camp } from "@/components/ui/camp";

import { mesajeEroare } from "./campuri-comune";

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
        <Camp
          nume="punct_lucru_denumire"
          id={`${idFormular}-pl-denumire`}
          eticheta="Denumire"
          erori={mesajeEroare(errors.punct_lucru_denumire?.message)}
        >
          {(a) => (
            <input {...a} {...register("punct_lucru_denumire")} placeholder="Sediu central" />
          )}
        </Camp>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="punct_lucru_judet"
            id={`${idFormular}-pl-judet`}
            eticheta="Județ"
            fel="select"
            erori={mesajeEroare(errors.punct_lucru_judet?.message)}
          >
            {(a) => (
              <select {...a} {...register("punct_lucru_judet")}>
                <option value="">— Alegeți —</option>
                {JUDETE.map((judet) => (
                  <option key={judet} value={judet}>
                    {judet}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="punct_lucru_oras"
            id={`${idFormular}-pl-oras`}
            eticheta="Localitate"
            erori={mesajeEroare(errors.punct_lucru_oras?.message)}
          >
            {(a) => <input {...a} {...register("punct_lucru_oras")} />}
          </Camp>
          <Camp
            nume="punct_lucru_adresa"
            id={`${idFormular}-pl-adresa`}
            eticheta="Adresă"
            erori={mesajeEroare(errors.punct_lucru_adresa?.message)}
          >
            {(a) => <input {...a} {...register("punct_lucru_adresa")} />}
          </Camp>
          <Camp
            nume="punct_lucru_cod_postal"
            id={`${idFormular}-pl-cod-postal`}
            eticheta="Cod poștal"
            erori={mesajeEroare(errors.punct_lucru_cod_postal?.message)}
          >
            {(a) => <input {...a} {...register("punct_lucru_cod_postal")} />}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Politica de concediu</legend>
        <Camp
          nume="zile_concediu_anual_implicit"
          id={`${idFormular}-zile-concediu`}
          eticheta="Zile de concediu anual, implicit"
          ajutor="Valoarea implicită folosită la înrolarea fiecărui angajat nou."
          erori={mesajeEroare(errors.zile_concediu_anual_implicit?.message)}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min={0}
              max={60}
              {...register("zile_concediu_anual_implicit")}
            />
          )}
        </Camp>
      </fieldset>
    </div>
  );
}
