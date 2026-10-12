"use client";

import { UserCheck } from "lucide-react";
import type { ReactElement } from "react";

import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { OptiuneSofer } from "@/lib/queries/flota-amenzi";

import { desemneazaSofer } from "../actions-amenzi";

type Proprietati = Readonly<{
  amendaId: string;
  soferi: readonly OptiuneSofer[];
  /**
   * Sugestia lui `app.sofer_la`: șoferul și ce o sprijină („după foaia de
   * parcurs…”). `null` = nicio foaie și nicio alocare la momentul faptei.
   */
  sugestie: Readonly<{ employeeId: string; text: string }> | null;
  /** Șoferul deja desemnat, când caseta schimbă desemnarea. */
  curentId: string | null;
}>;

function eticheta(s: OptiuneSofer): string {
  const marca = s.marca === null ? "" : ` (${s.marca})`;
  return `${s.full_name}${marca}${s.status === "activ" ? "" : " — nu mai e activ"}`;
}

/**
 * Alegerea șoferului comunicat autorității (OUG 195/2002 art. 39). Sugestia
 * precompletează selectorul, dar OMUL alege: foaia sau alocarea pot greși
 * (cineva a condus pe mașina altuia, foaia nu s-a completat).
 *
 * Cheile trimise sunt EXACT cele din `desemneazaSoferSchema`.
 */
export function DialogDesemnare({
  amendaId,
  soferi,
  sugestie,
  curentId,
}: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return desemneazaSofer({
      id: amendaId,
      employee_id: String(date.get("employee_id") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: curentId === null ? "Desemnează șoferul" : "Schimbă șoferul desemnat",
        varianta: curentId === null ? "primar" : "secundar",
        pictograma: <UserCheck aria-hidden="true" className="size-4" />,
      }}
      titlu="Cine conducea vehiculul"
      descriere="Firma comunică autorității datele persoanei căreia i-a încredințat vehiculul (OUG 195/2002 art. 39). Alegeți șoferul de la momentul faptei."
      actiune={trimite}
      mesajReusita="Șoferul a fost desemnat."
      etichetaTrimite="Desemnează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="space-y-4">
          {sugestie === null ? (
            <Callout fel="informativ" titlu="Nicio sugestie">
              <p>
                Aplicația nu a găsit nicio foaie de parcurs și nicio alocare a vehiculului pentru
                momentul faptei. Alegeți șoferul din listă.
              </p>
            </Callout>
          ) : (
            <Callout fel="informativ" titlu="Sugestie">
              <p>{sugestie.text} Verificați înainte de a confirma.</p>
            </Callout>
          )}
          <Camp
            nume="employee_id"
            id={idc("employee_id")}
            eticheta="Șofer"
            fel="select"
            obligatoriu
            erori={stare.erori["employee_id"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={
                  stare.valoriTrimise["employee_id"] ?? curentId ?? sugestie?.employeeId ?? ""
                }
              >
                <option value="" disabled>
                  Alegeți angajatul
                </option>
                {soferi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {eticheta(s)}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
