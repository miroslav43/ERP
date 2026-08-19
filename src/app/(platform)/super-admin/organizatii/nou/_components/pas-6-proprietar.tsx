// src/app/(platform)/super-admin/organizatii/nou/_components/pas-6-proprietar.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import { PLANURI, type OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

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
      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">
          Contul de proprietar (primul utilizator)
        </legend>
        <p className="text-muted-foreground text-sm">
          La finalul înrolării se trimite automat o invitație pe acest email — link de acces
          fără parolă, ca la orice membru invitat.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-owner-prenume`} className={claseLabel}>
              Prenume *
            </label>
            <input
              id={`${idFormular}-owner-prenume`}
              {...register("owner_prenume")}
              aria-invalid={Boolean(errors.owner_prenume)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-prenume-eroare`} mesaj={errors.owner_prenume?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-owner-nume`} className={claseLabel}>
              Nume *
            </label>
            <input
              id={`${idFormular}-owner-nume`}
              {...register("owner_nume")}
              aria-invalid={Boolean(errors.owner_nume)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-nume-eroare`} mesaj={errors.owner_nume?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-owner-email`} className={claseLabel}>
              Email de business *
            </label>
            <input
              id={`${idFormular}-owner-email`}
              type="email"
              {...register("owner_email")}
              aria-invalid={Boolean(errors.owner_email)}
              aria-describedby={`${idFormular}-owner-email-ajutor`}
              className={claseCamp}
            />
            <p id={`${idFormular}-owner-email-ajutor`} className="text-muted-foreground mt-1 text-xs">
              Devine username-ul de autentificare.
            </p>
            <Eroare id={`${idFormular}-owner-email-eroare`} mesaj={errors.owner_email?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-owner-telefon`} className={claseLabel}>
              Telefon *
            </label>
            <input
              id={`${idFormular}-owner-telefon`}
              type="tel"
              {...register("owner_telefon")}
              placeholder="0721 234 567"
              aria-invalid={Boolean(errors.owner_telefon)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-telefon-eroare`} mesaj={errors.owner_telefon?.message} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Abonament</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-plan`} className={claseLabel}>
              Plan *
            </label>
            <select id={`${idFormular}-plan`} {...register("plan")} className={claseCamp}>
              {PLANURI.map((plan) => (
                <option key={plan} value={plan}>
                  {ETICHETE_PLAN[plan]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-locuri`} className={claseLabel}>
              Număr de locuri *
            </label>
            <input
              id={`${idFormular}-locuri`}
              type="number"
              min={1}
              max={1000}
              {...register("seats_limit")}
              aria-invalid={Boolean(errors.seats_limit)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-locuri-eroare`} mesaj={errors.seats_limit?.message} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
