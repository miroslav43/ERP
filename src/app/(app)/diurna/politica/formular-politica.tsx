"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Tara } from "@/lib/queries/per-diem";
import { REGULI_TRECERE_FRONTIERA } from "@/schemas/per-diem";

import { creeazaPolitica } from "../actions";
import { ETICHETE_REGULA_TRECERE } from "../etichete";

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900";

/**
 * O versiune NOUĂ de politică — niciodată o editare a celei vechi. Politica e
 * versionată prin `valabil_de_la`, exact ca baremul pe țări: deplasările deja
 * calculate rămân legate de regulile de la momentul lor.
 */
export function FormularPolitica({ tari }: { readonly tari: readonly Tara[] }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusit, setReusit] = useState(false);

  const [denumire, setDenumire] = useState("");
  const [countryIdIntern, setCountryIdIntern] = useState(tari[0]?.id ?? "");
  const [monedaInterna, setMonedaInterna] = useState("RON");
  const [diurnaInternaZi, setDiurnaInternaZi] = useState("");
  const [diurnaBazaLegalaInterna, setDiurnaBazaLegalaInterna] = useState("");
  const [multiploPlafonNeimpozabil, setMultiploPlafonNeimpozabil] = useState("2.5");
  const [multiploDiurnaExterna, setMultiploDiurnaExterna] = useState("1");
  const [categorieBarem, setCategorieBarem] = useState<"I" | "II">("II");
  const [pragOreMinim, setPragOreMinim] = useState("12");
  const [pragOreZiIntreaga, setPragOreZiIntreaga] = useState("24");
  const [fractiuneZiPartiala, setFractiuneZiPartiala] = useState("0.5");
  const [acordaZiuaTrecerii, setAcordaZiuaTrecerii] = useState(true);
  const [regulaTaraTrecere, setRegulaTaraTrecere] = useState<(typeof REGULI_TRECERE_FRONTIERA)[number]>("tara_sosire");
  const [tarifKmAutoPersonal, setTarifKmAutoPersonal] = useState("");
  const [monedaTarifKm, setMonedaTarifKm] = useState("RON");
  const [plafonSalariiBazaLuna, setPlafonSalariiBazaLuna] = useState("3");
  const [valabilDeLa, setValabilDeLa] = useState("");

  const id = {
    denumire: useId(),
    tara: useId(),
    monedaInterna: useId(),
    diurnaInternaZi: useId(),
    diurnaBazaLegalaInterna: useId(),
    multiploPlafon: useId(),
    multiploExterna: useId(),
    categorie: useId(),
    pragMinim: useId(),
    pragZiIntreaga: useId(),
    fractiune: useId(),
    acordaTrecere: useId(),
    regulaTrecere: useId(),
    tarifKm: useId(),
    monedaTarifKm: useId(),
    plafonSalarii: useId(),
    valabilDeLa: useId(),
  };

  function trimite(): void {
    if (denumire.trim().length < 2) {
      setEroare("Denumirea politicii trebuie să aibă cel puțin 2 caractere.");
      return;
    }
    if (valabilDeLa.length === 0) {
      setEroare("Data de la care se aplică politica este obligatorie.");
      return;
    }
    setEroare(null);
    setReusit(false);
    porneste(async () => {
      const rezultat = await creeazaPolitica({
        denumire,
        country_id_intern: countryIdIntern,
        moneda_interna: monedaInterna,
        diurna_interna_zi: Number(diurnaInternaZi),
        diurna_baza_legala_interna: Number(diurnaBazaLegalaInterna),
        multiplu_plafon_neimpozabil: Number(multiploPlafonNeimpozabil),
        multiplu_diurna_externa: Number(multiploDiurnaExterna),
        categorie_barem: categorieBarem,
        prag_ore_minim: Number(pragOreMinim),
        prag_ore_zi_intreaga: Number(pragOreZiIntreaga),
        fractiune_zi_partiala: Number(fractiuneZiPartiala),
        acorda_diurna_ziua_trecerii: acordaZiuaTrecerii,
        regula_tara_trecere: regulaTaraTrecere,
        tarif_km_auto_personal: Number(tarifKmAutoPersonal),
        moneda_tarif_km: monedaTarifKm,
        plafon_salarii_baza_luna: Number(plafonSalariiBazaLuna),
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
    <div className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800">
      <p className="text-sm font-medium sm:col-span-2 lg:col-span-3">O versiune nouă de politică</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.denumire} className="text-sm">Denumire</label>
        <input id={id.denumire} type="text" maxLength={200} value={denumire} onChange={(e) => { setDenumire(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.valabilDeLa} className="text-sm">Valabilă de la</label>
        <input id={id.valabilDeLa} type="date" value={valabilDeLa} onChange={(e) => { setValabilDeLa(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.tara} className="text-sm">Țara internă</label>
        <select id={id.tara} value={countryIdIntern} onChange={(e) => { setCountryIdIntern(e.target.value); }} className={CLASA_CAMP}>
          {tari.map((t) => (
            <option key={t.id} value={t.id}>{t.denumire}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.monedaInterna} className="text-sm">Moneda internă</label>
        <input id={id.monedaInterna} type="text" maxLength={3} value={monedaInterna} onChange={(e) => { setMonedaInterna(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.diurnaInternaZi} className="text-sm">Diurnă internă / zi</label>
        <input id={id.diurnaInternaZi} type="number" min="0" step="0.01" value={diurnaInternaZi} onChange={(e) => { setDiurnaInternaZi(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.diurnaBazaLegalaInterna} className="text-sm">Diurnă legală de bază (plafon)</label>
        <input id={id.diurnaBazaLegalaInterna} type="number" min="0" step="0.01" value={diurnaBazaLegalaInterna} onChange={(e) => { setDiurnaBazaLegalaInterna(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.multiploPlafon} className="text-sm">Multiplu plafon neimpozabil</label>
        <input id={id.multiploPlafon} type="number" min="1" step="0.1" value={multiploPlafonNeimpozabil} onChange={(e) => { setMultiploPlafonNeimpozabil(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.multiploExterna} className="text-sm">Multiplu diurnă externă</label>
        <input id={id.multiploExterna} type="number" min="0" step="0.1" value={multiploDiurnaExterna} onChange={(e) => { setMultiploDiurnaExterna(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.categorie} className="text-sm">Categorie barem</label>
        <select id={id.categorie} value={categorieBarem} onChange={(e) => { setCategorieBarem(e.target.value as "I" | "II"); }} className={CLASA_CAMP}>
          <option value="II">II — restul personalului</option>
          <option value="I">I — conducere / demnitari</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.pragMinim} className="text-sm">Prag ore minim</label>
        <input id={id.pragMinim} type="number" min="0" step="0.5" value={pragOreMinim} onChange={(e) => { setPragOreMinim(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.pragZiIntreaga} className="text-sm">Prag ore zi întreagă</label>
        <input id={id.pragZiIntreaga} type="number" min="0" max="24" step="0.5" value={pragOreZiIntreaga} onChange={(e) => { setPragOreZiIntreaga(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.fractiune} className="text-sm">Fracțiune zi parțială</label>
        <input id={id.fractiune} type="number" min="0" max="1" step="0.1" value={fractiuneZiPartiala} onChange={(e) => { setFractiuneZiPartiala(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.regulaTrecere} className="text-sm">Regula de trecere a frontierei</label>
        <select id={id.regulaTrecere} value={regulaTaraTrecere} onChange={(e) => { setRegulaTaraTrecere(e.target.value as (typeof REGULI_TRECERE_FRONTIERA)[number]); }} className={CLASA_CAMP}>
          {REGULI_TRECERE_FRONTIERA.map((r) => (
            <option key={r} value={r}>{ETICHETE_REGULA_TRECERE[r]}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input id={id.acordaTrecere} type="checkbox" checked={acordaZiuaTrecerii} onChange={(e) => { setAcordaZiuaTrecerii(e.target.checked); }} />
        <label htmlFor={id.acordaTrecere} className="text-sm">Acordă diurnă în ziua trecerii</label>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.tarifKm} className="text-sm">Tarif km auto personal</label>
        <input id={id.tarifKm} type="number" min="0" step="0.01" value={tarifKmAutoPersonal} onChange={(e) => { setTarifKmAutoPersonal(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.monedaTarifKm} className="text-sm">Moneda tarifului km</label>
        <input id={id.monedaTarifKm} type="text" maxLength={3} value={monedaTarifKm} onChange={(e) => { setMonedaTarifKm(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.plafonSalarii} className="text-sm">Plafon salarii bază / lună</label>
        <input id={id.plafonSalarii} type="number" min="0" step="0.1" value={plafonSalariiBazaLuna} onChange={(e) => { setPlafonSalariiBazaLuna(e.target.value); }} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          disabled={inCurs}
          onClick={trimite}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {inCurs ? "Se salvează…" : "Salvează versiunea nouă"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">{eroare}</p>
        )}
        {reusit ? (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            Versiune salvată. Deplasările plecate de acum înainte se vor calcula cu ea.
          </p>
        ) : null}
      </div>
    </div>
  );
}
