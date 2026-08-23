// src/app/(app)/departamente/actiuni-departament.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Ban, Pencil, Undo2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import {
  actualizeazaDepartament,
  dezactiveazaDepartament,
  mutaDepartament,
  reactiveazaDepartament,
} from "./actions";

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
  readonly departament: Readonly<{
    id: string;
    denumire: string;
    descriere: string | null;
    parent_id: string | null;
    manager_employee_id: string | null;
    cost_center: string | null;
    numarAngajati: number;
    activ: boolean;
  }>;
  readonly departamente: readonly OptiuneDepartament[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly poateEdita: boolean;
}

export function ActiuniDepartament({
  departament,
  departamente,
  angajati,
  poateEdita,
}: Proprietati) {
  const router = useRouter();
  const [panou, setPanou] = useState<"editeaza" | "muta" | null>(null);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idDenumire = useId();
  const idManager = useId();
  const idCostCenter = useId();
  const idDescriere = useId();
  const idParinte = useId();

  if (!poateEdita) return null;

  function trimiteEditare(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const manager = String(fd.get("manager_employee_id") ?? "");
      const rezultat = await actualizeazaDepartament({
        id: departament.id,
        denumire: String(fd.get("denumire") ?? ""),
        descriere: String(fd.get("descriere") ?? ""),
        parent_id: departament.parent_id,
        manager_employee_id: manager === "" ? null : manager,
        cost_center: String(fd.get("cost_center") ?? ""),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setPanou(null);
      router.refresh();
    });
  }

  function trimiteMutare(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const parinte = String(fd.get("parent_id") ?? "");
      const rezultat = await mutaDepartament({
        id: departament.id,
        parent_id: parinte === "" ? null : parinte,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setPanou(null);
      router.refresh();
    });
  }

  /**
   * Dezactivarea NU cere confirmare, și e o decizie, nu o scăpare: de când
   * există butonul de mai jos, se poate desface dintr-un clic. Confirmarea se
   * păstrează pentru ce chiar nu se mai poate lua înapoi — închiderea lunii de
   * salarizare, trimiterea fluturașilor pe e-mail. Un dialog pus peste tot își
   * pierde înțelesul exact acolo unde ar trebui să oprească pe cineva.
   */
  function comutaActivarea(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = departament.activ
        ? await dezactiveazaDepartament({ id: departament.id })
        : await reactiveazaDepartament({ id: departament.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-nota flex flex-wrap gap-1">
        <Buton
          varianta="tertiar"
          onClick={() => {
            setPanou(panou === "editeaza" ? null : "editeaza");
          }}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editează
        </Buton>
        <Buton
          varianta="tertiar"
          onClick={() => {
            setPanou(panou === "muta" ? null : "muta");
          }}
        >
          <ArrowRightLeft aria-hidden="true" className="size-3.5" />
          Mută
        </Buton>
        {!departament.activ ? (
          <Buton varianta="secundar" onClick={comutaActivarea} disabled={inCurs}>
            <Undo2 aria-hidden="true" className="size-3.5" />
            Reactivează
          </Buton>
        ) : departament.numarAngajati === 0 ? (
          <Buton varianta="distructiv" onClick={comutaActivarea} disabled={inCurs}>
            <Ban aria-hidden="true" className="size-3.5" />
            Dezactivează
          </Buton>
        ) : null}
      </div>

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota">
          {eroare}
        </p>
      )}

      {panou === "editeaza" ? (
        <form
          action={trimiteEditare}
          className="border-border rounded-control grid gap-2 border p-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idDenumire} className="text-nota font-medium">
              Denumire
            </label>
            <input
              id={idDenumire}
              name="denumire"
              type="text"
              required
              maxLength={160}
              defaultValue={departament.denumire}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idManager} className="text-nota font-medium">
              Manager
            </label>
            <select
              id={idManager}
              name="manager_employee_id"
              defaultValue={departament.manager_employee_id ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
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
            <label htmlFor={idCostCenter} className="text-nota font-medium">
              Centru de cost
            </label>
            <input
              id={idCostCenter}
              name="cost_center"
              type="text"
              maxLength={40}
              defaultValue={departament.cost_center ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idDescriere} className="text-nota font-medium">
              Descriere
            </label>
            <textarea
              id={idDescriere}
              name="descriere"
              maxLength={1000}
              rows={2}
              defaultValue={departament.descriere ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
              Salvează
            </Buton>
          </div>
        </form>
      ) : null}

      {panou === "muta" ? (
        <form
          action={trimiteMutare}
          className="border-border rounded-control flex flex-wrap items-end gap-2 border p-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idParinte} className="text-nota font-medium">
              Mută sub
            </label>
            <select
              id={idParinte}
              name="parent_id"
              defaultValue={departament.parent_id ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            >
              <option value="">— rădăcină —</option>
              {departamente
                .filter((d) => d.id !== departament.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.denumire} ({d.cod})
                  </option>
                ))}
            </select>
          </div>
          <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se mută…">
            Mută
          </Buton>
        </form>
      ) : null}
    </div>
  );
}
