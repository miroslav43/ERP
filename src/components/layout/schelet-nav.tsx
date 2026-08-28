// src/components/layout/schelet-nav.tsx
import type { ReactElement } from "react";

/**
 * Ce se vede în rail cât se calculează insignele.
 *
 * Scheletul are exact geometria meniului real — `min-h-11` pe rând, `px-2`,
 * `gap-0.5` între rânduri, un antet de grup deasupra — fiindcă altfel ar produce
 * chiar saltul de layout pe care ar trebui să-l prevină. Trei grupuri a câte
 * patru rânduri e mediana meniurilor reale ale produsului.
 *
 * Pe navy, nu pe crem: railul e singura zonă închisă la culoare din aplicație,
 * iar `bg-border/70` (pulsul lui `Schelet`) ar fi fost invizibil pe el.
 */
export function ScheletNav(): ReactElement {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4 px-2 py-2">
      <span className="sr-only">Se încarcă meniul…</span>
      {[0, 1, 2].map((grup) => (
        <div key={grup} aria-hidden="true" className="flex flex-col gap-0.5">
          <div className="mb-1.5 h-3 w-20 animate-pulse rounded bg-white/15" />
          {[0, 1, 2, 3].map((rand) => (
            <div key={rand} className="flex min-h-11 items-center gap-2.5 px-2 py-2 md:min-h-0">
              <div className="size-4 shrink-0 animate-pulse rounded bg-white/15" />
              <div
                className="h-3 flex-1 animate-pulse rounded bg-white/10"
                style={{ animationDelay: `${String(((grup * 4 + rand) % 4) * 80)}ms` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Ce se vede în locul antetului cât se rezolvă organizațiile și notificările.
 *
 * Contează O SINGURĂ dimensiune: `h-14`, aceeași cu antetul real
 * (`topbar.tsx:117`). Antetul e `sticky top-0` și dă înălțimea de referință a
 * întregii coloane din dreapta — un schelet mai scund ar face ca tot conținutul
 * paginii să sară în jos în clipa în care sosește antetul adevărat.
 */
export function ScheletTopbar(): ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      className="bg-primary z-antet sticky top-0 flex h-14 items-center gap-2 border-b border-white/10 px-2 sm:gap-3 sm:px-4"
    >
      <span className="sr-only">Se încarcă antetul…</span>
      <div aria-hidden="true" className="size-9 animate-pulse rounded bg-white/15 md:hidden" />
      <div
        aria-hidden="true"
        className="hidden h-3 w-40 animate-pulse rounded bg-white/10 md:block"
      />
      <div className="flex-1" />
      <div aria-hidden="true" className="size-9 animate-pulse rounded bg-white/15" />
      <div aria-hidden="true" className="size-9 animate-pulse rounded bg-white/15" />
      <div aria-hidden="true" className="size-9 animate-pulse rounded bg-white/15" />
    </div>
  );
}
