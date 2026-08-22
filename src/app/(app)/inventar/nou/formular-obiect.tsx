"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { STARI_OBIECT } from "@/schemas/inventory";
import { ETICHETE_STARE } from "../etichete";
import { creeazaObiect } from "../actions";

interface Optiune {
  readonly id: string;
  readonly denumire: string;
}

interface Proprietati {
  readonly categorii: readonly Optiune[];
}

interface ValoriFormular {
  denumire: string;
  numar_inventar: string;
  serie: string;
  model: string;
  producator: string;
  category_id: string;
  data_achizitie: string;
  valoare: string;
  garantie_expira: string;
  stare: string;
  locatie: string;
  observatii: string;
}

const CLASA_CAMP = "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

export function FormularObiect({ categorii }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ValoriFormular>();

  function trimite(valori: ValoriFormular): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaObiect(valori);
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      const obiectCreat = rezultat.data as { readonly id: string };
      router.push(`/inventar/${obiectCreat.id}`);
    });
  }

  const campuriText: readonly (readonly [keyof ValoriFormular, string, string, boolean])[] = [
    ["denumire", "Denumire", "text", true],
    ["numar_inventar", "Număr de inventar", "text", true],
    ["serie", "Serie", "text", false],
    ["model", "Model", "text", false],
    ["producator", "Producător", "text", false],
    ["data_achizitie", "Data achiziției", "date", false],
    ["valoare", "Valoare (lei)", "number", false],
    ["garantie_expira", "Garanția expiră la", "date", false],
    ["locatie", "Locație", "text", false],
  ];

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campuriText.map(([nume, eticheta, tip, obligatoriu]) => (
          <div key={nume}>
            <label htmlFor={nume} className="block text-sm font-medium">
              {eticheta}
              {obligatoriu ? <span aria-hidden="true"> *</span> : null}
            </label>
            <input
              id={nume}
              type={tip}
              step={tip === "number" ? "0.01" : undefined}
              min={tip === "number" ? "0" : undefined}
              autoComplete="off"
              aria-required={obligatoriu}
              className={CLASA_CAMP}
              {...register(
                nume,
                obligatoriu ? { required: `Câmpul „${eticheta}” este obligatoriu.` } : {},
              )}
            />
            {formState.errors[nume] !== undefined ? (
              <p className="text-danger mt-1 text-xs">{formState.errors[nume]?.message}</p>
            ) : null}
          </div>
        ))}

        <div>
          <label htmlFor="category_id" className="block text-sm font-medium">
            Categorie
          </label>
          <select id="category_id" className={CLASA_CAMP} {...register("category_id")}>
            <option value="">Necategorizat</option>
            {categorii.map((optiune) => (
              <option key={optiune.id} value={optiune.id}>
                {optiune.denumire}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="stare" className="block text-sm font-medium">
            Stare fizică
          </label>
          <select id="stare" defaultValue="nou" className={CLASA_CAMP} {...register("stare")}>
            {STARI_OBIECT.map((valoare) => (
              <option key={valoare} value={valoare}>
                {ETICHETE_STARE[valoare]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="observatii" className="block text-sm font-medium">
          Observații
        </label>
        <textarea id="observatii" rows={3} className={CLASA_CAMP} {...register("observatii")} />
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
        {inCurs ? "Se salvează…" : "Salvează obiectul"}
      </button>
    </form>
  );
}
