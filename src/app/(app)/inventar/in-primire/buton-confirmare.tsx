"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { confirmaPrimirea } from "../actions";

interface Proprietati {
  readonly alocareId: string;
}

export function ButonConfirmare({ alocareId }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function confirma(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await confirmaPrimirea({ id: alocareId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Buton varianta="primar" onClick={confirma} inCurs={inCurs} textInCurs="Se confirmă…">
        Confirmă primirea
      </Buton>
      {eroare !== null ? (
        <p role="alert" className="text-danger text-nota mt-1">
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
