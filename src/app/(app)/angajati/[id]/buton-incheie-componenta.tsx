// src/app/(app)/angajati/[id]/buton-incheie-componenta.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { incheieComponentaAngajat } from "./componente-actions";

interface Proprietati {
  readonly id: string;
  readonly employeeId: string;
}

export function ButonIncheieComponenta({ id, employeeId }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  return (
    <button
      type="button"
      disabled={inCurs}
      onClick={() => {
        porneste(async () => {
          await incheieComponentaAngajat({ id, employee_id: employeeId });
          router.refresh();
        });
      }}
      className="text-danger hover:bg-danger/8 rounded-md px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      {inCurs ? "Se încheie…" : "Încheie"}
    </button>
  );
}
