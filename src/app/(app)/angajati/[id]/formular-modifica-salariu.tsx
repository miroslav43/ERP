// src/app/(app)/angajati/[id]/formular-modifica-salariu.tsx
"use client";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { formatLei } from "@/lib/format/money";
import { modificaSalariulContractului } from "../actions";

/**
 * Modificarea salariului de bază, într-o casetă.
 *
 * Consecința stă în `descriere`, nu într-o notă sub câmp: modificarea se aplică
 * din următoarea perioadă calculată, iar fluturașii deja calculați rămân
 * neschimbați. E singura propoziție care contează aici, și e prima citită.
 *
 * Formularul era pe `<form action={fn}>` cu `useTransition` și un `<p>` roșu la
 * final — deci arunca `fieldErrors` și își golea singurul câmp la orice refuz.
 * Vezi nota lungă din `formular-contract-nou.tsx`.
 */

interface Proprietati {
  readonly contractId: string;
  readonly salariuActual: number;
}

export function FormularModificaSalariu({ contractId, salariuActual }: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `modificaSalariulContractuluiSchema`. */
  async function trimite(date: FormData) {
    return modificaSalariulContractului({
      contract_id: contractId,
      salariu_baza: Number(date.get("salariu_baza")),
    });
  }

  return (
    <FormularDialog
      declansator={{ eticheta: "Modifică salariul", varianta: "secundar", className: "mt-3" }}
      titlu="Modifică salariul de bază"
      descriere={`Salariul actual este ${formatLei(salariuActual)}. Modificarea se aplică din următoarea perioadă calculată — fluturașii deja calculați rămân neschimbați.`}
      marime="mediu"
      actiune={trimite}
      mesajReusita="Salariul a fost modificat."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <Camp
          nume="salariu_baza"
          id={idc("salariu_baza")}
          eticheta="Salariu de bază nou (lei)"
          obligatoriu
          erori={stare.erori["salariu_baza"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              step="0.01"
              min={0}
              defaultValue={stare.valoriTrimise["salariu_baza"] ?? salariuActual}
            />
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}
