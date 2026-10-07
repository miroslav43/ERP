"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeAlocarea } from "../actions";

/**
 * Ștergerea unei alocări GREȘITE: alt șofer, altă zi.
 *
 * Nu e restituire. Restituirea păstrează alocarea în istoric, cu data de
 * sfârșit. Ștergerea o scoate din istoric, ca și cum n-ar fi existat. De aceea
 * consecința o spune explicit, iar pentru alocarea deschisă adaugă că mașina
 * rămâne fără șofer.
 */
interface Proprietati {
  readonly alocareId: string;
  readonly vehiculId: string;
  readonly sofer: string;
  readonly perioada: string;
  readonly deschisa: boolean;
}

export function ButonStergeAlocare({
  alocareId,
  vehiculId,
  sofer,
  perioada,
  deschisa,
}: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeAlocarea({ id: alocareId, vehicle_id: vehiculId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Alocarea a fost ștearsă din istoric." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge alocarea lui ${sofer}`}
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Buton>

      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Ștergeți alocarea din istoric?"
        consecinta={
          deschisa
            ? "Alocarea dispare din istoric, ca și cum n-ar fi existat, iar vehiculul rămâne fără șofer. Pentru o restituire obișnuită folosiți „Restituie”: aceea păstrează istoricul."
            : "Alocarea dispare din istoric, ca și cum n-ar fi existat. Folosiți ștergerea doar pentru o alocare introdusă greșit."
        }
        cifre={[
          { eticheta: "Șofer", valoare: sofer },
          { eticheta: "Perioadă", valoare: perioada },
        ]}
        etichetaConfirmare="Șterge alocarea"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
