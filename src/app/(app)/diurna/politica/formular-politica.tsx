"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { IntrareData } from "@/components/ui/intrare-data";
import { IntrareDurata } from "@/components/ui/intrare-ora";
import { formatDate } from "@/lib/format/date";
import { formatAmount } from "@/lib/format/money";
import type { ModCalculZile } from "@/domain/per-diem/ferestre";
import type { Tara, ValoriLegaleDiurna } from "@/lib/queries/per-diem";
import { REGULI_TRECERE_FRONTIERA } from "@/schemas/per-diem";

import { creeazaPolitica } from "../actions";
import { ETICHETE_REGULA_TRECERE } from "../etichete";
import { BaremuriTari, type RandBaremAfisat } from "./baremuri-tari";

/** Monedele care apar primele în lista diurnei externe; restul vin din țări. */
const MONEDE_UZUALE = ["EUR", "USD", "GBP", "CHF"] as const;

type Erori = Readonly<Record<string, readonly string[]>>;

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
 *
 * Data poate fi oricât de veche, cât timp există lege încărcată pentru ea și
 * nu începe deja o altă versiune în aceeași zi. Ambele se spun lângă câmp,
 * înainte de trimitere; acțiunea le repetă, tot pe câmp, dacă ajung la bază.
 */
export function FormularPolitica({
  tari,
  valoriLegale,
  baremuri,
  dateOcupate,
}: {
  readonly tari: readonly Tara[];
  readonly valoriLegale: readonly ValoriLegaleDiurna[];
  readonly baremuri: readonly RandBaremAfisat[];
  /** `valabil_de_la` al versiunilor existente — o singură versiune pe zi. */
  readonly dateOcupate: readonly string[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [erori, setErori] = useState<Erori>({});
  const [reusit, setReusit] = useState(false);

  const [denumire, setDenumire] = useState("");
  const [valabilDeLa, setValabilDeLa] = useState("");
  const [countryIdIntern, setCountryIdIntern] = useState(
    tari.find((t) => t.cod_alpha2 === "RO")?.id ?? tari[0]?.id ?? "",
  );
  const [diurnaInternaZi, setDiurnaInternaZi] = useState("");
  const [diurnaExternaZi, setDiurnaExternaZi] = useState("");
  const [monedaDiurnaExterna, setMonedaDiurnaExterna] = useState("EUR");
  const [modCalculZile, setModCalculZile] = useState<ModCalculZile>("zile_calendaristice");
  const [oreMinime, setOreMinime] = useState<number | null>(12);
  const [regulaTaraTrecere, setRegulaTaraTrecere] =
    useState<(typeof REGULI_TRECERE_FRONTIERA)[number]>("tara_sosire");
  const [acordaZiuaTrecerii, setAcordaZiuaTrecerii] = useState(true);
  const [tarifKmAutoPersonal, setTarifKmAutoPersonal] = useState("");

  const monedaInterna = tari.find((t) => t.id === countryIdIntern)?.moneda ?? "RON";
  const monede = useMemo(() => {
    const dinTari = [...new Set(tari.map((t) => t.moneda))].sort();
    return [...new Set<string>([...MONEDE_UZUALE, ...dinTari])];
  }, [tari]);
  const primaZiLegala = useMemo(
    () => [...valoriLegale].map((v) => v.valabil_de_la).sort()[0],
    [valoriLegale],
  );

  const lege = legeaLaData(valoriLegale, valabilDeLa);
  const plafonIntern =
    lege === null ? null : lege.multiplu_plafon_neimpozabil * lege.diurna_baza_legala_interna;
  const internaNumar = diurnaInternaZi.trim() === "" ? null : Number(diurnaInternaZi);
  const pestePlafon =
    plafonIntern !== null && internaNumar !== null && internaNumar > plafonIntern
      ? internaNumar - plafonIntern
      : null;

  /** Scoate eroarea unui câmp în clipa în care omul îl atinge din nou. */
  function curata(camp: string): void {
    setErori((vechi) => {
      if (!(camp in vechi)) return vechi;
      const { [camp]: _, ...rest } = vechi;
      return rest;
    });
  }

  function valideaza(): Erori {
    const gasite: Record<string, string[]> = {};
    if (denumire.trim().length < 2) {
      gasite.denumire = ["Scrieți o denumire de cel puțin 2 caractere."];
    }
    if (valabilDeLa.length === 0) {
      gasite.valabil_de_la = ["Alegeți data de la care se aplică politica (zz.ll.aaaa)."];
    } else if (primaZiLegala !== undefined && valabilDeLa < primaZiLegala) {
      gasite.valabil_de_la = [
        `Valorile legale ale diurnei sunt încărcate de la ${formatDate(primaZiLegala)}. Alegeți o dată de atunci încoace.`,
      ];
    } else if (dateOcupate.includes(valabilDeLa)) {
      gasite.valabil_de_la = [
        `Există deja o versiune care începe la ${formatDate(valabilDeLa)}. Alegeți altă zi.`,
      ];
    }
    if (diurnaInternaZi.trim() === "") {
      gasite.diurna_interna_zi = ["Completați suma pe zi pentru deplasările în țară."];
    }
    if (oreMinime === null) {
      gasite.ore_minime = ["Completați numărul minim de ore, ex. 12:00."];
    }
    return gasite;
  }

  function trimite(): void {
    setReusit(false);
    const gasite = valideaza();
    setErori(gasite);
    if (Object.keys(gasite).length > 0) {
      setEroare("Corectați câmpurile marcate.");
      return;
    }
    setEroare(null);
    const externa = diurnaExternaZi.trim() === "" ? null : Number(diurnaExternaZi);
    porneste(async () => {
      const rezultat = await creeazaPolitica({
        denumire,
        country_id_intern: countryIdIntern,
        moneda_interna: monedaInterna,
        diurna_interna_zi: Number(diurnaInternaZi),
        diurna_externa_zi: externa,
        moneda_diurna_externa: externa === null ? null : monedaDiurnaExterna,
        mod_calcul_zile: modCalculZile,
        ore_minime: oreMinime ?? 0,
        acorda_diurna_ziua_trecerii: acordaZiuaTrecerii,
        regula_tara_trecere: regulaTaraTrecere,
        tarif_km_auto_personal: tarifKmAutoPersonal.trim() === "" ? 0 : Number(tarifKmAutoPersonal),
        valabil_de_la: valabilDeLa,
        observatii: null,
      });
      if (!rezultat.ok) {
        setErori(rezultat.error.fieldErrors ?? {});
        setEroare(
          rezultat.error.fieldErrors === null
            ? rezultat.error.message
            : "Corectați câmpurile marcate.",
        );
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
        <Camp nume="denumire" eticheta="Denumire" erori={erori["denumire"] ?? []}>
          {(a) => (
            <input
              {...a}
              type="text"
              maxLength={200}
              placeholder="ex. Politica de diurnă 2026"
              value={denumire}
              onChange={(e) => {
                setDenumire(e.target.value);
                curata("denumire");
              }}
            />
          )}
        </Camp>

        <Camp nume="valabil_de_la" eticheta="Valabilă de la" erori={erori["valabil_de_la"] ?? []}>
          {(a) => (
            <IntrareData
              {...a}
              valoare={valabilDeLa}
              min={primaZiLegala}
              onSchimba={(zi) => {
                setValabilDeLa(zi);
                curata("valabil_de_la");
              }}
            />
          )}
        </Camp>

        <Camp nume="country_id_intern" eticheta="Țara firmei" fel="select">
          {(a) => (
            <select
              {...a}
              value={countryIdIntern}
              onChange={(e) => {
                setCountryIdIntern(e.target.value);
              }}
            >
              {tari.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.denumire}
                </option>
              ))}
            </select>
          )}
        </Camp>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-corp mb-2 font-medium">Cât plătește firma</legend>

        <Camp
          nume="diurna_interna_zi"
          eticheta={`Diurnă în țară / zi (${monedaInterna})`}
          erori={erori["diurna_interna_zi"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min="0"
              step="0.01"
              value={diurnaInternaZi}
              onChange={(e) => {
                setDiurnaInternaZi(e.target.value);
                curata("diurna_interna_zi");
              }}
            />
          )}
        </Camp>

        <div>
          <Camp
            nume="diurna_externa_zi"
            eticheta="Diurnă în străinătate / zi"
            erori={erori["diurna_externa_zi"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="0.01"
                value={diurnaExternaZi}
                onChange={(e) => {
                  setDiurnaExternaZi(e.target.value);
                  curata("diurna_externa_zi");
                }}
              />
            )}
          </Camp>
          <p className="text-muted-foreground text-nota mt-1">
            Lăsați gol ca să se plătească{" "}
            <BaremuriTari baremuri={baremuri} multiplu={lege?.multiplu_plafon_neimpozabil ?? null}>
              baremul legal al fiecărei țări
            </BaremuriTari>
            .
          </p>
        </div>

        <Camp
          nume="moneda_diurna_externa"
          eticheta="Moneda diurnei în străinătate"
          fel="select"
          erori={erori["moneda_diurna_externa"] ?? []}
        >
          {(a) => (
            <select
              {...a}
              value={monedaDiurnaExterna}
              disabled={diurnaExternaZi.trim() === ""}
              onChange={(e) => {
                setMonedaDiurnaExterna(e.target.value);
                curata("moneda_diurna_externa");
              }}
            >
              {monede.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </Camp>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-corp mb-2 font-medium">Reguli</legend>

        <Camp
          nume="mod_calcul_zile"
          eticheta="Cum se numără zilele"
          fel="select"
          ajutor={
            modCalculZile === "zile_calendaristice"
              ? "Fiecare zi din calendar în care omul e pe drum — inclusiv ziua plecării și a întoarcerii — se plătește întreagă."
              : "Câte 24 de ore de la ora plecării. Ce rămâne la final se plătește doar dacă trece de pragul de ore."
          }
        >
          {(a) => (
            <select
              {...a}
              value={modCalculZile}
              onChange={(e) => {
                setModCalculZile(e.target.value as ModCalculZile);
              }}
            >
              <option value="zile_calendaristice">Pe zile din calendar</option>
              <option value="ferestre_24h">Pe câte 24 de ore de la plecare</option>
            </select>
          )}
        </Camp>

        <Camp
          nume="ore_minime"
          eticheta={
            modCalculZile === "zile_calendaristice"
              ? "Deplasare minimă, în ore"
              : "Minim ore de deplasare pentru o zi de diurnă"
          }
          ajutor={
            modCalculZile === "zile_calendaristice"
              ? "O deplasare mai scurtă de atât, în total, nu primește diurnă."
              : "Se numără câte 24 de ore de la plecare. Ce rămâne la final: peste acest prag, zi întreagă; sub el, nimic."
          }
          erori={erori["ore_minime"] ?? []}
        >
          {(a) => (
            <IntrareDurata
              {...a}
              placeholder="12:00"
              valoare={oreMinime}
              onSchimba={(ore) => {
                setOreMinime(ore);
                curata("ore_minime");
              }}
            />
          )}
        </Camp>

        <div>
          <Camp
            nume="regula_tara_trecere"
            eticheta="Ziua în care se trece granița se plătește după"
            fel="select"
          >
            {(a) => (
              <select
                {...a}
                value={regulaTaraTrecere}
                onChange={(e) => {
                  setRegulaTaraTrecere(e.target.value as (typeof REGULI_TRECERE_FRONTIERA)[number]);
                }}
              >
                {REGULI_TRECERE_FRONTIERA.map((r) => (
                  <option key={r} value={r}>
                    {ETICHETE_REGULA_TRECERE[r]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <label className="text-corp mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              className={clasaBifa}
              checked={acordaZiuaTrecerii}
              onChange={(e) => {
                setAcordaZiuaTrecerii(e.target.checked);
              }}
            />
            Se plătește diurnă în ziua trecerii graniței
          </label>
        </div>

        <Camp
          nume="tarif_km_auto_personal"
          eticheta={`Mașina personală: ${monedaInterna} / km`}
          ajutor="Lăsați gol dacă firma nu decontează deplasările cu mașina personală."
          erori={erori["tarif_km_auto_personal"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min="0"
              step="0.01"
              value={tarifKmAutoPersonal}
              onChange={(e) => {
                setTarifKmAutoPersonal(e.target.value);
                curata("tarif_km_auto_personal");
              }}
            />
          )}
        </Camp>
      </fieldset>

      {lege === null ? null : (
        <Callout fel="informativ" titlu="Stabilite de lege — nu se completează">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Neimpozabil în țară: {formatAmount(lege.multiplu_plafon_neimpozabil)} ×{" "}
              {formatAmount(lege.diurna_baza_legala_interna, "lei")} ={" "}
              <strong>{formatAmount(plafonIntern ?? 0, "lei")} / zi</strong>.
            </li>
            <li>
              Neimpozabil în străinătate: {formatAmount(lege.multiplu_plafon_neimpozabil)} ×{" "}
              <BaremuriTari baremuri={baremuri} multiplu={lege.multiplu_plafon_neimpozabil}>
                baremul legal al țării
              </BaremuriTari>
              .
            </li>
            <li>
              Pe lună, partea neimpozabilă nu poate depăși{" "}
              {formatAmount(lege.plafon_salarii_baza_luna)} salarii de bază.
            </li>
            <li>Ce trece peste plafon se impozitează ca salariu — programul împarte singur.</li>
          </ul>
          <p className="text-nota mt-2">Sursa: {lege.sursa}.</p>
          {pestePlafon === null ? null : (
            <p className="mt-2">
              Din {formatAmount(internaNumar ?? 0, "lei")} pe zi în țară,{" "}
              <strong>{formatAmount(pestePlafon, "lei")}</strong> se impozitează.
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
            Versiune salvată. Deplasările plecate de la {formatDate(valabilDeLa)} încolo se
            calculează cu ea.
          </p>
        ) : null}
      </div>
    </div>
  );
}
