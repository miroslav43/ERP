"use client";

import { useEffect, useRef, useState } from "react";

import { FOAIA, formateazaOre } from "@/content/landing/foaia-date";
import type { ContinutLanding } from "@/content/landing/tipuri";

/**
 * Partea VIE a foii: butoanele de fereastră, anunțurile și evidențierea.
 *
 * ── DE CE EXISTĂ, ȘI CE A COSTAT SĂ NU EXISTE ─────────────────────────────
 * Până pe 20 sept 2026, `Foaia` întreagă era marcată `"use client"` — tabelul
 * cu tot cu cele 340 de celule ale lui. Consecința nu se vedea în niciun test:
 * React trebuia să parcurgă tot arborele acela la încărcare, ca să-i atașeze
 * trei `onClick`.
 *
 * Măsurat pe producție, profil mobil cu încetinire de 4× a procesorului:
 *
 *     pagina de start            script 1920 ms · stil 603 ms · 1184 noduri
 *     /preturi                   script  890 ms · stil 166 ms ·  696 noduri
 *     /ghid/concediu-de-odihna   script 1113 ms · stil 217 ms ·  408 noduri
 *
 * Pagina de start avea TBT 2,0-2,2 s, de două ori cât oricare alta, iar un
 * audit pusese vina pe un chunk comun — care, la profilare, costa 107 ms.
 * Vinovată era hidratarea.
 *
 * Acum tabelul e Server Component: se randează o dată, pe server, și nu se
 * hidratează niciodată. Componenta asta rămâne cu vreo zece elemente.
 *
 * ── DE CE SCRIE DIRECT ÎN DOM ─────────────────────────────────────────────
 * Celulele nu mai sunt ale lui React — sunt HTML de server, pe care React nu-l
 * reconciliază. Deci evidențierea și fereastra se pun cu `setAttribute`, nu cu
 * stare. Nu e o ocolire a lui React, e consecința faptului că arborele acela nu
 * mai e al lui.
 *
 * Ce rămâne în stare: eticheta ferestrei apăsate (`aria-pressed`) și textul
 * anunțat — singurele lucruri pe care le randează chiar componenta asta.
 *
 * ── CE NU S-A SCHIMBAT ────────────────────────────────────────────────────
 * Cele trei decizii din capul lui `foaia.tsx` rămân toate: foaia e completă
 * fără JavaScript (vine din server, iar fereastra implicită o dă CSS-ul prin
 * `:not([data-fereastra])`), nu există derulare orizontală, iar cifra mare nu
 * se mișcă la niciun clic.
 */

type Fereastra = (typeof FOAIA.jumatati)[number];

/*
 * Cele două ajutoare stau la nivel de MODUL, nu în componentă, din două motive
 * care se adună: n-au nimic reactiv în ele (primesc elementul, nu-l caută), iar
 * definite în corpul componentei ar fi fost valori noi la fiecare randare, deci
 * dependențe pe care `exhaustive-deps` le-ar fi cerut în fiecare `useEffect`.
 */

/** Ascunde zilele din afara ferestrei. `null` = luna întreagă, CSS-ul decide. */
function aplicaFereastra(f: HTMLElement, aleasa: Fereastra | null): void {
  for (const celula of f.querySelectorAll<HTMLElement>("[data-zi]")) {
    const zi = Number(celula.dataset["zi"]);
    // `toggleAttribute`, nu `celula.hidden = …`: o atribuire pe un nod din DOM
    // e semnalată de regula de imutabilitate a compilatorului React, care nu
    // poate ști că elementul nu e al lui.
    celula.toggleAttribute("hidden", aleasa !== null && (zi < aleasa.prima || zi > aleasa.ultima));
  }
}

/** Scoate evidențierea de peste tot. Un singur loc, ca să nu rămână resturi. */
function stinge(f: HTMLElement): void {
  for (const marcat of f.querySelectorAll<HTMLElement>("[data-activ]")) {
    marcat.removeAttribute("data-activ");
  }
}

export function FoaiaVie({ text }: { readonly text: ContinutLanding["foaie"] }) {
  const ancora = useRef<HTMLDivElement>(null);
  const [ferestre, setFerestre] = useState<readonly Fereastra[]>([]);
  const [fereastra, setFereastra] = useState<string | null>(null);
  const [anunt, setAnunt] = useState("");

  /** Figura care conține tot: o găsim urcând din propriul nostru element. */
  const figura = () => ancora.current?.closest<HTMLElement>(".mk-foaie") ?? null;

  /*
   * Ce set de ferestre se arată, după lățime.
   *
   * NU se pune `data-fereastra` la montare, deliberat: cât timp atributul
   * lipsește, fereastra o decide CSS-ul, exact ca pentru cine n-are JavaScript.
   * Se marchează doar butonul care corespunde a ceea ce CSS-ul arată deja, ca
   * `aria-pressed` să nu mintă. Atributul apare abia la primul clic.
   */
  useEffect(() => {
    const lat = window.matchMedia("(min-width: 1280px)");
    const mediu = window.matchMedia("(min-width: 768px)");
    // Elementul se ia direct din referință, nu prin `figura()`: o funcție din
    // corpul componentei ar fi o dependență nouă la fiecare randare.
    const f = ancora.current?.closest<HTMLElement>(".mk-foaie") ?? null;

    function potriveste() {
      if (lat.matches) {
        setFerestre([]);
        setFereastra(null);
        f?.removeAttribute("data-fereastra");
        if (f !== null) aplicaFereastra(f, null);
        return;
      }
      const set = mediu.matches ? FOAIA.jumatati : FOAIA.saptamani;
      setFerestre(set);
      setFereastra((curenta) =>
        curenta !== null && set.some((f) => f.cheie === curenta)
          ? curenta
          : (set[0]?.cheie ?? null),
      );
    }

    potriveste();
    lat.addEventListener("change", potriveste);
    mediu.addEventListener("change", potriveste);
    return () => {
      lat.removeEventListener("change", potriveste);
      mediu.removeEventListener("change", potriveste);
    };
  }, []);

  function alegeFereastra(aleasa: Fereastra) {
    setFereastra(aleasa.cheie);
    const f = figura();
    if (f === null) return;
    // De aici încolo atributul EXISTĂ, deci regulile CSS implicite se retrag și
    // vizibilitatea trece în seama lui `hidden`, pus mai jos.
    f.setAttribute("data-fereastra", aleasa.cheie);
    aplicaFereastra(f, aleasa);
  }

  /*
   * Un singur ascultător, pe figură, pentru toate cele 38 de butoane din tabel.
   *
   * Delegarea nu e o optimizare de dragul ei: butoanele sunt randate pe server,
   * deci nu li se pot atașa `onClick` din React. Ascultătorul stă pe un element
   * pe care React ÎL știe — figura —, iar `closest` spune ce s-a apăsat.
   */
  useEffect(() => {
    const f = figura();
    if (f === null) return;

    // Expresie, nu declarație: o declarație e RIDICATĂ, iar TypeScript nu mai
    // păstrează pentru ea îngustarea lui `f` la non-null de mai sus — ar putea,
    // teoretic, să fie apelată înainte de verificare.
    const apasat = (eveniment: MouseEvent) => {
      const tinta = eveniment.target;
      if (!(tinta instanceof Element)) return;
      const buton = tinta.closest("button");
      if (buton === null || !f.contains(buton)) return;

      const celulaZi = buton.closest<HTMLElement>("th[data-zi]");
      const celulaNume = buton.closest<HTMLElement>('th[data-col="nume"]');

      if (celulaZi !== null) {
        const zi = Number(celulaZi.dataset["zi"]);
        const eraActiva = celulaZi.hasAttribute("data-activ");
        stinge(f);
        if (eraActiva) return setAnunt("");
        for (const c of f.querySelectorAll<HTMLElement>(`[data-zi="${String(zi)}"]`)) {
          c.setAttribute("data-activ", "");
        }
        const ore = FOAIA.totaluriPeZi[zi - 1] ?? 0;
        const persoane = FOAIA.randuri.filter((r) => (r.celule[zi - 1]?.ore ?? 0) > 0).length;
        setAnunt(
          text.anuntColoana
            .replace("{zi}", String(zi))
            .replace("{ore}", formateazaOre(ore))
            .replace("{persoane}", String(persoane)),
        );
        return;
      }

      if (celulaNume !== null) {
        const rand = celulaNume.closest("tr");
        const nume = buton.textContent?.trim() ?? "";
        const eraActiv = celulaNume.hasAttribute("data-activ");
        stinge(f);
        if (eraActiv || rand === null) return setAnunt("");
        for (const c of rand.querySelectorAll<HTMLElement>(
          '[data-zi], th[data-col="nume"], td[data-col="ore"]',
        )) {
          c.setAttribute("data-activ", "");
        }
        celulaNume.setAttribute("data-activ", "");
        const ore = FOAIA.randuri.find((r) => r.nume === nume)?.ore ?? 0;
        setAnunt(text.anuntRand.replace("{nume}", nume).replace("{ore}", formateazaOre(ore)));
      }
    };

    f.addEventListener("click", apasat);
    return () => {
      f.removeEventListener("click", apasat);
    };
  }, [text.anuntColoana, text.anuntRand]);

  /*
   * Baleierea de completare, pornită după montare și numai dacă omul n-a cerut
   * mișcare redusă. Starea implicită din HTML e deja cea finală, deci nu există
   * moment în care conținutul să lipsească.
   */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => figura()?.classList.add("mk-anim"), 120);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  return (
    <div ref={ancora}>
      {ferestre.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
            {text.ferestreEticheta}
          </span>
          {ferestre.map((f) => (
            <button
              key={f.cheie}
              type="button"
              onClick={() => {
                alegeFereastra(f);
              }}
              aria-pressed={f.cheie === fereastra}
              aria-label={f.eticheteLunga}
              className={`font-mk-date min-h-11 rounded border px-3 text-[0.75rem] tracking-[0.06em] transition-colors ${
                f.cheie === fereastra
                  ? "border-mk-text bg-mk-cerneala text-mk-text-inv"
                  : "border-mk-rigla hover:bg-mk-activ-hartie"
              }`}
            >
              {f.eticheta}
            </button>
          ))}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {anunt}
      </p>
    </div>
  );
}
