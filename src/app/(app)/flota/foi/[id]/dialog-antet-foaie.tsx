"use client";

import { Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { oraRomanieiPentruCamp } from "@/lib/format/date";

import { actualizeazaFoaie } from "../../actions";

/**
 * Antetul unei ciorne: traseul pe scurt, scopul zilei, observațiile.
 *
 * Ora și kilometrajul de plecare apar DOAR pe o foaie fără curse: cu curse le
 * dă prima cursă, iar baza refuză scrierea lor directă („Orele și
 * kilometrajul foii se scriu pe curse”). Un câmp care duce sigur într-un refuz
 * e un defect de ecran, deci nu se arată.
 */
type Proprietati = Readonly<{
  foaieId: string;
  areCurse: boolean;
  plecareLa: string;
  kmPlecare: number | null;
  traseu: string | null;
  scop: string | null;
  observatii: string | null;
}>;

export function DialogAntetFoaie(p: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return actualizeazaFoaie({
      id: p.foaieId,
      plecare_la: p.areCurse ? null : String(date.get("plecare_la") ?? "") || null,
      km_plecare: p.areCurse ? null : String(date.get("km_plecare") ?? "").trim(),
      traseu: String(date.get("traseu") ?? "").trim() || null,
      scop: String(date.get("scop") ?? "").trim() || null,
      observatii: String(date.get("observatii") ?? "").trim() || null,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Modifică foaia",
        varianta: "secundar",
        pictograma: <Pencil aria-hidden="true" className="size-4" />,
      }}
      titlu="Modifică foaia"
      descriere={
        p.areCurse
          ? "Ora și kilometrajul zilei vin din curse; aici se schimbă traseul pe scurt, scopul și observațiile."
          : "Foaia nu are încă nicio cursă: ora și kilometrajul de plecare se pot corecta aici."
      }
      actiune={trimite}
      mesajReusita="Foaia a fost modificată."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {p.areCurse ? null : (
            <>
              <Camp
                nume="plecare_la"
                id={idc("plecare_la")}
                eticheta="Plecare"
                erori={stare.erori["plecare_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="datetime-local"
                    defaultValue={
                      stare.valoriTrimise["plecare_la"] ?? oraRomanieiPentruCamp(p.plecareLa)
                    }
                  />
                )}
              </Camp>
              <Camp
                nume="km_plecare"
                id={idc("km_plecare")}
                eticheta="Km la plecare"
                erori={stare.erori["km_plecare"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    defaultValue={
                      stare.valoriTrimise["km_plecare"] ??
                      (p.kmPlecare === null ? "" : String(p.kmPlecare))
                    }
                  />
                )}
              </Camp>
            </>
          )}
          <Camp
            nume="traseu"
            id={idc("traseu")}
            eticheta="Traseul pe scurt"
            className="sm:col-span-2"
            erori={stare.erori["traseu"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={500}
                defaultValue={stare.valoriTrimise["traseu"] ?? p.traseu ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="scop"
            id={idc("scop")}
            eticheta="Scopul zilei"
            className="sm:col-span-2"
            erori={stare.erori["scop"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={500}
                defaultValue={stare.valoriTrimise["scop"] ?? p.scop ?? ""}
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
                defaultValue={stare.valoriTrimise["observatii"] ?? p.observatii ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
