// src/app/(app)/mentenanta/echipamente/[id]/buton-editeaza-plan.tsx
"use client";

import { useState } from "react";

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
      <button
        type="button"
        onClick={() => {
          setDeschis((v) => !v);
        }}
        className="border-foreground/60 hover:bg-surface rounded-md border px-2 py-1 text-xs"
      >
        {deschis ? "Închide" : "Editează"}
      </button>
      {deschis ? (
        <div className="mt-2">
          <FormularPlan
            equipmentId={equipmentId}
            angajati={angajati}
            planExistent={planExistent}
          />
        </div>
      ) : null}
    </div>
  );
}
