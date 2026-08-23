"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
        <label htmlFor={idMotiv} className="text-corp block font-medium">
          Motivul respingerii
        </label>
        <textarea
          id={idMotiv}
          name="motiv"
          rows={2}
          maxLength={500}
          required
          className="border-foreground/60 rounded-control text-corp w-full border px-3 py-2"
        />
        <div className="flex gap-2">
          <Buton type="submit" varianta="distructiv" inCurs={inCurs} textInCurs="Se trimite…">
            Respinge
          </Buton>
          <Buton
            varianta="secundar"
            onClick={() => {
              setCereMotiv(false);
              setEroare(null);
            }}
          >
            Renunță
          </Buton>
        </div>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-nota">
            {eroare}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Buton
          varianta="primar"
          inCurs={inCurs}
          textInCurs="Se trimite…"
          onClick={() => {
            decide("aprobat", null);
          }}
        >
          Aprobă
        </Buton>
        <Buton
          varianta="secundar"
          disabled={inCurs}
          onClick={() => {
            setCereMotiv(true);
          }}
        >
          Respinge
        </Buton>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota max-w-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
