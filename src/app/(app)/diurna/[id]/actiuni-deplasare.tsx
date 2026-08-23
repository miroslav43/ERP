"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Send, Trash2 } from "lucide-react";

import { deconteazaDeplasare, stergeCiornaDeplasare, trimiteDeplasare } from "../actions";
import { Buton } from "@/components/ui/buton";

/**
 * Acțiunile disponibile pe fișa unei deplasări: trimiterea și ștergerea
 * ciornei (proprietarul), plus marcarea decontată (un aprobator, după ce
 * deplasarea a fost aprobată).
 *
 * Autoaprobarea sau schimbarea stării dincolo de ce permite starea curentă NU
 * se blochează aici — RLS și triggerul din 0015 o resping oricum; acest
 * component doar arată butoanele potrivite stării curente, iar un refuz al
 * bazei ajunge pe ecran ca mesaj, nu ca „succes” tăcut.
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

  function trimite(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await trimiteDeplasare({ id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function sterge(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await stergeCiornaDeplasare({ id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(caleDupaStergere);
    });
  }

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
          <Buton varianta="primar" inCurs={inCurs} textInCurs="Se trimite…" onClick={trimite}>
            <Send aria-hidden="true" className="size-4" />
            Trimite spre aprobare
          </Buton>
        ) : null}
        {poateDeconta ? (
          <Buton varianta="primar" inCurs={inCurs} textInCurs="Se marchează…" onClick={deconteaza}>
            <BadgeCheck aria-hidden="true" className="size-4" />
            Marchează decontată
          </Buton>
        ) : null}
        {poateSterge ? (
          <Buton varianta="distructiv" inCurs={inCurs} textInCurs="Se șterge…" onClick={sterge}>
            <Trash2 aria-hidden="true" className="size-4" />
            Șterge ciorna
          </Buton>
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
