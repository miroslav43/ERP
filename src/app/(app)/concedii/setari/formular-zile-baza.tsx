// src/app/(app)/concedii/setari/formular-zile-baza.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { seteazaZileConcediuImplicit } from "./actions";

const CLASA_CAMP = "w-24 rounded-md border border-foreground/60 px-3 py-2 text-sm";

export function FormularZileBaza({ zileCurente }: { readonly zileCurente: number }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [zile, setZile] = useState(String(zileCurente));
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusit, setReusit] = useState(false);
  const idZile = useId();

  function trimite(): void {
    setEroare(null);
    setReusit(false);
    porneste(async () => {
      const rezultat = await seteazaZileConcediuImplicit({ zile: Number(zile) });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setReusit(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={idZile} className="text-sm">
          Zile de concediu de odihnă / an
        </label>
        <input
          id={idZile}
          type="number"
          min={0}
          max={60}
          value={zile}
          onChange={(e) => {
            setZile(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>
      <button
        type="button"
        disabled={inCurs}
        onClick={trimite}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se salvează…" : "Salvează"}
      </button>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {eroare}
        </p>
      )}
      {reusit ? (
        <p role="status" className="text-foreground text-sm">
          Salvat. Tipurile de concediu de odihnă existente au fost actualizate.
        </p>
      ) : null}
    </div>
  );
}
