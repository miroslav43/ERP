// src/app/(app)/angajati/nou/_components/departament-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { creeazaDepartament } from "@/app/(app)/departamente/actions";

/**
 * Creare de departament FĂRĂ a părăsi înrolarea.
 *
 * Departamentul apare abia la pasul 3, iar dacă lipsește, singura ieșire era
 * să abandonezi tot ce ai completat, să-l creezi în alt modul și să reiei
 * expertul de la capăt. Caseta de mai jos îl creează pe loc și îl selectează:
 * nu se pierde nimic, fiindcă nu se navighează nicăieri.
 *
 * ┌ De ce codul se derivă, dar rămâne editabil ──────────────────────────────
 * │ `creeazaDepartamentSchema` cere ȘI `cod`, ȘI `denumire`. Cerute amândouă
 * │ de la om, caseta ar fi devenit un al doilea formular în mijlocul altuia.
 * │ Codul se completează singur din denumire — până în clipa în care cineva îl
 * │ atinge, moment în care oglindirea se oprește definitiv. Același
 * │ discriminant ca la „Vechimea în unitate" din pasul 3: intenția explicită a
 * │ omului bate comoditatea.
 * └──────────────────────────────────────────────────────────────────────────
 *
 * Erorile NU se înghit: un cod deja folosit sau lipsa dreptului
 * `departments:create` se arată aici, lângă câmp, nu ca eșec tăcut al
 * butonului. Cine n-are dreptul primește mesajul acțiunii, nu o casetă moartă.
 */

/** `Producție și logistică` → `PRODUCTIE-SI-LOGISTICA`, tăiat la 32. */
export function codDinDenumire(denumire: string): string {
  return (
    denumire
      .normalize("NFD")
      // Diacriticele se pierd DELIBERAT: codul e un identificator scurt, tastat
      // și căutat, nu un text afișat. `ș` și `ț` din denumire rămân intacte.
      .replace(/[̀-ͯ]/gu, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 32)
  );
}

export function DepartamentNou({
  laCreare,
}: {
  /** Primește departamentul creat, ca pasul să-l adauge în listă ȘI să-l selecteze. */
  readonly laCreare: (departament: { readonly id: string; readonly denumire: string }) => void;
}) {
  const [deschis, setDeschis] = useState(false);
  const [denumire, setDenumire] = useState("");
  const [cod, setCod] = useState("");
  const [codAtins, setCodAtins] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  const idDenumire = useId();
  const idCod = useId();

  function inchide(): void {
    setDeschis(false);
    setDenumire("");
    setCod("");
    setCodAtins(false);
    setEroare(null);
  }

  function creeaza(): void {
    const numeCurat = denumire.trim();
    const codCurat = (codAtins ? cod : codDinDenumire(numeCurat)).trim();
    if (numeCurat.length < 2) {
      setEroare("Denumirea trebuie să aibă cel puțin 2 caractere.");
      return;
    }
    if (codCurat.length === 0) {
      setEroare("Codul nu poate fi gol. Scrieți-l dvs. dacă denumirea nu produce unul.");
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaDepartament({
        cod: codCurat,
        denumire: numeCurat,
        descriere: null,
        parent_id: null,
        manager_employee_id: null,
        cost_center: null,
        muta_managerul_in_departament: false,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      laCreare({ id: rezultat.data.id, denumire: numeCurat });
      inchide();
    });
  }

  if (!deschis) {
    return (
      <Buton
        varianta="secundar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        + Departament nou
      </Buton>
    );
  }

  return (
    <div className="border-border bg-suprafata rounded-control flex flex-col gap-3 border p-3">
      <p className="text-corp-mic text-secundar">
        Departamentul se creează acum și se selectează pe loc. Restul înrolării rămâne cum e.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-corp-mic" htmlFor={idDenumire}>
            Denumire
          </label>
          <input
            id={idDenumire}
            type="text"
            value={denumire}
            maxLength={160}
            placeholder="Producție"
            onChange={(e) => {
              setDenumire(e.target.value);
              if (!codAtins) setCod(codDinDenumire(e.target.value));
            }}
            className="border-hairline rounded-control text-corp border px-2 py-1"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-corp-mic" htmlFor={idCod}>
            Cod
          </label>
          <input
            id={idCod}
            type="text"
            value={codAtins ? cod : codDinDenumire(denumire)}
            maxLength={32}
            placeholder="PRODUCTIE"
            onChange={(e) => {
              setCodAtins(true);
              setCod(e.target.value);
            }}
            className="border-hairline rounded-control text-corp border px-2 py-1"
          />
        </div>
      </div>

      <div aria-live="polite">
        {eroare === null ? null : <p className="text-danger text-corp-mic">{eroare}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se creează…" onClick={creeaza}>
          Creează și selectează
        </Buton>
        <Buton varianta="secundar" onClick={inchide}>
          Renunță
        </Buton>
      </div>
    </div>
  );
}
