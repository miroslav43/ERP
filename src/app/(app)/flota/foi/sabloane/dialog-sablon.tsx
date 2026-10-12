"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { SablonTraseu } from "@/domain/fleet/foaie";

import { actualizeazaSablonTraseu, creeazaSablonTraseu } from "../../actions-sabloane";

/**
 * Șablonul de traseu nou sau corectura lui (0200): o rută recurentă a firmei,
 * din care șoferul adaugă cursa dintr-un clic. Numele e unic în firmă
 * (`trt_org_denumire_uq`, eroarea ajunge pe câmp prin `traduEroare`).
 */
export function DialogSablon({ sablon }: Readonly<{ sablon: SablonTraseu | null }>): ReactElement {
  async function trimite(date: FormData) {
    const campuri = {
      denumire: String(date.get("denumire") ?? ""),
      de_la_loc: String(date.get("de_la_loc") ?? ""),
      pana_la_loc: String(date.get("pana_la_loc") ?? ""),
      scop: String(date.get("scop") ?? ""),
      // Text: golul ajunge la schemă ca gol, nu ca 0.
      km_estimat: String(date.get("km_estimat") ?? "").trim(),
    };
    return sablon === null
      ? creeazaSablonTraseu(campuri)
      : actualizeazaSablonTraseu({ ...campuri, id: sablon.id });
  }

  return (
    <FormularDialog
      declansator={
        sablon === null
          ? {
              eticheta: "Șablon nou",
              varianta: "primar",
              pictograma: <Plus aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Pencil aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Modifică șablonul „${sablon.denumire}”`,
            }
      }
      titlu={sablon === null ? "Șablon de traseu nou" : "Modifică șablonul"}
      descriere="Locurile, scopul și distanța se precompletează în caseta „Cursă nouă” de pe foaie."
      actiune={trimite}
      mesajReusita={sablon === null ? "Șablonul a fost creat." : "Șablonul a fost modificat."}
      etichetaTrimite={sablon === null ? "Creează șablonul" : "Salvează"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="denumire"
            id={idc("denumire")}
            eticheta="Denumire"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["denumire"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={120}
                defaultValue={stare.valoriTrimise["denumire"] ?? sablon?.denumire ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="de_la_loc"
            id={idc("de_la_loc")}
            eticheta="De la"
            obligatoriu
            erori={stare.erori["de_la_loc"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={200}
                defaultValue={stare.valoriTrimise["de_la_loc"] ?? sablon?.de_la_loc ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="pana_la_loc"
            id={idc("pana_la_loc")}
            eticheta="Până la"
            obligatoriu
            erori={stare.erori["pana_la_loc"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={200}
                defaultValue={stare.valoriTrimise["pana_la_loc"] ?? sablon?.pana_la_loc ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="scop"
            id={idc("scop")}
            eticheta="Scopul deplasării"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["scop"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={500}
                defaultValue={stare.valoriTrimise["scop"] ?? sablon?.scop ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="km_estimat"
            id={idc("km_estimat")}
            eticheta="Distanța estimată (km)"
            ajutor="Opțional. Precompletează kilometrajul la sosire; șoferul îl corectează după bord."
            erori={stare.erori["km_estimat"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                defaultValue={
                  stare.valoriTrimise["km_estimat"] ??
                  (sablon?.km_estimat === null || sablon === null ? "" : String(sablon.km_estimat))
                }
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
