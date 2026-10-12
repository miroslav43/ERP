"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeSablonTraseu } from "../../actions-sabloane";

/** Ștergerea logică a unui șablon. Cursele deja scrise din el rămân neatinse. */
export function ButonStergeSablon({
  id,
  denumire,
}: Readonly<{ id: string; denumire: string }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeSablonTraseu({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: `Șablonul „${denumire}” a fost șters.` });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge șablonul „${denumire}”`}
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
        titlu="Ștergeți șablonul?"
        consecinta="Șablonul nu mai apare în caseta „Cursă nouă”. Cursele deja scrise din el rămân pe foile lor."
        cifre={[{ eticheta: "Șablon", valoare: denumire }]}
        etichetaConfirmare="Șterge șablonul"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
