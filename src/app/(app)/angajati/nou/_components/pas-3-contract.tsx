// src/app/(app)/angajati/nou/_components/pas-3-contract.tsx
"use client";

import { useEffect, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Camp } from "@/components/ui/camp";
import {
  CONDITII_MUNCA,
  DURATE_CONTRACT,
  MODURI_LUCRU,
  REGIMURI_SPECIALE,
  type InroleazaAngajatInput,
} from "@/schemas/employee";
import {
  ETICHETE_CONDITII_MUNCA,
  ETICHETE_DURATA_CONTRACT,
  ETICHETE_MOD_LUCRU,
  ETICHETE_REGIM_SPECIAL,
} from "../../etichete";
import { mesajCamp } from "./erori-formular";
import { CautaCor } from "@/components/cauta-cor";
import { DepartamentNou } from "./departament-nou";

export const CAMPURI_PAS_3 = [
  "department_id",
  "functie",
  "cod_cor",
  "manager_employee_id",
  "hired_on",
  "conditii_munca",
  "numar",
  "data_contract",
  "valabil_de_la",
  "valabil_pana",
  "contract_duration",
  "motiv_determinat",
  "norma_ore_saptamana",
  "norma_ore_zi",
  "work_mode",
  "special_regime",
  "loc_telemunca",
  "loc_munca",
  "punct_lucru_id",
  "salariu_baza",
  "moneda",
  "zile_concediu_anual",
  "perioada_proba_zile",
  "preaviz_zile",
  "iban",
  "banca",
] as const satisfies readonly (keyof InroleazaAngajatInput)[];

interface Optiune {
  readonly id: string;
  readonly denumire: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
}

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
  readonly departamente: readonly Optiune[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly puncteLucru: readonly Optiune[];
  /** Următorul număr liber, doar ca text de ajutor. Alocarea reală e la salvare. */
  readonly numarUrmator: string | null;
}

/** Santinela din `<select>` pentru „locul nu e nici sediul, nici un punct de lucru". */
const ALTA_LOCATIE = "ALTA";

export function Pas3Contract({
  formular,
  departamente,
  angajati,
  puncteLucru,
  numarUrmator,
}: Proprietati) {
  const {
    register,
    control,
    setValue,
    formState: { errors, dirtyFields },
  } = formular;
  // `useWatch`, NU `formular.watch(…)`. `watch` abonează doar componenta care
  // apelează `useForm` (asistentul), nu și pașii lui, iar cu React Compiler
  // activ pasul primește props cu identitate stabilă, e memoizat și nu se mai
  // re-randează după montare. Cele două câmpuri condiționate de mai jos —
  // „Până la” pentru contractul pe durată determinată și „Locul desfășurării
  // activității” pentru telemuncă — sunt AMBELE obligatorii: nu apăreau
  // niciodată, iar validarea pica apoi pe un câmp invizibil.
  /*
   * Departamentele CREATE în timpul înrolării, peste cele venite de pe server.
   *
   * Lista din props e un instantaneu de la randarea paginii; unul creat acum
   * n-ar apărea în ea până la o navigare, adică exact lucrul pe care caseta îl
   * evită. Se ține local și se concatenează la afișare.
   */
  const [departamenteNoi, setDepartamenteNoi] = useState<readonly Optiune[]>([]);
  const toateDepartamentele = [...departamente, ...departamenteNoi];

  const modLucru = useWatch({ control, name: "work_mode" });
  const durataContract = useWatch({ control, name: "contract_duration" });
  const valabilDeLa = useWatch({ control, name: "valabil_de_la" });
  const punctAles = useWatch({ control, name: "punct_lucru_id" });
  const esteLaDistanta = modLucru === "telemunca" || modLucru === "domiciliu";

  const [altaLocatie, setAltaLocatie] = useState(false);

  /*
   * Vechimea în unitate se completează singură din „Angajat de la".
   *
   * La o angajare obișnuită sunt aceeași dată, iar a doua oară e muncă în plus.
   * `dirtyFields` e discriminantul: în clipa în care omul atinge câmpul,
   * oglindirea se oprește definitiv — cazul reangajării, unde vechimea e mai
   * veche decât contractul.
   *
   * `setValue`, nu `setState`: React Compiler interzice al doilea într-un efect
   * (`react-hooks/set-state-in-effect`), fiindcă produce randări în cascadă.
   */
  useEffect(() => {
    if (dirtyFields.hired_on === true) return;
    if (typeof valabilDeLa !== "string" || valabilDeLa === "") return;
    setValue("hired_on", valabilDeLa, { shouldDirty: false });
  }, [valabilDeLa, dirtyFields.hired_on, setValue]);

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Organizare</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Camp
              nume="department_id"
              eticheta="Departament"
              fel="select"
              erori={mesajCamp(errors.department_id)}
            >
              {(atribute) => (
                <select {...atribute} {...register("department_id")}>
                  <option value="">— Nealocat —</option>
                  {toateDepartamentele.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.denumire}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            {/* Departamentul apare abia aici. Fără caseta asta, unul care
                lipsește însemna abandonarea a tot ce s-a completat. */}
            <DepartamentNou
              laCreare={(departament) => {
                setDepartamenteNoi((anterioare) => [...anterioare, departament]);
                setValue("department_id", departament.id, { shouldDirty: true });
              }}
            />
          </div>
          <Camp
            nume="functie"
            eticheta="Funcție"
            erori={mesajCamp(errors.functie)}
            ajutor="Apare în contract și în adeverințe. Fără ea, documentele ies cu rubrica goală."
          >
            {(atribute) => (
              <input
                {...atribute}
                {...register("functie")}
                type="text"
                maxLength={160}
                placeholder="Sudor, Operator producție, Director general…"
              />
            )}
          </Camp>
          {/*
            Codul COR e câmp propriu, nu dedus din denumire: el ajunge pe
            contract și în REVISAL, iar `domain/reges/export.ts` refuză
            contractul fără el. `CautaCor` randează chiar un `<input
            name="cod_cor">`, deci `register` îl leagă ca pe orice câmp.
          */}
          <Camp
            nume="cod_cor"
            eticheta="Cod COR"
            erori={mesajCamp(errors.cod_cor)}
            ajutor="Șase cifre din Clasificarea Ocupațiilor din România. Fără el, contractul NU se poate transmite la REGES."
          >
            {(atribute) => (
              <CautaCor
                idInput={atribute.id}
                invalid={atribute["aria-invalid"] === true}
                descrisDe={atribute["aria-describedby"]}
                laText={(valoare) => {
                  setValue("cod_cor", valoare.trim() === "" ? null : valoare.trim(), {
                    shouldValidate: true,
                  });
                }}
              />
            )}
          </Camp>
          <Camp
            nume="manager_employee_id"
            eticheta="Manager direct"
            fel="select"
            erori={mesajCamp(errors.manager_employee_id)}
          >
            {(atribute) => (
              <select {...atribute} {...register("manager_employee_id")}>
                <option value="">— Fără —</option>
                {angajati.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="conditii_munca"
            eticheta="Condiții de muncă"
            fel="select"
            erori={mesajCamp(errors.conditii_munca)}
          >
            {(atribute) => (
              <select {...atribute} {...register("conditii_munca")}>
                {CONDITII_MUNCA.map((c) => (
                  <option key={c} value={c}>
                    {ETICHETE_CONDITII_MUNCA[c]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Contractul de muncă</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="numar"
            eticheta="Număr contract"
            erori={mesajCamp(errors.numar)}
            ajutor={
              numarUrmator === null
                ? "Lăsat gol, se alocă automat la salvare."
                : `Lăsat gol, primește automat ${numarUrmator}. Completați doar pentru un contract preluat prin transfer sau importat.`
            }
          >
            {(atribute) => (
              <input
                {...atribute}
                {...register("numar")}
                placeholder={numarUrmator ?? "se alocă automat"}
              />
            )}
          </Camp>
          <Camp
            nume="data_contract"
            eticheta="Data contractului"
            obligatoriu
            erori={mesajCamp(errors.data_contract)}
          >
            {(atribute) => <input {...atribute} type="date" {...register("data_contract")} />}
          </Camp>
          <Camp
            nume="valabil_de_la"
            eticheta="Angajat de la (valabil de la)"
            obligatoriu
            erori={mesajCamp(errors.valabil_de_la)}
            ajutor="Începutul legal al acestui contract. Merge la REGES și în contractul generat."
          >
            {(atribute) => <input {...atribute} type="date" {...register("valabil_de_la")} />}
          </Camp>
          <Camp
            nume="hired_on"
            eticheta="Vechime în unitate din"
            obligatoriu
            erori={mesajCamp(errors.hired_on)}
            ajutor="Se completează singură din „Angajat de la”. Schimbați-o doar la reangajare sau la preluare prin transfer — din ea se calculează vechimea și adeverințele."
          >
            {(atribute) => <input {...atribute} type="date" {...register("hired_on")} />}
          </Camp>
          <Camp
            nume="contract_duration"
            eticheta="Durata contractului"
            fel="select"
            erori={mesajCamp(errors.contract_duration)}
          >
            {(atribute) => (
              <select {...atribute} {...register("contract_duration")}>
                {DURATE_CONTRACT.map((d) => (
                  <option key={d} value={d}>
                    {ETICHETE_DURATA_CONTRACT[d]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          {durataContract === "determinat" ? (
            <>
              <Camp
                nume="valabil_pana"
                eticheta="Până la"
                obligatoriu
                erori={mesajCamp(errors.valabil_pana)}
              >
                {(atribute) => <input {...atribute} type="date" {...register("valabil_pana")} />}
              </Camp>
              <Camp
                nume="motiv_determinat"
                eticheta="Motivul duratei determinate"
                erori={mesajCamp(errors.motiv_determinat)}
              >
                {(atribute) => <input {...atribute} {...register("motiv_determinat")} />}
              </Camp>
            </>
          ) : null}
          <Camp
            nume="norma_ore_saptamana"
            eticheta="Normă (ore/săptămână)"
            erori={mesajCamp(errors.norma_ore_saptamana)}
          >
            {(atribute) => (
              <input
                {...atribute}
                type="number"
                step="0.5"
                min={0.5}
                max={48}
                {...register("norma_ore_saptamana")}
              />
            )}
          </Camp>
          <Camp
            nume="norma_ore_zi"
            eticheta="Normă (ore/zi)"
            erori={mesajCamp(errors.norma_ore_zi)}
          >
            {(atribute) => (
              <input
                {...atribute}
                type="number"
                step="0.5"
                min={0.5}
                max={12}
                {...register("norma_ore_zi")}
              />
            )}
          </Camp>
          <Camp
            nume="work_mode"
            eticheta="Mod de lucru"
            fel="select"
            erori={mesajCamp(errors.work_mode)}
          >
            {(atribute) => (
              <select {...atribute} {...register("work_mode")}>
                {MODURI_LUCRU.map((m) => (
                  <option key={m} value={m}>
                    {ETICHETE_MOD_LUCRU[m] ?? m}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          {esteLaDistanta ? (
            <Camp
              nume="loc_telemunca"
              eticheta="Locul desfășurării activității"
              obligatoriu
              erori={mesajCamp(errors.loc_telemunca)}
            >
              {(atribute) => <input {...atribute} {...register("loc_telemunca")} />}
            </Camp>
          ) : (
            <>
              {/*
                Locul muncii e clauză obligatorie a contractului (art. 17 alin. (3)
                lit. b) din Codul muncii). Până acum era text liber și nu ajungea
                deloc în documentul generat.

                `punct_lucru_id` NU trece prin `register`: santinela „Altă
                locație" nu e un uuid și ar cădea pe `uuidOptional`. Selecția e
                controlată, iar valoarea reală se scrie cu `setValue`.
              */}
              <Camp
                nume="punct_lucru_id"
                eticheta="Locul de muncă"
                fel="select"
                erori={mesajCamp(errors.punct_lucru_id)}
              >
                {(atribute) => (
                  <select
                    {...atribute}
                    value={altaLocatie ? ALTA_LOCATIE : (punctAles ?? "")}
                    onChange={(eveniment) => {
                      const aleasa = eveniment.target.value;
                      if (aleasa === ALTA_LOCATIE) {
                        setAltaLocatie(true);
                        setValue("punct_lucru_id", null, { shouldDirty: true });
                        return;
                      }
                      setAltaLocatie(false);
                      setValue("punct_lucru_id", aleasa === "" ? null : aleasa, {
                        shouldDirty: true,
                      });
                      // Textul liber nu are ce căuta pe o alegere din listă.
                      setValue("loc_munca", null, { shouldDirty: true });
                    }}
                  >
                    <option value="">— Sediul social —</option>
                    {puncteLucru.map((punct) => (
                      <option key={punct.id} value={punct.id}>
                        {punct.denumire}
                      </option>
                    ))}
                    <option value={ALTA_LOCATIE}>Altă locație…</option>
                  </select>
                )}
              </Camp>
              {altaLocatie ? (
                <Camp
                  nume="loc_munca"
                  eticheta="Care anume"
                  obligatoriu
                  erori={mesajCamp(errors.loc_munca)}
                  ajutor="Șantier, punct de delegare, o locație care nu merită înregistrată la ONRC."
                >
                  {(atribute) => <input {...atribute} {...register("loc_munca")} />}
                </Camp>
              ) : null}
            </>
          )}
          <Camp
            nume="special_regime"
            eticheta="Regim special"
            fel="select"
            erori={mesajCamp(errors.special_regime)}
          >
            {(atribute) => (
              <select {...atribute} {...register("special_regime")}>
                <option value="">— Niciunul —</option>
                {REGIMURI_SPECIALE.map((r) => (
                  <option key={r} value={r}>
                    {ETICHETE_REGIM_SPECIAL[r]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="perioada_proba_zile"
            eticheta="Perioadă de probă (zile)"
            erori={mesajCamp(errors.perioada_proba_zile)}
          >
            {(atribute) => (
              <input
                {...atribute}
                type="number"
                min={0}
                max={365}
                {...register("perioada_proba_zile")}
              />
            )}
          </Camp>
          <Camp
            nume="preaviz_zile"
            eticheta="Preaviz (zile)"
            erori={mesajCamp(errors.preaviz_zile)}
          >
            {(atribute) => (
              <input {...atribute} type="number" min={0} max={365} {...register("preaviz_zile")} />
            )}
          </Camp>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Salarizare</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="salariu_baza"
            eticheta="Salariu de bază brut (lunar)"
            obligatoriu
            erori={mesajCamp(errors.salariu_baza)}
          >
            {(atribute) => (
              <input
                {...atribute}
                type="number"
                step="0.01"
                min={0}
                {...register("salariu_baza")}
              />
            )}
          </Camp>
          <Camp nume="moneda" eticheta="Monedă" erori={mesajCamp(errors.moneda)}>
            {(atribute) => <input {...atribute} maxLength={3} {...register("moneda")} />}
          </Camp>
          <Camp
            nume="zile_concediu_anual"
            eticheta="Zile de concediu de odihnă anual"
            erori={mesajCamp(errors.zile_concediu_anual)}
            ajutor="Implicit conform politicii organizației — modificabil aici doar pentru acest angajat."
          >
            {(atribute) => (
              <input
                {...atribute}
                type="number"
                min={0}
                max={60}
                {...register("zile_concediu_anual")}
              />
            )}
          </Camp>
          <Camp
            nume="iban"
            eticheta="IBAN"
            erori={mesajCamp(errors.iban)}
            ajutor="Fără el, salariatul nu intră în fișierul bancar și se plătește manual."
          >
            {(atribute) => <input {...atribute} {...register("iban")} />}
          </Camp>
          <Camp nume="banca" eticheta="Bancă" erori={mesajCamp(errors.banca)}>
            {(atribute) => <input {...atribute} {...register("banca")} />}
          </Camp>
        </div>
      </fieldset>
    </div>
  );
}
