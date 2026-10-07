"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeFisier } from "../actions";

/** Ștergerea unui atașament — logică; fișierul rămâne în bucket până la curățare. */
export function ButonStergeFisier({
  id,
  denumire,
  fel = "fotografie",
}: Readonly<{ id: string; denumire: string; fel?: "fotografie" | "document" }>): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const Fel = fel === "fotografie" ? "Fotografia" : "Documentul";
  const felul = fel === "fotografie" ? "fotografia" : "documentul";

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeFisier({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: `${Fel} a fost ${fel === "fotografie" ? "ștearsă" : "șters"}.`,
      });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge ${felul} ${denumire}`}
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
        titlu={`Ștergeți ${felul}?`}
        consecinta={`„${denumire}” dispare din listă pentru toată lumea. Nu se poate anula.`}
        etichetaConfirmare={`Șterge ${felul}`}
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
