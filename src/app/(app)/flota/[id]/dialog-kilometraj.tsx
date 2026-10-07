"use client";

import { Gauge } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { corecteazaKilometraj } from "../actions";

/**
 * Corectura kilometrajului de bord, cu motiv.
 *
 * Caseta de modificare a vehiculului nu are câmpul, și e bine că nu-l are:
 * acolo s-ar schimba în treacăt, la o salvare făcută pentru culoare. Aici e o
 * operațiune separată, cu motiv obligatoriu care ajunge în audit.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly kmCurent: number;
}

export function DialogKilometraj({ vehiculId, kmCurent }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return corecteazaKilometraj({
      id: vehiculId,
      // Text, nu `Number()`: golul trebuie să ajungă la schemă ca gol, nu ca 0.
      km_curent: String(date.get("km_curent") ?? "").trim(),
      motiv: String(date.get("motiv") ?? "").trim(),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Corectează km",
        varianta: "secundar",
        pictograma: <Gauge aria-hidden="true" className="size-4" />,
      }}
      titlu="Corectează kilometrajul"
      descriere={`Acum: ${kmCurent.toLocaleString("ro-RO")} km. Kilometrajul crește singur la aprobarea foilor de parcurs; corectați-l doar când cifra e greșită.`}
      actiune={trimite}
      mesajReusita="Kilometrajul a fost corectat."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4">
          <Camp
            nume="km_curent"
            id={idc("km_curent")}
            eticheta="Kilometraj la bord"
            obligatoriu
            erori={stare.erori["km_curent"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={stare.valoriTrimise["km_curent"] ?? String(kmCurent)}
              />
            )}
          </Camp>
          <Camp
            nume="motiv"
            id={idc("motiv")}
            eticheta="Motivul corecturii"
            obligatoriu
            ajutor="Rămâne în jurnalul de audit, alături de cifra nouă."
            erori={stare.erori["motiv"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={300}
                defaultValue={stare.valoriTrimise["motiv"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
