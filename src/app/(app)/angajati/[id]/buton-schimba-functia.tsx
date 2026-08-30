// src/app/(app)/angajati/[id]/buton-schimba-functia.tsx
"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { buton } from "@/components/ui/buton";

import { atribuieFunctia } from "../actions";

/**
 * Schimbarea funcției, direct de pe fișă.
 *
 * ── DE CE UN AL DOILEA DRUM CĂTRE UN CÂMP CARE EXISTĂ DEJA ────────────────
 * Funcția se putea seta și înainte, în `/angajati/[id]/editeaza` — al treilea
 * `<select>` al secțiunii „Angajare", într-un formular de 36 de câmpuri. Cine
 * tocmai definise o funcție în nomenclator n-avea niciun indiciu că acolo
 * trebuie să meargă; întrebarea care a cerut ecranul ăsta a fost, textual, „nu
 * îmi dau seama cum să pot seta o funcție unui angajat".
 *
 * Formularul lung NU dispare: el rămâne locul unde se schimbă tot deodată.
 * Caseta asta e drumul scurt pentru singurul câmp care se schimbă des singur.
 *
 * ── NOMENCLATORUL GOL NU E O EROARE, E UN PAS LIPSĂ ───────────────────────
 * Fără nicio funcție definită, un `<select>` cu o singură opțiune („Nealocată")
 * ar fi o fundătură politicoasă: butonul se apasă, caseta se deschide, nu e
 * nimic de ales și nimic nu spune de ce. Se randează atunci linkul către
 * nomenclator, adică exact pasul care lipsește.
 */

interface Proprietati {
  readonly employeeId: string;
  readonly functieCurentaId: string | null;
  readonly functii: readonly Readonly<{ id: string; denumire: string }>[];
}

export function ButonSchimbaFunctia({ employeeId, functieCurentaId, functii }: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `atribuieFunctiaSchema`. */
  async function trimite(date: FormData) {
    const ales = String(date.get("job_position_id") ?? "");
    return atribuieFunctia({
      employee_id: employeeId,
      // Șirul gol e alegerea „Nealocată”, o stare legitimă — nu o valoare
      // lipsă. `z.uuid()` ar respinge `""`, deci conversia se face aici.
      job_position_id: ales === "" ? null : ales,
    });
  }

  if (functii.length === 0) {
    return (
      <Link href="/functii" className={buton({ varianta: "secundar" })}>
        <Briefcase aria-hidden="true" className="size-3.5" />
        Definește o funcție
      </Link>
    );
  }

  return (
    <FormularDialog
      declansator={{ eticheta: "Schimbă", varianta: "secundar" }}
      titlu="Schimbă funcția"
      descriere="Funcțiile se definesc în nomenclatorul organizației. Codul COR de pe funcție este cel care ajunge pe contractul individual de muncă și în exportul REVISAL."
      marime="mediu"
      actiune={trimite}
      mesajReusita="Funcția a fost actualizată."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <Camp
          nume="job_position_id"
          id={idc("job_position_id")}
          eticheta="Funcție"
          fel="select"
          erori={stare.erori["job_position_id"] ?? []}
        >
          {(a) => (
            <select
              {...a}
              defaultValue={stare.valoriTrimise["job_position_id"] ?? functieCurentaId ?? ""}
            >
              <option value="">Nealocată</option>
              {functii.map((optiune) => (
                <option key={optiune.id} value={optiune.id}>
                  {optiune.denumire}
                </option>
              ))}
            </select>
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}
