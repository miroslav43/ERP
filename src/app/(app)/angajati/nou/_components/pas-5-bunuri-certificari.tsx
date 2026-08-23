// src/app/(app)/angajati/nou/_components/pas-5-bunuri-certificari.tsx
"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { REZULTATE_EXAMEN, TIPURI_EXAMEN } from "@/schemas/ssm";
import type { InroleazaAngajatInput } from "@/schemas/employee";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

export const CAMPURI_PAS_5 = [
  "inventory_item_ids",
  "examen_data",
  "examen_tip",
  "examen_rezultat",
  "examen_valabil_pana",
  "examen_medic",
  "examen_unitate_medicala",
  "examen_numar_fisa",
  "autorizatii",
] as const satisfies readonly (keyof InroleazaAngajatInput)[];

const ETICHETE_REZULTAT: Record<(typeof REZULTATE_EXAMEN)[number], string> = {
  apt: "Apt",
  apt_conditionat: "Apt condiționat",
  inapt_temporar: "Inapt temporar",
  inapt: "Inapt",
};

const ETICHETE_TIP_EXAMEN: Record<(typeof TIPURI_EXAMEN)[number], string> = {
  angajare: "La angajare",
  periodic: "Periodic",
  reluare: "La reluarea activității",
  adaptare: "De adaptare",
};

interface OptiuneInventar {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
}

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
  readonly idFormular: string;
  readonly obiecteDisponibile: readonly OptiuneInventar[];
}

export function Pas5BunuriCertificari({ formular, idFormular, obiecteDisponibile }: Proprietati) {
  const {
    register,
    control,
    formState: { errors },
  } = formular;

  // `useFieldArray` e tiparul react-hook-form pentru liste de sub-formulare.
  // Wizardul de înrolare e unul dintre cele patru fișiere din proiect care
  // folosesc react-hook-form (restul merg pe `useTransition` + `FormData`) —
  // aici era deja folosit, deci nu introduce o a doua convenție.
  const autorizatii = useFieldArray({ control, name: "autorizatii" });

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Toți acești pași sunt opționali — se pot completa oricând ulterior, din ecranele dedicate
        (Inventar, SSM).
      </p>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Bunuri alocate</legend>
        <div>
          <label htmlFor={`${idFormular}-inventar`} className={claseLabel}>
            Obiecte de inventar
          </label>
          <select
            id={`${idFormular}-inventar`}
            multiple
            size={Math.min(8, Math.max(3, obiecteDisponibile.length))}
            {...register("inventory_item_ids")}
            className={claseCamp}
          >
            {obiecteDisponibile.map((obiect) => (
              <option key={obiect.id} value={obiect.id}>
                {obiect.denumire} ({obiect.numar_inventar})
              </option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            Se pot alege mai multe, cu Ctrl (Cmd pe Mac). Mașina de serviciu se alocă separat, din
            modulul Parc auto.
          </p>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">
          Fișă de aptitudine (medicina muncii)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-examen-data`} className={claseLabel}>
              Data examinării
            </label>
            <input
              id={`${idFormular}-examen-data`}
              type="date"
              {...register("examen_data")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-examen-tip`} className={claseLabel}>
              Tip examen
            </label>
            <select
              id={`${idFormular}-examen-tip`}
              {...register("examen_tip")}
              className={claseCamp}
            >
              {TIPURI_EXAMEN.map((tip) => (
                <option key={tip} value={tip}>
                  {ETICHETE_TIP_EXAMEN[tip]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-examen-rezultat`} className={claseLabel}>
              Rezultat
            </label>
            <select
              id={`${idFormular}-examen-rezultat`}
              {...register("examen_rezultat")}
              className={claseCamp}
            >
              {REZULTATE_EXAMEN.map((rezultat) => (
                <option key={rezultat} value={rezultat}>
                  {ETICHETE_REZULTAT[rezultat]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-examen-valabil`} className={claseLabel}>
              Valabilă până la
            </label>
            <input
              id={`${idFormular}-examen-valabil`}
              type="date"
              {...register("examen_valabil_pana")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-examen-medic`} className={claseLabel}>
              Medic
            </label>
            <input
              id={`${idFormular}-examen-medic`}
              {...register("examen_medic")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-examen-unitate`} className={claseLabel}>
              Unitate medicală
            </label>
            <input
              id={`${idFormular}-examen-unitate`}
              {...register("examen_unitate_medicala")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-examen-numar`} className={claseLabel}>
              Număr fișă
            </label>
            <input
              id={`${idFormular}-examen-numar`}
              {...register("examen_numar_fisa")}
              className={claseCamp}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Autorizații nominale</legend>
        <p className="text-muted-foreground text-xs">
          ISCIR, lucru la înălțime, electrician autorizat… Fiecare are propria dată de expirare și
          intră în tabloul de expirabile, care avertizează înainte să iasă din valabilitate.
        </p>

        {autorizatii.fields.map((camp, index) => (
          <div
            key={camp.id}
            className="border-border grid gap-4 rounded-md border p-3 sm:grid-cols-2"
          >
            <div>
              <label
                htmlFor={`${idFormular}-autorizatie-${String(index)}-tip`}
                className={claseLabel}
              >
                Tip
              </label>
              <input
                id={`${idFormular}-autorizatie-${String(index)}-tip`}
                {...register(`autorizatii.${index}.tip` as const)}
                placeholder="ex. ISCIR, lucru la înălțime"
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-autorizatie-${String(index)}-tip-eroare`}
                mesaj={errors.autorizatii?.[index]?.tip?.message}
              />
            </div>
            <div>
              <label
                htmlFor={`${idFormular}-autorizatie-${String(index)}-numar`}
                className={claseLabel}
              >
                Număr
              </label>
              <input
                id={`${idFormular}-autorizatie-${String(index)}-numar`}
                {...register(`autorizatii.${index}.numar` as const)}
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-autorizatie-${String(index)}-numar-eroare`}
                mesaj={errors.autorizatii?.[index]?.numar?.message}
              />
            </div>
            <div>
              <label
                htmlFor={`${idFormular}-autorizatie-${String(index)}-emitent`}
                className={claseLabel}
              >
                Emitent
              </label>
              <input
                id={`${idFormular}-autorizatie-${String(index)}-emitent`}
                {...register(`autorizatii.${index}.emitent` as const)}
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-autorizatie-${String(index)}-emitent-eroare`}
                mesaj={errors.autorizatii?.[index]?.emitent?.message}
              />
            </div>
            <div>
              <label
                htmlFor={`${idFormular}-autorizatie-${String(index)}-valabil`}
                className={claseLabel}
              >
                Valabilă până la
              </label>
              <input
                id={`${idFormular}-autorizatie-${String(index)}-valabil`}
                type="date"
                {...register(`autorizatii.${index}.valabil_pana` as const)}
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-autorizatie-${String(index)}-valabil-eroare`}
                mesaj={errors.autorizatii?.[index]?.valabil_pana?.message}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => {
                  autorizatii.remove(index);
                }}
                className="border-border rounded-md border px-3 py-1.5 text-sm"
              >
                Scoate autorizația
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            autorizatii.append({ tip: "", numar: "", emitent: "", valabil_pana: "" });
          }}
          className="border-foreground/60 rounded-md border px-3 py-1.5 text-sm"
        >
          Adaugă o autorizație
        </button>
      </fieldset>
    </div>
  );
}
