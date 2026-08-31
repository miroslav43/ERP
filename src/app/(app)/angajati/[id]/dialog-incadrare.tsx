// src/app/(app)/angajati/[id]/dialog-incadrare.tsx
"use client";

import { useId, useState } from "react";

import { Camp } from "@/components/ui/camp";
import { CautaCor } from "@/components/cauta-cor";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { actualizeazaIncadrarea } from "../actions";

/**
 * Încadrarea, schimbată de pe fișă: funcție, cod COR, departament, manager.
 *
 * ── DE CE UN SINGUR DIALOG, ȘI NU PATRU BUTOANE „SCHIMBĂ" ─────────────────
 * Toate patru sunt coloane pe `employees`, deci o singură acțiune și o singură
 * permisiune. Patru casete ar fi însemnat patru scrieri separate pentru o
 * mișcare pe care omul o gândește ca una singură („l-am mutat în Producție, ca
 * șef de echipă, sub Ionescu"), plus patru ocazii de a o lăsa pe jumătate.
 *
 * Predecesorul lui (`ButonSchimbaFunctia`) schimba doar funcția, alegând-o
 * dintr-un `<select>` alimentat de nomenclator. Nomenclatorul a fost desființat
 * de migrarea 0110: funcția e acum text liber plus un cod COR căutat în
 * Clasificarea Ocupațiilor.
 *
 * ── DE CE SE PRE-COMPLETEAZĂ TOATE PATRU ──────────────────────────────────
 * Nu din politețe. `manager_employee_id` gol declanșează
 * `tg_employees_manager_path`, care rescrie `manager_path` la TOȚI subordonații;
 * cum scope-ul „team" se rezolvă peste tot pe `manager_path`, o ramură întreagă
 * ar deveni invizibilă pentru managerul ei — fără nicio eroare. Un formular care
 * pornește gol ar transforma „am vrut să schimb doar funcția" în exact asta.
 * Cu valorile curente pre-completate, golirea rămâne o alegere.
 *
 * ── DE CE DENUMIREA NU E DEDUSĂ DIN COD ───────────────────────────────────
 * Alegerea unui cod COR completează denumirea DOAR dacă e goală. Firma are voie
 * să scrie „Sudor MAG, schimbul 2" peste eticheta oficială a codului 721208 —
 * ce se declară la ITM e codul, nu textul.
 */
interface Proprietati {
  readonly employeeId: string;
  readonly functie: string | null;
  readonly codCor: string | null;
  readonly departamentId: string | null;
  readonly managerId: string | null;
  readonly departamente: readonly Readonly<{ id: string; denumire: string }>[];
  /** Colegii care pot fi manager — fișa curentă e deja exclusă de apelant. */
  readonly colegi: readonly Readonly<{ id: string; full_name: string; marca: string }>[];
  /** Denumirile deja folosite în firmă, pentru sugestii. */
  readonly functiiFolosite: readonly string[];
}

export function DialogIncadrare({
  employeeId,
  functie,
  codCor,
  departamentId,
  managerId,
  departamente,
  colegi,
  functiiFolosite,
}: Proprietati) {
  const idSugestii = useId();
  /**
   * Denumirea e ținută în stare (nu doar `defaultValue`) fiindcă alegerea unui
   * cod COR o poate completa. Restul câmpurilor rămân necontrolate: nimic nu le
   * scrie din afară.
   */
  const [denumire, setDenumire] = useState(functie ?? "");

  /** Cheile obiectului sunt EXACT cele din `incadrareSchema`. */
  async function trimite(date: FormData) {
    const gol = (cheie: string): string | null => {
      const valoare = String(date.get(cheie) ?? "").trim();
      return valoare === "" ? null : valoare;
    };
    return actualizeazaIncadrarea({
      employee_id: employeeId,
      functie: gol("functie"),
      cod_cor: gol("cod_cor"),
      // Șirul gol e opțiunea „— Nealocat —", o stare legitimă. `z.uuid()` l-ar
      // respinge, deci conversia se face aici.
      department_id: gol("department_id"),
      manager_employee_id: gol("manager_employee_id"),
    });
  }

  return (
    <FormularDialog
      declansator={{ eticheta: "Schimbă", varianta: "secundar" }}
      titlu="Schimbă încadrarea"
      descriere="Funcția e text liber; codul COR se alege din Clasificarea Ocupațiilor și ajunge pe contractul individual de muncă și în exportul REVISAL."
      marime="mediu"
      actiune={trimite}
      mesajReusita="Încadrarea a fost actualizată."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="space-y-4">
          <Camp
            nume="functie"
            id={idc("functie")}
            eticheta="Funcție"
            erori={stare.erori["functie"] ?? []}
          >
            {(a) => (
              <>
                <input
                  {...a}
                  type="text"
                  maxLength={160}
                  list={idSugestii}
                  value={denumire}
                  onChange={(eveniment) => {
                    setDenumire(eveniment.target.value);
                  }}
                  placeholder="Sudor, Operator producție, Director general…"
                />
                {/*
                  Sugestiile sunt denumirile CHIAR FOLOSITE în firmă, nu un
                  nomenclator: lista se naște din fișe (`functiiFolosite`), deci
                  nu poate propune niciodată ceva ce nu există.
                */}
                <datalist id={idSugestii}>
                  {functiiFolosite.map((denumireExistenta) => (
                    <option key={denumireExistenta} value={denumireExistenta} />
                  ))}
                </datalist>
              </>
            )}
          </Camp>

          <Camp
            nume="cod_cor"
            id={idc("cod_cor")}
            eticheta="Cod COR"
            erori={stare.erori["cod_cor"] ?? []}
            ajutor="Șase cifre din Clasificarea Ocupațiilor din România. Fără el, exportul REVISAL se oprește."
          >
            {(a) => (
              <CautaCor
                idInput={a.id}
                valoareInitiala={stare.valoriTrimise["cod_cor"] ?? codCor ?? ""}
                invalid={(stare.erori["cod_cor"] ?? []).length > 0}
                descrisDe={a["aria-describedby"]}
                laAlegere={(ocupatie) => {
                  // Numai când e goală: o denumire scrisă de om nu se
                  // suprascrie cu eticheta oficială a codului.
                  setDenumire((curenta) => (curenta.trim() === "" ? ocupatie.denumire : curenta));
                }}
              />
            )}
          </Camp>

          <Camp
            nume="department_id"
            id={idc("department_id")}
            eticheta="Departament"
            fel="select"
            erori={stare.erori["department_id"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={stare.valoriTrimise["department_id"] ?? departamentId ?? ""}
              >
                <option value="">— Nealocat —</option>
                {departamente.map((departament) => (
                  <option key={departament.id} value={departament.id}>
                    {departament.denumire}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="manager_employee_id"
            id={idc("manager_employee_id")}
            eticheta="Manager direct"
            fel="select"
            erori={stare.erori["manager_employee_id"] ?? []}
            ajutor="Cine îi aprobă concediile. Fără manager direct, cererile lui nu ajung la nimeni."
          >
            {(a) => (
              <select
                {...a}
                defaultValue={stare.valoriTrimise["manager_employee_id"] ?? managerId ?? ""}
              >
                <option value="">— Nedesemnat —</option>
                {colegi.map((coleg) => (
                  <option key={coleg.id} value={coleg.id}>
                    {coleg.full_name} · {coleg.marca}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
