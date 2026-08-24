// src/app/(app)/departamente/actiuni-departament.tsx
"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Ban, Pencil, Undo2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

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
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;
  const idParinte = useId();

  // `useCallback`: `laReusita` intră în dependențele efectului din `Formular`;
  // o funcție nouă la fiecare randare ar scoate notificarea de două ori.
  const laReusita = useCallback((): void => {
    setPanou(null);
    router.refresh();
  }, [router]);

  if (!poateEdita) return null;

  /**
   * Cheile obiectului sunt EXACT cele din `actualizeazaDepartamentSchema`.
   *
   * `parent_id` NU vine din formular, ci din props: schema îl are cu
   * `.default(null)`, deci un formular care nu-l trimite ar muta departamentul
   * la rădăcină la fiecare salvare de denumire. Mutarea are panoul ei.
   */
  async function trimiteEditare(date: FormData) {
    const manager = String(date.get("manager_employee_id") ?? "");
    return actualizeazaDepartament({
      id: departament.id,
      denumire: String(date.get("denumire") ?? ""),
      descriere: String(date.get("descriere") ?? ""),
      parent_id: departament.parent_id,
      manager_employee_id: manager === "" ? null : manager,
      cost_center: String(date.get("cost_center") ?? ""),
    });
  }

  /**
   * Mutarea rămâne pe `useTransition`, spre deosebire de editare: singurul ei
   * control e un `<select>` cu o valoare aleasă, nu tastată. Resetul de după
   * acțiune al lui React 19 nu are ce pierde acolo, iar refuzurile pe care le
   * poate întoarce `mutaDepartament` (ciclu, adâncime — ridicate de trigger cu
   * P0001) nu aparțin unui câmp anume, deci n-au unde să fie afișate mai bine
   * decât în mesajul comun de sub butoane.
   */
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
        <Formular
          actiune={trimiteEditare}
          laReusita={laReusita}
          mesajReusita="Departamentul a fost salvat."
          className="border-border rounded-control grid gap-2 border p-3 sm:grid-cols-2"
        >
          {(stare) => (
            <>
              <Camp
                nume="denumire"
                id={idc("denumire")}
                eticheta="Denumire"
                obligatoriu
                erori={stare.erori["denumire"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={160}
                    defaultValue={stare.valoriTrimise["denumire"] ?? departament.denumire}
                  />
                )}
              </Camp>

              <Camp
                nume="manager_employee_id"
                id={idc("manager_employee_id")}
                eticheta="Manager"
                fel="select"
                erori={stare.erori["manager_employee_id"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={
                      stare.valoriTrimise["manager_employee_id"] ??
                      departament.manager_employee_id ??
                      ""
                    }
                  >
                    <option value="">— nedesemnat —</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="cost_center"
                id={idc("cost_center")}
                eticheta="Centru de cost"
                erori={stare.erori["cost_center"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={40}
                    defaultValue={
                      stare.valoriTrimise["cost_center"] ?? departament.cost_center ?? ""
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="descriere"
                id={idc("descriere")}
                eticheta="Descriere"
                fel="textarea"
                className="sm:col-span-2"
                erori={stare.erori["descriere"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    maxLength={1000}
                    rows={2}
                    defaultValue={stare.valoriTrimise["descriere"] ?? departament.descriere ?? ""}
                  />
                )}
              </Camp>

              <div className="sm:col-span-2">
                <Buton
                  type="submit"
                  varianta="primar"
                  inCurs={stare.inCurs}
                  textInCurs="Se salvează…"
                >
                  Salvează
                </Buton>
              </div>
            </>
          )}
        </Formular>
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
