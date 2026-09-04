"use client";

import { useRef, useState } from "react";

/**
 * Ecranul real, văzut PRIN GEAM.
 *
 * ── DE CE UN IFRAME, ȘI NU COMPONENTELE MONTATE AICI ──────────────────────
 * Un document separat aduce fontul de cifre al aplicației (absent din
 * `(marketing)`), ține regulile `.mk` afară (`:focus-visible` și
 * `input:-webkit-autofill` ar repicta interiorul), activează regula de 16px pe
 * atingere prin `data-zona`, și lasă cele nouăsprezece pagini prerandate fără
 * nicio linie de JavaScript propriu. În plus, starea-din-URL a modulului
 * (filă, lună, sortare) rămâne funcțională ÎNĂUNTRU; montată aici, fiecare
 * `<Link>` ar fi navigat în AFARA demonstrației, spre o rută protejată.
 *
 * ── DE CE PASSE-PARTOUT, ȘI NU UN CARD ────────────────────────────────────
 * Vocabularul sitului interzice explicit cardurile, umbrele și chenarul
 * complet (`registru.tsx:5-14`): structura o poartă riglele. Un chenar cu
 * umbră ar fi fost vizibil străin pe pagină. Așa, aplicația e clar un CITAT —
 * două limbi vizuale pe pagină, dar una dintre ele între ghilimele.
 *
 * ── DE CE NU `Dialog` DIN SISTEMUL DE APLICAȚIE ───────────────────────────
 * `src/components/ui/dialog.tsx` e din sistemul de design al aplicației, nu
 * din cel de marketing, iar elementul intră în TOP LAYER — stivuit peste
 * `<dialog>`-ul aplicației din interiorul iframe-ului ar fi al doilea element
 * în top layer. Aici e un `<dialog>` nativ propriu, cu popup-ul lui.
 *
 * ── DE CE CATALOGUL VITRINELOR STĂ ÎN `vitrine.ts`, NU AICI ───────────────
 * `arePrinGeam` e chemat din `module/[modul]/page.tsx`, care e Server
 * Component. Un export al unui fișier `"use client"` devine, în graful de
 * server, o referință de client care ARUNCĂ la apel — deci apelul rupea
 * prerandarea tuturor celor nouăsprezece pagini de modul. Catalogul s-a mutat
 * într-un modul simplu; aici rămâne doar componenta, care se RANDEAZĂ, nu se
 * apelează. Motivarea completă e în `vitrine.ts`.
 */

export function PrinGeam({ cheie, titlu }: { readonly cheie: string; readonly titlu: string }) {
  const [deschis, setDeschis] = useState(false);
  const caseta = useRef<HTMLDialogElement | null>(null);

  function deschide(): void {
    setDeschis(true);
    // `showModal()` dă gratuit capcana de focus, Escape și `::backdrop`.
    caseta.current?.showModal();
  }

  function inchide(): void {
    caseta.current?.close();
    setDeschis(false);
  }

  return (
    <section className="bg-mk-hartie text-mk-text">
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)]">
        <div className="border-mk-rigla border-t py-16 sm:py-24">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            Ecran real
          </p>

          {/*
            Raportul de aspect e FIX și nu se poate scoate: iframe-ul e leneș,
            deci sosește după layout, iar fără rezervarea locului ar împinge
            pagina în jos — CLS garantat pe o pagină publică.

            ── DE CE `overflow-hidden` ȘI `aspect-ratio` STAU PE UN `div`
               INTERIOR, NU PE `<figure>` ─────────────────────────────────
            Cu amândouă pe `<figure>`, iframe-ul (`h-full`) umple exact
            content-box-ul fixat de `aspect-ratio` — iar `<figcaption>`, frate
            în același element cu `overflow-hidden`, e împins sub marginea
            vizibilă și TĂIAT: verificat empiric (CSS compilat real,
            Chromium headless, 600px lățime) — 6,5px din „Date fictive. Nimic
            din ce faci aici nu se salvează." ieșeau din casetă, ilizibile.
            Pe o pagină publică, un avertisment invizibil nu atenuează nimic.
            Separând cele două reguli pe un `div` care înfășoară DOAR
            iframe-ul, `<figcaption>` rămâne în afara zonei tăiate, în fluxul
            normal al lui `<figure>`.
          */}
          <figure className="border-mk-rigla mt-6 border p-3 sm:p-6">
            <div className="overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
              <iframe
                src={`/vitrina/${cheie}`}
                title={`Demonstrație interactivă: ${titlu}`}
                loading="lazy"
                // Chenarul e un CITAT, nu o zonă de lucru: nu primește nici
                // indicatorul de tastatură, nici clicuri. Interacțiunea are
                // butonul ei, de dedesubt.
                tabIndex={-1}
                aria-hidden="true"
                className="h-full w-full border-0"
                style={{ pointerEvents: "none" }}
              />
            </div>
            <figcaption className="text-mk-text-slab mt-3 text-[0.8125rem]">
              Date fictive. Nimic din ce faci aici nu se salvează.
            </figcaption>
          </figure>

          <button
            type="button"
            onClick={deschide}
            className="border-mk-rigla mt-6 border px-4 py-2 text-[0.9375rem]"
          >
            Deschide demonstrația
          </button>

          {/*
            `margin: auto` e pus EXPLICIT: preflight-ul Tailwind îl șterge de pe
            `<dialog>`, iar caseta ar rămâne lipită de colțul din stânga-sus.
            Capcană verificată empiric în acest proiect.

            Al doilea iframe se creează abia la deschidere — nu la montare.
          */}
          <dialog
            ref={caseta}
            onClose={() => {
              setDeschis(false);
            }}
            className="h-[90dvh] w-[95vw] max-w-none border-0 p-0"
            style={{ margin: "auto" }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b p-3">
                <p className="font-mk-date text-[0.6875rem] tracking-[0.14em] uppercase">
                  {titlu} — demonstrație
                </p>
                {/* `Esc` apăsat ÎNĂUNTRUL iframe-ului nu ajunge la părinte,
                    deci butonul ăsta nu e redundant: e singura ieșire pentru
                    cine a intrat cu focusul în demonstrație. */}
                <button type="button" onClick={inchide} className="px-3 py-1">
                  Închide
                </button>
              </div>
              {deschis ? (
                <iframe
                  src={`/vitrina/${cheie}`}
                  title={`Demonstrație interactivă: ${titlu}`}
                  className="h-full w-full flex-1 border-0"
                />
              ) : null}
            </div>
          </dialog>
        </div>
      </div>
    </section>
  );
}
