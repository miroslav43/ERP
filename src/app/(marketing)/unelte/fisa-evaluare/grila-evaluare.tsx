"use client";

import { useId, useRef, useState } from "react";

import {
  avizePonderi,
  calculeazaGrila,
  citesteNota,
  citestePondere,
  citestePraguri,
  formateazaSutimi,
  MAX_CRITERII,
  MAX_CRITERIU,
  ponderiEgale,
  SCALA_NOTE,
  type Praguri,
} from "./calcul";
import type { RandGrila } from "./model";
import { SETURI, setDupaCheie, type CheieSet } from "./seturi";

/**
 * Grila fișei de evaluare: criteriu, pondere și notă pe fiecare rând, cu nota
 * finală și calificativul calculate pe loc.
 *
 * ── ÎN FORMULAR, NU ÎN LOCUL LUI ──────────────────────────────────────────
 * Câmpurile poartă numele pe care le citește `parametriFisaEvaluare`
 * (`criteriu`, `pondere`, `nota`, câte unul pe rând; `set`; `prag_*`), deci
 * „Completează fișa” și butoanele de descărcare trimit exact ce se vede aici.
 * Componenta nu rescrie adresa (poarta GA din `pornire-ga.tsx` se decide la
 * încărcare) și nu trimite nimic singură.
 *
 * Fără JavaScript, serverul randează aceleași rânduri; adăugarea, ștergerea și
 * împărțirea egală cer JavaScript, iar setul se încarcă prin „Încarcă setul”,
 * un buton de trimitere obișnuit.
 */

type RandEditabil = Readonly<{ cheie: number; criteriu: string; pondere: string; nota: string }>;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_BUTON =
  "border-mk-rigla hover:border-mk-text inline-flex h-11 items-center justify-center rounded border px-4 text-[0.9375rem] disabled:opacity-40";

const INTREBARE_SET = "Înlocuiești criteriile scrise cu setul ales? Ponderile și notele se pierd.";

const editabile = (grila: readonly RandGrila[]): RandEditabil[] =>
  grila.map((r, i) => ({
    cheie: i,
    criteriu: r.criteriu,
    pondere: r.pondere === null ? "" : String(r.pondere),
    nota: r.nota === null ? "" : String(r.nota),
  }));

const dinSet = (cheie: CheieSet): RandEditabil[] =>
  setDupaCheie(cheie).criterii.map((c, i) => ({
    cheie: i,
    criteriu: c.criteriu,
    pondere: String(c.pondere),
    nota: "",
  }));

export function GrilaEvaluare({
  grila,
  set: setInitial,
  praguri,
}: Readonly<{ grila: readonly RandGrila[]; set: CheieSet; praguri: Praguri }>) {
  const id = useId();
  const [set, setSet] = useState<CheieSet>(setInitial);
  const [randuri, setRanduri] = useState<RandEditabil[]>(() => editabile(grila));
  const [prag, setPrag] = useState({
    fb: formateazaSutimi(praguri.foarteBine),
    b: formateazaSutimi(praguri.bine),
    s: formateazaSutimi(praguri.satisfacator),
  });
  // Cheile rândurilor noi continuă după cele de pe server: aceleași la hidratare.
  const urmatoarea = useRef(grila.length);

  const completate = randuri.filter((r) => r.criteriu.trim() !== "");
  const praguriCitite = citestePraguri(prag.fb, prag.b, prag.s);
  const rezultat = calculeazaGrila(
    completate.map((r) => ({ pondere: citestePondere(r.pondere), nota: citesteNota(r.nota) })),
    praguriCitite.praguri,
  );
  const avize = [
    ...avizePonderi(rezultat),
    ...(praguriCitite.corectate
      ? [
          "Pragurile trebuie să scadă de la Foarte bine la Satisfăcător; se folosesc cele implicite.",
        ]
      : []),
  ];

  const schimba = (cheie: number, camp: "criteriu" | "pondere" | "nota", valoare: string) => {
    setRanduri((vechi) => vechi.map((r) => (r.cheie === cheie ? { ...r, [camp]: valoare } : r)));
  };

  /** Rândurile nu mai sunt setul curent, neatins: încărcarea altuia ar pierde ce a scris omul. */
  const eScris = () =>
    JSON.stringify(randuri.map((r) => [r.criteriu, r.pondere, r.nota])) !==
    JSON.stringify(dinSet(set).map((r) => [r.criteriu, r.pondere, r.nota]));

  const alegeSet = (cheie: CheieSet) => {
    if (eScris() && !window.confirm(INTREBARE_SET)) return;
    setSet(cheie);
    setRanduri(dinSet(cheie).map((r) => ({ ...r, cheie: urmatoarea.current + r.cheie })));
    urmatoarea.current += MAX_CRITERII;
  };

  const adauga = () => {
    const cheie = urmatoarea.current;
    urmatoarea.current += 1;
    setRanduri((vechi) => [...vechi, { cheie, criteriu: "", pondere: "", nota: "" }]);
  };

  const imparteEgal = () => {
    // Totul în funcția de actualizare: React o poate chema de două ori (StrictMode),
    // iar un contor ținut în afara ei ar continua de unde a rămas.
    setRanduri((vechi) => {
      const ponderi = ponderiEgale(vechi.filter((r) => r.criteriu.trim() !== "").length);
      let k = 0;
      return vechi.map((r) => {
        if (r.criteriu.trim() === "") return r;
        const pondere = ponderi[k] ?? 0;
        k += 1;
        return { ...r, pondere: String(pondere) };
      });
    });
  };

  return (
    <fieldset className="flex flex-col gap-4 sm:col-span-2 lg:col-span-3">
      <legend className="text-[0.875rem] font-medium">Criteriile, ponderea și nota</legend>

      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={`${id}-set`} className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <span className="text-mk-text-slab text-[0.8125rem]">Set de criterii, după post</span>
          <select
            id={`${id}-set`}
            name="set"
            value={set}
            onChange={(e) => alegeSet(setDupaCheie(e.target.value).cheie)}
            className={CLASA_CAMP}
          >
            {SETURI.map((s) => (
              <option key={s.cheie} value={s.cheie}>
                {s.eticheta}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          name="incarca"
          value="set"
          onClick={(e) => {
            // Fără JavaScript, serverul încarcă setul direct. Cu JavaScript întrebăm
            // întâi, ca la schimbarea din listă, dacă s-ar pierde ceva scris.
            if (eScris() && !window.confirm(INTREBARE_SET)) e.preventDefault();
          }}
          className={CLASA_BUTON}
        >
          Încarcă setul
        </button>
      </div>

      <ol className="flex flex-col gap-3">
        {randuri.map((r, i) => (
          <li
            key={r.cheie}
            className="border-mk-rigla/40 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-end"
          >
            <label className="flex min-w-0 flex-col gap-1 sm:flex-1">
              <span className="text-mk-text-slab text-[0.8125rem]">Criteriul {String(i + 1)}</span>
              <input
                type="text"
                name="criteriu"
                maxLength={MAX_CRITERIU}
                value={r.criteriu}
                onChange={(e) => schimba(r.cheie, "criteriu", e.target.value)}
                className={CLASA_CAMP}
              />
            </label>
            <div className="flex items-end gap-2">
              <label className="flex w-24 flex-col gap-1">
                <span className="text-mk-text-slab text-[0.8125rem]">Pondere (%)</span>
                <input
                  type="text"
                  name="pondere"
                  inputMode="numeric"
                  maxLength={4}
                  value={r.pondere}
                  onChange={(e) => schimba(r.cheie, "pondere", e.target.value)}
                  className={CLASA_CAMP}
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:w-56 sm:flex-none">
                <span className="text-mk-text-slab text-[0.8125rem]">Nota</span>
                <select
                  name="nota"
                  value={r.nota}
                  onChange={(e) => schimba(r.cheie, "nota", e.target.value)}
                  className={CLASA_CAMP}
                >
                  <option value="">— de completat</option>
                  {SCALA_NOTE.map((s) => (
                    <option key={s.nota} value={String(s.nota)}>
                      {`${String(s.nota)} — ${s.descriere}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setRanduri((vechi) => vechi.filter((x) => x.cheie !== r.cheie))}
                disabled={randuri.length <= 1}
                aria-label={`Șterge criteriul ${String(i + 1)}`}
                className={CLASA_BUTON}
              >
                Șterge
              </button>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={adauga}
          disabled={randuri.length >= MAX_CRITERII}
          className={CLASA_BUTON}
        >
          Adaugă un criteriu
        </button>
        <button
          type="button"
          onClick={imparteEgal}
          disabled={completate.length === 0}
          className={CLASA_BUTON}
        >
          Împarte ponderile egal
        </button>
      </div>

      <div role="status" aria-live="polite" className="text-[0.9375rem]" data-rezultat-grila="">
        <p>
          Total ponderi: <strong>{String(rezultat.sumaPonderi)}%</strong>
          {rezultat.notaFinala !== null && rezultat.calificativ !== null ? (
            <>
              {" · "}Nota finală: <strong>{formateazaSutimi(rezultat.notaFinala)}</strong> —{" "}
              <strong>{rezultat.calificativ}</strong>
            </>
          ) : (
            " · Nota finală se calculează când fiecare criteriu are pondere și notă."
          )}
        </p>
        {avize.map((a) => (
          <p key={a} className="text-mk-refuz mt-1 font-medium">
            {a}
          </p>
        ))}
      </div>

      <details className="text-[0.9375rem]">
        <summary className="cursor-pointer">
          Pragurile calificativelor
          {praguriCitite.corectate ? (
            <span className="text-mk-refuz font-medium">
              {" "}
              — greșite, se folosesc cele implicite
            </span>
          ) : null}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["fb", "prag_fb", "Foarte bine, de la"],
              ["b", "prag_b", "Bine, de la"],
              ["s", "prag_s", "Satisfăcător, de la"],
            ] as const
          ).map(([cheie, nume, eticheta]) => (
            <label key={nume} className="flex flex-col gap-1">
              <span className="text-mk-text-slab text-[0.8125rem]">{eticheta}</span>
              <input
                type="text"
                name={nume}
                inputMode="decimal"
                maxLength={4}
                value={prag[cheie]}
                onChange={(e) => setPrag((v) => ({ ...v, [cheie]: e.target.value }))}
                className={CLASA_CAMP}
              />
            </label>
          ))}
        </div>
        <p className="text-mk-text-slab mt-2 text-[0.8125rem]">
          Sub pragul pentru Satisfăcător, calificativul e Nesatisfăcător. Pragurile nu sunt din
          lege: le stabilește regulamentul intern.
        </p>
      </details>
    </fieldset>
  );
}
