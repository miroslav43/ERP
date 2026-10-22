"use client";

import { Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type { Alimentare } from "@/lib/queries/fleet";

import { actualizeazaAlimentare } from "../../actions";

/**
 * Corectura unei alimentări de pe ciornă (0200). Pe o foaie trimisă baza o
 * refuză (§D1): aprobatorul se uită la litrii ăștia. Intervalul foii, bonul
 * dublat și litrii zero vin ca erori pe câmp din bază.
 */
type Proprietati = Readonly<{ foaieId: string; alimentare: Alimentare }>;

export function DialogAlimentare({ foaieId, alimentare }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return actualizeazaAlimentare({
      id: alimentare.id,
      trip_sheet_id: foaieId,
      litri: String(date.get("litri") ?? "").trim(),
      cost: String(date.get("cost") ?? "").trim(),
      statie: String(date.get("statie") ?? "").trim() || null,
      numar_bon: String(date.get("numar_bon") ?? "").trim() || null,
      // Trimis mereu: schema îl ia `null` când lipsește, iar corectura ar
      // șterge altfel CUI-ul salvat (0213).
      cui_statie: String(date.get("cui_statie") ?? "").trim() || null,
      alimentat_la: String(date.get("alimentat_la") ?? ""),
      plin: date.get("plin") === "on",
      observatii: String(date.get("observatii") ?? "").trim() || null,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: <Pencil aria-hidden="true" className="size-4" />,
        varianta: "tertiar",
        marime: "iconita",
        "aria-label": `Modifică alimentarea de ${String(alimentare.litri)} litri`,
      }}
      titlu="Modifică alimentarea"
      descriere="Alimentările se corectează doar cât foaia e ciornă."
      actiune={trimite}
      mesajReusita="Alimentarea a fost modificată."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="alimentat_la"
            id={idc("alimentat_la")}
            eticheta="Când"
            obligatoriu
            erori={stare.erori["alimentat_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                defaultValue={
                  stare.valoriTrimise["alimentat_la"] ??
                  oraRomanieiPentruCamp(alimentare.alimentat_la)
                }
              />
            )}
          </Camp>
          <Camp
            nume="litri"
            id={idc("litri")}
            eticheta="Litri"
            obligatoriu
            erori={stare.erori["litri"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={stare.valoriTrimise["litri"] ?? String(alimentare.litri)}
              />
            )}
          </Camp>
          <Camp
            nume="cost"
            id={idc("cost")}
            eticheta="Cost (lei)"
            obligatoriu
            erori={stare.erori["cost"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="0.01"
                defaultValue={stare.valoriTrimise["cost"] ?? String(alimentare.cost)}
              />
            )}
          </Camp>
          <Camp
            nume="statie"
            id={idc("statie")}
            eticheta="Stație"
            erori={stare.erori["statie"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={120}
                defaultValue={stare.valoriTrimise["statie"] ?? alimentare.statie ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="numar_bon"
            id={idc("numar_bon")}
            eticheta="Număr bon"
            erori={stare.erori["numar_bon"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={60}
                defaultValue={stare.valoriTrimise["numar_bon"] ?? alimentare.numar_bon ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="cui_statie"
            id={idc("cui_statie")}
            eticheta="CUI stație"
            ajutor="Codul fiscal al stației, de pe bon. Opțional."
            erori={stare.erori["cui_statie"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={20}
                inputMode="numeric"
                defaultValue={stare.valoriTrimise["cui_statie"] ?? alimentare.cui_statie ?? ""}
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
                defaultValue={stare.valoriTrimise["observatii"] ?? alimentare.observatii ?? ""}
              />
            )}
          </Camp>
          <label className="text-corp flex items-center gap-2">
            <input
              type="checkbox"
              name="plin"
              className="size-4"
              defaultChecked={
                stare.valoriTrimise["plin"] === undefined
                  ? alimentare.plin
                  : stare.valoriTrimise["plin"] === "on"
              }
            />
            Plin făcut
          </label>
        </div>
      )}
    </FormularDialog>
  );
}
