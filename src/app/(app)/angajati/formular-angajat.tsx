// src/app/(app)/angajati/formular-angajat.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { GENURI } from "@/schemas/employee";
import { actualizeazaAngajat, creeazaAngajat } from "./actions";

interface Optiune {
  readonly id: string;
  readonly denumire: string;
}

interface AngajatExistent {
  readonly id: string;
  readonly last_name: string;
  readonly first_name: string;
  readonly email_personal: string | null;
  readonly telefon: string | null;
  readonly data_nasterii: string | null;
  readonly gen: string;
  readonly department_id: string | null;
  readonly job_position_id: string | null;
  readonly hired_on: string | null;
}

interface Proprietati {
  readonly departamente: readonly Optiune[];
  readonly functii: readonly Optiune[];
  /** Prezent doar în modul editare — dacă lipsește, formularul creează o fișă nouă. */
  readonly angajatExistent?: AngajatExistent;
}

interface ValoriFormular {
  marca: string;
  last_name: string;
  first_name: string;
  email_personal: string;
  telefon: string;
  data_nasterii: string;
  gen: string;
  department_id: string;
  job_position_id: string;
  hired_on: string;
  cnp: string;
  iban: string;
  banca: string;
}

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

export function FormularAngajat({ departamente, functii, angajatExistent }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const editare = angajatExistent !== undefined;
  const { register, handleSubmit, formState } = useForm<ValoriFormular>({
    defaultValues:
      angajatExistent === undefined
        ? {}
        : {
            last_name: angajatExistent.last_name,
            first_name: angajatExistent.first_name,
            email_personal: angajatExistent.email_personal ?? "",
            telefon: angajatExistent.telefon ?? "",
            data_nasterii: angajatExistent.data_nasterii ?? "",
            gen: angajatExistent.gen,
            department_id: angajatExistent.department_id ?? "",
            job_position_id: angajatExistent.job_position_id ?? "",
            hired_on: angajatExistent.hired_on ?? "",
          },
  });

  function trimite(valori: ValoriFormular): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = editare
        ? await actualizeazaAngajat({ ...valori, id: angajatExistent.id })
        : await creeazaAngajat(valori);
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      const id = editare
        ? angajatExistent.id
        : (rezultat.data as { readonly id: string }).id;
      router.push(`/angajati/${id}`);
      router.refresh();
    });
  }

  const campuri: readonly (readonly [keyof ValoriFormular, string, string, boolean])[] = editare
    ? [
        ["last_name", "Nume", "text", true],
        ["first_name", "Prenume", "text", true],
        ["email_personal", "E-mail personal", "email", false],
        ["telefon", "Telefon", "tel", false],
        ["data_nasterii", "Data nașterii", "date", false],
        ["hired_on", "Data angajării", "date", false],
        ["cnp", "CNP nou (gol = neschimbat)", "text", false],
        ["iban", "IBAN nou (gol = neschimbat)", "text", false],
        ["banca", "Bancă", "text", false],
      ]
    : [
        ["marca", "Marcă", "text", true],
        ["last_name", "Nume", "text", true],
        ["first_name", "Prenume", "text", true],
        ["email_personal", "E-mail personal", "email", false],
        ["telefon", "Telefon", "tel", false],
        ["data_nasterii", "Data nașterii", "date", false],
        ["hired_on", "Data angajării", "date", false],
        ["cnp", "CNP", "text", false],
        ["iban", "IBAN", "text", false],
        ["banca", "Bancă", "text", false],
      ];

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campuri.map(([nume, eticheta, tip, obligatoriu]) => (
          <div key={nume}>
            <label htmlFor={nume} className="block text-sm font-medium">
              {eticheta}
              {obligatoriu ? <span aria-hidden="true"> *</span> : null}
            </label>
            <input
              id={nume}
              type={tip}
              autoComplete="off"
              aria-required={obligatoriu}
              className={CLASA_CAMP}
              {...register(
                nume,
                obligatoriu ? { required: `Câmpul „${eticheta}” este obligatoriu.` } : {},
              )}
            />
            {formState.errors[nume] !== undefined ? (
              <p className="mt-1 text-xs text-danger">
                {formState.errors[nume]?.message}
              </p>
            ) : null}
          </div>
        ))}

        <div>
          <label htmlFor="gen" className="block text-sm font-medium">
            Gen
          </label>
          <select id="gen" className={CLASA_CAMP} {...register("gen")}>
            {GENURI.map((valoare) => (
              <option key={valoare} value={valoare}>
                {valoare}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="department_id" className="block text-sm font-medium">
            Departament
          </label>
          <select id="department_id" className={CLASA_CAMP} {...register("department_id")}>
            <option value="">Nealocat</option>
            {departamente.map((optiune) => (
              <option key={optiune.id} value={optiune.id}>
                {optiune.denumire}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="job_position_id" className="block text-sm font-medium">
            Funcție
          </label>
          <select id="job_position_id" className={CLASA_CAMP} {...register("job_position_id")}>
            <option value="">Nealocată</option>
            {functii.map((optiune) => (
              <option key={optiune.id} value={optiune.id}>
                {optiune.denumire}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="rounded-md border border-danger bg-danger/8 p-3 text-sm text-danger">
            {eroare}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        {inCurs ? "Se salvează…" : "Salvează fișa"}
      </button>
    </form>
  );
}
