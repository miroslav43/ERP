// src/components/onboarding/pas-5-ssm.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { Camp } from "@/components/ui/camp";

import { mesajeEroare } from "./campuri-comune";

export const CAMPURI_PAS_5 = [
  "ssm_furnizor_extern",
  "ssm_persoana_responsabila",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function Pas5Ssm({ formular, idFormular }: Proprietati) {
  const {
    register,
    formState: { errors },
  } = formular;

  return (
    <fieldset className="border-border rounded-panou space-y-4 border p-4">
      <legend className="text-foreground text-corp px-1 font-medium">
        SSM / PSI / Medicina muncii
      </legend>
      <p className="text-muted-foreground text-corp">
        Dacă firma nu are servicii interne, se completează furnizorul extern care face
        instructajele.
      </p>

      <Camp
        nume="ssm_furnizor_extern"
        id={`${idFormular}-medicina-muncii`}
        eticheta="Furnizor de medicina muncii"
        erori={mesajeEroare(errors.ssm_furnizor_extern?.message)}
      >
        {(a) => (
          <input
            {...a}
            {...register("ssm_furnizor_extern")}
            placeholder="Numele clinicii/cabinetului contractat"
          />
        )}
      </Camp>

      <Camp
        nume="ssm_persoana_responsabila"
        id={`${idFormular}-ssm-persoana`}
        eticheta="Serviciu extern SSM/PSI sau persoană desemnată"
        erori={mesajeEroare(errors.ssm_persoana_responsabila?.message)}
      >
        {(a) => (
          <input
            {...a}
            {...register("ssm_persoana_responsabila")}
            placeholder="Numele firmei externe sau al persoanei desemnate intern"
          />
        )}
      </Camp>
    </fieldset>
  );
}
