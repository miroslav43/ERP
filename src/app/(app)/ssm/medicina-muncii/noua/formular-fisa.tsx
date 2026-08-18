"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { REZULTATE_EXAMEN, TIPURI_EXAMEN } from "@/schemas/ssm";

import { adaugaFisaAptitudine } from "../../actions";
import { ETICHETE_REZULTAT_EXAMEN, ETICHETE_TIP_EXAMEN } from "../../etichete";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * NU are câmp de diagnostic — art. 9 GDPR. Restricțiile de muncă (inapt,
 * inapt temporar, apt condiționat) se generează SINGURE, prin trigger, când
 * se salvează rezultatul; formularul nu le atinge.
 */
export function FormularFisa({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    angajat: useId(),
    tip: useId(),
    data: useId(),
    medic: useId(),
    unitate: useId(),
    rezultat: useId(),
    valabil: useId(),
    numar: useId(),
    cost: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const cost = text("cost");

    porneste(async () => {
      const rezultat = await adaugaFisaAptitudine({
        employee_id: String(formular.get("employee_id") ?? ""),
        tip: String(formular.get("tip") ?? ""),
        data_examinarii: String(formular.get("data_examinarii") ?? ""),
        medic: text("medic"),
        unitate_medicala: text("unitate_medicala"),
        rezultat: String(formular.get("rezultat") ?? ""),
        valabil_pana: text("valabil_pana"),
        numar_fisa: text("numar_fisa"),
        cost: cost === null ? null : Number(cost),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push("/ssm/medicina-muncii");
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.angajat} className="text-sm font-medium">
            Angajat
          </label>
          <select
            id={id.angajat}
            name="employee_id"
            required
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            {angajati.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? a.marca} ({a.marca})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.tip} className="text-sm font-medium">
            Tip examen
          </label>
          <select
            id={id.tip}
            name="tip"
            defaultValue="periodic"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            {TIPURI_EXAMEN.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_EXAMEN[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.data} className="text-sm font-medium">
            Data examinării
          </label>
          <input
            id={id.data}
            name="data_examinarii"
            type="date"
            required
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.rezultat} className="text-sm font-medium">
            Rezultat
          </label>
          <select
            id={id.rezultat}
            name="rezultat"
            defaultValue="apt"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            {REZULTATE_EXAMEN.map((r) => (
              <option key={r} value={r}>
                {ETICHETE_REZULTAT_EXAMEN[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.valabil} className="text-sm font-medium">
            Valabilă până la
          </label>
          <input
            id={id.valabil}
            name="valabil_pana"
            type="date"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.medic} className="text-sm font-medium">
            Medic
          </label>
          <input
            id={id.medic}
            name="medic"
            maxLength={120}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.unitate} className="text-sm font-medium">
            Unitate medicală
          </label>
          <input
            id={id.unitate}
            name="unitate_medicala"
            maxLength={160}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.numar} className="text-sm font-medium">
            Număr fișă
          </label>
          <input
            id={id.numar}
            name="numar_fisa"
            maxLength={64}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.cost} className="text-sm font-medium">
            Cost (lei)
          </label>
          <input
            id={id.cost}
            name="cost"
            type="number"
            min="0"
            step="0.01"
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
          {inCurs ? "Se salvează…" : "Salvează fișa"}
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
