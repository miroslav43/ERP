"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decideDeplasare, deconteazaDeplasare } from "../actions";

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
            <button
              type="button"
              disabled={inCurs}
              onClick={() => {
                decide("aprobata");
              }}
              className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
            >
              {inCurs ? "Se trimite…" : "Aprobă"}
            </button>
            <button
              type="button"
              disabled={inCurs}
              onClick={() => {
                decide("respinsa");
              }}
              className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed"
            >
              Respinge
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={inCurs}
            onClick={deconteaza}
            className="text-primary-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium hover:bg-violet-800 disabled:cursor-not-allowed"
          >
            {inCurs ? "Se marchează…" : "Marchează decontată"}
          </button>
        )}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger max-w-sm text-xs">
          {eroare}
        </p>
      )}
    </div>
  );
}
