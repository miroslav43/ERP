"use client";

// src/app/(app)/evaluari/kpi/deschide-luna.tsx

/**
 * Deschiderea lunii pentru un angajat.
 *
 * ── DE CE LISTA POATE FI GOALĂ, ȘI CE SE SPUNE ATUNCI ─────────────────────
 * `angajatiPentruKpi` întoarce doar subordonații DIRECȚI (sau toată firma, la
 * scope `all`), fiindcă politica de scriere din 0119 cere managerul direct. Un
 * manager fără subordonați direcți primește deci o listă goală — și trebuie
 * să afle DE CE, nu să vadă un `<select>` fără opțiuni. Aceeași regulă ca la
 * angajatul fără funcție: capcana tăcută se explică, nu se lasă tăcută.
 */

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { OptiuneAngajatKpi } from "@/lib/queries/kpi";

import { numeLuna } from "./etichete";
import { deschideLunaKpi } from "./actions";

export function DeschideLuna({
  angajati,
  an,
  luna,
}: Readonly<{
  angajati: readonly OptiuneAngajatKpi[];
  an: number;
  luna: number;
}>): ReactElement {
  const router = useRouter();
  const faraFunctie = angajati.filter((a) => a.functie === null || a.functie.trim() === "");

  return (
    <FormularDialog
      declansator={{
        eticheta: "Deschide luna",
        varianta: "primar",
        pictograma: <Plus className="size-4" />,
      }}
      titlu={`Deschide ${numeLuna(an, luna)}`}
      descriere="Liniile se preiau din setul funcției angajatului, cu ținta lui dacă are una pusă anume."
      etichetaTrimite="Deschide luna"
      mesajReusita="Luna a fost deschisă."
      actiune={deschideLunaKpi}
      laReusita={(date) => {
        router.push(`/evaluari/kpi/${date.id}`);
      }}
      marime="lucru"
    >
      {(stare) => (
        <>
          <input type="hidden" name="an" value={String(an)} />
          <input type="hidden" name="luna" value={String(luna)} />

          {angajati.length === 0 ? (
            <Callout fel="atentie" titlu="Niciun subordonat direct">
              Luna se deschide doar pentru angajații al căror manager direct sunteți. Dacă echipa vă
              raportează printr-un șef intermediar, el o deschide.
            </Callout>
          ) : (
            <>
              <Camp
                nume="employee_id"
                eticheta="Angajatul"
                obligatoriu
                erori={stare.erori["employee_id"] ?? []}
                fel="select"
                ajutor="Doar angajații al căror manager direct sunteți."
              >
                {(a) => (
                  <select {...a} defaultValue={stare.valoriTrimise["employee_id"] ?? ""}>
                    <option value="">Alegeți angajatul…</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.full_name} ({ang.marca})
                        {ang.functie === null || ang.functie.trim() === "" ? " — fără funcție" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {faraFunctie.length > 0 ? (
                <Callout fel="atentie" titlu="Unii angajați n-au funcție">
                  {faraFunctie.length === 1
                    ? `${faraFunctie[0]?.full_name ?? "Un angajat"} nu are funcție scrisă`
                    : `${String(faraFunctie.length)} angajați nu au funcție scrisă`}
                  , deci nu au set de indicatori. Completați-le funcția în fișă, apoi reveniți.
                </Callout>
              ) : null}
            </>
          )}
        </>
      )}
    </FormularDialog>
  );
}
