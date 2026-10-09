import type { ParametriCalculator } from "./parametri";

/**
 * Formularul GET al calculatorului. Server, fără JavaScript: starea stă în
 * adresă, iar `#rezultat` deschide pagina la rezultat, nu sus, pe formular.
 */

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_ETICHETA = "text-[0.875rem] font-medium";

export function Formular({
  p,
  eroare,
}: {
  readonly p: ParametriCalculator;
  readonly eroare: string | null;
}) {
  return (
    <form method="get" action="#rezultat" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Suma (lei)</span>
        <input
          type="text"
          inputMode="decimal"
          name="suma"
          maxLength={20}
          defaultValue={p.text}
          aria-invalid={eroare !== null}
          aria-describedby={eroare !== null ? "eroare-suma" : undefined}
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
        <select name="persoane" defaultValue={String(p.persoane)} className={CLASA_CAMP}>
          <option value="0">niciuna</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4 sau mai multe</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Funcția de bază</span>
        <select name="baza" defaultValue={p.functieDeBaza ? "da" : "nu"} className={CLASA_CAMP}>
          <option value="da">da — aici e funcția de bază</option>
          <option value="nu">nu — al doilea contract</option>
        </select>
      </label>
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
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
