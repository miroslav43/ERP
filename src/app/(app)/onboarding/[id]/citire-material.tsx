"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check } from "lucide-react";

import { Buton, buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { confirmaCitire } from "../actions";

/**
 * Materialul de citit al unui pas, cu confirmarea parcurgerii.
 *
 * Livrarea trece prin `/api/materiale/[versiuneId]`, care semnează pe server
 * 60 de secunde și NU dă clientului URL-ul semnat. Motivul e scris la
 * `api/materiale/[versiuneId]/route.ts:5-9`: un URL semnat e un token la
 * purtător, iar pentru un pas al cărui unic produs e dovada că ANUME persoana
 * asta a citit, un link partajabil golește dovada de sens.
 *
 * Confirmarea scrie un rând imutabil; bifarea pasului o face un trigger. De
 * asta butonul dispare după reușită în loc să devină un comutator: „am citit
 * la ora X” nu se retrage.
 */

interface Proprietati {
  readonly pasId: string;
  readonly titlu: string;
  readonly versiuneId: string | null;
  readonly confirmat: boolean;
  /** Fals ⇒ materialul se vede, dar confirmarea o dă altcineva. */
  readonly poateConfirma: boolean;
}

export function CitireMaterial({
  pasId,
  titlu,
  versiuneId,
  confirmat,
  poateConfirma,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function confirma(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await confirmaCitire({ id: pasId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      arataToast({ fel: "reusita", text: "Confirmarea a fost înregistrată." });
      router.refresh();
    });
  }

  return (
    <div className="border-border bg-surface rounded-control space-y-2 border p-3 sm:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <BookOpen aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        <span className="text-corp min-w-0 flex-1 truncate font-medium">{titlu}</span>
        {versiuneId === null ? (
          // Motivul scris, nu doar un buton lipsă.
          <span className="text-muted-foreground text-nota">
            Materialul nu are încă o versiune publicată.
          </span>
        ) : (
          <a
            href={`/api/materiale/${versiuneId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buton({ varianta: "secundar" })}
          >
            Deschide
          </a>
        )}
      </div>

      {confirmat ? (
        <p className="text-muted-foreground text-nota inline-flex items-center gap-1">
          <Check aria-hidden="true" className="size-3.5" />
          Confirmat ca parcurs.
        </p>
      ) : poateConfirma && versiuneId !== null ? (
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se înregistrează…" onClick={confirma}>
          Confirm că am citit
        </Buton>
      ) : null}

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota">
          {eroare}
        </p>
      )}
    </div>
  );
}
