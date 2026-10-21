"use client";

// src/app/(portal)/portal/masina-mea/dialog-declaratie-incident.tsx
//
// Declarația șoferului (0206 §F): „mi s-a întâmplat ceva cu mașina”. Cheile
// trimise sunt EXACT cele din `declaratieIncidentSchema`. Vehiculele oferite
// sunt mașina lui și cele din pool — aceleași pe care le acceptă baza
// (`app.vehicul_al_meu_la`); costurile și asigurătorul le scrie responsabilul.

import { TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";

import { ETICHETE_TIP_INCIDENT, TIPURI_INCIDENT } from "@/domain/fleet/amenzi";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import { declaraIncident } from "@/app/(app)/flota/actions-amenzi";

export type VehiculDeclarabil = Readonly<{
  id: string;
  nr_inmatriculare: string;
  /** Mașina comună: o poate declara oricine o folosește. */
  pool: boolean;
}>;

type Proprietati = Readonly<{
  vehicule: readonly VehiculDeclarabil[];
  /** Caseta pornește deschisă (`?incident=nou`); se citește o singură dată. */
  deschisInitial?: boolean;
}>;

export function DialogDeclaratieIncident({
  vehicule,
  deschisInitial = false,
}: Proprietati): ReactElement {
  const implicit = vehicule.length === 1 ? (vehicule[0]?.id ?? "") : "";

  async function trimite(date: FormData) {
    return declaraIncident({
      vehicle_id: String(date.get("vehicle_id") ?? ""),
      tip: String(date.get("tip") ?? ""),
      produs_la: String(date.get("produs_la") ?? ""),
      locul: String(date.get("locul") ?? ""),
      descriere: String(date.get("descriere") ?? ""),
    });
  }

  return (
    <FormularDialog
      {...(deschisInitial ? { deschisInitial: true } : {})}
      declansator={{
        eticheta: "Declar un incident",
        varianta: "secundar",
        pictograma: <TriangleAlert aria-hidden="true" className="size-4" />,
      }}
      titlu="Incident sau daună pe mașină"
      descriere="Spuneți ce s-a întâmplat: responsabilul de flotă primește declarația și se ocupă de constatare, asigurător și reparație. Declarația nu înseamnă vinovăție."
      actiune={trimite}
      mesajReusita="Declarația a fost trimisă responsabilului de flotă."
      etichetaTrimite="Trimite declarația"
      textInCurs="Se trimite…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="vehicle_id"
            id={idc("vehicle_id")}
            eticheta="Mașina"
            fel="select"
            obligatoriu
            className="sm:col-span-2"
            ajutor="Mașina primită în folosință sau una din cele comune."
            erori={stare.erori["vehicle_id"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["vehicle_id"] ?? implicit}>
                <option value="" disabled>
                  Alegeți mașina
                </option>
                {vehicule.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nr_inmatriculare}
                    {v.pool ? " (mașină comună)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="tip"
            id={idc("tip")}
            eticheta="Ce s-a întâmplat"
            fel="select"
            obligatoriu
            erori={stare.erori["tip"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["tip"] ?? "avarie"}>
                {TIPURI_INCIDENT.map((t) => (
                  <option key={t} value={t}>
                    {ETICHETE_TIP_INCIDENT[t]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="produs_la"
            id={idc("produs_la")}
            eticheta="Când"
            obligatoriu
            erori={stare.erori["produs_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                defaultValue={stare.valoriTrimise["produs_la"] ?? oraRomanieiPentruCamp(new Date())}
              />
            )}
          </Camp>
          <Camp
            nume="locul"
            id={idc("locul")}
            eticheta="Unde"
            className="sm:col-span-2"
            erori={stare.erori["locul"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                defaultValue={stare.valoriTrimise["locul"] ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="descriere"
            id={idc("descriere")}
            eticheta="Descrierea"
            fel="textarea"
            obligatoriu
            className="sm:col-span-2"
            ajutor="Ce s-a lovit sau s-a stricat, cum s-a întâmplat, dacă a mai fost implicat cineva."
            erori={stare.erori["descriere"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={2000}
                rows={4}
                defaultValue={stare.valoriTrimise["descriere"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
