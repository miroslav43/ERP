"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decideDeplasare, deconteazaDeplasare } from "../actions";
import { Buton } from "@/components/ui/buton";

/**
 * Decizia unui aprobator asupra unei deplasări.
 *
 * `motiv_respingere` nu există ca și coloană pe `business_trips` (spre
 * deosebire de `leave_requests`/`trip_sheets`) — respingerea e o simplă
 * tranziție de stare, fără text de motivare persistat.
 */
export function DecizieDeplasare({
  id,
  status,
}: {
  readonly id: string;
  readonly status: "in_aprobare" | "aprobata";
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function decide(decizie: "aprobata" | "respinsa"): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await decideDeplasare({ id, decizie });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
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

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {status === "in_aprobare" ? (
          <>
            <Buton
              varianta="primar"
              inCurs={inCurs}
              textInCurs="Se trimite…"
              onClick={() => {
                decide("aprobata");
              }}
            >
              Aprobă
            </Buton>
            <Buton
              varianta="secundar"
              inCurs={inCurs}
              onClick={() => {
                decide("respinsa");
              }}
            >
              Respinge
            </Buton>
          </>
        ) : (
          <Buton varianta="primar" inCurs={inCurs} textInCurs="Se marchează…" onClick={deconteaza}>
            Marchează decontată
          </Buton>
        )}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota max-w-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
