"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { TIPURI_CONTOR } from "@/schemas/maintenance";
import { ETICHETE_TIP_CONTOR } from "../../etichete";
import { inregistreazaContor } from "../../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export function FormularContor({
  equipmentId,
  angajati,
}: {
  readonly equipmentId: string;
  readonly angajati: readonly Optiune[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [avertisment, setAvertisment] = useState<string | null>(null);
  const idTip = useId();
  const idCitire = useId();
  const idData = useId();
  const idReset = useId();
  const idCititDe = useId();
  const idObs = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    setAvertisment(null);
    const gol = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const rezultat = await inregistreazaContor({
        equipment_id: equipmentId,
        tip: String(formular.get("tip") ?? ""),
        citire: Number(formular.get("citire") ?? "0"),
        data_citirii: String(formular.get("data_citirii") ?? ""),
        resetare_contor: formular.get("resetare_contor") === "on",
        sursa: gol("sursa") ?? "manual",
        citit_de_employee_id: gol("citit_de_employee_id"),
        observatii: gol("observatii"),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      if (rezultat.data.avertismentSalt !== null) setAvertisment(rezultat.data.avertismentSalt);
      router.refresh();
    });
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-corp font-medium sm:col-span-2 lg:col-span-3">Înregistrează o citire</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-corp">
          Tip contor
        </label>
        <select
          id={idTip}
          name="tip"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {TIPURI_CONTOR.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_CONTOR[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCitire} className="text-corp">
          Citire
        </label>
        <input
          id={idCitire}
          name="citire"
          type="number"
          min="0"
          step="0.01"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idData} className="text-corp">
          Data citirii
        </label>
        <input
          id={idData}
          name="data_citirii"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCititDe} className="text-corp">
          Citit de
        </label>
        <select
          id={idCititDe}
          name="citit_de_employee_id"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Nespecificat</option>
          {angajati.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
        <label htmlFor={idObs} className="text-corp">
          Observații
        </label>
        <input
          id={idObs}
          name="observatii"
          maxLength={500}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex items-center gap-2 self-end">
        <input id={idReset} name="resetare_contor" type="checkbox" className="size-4" />
        <label htmlFor={idReset} className="text-corp">
          Resetare contor
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Salvează citirea
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
        {avertisment === null ? null : (
          <p role="alert" className="text-foreground text-corp">
            {avertisment}
          </p>
        )}
      </div>
    </form>
  );
}
