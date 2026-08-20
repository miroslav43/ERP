// src/app/(app)/angajati/nou/_components/campuri-comune.tsx
"use client";

/**
 * Comune tuturor pașilor din asistent — un singur `useForm` pentru tot
 * wizardul, deci un singur loc pentru clasele de câmp și mesajul de eroare.
 * Definită la nivel de modul: o componentă creată în interiorul altei
 * componente primește o identitate nouă la fiecare randare, ceea ce
 * demontează/remontează subarborele și pierde focusul din câmp.
 */
export function Eroare({ id, mesaj }: { id: string; mesaj?: string | undefined }) {
  if (mesaj === undefined || mesaj === "") return null;
  return (
    <p id={id} className="text-danger mt-1 text-sm">
      {mesaj}
    </p>
  );
}

export const claseCamp =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export const claseLabel = "text-foreground block text-sm font-medium";
