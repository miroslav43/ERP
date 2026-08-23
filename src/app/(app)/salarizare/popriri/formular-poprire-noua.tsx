// src/app/(app)/salarizare/popriri/formular-poprire-noua.tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

import { creeazaPoprire } from "./actions";

interface Angajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Numele câmpurilor sunt EXACT cheile lui `poprireSchema`: `employee_id`,
 * `dosar`, `creditor`, `executor`, `tip_creanta`, `suma_totala`, `suma_lunara`,
 * `prioritate`, `data_inceput`, `data_sfarsit`, `observatii`. Pe ele se
 * potrivește harta `fieldErrors` construită de `create-action.ts` — inclusiv
 * cele două verificări încrucișate din `superRefine`, care își pun mesajul pe
 * `data_sfarsit`, respectiv pe `suma_lunara`, nu la baza formularului.
 *
 * `prioritate` golită se trimite ca `undefined`, nu ca șir gol: schema are
 * `.default(100)`, iar `Number("")` ar fi intrat ca 0 și ar fi căzut pe
 * `min(1)` cu mesajul implicit al lui Zod, în engleză.
 */
async function trimite(fd: FormData) {
  const prioritate = String(fd.get("prioritate") ?? "").trim();
  return creeazaPoprire({
    employee_id: String(fd.get("employee_id") ?? ""),
    dosar: String(fd.get("dosar") ?? ""),
    creditor: String(fd.get("creditor") ?? ""),
    executor: String(fd.get("executor") ?? ""),
    tip_creanta: String(fd.get("tip_creanta") ?? "alta"),
    suma_totala: String(fd.get("suma_totala") ?? ""),
    suma_lunara: String(fd.get("suma_lunara") ?? ""),
    prioritate: prioritate === "" ? undefined : prioritate,
    data_inceput: String(fd.get("data_inceput") ?? ""),
    data_sfarsit: String(fd.get("data_sfarsit") ?? ""),
    observatii: String(fd.get("observatii") ?? ""),
  });
}

export function FormularPoprireNoua({ angajati }: { readonly angajati: readonly Angajat[] }) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);

  // `laReusita` intră în dependențele efectului de succes din `Formular`. O
  // funcție nouă la fiecare randare ar reporni efectul după `router.refresh()`,
  // iar notificarea ar apărea de două ori pentru un singur dosar deschis.
  const laReusita = useCallback(() => {
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
        Dosar nou
      </Buton>
    );
  }

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Dosarul de poprire a fost deschis."
      className="border-border rounded-panou grid w-full gap-3 border p-4 sm:grid-cols-2"
    >
      {(stare) => (
        <>
          <Camp
            nume="employee_id"
            eticheta="Angajat"
            fel="select"
            obligatoriu
            erori={stare.erori["employee_id"] ?? []}
            className="sm:col-span-2"
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["employee_id"] ?? ""}>
                <option value="">Alegeți angajatul…</option>
                {angajati.map((angajat) => (
                  <option key={angajat.id} value={angajat.id}>
                    {angajat.full_name ?? "—"} ({angajat.marca})
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp nume="dosar" eticheta="Număr dosar" obligatoriu erori={stare.erori["dosar"] ?? []}>
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={100}
                defaultValue={stare.valoriTrimise["dosar"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="creditor"
            eticheta="Creditor"
            obligatoriu
            erori={stare.erori["creditor"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                defaultValue={stare.valoriTrimise["creditor"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="executor"
            eticheta="Executor judecătoresc"
            erori={stare.erori["executor"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                defaultValue={stare.valoriTrimise["executor"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="tip_creanta"
            eticheta="Tipul creanței"
            fel="select"
            obligatoriu
            erori={stare.erori["tip_creanta"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["tip_creanta"] ?? "alta"}>
                <option value="intretinere">Obligație de întreținere (se satisface prima)</option>
                <option value="alta">Altă creanță</option>
              </select>
            )}
          </Camp>

          <Camp
            nume="suma_totala"
            eticheta="Datoria totală (lei)"
            obligatoriu
            erori={stare.erori["suma_totala"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={stare.valoriTrimise["suma_totala"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="suma_lunara"
            eticheta="Rata lunară de reținut (lei)"
            obligatoriu
            ajutor="Plafonată automat la o treime din net pentru un singur dosar, la jumătate când sunt mai multe."
            erori={stare.erori["suma_lunara"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={stare.valoriTrimise["suma_lunara"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="prioritate"
            eticheta="Prioritate"
            ajutor="Numărul mai mic se satisface primul."
            erori={stare.erori["prioritate"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="1"
                max="1000"
                defaultValue={stare.valoriTrimise["prioritate"] ?? "100"}
              />
            )}
          </Camp>

          <Camp
            nume="data_inceput"
            eticheta="Data de început"
            obligatoriu
            erori={stare.erori["data_inceput"] ?? []}
          >
            {(a) => (
              <input {...a} type="date" defaultValue={stare.valoriTrimise["data_inceput"] ?? ""} />
            )}
          </Camp>

          <Camp
            nume="data_sfarsit"
            eticheta="Data de sfârșit"
            erori={stare.erori["data_sfarsit"] ?? []}
          >
            {(a) => (
              <input {...a} type="date" defaultValue={stare.valoriTrimise["data_sfarsit"] ?? ""} />
            )}
          </Camp>

          <Camp
            nume="observatii"
            eticheta="Observații"
            fel="textarea"
            erori={stare.erori["observatii"] ?? []}
            className="sm:col-span-2"
          >
            {(a) => (
              <textarea
                {...a}
                rows={2}
                maxLength={1000}
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
              />
            )}
          </Camp>

          <div className="flex gap-2 sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se salvează…">
              Deschide dosarul
            </Buton>
            <Buton
              varianta="secundar"
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
