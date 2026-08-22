"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
    >
      <p className="text-sm font-medium sm:col-span-2">Înregistrează o verificare</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.tip} className="text-sm">
          Tip
        </label>
        <select
          id={id.tip}
          name="tip_verificare"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        >
          {TIPURI_VERIFICARE_STINGATOR.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_VERIFICARE_STINGATOR[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.data} className="text-sm">
          Data
        </label>
        <input
          id={id.data}
          name="data"
          type="date"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.firma} className="text-sm">
          Firmă autorizată
        </label>
        <input
          id={id.firma}
          name="firma_autorizata"
          maxLength={160}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.executant} className="text-sm">
          Executant
        </label>
        <input
          id={id.executant}
          name="executant"
          maxLength={120}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.rezultat} className="text-sm">
          Rezultat
        </label>
        <select
          id={id.rezultat}
          name="rezultat"
          defaultValue="conform"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        >
          {REZULTATE_VERIFICARE_STINGATOR.map((r) => (
            <option key={r} value={r}>
              {ETICHETE_REZULTAT_VERIFICARE[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.cost} className="text-sm">
          Cost (lei)
        </label>
        <input
          id={id.cost}
          name="cost"
          type="number"
          min="0"
          step="0.01"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={id.observatii} className="text-sm">
          Observații
        </label>
        <input
          id={id.observatii}
          name="observatii"
          maxLength={1000}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Înregistrează verificarea"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
