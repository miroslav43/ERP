"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { publicaAnunt } from "../actions";

export function PublicaButon({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Buton
        varianta="primar"
        inCurs={inCurs}
        textInCurs="Se publică…"
        onClick={() => {
          setEroare(null);
          porneste(async () => {
            const rezultat = await publicaAnunt({ id });
            if (!rezultat.ok) {
              setEroare(rezultat.error.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        Publică acum
      </Buton>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp">
          {eroare}
        </p>
      )}
    </div>
  );
}
