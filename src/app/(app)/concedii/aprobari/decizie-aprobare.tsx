// src/app/(app)/concedii/aprobari/decizie-aprobare.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { decideCerere } from "../actions";
import { arataToast } from "@/components/ui/toast";

const LUNGIME_MINIMA_MOTIV = 5;

export function DecizieAprobare({
  taskId,
  hrefReges = null,
  hrefPontaj = null,
}: {
  readonly taskId: string;
  /** `/reges?stare=de_transmis` dacă pagina se deschide pentru rolul curent; altfel `null`. */
  readonly hrefReges?: string | null;
  /** `/pontaj` dacă pagina se deschide pentru rolul curent; altfel `null`. */
  readonly hrefPontaj?: string | null;
}) {
  const router = useRouter();
  const [panou, setPanou] = useState<"inchis" | "aprobare" | "respingere">("inchis");
  const [comentariu, setComentariu] = useState("");
  const [motivRespingere, setMotivRespingere] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  /**
   * Avertismente care SUPRAVIEȚUIESC închiderii panoului: sunt de acționat, nu
   * de citit în trecere. Sunt mai multe fiindcă o aprobare poate lăsa în urmă
   * două lucruri de reparat deodată — zile pontate dublu ȘI o declarație de
   * suspendare nepregătită — iar al doilea nu are voie să-l ascundă pe primul.
   */

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
       * Zilele pontate ca lucrate peste care cade concediul sunt trecute pe
       * concediu în foaia de prezență (concediul de urgență, cerut pentru o zi
       * deja pontată). Aprobatorul tocmai a schimbat pontajul cuiva, deci află.
       */
      /*
       * Avertismentele pleacă în TOASTURI, nu în starea locală: la
       * `router.refresh()` sarcina iese din coadă și componenta dispare cu
       * tot cu ele. Toastul cu acțiune nu se stinge singur și duce la locul
       * unde se vede efectul (foaia de pontaj, coada REGES).
       */
      if (rezultat.data.zileInlocuite > 0) {
        arataToast({
          fel: "informativ",
          text:
            rezultat.data.zileInlocuite === 1
              ? "O zi din concediu era deja pontată ca lucrată și a fost trecută pe concediu în foaia de prezență."
              : `${String(rezultat.data.zileInlocuite)} zile din concediu erau deja pontate ca lucrate și au fost trecute pe concediu în foaia de prezență.`,
          ...(hrefPontaj === null
            ? {}
            : {
                actiune: {
                  eticheta: "Vezi foaia de pontaj",
                  onClick: () => {
                    router.push(hrefPontaj);
                  },
                },
              }),
        });
      }
      /*
       * Concediul care suspendă contractul se declară la Inspecția Muncii cel
       * târziu în ziua anterioară începerii, iar netransmiterea în termen e
       * contravenție PER SALARIAT. Când declararea a reușit, se spune tot —
       * altfel aprobatorul n-are de unde ști că mai există un termen de
       * respectat și că evenimentul îl așteaptă în REGES, nepregătit.
       */
      const { suspendare } = rezultat.data;
      const textSuspendare =
        suspendare.motiv !== null
          ? suspendare.motiv
          : suspendare.declarata && suspendare.termen !== null
            ? `Concediul suspendă contractul de muncă. Suspendarea a fost înregistrată, iar evenimentul de transmis în REGES este pregătit — termenul este ${suspendare.termen}.`
            : null;
      if (textSuspendare !== null) {
        // Fără drum spre REGES (rolul nu-l deschide), mesajul rămâne ca
        // „eroare": e singurul fel care nu se stinge singur, iar ratarea
        // termenului e contravenție per salariat.
        arataToast(
          hrefReges === null
            ? { fel: "eroare", text: textSuspendare }
            : {
                fel: "informativ",
                text: textSuspendare,
                actiune: {
                  eticheta: "Deschide coada REGES",
                  onClick: () => {
                    router.push(hrefReges);
                  },
                },
              },
        );
      }
      setPanou("inchis");
      router.refresh();
    });
  }

  if (panou === "inchis") {
    return (
      <div>
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
