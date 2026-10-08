// src/components/ui/link-entitate.tsx
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Numele unei entități (angajat, vehicul, echipament, curs…) care devine link
 * doar când are unde duce.
 *
 * ── DE CE `href: string | null`, ȘI NU UN BOOLEAN DE PERMISIUNE ──────────
 * Analiza din 2026-10-08 a găsit nume de angajat afișate ca text în 22 de
 * module și, unde linkul exista, pus necondiționat: managerul cu
 * `employees:read = team` era trimis în 404 pentru oricine din afara echipei.
 * O poartă globală (`can(employees:read, team)`) nu ajunge, fiindcă fișa se
 * deschide PER RÂND: rândul trebuie să fi venit prin RLS, să nu fie șters, și
 * rolul să aibă dreptul. Decizia se ia deci la apelant, cu `hrefFisa()` din
 * `src/lib/navigare/fisa.ts` sau cu `legaturaSigura()` din registrul porților,
 * iar componenta primește rezultatul: un link sau nimic.
 *
 * `relative` e implicit: într-un rând de tabel apăsabil, pe telefon, cardul
 * are un link care acoperă tot (`after:inset-0`); fără `relative`, clicul pe
 * nume ar deschide rândul, nu fișa.
 */
export function LinkEntitate({
  href,
  children,
  className,
  clasaText,
}: Readonly<{
  /** `null` = text simplu: entitatea e ascunsă de RLS, ștearsă sau rolul n-o poate deschide. */
  href: string | null;
  children: ReactNode;
  className?: string;
  /** Clasa variantei de text, când nu e link. */
  clasaText?: string;
}>): ReactElement {
  if (href === null) return <span className={clasaText}>{children}</span>;
  return (
    <Link href={href} className={cn("relative underline-offset-2 hover:underline", className)}>
      {children}
    </Link>
  );
}
