"use client";

// src/app/(app)/flota/[id]/iesire/dialog-iesire.tsx
//
// Asistentul „Scoate din parc” (0218, F12h). Un singur INSERT face tot:
// alocarea se încheie la data ieșirii, vehiculul iese din semafor, termenele
// apar pe fișă. Câmpurile apar după felul ieșirii; descrierea termenelor e
// statică (Decizia 9): cele reale le calculează baza, o singură dată.
import { useState } from "react";
import type { ReactElement } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { FormularDialog } from "@/components/ui/formular-dialog";
import {
  DESTINATII_EPAVA,
  MOTIVE_RADIERE,
  TIPURI_IESIRE,
  eInstrainare,
  permitePastrareaNumarului,
  type DestinatieEpava,
  type MotivRadiere,
  type TipIesire,
} from "@/schemas/flota-iesire";

import { scoateDinParc } from "./actions";
import {
  DESCRIERE_TERMENE_PE_TIP,
  ETICHETE_DESTINATIE_EPAVA,
  ETICHETE_MOTIV_RADIERE,
  ETICHETE_TIP_IESIRE,
  NOTA_VANZARE,
  etichetaDatei,
} from "./etichete-iesire";
import { valoriIesire } from "./valori-iesire";

interface Proprietati {
  readonly vehiculId: string;
  readonly nrInmatriculare: string;
  readonly kmCurent: number;
  /** `min` pe dată: ieșirea nu poate fi înaintea achiziției (și baza refuză). */
  readonly dataAchizitie: string | null;
  /** Ziua de azi, ora României, calculată pe server: `max` pe dată. */
  readonly azi: string;
  /** Șoferul alocării deschise, sau `null`: alocarea se încheie la data ieșirii. */
  readonly soferCurent: string | null;
  /** Foile trimise și neaprobate: rămân lucrabile după ieșire. */
  readonly foiDeAprobat: number;
  /**
   * Incidentele vehiculului (F11), cu eticheta gata făcută pe server, pentru
   * legătura opțională a daunei totale (`incident_id`). Goală = selectorul nu
   * apare (vehicul fără incidente, sau fără `vehicle_incidents:read`).
   */
  readonly incidente?: readonly Readonly<{ id: string; eticheta: string }>[];
}

const tipDin = (v: string | undefined): TipIesire | "" =>
  (TIPURI_IESIRE as readonly string[]).includes(v ?? "") ? (v as TipIesire) : "";
const destinatieDin = (v: string | undefined): DestinatieEpava | null =>
  (DESTINATII_EPAVA as readonly string[]).includes(v ?? "") ? (v as DestinatieEpava) : null;
const motivDin = (v: string | undefined): MotivRadiere | null =>
  (MOTIVE_RADIERE as readonly string[]).includes(v ?? "") ? (v as MotivRadiere) : null;

/**
 * Câmpurile, ca subcomponent: `FormularDialog` remontează interiorul la fiecare
 * deschidere, deci `useState` pornește din nou gol (aceeași rațiune ca
 * `StareaVehiculului` din `dialog-vehicul.tsx`). La un refuz caseta rămâne
 * deschisă, iar starea aleasă rămâne.
 */
function CampuriIesire<TData>({
  stare,
  idc,
  p,
}: Readonly<{
  stare: StareFormular<TData>;
  idc: (sufix: string) => string;
  p: Proprietati;
}>): ReactElement {
  const trimis = stare.valoriTrimise;
  const [tip, setTip] = useState<TipIesire | "">(tipDin(trimis["tip"]));
  const [destinatie, setDestinatie] = useState<DestinatieEpava | null>(
    destinatieDin(trimis["destinatie_epava"]),
  );
  const [motivRadiere, setMotivRadiere] = useState<MotivRadiere | null>(
    motivDin(trimis["motiv_radiere"]),
  );
  const instrainare = tip !== "" && eInstrainare(tip, destinatie);
  const pastrare = tip !== "" && permitePastrareaNumarului(tip, motivRadiere);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Camp
          nume="tip"
          id={idc("tip")}
          eticheta="Felul ieșirii"
          fel="select"
          obligatoriu
          erori={stare.erori["tip"] ?? []}
        >
          {(a) => (
            <select
              {...a}
              value={tip}
              onChange={(e) => {
                setTip(tipDin(e.target.value));
              }}
            >
              <option value="">Alegeți…</option>
              {TIPURI_IESIRE.map((t) => (
                <option key={t} value={t}>
                  {ETICHETE_TIP_IESIRE[t]}
                </option>
              ))}
            </select>
          )}
        </Camp>

        {tip === "dauna_totala" ? (
          <Camp
            nume="destinatie_epava"
            id={idc("destinatie_epava")}
            eticheta="Ce s-a întâmplat cu epava"
            fel="select"
            obligatoriu
            ajutor="Dacă nu s-a decis încă, lăsați vehiculul „În service” și scoateți-l când se decide."
            erori={stare.erori["destinatie_epava"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={destinatie ?? ""}
                onChange={(e) => {
                  setDestinatie(destinatieDin(e.target.value));
                }}
              >
                <option value="">Alegeți…</option>
                {DESTINATII_EPAVA.map((d) => (
                  <option key={d} value={d}>
                    {ETICHETE_DESTINATIE_EPAVA[d]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        ) : null}

        {tip === "dauna_totala" && (p.incidente ?? []).length > 0 ? (
          <Camp
            nume="incident_id"
            id={idc("incident_id")}
            eticheta="Incidentul care a dus la daună"
            fel="select"
            ajutor="Opțional. Leagă ieșirea de dosarul incidentului din flotă."
            erori={stare.erori["incident_id"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={trimis["incident_id"] ?? ""}>
                <option value="">Fără incident legat</option>
                {(p.incidente ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.eticheta}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        ) : null}

        {tip === "radiere" ? (
          <Camp
            nume="motiv_radiere"
            id={idc("motiv_radiere")}
            eticheta="Motivul radierii"
            fel="select"
            obligatoriu
            erori={stare.erori["motiv_radiere"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={motivRadiere ?? ""}
                onChange={(e) => {
                  setMotivRadiere(motivDin(e.target.value));
                }}
              >
                <option value="">Alegeți…</option>
                {MOTIVE_RADIERE.map((m) => (
                  <option key={m} value={m}>
                    {ETICHETE_MOTIV_RADIERE[m]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        ) : null}

        <Camp
          nume="data_iesire"
          id={idc("data_iesire")}
          eticheta={tip === "" ? "Data ieșirii" : etichetaDatei(tip, motivRadiere)}
          obligatoriu
          ajutor="Ziua reală a ieșirii, chiar dacă o înregistrați mai târziu. Termenele curg de la ea."
          erori={stare.erori["data_iesire"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="date"
              max={p.azi}
              min={p.dataAchizitie ?? undefined}
              defaultValue={trimis["data_iesire"] ?? p.azi}
            />
          )}
        </Camp>

        <Camp
          nume="km_iesire"
          id={idc("km_iesire")}
          eticheta="Kilometraj la ieșire"
          ajutor={`Cel puțin ${p.kmCurent.toLocaleString("ro-RO")} km, ultimul cunoscut.`}
          erori={stare.erori["km_iesire"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min={p.kmCurent}
              step="1"
              inputMode="numeric"
              defaultValue={trimis["km_iesire"] ?? String(p.kmCurent)}
            />
          )}
        </Camp>

        <Camp
          nume="motiv"
          id={idc("motiv")}
          eticheta="Motivul ieșirii"
          obligatoriu
          ajutor="De ce iese vehiculul: peste un an e singura întrebare care se mai pune despre el."
          className="sm:col-span-2"
          erori={stare.erori["motiv"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              minLength={5}
              maxLength={500}
              defaultValue={trimis["motiv"] ?? ""}
            />
          )}
        </Camp>

        {instrainare ? (
          <>
            <Camp
              nume="cumparator"
              id={idc("cumparator")}
              eticheta="Cumpărătorul"
              ajutor="Numele firmei sau al persoanei. Fără CNP. Folosește la amenzile venite după vânzare."
              erori={stare.erori["cumparator"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={200}
                  defaultValue={trimis["cumparator"] ?? ""}
                />
              )}
            </Camp>
            <Camp
              nume="pret"
              id={idc("pret")}
              eticheta="Prețul (lei)"
              erori={stare.erori["pret"] ?? []}
            >
              {(a) => (
                <input {...a} type="text" inputMode="decimal" defaultValue={trimis["pret"] ?? ""} />
              )}
            </Camp>
          </>
        ) : null}

        <Camp
          nume="nr_document"
          id={idc("nr_document")}
          eticheta="Numărul documentului"
          ajutor="Contractul, certificatul de distrugere sau procesul-verbal."
          erori={stare.erori["nr_document"] ?? []}
        >
          {(a) => (
            <input {...a} type="text" maxLength={60} defaultValue={trimis["nr_document"] ?? ""} />
          )}
        </Camp>

        {pastrare ? (
          <label className="text-corp flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              name="pastreaza_numarul"
              className={clasaBifa}
              defaultChecked={trimis["pastreaza_numarul"] === "on"}
            />
            Firma păstrează numărul de înmatriculare
          </label>
        ) : null}

        <Camp
          nume="observatii"
          id={idc("observatii")}
          eticheta="Observații"
          fel="textarea"
          className="sm:col-span-2"
          erori={stare.erori["observatii"] ?? []}
        >
          {(a) => (
            <textarea {...a} maxLength={1000} rows={2} defaultValue={trimis["observatii"] ?? ""} />
          )}
        </Camp>
      </div>

      {tip === "" ? null : (
        <p className="text-muted-foreground text-corp">{DESCRIERE_TERMENE_PE_TIP[tip]}</p>
      )}
      {instrainare ? <p className="text-muted-foreground text-corp">{NOTA_VANZARE}</p> : null}
      <p className="text-muted-foreground text-corp">
        {p.soferCurent === null
          ? "Vehiculul nu are șofer alocat acum."
          : `Alocarea lui ${p.soferCurent} se încheie la data ieșirii.`}{" "}
        Rezervările viitoare se anulează. O ieșire greșită se anulează din fișă; alocarea și
        rezervările nu revin singure.
      </p>
      {p.foiDeAprobat > 0 ? (
        <p className="text-corp">
          {p.foiDeAprobat === 1
            ? "Vehiculul are o foaie de parcurs de aprobat"
            : `Vehiculul are ${String(p.foiDeAprobat)} foi de parcurs de aprobat`}
          ; le puteți decide și după ieșire.
        </p>
      ) : null}
    </div>
  );
}

export function DialogIesire(p: Proprietati): ReactElement {
  return (
    <FormularDialog
      declansator={{ eticheta: "Scoate din parc", varianta: "secundar" }}
      titlu={`Scoate din parc ${p.nrInmatriculare}`}
      descriere="Vânzare, casare, daună totală, radiere sau restituire la locator. Data, felul și kilometrajul nu se mai schimbă după salvare."
      marime="lucru"
      actiune={(date) => scoateDinParc(valoriIesire(date, p.vehiculId))}
      mesajReusita="Vehiculul a ieșit din parc. Termenele de după ieșire sunt pe fișă."
      etichetaTrimite="Scoate din parc"
      variantaTrimite="distructiv"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => <CampuriIesire stare={stare} idc={idc} p={p} />}
    </FormularDialog>
  );
}
