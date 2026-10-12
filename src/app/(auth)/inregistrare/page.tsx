// src/app/(auth)/inregistrare/page.tsx
import type { Metadata } from "next";

import { ScriptUmami } from "@/app/(marketing)/_componente/analitice";
import { type ParametriPagina, sursaDinParametri } from "@/lib/unelte/masurare";

import { FormularInregistrare } from "./formular-inregistrare";

/**
 * Înregistrarea self-serve.
 *
 * Stă în `(auth)`, nu în `(marketing)`: e ecranul care duce ÎNĂUNTRU, iar
 * învelișul de acolo îl are deja pe cel potrivit — crem, îngust, cu scurtătura
 * de tastatură și cu regula `pointer: coarse` care oprește iOS Safari să
 * mărească pagina la fiecare atingere într-un câmp.
 *
 * `noindex` vine din `(auth)/layout.tsx` și e corect și aici: pagina n-are
 * conținut de căutat, iar drumul spre ea trece prin butonul din antet, nu prin
 * Google.
 */
export const metadata: Metadata = { title: "Creează contul firmei" };

/**
 * `searchParams` face pagina dinamică; costul e o randare pe cerere, pe o pagină
 * vizitată de câteva ori pe săptămână. Sursa e doar un slug din hartă — nimic
 * din ce scrie vizitatorul nu trece pe aici.
 */
export default async function PaginaInregistrare({
  searchParams,
}: Readonly<{ searchParams: Promise<ParametriPagina> }>) {
  const sursa = sursaDinParametri(await searchParams);
  return (
    <>
      <FormularInregistrare sursa={sursa} />
      {/*
        Măsurarea, DOAR aici, nu pe tot grupul `(auth)`: alături stă
        `/invitatie/[token]`, iar o vizualizare de pagină de acolo ar duce
        tokenul de acces în raportul de analiză.

        Fără scriptul ăsta, `data-umami-event` de pe butonul de trimitere n-ar
        pleca niciodată — pagina de conversie ar fi fost singura nemăsurată.
      */}
      <ScriptUmami />
    </>
  );
}
