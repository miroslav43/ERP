// src/components/asistent/referinta-ruta.tsx
"use client";

import { ArrowRight, FileUser, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { NAV_ITEMS, PORTAL_NAV_ITEMS } from "@/config/navigation";
import type { Destinatie } from "@/lib/asistent/destinatii";
import { cn } from "@/lib/ui/cn";

/**
 * Pastila către care duce un răspuns.
 *
 * Aici se vede de ce modelul n-are voie să scrie adrese: tot ce apare mai jos —
 * iconița, eticheta, drumul de click, href-ul — vine din `NAV_ITEMS` și din
 * indexul de destinații, nu din textul generat. Modelul a ales doar CARE
 * destinație. Dacă mâine „Săptămâna mea” se mută din Operațiuni în Personal,
 * pastila spune singură drumul nou, fără ca nimeni să reantreneze nimic.
 *
 * Se folosește `<Link>`, nu `<a>`: navigarea rămâne pe client, deci layout-ul
 * nu se re-randează și conversația din bulă supraviețuiește saltului.
 */
/*
 * Tabelul se construiește O SINGURĂ DATĂ, la încărcarea modulului, și se
 * indexează la randare — nu se caută cu `find` în corpul componentei.
 *
 * Nu e optimizare: `react-hooks/static-components` respinge o componentă
 * întoarsă de un apel de funcție în timpul randării, fiindcă React Compiler nu
 * poate dovedi că e aceeași de la o randare la alta. Indexarea într-o constantă
 * de modul o poate — e același tipar cu `PICTOGRAMA[toast.fel]` din `toast.tsx`.
 */
const PICTOGRAME: Readonly<Record<string, LucideIcon>> = {
  ...Object.fromEntries(NAV_ITEMS.map((item) => [`app:${item.id}`, item.icon])),
  ...Object.fromEntries(PORTAL_NAV_ITEMS.map((item) => [`portal:${item.id}`, item.icon])),
};

export function ReferintaRuta({
  destinatie,
  laNavigare,
}: Readonly<{ destinatie: Destinatie; laNavigare?: () => void }>): ReactElement {
  // Fișele de om sunt efemere și n-au intrare de meniu; primesc o iconiță
  // proprie, ca să nu împrumute pe cea a listei de angajați.
  const Pictograma = destinatie.id.startsWith("fisa.")
    ? FileUser
    : (PICTOGRAME[`${destinatie.zona}:${destinatie.parinte ?? ""}`] ?? ArrowRight);
  // Ultimul pas al drumului repetă eticheta pastilei; se taie, ca omul să nu
  // citească același cuvânt de două ori la un centimetru distanță.
  const drum = destinatie.drum.filter((pas) => pas !== destinatie.eticheta);

  return (
    <Link
      href={destinatie.href}
      // Împrăștiere condiționată, nu `onClick={laNavigare}`: sub
      // `exactOptionalPropertyTypes`, un `undefined` explicit nu e același lucru
      // cu proprietatea absentă.
      {...(laNavigare === undefined ? {} : { onClick: laNavigare })}
      className={cn(
        "border-border bg-surface rounded-control group flex items-center gap-3 border px-3 py-2",
        "hover:border-primary/40 hover:bg-background transition-colors",
      )}
    >
      <Pictograma aria-hidden="true" className="text-primary size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="text-corp text-foreground block truncate font-medium">
          {destinatie.eticheta}
        </span>
        {drum.length === 0 ? null : (
          <span className="text-nota text-muted-foreground block truncate">{drum.join(" › ")}</span>
        )}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="text-muted-foreground group-hover:text-primary size-4 shrink-0"
      />
    </Link>
  );
}
