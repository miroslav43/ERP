"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TIPURI_CONTOR, TIPURI_MENTENANTA } from "@/schemas/maintenance";
import { ETICHETE_TIP_CONTOR, ETICHETE_TIP_MENTENANTA } from "../../etichete";
import { creeazaPlan } from "../../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export function FormularPlan({
  equipmentId,
  angajati,
}: {
  readonly equipmentId: string;
  readonly angajati: readonly Optiune[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idDenumire = useId();
  const idTip = useId();
  const idPerZile = useId();
  const idPerContor = useId();
  const idTipContor = useId();
  const idResponsabil = useId();
  const idInstructiuni = useId();
  const idActiv = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    const gol = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const perZile = gol("periodicitate_zile");
    const perContor = gol("periodicitate_contor");

    porneste(async () => {
      const rezultat = await creeazaPlan({
        equipment_id: equipmentId,
        denumire: String(formular.get("denumire") ?? ""),
        tip: String(formular.get("tip") ?? "preventiva"),
        periodicitate_zile: perZile === null ? null : Number(perZile),
        periodicitate_contor: perContor === null ? null : Number(perContor),
        tip_contor: gol("tip_contor"),
        ultima_executie: gol("ultima_executie"),
        ultima_citire_contor: null,
        responsabil_employee_id: gol("responsabil_employee_id"),
        instructiuni: gol("instructiuni"),
        activ: formular.get("activ") === "on",
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      action={trimite}
      className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-sm font-medium sm:col-span-2 lg:col-span-3">Plan de mentenanță nou</p>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
        <label htmlFor={idDenumire} className="text-sm">
          Denumire
        </label>
        <input
          id={idDenumire}
          name="denumire"
          required
          maxLength={200}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-sm">
          Tip
        </label>
        <select
          id={idTip}
          name="tip"
          defaultValue="preventiva"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        >
          {TIPURI_MENTENANTA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_MENTENANTA[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 self-end">
        <input id={idActiv} name="activ" type="checkbox" defaultChecked className="size-4" />
        <label htmlFor={idActiv} className="text-sm">
          Plan activ
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idPerZile} className="text-sm">
          Periodicitate (zile)
        </label>
        <input
          id={idPerZile}
          name="periodicitate_zile"
          type="number"
          min="1"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idPerContor} className="text-sm">
          Periodicitate (unități de contor)
        </label>
        <input
          id={idPerContor}
          name="periodicitate_contor"
          type="number"
          min="0.01"
          step="0.01"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTipContor} className="text-sm">
          Tipul contorului
        </label>
        <select
          id={idTipContor}
          name="tip_contor"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        >
          <option value="">— (doar dacă e periodicitate pe contor)</option>
          {TIPURI_CONTOR.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_CONTOR[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ultima_executie" className="text-sm">
          Ultima execuție
        </label>
        <input
          id="ultima_executie"
          name="ultima_executie"
          type="date"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idResponsabil} className="text-sm">
          Responsabil
        </label>
        <select
          id={idResponsabil}
          name="responsabil_employee_id"
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        >
          <option value="">Nespecificat</option>
          {angajati.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <label htmlFor={idInstructiuni} className="text-sm">
          Instrucțiuni
        </label>
        <textarea
          id={idInstructiuni}
          name="instructiuni"
          rows={2}
          maxLength={2000}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {inCurs ? "Se salvează…" : "Salvează planul"}
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
