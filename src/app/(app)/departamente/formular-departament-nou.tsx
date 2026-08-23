// src/app/(app)/departamente/formular-departament-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { creeazaDepartament } from "./actions";

interface OptiuneDepartament {
  readonly id: string;
  readonly denumire: string;
  readonly cod: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
}

interface Proprietati {
  readonly departamente: readonly OptiuneDepartament[];
  readonly angajati: readonly OptiuneAngajat[];
}

export function FormularDepartamentNou({ departamente, angajati }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idCod = useId();
  const idDenumire = useId();
  const idParinte = useId();
  const idManager = useId();
  const idCostCenter = useId();
  const idDescriere = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const parinte = String(fd.get("parent_id") ?? "");
      const manager = String(fd.get("manager_employee_id") ?? "");
      const rezultat = await creeazaDepartament({
        cod: String(fd.get("cod") ?? ""),
        denumire: String(fd.get("denumire") ?? ""),
        descriere: String(fd.get("descriere") ?? ""),
        parent_id: parinte === "" ? null : parinte,
        manager_employee_id: manager === "" ? null : manager,
        cost_center: String(fd.get("cost_center") ?? ""),
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
        Departament nou
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idCod} className="text-corp font-medium">
          Cod *
        </label>
        <input
          id={idCod}
          name="cod"
          type="text"
          required
          maxLength={32}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
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
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idParinte} className="text-corp font-medium">
          Departament superior
        </label>
        <select
          id={idParinte}
          name="parent_id"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">— rădăcină —</option>
          {departamente.map((d) => (
            <option key={d.id} value={d.id}>
              {d.denumire} ({d.cod})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idManager} className="text-corp font-medium">
          Manager
        </label>
        <select
          id={idManager}
          name="manager_employee_id"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">— nedesemnat —</option>
          {angajati.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idCostCenter} className="text-corp font-medium">
          Centru de cost
        </label>
        <input
          id={idCostCenter}
          name="cost_center"
          type="text"
          maxLength={40}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idDescriere} className="text-corp font-medium">
          Descriere
        </label>
        <textarea
          id={idDescriere}
          name="descriere"
          maxLength={1000}
          rows={2}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se creează…">
          Creează departamentul
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
