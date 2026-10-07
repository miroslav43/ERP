"use client";

import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { oraRomanieiPentruCamp } from "@/lib/format/date";

import { incheieAlocarea } from "../actions";

/**
 * Restituirea vehiculului: alocarea deschisă se încheie, iar mașina rămâne
 * fără șofer până la următoarea predare.
 *
 * `min` pe data restituirii e începutul alocării. Baza refuză oricum un
 * interval inversat (`va_interval_ck`), dar calendarul îl spune înainte.
 */
interface Proprietati {
  readonly alocareId: string;
  readonly vehiculId: string;
  readonly sofer: string;
  readonly deLa: string;
  readonly kmCurent: number;
}

export function DialogIncheieAlocare({
  alocareId,
  vehiculId,
  sofer,
  deLa,
  kmCurent,
}: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return incheieAlocarea({
      id: alocareId,
      vehicle_id: vehiculId,
      pana_la: String(date.get("pana_la") ?? "").trim(),
      km_restituire: String(date.get("km_restituire") ?? "").trim(),
      observatii: String(date.get("observatii") ?? "").trim() || null,
    });
  }

  return (
    <FormularDialog
      declansator={{ eticheta: "Restituie", varianta: "tertiar" }}
      titlu={`Restituirea de la ${sofer}`}
      descriere="Alocarea se încheie, iar vehiculul rămâne fără șofer până la următoarea predare."
      actiune={trimite}
      mesajReusita="Alocarea a fost încheiată."
      etichetaTrimite="Încheie alocarea"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="pana_la"
            id={idc("pana_la")}
            eticheta="Restituit la"
            obligatoriu
            erori={stare.erori["pana_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                min={oraRomanieiPentruCamp(deLa)}
                defaultValue={stare.valoriTrimise["pana_la"] ?? oraRomanieiPentruCamp(new Date())}
              />
            )}
          </Camp>
          <Camp
            nume="km_restituire"
            id={idc("km_restituire")}
            eticheta="Kilometraj la restituire"
            erori={stare.erori["km_restituire"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={stare.valoriTrimise["km_restituire"] ?? String(kmCurent)}
              />
            )}
          </Camp>
          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații la restituire"
            fel="textarea"
            ajutor="Daune, lipsuri, starea în care a revenit mașina."
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={1000}
                rows={2}
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
