"use client";

import { useId, useState } from "react";

import { calculeazaDiurnaExterna } from "@/content/legal/diurna-externa-calcul";
import { DIURNA_EXTERNA_TARI } from "@/content/legal/diurna-externa-tari";

/**
 * Calculatorul de diurnă externă: țara, plecarea și întoarcerea, suma plătită.
 *
 * „calculator diurna” se caută separat de tabelul pe țări (auditul din 7 oct
 * 2026), iar tabelul singur lasă omul să facă de mână tocmai partea care se
 * greșește: fracțiunea de zi și plafonul pe toată deplasarea. Regulile sunt în
 * `diurna-externa-calcul.ts`, testate pe exemplul din ghid.
 *
 * Valorile de pornire sunt exemplul din ghid (luni 7:00 – vineri 21:00, Germania),
 * scrise fix: o dată calculată la încărcare ar fi diferit între server și browser.
 */
const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

function suma(valoare: number, moneda: string): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: moneda,
    currencyDisplay: "narrowSymbol",
  }).format(valoare);
}

function zile(n: number): string {
  const text = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(n);
  return n === 1 ? "o zi" : `${text} zile`;
}

export function CalculatorDiurnaExterna() {
  const id = useId();
  const [tara, setTara] = useState("Germania");
  const [plecare, setPlecare] = useState("2026-10-05T07:00");
  const [intoarcere, setIntoarcere] = useState("2026-10-09T21:00");
  const [platit, setPlatit] = useState("");

  const date = DIURNA_EXTERNA_TARI.find((t) => t.tara === tara);
  const platitPeZi = platit.trim() === "" ? null : Number(platit.replace(",", "."));
  const rezultat =
    date === undefined
      ? null
      : calculeazaDiurnaExterna({
          cuantum: date.cuantum,
          plecare: new Date(plecare),
          intoarcere: new Date(intoarcere),
          platitPeZi: platitPeZi !== null && Number.isFinite(platitPeZi) ? platitPeZi : null,
        });

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${id}-tara`} className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[0.875rem] font-medium">Țara</span>
          <select
            id={`${id}-tara`}
            value={tara}
            onChange={(e) => setTara(e.target.value)}
            className={CLASA_CAMP}
          >
            {DIURNA_EXTERNA_TARI.map((t) => (
              <option key={t.tara} value={t.tara}>
                {t.tara}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-plecare`} className="flex flex-col gap-1.5">
          <span className="text-[0.875rem] font-medium">Trecerea frontierei, la plecare</span>
          <input
            id={`${id}-plecare`}
            type="datetime-local"
            value={plecare}
            onChange={(e) => setPlecare(e.target.value)}
            className={CLASA_CAMP}
          />
        </label>
        <label htmlFor={`${id}-intoarcere`} className="flex flex-col gap-1.5">
          <span className="text-[0.875rem] font-medium">Trecerea frontierei, la întoarcere</span>
          <input
            id={`${id}-intoarcere`}
            type="datetime-local"
            value={intoarcere}
            onChange={(e) => setIntoarcere(e.target.value)}
            className={CLASA_CAMP}
          />
        </label>
        <label htmlFor={`${id}-platit`} className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[0.875rem] font-medium">
            Cât plătește firma pe zi{" "}
            <span className="text-mk-text-slab font-normal">
              (opțional, în {date?.moneda ?? "EUR"})
            </span>
          </span>
          <input
            id={`${id}-platit`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={platit}
            onChange={(e) => setPlatit(e.target.value)}
            className={CLASA_CAMP}
          />
        </label>
      </div>

      <div aria-live="polite">
        {rezultat === null || date === undefined ? (
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">
            Alege o întoarcere după plecare ca să vezi calculul.
          </p>
        ) : (
          <dl className="border-mk-rigla/40 border-t">
            <div className="border-mk-rigla/40 flex justify-between gap-6 border-b py-3">
              <dt className="text-mk-text-slab text-[0.9375rem]">Zile de diurnă</dt>
              <dd className="font-mk-date text-[1.0625rem] tabular-nums">{zile(rezultat.zile)}</dd>
            </div>
            <div className="border-mk-rigla/40 flex justify-between gap-6 border-b py-3">
              <dt className="text-mk-text-slab text-[0.9375rem]">
                Diurna din HG 518/1995 ({suma(date.cuantum, date.moneda)} pe zi)
              </dt>
              <dd className="font-mk-date text-[1.0625rem] tabular-nums">
                {suma(rezultat.diurnaLegala, date.moneda)}
              </dd>
            </div>
            <div className="border-mk-rigla/40 flex justify-between gap-6 border-b py-3">
              <dt className="text-[0.9375rem] font-medium">Plafonul neimpozabil (2,5 ×)</dt>
              <dd className="font-mk-date text-[1.125rem] font-medium tabular-nums">
                {suma(rezultat.plafonNeimpozabil, date.moneda)}
              </dd>
            </div>
            {rezultat.platit !== null && rezultat.impozabil !== null && (
              <>
                <div className="border-mk-rigla/40 flex justify-between gap-6 border-b py-3">
                  <dt className="text-mk-text-slab text-[0.9375rem]">Plătit de firmă</dt>
                  <dd className="font-mk-date text-[1.0625rem] tabular-nums">
                    {suma(rezultat.platit, date.moneda)}
                  </dd>
                </div>
                <div className="border-mk-rigla/40 flex justify-between gap-6 border-b py-3">
                  <dt className="text-mk-text-slab text-[0.9375rem]">
                    Din care impozabil, ca venit din salarii
                  </dt>
                  <dd className="font-mk-date text-[1.0625rem] tabular-nums">
                    {suma(rezultat.impozabil, date.moneda)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
        <p className="text-mk-text-slab mt-4 text-[0.8125rem] leading-[1.6]">
          Zilele se numără din 24 în 24 de ore de la trecerea frontierei; restul de până la 12 ore
          primește jumătate de diurnă, peste 12 ore diurna întreagă. Al doilea plafon — 3 salarii de
          bază pe lună — depinde de salariul omului și nu e inclus aici.
        </p>
      </div>
    </div>
  );
}
