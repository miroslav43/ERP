// src/app/(app)/angajati/[id]/formular-contract-nou.tsx
"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { IntrareData } from "@/components/ui/intrare-data";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { creeazaContract } from "../actions";
import { dateContractNou } from "./date-contract-nou";

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
  /**
   * `organizations.zile_concediu_anual_implicit`, citit pe pagină. Textul casetei
   * promitea „21 de zile" literal în timp ce regula firmei dădea 20 (QA 8 oct
   * 2026, HR-023): cifra vine din firmă, iar câmpul o lasă schimbată per angajat.
   */
  readonly zileConcediuImplicit: number;
}

export function FormularContractNou({ employeeId, zileConcediuImplicit }: Proprietati) {
  async function trimite(date: FormData) {
    return creeazaContract(dateContractNou(employeeId, date));
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
      descriere={`Restul clauzelor — durată nedeterminată, normă de 40 de ore pe săptămână, loc de muncă la sediu — se completează cu valorile implicite și pot fi schimbate ulterior. Zilele de concediu pornesc de la cele ${String(zileConcediuImplicit)} ale firmei; dreptul anului se calculează proporțional cu lunile lucrate.`}
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

          <Camp
            nume="zile_concediu_anual"
            id={idc("zile_concediu_anual")}
            eticheta="Zile de concediu de odihnă anual"
            ajutor="Implicit conform politicii organizației — modificabil aici doar pentru acest angajat. Lăsat gol, se iau zilele firmei."
            erori={stare.erori["zile_concediu_anual"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min={0}
                max={60}
                step={1}
                defaultValue={
                  stare.valoriTrimise["zile_concediu_anual"] ?? String(zileConcediuImplicit)
                }
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
