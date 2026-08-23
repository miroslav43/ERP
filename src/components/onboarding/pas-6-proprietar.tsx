// src/components/onboarding/pas-6-proprietar.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import { PLANURI, type OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { Camp } from "@/components/ui/camp";

import { mesajeEroare } from "./campuri-comune";

export const CAMPURI_PAS_6 = [
  "owner_nume",
  "owner_prenume",
  "owner_email",
  "owner_telefon",
  "plan",
  "seats_limit",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

const ETICHETE_PLAN: Record<(typeof PLANURI)[number], string> = {
  trial: "Perioadă de probă",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function Pas6Proprietar({ formular, idFormular }: Proprietati) {
  const {
    register,
    formState: { errors },
  } = formular;

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">
          Contul de proprietar (primul utilizator)
        </legend>
        <p className="text-muted-foreground text-corp">
          La finalul înrolării se trimite automat o invitație pe acest email — link de acces fără
          parolă, ca la orice membru invitat.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="owner_prenume"
            id={`${idFormular}-owner-prenume`}
            eticheta="Prenume"
            obligatoriu
            erori={mesajeEroare(errors.owner_prenume?.message)}
          >
            {(a) => <input {...a} {...register("owner_prenume")} />}
          </Camp>
          <Camp
            nume="owner_nume"
            id={`${idFormular}-owner-nume`}
            eticheta="Nume"
            obligatoriu
            erori={mesajeEroare(errors.owner_nume?.message)}
          >
            {(a) => <input {...a} {...register("owner_nume")} />}
          </Camp>
          <Camp
            nume="owner_email"
            id={`${idFormular}-owner-email`}
            eticheta="Email de business"
            obligatoriu
            ajutor="Devine username-ul de autentificare."
            erori={mesajeEroare(errors.owner_email?.message)}
          >
            {(a) => <input {...a} type="email" {...register("owner_email")} />}
          </Camp>
          <Camp
            nume="owner_telefon"
            id={`${idFormular}-owner-telefon`}
            eticheta="Telefon"
            obligatoriu
            erori={mesajeEroare(errors.owner_telefon?.message)}
          >
            {(a) => (
              <input {...a} type="tel" {...register("owner_telefon")} placeholder="0721 234 567" />
            )}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Abonament</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="plan"
            id={`${idFormular}-plan`}
            eticheta="Plan"
            fel="select"
            obligatoriu
            erori={mesajeEroare(errors.plan?.message)}
          >
            {(a) => (
              <select {...a} {...register("plan")}>
                {PLANURI.map((plan) => (
                  <option key={plan} value={plan}>
                    {ETICHETE_PLAN[plan]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="seats_limit"
            id={`${idFormular}-locuri`}
            eticheta="Număr de locuri"
            obligatoriu
            erori={mesajeEroare(errors.seats_limit?.message)}
          >
            {(a) => <input {...a} type="number" min={1} max={1000} {...register("seats_limit")} />}
          </Camp>
        </div>
      </fieldset>
    </div>
  );
}
