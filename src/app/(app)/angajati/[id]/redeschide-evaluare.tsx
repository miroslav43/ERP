"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { redeschideEvaluare } from "../../evaluari/actions";

/**
 * „Redeschide” pe o evaluare finalizată, de pe fișă.
 *
 * `redeschideEvaluare` exista fără niciun apelant: comentariul din `/evaluari`
 * spunea că „redeschiderea rămâne pe fișă”, dar fișa n-avea buton, deci HR-ul
 * care vedea o evaluare greșită n-avea drum (analiza 2026-10-08,
 * evaluari-L15/P12). Acțiunea cere `evaluations:update = all`; pagina arată
 * butonul doar cu dreptul ăsta, iar redeschiderea trece evaluarea în ciornă,
 * de unde se continuă cu „Continuă ciorna”.
 */
export function RedeschideEvaluare({
  id,
  eticheta,
}: Readonly<{ id: string; eticheta: string }>): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    porneste(async () => {
      const rezultat = await redeschideEvaluare({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: "Evaluarea e din nou ciornă. Corectați notele, apoi finalizați-o iar.",
      });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        Redeschide
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Redeschideți evaluarea?"
        consecinta={`${eticheta} revine la ciornă: angajatul n-o mai vede în portal până o finalizați din nou, iar punctajul de acum se păstrează doar până la prima corecție.`}
        etichetaConfirmare="Redeschide evaluarea"
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
