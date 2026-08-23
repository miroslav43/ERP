// src/app/(app)/concedii/aprobari/decizie-aprobare.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { decideCerere } from "../actions";

const LUNGIME_MINIMA_MOTIV = 5;

export function DecizieAprobare({ taskId }: { readonly taskId: string }) {
  const router = useRouter();
  const [panou, setPanou] = useState<"inchis" | "aprobare" | "respingere">("inchis");
  const [comentariu, setComentariu] = useState("");
  const [motivRespingere, setMotivRespingere] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const idComentariu = useId();
  const idMotiv = useId();

  function decide(decizie: "aprobata" | "respinsa"): void {
    if (decizie === "respinsa" && motivRespingere.trim().length < LUNGIME_MINIMA_MOTIV) {
      setEroare(
        `Motivul respingerii trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV)} caractere.`,
      );
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await decideCerere({
        taskId,
        decizie,
        comentariu: comentariu.length === 0 ? null : comentariu,
        motivRespingere: decizie === "respinsa" ? motivRespingere : null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setPanou("inchis");
      router.refresh();
    });
  }

  if (panou === "inchis") {
    return (
      <div className="flex flex-wrap gap-2">
        <Buton
          varianta="primar"
          onClick={() => {
            setPanou("aprobare");
          }}
        >
          <Check aria-hidden="true" className="size-4" />
          Aprobă
        </Buton>
        <Buton
          varianta="distructiv"
          onClick={() => {
            setPanou("respingere");
          }}
        >
          <X aria-hidden="true" className="size-4" />
          Respinge
        </Buton>
      </div>
    );
  }

  return (
    <div className="border-border rounded-control space-y-2 border p-3">
      <div>
        <label htmlFor={idComentariu} className="text-nota block font-medium">
          Comentariu (opțional)
        </label>
        <input
          id={idComentariu}
          value={comentariu}
          onChange={(eveniment) => {
            setComentariu(eveniment.target.value);
          }}
          className="border-foreground/60 rounded-control text-corp mt-1 w-full border px-2 py-1.5"
        />
      </div>

      {panou === "respingere" ? (
        <div>
          <label htmlFor={idMotiv} className="text-nota block font-medium">
            Motivul respingerii *
          </label>
          <input
            id={idMotiv}
            value={motivRespingere}
            onChange={(eveniment) => {
              setMotivRespingere(eveniment.target.value);
            }}
            className="border-foreground/60 rounded-control text-corp mt-1 w-full border px-2 py-1.5"
          />
        </div>
      ) : null}

      <div aria-live="polite">
        {eroare !== null ? <p className="text-danger text-nota">{eroare}</p> : null}
      </div>

      <div className="flex gap-2">
        <Buton
          varianta={panou === "respingere" ? "distructiv" : "primar"}
          inCurs={inCurs}
          textInCurs="Se salvează…"
          onClick={() => {
            decide(panou === "respingere" ? "respinsa" : "aprobata");
          }}
        >
          {panou === "respingere" ? "Confirmă respingerea" : "Confirmă aprobarea"}
        </Buton>
        <Buton
          varianta="secundar"
          onClick={() => {
            setPanou("inchis");
            setEroare(null);
          }}
        >
          Renunță
        </Buton>
      </div>
    </div>
  );
}
