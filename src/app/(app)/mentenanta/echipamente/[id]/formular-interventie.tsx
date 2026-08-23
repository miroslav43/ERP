"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { REZULTATE_INTERVENTIE, TIPURI_MENTENANTA } from "@/schemas/maintenance";
import { ETICHETE_REZULTAT_INTERVENTIE, ETICHETE_TIP_MENTENANTA } from "../../etichete";
import { inregistreazaInterventie } from "../../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export function FormularInterventie({
  equipmentId,
  planuri,
  angajati,
}: {
  readonly equipmentId: string;
  readonly planuri: readonly Optiune[];
  readonly angajati: readonly Optiune[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idPlan = useId();
  const idTip = useId();
  const idData = useId();
  const idOraStart = useId();
  const idDurata = useId();
  const idExecutantAngajat = useId();
  const idExecutantExtern = useId();
  const idDescriere = useId();
  const idPiese = useId();
  const idCostPiese = useId();
  const idCostManopera = useId();
  const idRezultat = useId();
  const idOprireMinute = useId();
  const idCitireContor = useId();
  const idObs = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    const gol = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const rezultat = await inregistreazaInterventie({
        plan_id: gol("plan_id"),
        equipment_id: equipmentId,
        tip: String(formular.get("tip") ?? "corectiva"),
        data: String(formular.get("data") ?? ""),
        ora_start: gol("ora_start"),
        durata_ore: gol("durata_ore") === null ? null : Number(gol("durata_ore")),
        executant_employee_id: gol("executant_employee_id"),
        executant_extern: gol("executant_extern"),
        descriere: String(formular.get("descriere") ?? ""),
        piese: gol("piese"),
        cost_piese: Number(gol("cost_piese") ?? "0"),
        cost_manopera: Number(gol("cost_manopera") ?? "0"),
        rezultat: String(formular.get("rezultat") ?? "reusita"),
        oprire_minute: gol("oprire_minute") === null ? null : Number(gol("oprire_minute")),
        citire_contor: gol("citire_contor") === null ? null : Number(gol("citire_contor")),
        observatii: gol("observatii"),
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
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-corp font-medium sm:col-span-2 lg:col-span-3">Intervenție nouă</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idPlan} className="text-corp">
          Din planul
        </label>
        <select
          id={idPlan}
          name="plan_id"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Fără plan (intervenție corectivă)</option>
          {planuri.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-corp">
          Tip
        </label>
        <select
          id={idTip}
          name="tip"
          defaultValue="corectiva"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {TIPURI_MENTENANTA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_MENTENANTA[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idData} className="text-corp">
          Data
        </label>
        <input
          id={idData}
          name="data"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idOraStart} className="text-corp">
          Ora de început
        </label>
        <input
          id={idOraStart}
          name="ora_start"
          type="time"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idDurata} className="text-corp">
          Durata (ore)
        </label>
        <input
          id={idDurata}
          name="durata_ore"
          type="number"
          min="0"
          step="0.5"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idExecutantAngajat} className="text-corp">
          Executant (angajat)
        </label>
        <select
          id={idExecutantAngajat}
          name="executant_employee_id"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">—</option>
          {angajati.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idExecutantExtern} className="text-corp">
          Executant (firmă externă)
        </label>
        <input
          id={idExecutantExtern}
          name="executant_extern"
          maxLength={200}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <label htmlFor={idDescriere} className="text-corp">
          Descriere
        </label>
        <textarea
          id={idDescriere}
          name="descriere"
          rows={2}
          required
          maxLength={2000}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <label htmlFor={idPiese} className="text-corp">
          Piese folosite
        </label>
        <textarea
          id={idPiese}
          name="piese"
          rows={2}
          maxLength={2000}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCostPiese} className="text-corp">
          Cost piese (lei)
        </label>
        <input
          id={idCostPiese}
          name="cost_piese"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCostManopera} className="text-corp">
          Cost manoperă (lei)
        </label>
        <input
          id={idCostManopera}
          name="cost_manopera"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idRezultat} className="text-corp">
          Rezultat
        </label>
        <select
          id={idRezultat}
          name="rezultat"
          defaultValue="reusita"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {REZULTATE_INTERVENTIE.map((r) => (
            <option key={r} value={r}>
              {ETICHETE_REZULTAT_INTERVENTIE[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idOprireMinute} className="text-corp">
          Oprire (minute)
        </label>
        <input
          id={idOprireMinute}
          name="oprire_minute"
          type="number"
          min="0"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCitireContor} className="text-corp">
          Citire contor la momentul intervenției
        </label>
        <input
          id={idCitireContor}
          name="citire_contor"
          type="number"
          min="0"
          step="0.01"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <label htmlFor={idObs} className="text-corp">
          Observații
        </label>
        <textarea
          id={idObs}
          name="observatii"
          rows={2}
          maxLength={2000}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Salvează intervenția
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
