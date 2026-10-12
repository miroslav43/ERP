"use client";

import { RefreshCw } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { STATUS_ECHIPAMENT, type StatusEchipament } from "@/schemas/maintenance";

import { ETICHETE_STATUS_ECHIPAMENT, EXPLICATII_STATUS_ECHIPAMENT } from "../../etichete";
import { schimbaStareEchipament } from "../actions";

/**
 * Starea echipamentului, cu gestul ei: conservare, repunere, casare. Casarea
 * cere motiv și e refuzată de bază cât există sesizări deschise — mesajul
 * gărzii ajunge pe ecran, cu numărul lor.
 */
export function ButonSchimbaStarea({
  echipamentId,
  statusCurent,
  azi,
}: Readonly<{ echipamentId: string; statusCurent: StatusEchipament; azi: string }>): ReactElement {
  const [tinta, setTinta] = useState<StatusEchipament>(
    statusCurent === "casat"
      ? "in_functiune"
      : statusCurent === "in_functiune"
        ? "in_conservare"
        : "in_functiune",
  );

  async function trimite(date: FormData) {
    const status = String(date.get("status") ?? "");
    const motiv = String(date.get("motiv_casare") ?? "").trim();
    const casatLa = String(date.get("casat_la") ?? "").trim();
    return schimbaStareEchipament({
      id: echipamentId,
      status,
      casat_la: status === "casat" && casatLa.length > 0 ? casatLa : null,
      motiv_casare: status === "casat" && motiv.length > 0 ? motiv : null,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Schimbă starea",
        varianta: "secundar",
        pictograma: <RefreshCw aria-hidden="true" className="size-4" />,
      }}
      titlu="Schimbați starea echipamentului"
      descriere={`Acum: „${ETICHETE_STATUS_ECHIPAMENT[statusCurent]}”. Alegeți starea nouă; casarea e definitivă în evidența curentă (fișa și istoricul rămân).`}
      marime="mediu"
      actiune={trimite}
      mesajReusita="Starea echipamentului a fost schimbată."
      etichetaTrimite="Schimbă starea"
      variantaTrimite={tinta === "casat" ? "distructiv" : "primar"}
      textInCurs="Se salvează…"
      laResetare={() => {
        setTinta(statusCurent === "in_functiune" ? "in_conservare" : "in_functiune");
      }}
    >
      {(stare, idc) => (
        <>
          <Camp
            nume="status"
            id={idc("status")}
            eticheta="Starea nouă"
            fel="select"
            ajutor={EXPLICATII_STATUS_ECHIPAMENT[tinta]}
            erori={stare.erori["status"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={tinta}
                onChange={(e) => {
                  setTinta(e.target.value as StatusEchipament);
                }}
              >
                {STATUS_ECHIPAMENT.filter((s) => s !== statusCurent).map((s) => (
                  <option key={s} value={s}>
                    {ETICHETE_STATUS_ECHIPAMENT[s]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          {tinta === "casat" ? (
            <>
              <Camp
                nume="casat_la"
                id={idc("casat-la")}
                eticheta="Data casării"
                ajutor="Lăsați gol pentru azi."
                erori={stare.erori["casat_la"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    max={azi}
                    defaultValue={stare.valoriTrimise["casat_la"] ?? ""}
                  />
                )}
              </Camp>
              <Camp
                nume="motiv_casare"
                id={idc("motiv")}
                eticheta="Motivul casării"
                obligatoriu
                fel="textarea"
                ajutor="Cel puțin 5 caractere: uzură, cost de reparație, înlocuire, accident."
                erori={stare.erori["motiv_casare"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={3}
                    maxLength={1000}
                    defaultValue={stare.valoriTrimise["motiv_casare"] ?? ""}
                  />
                )}
              </Camp>
            </>
          ) : null}
        </>
      )}
    </FormularDialog>
  );
}
