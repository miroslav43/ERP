"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { predaEip } from "../actions";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/** NU trimite `data_inlocuirii`: triggerul BEFORE `internal.ssm_ppe_calc` o calculează. */
export function FormularEip({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    angajat: useId(),
    articol: useId(),
    cod: useId(),
    cantitate: useId(),
    unitate: useId(),
    predare: useId(),
    durata: useId(),
    valoare: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const durata = text("durata_utilizare_luni");
    const valoare = text("valoare");

    porneste(async () => {
      const rezultat = await predaEip({
        employee_id: String(formular.get("employee_id") ?? ""),
        articol: String(formular.get("articol") ?? ""),
        cod_articol: text("cod_articol"),
        cantitate: Number(formular.get("cantitate") ?? 1),
        unitate: String(formular.get("unitate") ?? "buc"),
        data_predarii: String(formular.get("data_predarii") ?? ""),
        durata_utilizare_luni: durata === null ? null : Number(durata),
        valoare: valoare === null ? null : Number(valoare),
        semnatura_confirmata: false,
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
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-3"
    >
      <p className="text-corp font-medium sm:col-span-3">Predă echipament</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.angajat} className="text-corp">
          Angajat
        </label>
        <select
          id={id.angajat}
          name="employee_id"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {angajati.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? a.marca} ({a.marca})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.articol} className="text-corp">
          Articol
        </label>
        <input
          id={id.articol}
          name="articol"
          required
          maxLength={160}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.cod} className="text-corp">
          Cod articol
        </label>
        <input
          id={id.cod}
          name="cod_articol"
          maxLength={64}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.cantitate} className="text-corp">
          Cantitate
        </label>
        <input
          id={id.cantitate}
          name="cantitate"
          type="number"
          min="0.01"
          step="1"
          defaultValue={1}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.unitate} className="text-corp">
          Unitate
        </label>
        <input
          id={id.unitate}
          name="unitate"
          defaultValue="buc"
          maxLength={20}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.predare} className="text-corp">
          Data predării
        </label>
        <input
          id={id.predare}
          name="data_predarii"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.durata} className="text-corp">
          Durată utilizare (luni, opțional)
        </label>
        <input
          id={id.durata}
          name="durata_utilizare_luni"
          type="number"
          min="1"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.valoare} className="text-corp">
          Valoare (lei)
        </label>
        <input
          id={id.valoare}
          name="valoare"
          type="number"
          min="0"
          step="0.01"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Predă echipamentul
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
