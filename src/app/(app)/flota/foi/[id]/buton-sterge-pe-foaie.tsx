"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeAlimentare } from "../../actions";
import { stergeCursa } from "../../actions-curse";

/**
 * Ștergerea unei curse sau a unei alimentări de pe ciornă (0200).
 *
 * Ștergerea e logică și NU se mai întoarce (§D2): baza refuză readucerea
 * rândului. De aceea caseta de confirmare spune că rândul se reintroduce, nu se
 * „restaurează”. Antetul foii (orele și kilometrii zilei) se recalculează
 * singur în bază după ștergerea unei curse.
 */
type Proprietati = Readonly<{
  fel: "cursa" | "alimentare";
  id: string;
  foaieId: string;
  /** Ce se șterge, în cuvinte: „Sediu → Depozit, 08:00”. */
  descriere: string;
}>;

export function ButonStergePeFoaie({ fel, id, foaieId, descriere }: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);
  const ce = fel === "cursa" ? "cursa" : "alimentarea";

  function confirma(): void {
    porneste(async () => {
      const rezultat =
        fel === "cursa"
          ? await stergeCursa({ id, trip_sheet_id: foaieId })
          : await stergeAlimentare({ id, trip_sheet_id: foaieId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: fel === "cursa" ? "Cursa a fost ștearsă." : "Alimentarea a fost ștearsă.",
      });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge ${ce}: ${descriere}`}
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
        titlu={fel === "cursa" ? "Ștergeți cursa?" : "Ștergeți alimentarea?"}
        consecinta={
          fel === "cursa"
            ? "Cursa iese de pe foaie, iar orele și kilometrii zilei se recalculează din cursele rămase. Dacă a fost o greșeală, cursa se adaugă din nou."
            : "Alimentarea iese de pe foaie și din consumul ei. Dacă a fost o greșeală, se adaugă din nou."
        }
        cifre={[{ eticheta: fel === "cursa" ? "Cursa" : "Alimentarea", valoare: descriere }]}
        etichetaConfirmare={fel === "cursa" ? "Șterge cursa" : "Șterge alimentarea"}
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
