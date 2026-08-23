"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";
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

type DeplasareCreata = Readonly<{ id: string }>;

/**
 * Refuz construit în client, în forma exactă a unui `ActionResult`, ca mesajul
 * să meargă pe aceeași cale ca al serverului și să ajungă lângă câmp, nu sub
 * buton.
 *
 * Există doar unde schema Zod n-are mesaj propriu în română: `plecare_la` și
 * `sosire_la` sunt `z.iso.datetime({ local: true })`, iar un câmp gol întoarce
 * textul implicit al lui Zod, în engleză. Schema e un contract cu acțiunea și
 * nu se atinge de aici — deci golul se prinde înainte de drumul la server.
 */
function refuzDeClient(
  fieldErrors: Readonly<Record<string, readonly string[]>>,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "client",
    },
  };
}

/**
 * Gol ⇒ `null`, nu șirul vid.
 *
 * Pentru `curs_diurna`, `salariu_minim_stat_gazda` și cele două monede,
 * diferența e vizibilă: `z.coerce.number()` transformă `""` în 0, iar un curs
 * de 0 pică apoi pe intervalul acceptat cu un mesaj despre limite, în loc să
 * fie tratat drept „necompletat”. Regexul monedei ar refuza la fel șirul vid,
 * ascunzând regula reală — moneda e obligatorie doar dacă există avans.
 */
function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = String(date.get(cheie) ?? "").trim();
  return valoare.length === 0 ? null : valoare;
}

/**
 * Numele din `FormData` sunt EXACT cheile lui `deplasareNouaSchema`
 * (`src/schemas/per-diem.ts`): `employee_id`, `scop`, `country_id`,
 * `localitate`, `plecare_la`, `sosire_la`, `mijloc_transport`, `avans_acordat`,
 * `moneda_avans`, `curs_diurna`, `observatii`, `detasare_transnationala`,
 * `stat_gazda_country_id`, `salariu_minim_stat_gazda`, `moneda_salariu_minim`.
 * Fără potrivirea asta, `fieldErrors` întors de acțiune n-ar mai găsi niciun
 * câmp, iar mesajul ar dispărea în tăcere.
 *
 * `km_parcursi` există în schemă, dar nu și pe ecran: kilometrii se completează
 * pe fișa deplasării, din foaia de parcurs.
 */
async function trimiteDeplasarea(date: FormData): Promise<ActionResult<DeplasareCreata>> {
  const plecareLa = String(date.get("plecare_la") ?? "").trim();
  const sosireLa = String(date.get("sosire_la") ?? "").trim();
  const lipsa: Record<string, readonly string[]> = {};
  if (plecareLa.length === 0) lipsa["plecare_la"] = ["Completați data plecării."];
  if (sosireLa.length === 0) lipsa["sosire_la"] = ["Completați data sosirii."];
  if (Object.keys(lipsa).length > 0) return refuzDeClient(lipsa);

  return creeazaDeplasare({
    employee_id: textSauNull(date, "employee_id"),
    scop: String(date.get("scop") ?? ""),
    country_id: textSauNull(date, "country_id"),
    localitate: textSauNull(date, "localitate"),
    plecare_la: plecareLa,
    sosire_la: sosireLa,
    mijloc_transport: String(date.get("mijloc_transport") ?? ""),
    km_parcursi: null,
    avans_acordat: String(date.get("avans_acordat") ?? ""),
    moneda_avans: textSauNull(date, "moneda_avans"),
    curs_diurna: textSauNull(date, "curs_diurna"),
    observatii: textSauNull(date, "observatii"),
    // Bifa nebifată nu apare deloc în `FormData`; absența ei ESTE răspunsul.
    detasare_transnationala: date.get("detasare_transnationala") !== null,
    stat_gazda_country_id: textSauNull(date, "stat_gazda_country_id"),
    salariu_minim_stat_gazda: textSauNull(date, "salariu_minim_stat_gazda"),
    moneda_salariu_minim: textSauNull(date, "moneda_salariu_minim"),
  });
}

/**
 * `prefixCale` există pentru portal: aceeași deplasare, dar deschisă apoi în
 * `/portal/diurna-mea/<id>`. Parametrizare, nu copie — calculul de zile și
 * bareme e partea grea, iar două exemplare ale lui ar diverge la primul barem
 * schimbat. `angajati: null` scoate singura diferență de randare: selectorul
 * „pentru angajatul”, care în portal n-are sens.
 *
 * Câmpurile care hrănesc previzualizarea din dreapta sau deschid alte câmpuri
 * (țara, datele, cursul, avansul, detașarea) rămân CONTROLATE: starea lor
 * supraviețuiește oricum unei erori de validare. Restul sunt necontrolate și
 * își reiau valoarea din `stare.valoriTrimise`.
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
  const idDetasare = useId();

  const [countryId, setCountryId] = useState(politica.country_id_intern);
  const [plecareLa, setPlecareLa] = useState("");
  const [sosireLa, setSosireLa] = useState("");
  const [avansAcordat, setAvansAcordat] = useState("0");
  const [cursDiurna, setCursDiurna] = useState("");
  const [detasare, setDetasare] = useState(false);

  const taraEsteInterna = countryId === politica.country_id_intern;

  const laReusita = useCallback(
    (deplasare: Readonly<{ id: string }>) => {
      router.push(`${prefixCale}/${deplasare.id}`);
    },
    [router, prefixCale],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Formular
        actiune={trimiteDeplasarea}
        laReusita={laReusita}
        mesajReusita="Deplasarea a fost salvată ca ciornă."
      >
        {(stare) => (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {angajati !== null ? (
                <Camp
                  nume="employee_id"
                  eticheta="Pentru angajatul"
                  fel="select"
                  className="sm:col-span-2"
                  erori={stare.erori["employee_id"] ?? []}
                >
                  {(a) => (
                    <select {...a} defaultValue={stare.valoriTrimise["employee_id"] ?? ""}>
                      <option value="">Eu însumi</option>
                      {angajati.map((ang) => (
                        <option key={ang.id} value={ang.id}>
                          {ang.full_name} ({ang.marca})
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>
              ) : null}

              <Camp
                nume="scop"
                eticheta="Scopul deplasării"
                obligatoriu
                className="sm:col-span-2"
                erori={stare.erori["scop"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={500}
                    defaultValue={stare.valoriTrimise["scop"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="country_id"
                eticheta="Țara"
                fel="select"
                erori={stare.erori["country_id"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={countryId}
                    onChange={(e) => {
                      setCountryId(e.target.value);
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

              <Camp
                nume="localitate"
                eticheta="Localitatea (opțional)"
                erori={stare.erori["localitate"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={200}
                    defaultValue={stare.valoriTrimise["localitate"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="plecare_la"
                eticheta="Plecarea"
                obligatoriu
                erori={stare.erori["plecare_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="datetime-local"
                    value={plecareLa}
                    onChange={(e) => {
                      setPlecareLa(e.target.value);
                    }}
                  />
                )}
              </Camp>

              <Camp
                nume="sosire_la"
                eticheta="Sosirea"
                obligatoriu
                erori={stare.erori["sosire_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="datetime-local"
                    value={sosireLa}
                    onChange={(e) => {
                      setSosireLa(e.target.value);
                    }}
                  />
                )}
              </Camp>

              <Camp
                nume="mijloc_transport"
                eticheta="Mijloc de transport"
                fel="select"
                erori={stare.erori["mijloc_transport"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={stare.valoriTrimise["mijloc_transport"] ?? "auto_serviciu"}
                  >
                    {MIJLOACE_TRANSPORT.map((m) => (
                      <option key={m} value={m}>
                        {ETICHETE_MIJLOC_TRANSPORT[m]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {taraEsteInterna ? null : (
                <Camp
                  nume="curs_diurna"
                  eticheta="Curs valutar diurnă (opțional)"
                  ajutor="Fără curs, zilele se văd, dar suma în lei rămâne necunoscută."
                  erori={stare.erori["curs_diurna"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="number"
                      min="0"
                      step="0.000001"
                      value={cursDiurna}
                      onChange={(e) => {
                        setCursDiurna(e.target.value);
                      }}
                    />
                  )}
                </Camp>
              )}

              <Camp
                nume="avans_acordat"
                eticheta="Avans acordat"
                erori={stare.erori["avans_acordat"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    value={avansAcordat}
                    onChange={(e) => {
                      setAvansAcordat(e.target.value);
                    }}
                  />
                )}
              </Camp>

              {Number(avansAcordat) > 0 ? (
                <Camp
                  nume="moneda_avans"
                  eticheta="Moneda avansului"
                  obligatoriu
                  erori={stare.erori["moneda_avans"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={3}
                      placeholder="RON"
                      defaultValue={stare.valoriTrimise["moneda_avans"] ?? ""}
                    />
                  )}
                </Camp>
              ) : null}

              <Camp
                nume="observatii"
                eticheta="Observații (opțional)"
                fel="textarea"
                className="sm:col-span-2"
                erori={stare.erori["observatii"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={2000}
                    defaultValue={stare.valoriTrimise["observatii"] ?? ""}
                  />
                )}
              </Camp>

              {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                  controlului, iar la o casetă de bifat eticheta stă după —
                  altfel ținta de atingere se rupe în două și rândul se citește
                  invers. */}
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id={idDetasare}
                  name="detasare_transnationala"
                  type="checkbox"
                  checked={detasare}
                  onChange={(e) => {
                    setDetasare(e.target.checked);
                  }}
                  className={clasaBifa}
                />
                <label htmlFor={idDetasare} className="text-corp font-medium">
                  Detașare transnațională (Directiva 96/71/CE)
                </label>
              </div>

              {detasare ? (
                <>
                  <Camp
                    nume="stat_gazda_country_id"
                    eticheta="Statul gazdă"
                    fel="select"
                    obligatoriu
                    erori={stare.erori["stat_gazda_country_id"] ?? []}
                  >
                    {(a) => (
                      <select
                        {...a}
                        defaultValue={stare.valoriTrimise["stat_gazda_country_id"] ?? ""}
                      >
                        <option value="">Alegeți statul</option>
                        {tari.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.denumire}
                          </option>
                        ))}
                      </select>
                    )}
                  </Camp>

                  <Camp
                    nume="salariu_minim_stat_gazda"
                    eticheta="Salariul minim în statul gazdă"
                    obligatoriu
                    erori={stare.erori["salariu_minim_stat_gazda"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={stare.valoriTrimise["salariu_minim_stat_gazda"] ?? ""}
                      />
                    )}
                  </Camp>

                  <Camp
                    nume="moneda_salariu_minim"
                    eticheta="Moneda salariului minim"
                    obligatoriu
                    erori={stare.erori["moneda_salariu_minim"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="text"
                        maxLength={3}
                        defaultValue={stare.valoriTrimise["moneda_salariu_minim"] ?? ""}
                      />
                    )}
                  </Camp>
                </>
              ) : null}
            </div>

            <div>
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Salvează ciorna
              </Buton>
            </div>
            <p className="text-muted-foreground text-nota">
              Deplasarea se salvează ca ciornă; traseul pe etape și trimiterea spre aprobare se fac
              pe fișa deplasării, după salvare.
            </p>
          </>
        )}
      </Formular>

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
