"use client";

import { Gauge } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";
import { TIPURI_CONTOR, type TipContor } from "@/schemas/maintenance";
import { inregistreazaContor } from "@/app/(app)/mentenanta/actions";
import { ETICHETE_TIP_CONTOR } from "@/app/(app)/mentenanta/etichete";

/**
 * Citirea de contor din portal, de către responsabilul utilajului. Politica de
 * INSERT (0182) îl lasă doar pe utilajele lui; garda refuză regresul.
 */
export function DialogCitireRapida({
  echipament,
  fisaId,
  tipImplicit,
  azi,
}: Readonly<{
  echipament: Readonly<{ id: string; cod: string; denumire: string }>;
  fisaId: string;
  tipImplicit: TipContor;
  azi: string;
}>): ReactElement {
  async function trimite(date: FormData) {
    return inregistreazaContor({
      equipment_id: echipament.id,
      tip: String(date.get("tip") ?? tipImplicit),
      citire: String(date.get("citire") ?? ""),
      data_citirii: String(date.get("data_citirii") ?? azi),
      resetare_contor: false,
      sursa: "portal",
      citit_de_employee_id: fisaId,
      observatii: null,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Citire contor",
        varianta: "secundar",
        pictograma: <Gauge aria-hidden="true" className="size-4" />,
      }}
      titlu={`Citire contor — ${echipament.cod}`}
      descriere={`${echipament.denumire}. Citirea merge numai înainte: o valoare mai mică decât ultima e refuzată.`}
      marime="mic"
      actiune={trimite}
      mesajReusita="Citirea a fost înregistrată."
      etichetaTrimite="Salvează citirea"
      textInCurs="Se salvează…"
      laReusita={(date: Readonly<{ avertismentSalt: string | null }>) => {
        if (date.avertismentSalt !== null)
          arataToast({ fel: "informativ", text: date.avertismentSalt });
      }}
    >
      {(stare, idc) => (
        <>
          <Camp
            nume="tip"
            id={idc("tip")}
            eticheta="Contor"
            fel="select"
            erori={stare.erori["tip"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["tip"] ?? tipImplicit}>
                {TIPURI_CONTOR.map((t) => (
                  <option key={t} value={t}>
                    {ETICHETE_TIP_CONTOR[t]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
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
                inputMode="decimal"
                defaultValue={stare.valoriTrimise["citire"] ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="data_citirii"
            id={idc("data")}
            eticheta="Data"
            obligatoriu
            erori={stare.erori["data_citirii"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="date"
                max={azi}
                defaultValue={stare.valoriTrimise["data_citirii"] ?? azi}
              />
            )}
          </Camp>
        </>
      )}
    </FormularDialog>
  );
}
