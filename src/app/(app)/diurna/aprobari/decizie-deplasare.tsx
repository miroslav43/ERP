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
export function DecizieDeplasare({ id, status }: { readonly id: string; readonly status: "in_aprobare" | "aprobata" }) {
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
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
            >
              {inCurs ? "Se trimite…" : "Aprobă"}
            </button>
            <button
              type="button"
              disabled={inCurs}
              onClick={() => {
                decide("respinsa");
              }}
              className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
            >
              Respinge
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={inCurs}
            onClick={deconteaza}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-violet-800 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            {inCurs ? "Se marchează…" : "Marchează decontată"}
          </button>
        )}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="max-w-sm text-xs text-danger">
          {eroare}
        </p>
      )}
    </div>
  );
}
