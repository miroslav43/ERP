// src/app/(app)/angajati/[id]/formular-contract-nou.tsx
"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { IntrareData } from "@/components/ui/intrare-data";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { creeazaContract } from "../actions";

/**
 * Contract nou, într-o casetă.
 *
 * ── CE S-A REPARAT ODATĂ CU MUTAREA ───────────────────────────────────────
 * Formularul se desfăcea sub secțiunea de contracte și era scris pe tiparul cel
 * mai vechi din depozit: `<form action={fn}>` cu `useTransition`, etichete și
 * `<input>` de mână, și un singur `<p>` roșu la final. Două consecințe, ambele
 * tăcute:
 *
 * 1. **`fieldErrors` se aruncau.** `create-action.ts` le construiește la
 *    FIECARE acțiune, prin `z.flattenError`. Un număr de contract deja folosit —
 *    refuzat de indexul unic, deci abia după drumul la server — spunea „Datele
 *    introduse nu sunt valide." sub buton, fără să arate CARE câmp.
 * 2. **Ce s-a scris se pierdea.** React 19 resetează un `<form action={fn}>`
 *    necontrolat după orice acțiune, inclusiv una refuzată: cele patru câmpuri
 *    se goleau la fiecare încercare eșuată. `Formular` le pune înapoi prin
 *    `valoriTrimise`, iar caseta nu se închide la refuz.
 */

interface Proprietati {
  readonly employeeId: string;
}

export function FormularContractNou({ employeeId }: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `creeazaContractSchema`. */
  async function trimite(date: FormData) {
    return creeazaContract({
      employee_id: employeeId,
      numar: String(date.get("numar") ?? ""),
      data_contract: String(date.get("data_contract") ?? ""),
      valabil_de_la: String(date.get("valabil_de_la") ?? ""),
      salariu_baza: Number(date.get("salariu_baza")),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Contract nou",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
        className: "mt-3",
      }}
      titlu="Contract nou"
      descriere="Restul clauzelor — durată nedeterminată, normă de 40 de ore pe săptămână, loc de muncă la sediu, 21 de zile de concediu anual — se completează cu valorile implicite și pot fi schimbate ulterior."
      marime="mare"
      actiune={trimite}
      mesajReusita="Contractul a fost creat."
      etichetaTrimite="Creează contractul"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="numar"
            id={idc("numar")}
            eticheta="Număr contract"
            obligatoriu
            erori={stare.erori["numar"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={40}
                defaultValue={stare.valoriTrimise["numar"] ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="data_contract"
            id={idc("data_contract")}
            eticheta="Data contractului"
            obligatoriu
            erori={stare.erori["data_contract"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["data_contract"] ?? ""} />}
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
            nume="salariu_baza"
            id={idc("salariu_baza")}
            eticheta="Salariu de bază (lei)"
            obligatoriu
            erori={stare.erori["salariu_baza"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                step="0.01"
                min={0}
                defaultValue={stare.valoriTrimise["salariu_baza"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
