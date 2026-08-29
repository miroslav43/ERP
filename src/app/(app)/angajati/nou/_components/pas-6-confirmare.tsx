// src/app/(app)/angajati/nou/_components/pas-6-confirmare.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import type { InroleazaAngajatInput } from "@/schemas/employee";

interface Proprietati {
  readonly formular: UseFormReturn<InroleazaAngajatInput>;
}

function Rand({ eticheta, valoare }: { eticheta: string; valoare: string | undefined | null }) {
  if (valoare === undefined || valoare === null || valoare === "") return null;
  return (
    <div className="text-corp flex justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{eticheta}</dt>
      <dd className="text-foreground text-right font-medium">{valoare}</dd>
    </div>
  );
}

/** Recapitulare read-only — nu duplică validarea, doar reflectă ce s-a completat. */
export function Pas6Confirmare({ formular }: Proprietati) {
  // `useWatch`, nu `formular.watch()` — vezi nota din pasul de identitate.
  // Ecranul se montează la intrarea în pas, deci astăzi citește valorile
  // corecte chiar și fără abonament; dar componenta primește props cu
  // identitate stabilă și e memoizată de React Compiler, așa că orice
  // schimbare care ar ține-o montată ar îngheța recapitularea, tăcut.
  const valori = useWatch({ control: formular.control });

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-corp">
        Verificați datele înainte de a înrola angajatul. Marca se atribuie automat la trimitere.
        Puteți reveni la orice pas anterior.
      </p>

      <dl className="border-border divide-border rounded-panou divide-y border p-4">
        <Rand eticheta="Nume complet" valoare={`${valori.first_name} ${valori.last_name}`.trim()} />
        <Rand eticheta="CNP" valoare={valori.cnp} />
        <Rand eticheta="Telefon" valoare={valori.telefon} />
        <Rand eticheta="E-mail personal" valoare={valori.email_personal} />
      </dl>

      <dl className="border-border divide-border rounded-panou divide-y border p-4">
        {/*
          `Rand` ascunde rândul gol, iar numărul de contract E gol în cazul
          NORMAL — se alocă la salvare. Fără textul de mai jos, recapitularea
          finală n-ar spune un cuvânt despre numerotare, exact în ecranul care
          există ca să arate ce urmează să se scrie.
        */}
        <Rand
          eticheta="Număr contract"
          valoare={
            (valori.numar ?? "").trim() === "" ? "se alocă automat la salvare" : valori.numar
          }
        />
        <Rand eticheta="Valabil de la" valoare={valori.valabil_de_la} />
        <Rand eticheta="Vechime în unitate din" valoare={valori.hired_on} />
        <Rand
          eticheta="Durata"
          valoare={valori.contract_duration === "determinat" ? "Determinată" : "Nedeterminată"}
        />
        <Rand
          eticheta="Salariu de bază"
          valoare={
            valori.salariu_baza === undefined
              ? undefined
              : `${String(valori.salariu_baza)} ${valori.moneda ?? "RON"}`
          }
        />
        <Rand
          eticheta="Zile concediu anual"
          valoare={
            valori.zile_concediu_anual === undefined
              ? undefined
              : String(valori.zile_concediu_anual)
          }
        />
      </dl>

      <dl className="border-border divide-border rounded-panou divide-y border p-4">
        <Rand
          eticheta="Fișa postului"
          valoare={
            (valori.atributii ?? "").trim().length > 0 ||
            (valori.competente ?? "").trim().length > 0
              ? "Se generează la trimitere"
              : "Necompletată — poate fi adăugată ulterior"
          }
        />
      </dl>
    </div>
  );
}
