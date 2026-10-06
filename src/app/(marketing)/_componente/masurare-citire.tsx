"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { dateCitire, procentDerulat } from "./citire";

type PayloadUmami = Record<string, unknown>;
type Umami = { track?: (f: (p: PayloadUmami) => PayloadUmami) => unknown };

/** Parametrul care scoate un dispozitiv din numărătoare, și cel care îl readuce. */
const NU_MA_NUMARA = "nu-ma-numara";
const NUMARA_MA = "numara-ma";

/**
 * Comutatorul documentat de Umami: cu `umami.disabled` în `localStorage`,
 * scriptul nu mai trimite nimic de pe dispozitivul ăsta.
 *
 * ── DE CE ───────────────────────────────────────────────────────────────
 * Pe 6 oct 2026, aproape jumătate din afișările de pagină veneau din
 * Timișoara — adică de la echipă, care își verifică propriul site. Un
 * `administrativo.ro/?nu-ma-numara`, deschis o dată pe fiecare telefon și
 * laptop, le scoate din cifre.
 */
function aplicaExcludere() {
  try {
    const parametri = new URLSearchParams(window.location.search);
    if (parametri.has(NU_MA_NUMARA)) localStorage.setItem("umami.disabled", "1");
    if (parametri.has(NUMARA_MA)) localStorage.removeItem("umami.disabled");
  } catch {
    // Stocare blocată: dispozitivul rămâne numărat, nimic nu se strică.
  }
}

/**
 * Trimite, o singură dată pe pagină, evenimentul `citire`: secundele cu fila
 * vizibilă, cât s-a derulat și ce secțiuni au trecut prin mijlocul ecranului.
 * Calculul și motivul sunt în `citire.ts`.
 *
 * ── CÂND SE TRIMITE ───────────────────────────────────────────────────────
 * La prima dintre: fila ascunsă, `pagehide`, trecerea la altă pagină. Pe
 * telefon, „ascunsă" e adesea ultimul semnal care mai ajunge — iOS nu
 * garantează `pagehide`. Umami trimite cu `keepalive`, deci cererea
 * supraviețuiește închiderii filei. Cine revine în filă după trimitere nu mai
 * e măsurat: un eveniment pe pagină, nu o serie care trebuie apoi însumată.
 *
 * ── DE CE `url` SUPRASCRIS ────────────────────────────────────────────────
 * La o navigare SOFT, curățarea efectului rulează după ce istoria s-a mutat
 * deja pe pagina următoare. Fără `url` explicit, citirea de pe `/preturi`
 * s-ar înregistra pe pagina pe care tocmai s-a intrat.
 *
 * Roboții rareori produc evenimentul: un browser fără cap nu-și ascunde fila.
 */
export function MasurareCitire() {
  const pagina = usePathname();

  useEffect(aplicaExcludere, []);

  useEffect(() => {
    let msActive = 0;
    let vizibilDin: number | null =
      document.visibilityState === "visible" ? performance.now() : null;
    let procentMaxim = 0;
    const sectiuni: string[] = [];
    let trimis = false;

    const elemente = Array.from(document.querySelectorAll<HTMLElement>("section[id]"));
    const ordine = elemente.map((el) => el.id);

    const masoaraDerularea = () => {
      procentMaxim = Math.max(
        procentMaxim,
        procentDerulat(window.scrollY, window.innerHeight, document.documentElement.scrollHeight),
      );
    };
    masoaraDerularea();

    // O secțiune e „văzută" când trece prin banda din mijlocul ecranului. Un
    // prag pe fracțiunea vizibilă n-ar merge: o secțiune mai înaltă decât
    // ecranul nu ajunge niciodată la 50% din ea în fereastră.
    const observator = new IntersectionObserver(
      (intrari) => {
        for (const intrare of intrari) {
          const id = (intrare.target as HTMLElement).id;
          if (intrare.isIntersecting && !sectiuni.includes(id)) sectiuni.push(id);
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    for (const el of elemente) observator.observe(el);

    const opresteCeasul = () => {
      if (vizibilDin !== null) msActive += performance.now() - vizibilDin;
      vizibilDin = null;
    };

    const trimite = () => {
      if (trimis) return;
      trimis = true;
      opresteCeasul();
      const umami = (window as unknown as { umami?: Umami }).umami;
      const date = dateCitire({ msActive, procentMaxim, sectiuni }, ordine);
      umami?.track?.((p) => ({ ...p, url: pagina, name: "citire", data: date }));
    };

    const laVizibilitate = () => {
      if (document.visibilityState === "hidden") trimite();
      else if (!trimis) vizibilDin = performance.now();
    };

    window.addEventListener("scroll", masoaraDerularea, { passive: true });
    document.addEventListener("visibilitychange", laVizibilitate);
    window.addEventListener("pagehide", trimite);

    return () => {
      trimite();
      observator.disconnect();
      window.removeEventListener("scroll", masoaraDerularea);
      document.removeEventListener("visibilitychange", laVizibilitate);
      window.removeEventListener("pagehide", trimite);
    };
  }, [pagina]);

  return null;
}
