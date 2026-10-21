"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Send, Trash2 } from "lucide-react";

import { deconteazaDeplasare, stergeCiornaDeplasare, trimiteDeplasare } from "../actions";
import { Buton } from "@/components/ui/buton";
import { ButonConfirmare } from "@/components/ui/buton-confirmare";

/**
 * Acțiunile disponibile pe fișa unei deplasări: trimiterea și ștergerea
 * ciornei (proprietarul), plus marcarea decontată (un aprobator, după ce
 * deplasarea a fost aprobată).
 *
 * Autoaprobarea sau schimbarea stării dincolo de ce permite starea curentă NU
 * se blochează aici — RLS și triggerul din 0015 o resping oricum; acest
 * component doar arată butoanele potrivite stării curente, iar un refuz al
 * bazei ajunge pe ecran ca mesaj, nu ca „succes” tăcut.
 *
 * Trimiterea și ștergerea cer confirmare (QA oct 2026, FLX-009): după
 * trimitere, plecarea, sosirea și angajatul devin ale aprobatorului (triggerul
 * din 0015), iar ștergerea — chiar logică — scoate ciorna de pe ecran.
 */
export function ActiuniDeplasare({
  id,
  poateTrimite,
  poateSterge,
  poateDeconta,
  /** Unde se ajunge după ștergerea ciornei — fișa tocmai dispărută nu mai există. */
  caleDupaStergere = "/diurna",
}: {
  readonly id: string;
  readonly poateTrimite: boolean;
  readonly poateSterge: boolean;
  readonly poateDeconta: boolean;
  readonly caleDupaStergere?: string;
}) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  function deconteaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await deconteazaDeplasare({ id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (!poateTrimite && !poateSterge && !poateDeconta) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {poateTrimite ? (
          <ButonConfirmare
            eticheta="Trimite spre aprobare"
            varianta="primar"
            pictograma={<Send aria-hidden="true" className="size-4" />}
            titlu="Trimiteți deplasarea spre aprobare?"
            consecinta="După trimitere, datele de bază (plecare, sosire, angajat) nu se mai pot modifica decât de aprobator. Dacă e respinsă, o puteți corecta și retrimite."
            etichetaConfirmare="Trimite spre aprobare"
            executa={() => trimiteDeplasare({ id })}
            mesajReusita="Deplasarea a fost trimisă spre aprobare."
          />
        ) : null}
        {poateDeconta ? (
          <Buton varianta="primar" inCurs={inCurs} textInCurs="Se marchează…" onClick={deconteaza}>
            <BadgeCheck aria-hidden="true" className="size-4" />
            Marchează decontată
          </Buton>
        ) : null}
        {poateSterge ? (
          <ButonConfirmare
            eticheta="Șterge ciorna"
            varianta="distructiv"
            distructiv
            pictograma={<Trash2 aria-hidden="true" className="size-4" />}
            titlu="Ștergeți ciorna?"
            consecinta="Deplasarea dispare din listă și de pe fișă. Etapele și cheltuielile scrise în ea nu se mai văd din aplicație."
            etichetaConfirmare="Șterge ciorna"
            executa={() => stergeCiornaDeplasare({ id })}
            mesajReusita="Ciorna a fost ștearsă."
            // Fișa tocmai ștearsă nu mai există: `refresh` ar reîncărca „negăsit”.
            dupaReusita={() => {
              router.push(caleDupaStergere);
            }}
          />
        ) : null}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp">
          {eroare}
        </p>
      )}
    </div>
  );
}
