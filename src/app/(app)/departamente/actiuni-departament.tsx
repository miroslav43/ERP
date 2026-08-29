// src/app/(app)/departamente/actiuni-departament.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Ban, Pencil, Undo2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { CampManager } from "./camp-manager";
import type { OptiuneAngajat } from "./tipuri";
import {
  actualizeazaDepartament,
  dezactiveazaDepartament,
  mutaDepartament,
  reactiveazaDepartament,
} from "./actions";

/**
 * Acțiunile unui departament, din panoul lui.
 *
 * ── DE CE CASETE, NU PANOURI DESFĂCUTE ÎN LOC ─────────────────────────────
 * Editarea și mutarea se deschideau SUB rândul departamentului, împingând în
 * jos tot ce urma. Pe o structură cu opt departamente, deschiderea celui de-al
 * doilea muta restul listei cu ~280 px, iar organigrama își pierdea forma exact
 * în momentul în care omul avea nevoie de ea ca să aleagă departamentul
 * superior. Acum contextul rămâne pe loc și caseta stă deasupra lui.
 *
 * ── CE NU S-A MUTAT ÎN CASETĂ ─────────────────────────────────────────────
 * Dezactivarea și reactivarea rămân butoane directe, pe `useTransition`: n-au
 * niciun câmp de completat. Nu cer nici confirmare, și e o decizie, nu o
 * scăpare — se desfac dintr-un clic. Confirmarea se păstrează pentru ce chiar
 * nu se mai poate lua înapoi (închiderea lunii de salarizare, trimiterea
 * fluturașilor). Un dialog pus peste tot își pierde înțelesul exact acolo unde
 * ar trebui să oprească pe cineva.
 */

interface OptiuneDepartament {
  readonly id: string;
  readonly denumire: string;
  readonly cod: string;
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
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  if (!poateEdita) return null;

  /**
   * Cheile obiectului sunt EXACT cele din `actualizeazaDepartamentSchema`.
   *
   * `parent_id` NU vine din formular, ci din props: schema îl are cu
   * `.default(null)`, deci un formular care nu-l trimite ar muta departamentul
   * la rădăcină la fiecare salvare de denumire. Mutarea are caseta ei.
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
      // Bifa apare doar când managerul ales vine din alt departament. Absentă,
      // `FormData` n-o are deloc — iar `""` e citit `false` de schemă, adică
      // „nu-l muta". Exact ce trebuie: consimțământul lipsă nu mută pe nimeni.
      muta_managerul_in_departament: String(date.get("muta_managerul_in_departament") ?? ""),
    });
  }

  /**
   * Mutarea trece acum prin `Formular`, ca editarea. Refuzurile pe care le
   * ridică triggerul cu P0001 — ciclu în arbore, adâncime depășită — nu aparțin
   * unui câmp anume, deci `Formular` le arată în `Callout`-ul de sus al casetei,
   * unde înainte erau un `<p>` roșu sub butoane.
   */
  async function trimiteMutare(date: FormData) {
    const parinte = String(date.get("parent_id") ?? "");
    return mutaDepartament({
      id: departament.id,
      parent_id: parinte === "" ? null : parinte,
    });
  }

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
        <FormularDialog
          declansator={{
            eticheta: "Editează",
            varianta: "tertiar",
            pictograma: <Pencil aria-hidden="true" className="size-3.5" />,
          }}
          titlu={`Editează „${departament.denumire}”`}
          descriere="Codul departamentului nu se schimbă de aici; el intră în rapoarte și în export. Pentru a-l muta în structură, folosiți „Mută”."
          marime="mare"
          actiune={trimiteEditare}
          mesajReusita="Departamentul a fost salvat."
          etichetaTrimite="Salvează"
          textInCurs="Se salvează…"
        >
          {(stare, idc) => (
            <div className="grid gap-4 sm:grid-cols-2">
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

              <CampManager
                idc={idc}
                erori={stare.erori["manager_employee_id"] ?? []}
                angajati={angajati}
                departamentId={departament.id}
                numeDepartament={departament.denumire}
                managerInitial={
                  stare.valoriTrimise["manager_employee_id"] ?? departament.manager_employee_id
                }
              />

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
                    rows={3}
                    defaultValue={stare.valoriTrimise["descriere"] ?? departament.descriere ?? ""}
                  />
                )}
              </Camp>
            </div>
          )}
        </FormularDialog>

        <FormularDialog
          declansator={{
            eticheta: "Mută",
            varianta: "tertiar",
            pictograma: <ArrowRightLeft aria-hidden="true" className="size-3.5" />,
          }}
          titlu={`Mută „${departament.denumire}”`}
          descriere="Departamentul pleacă cu tot ce are sub el. Un departament nu poate ajunge sub unul dintre propriii descendenți."
          marime="mediu"
          actiune={trimiteMutare}
          mesajReusita="Departamentul a fost mutat."
          etichetaTrimite="Mută"
          textInCurs="Se mută…"
        >
          {(stare, idc) => (
            <Camp
              nume="parent_id"
              id={idc("parent_id")}
              eticheta="Mută sub"
              fel="select"
              erori={stare.erori["parent_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={stare.valoriTrimise["parent_id"] ?? departament.parent_id ?? ""}
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
              )}
            </Camp>
          )}
        </FormularDialog>

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
    </div>
  );
}
