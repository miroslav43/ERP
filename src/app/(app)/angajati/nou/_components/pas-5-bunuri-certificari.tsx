// src/app/(app)/angajati/nou/_components/pas-5-bunuri-certificari.tsx
"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { REZULTATE_EXAMEN, TIPURI_EXAMEN } from "@/schemas/ssm";
import type { InroleazaAngajatInput } from "@/schemas/employee";
import { mesajCamp } from "./erori-formular";

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
  readonly obiecteDisponibile: readonly OptiuneInventar[];
}

export function Pas5BunuriCertificari({ formular, obiecteDisponibile }: Proprietati) {
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
      <p className="text-muted-foreground text-corp">
        Toți acești pași sunt opționali — se pot completa oricând ulterior, din ecranele dedicate
        (Inventar, SSM).
      </p>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Bunuri alocate</legend>
        <Camp
          nume="inventory_item_ids"
          eticheta="Obiecte de inventar"
          fel="select"
          erori={mesajCamp(errors.inventory_item_ids)}
          ajutor="Se pot alege mai multe, cu Ctrl (Cmd pe Mac). Mașina de serviciu se alocă separat, din modulul Parc auto."
        >
          {(atribute) => (
            <select
              {...atribute}
              multiple
              size={Math.min(8, Math.max(3, obiecteDisponibile.length))}
              {...register("inventory_item_ids")}
            >
              {obiecteDisponibile.map((obiect) => (
                <option key={obiect.id} value={obiect.id}>
                  {obiect.denumire} ({obiect.numar_inventar})
                </option>
              ))}
            </select>
          )}
        </Camp>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">
          Fișă de aptitudine (medicina muncii)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp nume="examen_data" eticheta="Data examinării" erori={mesajCamp(errors.examen_data)}>
            {(atribute) => <input {...atribute} type="date" {...register("examen_data")} />}
          </Camp>
          <Camp
            nume="examen_tip"
            eticheta="Tip examen"
            fel="select"
            erori={mesajCamp(errors.examen_tip)}
          >
            {(atribute) => (
              <select {...atribute} {...register("examen_tip")}>
                {TIPURI_EXAMEN.map((tip) => (
                  <option key={tip} value={tip}>
                    {ETICHETE_TIP_EXAMEN[tip]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="examen_rezultat"
            eticheta="Rezultat"
            fel="select"
            erori={mesajCamp(errors.examen_rezultat)}
          >
            {(atribute) => (
              <select {...atribute} {...register("examen_rezultat")}>
                {REZULTATE_EXAMEN.map((rezultat) => (
                  <option key={rezultat} value={rezultat}>
                    {ETICHETE_REZULTAT[rezultat]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="examen_valabil_pana"
            eticheta="Valabilă până la"
            erori={mesajCamp(errors.examen_valabil_pana)}
          >
            {(atribute) => <input {...atribute} type="date" {...register("examen_valabil_pana")} />}
          </Camp>
          <Camp nume="examen_medic" eticheta="Medic" erori={mesajCamp(errors.examen_medic)}>
            {(atribute) => <input {...atribute} {...register("examen_medic")} />}
          </Camp>
          <Camp
            nume="examen_unitate_medicala"
            eticheta="Unitate medicală"
            erori={mesajCamp(errors.examen_unitate_medicala)}
          >
            {(atribute) => <input {...atribute} {...register("examen_unitate_medicala")} />}
          </Camp>
          <Camp
            nume="examen_numar_fisa"
            eticheta="Număr fișă"
            erori={mesajCamp(errors.examen_numar_fisa)}
          >
            {(atribute) => <input {...atribute} {...register("examen_numar_fisa")} />}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Autorizații nominale</legend>
        <p className="text-muted-foreground text-nota">
          ISCIR, lucru la înălțime, electrician autorizat… Fiecare are propria dată de expirare și
          intră în tabloul de expirabile, care avertizează înainte să iasă din valabilitate.
        </p>

        {/* Eroarea LISTEI, nu a unui rând: „Cel mult 20 de bunuri”, „Cel mult
            10 autorizații”, sau mesajul întors de server pe rădăcină — pe care
            `z.flattenError` îl colapsează acolo. Nu era randată nicăieri. */}
        {mesajCamp(errors.autorizatii).map((mesaj) => (
          <p key={mesaj} role="alert" className="text-danger text-nota">
            {mesaj}
          </p>
        ))}

        {autorizatii.fields.map((camp, index) => (
          <div
            key={camp.id}
            className="border-border rounded-control grid gap-4 border p-3 sm:grid-cols-2"
          >
            <Camp
              nume={`autorizatii.${String(index)}.tip`}
              eticheta="Tip"
              erori={mesajCamp(errors.autorizatii?.[index]?.tip)}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  {...register(`autorizatii.${index}.tip` as const)}
                  placeholder="ex. ISCIR, lucru la înălțime"
                />
              )}
            </Camp>
            <Camp
              nume={`autorizatii.${String(index)}.numar`}
              eticheta="Număr"
              erori={mesajCamp(errors.autorizatii?.[index]?.numar)}
            >
              {(atribute) => (
                <input {...atribute} {...register(`autorizatii.${index}.numar` as const)} />
              )}
            </Camp>
            <Camp
              nume={`autorizatii.${String(index)}.emitent`}
              eticheta="Emitent"
              erori={mesajCamp(errors.autorizatii?.[index]?.emitent)}
            >
              {(atribute) => (
                <input {...atribute} {...register(`autorizatii.${index}.emitent` as const)} />
              )}
            </Camp>
            <Camp
              nume={`autorizatii.${String(index)}.valabil_pana`}
              eticheta="Valabilă până la"
              erori={mesajCamp(errors.autorizatii?.[index]?.valabil_pana)}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  type="date"
                  {...register(`autorizatii.${index}.valabil_pana` as const)}
                />
              )}
            </Camp>
            <div className="sm:col-span-2">
              <Buton
                varianta="distructiv"
                onClick={() => {
                  autorizatii.remove(index);
                }}
              >
                Scoate autorizația
              </Buton>
            </div>
          </div>
        ))}

        <Buton
          varianta="secundar"
          onClick={() => {
            autorizatii.append({ tip: "", numar: "", emitent: "", valabil_pana: "" });
          }}
        >
          Adaugă o autorizație
        </Buton>
      </fieldset>
    </div>
  );
}
