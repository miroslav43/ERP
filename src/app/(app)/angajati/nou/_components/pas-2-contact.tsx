// src/app/(app)/angajati/nou/_components/pas-2-contact.tsx
"use client";

import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Camp, clasaBifa } from "@/components/ui/camp";
import type { InroleazaAngajatInput } from "@/schemas/employee";
import { mesajCamp } from "./erori-formular";

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
}

export function Pas2Contact({ formular }: Proprietati) {
  const {
    register,
    formState: { errors },
  } = formular;
  const idBifa = useId();
  const [resedintaDifera, setResedintaDifera] = useState(false);

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Contact personal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="email_personal"
            eticheta="E-mail personal"
            erori={mesajCamp(errors.email_personal)}
            ajutor="Aici pleacă invitația de acces în aplicație."
          >
            {(atribute) => <input {...atribute} type="email" {...register("email_personal")} />}
          </Camp>
          <Camp nume="telefon" eticheta="Telefon personal" erori={mesajCamp(errors.telefon)}>
            {(atribute) => <input {...atribute} type="tel" {...register("telefon")} />}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Contact de muncă</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="email_serviciu"
            eticheta="E-mail de muncă"
            erori={mesajCamp(errors.email_serviciu)}
          >
            {(atribute) => <input {...atribute} type="email" {...register("email_serviciu")} />}
          </Camp>
          <Camp
            nume="telefon_serviciu"
            eticheta="Telefon de muncă"
            erori={mesajCamp(errors.telefon_serviciu)}
          >
            {(atribute) => <input {...atribute} type="tel" {...register("telefon_serviciu")} />}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Domiciliu</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="adresa_strada"
            eticheta="Stradă și număr"
            erori={mesajCamp(errors.adresa_strada)}
            className="sm:col-span-2"
          >
            {(atribute) => <input {...atribute} {...register("adresa_strada")} />}
          </Camp>
          <Camp nume="adresa_oras" eticheta="Localitate" erori={mesajCamp(errors.adresa_oras)}>
            {(atribute) => <input {...atribute} {...register("adresa_oras")} />}
          </Camp>
          <Camp nume="adresa_judet" eticheta="Județ" erori={mesajCamp(errors.adresa_judet)}>
            {(atribute) => <input {...atribute} {...register("adresa_judet")} />}
          </Camp>
          <Camp
            nume="adresa_cod_postal"
            eticheta="Cod poștal"
            erori={mesajCamp(errors.adresa_cod_postal)}
          >
            {(atribute) => <input {...atribute} {...register("adresa_cod_postal")} />}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Reședință</legend>
        <div className="flex items-center gap-2">
          <input
            id={idBifa}
            type="checkbox"
            checked={resedintaDifera}
            onChange={(eveniment) => {
              setResedintaDifera(eveniment.target.checked);
            }}
            className={clasaBifa}
          />
          <label htmlFor={idBifa} className="text-foreground text-corp">
            Reședința diferă de domiciliu
          </label>
        </div>
        {resedintaDifera ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="adresa_resedinta_strada"
              eticheta="Stradă și număr"
              erori={mesajCamp(errors.adresa_resedinta_strada)}
              className="sm:col-span-2"
            >
              {(atribute) => <input {...atribute} {...register("adresa_resedinta_strada")} />}
            </Camp>
            <Camp
              nume="adresa_resedinta_oras"
              eticheta="Localitate"
              erori={mesajCamp(errors.adresa_resedinta_oras)}
            >
              {(atribute) => <input {...atribute} {...register("adresa_resedinta_oras")} />}
            </Camp>
            <Camp
              nume="adresa_resedinta_judet"
              eticheta="Județ"
              erori={mesajCamp(errors.adresa_resedinta_judet)}
            >
              {(atribute) => <input {...atribute} {...register("adresa_resedinta_judet")} />}
            </Camp>
            <Camp
              nume="adresa_resedinta_cod_postal"
              eticheta="Cod poștal"
              erori={mesajCamp(errors.adresa_resedinta_cod_postal)}
            >
              {(atribute) => <input {...atribute} {...register("adresa_resedinta_cod_postal")} />}
            </Camp>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Contact de urgență</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Camp
            nume="contact_urgenta_nume"
            eticheta="Nume"
            erori={mesajCamp(errors.contact_urgenta_nume)}
          >
            {(atribute) => <input {...atribute} {...register("contact_urgenta_nume")} />}
          </Camp>
          <Camp
            nume="contact_urgenta_telefon"
            eticheta="Telefon"
            erori={mesajCamp(errors.contact_urgenta_telefon)}
          >
            {(atribute) => (
              <input {...atribute} type="tel" {...register("contact_urgenta_telefon")} />
            )}
          </Camp>
          <Camp
            nume="contact_urgenta_relatie"
            eticheta="Relație"
            erori={mesajCamp(errors.contact_urgenta_relatie)}
          >
            {(atribute) => (
              <input
                {...atribute}
                {...register("contact_urgenta_relatie")}
                placeholder="soț/soție, părinte…"
              />
            )}
          </Camp>
        </div>
      </fieldset>
    </div>
  );
}
