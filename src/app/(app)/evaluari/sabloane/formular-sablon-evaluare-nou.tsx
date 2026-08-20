// src/app/(app)/evaluari/sabloane/formular-sablon-evaluare-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { creeazaSablonEvaluare } from "../actions";

export function FormularSablonEvaluareNou() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idDenumire = useId();
  const idDescriere = useId();
  const idCriterii = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaSablonEvaluare({
        denumire: String(fd.get("denumire") ?? ""),
        descriere: String(fd.get("descriere") ?? ""),
        criterii_text: String(fd.get("criterii_text") ?? ""),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  if (!deschis) {
    return (
      <button
        type="button"
        onClick={() => {
          setDeschis(true);
        }}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
      >
        Șablon nou
      </button>
    );
  }

  return (
    <form action={trimite} className="border-border grid gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={idDenumire} className="text-sm font-medium">
          Denumire *
        </label>
        <input
          id={idDenumire}
          name="denumire"
          type="text"
          required
          maxLength={160}
          placeholder="Evaluare anuală — echipa de vânzări"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idDescriere} className="text-sm font-medium">
          Descriere
        </label>
        <input
          id={idDescriere}
          name="descriere"
          type="text"
          maxLength={500}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idCriterii} className="text-sm font-medium">
          Criterii (câte unul pe linie) *
        </label>
        <textarea
          id={idCriterii}
          name="criterii_text"
          required
          rows={6}
          placeholder={"Calitatea muncii\nPunctualitate\nLucru în echipă"}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
        <p className="text-muted-foreground text-xs">
          Fiecare criteriu se notează de la 0 la 5 la completarea evaluării.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se creează…" : "Creează șablonul"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Renunță
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
