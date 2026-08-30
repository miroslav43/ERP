// src/app/(app)/angajati/[id]/formular-scutire-fiscala.tsx
"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { IntrareData } from "@/components/ui/intrare-data";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { TIPURI_SCUTIRE } from "@/schemas/employee";
import { ETICHETE_SCUTIRE } from "../etichete";
import { adaugaScutireFiscala } from "./scutiri-actions";

/**
 * Scutire fiscală nouă, într-o casetă.
 *
 * Cele șase câmpuri se desfăceau sub lista scutirilor existente și o împingeau
 * afară din privire — exact lista din care se vede dacă scutirea pe care vrei
 * s-o adaugi nu e deja acolo, cu altă perioadă.
 *
 * Ca la celelalte formulare ale fișei, trecerea prin `Formular` repară două
 * lucruri tăcute: `fieldErrors` nu se mai aruncă, iar resetul de după acțiune
 * al lui React 19 nu mai golește tot la fiecare refuz. Vezi nota lungă din
 * `formular-contract-nou.tsx`.
 */

interface Proprietati {
  readonly employeeId: string;
}

export function FormularScutireFiscala({ employeeId }: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `adaugaScutireFiscalaSchema`. */
  async function trimite(date: FormData) {
    // Câmpurile opționale: schemele nu cunosc șirul gol, deci se traduce în
    // `null` aici, nu în schemă.
    const valabilPana = String(date.get("valabil_pana") ?? "");
    const procent = String(date.get("procent_scutire") ?? "");
    const plafon = String(date.get("plafon_lunar") ?? "");
    const temei = String(date.get("temei_legal") ?? "");
    return adaugaScutireFiscala({
      employee_id: employeeId,
      exemption_type: String(date.get("exemption_type") ?? ""),
      valabil_de_la: String(date.get("valabil_de_la") ?? ""),
      valabil_pana: valabilPana === "" ? null : valabilPana,
      procent_scutire: procent === "" ? null : Number(procent),
      plafon_lunar: plafon === "" ? null : Number(plafon),
      temei_legal: temei === "" ? null : temei,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Scutire fiscală nouă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
        className: "mt-3",
      }}
      titlu="Scutire fiscală nouă"
      descriere="Fără procent completat, scutirea rămâne înregistrată dar NU se aplică automat la calculul salarizării."
      marime="mare"
      actiune={trimite}
      mesajReusita="Scutirea a fost adăugată."
      etichetaTrimite="Adaugă scutirea"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="exemption_type"
            id={idc("exemption_type")}
            eticheta="Tip scutire"
            fel="select"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["exemption_type"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["exemption_type"] ?? ""}>
                {TIPURI_SCUTIRE.map((tip) => (
                  <option key={tip} value={tip}>
                    {ETICHETE_SCUTIRE[tip]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="valabil_de_la"
            id={idc("valabil_de_la")}
            eticheta="Valabil de la"
            obligatoriu
            erori={stare.erori["valabil_de_la"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["valabil_de_la"] ?? ""} />}
          </Camp>

          <Camp
            nume="valabil_pana"
            id={idc("valabil_pana")}
            eticheta="Valabil până la"
            ajutor="Lăsat gol, scutirea rămâne valabilă pe termen nedefinit."
            erori={stare.erori["valabil_pana"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["valabil_pana"] ?? ""} />}
          </Camp>

          <Camp
            nume="procent_scutire"
            id={idc("procent_scutire")}
            eticheta="Procent scutire (%)"
            erori={stare.erori["procent_scutire"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                step="0.01"
                min={0}
                max={100}
                placeholder="ex. 10"
                defaultValue={stare.valoriTrimise["procent_scutire"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="plafon_lunar"
            id={idc("plafon_lunar")}
            eticheta="Plafon lunar (lei)"
            erori={stare.erori["plafon_lunar"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                step="0.01"
                min={0}
                defaultValue={stare.valoriTrimise["plafon_lunar"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="temei_legal"
            id={idc("temei_legal")}
            eticheta="Temei legal"
            className="sm:col-span-2"
            erori={stare.erori["temei_legal"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={500}
                defaultValue={stare.valoriTrimise["temei_legal"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
