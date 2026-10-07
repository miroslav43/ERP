"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { anuleazaCitire, corecteazaCitire } from "../actions";

/**
 * Corecția și anularea unei citiri de contor, pe rândul ei din fișă. Garda
 * (`ssm_meter_guard`, 0180) verifică ambii vecini: o corecție care ar face
 * citirea următoare „regres” e refuzată, cu valorile în mesaj.
 */
export function ActiuniCitire({
  citire,
}: Readonly<{
  citire: Readonly<{
    id: string;
    citire: number;
    data_citirii: string;
    observatii: string | null;
    tip: string;
  }>;
}>): ReactElement {
  async function corecteaza(date: FormData) {
    const obs = String(date.get("observatii") ?? "").trim();
    return corecteazaCitire({
      id: citire.id,
      citire: String(date.get("citire") ?? ""),
      data_citirii: String(date.get("data_citirii") ?? ""),
      observatii: obs.length === 0 ? null : obs,
    });
  }

  async function anuleaza(date: FormData) {
    return anuleazaCitire({ id: citire.id, motiv: String(date.get("motiv") ?? "").trim() });
  }

  return (
    <div className="flex items-center gap-1">
      <FormularDialog
        declansator={{
          eticheta: "Corectează",
          varianta: "tertiar",
          pictograma: <Pencil aria-hidden="true" className="size-4" />,
        }}
        titlu="Corectați citirea"
        descriere="Valoarea trebuie să rămână între citirea dinainte și cea de după; altfel baza o refuză și spune între ce limite poate fi."
        marime="mediu"
        actiune={corecteaza}
        mesajReusita="Citirea a fost corectată."
        etichetaTrimite="Salvează corecția"
        textInCurs="Se salvează…"
      >
        {(stare, idc) => (
          <>
            <Camp
              nume="citire"
              id={idc("citire")}
              eticheta="Citire"
              obligatoriu
              erori={stare.erori["citire"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={stare.valoriTrimise["citire"] ?? String(citire.citire)}
                />
              )}
            </Camp>
            <Camp
              nume="data_citirii"
              id={idc("data")}
              eticheta="Data citirii"
              obligatoriu
              erori={stare.erori["data_citirii"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  defaultValue={stare.valoriTrimise["data_citirii"] ?? citire.data_citirii}
                />
              )}
            </Camp>
            <Camp
              nume="observatii"
              id={idc("observatii")}
              eticheta="Observații"
              erori={stare.erori["observatii"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  maxLength={500}
                  defaultValue={stare.valoriTrimise["observatii"] ?? citire.observatii ?? ""}
                />
              )}
            </Camp>
          </>
        )}
      </FormularDialog>

      <FormularDialog
        declansator={{
          eticheta: "Anulează",
          varianta: "tertiar",
          pictograma: <Trash2 aria-hidden="true" className="size-4" />,
        }}
        titlu="Anulați citirea?"
        descriere="Citirea iese din seria contorului (planurile pe contor se recalculează din cele rămase). Rândul se păstrează, cu motivul, pentru istoric."
        marime="mic"
        actiune={anuleaza}
        mesajReusita="Citirea a fost anulată."
        etichetaTrimite="Anulează citirea"
        variantaTrimite="distructiv"
        textInCurs="Se anulează…"
      >
        {(stare, idc) => (
          <Camp
            nume="motiv"
            id={idc("motiv")}
            eticheta="Motivul anulării"
            obligatoriu
            erori={stare.erori["motiv"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={500}
                placeholder="Ex. citire greșită, contor citit de pe alt utilaj"
                defaultValue={stare.valoriTrimise["motiv"] ?? ""}
              />
            )}
          </Camp>
        )}
      </FormularDialog>
    </div>
  );
}
