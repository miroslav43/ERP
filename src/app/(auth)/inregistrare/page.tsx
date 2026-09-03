// src/app/(auth)/inregistrare/page.tsx
import type { Metadata } from "next";

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

export default function PaginaInregistrare() {
  return <FormularInregistrare />;
}
