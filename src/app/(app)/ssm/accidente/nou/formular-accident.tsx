"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { TIPURI_ACCIDENT } from "@/schemas/ssm";

import { inregistreazaAccident } from "../../actions";
import { ETICHETE_TIP_ACCIDENT } from "../../etichete";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

export function FormularAccident({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    numar: useId(),
    angajat: useId(),
    data: useId(),
    ora: useId(),
    tip: useId(),
    locul: useId(),
    imprejurari: useId(),
    zile: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const rezultat = await inregistreazaAccident({
        numar_intern: text("numar_intern"),
        employee_id: text("employee_id"),
        data_producerii: String(formular.get("data_producerii") ?? ""),
        ora_producerii: text("ora_producerii"),
        locul: String(formular.get("locul") ?? ""),
        imprejurari: String(formular.get("imprejurari") ?? ""),
        tip: String(formular.get("tip") ?? ""),
        zile_incapacitate: Number(formular.get("zile_incapacitate") ?? 0),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/ssm/accidente/${rezultat.data.id}`);
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id.numar} className="text-corp font-medium">
            Număr intern (opțional)
          </label>
          <input
            id={id.numar}
            name="numar_intern"
            maxLength={64}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.angajat} className="text-corp font-medium">
            Angajat
          </label>
          <select
            id={id.angajat}
            name="employee_id"
            defaultValue=""
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          >
            <option value="">—</option>
            {angajati.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? a.marca} ({a.marca})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.data} className="text-corp font-medium">
            Data producerii
          </label>
          <input
            id={id.data}
            name="data_producerii"
            type="date"
            required
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.ora} className="text-corp font-medium">
            Ora producerii (opțional)
          </label>
          <input
            id={id.ora}
            name="ora_producerii"
            type="time"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.tip} className="text-corp font-medium">
            Tip
          </label>
          <select
            id={id.tip}
            name="tip"
            defaultValue="usor"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          >
            {TIPURI_ACCIDENT.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_ACCIDENT[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.zile} className="text-corp font-medium">
            Zile de incapacitate
          </label>
          <input
            id={id.zile}
            name="zile_incapacitate"
            type="number"
            min={0}
            defaultValue={0}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.locul} className="text-corp font-medium">
            Locul
          </label>
          <input
            id={id.locul}
            name="locul"
            required
            maxLength={200}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.imprejurari} className="text-corp font-medium">
            Împrejurări
          </label>
          <textarea
            id={id.imprejurari}
            name="imprejurari"
            required
            rows={4}
            maxLength={4000}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Înregistrează accidentul
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
