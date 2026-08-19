// src/components/data/rand-tabel.tsx
"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Rândul întreg navighează la `href`, nu doar coloana cu numele — la cererea
 * explicită de a putea apăsa oriunde pe linie. Linkul accesibil pe nume rămâne
 * neatins pentru tastatură/cititor de ecran; acesta e strict o comoditate de
 * mouse suplimentară.
 *
 * Click-urile pe orice element interactiv din interiorul rândului (linkul de
 * pe nume, un buton de acțiune secundară, un checkbox) NU declanșează
 * navigarea dublă — `closest()` le lasă să-și facă treaba lor.
 */
export function RandTabel({
  href,
  children,
  className = "",
}: {
  /** `null` când rândul nu are nicio destinație (ex. entitatea legată e ascunsă de RLS) — rândul rămâne un `<tr>` simplu, fără click. */
  readonly href: string | null;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const router = useRouter();

  if (href === null) {
    return <tr className={className}>{children}</tr>;
  }
  const destinatie = href;

  function gestioneazaClick(evenimet: MouseEvent<HTMLTableRowElement>): void {
    const tinta = evenimet.target as HTMLElement;
    if (tinta.closest("a, button, input, select, textarea, label")) return;
    router.push(destinatie);
  }

  return (
    <tr onClick={gestioneazaClick} className={`hover:bg-background cursor-pointer ${className}`}>
      {children}
    </tr>
  );
}
