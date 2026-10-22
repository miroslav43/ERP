"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement, type ReactNode } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

/**
 * O acțiune fără câmpuri, cu confirmare (ștergerea cardului, anularea unui
 * import, repotrivirea lunii): butonul deschide caseta, confirmarea execută,
 * eroarea ajunge în toast, reușita reîncarcă pagina. Tiparul din
 * `flota/amenzi/actiuni-amenda.tsx`.
 */
export function ButonConfirmat<T>({
  eticheta,
  pictograma,
  ariaLabel,
  titlu,
  consecinta,
  etichetaConfirmare,
  distructiv,
  mesajReusita,
  executa,
}: Readonly<{
  eticheta?: string;
  pictograma: ReactNode;
  /** Cu el, butonul e doar iconiță (într-un rând de tabel). */
  ariaLabel?: string;
  titlu: string;
  consecinta: string;
  etichetaConfirmare: string;
  distructiv?: boolean;
  mesajReusita: (date: T) => string;
  executa: () => Promise<ActionResult<T>>;
}>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await executa();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: mesajReusita(rezultat.data) });
      router.refresh();
    });
  }

  const deschide = () => {
    setDeschis(true);
  };

  return (
    <>
      {ariaLabel === undefined ? (
        <Buton varianta={distructiv === true ? "distructiv" : "secundar"} onClick={deschide}>
          {pictograma}
          {eticheta}
        </Buton>
      ) : (
        <Buton varianta="tertiar" marime="iconita" aria-label={ariaLabel} onClick={deschide}>
          {pictograma}
        </Buton>
      )}
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={titlu}
        consecinta={consecinta}
        etichetaConfirmare={etichetaConfirmare}
        {...(distructiv === true ? { distructiv: true } : {})}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
