"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CATEGORII_VEHICUL, COMBUSTIBILI } from "@/schemas/fleet";

import { creeazaVehicul } from "../actions";
import { ETICHETE_CATEGORIE, ETICHETE_COMBUSTIBIL } from "../etichete";

export function FormularVehicul() {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    nr: useId(),
    marca: useId(),
    model: useId(),
    vin: useId(),
    categorie: useId(),
    combustibil: useId(),
    an: useId(),
    consum: useId(),
    prag: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => String(formular.get(cheie) ?? "").trim();
    const numar = (cheie: string) => {
      const v = text(cheie);
      return v.length === 0 ? null : Number(v);
    };

    porneste(async () => {
      const rezultat = await creeazaVehicul({
        nr_inmatriculare: text("nr_inmatriculare"),
        marca: text("marca"),
        model: text("model"),
        vin: text("vin"),
        categorie: text("categorie"),
        tip_combustibil: text("tip_combustibil"),
        an_fabricatie: numar("an_fabricatie"),
        culoare: text("culoare").length === 0 ? null : text("culoare"),
        consum_mediu_declarat: numar("consum_mediu_declarat"),
        employee_id: null,
        department_id: null,
        data_achizitie: text("data_achizitie").length === 0 ? null : text("data_achizitie"),
        valoare_achizitie: numar("valoare_achizitie"),
        prag_salt_km: numar("prag_salt_km"),
        observatii: null,
      });

      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/flota/${rezultat.data.id}`);
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Camp id={id.nr} nume="nr_inmatriculare" eticheta="Număr de înmatriculare" obligatoriu />
        <Camp id={id.marca} nume="marca" eticheta="Marca" obligatoriu />
        <Camp id={id.model} nume="model" eticheta="Model" obligatoriu />
        <Camp
          id={id.vin}
          nume="vin"
          eticheta="VIN"
          ajutor="17 caractere, fără literele I, O și Q."
        />

        <div className="flex flex-col gap-1">
          <label htmlFor={id.categorie} className="text-sm font-medium">
            Categorie
          </label>
          <select
            id={id.categorie}
            name="categorie"
            defaultValue="autoturism"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {CATEGORII_VEHICUL.map((c) => (
              <option key={c} value={c}>
                {ETICHETE_CATEGORIE[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.combustibil} className="text-sm font-medium">
            Combustibil
          </label>
          <select
            id={id.combustibil}
            name="tip_combustibil"
            defaultValue="motorina"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {COMBUSTIBILI.map((c) => (
              <option key={c} value={c}>
                {ETICHETE_COMBUSTIBIL[c]}
              </option>
            ))}
          </select>
        </div>

        <Camp id={id.an} nume="an_fabricatie" eticheta="An fabricație" tip="number" />
        <Camp
          id={id.consum}
          nume="consum_mediu_declarat"
          eticheta="Consum declarat (l/100 km)"
          tip="number"
          pas="0.1"
        />
        <Camp
          id={id.prag}
          nume="prag_salt_km"
          eticheta="Prag salt kilometraj"
          tip="number"
          ajutor="Peste câți kilometri o diferență devine anomalie. Gol = pragul implicit."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {inCurs ? "Se salvează…" : "Adaugă vehiculul"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}

function Camp({
  id,
  nume,
  eticheta,
  tip = "text",
  pas,
  obligatoriu = false,
  ajutor,
}: {
  readonly id: string;
  readonly nume: string;
  readonly eticheta: string;
  readonly tip?: string;
  readonly pas?: string;
  readonly obligatoriu?: boolean;
  readonly ajutor?: string;
}) {
  const idAjutor = `${id}-ajutor`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {eticheta}
        {obligatoriu ? (
          <span aria-hidden="true" className="text-red-700 dark:text-red-400">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={nume}
        type={tip}
        step={pas}
        required={obligatoriu}
        aria-describedby={ajutor === undefined ? undefined : idAjutor}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {ajutor === undefined ? null : (
        <p id={idAjutor} className="text-xs text-zinc-500 dark:text-zinc-400">
          {ajutor}
        </p>
      )}
    </div>
  );
}
