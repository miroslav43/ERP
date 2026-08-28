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
  /** Avertisment care SUPRAVIEȚUIEȘTE închiderii panoului: e de acționat, nu de citit în trecere. */
  const [atentie, setAtentie] = useState<string | null>(null);

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
      /*
       * Zilele pontate care se suprapun peste concediu NU se suprascriu — dacă
       * omul chiar a muncit atunci, ștergerea declarației lui ar distruge
       * singura dovadă. Dar ele se plătesc ȘI ca zile lucrate, ȘI ca zile de
       * concediu, iar salarizarea agregă fără să se plângă.
       *
       * Până acum, numărul era calculat de sincronizare și ARUNCAT de acțiune.
       * Aici e singurul moment în care cineva care poate face ceva se uită la
       * ecran, deci aici se spune.
       */
      if (rezultat.data.zilePastrate > 0) {
        setAtentie(
          rezultat.data.zilePastrate === 1
            ? "O zi din concediu era deja pontată și a rămas înregistrată ca zi lucrată. Verificați-o în pontaj — altfel se plătește de două ori."
            : `${String(rezultat.data.zilePastrate)} zile din concediu erau deja pontate și au rămas înregistrate ca zile lucrate. Verificați-le în pontaj — altfel se plătesc de două ori.`,
        );
      }
      setPanou("inchis");
      router.refresh();
    });
  }

  const avertisment =
    atentie === null ? null : (
      <p
        role="alert"
        className="border-warning/40 bg-warning/12 text-foreground rounded-control text-corp mb-2 border p-3"
      >
        {atentie}
      </p>
    );

  if (panou === "inchis") {
    return (
      <div>
        {avertisment}
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
      </div>
    );
  }

  return (
    <div className="border-border rounded-control space-y-2 border p-3">
      {avertisment}
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
