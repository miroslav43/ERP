// src/app/(app)/angajati/nou/_components/pas-1-identitate.tsx
"use client";

import { useId } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { TIPURI_ACT_IDENTITATE } from "@/domain/reges/operatii";
import { GENURI, STARI_CIVILE, type InroleazaAngajatInput } from "@/schemas/employee";
import { ETICHETE_ACT_IDENTITATE, ETICHETE_GEN, ETICHETE_STARE_CIVILA } from "../../etichete";
import { mesajCamp } from "./erori-formular";

export const CAMPURI_PAS_1 = [
  "last_name",
  "first_name",
  "data_nasterii",
  "gen",
  "cetatenie",
  "stare_civila",
  "reges_tip_act",
  "serie_act",
  "numar_act",
  "act_eliberat_de",
  "act_eliberat_la",
  "act_valabil_pana",
  "cnp",
  "grad_handicap",
  "nr_persoane_intretinere",
  "optiune_pilon_ii",
  "permis_tip",
  "permis_numar",
  "permis_emis_de",
  "permis_valabil_de_la",
  "permis_valabil_pana",
  "numar_pasaport",
] as const satisfies readonly (keyof InroleazaAngajatInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
}

export function Pas1Identitate({ formular }: Proprietati) {
  const {
    register,
    control,
    formState: { errors },
  } = formular;
  const idPilon = useId();

  // `useWatch`, nu `formular.watch`: watch-ul re-randează TOT formularul la
  // fiecare tastă — defectul reparat în f88d419, „pașii asistenților se
  // re-randau".
  const cetatenie = useWatch({ control, name: "cetatenie" });
  const esteStrain =
    typeof cetatenie === "string" &&
    cetatenie.trim().toUpperCase() !== "RO" &&
    cetatenie.trim().length > 0;

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Identitate</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="first_name"
            eticheta="Prenume"
            obligatoriu
            erori={mesajCamp(errors.first_name)}
          >
            {(atribute) => <input {...atribute} {...register("first_name")} />}
          </Camp>
          <Camp nume="last_name" eticheta="Nume" obligatoriu erori={mesajCamp(errors.last_name)}>
            {(atribute) => <input {...atribute} {...register("last_name")} />}
          </Camp>
          <Camp
            nume="data_nasterii"
            eticheta="Data nașterii"
            erori={mesajCamp(errors.data_nasterii)}
          >
            {(atribute) => <input {...atribute} type="date" {...register("data_nasterii")} />}
          </Camp>
          <Camp nume="gen" eticheta="Gen" fel="select" erori={mesajCamp(errors.gen)}>
            {(atribute) => (
              <select {...atribute} {...register("gen")}>
                {GENURI.map((gen) => (
                  <option key={gen} value={gen}>
                    {ETICHETE_GEN[gen]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp nume="cetatenie" eticheta="Cetățenie" erori={mesajCamp(errors.cetatenie)}>
            {(atribute) => (
              <input {...atribute} {...register("cetatenie")} placeholder="RO" maxLength={2} />
            )}
          </Camp>
          <Camp
            nume="stare_civila"
            eticheta="Stare civilă"
            fel="select"
            erori={mesajCamp(errors.stare_civila)}
          >
            {(atribute) => (
              <select {...atribute} {...register("stare_civila")}>
                <option value="">— Nespecificată —</option>
                {STARI_CIVILE.map((stare) => (
                  <option key={stare} value={stare}>
                    {ETICHETE_STARE_CIVILA[stare]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Act de identitate</legend>
        <p className="text-muted-foreground text-corp">
          Datele astea intră cuvânt cu cuvânt în contractul de muncă („posesor al … seria … nr. …,
          eliberat de … la data de …”) și în transmiterea către REGES. De aceea sunt obligatorii
          aici, chiar dacă pe fișele deja existente lipsesc.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="reges_tip_act"
            eticheta="Tipul actului"
            fel="select"
            obligatoriu
            erori={mesajCamp(errors.reges_tip_act)}
          >
            {(atribute) => (
              <select {...atribute} {...register("reges_tip_act")}>
                <option value="">— Alegeți —</option>
                {TIPURI_ACT_IDENTITATE.map((tip) => (
                  <option key={tip} value={tip}>
                    {ETICHETE_ACT_IDENTITATE[tip]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="serie_act"
            eticheta="Serie"
            erori={mesajCamp(errors.serie_act)}
            // `exactOptionalPropertyTypes`: cheia se omite, nu se trimite `undefined`.
            {...(esteStrain ? { ajutor: "Un pașaport n-are serie — lăsați gol." } : {})}
          >
            {(atribute) => <input {...atribute} {...register("serie_act")} />}
          </Camp>
          <Camp nume="numar_act" eticheta="Număr" obligatoriu erori={mesajCamp(errors.numar_act)}>
            {(atribute) => <input {...atribute} {...register("numar_act")} />}
          </Camp>
          <Camp
            nume="act_eliberat_de"
            eticheta="Eliberat de"
            obligatoriu
            erori={mesajCamp(errors.act_eliberat_de)}
          >
            {(atribute) => (
              <input {...atribute} {...register("act_eliberat_de")} placeholder="ex. SPCLEP Cluj" />
            )}
          </Camp>
          <Camp
            nume="act_eliberat_la"
            eticheta="Data eliberării"
            obligatoriu
            erori={mesajCamp(errors.act_eliberat_la)}
          >
            {(atribute) => <input {...atribute} type="date" {...register("act_eliberat_la")} />}
          </Camp>
          <Camp
            nume="act_valabil_pana"
            eticheta="Valabil până la"
            erori={mesajCamp(errors.act_valabil_pana)}
          >
            {(atribute) => <input {...atribute} type="date" {...register("act_valabil_pana")} />}
          </Camp>
          <Camp nume="cnp" eticheta="CNP" obligatoriu erori={mesajCamp(errors.cnp)}>
            {(atribute) => (
              <input {...atribute} {...register("cnp")} inputMode="numeric" maxLength={13} />
            )}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Situație personală</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Camp
            nume="grad_handicap"
            eticheta="Grad de handicap"
            erori={mesajCamp(errors.grad_handicap)}
          >
            {(atribute) => (
              <input {...atribute} {...register("grad_handicap")} placeholder="— fără —" />
            )}
          </Camp>
          <Camp
            nume="nr_persoane_intretinere"
            eticheta="Persoane în întreținere"
            erori={mesajCamp(errors.nr_persoane_intretinere)}
          >
            {(atribute) => (
              <input
                {...atribute}
                type="number"
                min={0}
                max={20}
                {...register("nr_persoane_intretinere")}
              />
            )}
          </Camp>
          <div className="flex items-end pb-2">
            <div className="flex items-center gap-2">
              <input
                id={idPilon}
                type="checkbox"
                {...register("optiune_pilon_ii")}
                className={clasaBifa}
              />
              <label htmlFor={idPilon} className="text-foreground text-corp">
                Optează pentru Pilonul II
              </label>
            </div>
          </div>
        </div>
      </fieldset>

      {esteStrain ? (
        <fieldset className="border-border rounded-panou space-y-4 border p-4">
          <legend className="text-foreground text-corp px-1 font-medium">
            Dreptul de muncă (cetățean străin)
          </legend>
          <p className="text-muted-foreground text-corp">
            Munca fără permis valabil e contravenție pentru angajator. Completat aici, permisul
            intră în tabloul de expirabile și avertizează înainte de termen.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="permis_tip"
              eticheta="Tipul permisului"
              fel="select"
              erori={mesajCamp(errors.permis_tip)}
            >
              {(atribute) => (
                <select {...atribute} {...register("permis_tip")}>
                  <option value="">— Alegeți —</option>
                  <option value="aviz">Aviz de angajare</option>
                  <option value="permis_unic">Permis unic</option>
                  <option value="detasare">Detașare</option>
                  <option value="sezonier">Lucrător sezonier</option>
                </select>
              )}
            </Camp>
            <Camp
              nume="permis_numar"
              eticheta="Numărul permisului"
              erori={mesajCamp(errors.permis_numar)}
            >
              {(atribute) => <input {...atribute} {...register("permis_numar")} />}
            </Camp>
            <Camp nume="permis_emis_de" eticheta="Emis de" erori={mesajCamp(errors.permis_emis_de)}>
              {(atribute) => (
                <input {...atribute} {...register("permis_emis_de")} placeholder="ex. IGI" />
              )}
            </Camp>
            <Camp
              nume="numar_pasaport"
              eticheta="Număr pașaport"
              erori={mesajCamp(errors.numar_pasaport)}
            >
              {(atribute) => <input {...atribute} {...register("numar_pasaport")} />}
            </Camp>
            <Camp
              nume="permis_valabil_de_la"
              eticheta="Valabil de la"
              erori={mesajCamp(errors.permis_valabil_de_la)}
            >
              {(atribute) => (
                <input {...atribute} type="date" {...register("permis_valabil_de_la")} />
              )}
            </Camp>
            <Camp
              nume="permis_valabil_pana"
              eticheta="Valabil până la"
              erori={mesajCamp(errors.permis_valabil_pana)}
            >
              {(atribute) => (
                <input {...atribute} type="date" {...register("permis_valabil_pana")} />
              )}
            </Camp>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
