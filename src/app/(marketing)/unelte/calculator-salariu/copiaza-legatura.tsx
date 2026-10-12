"use client";

import { useId, useState } from "react";

/**
 * Legătura spre calculul curent, cu buton de copiere.
 *
 * Fără JavaScript, câmpul rămâne: legătura se selectează și se copiază de mână.
 * Cu JavaScript, butonul o copiază. Unde browserul refuză clipboard-ul (pagină
 * încadrată, context nesecurizat, permisiune refuzată), spune ce e de făcut în
 * loc să tacă.
 */
export function CopiazaLegatura({ adresa }: { readonly adresa: string }) {
  const id = useId();
  const [stare, setStare] = useState<"gata" | "copiat" | "manual">("gata");

  async function copiaza() {
    try {
      await navigator.clipboard.writeText(adresa);
      setStare("copiat");
    } catch {
      setStare("manual");
    }
  }

  return (
    <div className="mt-6 max-w-[40rem]">
      <label htmlFor={id} className="text-[0.875rem] font-medium">
        Legătura spre acest calcul
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="text"
          readOnly
          value={adresa}
          onFocus={(e) => e.currentTarget.select()}
          className="border-mk-rigla bg-mk-hartie min-w-0 flex-1 rounded border px-3 py-2.5 text-base"
        />
        <button
          type="button"
          onClick={() => void copiaza()}
          data-umami-event="calculator-salariu-copiaza"
          className="border-mk-cerneala inline-flex h-11 shrink-0 items-center justify-center rounded border px-5 text-[0.9375rem] font-medium"
        >
          {stare === "copiat" ? "Copiat" : "Copiază legătura"}
        </button>
      </div>
      <p aria-live="polite" className="text-mk-text-slab mt-1.5 min-h-5 text-[0.8125rem]">
        {stare === "manual"
          ? "Browserul n-a permis copierea: selectează legătura și copiaz-o."
          : ""}
      </p>
    </div>
  );
}
