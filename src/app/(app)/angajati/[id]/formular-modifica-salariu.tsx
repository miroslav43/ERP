// src/app/(app)/angajati/[id]/formular-modifica-salariu.tsx
"use client";

import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import { formatLei } from "@/lib/format/money";
import { modificaSalariulContractului } from "../actions";

/**
 * Modificarea salariului de bază = un act adițional la contract.
 *
 * Caseta cere ce cere actul: salariul nou, data de la care se aplică și data
 * semnării. La salvare se creează actul (contractul inițial rămâne cum a fost
 * semnat), se emite documentul lui și se pune modificarea în coada
 * REGES-Online. Descrierea o spune înainte de apăsare, nu după.
 *
 * Datele implicite vin de pe server (`azi`, `primaZiLunaUrmatoare`), nu din
 * ceasul browserului: altfel randarea de pe server și cea din browser ar putea
 * da zile diferite în jurul miezului nopții.
 */

interface Proprietati {
  readonly contractId: string;
  /** Salariul ÎN VIGOARE azi — al ultimului act adițional, dacă există. */
  readonly salariuActual: number;
  readonly azi: string;
  readonly primaZiLunaUrmatoare: string;
}

export function FormularModificaSalariu({
  contractId,
  salariuActual,
  azi,
  primaZiLunaUrmatoare,
}: Proprietati) {
  /** Cheile obiectului sunt EXACT cele din `modificaSalariuContractSchema`. */
  async function trimite(date: FormData) {
    return modificaSalariulContractului({
      contract_id: contractId,
      salariu_baza: Number(date.get("salariu_baza")),
      valabil_de_la: String(date.get("valabil_de_la") ?? ""),
      data_act: String(date.get("data_act") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{ eticheta: "Modifică salariul", varianta: "secundar", className: "mt-3" }}
      titlu="Modificarea salariului — act adițional"
      descriere={`Salariul în vigoare este ${formatLei(salariuActual)}. La salvare se încheie un act adițional la contract: se emite documentul lui și modificarea intră în coada REGES-Online. Contractul inițial rămâne neschimbat.`}
      marime="mediu"
      actiune={trimite}
      etichetaTrimite="Încheie actul adițional"
      textInCurs="Se înregistrează…"
      laReusita={(data) => {
        arataToast({
          fel: data.avertismente.length === 0 ? "reusita" : "informativ",
          text:
            data.document === null
              ? `Actul adițional nr. ${data.numar} a fost înregistrat.`
              : `Actul adițional nr. ${data.numar} a fost înregistrat; documentul ${data.document} e în dosar.`,
        });
        for (const avertisment of data.avertismente) {
          arataToast({ fel: "informativ", text: avertisment });
        }
      }}
    >
      {(stare, idc) => (
        <div className="space-y-4">
          <Camp
            nume="salariu_baza"
            id={idc("salariu_baza")}
            eticheta="Salariu de bază nou (lei)"
            obligatoriu
            erori={stare.erori["salariu_baza"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                step="0.01"
                min={0}
                defaultValue={stare.valoriTrimise["salariu_baza"] ?? salariuActual}
              />
            )}
          </Camp>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Camp
              nume="valabil_de_la"
              id={idc("valabil_de_la")}
              eticheta="Se aplică de la"
              obligatoriu
              ajutor="Salarizarea folosește salariul nou din luna acestei date."
              erori={stare.erori["valabil_de_la"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  defaultValue={stare.valoriTrimise["valabil_de_la"] ?? primaZiLunaUrmatoare}
                />
              )}
            </Camp>
            <Camp
              nume="data_act"
              id={idc("data_act")}
              eticheta="Data actului adițional"
              obligatoriu
              ajutor="Ziua semnării — cel târziu ziua de la care se aplică."
              erori={stare.erori["data_act"] ?? []}
            >
              {(a) => (
                <input {...a} type="date" defaultValue={stare.valoriTrimise["data_act"] ?? azi} />
              )}
            </Camp>
          </div>
          <Callout fel="informativ" titlu="Fluturașii deja calculați nu se schimbă">
            Dacă data aplicării cade într-o lună deja calculată, recalculați luna din Salarizare.
          </Callout>
        </div>
      )}
    </FormularDialog>
  );
}
