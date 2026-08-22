// src/app/(app)/departamente/actiuni-departament.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Ban, Pencil } from "lucide-react";

import { actualizeazaDepartament, dezactiveazaDepartament, mutaDepartament } from "./actions";

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

  function dezactiveaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await dezactiveazaDepartament({ id: departament.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 text-xs">
        <button
          type="button"
          onClick={() => {
            setPanou(panou === "editeaza" ? null : "editeaza");
          }}
          className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editează
        </button>
        <button
          type="button"
          onClick={() => {
            setPanou(panou === "muta" ? null : "muta");
          }}
          className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1"
        >
          <ArrowRightLeft aria-hidden="true" className="size-3.5" />
          Mută
        </button>
        {departament.numarAngajati === 0 ? (
          <button
            type="button"
            onClick={dezactiveaza}
            disabled={inCurs}
            className="text-danger hover:bg-danger/8 inline-flex items-center gap-1.5 rounded-md px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Ban aria-hidden="true" className="size-3.5" />
            Dezactivează
          </button>
        ) : null}
      </div>

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-xs">
          {eroare}
        </p>
      )}

      {panou === "editeaza" ? (
        <form
          action={trimiteEditare}
          className="border-border grid gap-2 rounded-md border p-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idDenumire} className="text-xs font-medium">
              Denumire
            </label>
            <input
              id={idDenumire}
              name="denumire"
              type="text"
              required
              maxLength={160}
              defaultValue={departament.denumire}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idManager} className="text-xs font-medium">
              Manager
            </label>
            <select
              id={idManager}
              name="manager_employee_id"
              defaultValue={departament.manager_employee_id ?? ""}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
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
            <label htmlFor={idCostCenter} className="text-xs font-medium">
              Centru de cost
            </label>
            <input
              id={idCostCenter}
              name="cost_center"
              type="text"
              maxLength={40}
              defaultValue={departament.cost_center ?? ""}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idDescriere} className="text-xs font-medium">
              Descriere
            </label>
            <textarea
              id={idDescriere}
              name="descriere"
              maxLength={1000}
              rows={2}
              defaultValue={departament.descriere ?? ""}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={inCurs}
              className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inCurs ? "Se salvează…" : "Salvează"}
            </button>
          </div>
        </form>
      ) : null}

      {panou === "muta" ? (
        <form
          action={trimiteMutare}
          className="border-border flex flex-wrap items-end gap-2 rounded-md border p-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idParinte} className="text-xs font-medium">
              Mută sub
            </label>
            <select
              id={idParinte}
              name="parent_id"
              defaultValue={departament.parent_id ?? ""}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
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
          <button
            type="submit"
            disabled={inCurs}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inCurs ? "Se mută…" : "Mută"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
