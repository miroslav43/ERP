"use client";

// src/app/(app)/registru/panou-document.tsx
//
// Panoul lateral al unui rând de registru, deschis din adresă (`?doc=<id>`).
//
// ── DE CE STAREA E ÎN URL ȘI TOTUȘI EXISTĂ UN `useState` ─────────────────
// Adresa e sursa: cât e `doc` în ea, pagina randează panoul cu conținutul
// citit pe server, deci se poate partaja, iar „înapoi" îl închide. Starea
// locală există pentru un singur moment — închiderea. Un `router.replace` fără
// `doc` ar demonta `<dialog>`-ul deschis fără animația de ieșire, iar pe durata
// dus-întorsului RSC fundalul ar bloca lista. `setDeschis(false)` pornește
// ieșirea imediat; serverul demontează panoul când ajunge.
//
// `scroll: false`: altfel App Router derulează segmentul paginii în vizor și
// lista sare sus la fiecare închidere.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { PanouLateral } from "@/components/ui/dialog";

export function PanouDocumentRegistru({
  titlu,
  descriere,
  subsol,
  children,
}: Readonly<{
  titlu: string;
  descriere?: string;
  subsol?: ReactNode;
  children: ReactNode;
}>) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [deschis, setDeschis] = useState(true);
  const [, porneste] = useTransition();

  function inchide(): void {
    setDeschis(false);
    // Pornim de la parametrii EXISTENȚI și scoatem doar `doc`: filtrele,
    // sortarea și cursorul supraviețuiesc închiderii (tiparul din `BaraFiltre`).
    const p = new URLSearchParams(parametri.toString());
    p.delete("doc");
    porneste(() => {
      router.replace(p.size === 0 ? cale : `${cale}?${p.toString()}`, { scroll: false });
    });
  }

  return (
    <PanouLateral
      deschis={deschis}
      laInchidere={inchide}
      titlu={titlu}
      {...(descriere === undefined ? {} : { descriere })}
      {...(subsol === undefined ? {} : { subsol })}
    >
      {children}
    </PanouLateral>
  );
}
