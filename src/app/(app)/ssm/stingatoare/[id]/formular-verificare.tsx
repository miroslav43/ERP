"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { REZULTATE_VERIFICARE_STINGATOR, TIPURI_VERIFICARE_STINGATOR } from "@/schemas/ssm";

import { inregistreazaVerificareStingator } from "../../actions";
import { ETICHETE_REZULTAT_VERIFICARE, ETICHETE_TIP_VERIFICARE_STINGATOR } from "../../etichete";

/**
 * Se inserează DOAR în `fire_extinguisher_checks`. Triggerul AFTER
 * `internal.ssm_check_apply` actualizează singur `ultima_*` pe stingător (și,
 * prin triggerul lui BEFORE, scadențele) — formularul nu face al doilea UPDATE.
 */
export function FormularVerificare({ extinguisherId }: { readonly extinguisherId: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    tip: useId(),
    data: useId(),
    executant: useId(),
    firma: useId(),
    rezultat: useId(),
    cost: useId(),
    observatii: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const cost = text("cost");

    porneste(async () => {
      const rezultat = await inregistreazaVerificareStingator({
        extinguisher_id: extinguisherId,
        tip_verificare: String(formular.get("tip_verificare") ?? ""),
        data: String(formular.get("data") ?? ""),
        executant: text("executant"),
        firma_autorizata: text("firma_autorizata"),
        rezultat: String(formular.get("rezultat") ?? "conform"),
        cost: cost === null ? null : Number(cost),
        observatii: text("observatii"),
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
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      <p className="text-corp font-medium sm:col-span-2">Înregistrează o verificare</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.tip} className="text-corp">
          Tip
        </label>
        <select
          id={id.tip}
          name="tip_verificare"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {TIPURI_VERIFICARE_STINGATOR.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_VERIFICARE_STINGATOR[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.data} className="text-corp">
          Data
        </label>
        <input
          id={id.data}
          name="data"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.firma} className="text-corp">
          Firmă autorizată
        </label>
        <input
          id={id.firma}
          name="firma_autorizata"
          maxLength={160}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.executant} className="text-corp">
          Executant
        </label>
        <input
          id={id.executant}
          name="executant"
          maxLength={120}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.rezultat} className="text-corp">
          Rezultat
        </label>
        <select
          id={id.rezultat}
          name="rezultat"
          defaultValue="conform"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {REZULTATE_VERIFICARE_STINGATOR.map((r) => (
            <option key={r} value={r}>
              {ETICHETE_REZULTAT_VERIFICARE[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.cost} className="text-corp">
          Cost (lei)
        </label>
        <input
          id={id.cost}
          name="cost"
          type="number"
          min="0"
          step="0.01"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={id.observatii} className="text-corp">
          Observații
        </label>
        <input
          id={id.observatii}
          name="observatii"
          maxLength={1000}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Înregistrează verificarea
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
