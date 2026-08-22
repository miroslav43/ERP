// src/components/onboarding/pas-5-ssm.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { claseCamp, claseLabel } from "./campuri-comune";

export const CAMPURI_PAS_5 = [
  "ssm_furnizor_extern",
  "ssm_persoana_responsabila",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function Pas5Ssm({ formular, idFormular }: Proprietati) {
  const { register } = formular;

  return (
    <fieldset className="border-border space-y-4 rounded-lg border p-4">
      <legend className="text-foreground px-1 text-sm font-medium">
        SSM / PSI / Medicina muncii
      </legend>
      <p className="text-muted-foreground text-sm">
        Dacă firma nu are servicii interne, se completează furnizorul extern care face
        instructajele.
      </p>

      <div>
        <label htmlFor={`${idFormular}-medicina-muncii`} className={claseLabel}>
          Furnizor de medicina muncii
        </label>
        <input
          id={`${idFormular}-medicina-muncii`}
          {...register("ssm_furnizor_extern")}
          placeholder="Numele clinicii/cabinetului contractat"
          className={claseCamp}
        />
      </div>

      <div>
        <label htmlFor={`${idFormular}-ssm-persoana`} className={claseLabel}>
          Serviciu extern SSM/PSI sau persoană desemnată
        </label>
        <input
          id={`${idFormular}-ssm-persoana`}
          {...register("ssm_persoana_responsabila")}
          placeholder="Numele firmei externe sau al persoanei desemnate intern"
          className={claseCamp}
        />
      </div>
    </fieldset>
  );
}
