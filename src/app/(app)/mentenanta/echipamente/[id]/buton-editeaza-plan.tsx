// src/app/(app)/mentenanta/echipamente/[id]/buton-editeaza-plan.tsx
"use client";

import { useState } from "react";

import { Buton } from "@/components/ui/buton";
import { FormularPlan, type PlanExistent } from "./formular-plan";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export function ButonEditeazaPlan({
  equipmentId,
  angajati,
  planExistent,
}: {
  readonly equipmentId: string;
  readonly angajati: readonly Optiune[];
  readonly planExistent: PlanExistent;
}) {
  const [deschis, setDeschis] = useState(false);

  return (
    <div>
      <Buton
        varianta="secundar"
        onClick={() => {
          setDeschis((v) => !v);
        }}
      >
        {deschis ? "Închide" : "Editează"}
      </Buton>
      {deschis ? (
        <div className="mt-2">
          <FormularPlan equipmentId={equipmentId} angajati={angajati} planExistent={planExistent} />
        </div>
      ) : null}
    </div>
  );
}
