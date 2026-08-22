import type { ReactNode } from "react";

import type { ContinutLanding } from "@/content/landing/tipuri";

import { Antet } from "./antet";
import { Subsol } from "./subsol";

/**
 * Cadrul unei pagini publice: antet, conținut, subsol.
 *
 * NU stă în `layout.tsx`, fiindcă un layout din App Router nu poate afla limba
 * paginii pe care o învelește — `<html lang>` trăiește doar în layout-ul
 * rădăcină. Aici, în schimb, limba e explicită, iar `lang` pe containerul
 * paginii engleze satisface WCAG 2.1 SC 3.1.2 („limba fragmentelor").
 *
 * Alternativa strict corectă pe 3.1.1 ar fi două layout-uri rădăcină, adică
 * mutarea grupurilor `(app)`, `(auth)`, `(portal)` și `(platform)` sub un grup
 * `(ro)`. E o restructurare a întregii aplicații pentru un câștig marginal, iar
 * mandatul livrării ăsteia e „doar landing-ul".
 */
export function Cadru({ text, children }: { text: ContinutLanding; children: ReactNode }) {
  const acasa = text.limba === "ro" ? "/" : "/en";
  return (
    <div lang={text.limba === "ro" ? undefined : text.limba} className="flex min-h-screen flex-col">
      <a
        href="#continut"
        className="bg-mk-cerneala text-mk-text-inv sr-only rounded px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        {text.antet.sariLaContinut}
      </a>
      <Antet text={text} acasa={acasa} />
      <main id="continut" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Subsol text={text} />
    </div>
  );
}
