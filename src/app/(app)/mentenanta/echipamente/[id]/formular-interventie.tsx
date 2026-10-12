"use client";

import { Plus } from "lucide-react";
import { useCallback, type ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";

import { inregistreazaInterventie } from "../../actions";
import { CampuriInterventie, type OptiuneInterventie } from "../../interventii/campuri-interventie";
import { planDinFormular, valoriInterventie } from "../../interventii/valori-interventie";

/**
 * Intervenția de mentenanță de pe fișa echipamentului, în casetă.
 *
 * Câmpurile și maparea `FormData` → încărcătură stau în
 * `interventii/campuri-interventie.tsx` și `interventii/valori-interventie.ts`,
 * ca aceleași treisprezece câmpuri să fie și în „Rezolvă" de pe sesizare și în
 * „Execută" de pe plan. Aici rămâne doar ce e propriu fișei: planul se alege
 * dintre planurile active ale echipamentului, iar echipamentul e cel al fișei.
 */
export function FormularInterventie({
  equipmentId,
  planuri,
  angajati,
}: {
  readonly equipmentId: string;
  readonly planuri: readonly OptiuneInterventie[];
  readonly angajati: readonly OptiuneInterventie[];
}): ReactElement {
  const trimite = useCallback(
    async (formular: FormData) =>
      await inregistreazaInterventie({
        ...valoriInterventie(formular),
        plan_id: planDinFormular(formular),
        equipment_id: equipmentId,
      }),
    [equipmentId],
  );

  return (
    <FormularDialog
      declansator={{
        eticheta: "Intervenție nouă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Intervenție de mentenanță"
      descriere="Legată de un plan, intervenția îi mută scadența următoare. Fără plan, rămâne o intervenție de sine stătătoare — o reparație neplanificată, de pildă."
      marime="mare"
      actiune={trimite}
      mesajReusita="Intervenția a fost înregistrată."
      etichetaTrimite="Salvează intervenția"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriInterventie stare={stare} idc={idc} angajati={angajati} planuri={planuri} />
      )}
    </FormularDialog>
  );
}
