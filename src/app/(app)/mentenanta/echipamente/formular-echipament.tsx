"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { STATUS_ECHIPAMENT } from "@/schemas/maintenance";
import { ETICHETE_STATUS_ECHIPAMENT } from "../etichete";
import { actualizeazaEchipament, creeazaEchipament } from "../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export interface EchipamentEditabil {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly serie: string | null;
  readonly producator: string | null;
  readonly model: string | null;
  readonly an_fabricatie: number | null;
  readonly locatie: string | null;
  readonly department_id: string | null;
  readonly responsabil_employee_id: string | null;
  readonly status: string;
  readonly este_iscir: boolean;
  readonly tip_autorizare_necesara: string | null;
  readonly valoare_achizitie: number | null;
  readonly data_punerii_in_functiune: string | null;
  readonly derogare_motiv: string | null;
}

interface Proprietati {
  /** Absent ⇒ formular de creare. Prezent ⇒ formular de editare. */
  readonly echipament?: EchipamentEditabil;
  readonly angajati: readonly Optiune[];
  readonly departamente: readonly Optiune[];
  readonly ssmActiv: boolean;
  /** `can(permisiuni, "maintenance:update", "all")` — deschide câmpul de derogare. */
  readonly poateDerogare: boolean;
}

interface ValoriFormular {
  cod: string;
  denumire: string;
  serie: string;
  producator: string;
  model: string;
  an_fabricatie: string;
  locatie: string;
  department_id: string;
  responsabil_employee_id: string;
  status: string;
  este_iscir: boolean;
  tip_autorizare_necesara: string;
  valoare_achizitie: string;
  data_punerii_in_functiune: string;
  derogare_motiv: string;
}

const CLASA_CAMP = "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

function laText(valoare: string | null): string {
  return valoare ?? "";
}

/** Șir gol → `null`; altfel șirul curățat. Câmpurile `uuid` din schemă resping explicit `""`. */
function laIdOptional(valoare: string): string | null {
  const curatat = valoare.trim();
  return curatat.length === 0 ? null : curatat;
}

export function FormularEchipament({
  echipament,
  angajati,
  departamente,
  ssmActiv,
  poateDerogare,
}: Proprietati) {
  const router = useRouter();
  const modEditare = echipament !== undefined;
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const { register, handleSubmit, watch } = useForm<ValoriFormular>({
    defaultValues: {
      cod: echipament?.cod ?? "",
      denumire: echipament?.denumire ?? "",
      serie: laText(echipament?.serie ?? null),
      producator: laText(echipament?.producator ?? null),
      model: laText(echipament?.model ?? null),
      an_fabricatie:
        echipament?.an_fabricatie === null || echipament?.an_fabricatie === undefined
          ? ""
          : String(echipament.an_fabricatie),
      locatie: laText(echipament?.locatie ?? null),
      department_id: echipament?.department_id ?? "",
      responsabil_employee_id: echipament?.responsabil_employee_id ?? "",
      status: echipament?.status ?? "in_functiune",
      este_iscir: echipament?.este_iscir ?? false,
      tip_autorizare_necesara: laText(echipament?.tip_autorizare_necesara ?? null),
      valoare_achizitie:
        echipament?.valoare_achizitie === null || echipament?.valoare_achizitie === undefined
          ? ""
          : String(echipament.valoare_achizitie),
      data_punerii_in_functiune: laText(echipament?.data_punerii_in_functiune ?? null),
      derogare_motiv: laText(echipament?.derogare_motiv ?? null),
    },
  });

  const esteIscir = watch("este_iscir");

  function trimite(valori: ValoriFormular): void {
    setEroare(null);
    const intrare = {
      cod: valori.cod,
      denumire: valori.denumire,
      serie: laIdOptional(valori.serie),
      producator: laIdOptional(valori.producator),
      model: laIdOptional(valori.model),
      an_fabricatie: valori.an_fabricatie.trim().length === 0 ? null : Number(valori.an_fabricatie),
      locatie: laIdOptional(valori.locatie),
      department_id: laIdOptional(valori.department_id),
      responsabil_employee_id: laIdOptional(valori.responsabil_employee_id),
      status: valori.status,
      este_iscir: valori.este_iscir,
      tip_autorizare_necesara: laIdOptional(valori.tip_autorizare_necesara),
      valoare_achizitie:
        valori.valoare_achizitie.trim().length === 0 ? null : Number(valori.valoare_achizitie),
      data_punerii_in_functiune: laIdOptional(valori.data_punerii_in_functiune),
      derogare_motiv: laIdOptional(valori.derogare_motiv),
    };

    porneste(async () => {
      const rezultat =
        echipament === undefined
          ? await creeazaEchipament(intrare)
          : await actualizeazaEchipament({ id: echipament.id, ...intrare });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/mentenanta/echipamente/${rezultat.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="cod" className="block text-sm font-medium">
            Cod *
          </label>
          <input
            id="cod"
            type="text"
            autoComplete="off"
            className={CLASA_CAMP}
            {...register("cod", { required: true })}
          />
        </div>
        <div>
          <label htmlFor="denumire" className="block text-sm font-medium">
            Denumire *
          </label>
          <input
            id="denumire"
            type="text"
            autoComplete="off"
            className={CLASA_CAMP}
            {...register("denumire", { required: true })}
          />
        </div>
        <div>
          <label htmlFor="serie" className="block text-sm font-medium">
            Serie
          </label>
          <input id="serie" type="text" className={CLASA_CAMP} {...register("serie")} />
        </div>
        <div>
          <label htmlFor="producator" className="block text-sm font-medium">
            Producător
          </label>
          <input id="producator" type="text" className={CLASA_CAMP} {...register("producator")} />
        </div>
        <div>
          <label htmlFor="model" className="block text-sm font-medium">
            Model
          </label>
          <input id="model" type="text" className={CLASA_CAMP} {...register("model")} />
        </div>
        <div>
          <label htmlFor="an_fabricatie" className="block text-sm font-medium">
            An fabricație
          </label>
          <input
            id="an_fabricatie"
            type="number"
            min="1900"
            max="2200"
            className={CLASA_CAMP}
            {...register("an_fabricatie")}
          />
        </div>
        <div>
          <label htmlFor="locatie" className="block text-sm font-medium">
            Locație
          </label>
          <input id="locatie" type="text" className={CLASA_CAMP} {...register("locatie")} />
        </div>
        <div>
          <label htmlFor="department_id" className="block text-sm font-medium">
            Departament
          </label>
          <select id="department_id" className={CLASA_CAMP} {...register("department_id")}>
            <option value="">Fără departament</option>
            {departamente.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nume}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium">
            Stare
          </label>
          <select id="status" className={CLASA_CAMP} {...register("status")}>
            {STATUS_ECHIPAMENT.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS_ECHIPAMENT[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="data_punerii_in_functiune" className="block text-sm font-medium">
            Data punerii în funcțiune
          </label>
          <input
            id="data_punerii_in_functiune"
            type="date"
            className={CLASA_CAMP}
            {...register("data_punerii_in_functiune")}
          />
        </div>
        <div>
          <label htmlFor="valoare_achizitie" className="block text-sm font-medium">
            Valoare achiziție (lei)
          </label>
          <input
            id="valoare_achizitie"
            type="number"
            step="0.01"
            min="0"
            className={CLASA_CAMP}
            {...register("valoare_achizitie")}
          />
        </div>
      </div>

      <div className="border-border rounded-lg border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4" {...register("este_iscir")} />
          Echipament sub incidența ISCIR
        </label>

        {esteIscir ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tip_autorizare_necesara" className="block text-sm font-medium">
                Tipul de autorizație nominală necesară
              </label>
              <input
                id="tip_autorizare_necesara"
                type="text"
                placeholder="Ex. stivuitorist, macaragiu"
                className={CLASA_CAMP}
                {...register("tip_autorizare_necesara")}
              />
            </div>
            <div>
              <label htmlFor="responsabil_employee_id" className="block text-sm font-medium">
                Responsabil
              </label>
              <select
                id="responsabil_employee_id"
                className={CLASA_CAMP}
                {...register("responsabil_employee_id")}
              >
                <option value="">Fără responsabil</option>
                {angajati.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nume}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-foreground text-xs sm:col-span-2">
              {ssmActiv
                ? "Responsabilul trebuie să aibă o autorizație nominală valabilă pe acest tip, altfel baza va respinge salvarea — verificați-o în modulul SSM."
                : "Autorizațiile nominale se administrează în modulul SSM; fără el, un responsabil pe echipament ISCIR se poate desemna doar prin derogare motivată."}
            </p>

            {poateDerogare ? (
              <div className="sm:col-span-2">
                <label htmlFor="derogare_motiv" className="block text-sm font-medium">
                  Motivul derogării (minimum 20 de caractere)
                </label>
                <textarea
                  id="derogare_motiv"
                  rows={2}
                  placeholder="Se completează doar dacă responsabilul nu are (încă) o autorizație nominală valabilă."
                  className={CLASA_CAMP}
                  {...register("derogare_motiv")}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="responsabil_employee_id_simplu" className="block text-sm font-medium">
              Responsabil
            </label>
            <select
              id="responsabil_employee_id_simplu"
              className={CLASA_CAMP}
              {...register("responsabil_employee_id")}
            >
              <option value="">Fără responsabil</option>
              {angajati.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nume}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="border-danger bg-danger/8 text-danger rounded-md border p-3 text-sm">
            {eroare}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se salvează…" : modEditare ? "Salvează modificările" : "Adaugă echipamentul"}
      </button>
    </form>
  );
}
