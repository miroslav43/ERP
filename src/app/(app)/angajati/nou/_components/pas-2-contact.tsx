// src/app/(app)/angajati/nou/_components/pas-2-contact.tsx
"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InroleazaAngajatInput } from "@/schemas/employee";
import { claseCamp, claseLabel } from "./campuri-comune";

export const CAMPURI_PAS_2 = [
  "email_personal",
  "telefon",
  "adresa_strada",
  "adresa_oras",
  "adresa_judet",
  "adresa_cod_postal",
  "adresa_resedinta_strada",
  "adresa_resedinta_oras",
  "adresa_resedinta_judet",
  "adresa_resedinta_cod_postal",
  "email_serviciu",
  "telefon_serviciu",
  "contact_urgenta_nume",
  "contact_urgenta_telefon",
  "contact_urgenta_relatie",
] as const satisfies readonly (keyof InroleazaAngajatInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
  readonly idFormular: string;
}

export function Pas2Contact({ formular, idFormular }: Proprietati) {
  const { register } = formular;
  const [reședințăDifera, setReședințăDifera] = useState(false);

  return (
    <div className="space-y-6">
      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Contact personal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-email-personal`} className={claseLabel}>
              E-mail personal
            </label>
            <input
              id={`${idFormular}-email-personal`}
              type="email"
              {...register("email_personal")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-telefon`} className={claseLabel}>
              Telefon personal
            </label>
            <input id={`${idFormular}-telefon`} type="tel" {...register("telefon")} className={claseCamp} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Contact de muncă</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-email-serviciu`} className={claseLabel}>
              E-mail de muncă
            </label>
            <input
              id={`${idFormular}-email-serviciu`}
              type="email"
              {...register("email_serviciu")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-telefon-serviciu`} className={claseLabel}>
              Telefon de muncă
            </label>
            <input
              id={`${idFormular}-telefon-serviciu`}
              type="tel"
              {...register("telefon_serviciu")}
              className={claseCamp}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Domiciliu</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={`${idFormular}-adresa`} className={claseLabel}>
              Stradă și număr
            </label>
            <input id={`${idFormular}-adresa`} {...register("adresa_strada")} className={claseCamp} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-oras`} className={claseLabel}>
              Localitate
            </label>
            <input id={`${idFormular}-oras`} {...register("adresa_oras")} className={claseCamp} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-judet`} className={claseLabel}>
              Județ
            </label>
            <input id={`${idFormular}-judet`} {...register("adresa_judet")} className={claseCamp} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-cod-postal`} className={claseLabel}>
              Cod poștal
            </label>
            <input id={`${idFormular}-cod-postal`} {...register("adresa_cod_postal")} className={claseCamp} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Reședință</legend>
        <div className="flex items-center gap-2">
          <input
            id={`${idFormular}-resedinta-difera`}
            type="checkbox"
            checked={reședințăDifera}
            onChange={(eveniment) => {
              setReședințăDifera(eveniment.target.checked);
            }}
            className="border-border size-4 rounded"
          />
          <label htmlFor={`${idFormular}-resedinta-difera`} className="text-foreground text-sm">
            Reședința diferă de domiciliu
          </label>
        </div>
        {reședințăDifera ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${idFormular}-resedinta-adresa`} className={claseLabel}>
                Stradă și număr
              </label>
              <input
                id={`${idFormular}-resedinta-adresa`}
                {...register("adresa_resedinta_strada")}
                className={claseCamp}
              />
            </div>
            <div>
              <label htmlFor={`${idFormular}-resedinta-oras`} className={claseLabel}>
                Localitate
              </label>
              <input
                id={`${idFormular}-resedinta-oras`}
                {...register("adresa_resedinta_oras")}
                className={claseCamp}
              />
            </div>
            <div>
              <label htmlFor={`${idFormular}-resedinta-judet`} className={claseLabel}>
                Județ
              </label>
              <input
                id={`${idFormular}-resedinta-judet`}
                {...register("adresa_resedinta_judet")}
                className={claseCamp}
              />
            </div>
            <div>
              <label htmlFor={`${idFormular}-resedinta-cod-postal`} className={claseLabel}>
                Cod poștal
              </label>
              <input
                id={`${idFormular}-resedinta-cod-postal`}
                {...register("adresa_resedinta_cod_postal")}
                className={claseCamp}
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Contact de urgență</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${idFormular}-urgenta-nume`} className={claseLabel}>
              Nume
            </label>
            <input id={`${idFormular}-urgenta-nume`} {...register("contact_urgenta_nume")} className={claseCamp} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-urgenta-telefon`} className={claseLabel}>
              Telefon
            </label>
            <input
              id={`${idFormular}-urgenta-telefon`}
              type="tel"
              {...register("contact_urgenta_telefon")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-urgenta-relatie`} className={claseLabel}>
              Relație
            </label>
            <input
              id={`${idFormular}-urgenta-relatie`}
              {...register("contact_urgenta_relatie")}
              placeholder="soț/soție, părinte…"
              className={claseCamp}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
