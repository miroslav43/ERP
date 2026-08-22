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
          className="border-foreground/60 w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={inCurs}
            className="bg-danger text-primary-foreground hover:bg-danger disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
          >
            {inCurs ? "Se trimite…" : "Respinge"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCereMotiv(false);
              setEroare(null);
            }}
            className="border-foreground/60 rounded-md border px-3 py-1.5 text-sm"
          >
            Renunță
          </button>
        </div>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-xs">
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
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se trimite…" : "Aprobă"}
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            setCereMotiv(true);
          }}
          className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed"
        >
          Respinge
        </button>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger max-w-sm text-xs">
          {eroare}
        </p>
      )}
    </div>
  );
}
