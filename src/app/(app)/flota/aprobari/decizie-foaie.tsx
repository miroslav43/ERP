"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decideFoaie } from "../actions";

/**
 * Aprobarea sau respingerea unei foi.
 *
 * Respingerea cere motiv — validat și în acțiune, și aici, ca omul să afle
 * înainte de round-trip. Autoaprobarea NU se blochează în client: e refuzată de
 * un trigger, iar mesajul lui ajunge la utilizator prin `traduEroare`. Regula
 * trăiește într-un singur loc, cel care nu poate fi ocolit.
 */
export function DecizieFoaie({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [cereMotiv, setCereMotiv] = useState(false);
  const idMotiv = useId();

  function decide(decizie: "aprobat" | "respins", motiv: string | null): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await decideFoaie({ id, decizie, motiv_respingere: motiv });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setCereMotiv(false);
      router.refresh();
    });
  }

  if (cereMotiv) {
    return (
      <form
        action={(formular) => {
          const motiv = String(formular.get("motiv") ?? "").trim();
          if (motiv.length === 0) {
            setEroare("Scrieți motivul: șoferul trebuie să știe ce anume să corecteze.");
            return;
          }
          decide("respins", motiv);
        }}
        className="w-full space-y-2 sm:w-80"
      >
        <label htmlFor={idMotiv} className="block text-sm font-medium">
          Motivul respingerii
        </label>
        <textarea
          id={idMotiv}
          name="motiv"
          rows={2}
          maxLength={500}
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={inCurs}
            className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
          >
            {inCurs ? "Se trimite…" : "Respinge"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCereMotiv(false);
              setEroare(null);
            }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Renunță
          </button>
        </div>
        {eroare === null ? null : (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            {eroare}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            decide("aprobat", null);
          }}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {inCurs ? "Se trimite…" : "Aprobă"}
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            setCereMotiv(true);
          }}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Respinge
        </button>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="max-w-sm text-xs text-red-700 dark:text-red-400">
          {eroare}
        </p>
      )}
    </div>
  );
}
