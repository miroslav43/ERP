"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeEtapa } from "../actions";

/**
 * Scoaterea unei etape greșite din traseu.
 *
 * Etapele nu erau doar de decor: `calculeazaDiurnaDeplasare` departajează ziua
 * trecerii frontierei după ele, deci o etapă cu țările inversate schimbă
 * numărul de zile ȘI baremul aplicat. Până acum nu exista nicio cale de a o
 * scoate — nici acțiune, nici buton — iar cifra greșită rămânea pe fișă și în
 * decont.
 */
export function ActiuniEtapa({
  id,
  descriere,
}: {
  readonly id: string;
  readonly descriere: string;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeEtapa({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Etapa a fost scoasă din traseu." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge etapa ${descriere}`}
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
        titlu="Ștergeți etapa din traseu?"
        consecinta="Diurna se recalculează imediat: ziua trecerii frontierei se poate muta în altă țară, iar numărul de zile se poate schimba."
        cifre={[{ eticheta: "Etapa", valoare: descriere }]}
        etichetaConfirmare="Șterge etapa"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
