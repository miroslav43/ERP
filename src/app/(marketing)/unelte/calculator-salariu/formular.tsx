import { PERIOADE, PERIOADE_2026 } from "@/content/legal/salarizare-publica";

import { TICHETE_MAXIM_PE_LUNA, type ParametriCalculator } from "./parametri";

/**
 * Formularul GET al calculatorului. Server, fără JavaScript: starea stă în
 * adresă, iar `#rezultat` deschide pagina la rezultat, nu sus, pe formular.
 */

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_ETICHETA = "text-[0.875rem] font-medium";

/** `<details>` se deschide singur când adresa are deja o opțiune suplimentară aleasă. */
function areOptiuniAlese(p: ParametriCalculator): boolean {
  return (
    p.optiuni.sub26 ||
    p.optiuni.copiiScoala > 0 ||
    p.optiuni.tichete.numar > 0 ||
    p.textTichet.trim() !== ""
  );
}

export function Formular({ p }: { readonly p: ParametriCalculator }) {
  return (
    <form method="get" action="#rezultat" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Suma (lei)</span>
        <input
          type="text"
          inputMode="decimal"
          name="suma"
          maxLength={20}
          defaultValue={p.text}
          aria-invalid={p.campCuEroare === "suma"}
          aria-describedby={p.campCuEroare === "suma" ? "eroare-suma" : undefined}
          className={CLASA_CAMP}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Suma e</span>
        <select name="din" defaultValue={p.din} className={CLASA_CAMP}>
          <option value="brut">brută — calculează netul</option>
          <option value="net">netă — calculează brutul</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Persoane în întreținere</span>
        <select name="persoane" defaultValue={String(p.optiuni.persoane)} className={CLASA_CAMP}>
          <option value="0">niciuna</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4 sau mai multe</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Funcția de bază</span>
        <select
          name="baza"
          defaultValue={p.optiuni.functieDeBaza ? "da" : "nu"}
          className={CLASA_CAMP}
        >
          <option value="da">da — aici e funcția de bază</option>
          <option value="nu">nu — al doilea contract</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Perioada</span>
        <select name="perioada" defaultValue={p.optiuni.perioada} className={CLASA_CAMP}>
          {PERIOADE.map((cheie) => (
            <option key={cheie} value={cheie}>
              {PERIOADE_2026[cheie].eticheta}
            </option>
          ))}
        </select>
      </label>
      <details
        open={areOptiuniAlese(p)}
        className="border-mk-rigla border-t pt-4 sm:col-span-2 lg:col-span-3"
      >
        <summary className="cursor-pointer text-[0.9375rem] font-medium">Mai multe opțiuni</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-start gap-2 text-[0.9375rem] leading-[1.5]">
            <input
              type="checkbox"
              name="sub26"
              value="da"
              defaultChecked={p.optiuni.sub26}
              className="mt-1 size-4 shrink-0"
            />
            <span>
              Am vârsta „de până la 26 de ani” (art. 77 alin. (10) lit. a)): deducerea suplimentară
              de 15% din salariul minim
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>
              Copii sub 18 ani înscriși la școală (deducerea o ia un singur părinte, alin. (12))
            </span>
            <select
              name="copii"
              defaultValue={String(p.optiuni.copiiScoala)}
              className={CLASA_CAMP}
            >
              <option value="0">niciunul</option>
              <option value="1">1 — 100 de lei deducere</option>
              <option value="2">2 — 200 de lei</option>
              <option value="3">3 — 300 de lei</option>
              <option value="4">4 — 400 de lei</option>
              <option value="5">5 — 500 de lei</option>
              <option value="6">6 sau mai mulți — 600 de lei</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Valoarea unui tichet de masă (lei)</span>
            <input
              type="text"
              inputMode="decimal"
              name="tichet"
              maxLength={12}
              placeholder="ex. 45"
              defaultValue={p.textTichet}
              aria-invalid={p.campCuEroare === "tichet"}
              aria-describedby={p.campCuEroare === "tichet" ? "eroare-suma" : undefined}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Tichete în lună (cel mult câte zile lucrate)</span>
            <select
              name="tichete"
              defaultValue={String(p.optiuni.tichete.numar)}
              className={CLASA_CAMP}
            >
              {Array.from({ length: TICHETE_MAXIM_PE_LUNA + 1 }, (_, n) => (
                <option key={n} value={String(n)}>
                  {n === 0 ? "niciun tichet" : String(n)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          data-umami-event="calculator-salariu"
          className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 items-center justify-center rounded px-8 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
        >
          Calculează
        </button>
      </div>
    </form>
  );
}
