"use client";

// src/app/(app)/registru/filtre-registru.tsx

import { useSearchParams } from "next/navigation";
import { useId } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";
import { Combobox } from "@/components/ui/combobox";
// Din `@/lib/registru/filtre`, NU din `@/lib/queries/registru`: acela e
// `server-only`, iar un import de valoare de acolo într-un Client Component
// pică doar la build (a7c2b58, 8 oct 2026).
import {
  STARI_REGISTRU,
  SURSE_REGISTRU,
  type StareRegistru,
  type SursaRegistru,
} from "@/lib/registru/filtre";

import { ETICHETE_SENS, eticheteazaTipDocument } from "./etichete";

const SENSURI = ["intrare", "iesire", "intern"] as const;

// Starea RÂNDULUI de registru, nu a documentului: o cerere de concediu
// „Anulată" la rubrica „Rezolvare" e un rând viu, rezolvat prin anulare.
const ETICHETE_STARE: Readonly<Record<StareRegistru, string>> = {
  active: "Înregistrări active",
  anulate: "Înregistrări anulate",
  in_lucru: "În lucru",
  rezolvate: "Rezolvate",
};

const ETICHETE_SURSA: Readonly<Record<SursaRegistru, string>> = {
  automat: "Înregistrate automat",
  manual: "Înregistrate manual",
};

type Props = Readonly<{
  ani: readonly number[];
  tipuri: readonly string[];
  angajati: readonly Readonly<{ id: string; nume: string }>[];
  dosare: readonly Readonly<{ indicativ: string; continut: string }>[];
}>;

/**
 * Filtrele registrului.
 *
 * ── DE CE ANUL E AICI, NU UN TABLIST ────────────────────────────────────────
 * Anul e un filtru ca oricare altul din perspectiva barei, dar e SINGURUL fără
 * variantă „toate": Ordinul 217/1996 art. 9 face din registru un volum pe an,
 * iar „numărul 437" nu înseamnă nimic fără el. De aceea lista n-are opțiune
 * goală, iar `an` intră în `cheiProprii` cu o valoare mereu prezentă.
 *
 * Sortarea (`sort`) și gruparea (`grup`) NU sunt câmpuri aici: sunt linkuri în
 * antetele tabelului și în comutator. `BaraFiltre` pornește din parametrii
 * existenți și atinge doar cheile ei, deci supraviețuiesc filtrării.
 */
export function FiltreRegistru({ ani, tipuri, angajati, dosare }: Props) {
  const parametri = useSearchParams();
  const idAngajat = useId();

  const an = parametri.get("an") ?? String(ani[0] ?? new Date().getFullYear());
  const sens = parametri.get("sens") ?? "";
  const tip = parametri.get("tip") ?? "";
  const deLa = parametri.get("de_la") ?? "";
  const panaLa = parametri.get("pana_la") ?? "";
  const cautare = parametri.get("q") ?? "";
  const angajat = parametri.get("angajat") ?? "";
  const dosar = parametri.get("dosar") ?? "";
  const stare = parametri.get("stare") ?? "";
  const sursa = parametri.get("sursa") ?? "";

  // Gărzi de tip, nu `as`: valorile vin din adresă, deci sunt text străin. Un
  // `as` ar fi indexat harta cu orice și ar fi produs `undefined` în etichetă.
  const esteSens = (v: string): v is (typeof SENSURI)[number] =>
    (SENSURI as readonly string[]).includes(v);
  const esteStare = (v: string): v is StareRegistru =>
    (STARI_REGISTRU as readonly string[]).includes(v);
  const esteSursa = (v: string): v is SursaRegistru =>
    (SURSE_REGISTRU as readonly string[]).includes(v);

  const numeAngajat = angajati.find((a) => a.id === angajat)?.nume;

  const active: readonly FiltruActiv[] = [
    !esteSens(sens) ? null : { cheie: "sens", eticheta: `Sens: ${ETICHETE_SENS[sens]}` },
    tip === "" ? null : { cheie: "tip", eticheta: `Tip: ${eticheteazaTipDocument(tip)}` },
    deLa === "" ? null : { cheie: "de_la", eticheta: `De la: ${deLa}` },
    panaLa === "" ? null : { cheie: "pana_la", eticheta: `Până la: ${panaLa}` },
    cautare === "" ? null : { cheie: "q", eticheta: `Caută: ${cautare}` },
    angajat === "" ? null : { cheie: "angajat", eticheta: `Angajat: ${numeAngajat ?? angajat}` },
    dosar === "" ? null : { cheie: "dosar", eticheta: `Dosar: ${dosar}` },
    !esteStare(stare) ? null : { cheie: "stare", eticheta: `Stare: ${ETICHETE_STARE[stare]}` },
    !esteSursa(sursa) ? null : { cheie: "sursa", eticheta: `Sursă: ${ETICHETE_SURSA[sursa]}` },
  ].filter((f): f is FiltruActiv => f !== null);

  return (
    <BaraFiltre
      active={active}
      cheiProprii={[
        "an",
        "sens",
        "tip",
        "de_la",
        "pana_la",
        "q",
        "angajat",
        "dosar",
        "stare",
        "sursa",
      ]}
    >
      <Camp nume="an" eticheta="Anul" fel="select" className="w-full sm:w-28">
        {(atribute) => (
          <select {...atribute} key={an} defaultValue={an}>
            {ani.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="sens" eticheta="Sens" fel="select" className="w-full sm:w-36">
        {(atribute) => (
          <select {...atribute} key={sens} defaultValue={sens}>
            <option value="">Toate</option>
            {SENSURI.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_SENS[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="tip" eticheta="Tip document" fel="select" className="w-full sm:w-56">
        {(atribute) => (
          <select {...atribute} key={tip} defaultValue={tip}>
            <option value="">Toate</option>
            {tipuri.map((t) => (
              <option key={t} value={t}>
                {eticheteazaTipDocument(t)}
              </option>
            ))}
          </select>
        )}
      </Camp>

      {/*
        Combobox, nu `<select>`: o firmă cu zeci de angajați se caută după nume.
        `key` legat de valoarea din adresă, ca la celelalte câmpuri: un control
        necontrolat își ia alegerea inițială o singură dată, deci după „Șterge
        filtrul" ar fi rămas cu cea veche și ar fi reaplicat-o la trimitere.
      */}
      {angajati.length === 0 ? null : (
        <div className="w-full sm:w-56">
          <label htmlFor={idAngajat} className="text-corp block font-medium">
            Angajat
          </label>
          <Combobox
            key={angajat}
            id={idAngajat}
            name="angajat"
            className="mt-1"
            valoareInitiala={angajat}
            placeholder="Toți angajații"
            textFaraRezultate="Niciun angajat cu numele acesta."
            optiuni={[
              { valoare: "", eticheta: "Toți angajații" },
              ...angajati.map((a) => ({ valoare: a.id, eticheta: a.nume })),
            ]}
          />
        </div>
      )}

      <Camp nume="dosar" eticheta="Dosar" fel="select" className="w-full sm:w-56">
        {(atribute) => (
          <select {...atribute} key={dosar} defaultValue={dosar}>
            <option value="">Toate dosarele</option>
            {dosare.map((d) => (
              <option key={d.indicativ} value={d.indicativ}>
                {d.indicativ} — {d.continut}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="stare" eticheta="Stare" fel="select" className="w-full sm:w-44">
        {(atribute) => (
          <select {...atribute} key={stare} defaultValue={stare}>
            <option value="">Toate</option>
            {STARI_REGISTRU.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STARE[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="sursa" eticheta="Sursă" fel="select" className="w-full sm:w-48">
        {(atribute) => (
          <select {...atribute} key={sursa} defaultValue={sursa}>
            <option value="">Toate</option>
            {SURSE_REGISTRU.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_SURSA[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="de_la" eticheta="De la" className="w-full sm:w-40">
        {(atribute) => <input {...atribute} key={deLa} type="date" defaultValue={deLa} />}
      </Camp>

      <Camp nume="pana_la" eticheta="Până la" className="w-full sm:w-40">
        {(atribute) => <input {...atribute} key={panaLa} type="date" defaultValue={panaLa} />}
      </Camp>

      <Camp nume="q" eticheta="Caută" className="w-full sm:w-56">
        {(atribute) => (
          <input
            {...atribute}
            key={cautare}
            type="search"
            defaultValue={cautare}
            placeholder="Rezumat, număr, emitent, destinatar"
          />
        )}
      </Camp>
    </BaraFiltre>
  );
}
