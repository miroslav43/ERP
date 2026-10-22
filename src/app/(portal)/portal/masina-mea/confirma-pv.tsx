"use client";

// src/app/(portal)/portal/masina-mea/confirma-pv.tsx
//
// „Confirm” pe un proces-verbal de predare-primire, din portal (0215, F12c).
// Confirmarea completează semnătura de pe hârtie, nu o înlocuiește (decizia
// I-c1, ⚠ jurist): textul de dinaintea apăsării o spune.

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { confirmaPv } from "@/app/(app)/flota/[id]/pv/actions";

interface Proprietati {
  readonly pvId: string;
  readonly numar: string;
  /** „predarea” sau „primirea”, după partea omului. */
  readonly ce: "predarea" | "primirea";
  readonly vehicul: string;
}

export function ConfirmaPv({ pvId, numar, ce, vehicul }: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  return (
    <>
      <Buton varianta="secundar" onClick={() => setDeschis(true)}>
        Confirm {ce}
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => setDeschis(false)}
        titlu={`Confirmați ${ce} vehiculului?`}
        consecinta="Confirmarea rămâne în aplicație, cu data și contul dumneavoastră. Completează semnătura de pe procesul-verbal tipărit, nu o înlocuiește."
        cifre={[
          { eticheta: "Proces-verbal", valoare: numar },
          { eticheta: "Vehicul", valoare: vehicul },
        ]}
        etichetaConfirmare={`Confirm ${ce}`}
        inCurs={inCurs}
        laConfirmare={() => {
          porneste(async () => {
            const r = await confirmaPv({ id: pvId });
            if (!r.ok) {
              arataToast({ fel: "eroare", text: r.error.message });
              return;
            }
            setDeschis(false);
            arataToast({ fel: "reusita", text: `Ați confirmat ${ce}. Mulțumim.` });
            router.refresh();
          });
        }}
      />
    </>
  );
}
