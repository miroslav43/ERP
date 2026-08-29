// src/app/(app)/departamente/camp-manager.tsx
"use client";

import { useState } from "react";

import { Callout } from "@/components/ui/callout";
import { Camp, clasaBifa } from "@/components/ui/camp";

import type { OptiuneAngajat } from "./tipuri";

/**
 * Câmpul „Manager", plus consecința lui pe fișa omului ales.
 *
 * ── DE CE E O COMPONENTĂ, NU DOUĂ `<select>`-uri COPIATE ──────────────────
 * Selectul de manager exista în două locuri — „Departament nou" și „Editează" —
 * identic, cu `defaultValue` diferit. Bifa de mai jos trebuie să apară în
 * amândouă, la aceeași condiție, cu același nume de câmp și același text. A doua
 * copie e exact locul unde regula se desparte tăcut de prima: se schimbă
 * condiția într-un fișier, iar celălalt formular continuă să mute oameni după
 * regula veche, fără ca nimic să dea eroare.
 *
 * ── DE CE SELECTUL E CONTROLAT ────────────────────────────────────────────
 * Avertismentul depinde de cine e ales ACUM, deci alegerea trebuie citită la
 * fiecare tastă, nu la trimitere. Efectul secundar e binevenit: cu `<form
 * action={fn}>` React 19 RESETEAZĂ câmpurile necontrolate după acțiune, inclusiv
 * după un refuz — starea de aici supraviețuiește, deci selecția rămâne pe ecran
 * împreună cu avertismentul ei.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu decide nimic. Regula e în `@/domain/departments/manager-membru`, pe server,
 * unde e și testată; aici se strânge doar consimțământul. Un formular ocolit
 * (POST direct către acțiune) nu trimite bifa, iar schema o citește `false` —
 * deci nimeni nu e mutat din tăcere. Vezi `consimtamantMutareManager`.
 */

export type PropsCampManager = Readonly<{
  /** Prefixul de identificatori al formularului-gazdă: `idc` din `FormularDialog`. */
  idc: (sufix: string) => string;
  erori: readonly string[];
  angajati: readonly OptiuneAngajat[];
  /**
   * Departamentul care primește managerul. `null` la CREARE — nu există încă,
   * deci orice om deja repartizat vine, prin definiție, din altă parte.
   */
  departamentId: string | null;
  /** Cum se numește în avertisment: „Producție" sau, la creare, „departamentul nou". */
  numeDepartament: string;
  /** Managerul de acum, ca valoare inițială a selectului. */
  managerInitial: string | null;
}>;

export function CampManager({
  idc,
  erori,
  angajati,
  departamentId,
  numeDepartament,
  managerInitial,
}: PropsCampManager) {
  const [managerAles, setManagerAles] = useState(managerInitial ?? "");

  const ales = angajati.find((a) => a.id === managerAles) ?? null;
  // Comparația e pe ID, niciodată pe denumire: două departamente pot purta
  // același nume în firme diferite, iar `denumire` poate fi și „alt departament",
  // eticheta pusă în locul unuia ascuns de RLS.
  const vineDinAltDepartament =
    ales !== null && ales.departamentId !== null && ales.departamentId !== departamentId;

  const idBifa = idc("muta_managerul_in_departament");

  return (
    <>
      <Camp
        nume="manager_employee_id"
        id={idc("manager_employee_id")}
        eticheta="Manager"
        fel="select"
        erori={erori}
        ajutor="Managerul desemnat este repartizat și ca membru al departamentului."
      >
        {(a) => (
          <select
            {...a}
            value={managerAles}
            onChange={(e) => {
              setManagerAles(e.target.value);
            }}
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

      {vineDinAltDepartament ? (
        <div className="sm:col-span-2">
          <Callout fel="atentie">
            <span className="block">
              <strong>{ales.full_name}</strong> este acum în „
              {ales.departamentDenumire ?? "alt departament"}”. Ca membru poate sta într-un singur
              departament.
            </span>
            <span className="mt-2 flex items-start gap-2">
              <input
                id={idBifa}
                name="muta_managerul_in_departament"
                type="checkbox"
                defaultChecked
                className={`${clasaBifa} mt-0.5`}
              />
              <label htmlFor={idBifa} className="text-corp">
                Mută-l în „{numeDepartament}” la salvare
              </label>
            </span>
            <span className="text-muted-foreground text-nota mt-2 block">
              Nebifat, rămâne manager fără să fie membru: nu va apărea în lista departamentului și
              nu va intra în efectivul lui.
            </span>
          </Callout>
        </div>
      ) : null}
    </>
  );
}
