"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import type { BaremTara } from "@/domain/per-diem/sume";
import { MIJLOACE_TRANSPORT } from "@/schemas/per-diem";
import type { PoliticaRand, Tara } from "@/lib/queries/per-diem";

import { creeazaDeplasare } from "../actions";
import { ETICHETE_MIJLOC_TRANSPORT } from "../etichete";
import { PrevizualizareDiurna } from "./previzualizare-diurna";

interface Angajat {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

/**
 * `prefixCale` există pentru portal: aceeași deplasare, dar deschisă apoi în
 * `/portal/diurna-mea/<id>`. Parametrizare, nu copie — calculul de zile și
 * bareme e partea grea, iar două exemplare ale lui ar diverge la primul barem
 * schimbat. `angajati: null` scoate singura diferență de randare: selectorul
 * „pentru angajatul", care în portal n-are sens.
 */
export function FormularDeplasare({
  tari,
  politica,
  baremuri,
  angajati,
  prefixCale = "/diurna",
}: {
  readonly tari: readonly Tara[];
  readonly politica: PoliticaRand;
  readonly baremuri: readonly BaremTara[];
  readonly angajati: readonly Angajat[] | null;
  readonly prefixCale?: string;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [scop, setScop] = useState("");
  const [countryId, setCountryId] = useState(politica.country_id_intern);
  const [localitate, setLocalitate] = useState("");
  const [plecareLa, setPlecareLa] = useState("");
  const [sosireLa, setSosireLa] = useState("");
  const [mijlocTransport, setMijlocTransport] =
    useState<(typeof MIJLOACE_TRANSPORT)[number]>("auto_serviciu");
  const [avansAcordat, setAvansAcordat] = useState("0");
  const [monedaAvans, setMonedaAvans] = useState("");
  const [cursDiurna, setCursDiurna] = useState("");
  const [observatii, setObservatii] = useState("");
  const [detasare, setDetasare] = useState(false);
  const [statGazdaId, setStatGazdaId] = useState("");
  const [salariuMinim, setSalariuMinim] = useState("");
  const [monedaSalariuMinim, setMonedaSalariuMinim] = useState("");

  const id = {
    angajat: useId(),
    scop: useId(),
    tara: useId(),
    localitate: useId(),
    plecare: useId(),
    sosire: useId(),
    mijloc: useId(),
    avans: useId(),
    monedaAvans: useId(),
    curs: useId(),
    observatii: useId(),
    detasare: useId(),
    statGazda: useId(),
    salariuMinim: useId(),
    monedaSalariuMinim: useId(),
  };

  const taraEsteInterna = countryId === politica.country_id_intern;

  function trimite(): void {
    if (scop.trim().length < 3) {
      setEroare("Scopul deplasării trebuie să aibă cel puțin 3 caractere.");
      return;
    }
    if (plecareLa.length === 0 || sosireLa.length === 0) {
      setEroare("Completați data de plecare și data de sosire.");
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaDeplasare({
        employee_id: employeeId.length === 0 ? null : employeeId,
        scop,
        country_id: countryId.length === 0 ? null : countryId,
        localitate: localitate.length === 0 ? null : localitate,
        plecare_la: plecareLa,
        sosire_la: sosireLa,
        mijloc_transport: mijlocTransport,
        km_parcursi: null,
        avans_acordat: avansAcordat.length === 0 ? 0 : Number(avansAcordat),
        moneda_avans: monedaAvans.length === 0 ? null : monedaAvans,
        curs_diurna: cursDiurna.length === 0 ? null : Number(cursDiurna),
        observatii: observatii.length === 0 ? null : observatii,
        detasare_transnationala: detasare,
        stat_gazda_country_id: detasare && statGazdaId.length > 0 ? statGazdaId : null,
        salariu_minim_stat_gazda: detasare && salariuMinim.length > 0 ? Number(salariuMinim) : null,
        moneda_salariu_minim: detasare && monedaSalariuMinim.length > 0 ? monedaSalariuMinim : null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`${prefixCale}/${rezultat.data.id}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <form
        onSubmit={(eveniment) => {
          eveniment.preventDefault();
        }}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {angajati !== null ? (
            <div className="sm:col-span-2">
              <label htmlFor={id.angajat} className="text-corp block font-medium">
                Pentru angajatul
              </label>
              <select
                id={id.angajat}
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                }}
                className={CLASA_CAMP}
              >
                <option value="">Eu însumi</option>
                {angajati.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.marca})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <label htmlFor={id.scop} className="text-corp block font-medium">
              Scopul deplasării *
            </label>
            <input
              id={id.scop}
              type="text"
              required
              maxLength={500}
              value={scop}
              onChange={(e) => {
                setScop(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>

          <div>
            <label htmlFor={id.tara} className="text-corp block font-medium">
              Țara
            </label>
            <select
              id={id.tara}
              value={countryId}
              onChange={(e) => {
                setCountryId(e.target.value);
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

          <div>
            <label htmlFor={id.localitate} className="text-corp block font-medium">
              Localitatea (opțional)
            </label>
            <input
              id={id.localitate}
              type="text"
              maxLength={200}
              value={localitate}
              onChange={(e) => {
                setLocalitate(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>

          <div>
            <label htmlFor={id.plecare} className="text-corp block font-medium">
              Plecarea *
            </label>
            <input
              id={id.plecare}
              type="datetime-local"
              required
              value={plecareLa}
              onChange={(e) => {
                setPlecareLa(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>

          <div>
            <label htmlFor={id.sosire} className="text-corp block font-medium">
              Sosirea *
            </label>
            <input
              id={id.sosire}
              type="datetime-local"
              required
              value={sosireLa}
              onChange={(e) => {
                setSosireLa(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>

          <div>
            <label htmlFor={id.mijloc} className="text-corp block font-medium">
              Mijloc de transport
            </label>
            <select
              id={id.mijloc}
              value={mijlocTransport}
              onChange={(e) => {
                setMijlocTransport(e.target.value as (typeof MIJLOACE_TRANSPORT)[number]);
              }}
              className={CLASA_CAMP}
            >
              {MIJLOACE_TRANSPORT.map((m) => (
                <option key={m} value={m}>
                  {ETICHETE_MIJLOC_TRANSPORT[m]}
                </option>
              ))}
            </select>
          </div>

          {taraEsteInterna ? null : (
            <div>
              <label htmlFor={id.curs} className="text-corp block font-medium">
                Curs valutar diurnă (opțional)
              </label>
              <input
                id={id.curs}
                type="number"
                min="0"
                step="0.000001"
                value={cursDiurna}
                onChange={(e) => {
                  setCursDiurna(e.target.value);
                }}
                className={CLASA_CAMP}
              />
              <p className="text-muted-foreground text-nota mt-1">
                Fără curs, zilele se văd, dar suma în lei rămâne necunoscută.
              </p>
            </div>
          )}

          <div>
            <label htmlFor={id.avans} className="text-corp block font-medium">
              Avans acordat
            </label>
            <input
              id={id.avans}
              type="number"
              min="0"
              step="0.01"
              value={avansAcordat}
              onChange={(e) => {
                setAvansAcordat(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>

          {Number(avansAcordat) > 0 ? (
            <div>
              <label htmlFor={id.monedaAvans} className="text-corp block font-medium">
                Moneda avansului *
              </label>
              <input
                id={id.monedaAvans}
                type="text"
                maxLength={3}
                placeholder="RON"
                value={monedaAvans}
                onChange={(e) => {
                  setMonedaAvans(e.target.value);
                }}
                className={CLASA_CAMP}
              />
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <label htmlFor={id.observatii} className="text-corp block font-medium">
              Observații (opțional)
            </label>
            <textarea
              id={id.observatii}
              rows={2}
              maxLength={2000}
              value={observatii}
              onChange={(e) => {
                setObservatii(e.target.value);
              }}
              className={CLASA_CAMP}
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id={id.detasare}
              type="checkbox"
              checked={detasare}
              onChange={(e) => {
                setDetasare(e.target.checked);
              }}
            />
            <label htmlFor={id.detasare} className="text-corp font-medium">
              Detașare transnațională (Directiva 96/71/CE)
            </label>
          </div>

          {detasare ? (
            <>
              <div>
                <label htmlFor={id.statGazda} className="text-corp block font-medium">
                  Statul gazdă *
                </label>
                <select
                  id={id.statGazda}
                  value={statGazdaId}
                  onChange={(e) => {
                    setStatGazdaId(e.target.value);
                  }}
                  className={CLASA_CAMP}
                >
                  <option value="">Alegeți statul</option>
                  {tari.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.denumire}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={id.salariuMinim} className="text-corp block font-medium">
                  Salariul minim în statul gazdă *
                </label>
                <input
                  id={id.salariuMinim}
                  type="number"
                  min="0"
                  step="0.01"
                  value={salariuMinim}
                  onChange={(e) => {
                    setSalariuMinim(e.target.value);
                  }}
                  className={CLASA_CAMP}
                />
              </div>
              <div>
                <label htmlFor={id.monedaSalariuMinim} className="text-corp block font-medium">
                  Moneda salariului minim *
                </label>
                <input
                  id={id.monedaSalariuMinim}
                  type="text"
                  maxLength={3}
                  value={monedaSalariuMinim}
                  onChange={(e) => {
                    setMonedaSalariuMinim(e.target.value);
                  }}
                  className={CLASA_CAMP}
                />
              </div>
            </>
          ) : null}
        </div>

        <div aria-live="polite">
          {eroare !== null ? (
            <p className="border-danger bg-danger/8 text-danger rounded-control text-corp border p-3">
              {eroare}
            </p>
          ) : null}
        </div>

        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se salvează…" onClick={trimite}>
          Salvează ciorna
        </Buton>
        <p className="text-muted-foreground text-nota">
          Deplasarea se salvează ca ciornă; traseul pe etape și trimiterea spre aprobare se fac pe
          fișa deplasării, după salvare.
        </p>
      </form>

      <aside aria-live="polite" className="border-border bg-surface rounded-panou h-fit border p-4">
        <h2 className="text-corp mb-2 font-semibold">Previzualizare diurnă</h2>
        <PrevizualizareDiurna
          plecareLa={plecareLa}
          sosireLa={sosireLa}
          countryId={countryId.length === 0 ? null : countryId}
          cursDiurna={cursDiurna.length === 0 ? null : Number(cursDiurna)}
          politica={politica}
          baremuri={baremuri}
        />
      </aside>
    </div>
  );
}
