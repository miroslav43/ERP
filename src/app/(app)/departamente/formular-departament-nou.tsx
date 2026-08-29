// src/app/(app)/departamente/formular-departament-nou.tsx
"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { CampManager } from "./camp-manager";
import type { OptiuneAngajat } from "./tipuri";
import { creeazaDepartament } from "./actions";

/**
 * Departament nou, într-o casetă.
 *
 * ── DE CE NU MAI CREȘTE ÎN PAGINĂ ─────────────────────────────────────────
 * Formularul se desfăcea în coloana din dreapta antetului, iar cele șase
 * câmpuri împingeau organigrama sub linia de plutire: pe o structură goală
 * ecranul era formular și atât, iar banda „2 persoane fără departament" ajungea
 * la 700 px sub titlu. Cine voia să vadă ce coduri sunt deja luate — exact
 * întrebarea de dinaintea completării câmpului „Cod" — trebuia să închidă
 * formularul, să se uite, și să-l redeschidă gol.
 *
 * ── CE PĂSTREAZĂ DIN VARIANTA VECHE ───────────────────────────────────────
 * Cu `<form action={fn}>` și câmpuri necontrolate, React 19 RESETEAZĂ
 * formularul după acțiune, inclusiv când a fost refuzată. Un cod deja folosit —
 * respins de indexul unic, nu de schemă, deci abia după drumul la server —
 * ștergea și denumirea, și descrierea, și centrul de cost, și cele două
 * selecții. `stare.valoriTrimise` le pune înapoi ca `defaultValue`, iar caseta
 * NU se închide la refuz: vezi `FormularDialog`.
 *
 * Identificatorii trec prin `idc`: pe aceeași pagină stau N formulare de
 * editare din `actiuni-departament.tsx`, cu exact aceleași nume de câmp, iar
 * `Camp` derivă `id` din `nume`.
 */

interface OptiuneDepartament {
  readonly id: string;
  readonly denumire: string;
  readonly cod: string;
}

interface Proprietati {
  readonly departamente: readonly OptiuneDepartament[];
  readonly angajati: readonly OptiuneAngajat[];
}

/** Cheile obiectului sunt EXACT cele din `creeazaDepartamentSchema`. */
async function trimite(date: FormData) {
  // `uuidOptional` nu cunoaște șirul gol: „— rădăcină —” și „— nedesemnat —”
  // devin `null` aici, nu în schemă.
  const parinte = String(date.get("parent_id") ?? "");
  const manager = String(date.get("manager_employee_id") ?? "");
  return creeazaDepartament({
    cod: String(date.get("cod") ?? ""),
    denumire: String(date.get("denumire") ?? ""),
    descriere: String(date.get("descriere") ?? ""),
    parent_id: parinte === "" ? null : parinte,
    manager_employee_id: manager === "" ? null : manager,
    cost_center: String(date.get("cost_center") ?? ""),
    // Vezi nota din `actiuni-departament.tsx`: bifa lipsă înseamnă „nu-l muta".
    muta_managerul_in_departament: String(date.get("muta_managerul_in_departament") ?? ""),
  });
}

export function FormularDepartamentNou({ departamente, angajati }: Proprietati) {
  return (
    <FormularDialog
      declansator={{
        eticheta: "Departament nou",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Departament nou"
      descriere="Codul e unic în organizație și se folosește în rapoarte. Departamentul superior poate fi schimbat oricând, din structura de mai jos."
      marime="mare"
      actiune={trimite}
      mesajReusita="Departamentul a fost creat."
      etichetaTrimite="Creează departamentul"
      textInCurs="Se creează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="cod"
            id={idc("cod")}
            eticheta="Cod"
            obligatoriu
            erori={stare.erori["cod"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={32}
                defaultValue={stare.valoriTrimise["cod"] ?? ""}
              />
            )}
          </Camp>

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
                defaultValue={stare.valoriTrimise["denumire"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="parent_id"
            id={idc("parent_id")}
            eticheta="Departament superior"
            fel="select"
            erori={stare.erori["parent_id"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["parent_id"] ?? ""}>
                <option value="">— rădăcină —</option>
                {departamente.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.denumire} ({d.cod})
                  </option>
                ))}
              </select>
            )}
          </Camp>

          {/*
           * `departamentId={null}`: departamentul nu există încă, deci ORICE om
           * deja repartizat vine, prin definiție, din altă parte — și primește
           * avertismentul. Cine e nerepartizat intră aici tăcut, ca peste tot.
           */}
          <CampManager
            idc={idc}
            erori={stare.erori["manager_employee_id"] ?? []}
            angajati={angajati}
            departamentId={null}
            numeDepartament="departamentul nou"
            managerInitial={stare.valoriTrimise["manager_employee_id"] ?? null}
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
                defaultValue={stare.valoriTrimise["cost_center"] ?? ""}
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
                defaultValue={stare.valoriTrimise["descriere"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
