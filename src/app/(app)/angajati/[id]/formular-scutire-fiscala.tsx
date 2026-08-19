// src/app/(app)/angajati/[id]/formular-scutire-fiscala.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TIPURI_SCUTIRE } from "@/schemas/employee";
import { ETICHETE_SCUTIRE } from "../etichete";
import { adaugaScutireFiscala } from "./scutiri-actions";

interface Proprietati {
  readonly employeeId: string;
}

export function FormularScutireFiscala({ employeeId }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idTip = useId();
  const idValabilDeLa = useId();
  const idValabilPana = useId();
  const idProcent = useId();
  const idPlafon = useId();
  const idTemei = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    porneste(async () => {
      const valabilPana = String(formular.get("valabil_pana") ?? "");
      const procent = String(formular.get("procent_scutire") ?? "");
      const plafon = String(formular.get("plafon_lunar") ?? "");
      const temei = String(formular.get("temei_legal") ?? "");
      const rezultat = await adaugaScutireFiscala({
        employee_id: employeeId,
        exemption_type: String(formular.get("exemption_type") ?? ""),
        valabil_de_la: String(formular.get("valabil_de_la") ?? ""),
        valabil_pana: valabilPana === "" ? null : valabilPana,
        procent_scutire: procent === "" ? null : Number(procent),
        plafon_lunar: plafon === "" ? null : Number(plafon),
        temei_legal: temei === "" ? null : temei,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  if (!deschis) {
    return (
      <button
        type="button"
        onClick={() => {
          setDeschis(true);
        }}
        className="border-foreground/60 hover:bg-surface mt-3 rounded-md border px-3 py-1.5 text-sm font-medium"
      >
        Scutire fiscală nouă
      </button>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border mt-3 grid gap-3 rounded-md border p-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-sm">
          Tip scutire
        </label>
        <select
          id={idTip}
          name="exemption_type"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        >
          {TIPURI_SCUTIRE.map((tip) => (
            <option key={tip} value={tip}>
              {ETICHETE_SCUTIRE[tip]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilDeLa} className="text-sm">
          Valabil de la
        </label>
        <input
          id={idValabilDeLa}
          name="valabil_de_la"
          type="date"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilPana} className="text-sm">
          Valabil până la (opțional)
        </label>
        <input
          id={idValabilPana}
          name="valabil_pana"
          type="date"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idProcent} className="text-sm">
          Procent scutire (%)
        </label>
        <input
          id={idProcent}
          name="procent_scutire"
          type="number"
          step="0.01"
          min={0}
          max={100}
          placeholder="ex. 10"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idPlafon} className="text-sm">
          Plafon lunar (lei, opțional)
        </label>
        <input
          id={idPlafon}
          name="plafon_lunar"
          type="number"
          step="0.01"
          min={0}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idTemei} className="text-sm">
          Temei legal
        </label>
        <input
          id={idTemei}
          name="temei_legal"
          type="text"
          maxLength={500}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <p className="text-muted-foreground text-xs sm:col-span-2">
        Fără procent completat, scutirea rămâne înregistrată dar nu se aplică automat la calculul
        salarizării.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Adaugă scutirea"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Renunță
        </button>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-sm sm:col-span-2">
          {eroare}
        </p>
      )}
    </form>
  );
}
