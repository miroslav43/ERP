// src/app/(app)/evaluari/sabloane/formular-sablon-evaluare-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Șablon nou
      </Buton>
    );
  }

  return (
    <form action={trimite} className="border-border rounded-panou grid gap-3 border p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={idDenumire} className="text-corp font-medium">
          Denumire *
        </label>
        <input
          id={idDenumire}
          name="denumire"
          type="text"
          required
          maxLength={160}
          placeholder="Evaluare anuală — echipa de vânzări"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idDescriere} className="text-corp font-medium">
          Descriere
        </label>
        <input
          id={idDescriere}
          name="descriere"
          type="text"
          maxLength={500}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idCriterii} className="text-corp font-medium">
          Criterii (câte unul pe linie) *
        </label>
        <textarea
          id={idCriterii}
          name="criterii_text"
          required
          rows={6}
          placeholder={"Calitatea muncii\nPunctualitate\nLucru în echipă"}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
        <p className="text-muted-foreground text-nota">
          Fiecare criteriu se notează de la 0 la 5 la completarea evaluării.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se creează…">
          Creează șablonul
        </Buton>
        <Buton
          varianta="link"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
        >
          Renunță
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
