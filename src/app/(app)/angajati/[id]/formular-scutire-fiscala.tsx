// src/app/(app)/angajati/[id]/formular-scutire-fiscala.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
      <Buton
        varianta="secundar"
        className="mt-3"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Scutire fiscală nouă
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-control mt-3 grid gap-3 border p-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-corp">
          Tip scutire
        </label>
        <select
          id={idTip}
          name="exemption_type"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {TIPURI_SCUTIRE.map((tip) => (
            <option key={tip} value={tip}>
              {ETICHETE_SCUTIRE[tip]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilDeLa} className="text-corp">
          Valabil de la
        </label>
        <input
          id={idValabilDeLa}
          name="valabil_de_la"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilPana} className="text-corp">
          Valabil până la (opțional)
        </label>
        <input
          id={idValabilPana}
          name="valabil_pana"
          type="date"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idProcent} className="text-corp">
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
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idPlafon} className="text-corp">
          Plafon lunar (lei, opțional)
        </label>
        <input
          id={idPlafon}
          name="plafon_lunar"
          type="number"
          step="0.01"
          min={0}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idTemei} className="text-corp">
          Temei legal
        </label>
        <input
          id={idTemei}
          name="temei_legal"
          type="text"
          maxLength={500}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <p className="text-muted-foreground text-nota sm:col-span-2">
        Fără procent completat, scutirea rămâne înregistrată dar nu se aplică automat la calculul
        salarizării.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Adaugă scutirea
        </Buton>
        <Buton
          varianta="link"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
        >
          Renunță
        </Buton>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp sm:col-span-2">
          {eroare}
        </p>
      )}
    </form>
  );
}
