"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { IntrareDurata } from "@/components/ui/intrare-ora";
import { formatAmount } from "@/lib/format/money";
import type { Tara, ValoriLegaleDiurna } from "@/lib/queries/per-diem";
import { REGULI_TRECERE_FRONTIERA } from "@/schemas/per-diem";

import { creeazaPolitica } from "../actions";
import { ETICHETE_REGULA_TRECERE } from "../etichete";

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";
const CLASA_AJUTOR = "text-muted-foreground text-nota";

/** Monedele care apar primele în lista diurnei externe; restul vin din țări. */
const MONEDE_UZUALE = ["EUR", "USD", "GBP", "CHF"] as const;

/** Rândul de lege valabil la o dată; fără dată, cel mai recent. */
function legeaLaData(
  valori: readonly ValoriLegaleDiurna[],
  data: string,
): ValoriLegaleDiurna | null {
  const ordonate = [...valori].sort((a, b) => b.valabil_de_la.localeCompare(a.valabil_de_la));
  if (data.length === 0) return ordonate[0] ?? null;
  return ordonate.find((v) => v.valabil_de_la <= data) ?? null;
}

/**
 * O versiune NOUĂ de politică — niciodată o editare a celei vechi. Politica e
 * versionată prin `valabil_de_la`, exact ca baremul pe țări: deplasările deja
 * calculate rămân legate de regulile de la momentul lor.
 *
 * Firma completează doar ce decide ea. Plafonul neimpozabil e lege: se arată,
 * nu se cere — îl pune în bază triggerul din `0147_diurna_valori_legale.sql`.
 */
export function FormularPolitica({
  tari,
  valoriLegale,
}: {
  readonly tari: readonly Tara[];
  readonly valoriLegale: readonly ValoriLegaleDiurna[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusit, setReusit] = useState(false);

  const [denumire, setDenumire] = useState("");
  const [valabilDeLa, setValabilDeLa] = useState("");
  const [countryIdIntern, setCountryIdIntern] = useState(
    tari.find((t) => t.cod_alpha2 === "RO")?.id ?? tari[0]?.id ?? "",
  );
  const [diurnaInternaZi, setDiurnaInternaZi] = useState("");
  const [diurnaExternaZi, setDiurnaExternaZi] = useState("");
  const [monedaDiurnaExterna, setMonedaDiurnaExterna] = useState("EUR");
  const [oreMinime, setOreMinime] = useState<number | null>(12);
  const [regulaTaraTrecere, setRegulaTaraTrecere] =
    useState<(typeof REGULI_TRECERE_FRONTIERA)[number]>("tara_sosire");
  const [acordaZiuaTrecerii, setAcordaZiuaTrecerii] = useState(true);
  const [tarifKmAutoPersonal, setTarifKmAutoPersonal] = useState("");

  const id = {
    denumire: useId(),
    valabilDeLa: useId(),
    tara: useId(),
    diurnaInternaZi: useId(),
    diurnaExternaZi: useId(),
    monedaExterna: useId(),
    oreMinime: useId(),
    regulaTrecere: useId(),
    acordaTrecere: useId(),
    tarifKm: useId(),
  };

  const monedaInterna = tari.find((t) => t.id === countryIdIntern)?.moneda ?? "RON";
  const monede = useMemo(() => {
    const dinTari = [...new Set(tari.map((t) => t.moneda))].sort();
    return [...new Set<string>([...MONEDE_UZUALE, ...dinTari])];
  }, [tari]);

  const lege = legeaLaData(valoriLegale, valabilDeLa);
  const plafonIntern =
    lege === null ? null : lege.multiplu_plafon_neimpozabil * lege.diurna_baza_legala_interna;
  const internaNumar = diurnaInternaZi.trim() === "" ? null : Number(diurnaInternaZi);
  const pesteplafon =
    plafonIntern !== null && internaNumar !== null && internaNumar > plafonIntern
      ? internaNumar - plafonIntern
      : null;

  function trimite(): void {
    if (denumire.trim().length < 2) {
      setEroare("Denumirea politicii trebuie să aibă cel puțin 2 caractere.");
      return;
    }
    if (valabilDeLa.length === 0) {
      setEroare("Data de la care se aplică politica este obligatorie.");
      return;
    }
    if (diurnaInternaZi.trim() === "") {
      setEroare("Completați diurna pe zi pentru deplasările în țară.");
      return;
    }
    if (oreMinime === null) {
      setEroare("Completați numărul minim de ore de deplasare.");
      return;
    }
    const externa = diurnaExternaZi.trim() === "" ? null : Number(diurnaExternaZi);
    setEroare(null);
    setReusit(false);
    porneste(async () => {
      const rezultat = await creeazaPolitica({
        denumire,
        country_id_intern: countryIdIntern,
        moneda_interna: monedaInterna,
        diurna_interna_zi: Number(diurnaInternaZi),
        diurna_externa_zi: externa,
        moneda_diurna_externa: externa === null ? null : monedaDiurnaExterna,
        ore_minime: oreMinime,
        acorda_diurna_ziua_trecerii: acordaZiuaTrecerii,
        regula_tara_trecere: regulaTaraTrecere,
        tarif_km_auto_personal: tarifKmAutoPersonal.trim() === "" ? 0 : Number(tarifKmAutoPersonal),
        valabil_de_la: valabilDeLa,
        observatii: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setReusit(true);
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-panou space-y-5 border p-4">
      <p className="text-corp font-medium">O versiune nouă de politică</p>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={id.denumire} className="text-corp">
            Denumire
          </label>
          <input
            id={id.denumire}
            type="text"
            maxLength={200}
            placeholder="ex. Politica de diurnă 2026"
            value={denumire}
            onChange={(e) => {
              setDenumire(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.valabilDeLa} className="text-corp">
            Valabilă de la
          </label>
          <input
            id={id.valabilDeLa}
            type="date"
            value={valabilDeLa}
            onChange={(e) => {
              setValabilDeLa(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.tara} className="text-corp">
            Țara firmei
          </label>
          <select
            id={id.tara}
            value={countryIdIntern}
            onChange={(e) => {
              setCountryIdIntern(e.target.value);
            }}
            className={CLASA_CAMP}
          >
            {tari.map((t) => (
              <option key={t.id} value={t.id}>
                {t.denumire}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-corp mb-2 font-medium">Cât plătește firma</legend>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.diurnaInternaZi} className="text-corp">
            Diurnă în țară / zi ({monedaInterna})
          </label>
          <input
            id={id.diurnaInternaZi}
            type="number"
            min="0"
            step="0.01"
            value={diurnaInternaZi}
            onChange={(e) => {
              setDiurnaInternaZi(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.diurnaExternaZi} className="text-corp">
            Diurnă în străinătate / zi
          </label>
          <input
            id={id.diurnaExternaZi}
            type="number"
            min="0"
            step="0.01"
            value={diurnaExternaZi}
            onChange={(e) => {
              setDiurnaExternaZi(e.target.value);
            }}
            aria-describedby={`${id.diurnaExternaZi}-ajutor`}
            className={CLASA_CAMP}
          />
          <p id={`${id.diurnaExternaZi}-ajutor`} className={CLASA_AJUTOR}>
            Lăsați gol ca să se plătească baremul legal al fiecărei țări.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.monedaExterna} className="text-corp">
            Moneda diurnei în străinătate
          </label>
          <select
            id={id.monedaExterna}
            value={monedaDiurnaExterna}
            disabled={diurnaExternaZi.trim() === ""}
            onChange={(e) => {
              setMonedaDiurnaExterna(e.target.value);
            }}
            className={CLASA_CAMP}
          >
            {monede.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-corp mb-2 font-medium">Reguli</legend>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.oreMinime} className="text-corp">
            Minim ore de deplasare pentru o zi de diurnă
          </label>
          <IntrareDurata
            id={id.oreMinime}
            valoare={oreMinime}
            onSchimba={setOreMinime}
            aria-describedby={`${id.oreMinime}-ajutor`}
            className={CLASA_CAMP}
          />
          <p id={`${id.oreMinime}-ajutor`} className={CLASA_AJUTOR}>
            Se numără câte 24 de ore de la plecare. Ce rămâne la final: peste acest prag, zi
            întreagă; sub el, nimic.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.regulaTrecere} className="text-corp">
            Ziua în care se trece granița se plătește după
          </label>
          <select
            id={id.regulaTrecere}
            value={regulaTaraTrecere}
            onChange={(e) => {
              setRegulaTaraTrecere(e.target.value as (typeof REGULI_TRECERE_FRONTIERA)[number]);
            }}
            className={CLASA_CAMP}
          >
            {REGULI_TRECERE_FRONTIERA.map((r) => (
              <option key={r} value={r}>
                {ETICHETE_REGULA_TRECERE[r]}
              </option>
            ))}
          </select>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={id.acordaTrecere}
              type="checkbox"
              checked={acordaZiuaTrecerii}
              onChange={(e) => {
                setAcordaZiuaTrecerii(e.target.checked);
              }}
            />
            <label htmlFor={id.acordaTrecere} className="text-corp">
              Se plătește diurnă în ziua trecerii graniței
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.tarifKm} className="text-corp">
            Mașina personală: {monedaInterna} / km
          </label>
          <input
            id={id.tarifKm}
            type="number"
            min="0"
            step="0.01"
            value={tarifKmAutoPersonal}
            onChange={(e) => {
              setTarifKmAutoPersonal(e.target.value);
            }}
            aria-describedby={`${id.tarifKm}-ajutor`}
            className={CLASA_CAMP}
          />
          <p id={`${id.tarifKm}-ajutor`} className={CLASA_AJUTOR}>
            Lăsați gol dacă firma nu decontează deplasările cu mașina personală.
          </p>
        </div>
      </fieldset>

      {lege === null ? (
        <Callout fel="atentie" titlu="Nu există valori legale pentru această dată">
          Alegeți o dată de la care se aplică politica mai recentă.
        </Callout>
      ) : (
        <Callout fel="informativ" titlu="Stabilite de lege — nu se completează">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Neimpozabil în țară: {formatAmount(lege.multiplu_plafon_neimpozabil)} ×{" "}
              {formatAmount(lege.diurna_baza_legala_interna, "lei")} ={" "}
              <strong>{formatAmount(plafonIntern ?? 0, "lei")} / zi</strong>.
            </li>
            <li>
              Neimpozabil în străinătate: {formatAmount(lege.multiplu_plafon_neimpozabil)} × baremul
              legal al țării.
            </li>
            <li>
              Pe lună, partea neimpozabilă nu poate depăși{" "}
              {formatAmount(lege.plafon_salarii_baza_luna)} salarii de bază.
            </li>
            <li>Ce trece peste plafon se impozitează ca salariu — programul împarte singur.</li>
          </ul>
          <p className="text-nota mt-2">Sursa: {lege.sursa}.</p>
          {pesteplafon === null ? null : (
            <p className="mt-2">
              Din {formatAmount(internaNumar ?? 0, "lei")} pe zi în țară,{" "}
              <strong>{formatAmount(pesteplafon, "lei")}</strong> se impozitează.
            </p>
          )}
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se salvează…" onClick={trimite}>
          Salvează versiunea nouă
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
        {reusit ? (
          <p role="status" className="text-foreground text-corp">
            Versiune salvată. Deplasările plecate de acum înainte se vor calcula cu ea.
          </p>
        ) : null}
      </div>
    </div>
  );
}
