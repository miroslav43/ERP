// src/app/(app)/salarizare/istoric-venituri/formular-istoric-venit.tsx
"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { ActionResult } from "@/lib/actions/types";

import { salveazaIstoricVenit } from "../actions";

interface AngajatOptiune {
  readonly employee_id: string;
  readonly full_name: string;
  readonly marca: string;
  /** Lista îi cuprinde și pe cei inactivi — de aceea starea se scrie în opțiune. */
  readonly status: string;
}

type RandSalvat = Readonly<{ id: string }>;

/**
 * Câmpurile numerice care nu au voie să rămână goale.
 *
 * `Formular` pune `noValidate` pe formular — bulele browserului sunt în engleză
 * și opresc trimiterea înainte ca Zod să apuce să spună ceva mai bun în română.
 * Consecința: `required` nu mai blochează nimic, iar `Number("")` e 0. Cum
 * `istoricVenitSchema` acceptă 0 la venit, la drepturi și la zile, o casetă
 * uitată goală s-ar fi salvat ca zero — exact genul de rând care mai târziu
 * trage în jos media pe șase luni a concediului medical, fără nicio eroare.
 */
const NUMERE_OBLIGATORII: readonly (readonly [string, string])[] = [
  ["an", "Anul este obligatoriu."],
  ["luna", "Luna este obligatorie."],
  ["zile_lucrate", "Numărul de zile lucrate este obligatoriu."],
  ["venit_brut", "Venitul brut este obligatoriu."],
  ["drepturi_salariale", "Drepturile salariale sunt obligatorii."],
];

function campuriGoale(fd: FormData): Record<string, readonly string[]> | null {
  const erori: Record<string, readonly string[]> = {};
  for (const [cheie, mesaj] of NUMERE_OBLIGATORII) {
    const valoare = fd.get(cheie);
    if (typeof valoare !== "string" || valoare.trim() === "") erori[cheie] = [mesaj];
  }
  return Object.keys(erori).length === 0 ? null : erori;
}

/**
 * Numele câmpurilor sunt EXACT cheile lui `istoricVenitSchema`: `employee_id`,
 * `an`, `luna`, `venit_brut`, `drepturi_salariale`, `zile_lucrate`, `sursa`.
 * Pe ele se potrivește harta `fieldErrors` construită de `create-action.ts`;
 * un nume greșit cu o literă face mesajul serverului să dispară fără urmă.
 */
async function trimite(fd: FormData): Promise<ActionResult<RandSalvat>> {
  const goluri = campuriGoale(fd);
  if (goluri !== null) {
    return {
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Completați câmpurile marcate.",
        fieldErrors: goluri,
        requestId: "validare-client",
      },
    };
  }
  return salveazaIstoricVenit({
    employee_id: fd.get("employee_id"),
    an: fd.get("an"),
    luna: fd.get("luna"),
    venit_brut: fd.get("venit_brut"),
    drepturi_salariale: fd.get("drepturi_salariale"),
    zile_lucrate: fd.get("zile_lucrate"),
    sursa: fd.get("sursa"),
  });
}

/**
 * O lună de venit realizat, într-o casetă.
 *
 * Formularul stătea permanent deschis deasupra tabelului, iar tabelul e exact
 * ce trebuie văzut înainte de a scrie: ce luni sunt deja introduse. Butonul se
 * dezactivează când nu există niciun angajat de ales — înainte, formularul se
 * randa oricum, cu un `<select>` gol și un buton mort la capătul lui.
 */
export function FormularIstoricVenit({
  angajati,
}: {
  readonly angajati: readonly AngajatOptiune[];
}) {
  return (
    <FormularDialog
      declansator={{
        eticheta: "Adaugă o lună",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
        disabled: angajati.length === 0,
      }}
      titlu="Lună de venit realizat"
      descriere="O lună introdusă de două ori se actualizează, nu se dublează. Câmpurile numerice lăsate goale NU se salvează ca zero: ar trage în jos media pe șase luni fără nicio eroare vizibilă."
      marime="mare"
      actiune={trimite}
      mesajReusita="Rândul a fost salvat."
      etichetaTrimite="Salvează luna"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Camp
              nume="employee_id"
              id={idc("employee_id")}
              eticheta="Angajat"
              fel="select"
              obligatoriu
              erori={stare.erori["employee_id"] ?? []}
              className="sm:col-span-3"
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={
                    stare.valoriTrimise["employee_id"] ?? angajati[0]?.employee_id ?? ""
                  }
                >
                  {angajati.map((angajat) => (
                    <option key={angajat.employee_id} value={angajat.employee_id}>
                      {angajat.full_name || angajat.marca}
                      {angajat.status === "activ" ? "" : ` (${angajat.status})`}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <Camp
              nume="an"
              id={idc("an")}
              eticheta="An"
              obligatoriu
              erori={stare.erori["an"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={2000}
                  max={2100}
                  defaultValue={stare.valoriTrimise["an"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="luna"
              id={idc("luna")}
              eticheta="Luna"
              obligatoriu
              erori={stare.erori["luna"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={stare.valoriTrimise["luna"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="zile_lucrate"
              id={idc("zile_lucrate")}
              eticheta="Zile lucrate"
              obligatoriu
              erori={stare.erori["zile_lucrate"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  step="0.5"
                  min={0}
                  max={31}
                  defaultValue={stare.valoriTrimise["zile_lucrate"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="venit_brut"
              id={idc("venit_brut")}
              eticheta="Venit brut (lei)"
              obligatoriu
              ajutor="Baza indemnizației de concediu medical."
              erori={stare.erori["venit_brut"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={stare.valoriTrimise["venit_brut"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="drepturi_salariale"
              id={idc("drepturi_salariale")}
              eticheta="Drepturi salariale (lei)"
              obligatoriu
              ajutor="Salariu de bază plus sporurile PERMANENTE, fără primele ocazionale. Baza indemnizației de concediu de odihnă."
              erori={stare.erori["drepturi_salariale"] ?? []}
              className="sm:col-span-2"
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={stare.valoriTrimise["drepturi_salariale"] ?? ""}
                />
              )}
            </Camp>
          </div>

          {/* `sursa` e o cheie a schemei, dar nu o alege omul — rămâne câmp ascuns. */}
          <input type="hidden" name="sursa" value="introdus manual" />
        </>
      )}
    </FormularDialog>
  );
}
