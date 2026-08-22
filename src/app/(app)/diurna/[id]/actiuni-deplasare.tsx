"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Send, Trash2 } from "lucide-react";

import { deconteazaDeplasare, stergeCiornaDeplasare, trimiteDeplasare } from "../actions";

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
}: {
  readonly id: string;
  readonly poateTrimite: boolean;
  readonly poateSterge: boolean;
  readonly poateDeconta: boolean;
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
      router.push("/diurna");
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
          <button
            type="button"
            disabled={inCurs}
            onClick={trimite}
            className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
          >
            <Send aria-hidden="true" className="size-4" />
            {inCurs ? "Se trimite…" : "Trimite spre aprobare"}
          </button>
        ) : null}
        {poateDeconta ? (
          <button
            type="button"
            disabled={inCurs}
            onClick={deconteaza}
            className="text-primary-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-medium hover:bg-violet-800 disabled:cursor-not-allowed"
          >
            <BadgeCheck aria-hidden="true" className="size-4" />
            {inCurs ? "Se marchează…" : "Marchează decontată"}
          </button>
        ) : null}
        {poateSterge ? (
          <button
            type="button"
            disabled={inCurs}
            onClick={sterge}
            className="border-danger text-danger hover:bg-danger hover:text-danger-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {inCurs ? "Se șterge…" : "Șterge ciorna"}
          </button>
        ) : null}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
