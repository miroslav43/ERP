"use client";

import { useEffect } from "react";

/**
 * Arată îndemnul de după document la primul clic pe un buton de descărcare.
 *
 * Descărcările sunt `formAction` spre o rută care răspunde cu un fișier, deci
 * pagina nu se reîncarcă. Fără asta, cine descarcă direct, fără „Generează”,
 * n-ar vedea niciodată îndemnul. Ascultă pe `document`, nu pe formular: butonul
 * stă într-un `<form>` al paginii, iar componenta n-are referință la el.
 */
export function RevelareDupaDescarcare({ tinta }: Readonly<{ tinta: string }>) {
  useEffect(() => {
    const laClic = (e: MouseEvent) => {
      const buton = e.target instanceof Element ? e.target.closest('button[name="format"]') : null;
      if (buton === null) return;
      const sectiune = document.getElementById(tinta);
      if (sectiune !== null) sectiune.hidden = false;
    };
    document.addEventListener("click", laClic);
    return () => document.removeEventListener("click", laClic);
  }, [tinta]);
  return null;
}
