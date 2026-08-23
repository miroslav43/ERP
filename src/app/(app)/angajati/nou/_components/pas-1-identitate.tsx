// src/app/(app)/angajati/nou/_components/pas-1-identitate.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { GENURI, STARI_CIVILE, type InroleazaAngajatInput } from "@/schemas/employee";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

export const CAMPURI_PAS_1 = [
  "last_name",
  "first_name",
  "data_nasterii",
  "gen",
  "cetatenie",
  "stare_civila",
  "tip_act_identitate",
  "serie_act",
  "numar_act",
  "act_eliberat_de",
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

const ETICHETE_STARE_CIVILA: Record<(typeof STARI_CIVILE)[number], string> = {
  necasatorit: "Necăsătorit(ă)",
  casatorit: "Căsătorit(ă)",
  divortat: "Divorțat(ă)",
  vaduv: "Văduv(ă)",
};

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
  readonly idFormular: string;
}

export function Pas1Identitate({ formular, idFormular }: Proprietati) {
  const {
    register,
    control,
    formState: { errors },
  } = formular;

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
      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Identitate</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-prenume`} className={claseLabel}>
              Prenume *
            </label>
            <input
              id={`${idFormular}-prenume`}
              {...register("first_name")}
              aria-invalid={Boolean(errors.first_name)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-prenume-eroare`} mesaj={errors.first_name?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-nume`} className={claseLabel}>
              Nume *
            </label>
            <input
              id={`${idFormular}-nume`}
              {...register("last_name")}
              aria-invalid={Boolean(errors.last_name)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-nume-eroare`} mesaj={errors.last_name?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-nastere`} className={claseLabel}>
              Data nașterii
            </label>
            <input
              id={`${idFormular}-nastere`}
              type="date"
              {...register("data_nasterii")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-gen`} className={claseLabel}>
              Gen
            </label>
            <select id={`${idFormular}-gen`} {...register("gen")} className={claseCamp}>
              {GENURI.map((gen) => (
                <option key={gen} value={gen}>
                  {gen}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-cetatenie`} className={claseLabel}>
              Cetățenie
            </label>
            <input
              id={`${idFormular}-cetatenie`}
              {...register("cetatenie")}
              placeholder="RO"
              maxLength={2}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-stare-civila`} className={claseLabel}>
              Stare civilă
            </label>
            <select
              id={`${idFormular}-stare-civila`}
              {...register("stare_civila")}
              className={claseCamp}
            >
              <option value="">— Nespecificată —</option>
              {STARI_CIVILE.map((stare) => (
                <option key={stare} value={stare}>
                  {ETICHETE_STARE_CIVILA[stare]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Act de identitate</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-tip-act`} className={claseLabel}>
              Tip
            </label>
            <input
              id={`${idFormular}-tip-act`}
              {...register("tip_act_identitate")}
              placeholder="CI"
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-serie-act`} className={claseLabel}>
              Serie
            </label>
            <input
              id={`${idFormular}-serie-act`}
              {...register("serie_act")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-numar-act`} className={claseLabel}>
              Număr
            </label>
            <input
              id={`${idFormular}-numar-act`}
              {...register("numar_act")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-eliberat-de`} className={claseLabel}>
              Eliberat de
            </label>
            <input
              id={`${idFormular}-eliberat-de`}
              {...register("act_eliberat_de")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-act-valabil`} className={claseLabel}>
              Valabil până la
            </label>
            <input
              id={`${idFormular}-act-valabil`}
              type="date"
              {...register("act_valabil_pana")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-cnp`} className={claseLabel}>
              CNP
            </label>
            <input
              id={`${idFormular}-cnp`}
              {...register("cnp")}
              inputMode="numeric"
              maxLength={13}
              aria-invalid={Boolean(errors.cnp)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-cnp-eroare`} mesaj={errors.cnp?.message} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Situație personală</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${idFormular}-handicap`} className={claseLabel}>
              Grad de handicap
            </label>
            <input
              id={`${idFormular}-handicap`}
              {...register("grad_handicap")}
              placeholder="— fără —"
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-intretinere`} className={claseLabel}>
              Persoane în întreținere
            </label>
            <input
              id={`${idFormular}-intretinere`}
              type="number"
              min={0}
              max={20}
              {...register("nr_persoane_intretinere")}
              className={claseCamp}
            />
          </div>
          <div className="flex items-end pb-2">
            <div className="flex items-center gap-2">
              <input
                id={`${idFormular}-pilon-ii`}
                type="checkbox"
                {...register("optiune_pilon_ii")}
                className="border-border size-4 rounded"
              />
              <label htmlFor={`${idFormular}-pilon-ii`} className="text-foreground text-sm">
                Optează pentru Pilonul II
              </label>
            </div>
          </div>
        </div>
      </fieldset>

      {esteStrain ? (
        <fieldset className="border-border space-y-4 rounded-lg border p-4">
          <legend className="text-foreground px-1 text-sm font-medium">
            Dreptul de muncă (cetățean străin)
          </legend>
          <p className="text-muted-foreground text-sm">
            Munca fără permis valabil e contravenție pentru angajator. Completat aici, permisul
            intră în tabloul de expirabile și avertizează înainte de termen.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${idFormular}-permis-tip`} className={claseLabel}>
                Tipul permisului
              </label>
              <select
                id={`${idFormular}-permis-tip`}
                {...register("permis_tip")}
                className={claseCamp}
              >
                <option value="">— Alegeți —</option>
                <option value="aviz">Aviz de angajare</option>
                <option value="permis_unic">Permis unic</option>
                <option value="detasare">Detașare</option>
                <option value="sezonier">Lucrător sezonier</option>
              </select>
              <Eroare id={`${idFormular}-permis-tip-eroare`} mesaj={errors.permis_tip?.message} />
            </div>
            <div>
              <label htmlFor={`${idFormular}-permis-numar`} className={claseLabel}>
                Numărul permisului
              </label>
              <input
                id={`${idFormular}-permis-numar`}
                {...register("permis_numar")}
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-permis-numar-eroare`}
                mesaj={errors.permis_numar?.message}
              />
            </div>
            <div>
              <label htmlFor={`${idFormular}-permis-emitent`} className={claseLabel}>
                Emis de
              </label>
              <input
                id={`${idFormular}-permis-emitent`}
                {...register("permis_emis_de")}
                placeholder="ex. IGI"
                className={claseCamp}
              />
            </div>
            <div>
              <label htmlFor={`${idFormular}-pasaport`} className={claseLabel}>
                Număr pașaport
              </label>
              <input
                id={`${idFormular}-pasaport`}
                {...register("numar_pasaport")}
                className={claseCamp}
              />
            </div>
            <div>
              <label htmlFor={`${idFormular}-permis-de-la`} className={claseLabel}>
                Valabil de la
              </label>
              <input
                id={`${idFormular}-permis-de-la`}
                type="date"
                {...register("permis_valabil_de_la")}
                className={claseCamp}
              />
            </div>
            <div>
              <label htmlFor={`${idFormular}-permis-pana`} className={claseLabel}>
                Valabil până la
              </label>
              <input
                id={`${idFormular}-permis-pana`}
                type="date"
                {...register("permis_valabil_pana")}
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-permis-pana-eroare`}
                mesaj={errors.permis_valabil_pana?.message}
              />
            </div>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
