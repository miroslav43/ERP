// src/app/(app)/angajati/nou/_components/pas-5-bunuri-certificari.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import { REZULTATE_EXAMEN, TIPURI_EXAMEN } from "@/schemas/ssm";
import type { InroleazaAngajatInput } from "@/schemas/employee";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

export const CAMPURI_PAS_5 = [
  "inventory_item_id",
  "examen_data",
  "examen_tip",
  "examen_rezultat",
  "examen_valabil_pana",
  "examen_medic",
  "examen_unitate_medicala",
  "examen_numar_fisa",
  "autorizatie_tip",
  "autorizatie_numar",
  "autorizatie_emitent",
  "autorizatie_valabil_pana",
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
    formState: { errors },
  } = formular;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Toți acești pași sunt opționali — se pot completa oricând ulterior, din ecranele
        dedicate (Inventar, SSM).
      </p>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Bun alocat</legend>
        <div>
          <label htmlFor={`${idFormular}-inventar`} className={claseLabel}>
            Obiect de inventar
          </label>
          <select id={`${idFormular}-inventar`} {...register("inventory_item_id")} className={claseCamp}>
            <option value="">— Niciunul —</option>
            {obiecteDisponibile.map((obiect) => (
              <option key={obiect.id} value={obiect.id}>
                {obiect.denumire} ({obiect.numar_inventar})
              </option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            Mașina de serviciu se alocă separat, din modulul Parc auto.
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
            <select id={`${idFormular}-examen-tip`} {...register("examen_tip")} className={claseCamp}>
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
            <input id={`${idFormular}-examen-medic`} {...register("examen_medic")} className={claseCamp} />
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
        <legend className="text-foreground px-1 text-sm font-medium">Autorizație nominală</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-autorizatie-tip`} className={claseLabel}>
              Tip
            </label>
            <input
              id={`${idFormular}-autorizatie-tip`}
              {...register("autorizatie_tip")}
              placeholder="ex. ISCIR, lucru la înălțime"
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-autorizatie-numar`} className={claseLabel}>
              Număr
            </label>
            <input
              id={`${idFormular}-autorizatie-numar`}
              {...register("autorizatie_numar")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-autorizatie-emitent`} className={claseLabel}>
              Emitent
            </label>
            <input
              id={`${idFormular}-autorizatie-emitent`}
              {...register("autorizatie_emitent")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-autorizatie-valabil`} className={claseLabel}>
              Valabilă până la
            </label>
            <input
              id={`${idFormular}-autorizatie-valabil`}
              type="date"
              {...register("autorizatie_valabil_pana")}
              aria-invalid={Boolean(errors.autorizatie_valabil_pana)}
              className={claseCamp}
            />
            <Eroare
              id={`${idFormular}-autorizatie-valabil-eroare`}
              mesaj={errors.autorizatie_valabil_pana?.message}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
