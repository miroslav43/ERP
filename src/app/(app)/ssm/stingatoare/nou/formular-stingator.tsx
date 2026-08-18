"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { STATUS_STINGATOR } from "@/schemas/ssm";

import { adaugaStingator } from "../../actions";
import { ETICHETE_STATUS_STINGATOR } from "../../etichete";

export function FormularStingator() {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    cod: useId(),
    tip: useId(),
    masa: useId(),
    cladire: useId(),
    locatie: useId(),
    producator: useId(),
    serie: useId(),
    punere: useId(),
    verificare: useId(),
    reincarcare: useId(),
    proba: useId(),
    status: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const masa = text("masa_kg");

    porneste(async () => {
      const rezultat = await adaugaStingator({
        cod: String(formular.get("cod") ?? ""),
        tip: String(formular.get("tip") ?? ""),
        masa_kg: masa === null ? null : Number(masa),
        cladire: text("cladire"),
        locatie: String(formular.get("locatie") ?? ""),
        producator: text("producator"),
        serie: text("serie"),
        data_punerii_in_functiune: text("data_punerii_in_functiune"),
        ultima_verificare: text("ultima_verificare"),
        ultima_reincarcare: text("ultima_reincarcare"),
        ultima_proba_presiune: text("ultima_proba_presiune"),
        status: String(formular.get("status") ?? "activ"),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/ssm/stingatoare/${rezultat.data.id}`);
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id.cod} className="text-sm font-medium">
            Cod
          </label>
          <input
            id={id.cod}
            name="cod"
            required
            maxLength={40}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.tip} className="text-sm font-medium">
            Tip
          </label>
          <input
            id={id.tip}
            name="tip"
            required
            maxLength={60}
            placeholder="pulbere, CO2, spumă…"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.masa} className="text-sm font-medium">
            Masă (kg)
          </label>
          <input
            id={id.masa}
            name="masa_kg"
            type="number"
            min="0.1"
            step="0.1"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.status} className="text-sm font-medium">
            Stare
          </label>
          <select
            id={id.status}
            name="status"
            defaultValue="activ"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            {STATUS_STINGATOR.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS_STINGATOR[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.locatie} className="text-sm font-medium">
            Locație
          </label>
          <input
            id={id.locatie}
            name="locatie"
            required
            maxLength={200}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.cladire} className="text-sm font-medium">
            Clădire
          </label>
          <input
            id={id.cladire}
            name="cladire"
            maxLength={120}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.producator} className="text-sm font-medium">
            Producător
          </label>
          <input
            id={id.producator}
            name="producator"
            maxLength={120}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.serie} className="text-sm font-medium">
            Serie
          </label>
          <input
            id={id.serie}
            name="serie"
            maxLength={64}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.punere} className="text-sm font-medium">
            Punere în funcțiune
          </label>
          <input
            id={id.punere}
            name="data_punerii_in_functiune"
            type="date"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.verificare} className="text-sm font-medium">
            Ultima verificare
          </label>
          <input
            id={id.verificare}
            name="ultima_verificare"
            type="date"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.reincarcare} className="text-sm font-medium">
            Ultima reîncărcare
          </label>
          <input
            id={id.reincarcare}
            name="ultima_reincarcare"
            type="date"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.proba} className="text-sm font-medium">
            Ultima probă de presiune
          </label>
          <input
            id={id.proba}
            name="ultima_proba_presiune"
            type="date"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {inCurs ? "Se salvează…" : "Adaugă stingătorul"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-sm text-danger">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
