// src/app/(app)/angajati/nou/_components/pas-3-contract.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import {
  CONDITII_MUNCA,
  DURATE_CONTRACT,
  MODURI_LUCRU,
  REGIMURI_SPECIALE,
  type InroleazaAngajatInput,
} from "@/schemas/employee";
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

export const CAMPURI_PAS_3 = [
  "department_id",
  "job_position_id",
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
  readonly idFormular: string;
  readonly departamente: readonly Optiune[];
  readonly functii: readonly Optiune[];
  readonly angajati: readonly OptiuneAngajat[];
}

export function Pas3Contract({
  formular,
  idFormular,
  departamente,
  functii,
  angajati,
}: Proprietati) {
  const {
    register,
    control,
    formState: { errors },
  } = formular;
  // `useWatch`, NU `formular.watch(…)`. `watch` abonează doar componenta care
  // apelează `useForm` (asistentul), nu și pașii lui, iar cu React Compiler
  // activ pasul primește props cu identitate stabilă, e memoizat și nu se mai
  // re-randează după montare. Cele două câmpuri condiționate de mai jos —
  // „Până la” pentru contractul pe durată determinată și „Locul desfășurării
  // activității” pentru telemuncă — sunt AMBELE obligatorii: nu apăreau
  // niciodată, iar validarea pica apoi pe un câmp invizibil.
  const modLucru = useWatch({ control, name: "work_mode" });
  const durataContract = useWatch({ control, name: "contract_duration" });

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Organizare</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-departament`} className={claseLabel}>
              Departament
            </label>
            <select
              id={`${idFormular}-departament`}
              {...register("department_id")}
              className={claseCamp}
            >
              <option value="">— Nealocat —</option>
              {departamente.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.denumire}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-functie`} className={claseLabel}>
              Funcție
            </label>
            <select
              id={`${idFormular}-functie`}
              {...register("job_position_id")}
              className={claseCamp}
            >
              <option value="">— Nealocată —</option>
              {functii.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.denumire}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-manager`} className={claseLabel}>
              Manager direct
            </label>
            <select
              id={`${idFormular}-manager`}
              {...register("manager_employee_id")}
              className={claseCamp}
            >
              <option value="">— Fără —</option>
              {angajati.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-conditii`} className={claseLabel}>
              Condiții de muncă
            </label>
            <select
              id={`${idFormular}-conditii`}
              {...register("conditii_munca")}
              className={claseCamp}
            >
              {CONDITII_MUNCA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Contractul de muncă</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-numar`} className={claseLabel}>
              Număr contract *
            </label>
            <input
              id={`${idFormular}-numar`}
              {...register("numar")}
              aria-invalid={Boolean(errors.numar)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-numar-eroare`} mesaj={errors.numar?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-data-contract`} className={claseLabel}>
              Data contractului *
            </label>
            <input
              id={`${idFormular}-data-contract`}
              type="date"
              {...register("data_contract")}
              aria-invalid={Boolean(errors.data_contract)}
              className={claseCamp}
            />
            <Eroare
              id={`${idFormular}-data-contract-eroare`}
              mesaj={errors.data_contract?.message}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-valabil-de-la`} className={claseLabel}>
              Angajat de la (valabil de la) *
            </label>
            <input
              id={`${idFormular}-valabil-de-la`}
              type="date"
              {...register("valabil_de_la")}
              aria-invalid={Boolean(errors.valabil_de_la)}
              className={claseCamp}
            />
            <Eroare
              id={`${idFormular}-valabil-de-la-eroare`}
              mesaj={errors.valabil_de_la?.message}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-hired-on`} className={claseLabel}>
              Data angajării (fișă)
            </label>
            <input
              id={`${idFormular}-hired-on`}
              type="date"
              {...register("hired_on")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-durata`} className={claseLabel}>
              Durata contractului
            </label>
            <select
              id={`${idFormular}-durata`}
              {...register("contract_duration")}
              className={claseCamp}
            >
              {DURATE_CONTRACT.map((d) => (
                <option key={d} value={d}>
                  {d === "nedeterminat" ? "Nedeterminată" : "Determinată"}
                </option>
              ))}
            </select>
          </div>
          {durataContract === "determinat" ? (
            <>
              <div>
                <label htmlFor={`${idFormular}-valabil-pana`} className={claseLabel}>
                  Până la *
                </label>
                <input
                  id={`${idFormular}-valabil-pana`}
                  type="date"
                  {...register("valabil_pana")}
                  aria-invalid={Boolean(errors.valabil_pana)}
                  className={claseCamp}
                />
                <Eroare
                  id={`${idFormular}-valabil-pana-eroare`}
                  mesaj={errors.valabil_pana?.message}
                />
              </div>
              <div>
                <label htmlFor={`${idFormular}-motiv-determinat`} className={claseLabel}>
                  Motivul duratei determinate
                </label>
                <input
                  id={`${idFormular}-motiv-determinat`}
                  {...register("motiv_determinat")}
                  className={claseCamp}
                />
              </div>
            </>
          ) : null}
          <div>
            <label htmlFor={`${idFormular}-norma-saptamana`} className={claseLabel}>
              Normă (ore/săptămână)
            </label>
            <input
              id={`${idFormular}-norma-saptamana`}
              type="number"
              step="0.5"
              min={0.5}
              max={48}
              {...register("norma_ore_saptamana")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-norma-zi`} className={claseLabel}>
              Normă (ore/zi)
            </label>
            <input
              id={`${idFormular}-norma-zi`}
              type="number"
              step="0.5"
              min={0.5}
              max={12}
              {...register("norma_ore_zi")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-mod-lucru`} className={claseLabel}>
              Mod de lucru
            </label>
            <select id={`${idFormular}-mod-lucru`} {...register("work_mode")} className={claseCamp}>
              {MODURI_LUCRU.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {modLucru === "telemunca" || modLucru === "domiciliu" ? (
            <div>
              <label htmlFor={`${idFormular}-loc-telemunca`} className={claseLabel}>
                Locul desfășurării activității *
              </label>
              <input
                id={`${idFormular}-loc-telemunca`}
                {...register("loc_telemunca")}
                aria-invalid={Boolean(errors.loc_telemunca)}
                className={claseCamp}
              />
              <Eroare
                id={`${idFormular}-loc-telemunca-eroare`}
                mesaj={errors.loc_telemunca?.message}
              />
            </div>
          ) : (
            <div>
              <label htmlFor={`${idFormular}-loc-munca`} className={claseLabel}>
                Locul de muncă
              </label>
              <input
                id={`${idFormular}-loc-munca`}
                {...register("loc_munca")}
                className={claseCamp}
              />
            </div>
          )}
          <div>
            <label htmlFor={`${idFormular}-regim-special`} className={claseLabel}>
              Regim special
            </label>
            <select
              id={`${idFormular}-regim-special`}
              {...register("special_regime")}
              className={claseCamp}
            >
              <option value="">— Niciunul —</option>
              {REGIMURI_SPECIALE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idFormular}-perioada-proba`} className={claseLabel}>
              Perioadă de probă (zile)
            </label>
            <input
              id={`${idFormular}-perioada-proba`}
              type="number"
              min={0}
              max={365}
              {...register("perioada_proba_zile")}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-preaviz`} className={claseLabel}>
              Preaviz (zile)
            </label>
            <input
              id={`${idFormular}-preaviz`}
              type="number"
              min={0}
              max={365}
              {...register("preaviz_zile")}
              className={claseCamp}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Salarizare</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-salariu`} className={claseLabel}>
              Salariu de bază brut (lunar) *
            </label>
            <input
              id={`${idFormular}-salariu`}
              type="number"
              step="0.01"
              min={0}
              {...register("salariu_baza")}
              aria-invalid={Boolean(errors.salariu_baza)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-salariu-eroare`} mesaj={errors.salariu_baza?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-moneda`} className={claseLabel}>
              Monedă
            </label>
            <input
              id={`${idFormular}-moneda`}
              {...register("moneda")}
              maxLength={3}
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-zile-concediu`} className={claseLabel}>
              Zile de concediu de odihnă anual
            </label>
            <input
              id={`${idFormular}-zile-concediu`}
              type="number"
              min={0}
              max={60}
              {...register("zile_concediu_anual")}
              className={claseCamp}
            />
            <p className="text-muted-foreground text-nota mt-1">
              Implicit conform politicii organizației — modificabil aici doar pentru acest angajat.
            </p>
          </div>
          <div>
            <label htmlFor={`${idFormular}-iban`} className={claseLabel}>
              IBAN
            </label>
            <input
              id={`${idFormular}-iban`}
              {...register("iban")}
              aria-invalid={Boolean(errors.iban)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-iban-eroare`} mesaj={errors.iban?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-banca`} className={claseLabel}>
              Bancă
            </label>
            <input id={`${idFormular}-banca`} {...register("banca")} className={claseCamp} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
