// src/app/(app)/departamente/formular-departament-nou.tsx
"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

import { creeazaDepartament } from "./actions";

/**
 * Departament nou.
 *
 * Prin `<Formular>` + `<Camp>` din motivul măsurat în tot nomenclatorul: cu
 * `<form action={fn}>` și câmpuri necontrolate, React 19 RESETEAZĂ formularul
 * după acțiune, inclusiv când acțiunea a fost refuzată. Un cod deja folosit —
 * refuzat de indexul unic, nu de schemă, deci abia după drumul la server —
 * ștergea și denumirea, și descrierea, și centrul de cost, și cele două
 * selecții. `valoriTrimise` le pune înapoi ca `defaultValue`.
 *
 * Identificatorii se prefixează cu `useId()`: pe aceeași pagină stau N
 * formulare de editare din `actiuni-departament.tsx`, cu exact aceleași nume de
 * câmp, iar `Camp` derivă `id` din `nume`.
 */

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
  });
}

export function FormularDepartamentNou({ departamente, angajati }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în lista de dependențe a efectului din
  // `Formular`. O funcție nouă la fiecare randare ar reporni efectul după
  // succes, deci notificarea ar apărea de două ori.
  const laReusita = useCallback((): void => {
    setDeschis(false);
    router.refresh();
  }, [router]);

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
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Departamentul a fost creat."
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      {(stare) => (
        <>
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

          <Camp
            nume="manager_employee_id"
            id={idc("manager_employee_id")}
            eticheta="Manager"
            fel="select"
            erori={stare.erori["manager_employee_id"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["manager_employee_id"] ?? ""}>
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
                rows={2}
                defaultValue={stare.valoriTrimise["descriere"] ?? ""}
              />
            )}
          </Camp>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se creează…">
              Creează departamentul
            </Buton>
            <Buton
              varianta="link"
              disabled={stare.inCurs}
              onClick={() => {
                setDeschis(false);
              }}
            >
              Renunță
            </Buton>
          </div>
        </>
      )}
    </Formular>
  );
}
