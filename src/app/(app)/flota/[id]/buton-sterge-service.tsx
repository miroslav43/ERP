"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeCheltuiala, stergeIntrareService } from "../actions-service";

/**
 * Ștergerea unei intervenții sau a unei cheltuieli introduse greșit (logică:
 * rândul dispare din liste și din totaluri, dar rămâne în jurnalul de audit).
 *
 * Consecința se spune înainte de confirmare. La o intervenție legată de un plan,
 * planul revine la intervenția anterioară sau la baza lui; kilometrajul
 * vehiculului NU coboară (corectura lui e „Corectează km”, cu motiv).
 */
interface Proprietati {
  readonly fel: "intrare" | "cheltuiala";
  readonly id: string;
  readonly vehiculId: string;
  /** Pentru eticheta butonului: „intervenția din 01.10.2026”. */
  readonly descriere: string;
  readonly cifre: readonly Readonly<{ eticheta: string; valoare: string }>[];
  /** Intervenția legată de un plan: confirmarea spune că planul se mută înapoi. */
  readonly legataDePlan?: boolean;
}

export function ButonStergeService({
  fel,
  id,
  vehiculId,
  descriere,
  cifre,
  legataDePlan = false,
}: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);
  const intrare = fel === "intrare";

  function confirma(): void {
    porneste(async () => {
      const rezultat = intrare
        ? await stergeIntrareService({ id, vehicle_id: vehiculId })
        : await stergeCheltuiala({ id, vehicle_id: vehiculId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: intrare ? "Intervenția a fost ștearsă." : "Cheltuiala a fost ștearsă.",
      });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge ${descriere}`}
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
        titlu={intrare ? "Ștergeți intervenția?" : "Ștergeți cheltuiala?"}
        consecinta={
          intrare
            ? legataDePlan
              ? "Intervenția dispare din istoric și din costuri, iar planul legat revine la intervenția anterioară sau la baza lui. Kilometrajul vehiculului nu coboară. Folosiți ștergerea doar pentru o intervenție introdusă greșit."
              : "Intervenția dispare din istoric și din costuri. Kilometrajul vehiculului nu coboară. Folosiți ștergerea doar pentru o intervenție introdusă greșit."
            : "Cheltuiala dispare din listă și din totaluri. Folosiți ștergerea doar pentru o cheltuială introdusă greșit."
        }
        cifre={cifre}
        etichetaConfirmare={intrare ? "Șterge intervenția" : "Șterge cheltuiala"}
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
