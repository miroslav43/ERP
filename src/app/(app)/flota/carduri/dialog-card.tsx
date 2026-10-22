"use client";

import { CreditCard, Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { EMITENTI_CARD, ETICHETE_EMITENT, etichetaEmitent } from "@/domain/fleet/carduri/emitenti";
import { STATUSURI_CARD, mascheaza, type StatusCard } from "@/domain/fleet/carduri/card";

import { actualizeazaCard, creeazaCard } from "./actions";
import { ETICHETE_STATUS_CARD } from "./etichete";
import { valoareTinta, valoriCardNou, valoriCorecturaCard } from "./valori-card";

export type OptiuneVehiculCard = Readonly<{
  id: string;
  nr_inmatriculare: string;
  marca: string;
  model: string;
}>;
export type OptiuneSoferCard = Readonly<{
  id: string;
  full_name: string | null;
  marca: string;
}>;

export type CardDeCorectat = Readonly<{
  id: string;
  emitent: string;
  ultimele_cifre: string;
  denumire: string | null;
  vehicle_id: string | null;
  employee_id: string | null;
  valabil_pana: string | null;
  status: StatusCard;
  observatii: string | null;
}>;

type Proprietati = Readonly<{
  vehicule: readonly OptiuneVehiculCard[];
  soferi: readonly OptiuneSoferCard[];
  /** Caseta pornește deschisă (linkul `?card=nou` sau `?card=<id>`); se citește o singură dată. */
  deschisInitial?: boolean;
  /** Absent = card nou. */
  card?: CardDeCorectat;
}>;

/**
 * Cardul nou sau corectura lui (0214). Cheile trimise le face `valori-card.ts`,
 * singura traducere `FormData` → acțiune. Numărul întreg se poate tasta, dar
 * nu se păstrează: rămân ultimele 4 cifre și amprenta lui.
 */
export function DialogCard({ vehicule, soferi, deschisInitial, card }: Proprietati): ReactElement {
  const corectura = card ?? null;
  const [anValabil, lunaValabil] =
    corectura?.valabil_pana === null || corectura === null
      ? ["", ""]
      : [corectura.valabil_pana.slice(0, 4), String(Number(corectura.valabil_pana.slice(5, 7)))];

  async function trimite(date: FormData) {
    if (corectura !== null) return actualizeazaCard(valoriCorecturaCard(corectura.id, date));
    return creeazaCard(valoriCardNou(date));
  }

  return (
    <FormularDialog
      {...(deschisInitial === true ? { deschisInitial: true } : {})}
      declansator={
        corectura === null
          ? {
              eticheta: "Card nou",
              varianta: "primar",
              pictograma: <CreditCard aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Pencil aria-hidden="true" className="size-4" />,
              marime: "iconita",
              varianta: "secundar",
              "aria-label": `Corectează cardul ${etichetaEmitent(corectura.emitent)} ${mascheaza(corectura.ultimele_cifre)}`,
            }
      }
      titlu={
        corectura === null
          ? "Card de combustibil nou"
          : `Cardul ${etichetaEmitent(corectura.emitent)} ${mascheaza(corectura.ultimele_cifre)}`
      }
      descriere={
        corectura === null
          ? "Păstrăm doar ultimele 4 cifre. Dacă tastați numărul întreg, îl folosim o singură dată, ca să recunoaștem cardul în extrase, și nu-l salvăm."
          : "Emitentul și numărul nu se schimbă: alt număr înseamnă alt card. Anulați-l pe acesta și înregistrați-l pe cel nou."
      }
      actiune={trimite}
      mesajReusita={corectura === null ? "Cardul a fost înregistrat." : "Cardul a fost corectat."}
      etichetaTrimite={corectura === null ? "Înregistrează cardul" : "Salvează"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {corectura === null ? (
            <>
              <Camp
                nume="emitent"
                id={idc("emitent")}
                eticheta="Emitent"
                fel="select"
                obligatoriu
                erori={stare.erori["emitent"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={stare.valoriTrimise["emitent"] ?? ""}>
                    <option value="" disabled>
                      Alegeți emitentul
                    </option>
                    {EMITENTI_CARD.map((e) => (
                      <option key={e} value={e}>
                        {ETICHETE_EMITENT[e]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
              <Camp
                nume="numar"
                id={idc("numar")}
                eticheta="Numărul cardului"
                obligatoriu
                ajutor="Ultimele 4–6 cifre sau numărul întreg. Păstrăm doar ultimele 4 cifre."
                erori={stare.erori["numar"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={30}
                    defaultValue={stare.valoriTrimise["numar"] ?? ""}
                  />
                )}
              </Camp>
            </>
          ) : null}
          <Camp
            nume="denumire"
            id={idc("denumire")}
            eticheta="Denumire internă"
            ajutor="De exemplu: „Card rezervă” sau „Card dubă livrări”."
            erori={stare.erori["denumire"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={80}
                defaultValue={stare.valoriTrimise["denumire"] ?? corectura?.denumire ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="tinta"
            id={idc("tinta")}
            eticheta="Atribuit"
            fel="select"
            ajutor="Pe un vehicul sau pe un șofer. Fără atribuire, e un card de rezervă."
            erori={[
              ...(stare.erori["tinta"] ?? []),
              ...(stare.erori["vehicle_id"] ?? []),
              ...(stare.erori["employee_id"] ?? []),
            ]}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={
                  stare.valoriTrimise["tinta"] ??
                  (corectura === null ? "" : valoareTinta(corectura))
                }
              >
                <option value="">Neatribuit (card de rezervă)</option>
                {vehicule.length > 0 ? (
                  <optgroup label="Vehicule">
                    {vehicule.map((v) => (
                      <option key={v.id} value={`vehicul:${v.id}`}>
                        {v.nr_inmatriculare} — {v.marca} {v.model}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {soferi.length > 0 ? (
                  <optgroup label="Șoferi">
                    {soferi.map((s) => (
                      <option key={s.id} value={`sofer:${s.id}`}>
                        {s.full_name ?? s.marca}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            )}
          </Camp>
          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <Camp
              nume="valabil_luna"
              id={idc("valabil_luna")}
              eticheta="Valabil până la (luna)"
              ajutor="Luna și anul de pe card (LL/AA)."
              erori={stare.erori["valabil_luna"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={12}
                  inputMode="numeric"
                  defaultValue={stare.valoriTrimise["valabil_luna"] ?? lunaValabil}
                />
              )}
            </Camp>
            <Camp
              nume="valabil_an"
              id={idc("valabil_an")}
              eticheta="(anul)"
              erori={stare.erori["valabil_an"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={2000}
                  max={2100}
                  inputMode="numeric"
                  defaultValue={stare.valoriTrimise["valabil_an"] ?? anValabil}
                />
              )}
            </Camp>
          </div>
          {corectura !== null ? (
            <Camp
              nume="status"
              id={idc("status")}
              eticheta="Stare"
              fel="select"
              obligatoriu
              erori={stare.erori["status"] ?? []}
            >
              {(a) => (
                <select {...a} defaultValue={stare.valoriTrimise["status"] ?? corectura.status}>
                  {STATUSURI_CARD.map((s) => (
                    <option key={s} value={s}>
                      {ETICHETE_STATUS_CARD[s]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
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
              <textarea
                {...a}
                rows={2}
                maxLength={1000}
                defaultValue={stare.valoriTrimise["observatii"] ?? corectura?.observatii ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
