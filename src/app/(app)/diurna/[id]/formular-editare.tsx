"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";
import type { Deplasare, Tara } from "@/lib/queries/per-diem";
import { MIJLOACE_TRANSPORT } from "@/schemas/per-diem";

import { actualizeazaDeplasare } from "../actions";
import { ETICHETE_MIJLOC_TRANSPORT } from "../etichete";

type DeplasareSalvata = Readonly<{ id: string }>;

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = String(date.get(cheie) ?? "").trim();
  return valoare.length === 0 ? null : valoare;
}

/**
 * Corectarea unei deplasări deja salvate, cât timp e ciornă sau a fost
 * respinsă.
 *
 * ── DE CE EXISTĂ ECRANUL ──────────────────────────────────────────────────
 * Până acum modulul avea opt Server Actions și niciuna nu scria un câmp al
 * deplasării: o oră greșită la plecare se repara ștergând ciorna și
 * rescriind-o din zero, cu tot cu etape și cheltuieli. O deplasare RESPINSĂ
 * era și mai rău: nu se putea nici șterge (`stergeCiornaDeplasare` cere
 * `status = 'ciorna'`), deci rămânea blocată în starea „respinsă” pentru
 * totdeauna, deși politica `business_trips_update` din 0015 permite explicit
 * scrierea în „ciorna” și „respinsa”.
 *
 * ── DE CE VALORILE DE TIMP SE TAIE DIN ȘIR, NU SE FORMATEAZĂ ──────────────
 * `plecare_la` e `timestamptz`; PostgREST îl întoarce în fusul SESIUNII, cu
 * decalajul scris în coadă („…T12:30:00+00:00”). Un `<input type="datetime-local">`
 * trimite înapoi un moment FĂRĂ fus, pe care Postgres îl citește în același fus
 * al sesiunii. Primele 16 caractere ale șirului întors sunt deci exact valoarea
 * care, retrimisă neatinsă, reproduce momentul stocat.
 *
 * Trecerea prin `formatDateTime` (ora României) ar fi rupt asta: pe o sesiune
 * în UTC, o simplă deschidere și salvare a formularului ar fi mutat deplasarea
 * cu trei ore, fără ca nimeni să atingă câmpul. Diferența dintre ora scrisă și
 * ora afișată pe fișă e o problemă reală, dar e a fusului sesiunii, nu a
 * acestui ecran — și nu se repară mutând tăcut datele oamenilor.
 */
export function FormularEditareDeplasare({
  deplasare,
  tari,
}: {
  readonly deplasare: Deplasare;
  readonly tari: readonly Tara[];
}) {
  const router = useRouter();
  const idDetasare = useId();

  const [avansAcordat, setAvansAcordat] = useState(String(deplasare.avans_acordat));
  const [detasare, setDetasare] = useState(deplasare.detasare_transnationala);

  const trimite = useCallback(
    async (date: FormData): Promise<ActionResult<DeplasareSalvata>> => {
      return actualizeazaDeplasare({
        id: deplasare.id,
        // Proprietarul nu se schimbă dintr-un formular de corectură; acțiunea
        // îl ignoră oricum, dar schema (aceeași cu cea de creare) îl cere.
        employee_id: null,
        scop: String(date.get("scop") ?? ""),
        country_id: textSauNull(date, "country_id"),
        localitate: textSauNull(date, "localitate"),
        plecare_la: String(date.get("plecare_la") ?? "").trim(),
        sosire_la: String(date.get("sosire_la") ?? "").trim(),
        mijloc_transport: String(date.get("mijloc_transport") ?? ""),
        km_parcursi: textSauNull(date, "km_parcursi"),
        avans_acordat: String(date.get("avans_acordat") ?? "0"),
        moneda_avans: textSauNull(date, "moneda_avans"),
        curs_diurna: textSauNull(date, "curs_diurna"),
        observatii: textSauNull(date, "observatii"),
        detasare_transnationala: date.get("detasare_transnationala") !== null,
        stat_gazda_country_id: textSauNull(date, "stat_gazda_country_id"),
        salariu_minim_stat_gazda: textSauNull(date, "salariu_minim_stat_gazda"),
        moneda_salariu_minim: textSauNull(date, "moneda_salariu_minim"),
      });
    },
    [deplasare.id],
  );

  const laReusita = useCallback(() => {
    router.push(`/diurna/${deplasare.id}`);
  }, [router, deplasare.id]);

  return (
    <Formular actiune={trimite} laReusita={laReusita} mesajReusita="Deplasarea a fost corectată.">
      {(stare) => {
        /** Valoarea trimisă ultima dată, dacă a fost refuzată; altfel cea din bază. */
        const v = (cheie: string, dinBaza: string): string => stare.valoriTrimise[cheie] ?? dinBaza;

        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    defaultValue={v("scop", deplasare.scop)}
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
                  <select {...a} defaultValue={v("country_id", deplasare.country_id ?? "")}>
                    <option value="">Nespecificată</option>
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
                    defaultValue={v("localitate", deplasare.localitate ?? "")}
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
                    defaultValue={v("plecare_la", deplasare.plecare_la.slice(0, 16))}
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
                    defaultValue={v("sosire_la", deplasare.sosire_la.slice(0, 16))}
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
                  <select {...a} defaultValue={v("mijloc_transport", deplasare.mijloc_transport)}>
                    {MIJLOACE_TRANSPORT.map((m) => (
                      <option key={m} value={m}>
                        {ETICHETE_MIJLOC_TRANSPORT[m]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {/* Câmpul lipsea din formularul de creare, deși fișa îl AFIȘEAZĂ
                  („Kilometri parcurși”) și politica cere un tarif pe kilometru:
                  o coloană randată pe care nimic nu o putea scrie vreodată. */}
              <Camp
                nume="km_parcursi"
                eticheta="Kilometri parcurși (opțional)"
                ajutor="Se completează pentru auto personal, din foaia de parcurs."
                erori={stare.erori["km_parcursi"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={v(
                      "km_parcursi",
                      deplasare.km_parcursi === null ? "" : String(deplasare.km_parcursi),
                    )}
                  />
                )}
              </Camp>

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
                    defaultValue={v(
                      "curs_diurna",
                      deplasare.curs_diurna === null ? "" : String(deplasare.curs_diurna),
                    )}
                  />
                )}
              </Camp>

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
                      defaultValue={v("moneda_avans", deplasare.moneda_avans ?? "")}
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
                    defaultValue={v("observatii", deplasare.observatii ?? "")}
                  />
                )}
              </Camp>

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
                        defaultValue={v(
                          "stat_gazda_country_id",
                          deplasare.stat_gazda_country_id ?? "",
                        )}
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
                        defaultValue={v(
                          "salariu_minim_stat_gazda",
                          deplasare.salariu_minim_stat_gazda === null
                            ? ""
                            : String(deplasare.salariu_minim_stat_gazda),
                        )}
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
                        defaultValue={v(
                          "moneda_salariu_minim",
                          deplasare.moneda_salariu_minim ?? "",
                        )}
                      />
                    )}
                  </Camp>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Salvează corecturile
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
