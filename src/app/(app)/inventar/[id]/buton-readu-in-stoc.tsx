"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";

import { readuInStoc } from "../actions";

/**
 * Singura ieșire din starea „în reparație".
 *
 * Componentă proprie, nu un buton în `actiuni-obiect.tsx`: acolo butoanele apar
 * în bara de sus, alături de editare și casare, iar ăsta trebuie să stea CHIAR
 * lângă explicația de ce obiectul nu se poate preda — altfel avertismentul și
 * ieșirea din el ajung la doi metri unul de altul pe ecran.
 */
export function ButonReaduInStoc({ obiectId }: { readonly obiectId: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Buton
        varianta="secundar"
        inCurs={inCurs}
        textInCurs="Se readuce…"
        onClick={() => {
          setEroare(null);
          porneste(async () => {
            const rezultat = await readuInStoc({ id: obiectId });
            if (!rezultat.ok) {
              setEroare(rezultat.error.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        A revenit din service
      </Buton>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota">
          {eroare}
        </p>
      )}
    </div>
  );
}
