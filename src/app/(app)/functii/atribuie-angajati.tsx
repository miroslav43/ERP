// src/app/(app)/functii/atribuie-angajati.tsx
"use client";

import { UserPlus } from "lucide-react";

import { FormularDialog } from "@/components/ui/formular-dialog";
import { clasaBifa } from "@/components/ui/camp";
import type { AngajatDeAtribuit } from "@/lib/queries/employees";

import { atribuieAngajatiPeFunctie } from "./actions";

/**
 * Cine deține funcția — bifat direct din nomenclator.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * `dezactiveazaFunctie` refuză cu „Mutați-i pe altă funcție înainte de
 * dezactivare", iar unealta la care trimitea mesajul nu exista în modul: funcția
 * cuiva se putea schimba doar din formularul complet al fișei lui, om cu om.
 * Aceeași fundătură pe care panoul de departament a reparat-o cu `mutaAngajati`.
 *
 * ── DE CE BIFE NECONTROLATE, ȘI CE COSTĂ ──────────────────────────────────
 * Casetele n-au `useState`: sunt `defaultChecked`, iar ce se trimite se citește
 * din `FormData`. Câștigul e că lista pornește de fiecare dată de la starea din
 * bază — `FormularDialog` montează copiii la deschidere, deci o casetă închisă
 * și redeschisă nu păstrează bife rămase dintr-o încercare abandonată.
 *
 * Costul, declarat: cu `<form action={fn}>`, React 19 RESETEAZĂ formularul după
 * ce acțiunea se încheie, inclusiv la refuz. `Formular` repară asta pentru
 * câmpurile obișnuite prin `valoriTrimise`, dar acolo valorile sunt
 * `Record<string, string>` — o listă de bife n-are cum să încapă. Deci la un
 * refuz bifele revin la starea din bază, nu la ce tocmai selectase omul.
 *
 * Compromisul e acceptabil fiindcă refuzurile de aici sunt exact cele după care
 * NU vrei să reîncerci cu aceeași selecție: funcția a fost dezactivată între
 * timp, sau o parte din fișe au fost refuzate de politică — ambele mesaje spun
 * „Reîncărcați pagina", iar o listă revenită la adevărul din bază e punctul
 * corect de repornire, nu o pierdere.
 *
 * ── DE CE SE ARATĂ FUNCȚIA ACTUALĂ A FIECĂRUIA ────────────────────────────
 * O bifă pusă pe cineva care deține deja altă funcție nu e o adăugare, e o
 * MUTARE: un om are o singură funcție. Fără eticheta „acum: Sudor" alături,
 * mutarea ar fi un efect secundar nevăzut al unei bife.
 */

interface Proprietati {
  readonly functie: Readonly<{ id: string; denumire: string; activ: boolean }>;
  readonly angajati: readonly AngajatDeAtribuit[];
  /** Denumirile funcțiilor, ca să se poată scrie ce deține fiecare acum. */
  readonly denumiriFunctii: Readonly<Record<string, string>>;
}

export function AtribuieAngajati({ functie, angajati, denumiriFunctii }: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `atribuieAngajatiSchema`. */
  async function trimite(date: FormData) {
    return atribuieAngajatiPeFunctie({
      job_position_id: functie.id,
      // `getAll`, nu `get`: bifele împart același `name`, iar `get` ar întoarce
      // doar prima. Lista goală e validă — înseamnă „nimeni nu mai ține funcția".
      employee_ids: date.getAll("employee_ids").map(String),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Atribuie",
        varianta: "tertiar",
        pictograma: <UserPlus aria-hidden="true" className="size-3.5" />,
      }}
      titlu={`Cine deține „${functie.denumire}”`}
      descriere={
        functie.activ
          ? "Bifați persoanele care dețin funcția. Debifarea o retrage — un om are o singură funcție, deci bifa mută pe cineva care deține deja alta."
          : "Funcția este dezactivată, deci nu poate primi persoane noi. Debifarea rămâne permisă: golirea ei este chiar pasul cerut înainte de dezactivare."
      }
      marime="mare"
      actiune={trimite}
      mesajReusita="Deținătorii funcției au fost actualizați."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {() =>
        angajati.length === 0 ? (
          <p className="text-muted-foreground text-corp py-4 text-center">
            Nu există fișe de angajat active în organizație.
          </p>
        ) : (
          <fieldset className="min-w-0">
            <legend className="sr-only">Angajații care dețin funcția {functie.denumire}</legend>
            <ul className="divide-border border-border rounded-panou max-h-96 divide-y overflow-y-auto border">
              {angajati.map((angajat) => {
                const areFunctiaAsta = angajat.job_position_id === functie.id;
                const altaFunctie =
                  angajat.job_position_id === null || areFunctiaAsta
                    ? null
                    : (denumiriFunctii[angajat.job_position_id] ?? "altă funcție");
                return (
                  <li key={angajat.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        name="employee_ids"
                        value={angajat.id}
                        defaultChecked={areFunctiaAsta}
                        className={clasaBifa}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-corp block truncate">{angajat.full_name}</span>
                        <span className="text-muted-foreground text-nota block font-mono">
                          {angajat.marca}
                        </span>
                      </span>
                      {altaFunctie === null ? null : (
                        <span className="text-muted-foreground text-nota shrink-0">
                          acum: {altaFunctie}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )
      }
    </FormularDialog>
  );
}
