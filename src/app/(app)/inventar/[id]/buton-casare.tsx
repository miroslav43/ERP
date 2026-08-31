"use client";

import { PackageX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { caseazaObiect } from "../actions";

/**
 * Scoaterea obiectului din uz.
 *
 * ── CE ÎNLOCUIEȘTE ───────────────────────────────────────────────────────
 * Un dreptunghi roșu care se desfăcea sub buton, în subsolul fișei, cu textul
 * de consecință scris de mână. `ConfirmareActiune` exista de dinainte, iar
 * docblock-ul ei numește nominal „casarea unui obiect de inventar” printre
 * gesturile pe care nimeni nu le confirmă.
 *
 * ── DE CE NU SE CERE TASTAREA ────────────────────────────────────────────
 * `cereTastare` e rezervat, prin documentația primitivei, ireversibilului peste
 * bani — „dacă apare la fiecare confirmare, devine tot un reflex”. Casarea e
 * ireversibilă, dar e și un gest de rutină: obiectele se uzează. Frâna aici sunt
 * `cifre` (ce obiect, ce număr, ce valoare iese din patrimoniu) și propoziția de
 * consecință, nu un cuvânt de tastat.
 *
 * ── CE E ADEVĂRAT DESPRE IREVERSIBILITATE ────────────────────────────────
 * `status` nu e câmp editabil în nicio schemă, iar `readuInStoc` are
 * `.eq("status", "in_reparatie")` — deci din „Casat” NU există drum înapoi prin
 * aplicație. Consecința o spune, fiindcă altfel omul presupune că se poate
 * corecta dintr-o casetă de editare care nu conține câmpul.
 */
interface Proprietati {
  readonly id: string;
  readonly denumire: string;
  readonly numarInventar: string;
  readonly valoare: string;
}

export function ButonCasare({ id, denumire, numarInventar, valoare }: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await caseazaObiect({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: `„${denumire}” a fost scos din uz.` });
      // `refresh`, nu `push`: fișa rămâne — se schimbă doar ce scrie pe ea.
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="distructiv"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <PackageX aria-hidden="true" className="size-4" />
        Casează
      </Buton>

      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Scoateți obiectul din uz?"
        consecinta="Obiectul trece definitiv în starea „Casat” și nu mai poate fi predat nimănui. Din aplicație nu există drum înapoi: starea de circuit nu se editează din caseta de modificare. Rămâne în evidența firmei pentru totdeauna, cu tot istoricul de predări-primiri."
        cifre={[
          { eticheta: "Obiect", valoare: denumire },
          { eticheta: "Număr de inventar", valoare: numarInventar },
          { eticheta: "Valoare", valoare },
        ]}
        etichetaConfirmare="Casează obiectul"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
