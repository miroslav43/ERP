"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CHEIE_CONSIMTAMANT, type Alegere } from "./consimtamant";

/** Starea citită din browser: alegerea salvată, absența ei, sau „încă nu s-a citit”. */
type Stare = Alegere | "nimic" | "necitit";

function citesteSalvat(): Stare {
  try {
    const v = localStorage.getItem(CHEIE_CONSIMTAMANT);
    return v === "acceptat" || v === "refuzat" ? v : "nimic";
  } catch {
    // Fereastră privată sau stocare blocată: `localStorage` ARUNCĂ, nu întoarce
    // null. Fără `catch`, bara ar cădea cu tot cu pagina. Rămâne vizibilă, iar
    // alegerea durează cât sesiunea — comportamentul corect când nu se poate
    // ține minte nimic.
    return "nimic";
  }
}

export function BaraConsimtamant() {
  /*
   * Starea pornește „necitit” — adică exact ce randează serverul, unde
   * `localStorage` nu există. Se citește după montare, într-un cadru de
   * animație.
   *
   * ── DE CE `requestAnimationFrame`, NU UN `setState` DIRECT ───────────────
   * Lint-ul respinge `setState` sincron într-un efect, și pe drept: produce o a
   * doua randare imediat după prima, la fiecare montare. Amânat cu un cadru,
   * actualizarea intră în randarea următoare, nu în cascadă peste cea curentă.
   *
   * ── DE CE NU `useSyncExternalStore` ─────────────────────────────────────
   * A fost prima variantă și e hook-ul „corect” pentru stare din afara lui
   * React. Măsurat în browser, nu comuta de pe instantaneul de server după
   * hidratare — bara nu apărea niciodată, deși componenta era montată. Cu
   * `reactCompiler` pornit nu merită urmărit mai departe: tiparul de mai jos e
   * mai simplu și verificabil.
   */
  const [salvat, setSalvat] = useState<Stare>("necitit");
  const [raspunsAcum, setRaspunsAcum] = useState<Alegere | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSalvat(citesteSalvat()));
    return () => cancelAnimationFrame(id);
  }, []);

  function raspunde(raspuns: Alegere) {
    setRaspunsAcum(raspuns);
    try {
      localStorage.setItem(CHEIE_CONSIMTAMANT, raspuns);
    } catch {
      /* vezi nota de mai sus */
    }
    // `gtag` e definit de scriptul de consimțământ implicit, care rulează la
    // parsare — deci există și dacă biblioteca n-a apucat să se încarce.
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    gtag?.("consent", "update", {
      analytics_storage: raspuns === "acceptat" ? "granted" : "denied",
    });
  }

  // Trei motive de a nu apărea: alegerea nu s-a citit încă (inclusiv la randarea
  // pe server), e deja salvată, sau tocmai a fost dată în sesiunea asta.
  if (salvat !== "nimic" || raspunsAcum !== null) return null;

  return (
    <div
      role="region"
      aria-label="Cookie-uri de analiză"
      className="mk-cerneala bg-mk-cerneala text-mk-text-inv fixed inset-x-0 bottom-0 z-50 border-t border-(--color-mk-rigla-inv)"
    >
      <div className="max-w-mk mx-auto flex w-full flex-wrap items-center gap-x-8 gap-y-3 px-[clamp(1rem,4vw,2.5rem)] py-4">
        <p className="text-mk-text-inv-slab min-w-[18rem] flex-1 text-[0.875rem] leading-[1.55]">
          Folosim cookie-uri de analiză ca să știm ce pagini sunt citite. Nu sunt necesare ca situl
          să funcționeze, iar dacă refuzi nu se schimbă nimic pentru tine.{" "}
          <Link href="/legal/confidentialitate" className="text-mk-text-inv underline-offset-4">
            Politica de confidențialitate
          </Link>
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => raspunde("refuzat")}
            className="border-mk-rigla-inv hover:border-mk-text-inv inline-flex h-11 items-center rounded border px-5 text-[0.9375rem] font-medium transition-colors"
          >
            Refuz
          </button>
          <button
            type="button"
            onClick={() => raspunde("acceptat")}
            className="bg-mk-hartie text-mk-cerneala inline-flex h-11 items-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
