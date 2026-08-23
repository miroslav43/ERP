// src/components/onboarding/pas-2-reprezentant.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { CampCuSugestii } from "@/components/forms/camp-cu-sugestii";
import { Camp } from "@/components/ui/camp";

import { mesajeEroare } from "./campuri-comune";

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
    <fieldset className="border-border rounded-panou space-y-4 border p-4">
      <legend className="text-foreground text-corp px-1 font-medium">Reprezentantul legal</legend>
      <p className="text-muted-foreground text-corp">
        Apare pe contracte, decizii și fișe generate din HR/SSM.
      </p>

      <Camp
        nume="reprezentant_legal"
        id={`${idFormular}-repr-nume`}
        eticheta="Nume și prenume"
        erori={mesajeEroare(errors.reprezentant_legal?.message)}
      >
        {(a) => <input {...a} {...register("reprezentant_legal")} placeholder="Popescu Ion" />}
      </Camp>

      <Camp
        nume="functie_reprezentant_legal"
        id={`${idFormular}-repr-functie`}
        eticheta="Funcția"
        erori={mesajeEroare(errors.functie_reprezentant_legal?.message)}
      >
        {(a) => (
          <CampCuSugestii
            id={a.id}
            value={functie}
            onChange={(valoare) =>
              setValue("functie_reprezentant_legal", valoare, { shouldValidate: true })
            }
            sugestii={FUNCTII_UZUALE}
            placeholder="Administrator"
            maxLength={120}
            ariaInvalid={a["aria-invalid"] === true}
          />
        )}
      </Camp>

      <Camp
        nume="reprezentant_cnp"
        id={`${idFormular}-repr-cnp`}
        eticheta="CNP (opțional)"
        ajutor="Necesar uneori în relația cu instituțiile sau pentru semnături electronice. Se păstrează criptat."
        erori={mesajeEroare(errors.reprezentant_cnp?.message)}
      >
        {(a) => (
          <input {...a} {...register("reprezentant_cnp")} inputMode="numeric" maxLength={13} />
        )}
      </Camp>
    </fieldset>
  );
}
