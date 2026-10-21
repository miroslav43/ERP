// src/components/ui/buton-confirmare.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Buton + casetă de confirmare + tranziție + notificare, într-o singură piesă.
 *
 * ── DE CE EXISTĂ ─────────────────────────────────────────────────────────
 * `ConfirmareActiune` (dialogul) e deja folosit în zeci de locuri, dar
 * perechea din jurul lui — declanșatorul, starea `deschis`, `useTransition`,
 * toastul de reușită, `router.refresh()` — fusese copiată de trei ori cu
 * aceeași formă (planuri de mentenanță, sesizări, consola de platformă), iar
 * acțiunile cu efect real de pe alte ecrane rămăseseră fără nicio confirmare:
 * blocarea lunii de pontaj, dezactivarea unui membru, revocarea unei invitații,
 * trimiterea și aprobarea unei deplasări (QA, oct 2026: ONB-029, ADM-033,
 * FLX-009, MGR-018).
 *
 * ── DE CE NU E „SIGUR?” ──────────────────────────────────────────────────
 * O întrebare goală nu oprește pe nimeni; omul dă clic pe „Da” din reflex.
 * `consecinta` e obligatorie și spune CE se întâmplă și pe CINE atinge, iar
 * `cifre` pune numărul în față („3 linii neaprobate”). Contractul casetei —
 * „Renunță” primul, butoanele blocate în curs — e al lui `ConfirmareActiune`
 * și stă sub testele ei; aici e doar lipitura.
 *
 * ── CE FACE LA EȘEC ──────────────────────────────────────────────────────
 * Caseta RĂMÂNE deschisă: refuzul serverului apare ca notificare de eroare,
 * iar omul poate renunța sau încerca din nou cu caseta în față, nu peste un
 * ecran care arată exact ca înainte de apăsare.
 */
export type PropsButonConfirmare = Readonly<{
  /** Textul declanșatorului. */
  eticheta: string;
  pictograma?: ReactElement;
  varianta?: "primar" | "secundar" | "distructiv" | "tertiar";
  className?: string;
  disabled?: boolean;
  titlu: string;
  consecinta: string;
  cifre?: readonly Readonly<{ eticheta: string; valoare: string }>[];
  etichetaConfirmare: string;
  /** Butonul de confirmare devine roșu. Separat de `varianta` declanșatorului. */
  distructiv?: boolean;
  /** Cuvântul care trebuie tastat ca să se deblocheze confirmarea. */
  cereTastare?: string;
  executa: () => Promise<ActionResult<unknown>>;
  mesajReusita: string;
  /** După reușită, în locul lui `router.refresh()` — ex. plecarea de pe o fișă ștearsă. */
  dupaReusita?: () => void;
}>;

export function ButonConfirmare({
  eticheta,
  pictograma,
  varianta = "secundar",
  className,
  disabled = false,
  titlu,
  consecinta,
  cifre,
  etichetaConfirmare,
  distructiv = false,
  cereTastare,
  executa,
  mesajReusita,
  dupaReusita,
}: PropsButonConfirmare): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    porneste(async () => {
      const rezultat = await executa();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: mesajReusita });
      if (dupaReusita === undefined) router.refresh();
      else dupaReusita();
    });
  }

  return (
    <>
      <Buton
        varianta={varianta}
        disabled={disabled}
        {...(className === undefined ? {} : { className })}
        onClick={() => {
          setDeschis(true);
        }}
      >
        {pictograma}
        {eticheta}
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={titlu}
        consecinta={consecinta}
        {...(cifre === undefined ? {} : { cifre })}
        {...(cereTastare === undefined ? {} : { cereTastare })}
        etichetaConfirmare={etichetaConfirmare}
        distructiv={distructiv}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
