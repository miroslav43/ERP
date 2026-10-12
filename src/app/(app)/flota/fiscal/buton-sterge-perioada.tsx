"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeNormaConsum, stergeRegimFiscal } from "../actions-fiscal";

/**
 * Ștergerea unei perioade fiscale GREȘITE (regim sau normă). Nu se folosește
 * pentru o schimbare reală de regim: aceea e o perioadă nouă, iar cea veche
 * rămâne în istoric.
 */
interface Proprietati {
  readonly fel: "regim" | "norma";
  readonly perioadaId: string;
  readonly vehiculId: string;
  /** Ce se arată în confirmare: „Deducere 50%”, „7,5 l/100 km”. */
  readonly descriere: string;
  /** „de la 01.01.2026”. */
  readonly dela: string;
}

export function ButonStergePerioada({
  fel,
  perioadaId,
  vehiculId,
  descriere,
  dela,
}: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);
  const eRegim = fel === "regim";

  function confirma(): void {
    porneste(async () => {
      const intrare = { id: perioadaId, vehicle_id: vehiculId };
      const rezultat = eRegim ? await stergeRegimFiscal(intrare) : await stergeNormaConsum(intrare);
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: eRegim ? "Regimul fiscal a fost șters." : "Norma de consum a fost ștearsă.",
      });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge ${eRegim ? "regimul" : "norma"} ${descriere}, ${dela}`}
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
        titlu={eRegim ? "Ștergeți regimul fiscal?" : "Ștergeți norma de consum?"}
        consecinta={
          eRegim
            ? "Perioada dispare din istoric, iar zilele ei se judecă după perioada anterioară (sau rămân fără regim). Ștergeți doar o perioadă introdusă greșit; pentru o schimbare reală adăugați un regim nou, de la data schimbării."
            : "Foile deja trimise își păstrează norma din instantaneu. Foile trimise de acum înainte folosesc norma anterioară sau consumul declarat pe fișă. Ștergeți doar o normă introdusă greșit."
        }
        cifre={[
          { eticheta: eRegim ? "Regim" : "Normă", valoare: descriere },
          { eticheta: "Se aplică", valoare: dela },
        ]}
        etichetaConfirmare={eRegim ? "Șterge regimul" : "Șterge norma"}
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
