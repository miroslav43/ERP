"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { publicaAnunt } from "../actions";

/**
 * Reușita se spune prin toast: fără el, singurul text nou de pe fișă după
 * publicare era „Confirmat citit." al marcării automate — textul altei
 * acțiuni (ADM-029). Eroarea rămâne lângă buton, în `<p role="alert">`: cu
 * `traduEroare`, o ciornă veche cu expirarea trecută primește „Data de
 * expirare trebuie să fie după data publicării.", nu mesajul generic cu cod.
 */
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
            arataToast({ fel: "reusita", text: "Anunțul a fost publicat." });
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
