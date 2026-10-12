// src/app/(marketing)/_componente/biblioteca-ga.tsx
"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";

import { CHEIE_CONSIMTAMANT, EVENIMENT_CONSIMTAMANT, type Alegere } from "./consimtamant";

/**
 * Biblioteca Google Analytics (`gtag.js`, ~180 KB).
 *
 * ── DE CE NU MAI SE ÎNCARCĂ ORICUM PE UNELTE ──────────────────────────────
 * Consent Mode v2 o încarcă și fără consimțământ, ca să trimită semnale fără
 * cookie-uri. Pe paginile uneltelor, auditul din 8 oct 2026 a găsit trei
 * lucruri: semnalele acelea duceau la Google numele scrise în formular (A3 a
 * închis-o, oprind `config` pe adresele cu date); la CPU ×4, gtag.js era cel
 * mai mare script de pe pagină; iar GA nu e sursa cifrelor (Umami e — memoria
 * `erp-analitice-fapte-verificate`). Pe unelte, deci, biblioteca vine abia
 * după „Accept”: alegerea salvată sau evenimentul din bară.
 *
 * Pe restul sitului rămâne cum era — decizia pentru tot situl e a
 * utilizatorului (auditul SEO din 7 oct 2026, „Decizii care îți aparțin”).
 *
 * Coada de comenzi nu se pierde: `gtag()` din scriptul de consimțământ și
 * `PornireGa` scriu în `dataLayer`, pe care biblioteca îl citește la încărcare.
 */
export function peUnealta(cale: string): boolean {
  return cale === "/unelte" || cale.startsWith("/unelte/");
}

function acceptulSalvat(): boolean {
  try {
    return localStorage.getItem(CHEIE_CONSIMTAMANT) === "acceptat";
  } catch {
    // Stocare blocată: nu știm de un accept, deci nu încărcăm.
    return false;
  }
}

export function BibliotecaGa({ id }: Readonly<{ id: string }>) {
  const cale = usePathname();
  const [aAcceptat, setAAcceptat] = useState(false);

  useEffect(() => {
    // Un cadru mai târziu, ca în `bara-consimtamant.tsx`: lint-ul refuză
    // `setState` sincron în efect.
    const cadru = requestAnimationFrame(() => {
      if (acceptulSalvat()) setAAcceptat(true);
    });
    const laAlegere = (e: Event) => {
      if ((e as CustomEvent<Alegere>).detail === "acceptat") setAAcceptat(true);
    };
    window.addEventListener(EVENIMENT_CONSIMTAMANT, laAlegere);
    return () => {
      cancelAnimationFrame(cadru);
      window.removeEventListener(EVENIMENT_CONSIMTAMANT, laAlegere);
    };
  }, []);

  if (peUnealta(cale) && !aAcceptat) return null;
  return (
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
  );
}
