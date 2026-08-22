// src/components/onboarding/pas-2-reprezentant.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { CampCuSugestii } from "@/components/forms/camp-cu-sugestii";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

export const CAMPURI_PAS_2 = [
  "reprezentant_legal",
  "functie_reprezentant_legal",
  "reprezentant_cnp",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

const FUNCTII_UZUALE = ["Administrator", "Director General", "Președinte"] as const;

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function Pas2Reprezentant({ formular, idFormular }: Proprietati) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = formular;
  // `useWatch`, NU `formular.watch(…)` — vezi nota din `pas-1-identitate.tsx`:
  // `watch` abonează doar componenta care apelează `useForm` (asistentul), iar
  // cu React Compiler pasul e memoizat și nu se mai re-randează după montare,
  // deci caseta ar rămâne goală la orice sugestie aleasă.
  const functie = useWatch({ control, name: "functie_reprezentant_legal" }) ?? "";

  return (
    <fieldset className="border-border space-y-4 rounded-lg border p-4">
      <legend className="text-foreground px-1 text-sm font-medium">Reprezentantul legal</legend>
      <p className="text-muted-foreground text-sm">
        Apare pe contracte, decizii și fișe generate din HR/SSM.
      </p>

      <div>
        <label htmlFor={`${idFormular}-repr-nume`} className={claseLabel}>
          Nume și prenume
        </label>
        <input
          id={`${idFormular}-repr-nume`}
          {...register("reprezentant_legal")}
          placeholder="Popescu Ion"
          className={claseCamp}
        />
      </div>

      <div>
        <label htmlFor={`${idFormular}-repr-functie`} className={claseLabel}>
          Funcția
        </label>
        <CampCuSugestii
          id={`${idFormular}-repr-functie`}
          value={functie}
          onChange={(valoare) =>
            setValue("functie_reprezentant_legal", valoare, { shouldValidate: true })
          }
          sugestii={FUNCTII_UZUALE}
          placeholder="Administrator"
          maxLength={120}
          ariaInvalid={Boolean(errors.functie_reprezentant_legal)}
        />
        <Eroare
          id={`${idFormular}-repr-functie-eroare`}
          mesaj={errors.functie_reprezentant_legal?.message}
        />
      </div>

      <div>
        <label htmlFor={`${idFormular}-repr-cnp`} className={claseLabel}>
          CNP (opțional)
        </label>
        <input
          id={`${idFormular}-repr-cnp`}
          {...register("reprezentant_cnp")}
          inputMode="numeric"
          maxLength={13}
          aria-invalid={Boolean(errors.reprezentant_cnp)}
          aria-describedby={`${idFormular}-repr-cnp-ajutor`}
          className={claseCamp}
        />
        <p id={`${idFormular}-repr-cnp-ajutor`} className="text-muted-foreground mt-1 text-xs">
          Necesar uneori în relația cu instituțiile sau pentru semnături electronice. Se păstrează
          criptat.
        </p>
        <Eroare id={`${idFormular}-repr-cnp-eroare`} mesaj={errors.reprezentant_cnp?.message} />
      </div>
    </fieldset>
  );
}
