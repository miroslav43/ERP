// src/app/(app)/concedii/link-document.tsx
"use client";

import { Paperclip } from "lucide-react";
import { useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";

import { linkDocumentConcediu } from "./actions";

/**
 * Deschide documentul justificativ al unei cereri.
 *
 * ── DE CE UN BUTON, NU UN `<a href>` ──────────────────────────────────────
 * Bucketul `org-documents` e privat, deci nu există adresă permanentă: fiecare
 * deschidere cere o legătură semnată, validă un minut. Un link randat pe server
 * ar însemna să semnăm documentul la fiecare afișare a paginii, pentru oricine
 * o deschide — inclusiv când nimeni nu apasă. Adresa se cere la clic.
 *
 * ── CE SE VEDEA ÎNAINTE ───────────────────────────────────────────────────
 * Calea brută din bază, scrisă cu font monospațiat: `{uuid}/leave/{uuid}/{uuid}-x.pdf`.
 * Nici nu spunea ce e fișierul, nici nu se putea deschide. Pentru cine aprobă
 * cererea — singurul om care are nevoie de act ca să decidă — era o înșiruire
 * de identificatori.
 */
export function LinkDocumentConcediu({ cerereId }: { readonly cerereId: string }) {
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  function deschide(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await linkDocumentConcediu({ id: cerereId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      // `noopener` explicit: fereastra nouă n-are de ce să ajungă la `opener`.
      window.open(rezultat.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <>
      <Buton varianta="secundar" inCurs={inCurs} textInCurs="Se pregătește…" onClick={deschide}>
        <Paperclip aria-hidden="true" className="size-4" />
        Deschide documentul
      </Buton>
      <span aria-live="polite">
        {eroare === null ? null : (
          <span role="alert" className="text-danger text-nota ms-2">
            {eroare}
          </span>
        )}
      </span>
    </>
  );
}
