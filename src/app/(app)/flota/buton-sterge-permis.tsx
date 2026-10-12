"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergePermis } from "./actions-soferi";

/**
 * Scoaterea permisului de pe fișă (0204). Ștergerea e logică: scadența iese
 * din lista de conformitate, iar locul se eliberează pentru un permis nou.
 * Pentru un permis REÎNNOIT nu se șterge nimic — se modifică cel existent.
 */
interface Proprietati {
  readonly permisId: string;
  readonly employeeId: string;
  readonly numar: string;
}

export function ButonStergePermis({ permisId, employeeId, numar }: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergePermis({ id: permisId, employee_id: employeeId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Permisul a fost scos de pe fișă." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge permisul ${numar}`}
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
        titlu="Ștergeți permisul?"
        consecinta="Permisul iese de pe fișă și scadența lui din lista de conformitate. Pentru un permis reînnoit nu ștergeți nimic: modificați-l pe cel existent."
        cifre={[{ eticheta: "Număr", valoare: numar }]}
        etichetaConfirmare="Șterge permisul"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
