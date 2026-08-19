// src/app/(app)/angajati/formular-angajat.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Lock } from "lucide-react";

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

const CLASA_CAMP = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/**
 * Un singur câmp text/dată/e-mail, cu etichetă și eroare inline. Secțiunile
 * folosesc JSX explicit (nu un array generic de tupluri, ca înainte): fiecare
 * grupare are propriul grid și propria ordine de câmpuri, lucru pe care o
 * buclă unică peste un array plat nu-l poate exprima fără o a doua cheie de
 * grupare — moment în care tot ai reinventat JSX-ul, doar mai indirect.
 */
function Camp({
  nume,
  eticheta,
  tip = "text",
  obligatoriu = false,
  register,
  errors,
}: {
  readonly nume: keyof ValoriFormular;
  readonly eticheta: string;
  readonly tip?: string;
  readonly obligatoriu?: boolean;
  readonly register: UseFormRegister<ValoriFormular>;
  readonly errors: FieldErrors<ValoriFormular>;
}) {
  return (
    <div>
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
      {errors[nume] !== undefined ? (
        <p className="text-danger mt-1 text-xs">{errors[nume]?.message}</p>
      ) : null}
    </div>
  );
}

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

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-6" noValidate>
      {eroare !== null ? (
        <p role="alert" className="border-danger bg-danger/8 text-danger rounded-md border p-3 text-sm">
          {eroare}
        </p>
      ) : null}

      <fieldset className="border-border bg-surface rounded-lg border p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold">Identitate</legend>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!editare ? (
            <Camp
              nume="marca"
              eticheta="Marcă"
              obligatoriu
              register={register}
              errors={formState.errors}
            />
          ) : null}
          <Camp
            nume="last_name"
            eticheta="Nume"
            obligatoriu
            register={register}
            errors={formState.errors}
          />
          <Camp
            nume="first_name"
            eticheta="Prenume"
            obligatoriu
            register={register}
            errors={formState.errors}
          />
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
          <Camp
            nume="data_nasterii"
            eticheta="Data nașterii"
            tip="date"
            register={register}
            errors={formState.errors}
          />
        </div>
      </fieldset>

      <fieldset className="border-border bg-surface rounded-lg border p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold">Contact</legend>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Camp
            nume="email_personal"
            eticheta="E-mail personal"
            tip="email"
            register={register}
            errors={formState.errors}
          />
          <Camp nume="telefon" eticheta="Telefon" tip="tel" register={register} errors={formState.errors} />
        </div>
      </fieldset>

      <fieldset className="border-border bg-surface rounded-lg border p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold">Angajare</legend>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Camp
            nume="hired_on"
            eticheta="Data angajării"
            tip="date"
            register={register}
            errors={formState.errors}
          />
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
      </fieldset>

      <fieldset className="border-border border-l-accent bg-surface rounded-lg border border-l-2 p-5 shadow-sm">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
          <Lock aria-hidden="true" className="text-accent size-4" />
          Date sensibile
        </legend>
        <p className="text-muted-foreground mt-1 text-xs">
          Vizibile doar personalului autorizat — completați doar dacă se schimbă.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Camp
            nume="cnp"
            eticheta={editare ? "CNP nou (gol = neschimbat)" : "CNP"}
            register={register}
            errors={formState.errors}
          />
          <Camp
            nume="iban"
            eticheta={editare ? "IBAN nou (gol = neschimbat)" : "IBAN"}
            register={register}
            errors={formState.errors}
          />
          <Camp nume="banca" eticheta="Bancă" register={register} errors={formState.errors} />
        </div>
      </fieldset>

      <div className="border-border flex justify-end border-t pt-4">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {inCurs ? "Se salvează…" : "Salvează fișa"}
        </button>
      </div>
    </form>
  );
}
