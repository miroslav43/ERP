"use client";

import { FilePlus2, Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { IntrareData } from "@/components/ui/intrare-data";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type { OptiuneVehiculAmenda, RandAmenda } from "@/lib/queries/flota-amenzi";

import { actualizeazaAmenda, inregistreazaAmenda } from "../actions-amenzi";

type Proprietati = Readonly<{
  /** `AAAA-LL-ZZ`, ziua României: data implicită a primirii. */
  azi: string;
  /** Caseta pornește deschisă (linkul `?amenda=noua`); se citește o singură dată. */
  deschisInitial?: boolean;
}> &
  (
    | Readonly<{
        fel: "noua";
        vehicule: readonly OptiuneVehiculAmenda[];
        /** Vehiculul precompletat (venit de pe fișa lui). */
        vehiculImplicit?: string | null;
      }>
    | Readonly<{ fel: "corectura"; amenda: RandAmenda }>
  );

/**
 * Înregistrarea sau corectura unei amenzi (0206). Cheile trimise sunt EXACT
 * cele din `amendaNouaSchema` / `actualizeazaAmendaSchema`.
 *
 * Termenul de răspuns îl scrie omul din documentul primit: art. 39 alin. (1)
 * din OUG 195/2002 lasă termenul „indicat în cuprinsul solicitării”, deci
 * aplicația nu propune niciunul.
 */
export function DialogAmenda(props: Proprietati): ReactElement {
  const corectura = props.fel === "corectura" ? props.amenda : null;

  async function trimite(date: FormData) {
    const comune = {
      numar_pv: String(date.get("numar_pv") ?? ""),
      data_pv: String(date.get("data_pv") ?? ""),
      constatata_la: String(date.get("constatata_la") ?? ""),
      locul: String(date.get("locul") ?? ""),
      fapta: String(date.get("fapta") ?? ""),
      autoritate: String(date.get("autoritate") ?? ""),
      suma: String(date.get("suma") ?? ""),
      primita_la: String(date.get("primita_la") ?? ""),
      termen_raspuns: String(date.get("termen_raspuns") ?? ""),
      observatii: String(date.get("observatii") ?? ""),
    };
    if (corectura !== null) return actualizeazaAmenda({ id: corectura.id, ...comune });
    return inregistreazaAmenda({ vehicle_id: String(date.get("vehicle_id") ?? ""), ...comune });
  }

  return (
    <FormularDialog
      {...(props.deschisInitial === true ? { deschisInitial: true } : {})}
      declansator={
        corectura === null
          ? {
              eticheta: "Amendă nouă",
              varianta: "primar",
              pictograma: <FilePlus2 aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: "Corectează datele",
              varianta: "secundar",
              pictograma: <Pencil aria-hidden="true" className="size-4" />,
            }
      }
      titlu={
        corectura === null
          ? "Amendă primită pe un vehicul"
          : `Corectura amenzii ${corectura.numar_pv}`
      }
      descriere={
        corectura === null
          ? "Scrieți datele din procesul-verbal sau din solicitarea autorității. Termenul de răspuns e cel din document: aplicația nu presupune unul."
          : "Vehiculul nu se schimbă. După trimiterea răspunsului, numărul procesului-verbal și momentul faptei nu se mai pot corecta."
      }
      actiune={trimite}
      mesajReusita={corectura === null ? "Amenda a fost înregistrată." : "Amenda a fost corectată."}
      etichetaTrimite={corectura === null ? "Înregistrează amenda" : "Salvează corectura"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {props.fel === "noua" ? (
            <Camp
              nume="vehicle_id"
              id={idc("vehicle_id")}
              eticheta="Vehicul"
              fel="select"
              obligatoriu
              className="sm:col-span-2"
              erori={stare.erori["vehicle_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={stare.valoriTrimise["vehicle_id"] ?? props.vehiculImplicit ?? ""}
                >
                  <option value="" disabled>
                    Alegeți vehiculul
                  </option>
                  {props.vehicule.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nr_inmatriculare} — {v.marca} {v.model}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          ) : null}
          <Camp
            nume="numar_pv"
            id={idc("numar_pv")}
            eticheta="Proces-verbal sau solicitare (număr)"
            obligatoriu
            erori={stare.erori["numar_pv"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={60}
                defaultValue={stare.valoriTrimise["numar_pv"] ?? corectura?.numar_pv ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="data_pv"
            id={idc("data_pv")}
            eticheta="Data procesului-verbal"
            erori={stare.erori["data_pv"] ?? []}
          >
            {(a) => (
              <IntrareData
                {...a}
                implicit={stare.valoriTrimise["data_pv"] ?? corectura?.data_pv ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="constatata_la"
            id={idc("constatata_la")}
            eticheta="Momentul faptei"
            obligatoriu
            ajutor="De el depinde cine conducea vehiculul."
            erori={stare.erori["constatata_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                defaultValue={
                  stare.valoriTrimise["constatata_la"] ??
                  (corectura === null
                    ? oraRomanieiPentruCamp(new Date())
                    : oraRomanieiPentruCamp(corectura.constatata_la))
                }
              />
            )}
          </Camp>
          <Camp
            nume="locul"
            id={idc("locul")}
            eticheta="Locul faptei"
            erori={stare.erori["locul"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                defaultValue={stare.valoriTrimise["locul"] ?? corectura?.locul ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="fapta"
            id={idc("fapta")}
            eticheta="Fapta constatată"
            fel="textarea"
            obligatoriu
            className="sm:col-span-2"
            ajutor="De exemplu: depășirea vitezei legale, staționare neregulamentară, lipsa rovinietei."
            erori={stare.erori["fapta"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={500}
                rows={2}
                defaultValue={stare.valoriTrimise["fapta"] ?? corectura?.fapta ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="autoritate"
            id={idc("autoritate")}
            eticheta="Autoritatea"
            erori={stare.erori["autoritate"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                defaultValue={stare.valoriTrimise["autoritate"] ?? corectura?.autoritate ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="suma"
            id={idc("suma")}
            eticheta="Suma amenzii (lei)"
            erori={stare.erori["suma"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                inputMode="decimal"
                defaultValue={
                  stare.valoriTrimise["suma"] ??
                  (corectura?.suma == null ? "" : String(corectura.suma))
                }
              />
            )}
          </Camp>
          <Camp
            nume="primita_la"
            id={idc("primita_la")}
            eticheta="Primită de firmă la"
            obligatoriu
            erori={stare.erori["primita_la"] ?? []}
          >
            {(a) => (
              <IntrareData
                {...a}
                implicit={stare.valoriTrimise["primita_la"] ?? corectura?.primita_la ?? props.azi}
              />
            )}
          </Camp>
          <Camp
            nume="termen_raspuns"
            id={idc("termen_raspuns")}
            eticheta="Termen de răspuns"
            ajutor="Termenul indicat în solicitare, dacă e unul."
            erori={stare.erori["termen_raspuns"] ?? []}
          >
            {(a) => (
              <IntrareData
                {...a}
                implicit={stare.valoriTrimise["termen_raspuns"] ?? corectura?.termen_raspuns ?? ""}
              />
            )}
          </Camp>
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
                maxLength={1000}
                rows={2}
                defaultValue={stare.valoriTrimise["observatii"] ?? corectura?.observatii ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
