// src/app/(app)/angajati/[id]/buton-incheie-componenta.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { incheieComponentaAngajat } from "./componente-actions";

interface Proprietati {
  readonly id: string;
  readonly employeeId: string;
}

export function ButonIncheieComponenta({ id, employeeId }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  return (
    <Buton
      varianta="distructiv"
      inCurs={inCurs}
      textInCurs="Se încheie…"
      onClick={() => {
        porneste(async () => {
          await incheieComponentaAngajat({ id, employee_id: employeeId });
          router.refresh();
        });
      }}
    >
      Încheie
    </Buton>
  );
}
