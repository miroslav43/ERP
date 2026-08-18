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
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {inCurs ? "Se trimite…" : "Aprobă"}
            </button>
            <button
              type="button"
              disabled={inCurs}
              onClick={() => {
                decide("respinsa");
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Respinge
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={inCurs}
            onClick={deconteaza}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60"
          >
            {inCurs ? "Se marchează…" : "Marchează decontată"}
          </button>
        )}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="max-w-sm text-xs text-red-700 dark:text-red-400">
          {eroare}
        </p>
      )}
    </div>
  );
}
