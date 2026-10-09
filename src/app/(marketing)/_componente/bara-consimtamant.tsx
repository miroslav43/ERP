"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ATRIBUT_CONSIMTAMANT,
  CHEIE_CONSIMTAMANT,
  EVENIMENT_CONSIMTAMANT,
  type Alegere,
} from "./consimtamant";

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

/**
 * Ține atributul de pe `<html>` (`ATRIBUT_CONSIMTAMANT`) la zi cu starea citită.
 *
 * De obicei îl pune scriptul de la parsare (`analitice.tsx`). Dar la o navigare
 * soft dintr-un alt grup de rute — de pe `/autentificare` spre `/`, prin sigla —
 * layout-ul `(marketing)` se montează pe client, iar React nu execută un
 * `<script>` inline randat pe client: atributul ar lipsi, iar CSS-ul ar ține
 * bara ascunsă pentru cineva care n-a ales nimic. Invers, după o alegere,
 * atributul rămas ar arăta bara un cadru la fiecare remontare (revizuirea din
 * 9 oct 2026).
 */
function sincronizeazaAtributul(cere: boolean) {
  if (cere) document.documentElement.setAttribute(ATRIBUT_CONSIMTAMANT, "cere");
  else document.documentElement.removeAttribute(ATRIBUT_CONSIMTAMANT);
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
    const id = requestAnimationFrame(() => {
      const citit = citesteSalvat();
      sincronizeazaAtributul(citit === "nimic");
      setSalvat(citit);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function raspunde(raspuns: Alegere) {
    setRaspunsAcum(raspuns);
    sincronizeazaAtributul(false);
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
    // `BibliotecaGa` așteaptă alegerea pe paginile uneltelor (8 oct 2026).
    window.dispatchEvent(new CustomEvent<Alegere>(EVENIMENT_CONSIMTAMANT, { detail: raspuns }));
  }

  // Două motive de a nu apărea: alegerea e deja salvată sau tocmai a fost dată.
  // „necitit” (inclusiv pe server) RANDEAZĂ bara: dacă se vede o decide CSS-ul,
  // după atributul pus pe <html> la parsare (`ATRIBUT_CONSIMTAMANT`). Așa bara
  // se vopsește odată cu pagina, nu după hidratare (auditul din 8 oct 2026).
  if (raspunsAcum !== null || salvat === "acceptat" || salvat === "refuzat") return null;

  return (
    <div
      role="region"
      aria-label="Cookie-uri de analiză"
      data-tipar="ascunde"
      data-bara-consimtamant=""
      className="mk-cerneala bg-mk-cerneala text-mk-text-inv fixed inset-x-0 bottom-0 z-50 border-t border-(--color-mk-rigla-inv)"
    >
      {/* Pe telefon, bara ocupa 180 px din 844 (21%) și acoperea captura de sub
          erou (auditul din 2 oct 2026). Sub `sm`: text mai mic, spații mai mici,
          butoane de 44 px — pragul de țintă tactilă, sub care nu se coboară. */}
      <div className="max-w-mk mx-auto flex w-full flex-wrap items-center gap-x-8 gap-y-2 px-[clamp(1rem,4vw,2.5rem)] py-3 sm:gap-y-3 sm:py-4">
        <p className="text-mk-text-inv-slab min-w-[18rem] flex-1 text-[0.8125rem] leading-[1.5] sm:text-[0.875rem] sm:leading-[1.55]">
          Folosim cookie-uri de analiză ca să știm ce pagini sunt citite. Nu sunt necesare, iar dacă
          refuzi nu se schimbă nimic pentru tine.{" "}
          {/* Direct la secțiunea despre cookie-uri, nu în capul politicii. */}
          <Link
            href="/legal/confidentialitate#sectiunea-8"
            className="text-mk-text-inv underline-offset-4"
          >
            Politica de confidențialitate
          </Link>
        </p>
        <div className="flex w-full gap-3 sm:w-auto">
          <button
            type="button"
            onClick={() => raspunde("refuzat")}
            className="border-mk-rigla-inv hover:border-mk-text-inv inline-flex h-11 flex-1 items-center justify-center rounded border px-5 text-[0.9375rem] font-medium transition-colors sm:h-12 sm:flex-none"
          >
            Refuz
          </button>
          <button
            type="button"
            onClick={() => raspunde("acceptat")}
            className="bg-mk-hartie text-mk-cerneala inline-flex h-11 flex-1 items-center justify-center rounded px-5 text-[0.9375rem] font-medium transition-opacity hover:opacity-90 sm:h-12 sm:flex-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
