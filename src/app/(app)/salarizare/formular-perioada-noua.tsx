"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { creeazaPerioada } from "./actions";

const LUNA_CURENTA = new Date();

export function FormularPerioadaNoua() {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idAn = useId();
  const idLuna = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaPerioada({
        an: Number(formular.get("an")),
        luna: Number(formular.get("luna")),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/salarizare/${rezultat.data.id}`);
    });
  }

  return (
    <form
      action={trimite}
      className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idLuna} className="text-sm">
          Luna
        </label>
        <select
          id={idLuna}
          name="luna"
          defaultValue={LUNA_CURENTA.getUTCMonth() + 1}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idAn} className="text-sm">
          Anul
        </label>
        <input
          id={idAn}
          name="an"
          type="number"
          min={2020}
          max={2100}
          defaultValue={LUNA_CURENTA.getUTCFullYear()}
          className="border-foreground/60 w-28 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={inCurs}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se creează…" : "Creează perioada"}
      </button>
      {eroare === null ? null : (
        <p role="alert" className="text-danger w-full text-sm">
          {eroare}
        </p>
      )}
    </form>
  );
}
