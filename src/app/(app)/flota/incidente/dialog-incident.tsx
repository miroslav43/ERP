"use client";

import { Pencil, TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";

import { ETICHETE_TIP_INCIDENT, TIPURI_INCIDENT } from "@/domain/fleet/amenzi";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type {
  CercetareSsm,
  OptiuneSofer,
  OptiuneVehiculAmenda,
  RandIncident,
} from "@/lib/queries/flota-amenzi";

import { actualizeazaIncident, raporteazaIncident } from "../actions-amenzi";

type Proprietati = Readonly<{
  soferi: readonly OptiuneSofer[];
  /** Caseta pornește deschisă (linkul `?incident=nou`); se citește o singură dată. */
  deschisInitial?: boolean;
}> &
  (
    | Readonly<{
        fel: "nou";
        vehicule: readonly OptiuneVehiculAmenda[];
        vehiculImplicit?: string | null;
      }>
    | Readonly<{
        fel: "corectura";
        incident: RandIncident;
        /** Cercetările SSM pe care apelantul le poate citi; gol = fără acces SSM. */
        cercetari: readonly CercetareSsm[];
        /**
         * Cercetarea legată ACUM de incident, dacă apelantul o poate citi. Lista
         * `cercetari` e limitată și trece prin RLS-ul SSM, deci poate să n-o
         * cuprindă: fără opțiunea ei, salvarea ar șterge legătura pe tăcute.
         */
        cercetareLegata?: CercetareSsm | null;
        /** Șoferul sugerat de `app.sofer_la`, când incidentul n-are încă unul. */
        sugestieSoferId: string | null;
      }>
  );

function etichetaCercetare(c: CercetareSsm): string {
  return `${c.numar_intern ?? "fără număr"} — ${c.data_producerii}, ${c.locul}`;
}

function etichetaSofer(s: OptiuneSofer): string {
  const marca = s.marca === null ? "" : ` (${s.marca})`;
  return `${s.full_name}${marca}${s.status === "activ" ? "" : " — nu mai e activ"}`;
}

/**
 * Raportarea sau corectura unui incident / a unei daune (0206). Cheile trimise
 * sunt EXACT cele din `incidentNouSchema` / `actualizeazaIncidentSchema`.
 * Stadiul NU se schimbă de aici: are caseta lui (`DialogStadiuIncident`).
 */
export function DialogIncident(props: Proprietati): ReactElement {
  const corectura = props.fel === "corectura" ? props.incident : null;
  const cercetari = props.fel === "corectura" ? props.cercetari : [];
  const cercetareLegata = props.fel === "corectura" ? (props.cercetareLegata ?? null) : null;
  // Legăturile existente care nu mai sunt în listele de alegere trebuie păstrate:
  // un `<select defaultValue>` fără opțiunea potrivită cade pe prima opțiune
  // („fără legătură”) și ar șterge legătura la o simplă corectură de descriere.
  const cercetareLipsa =
    corectura?.work_accident_id != null &&
    !cercetari.some((c) => c.id === corectura.work_accident_id);
  const soferLipsa =
    corectura?.sofer_id != null && !props.soferi.some((s) => s.id === corectura.sofer_id);

  async function trimite(date: FormData) {
    const comune = {
      tip: String(date.get("tip") ?? ""),
      produs_la: String(date.get("produs_la") ?? ""),
      locul: String(date.get("locul") ?? ""),
      descriere: String(date.get("descriere") ?? ""),
      sofer_id: String(date.get("sofer_id") ?? ""),
      cost_estimat: String(date.get("cost_estimat") ?? ""),
      observatii: String(date.get("observatii") ?? ""),
    };
    if (corectura !== null) {
      return actualizeazaIncident({
        id: corectura.id,
        ...comune,
        despagubire: String(date.get("despagubire") ?? ""),
        asigurator: String(date.get("asigurator") ?? ""),
        dosar_numar: String(date.get("dosar_numar") ?? ""),
        work_accident_id: String(date.get("work_accident_id") ?? ""),
      });
    }
    return raporteazaIncident({ vehicle_id: String(date.get("vehicle_id") ?? ""), ...comune });
  }

  return (
    <FormularDialog
      {...(props.deschisInitial === true ? { deschisInitial: true } : {})}
      declansator={
        corectura === null
          ? {
              eticheta: "Incident nou",
              varianta: "primar",
              pictograma: <TriangleAlert aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: "Corectează detaliile",
              varianta: "secundar",
              pictograma: <Pencil aria-hidden="true" className="size-4" />,
            }
      }
      titlu={corectura === null ? "Incident sau daună pe un vehicul" : "Detaliile incidentului"}
      descriere={
        corectura === null
          ? "Raportați accidentul, avaria, furtul sau vandalismul. Stadiile (constatat, la asigurător, în reparație, închis) se parcurg apoi, pe fișa incidentului."
          : "Vehiculul nu se schimbă. Stadiul se schimbă din butonul lui, nu de aici."
      }
      actiune={trimite}
      mesajReusita={
        corectura === null ? "Incidentul a fost raportat." : "Incidentul a fost corectat."
      }
      etichetaTrimite={corectura === null ? "Raportează incidentul" : "Salvează detaliile"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {props.fel === "nou" ? (
            <Camp
              nume="vehicle_id"
              id={idc("vehicle_id")}
              eticheta="Vehicul"
              fel="select"
              obligatoriu
              className="sm:col-span-2"
              erori={stare.erori["vehicle_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={stare.valoriTrimise["vehicle_id"] ?? props.vehiculImplicit ?? ""}
                >
                  <option value="" disabled>
                    Alegeți vehiculul
                  </option>
                  {props.vehicule.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nr_inmatriculare} — {v.marca} {v.model}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          ) : null}
          <Camp
            nume="tip"
            id={idc("tip")}
            eticheta="Tipul"
            fel="select"
            obligatoriu
            erori={stare.erori["tip"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={stare.valoriTrimise["tip"] ?? corectura?.tip ?? "avarie"}
              >
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
            eticheta="Momentul incidentului"
            obligatoriu
            erori={stare.erori["produs_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                defaultValue={
                  stare.valoriTrimise["produs_la"] ??
                  (corectura === null
                    ? oraRomanieiPentruCamp(new Date())
                    : oraRomanieiPentruCamp(corectura.produs_la))
                }
              />
            )}
          </Camp>
          <Camp nume="locul" id={idc("locul")} eticheta="Locul" erori={stare.erori["locul"] ?? []}>
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                defaultValue={stare.valoriTrimise["locul"] ?? corectura?.locul ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="sofer_id"
            id={idc("sofer_id")}
            eticheta="Șoferul de atunci"
            fel="select"
            ajutor="Nu înseamnă vinovăție: spune doar cine conducea."
            erori={stare.erori["sofer_id"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={
                  stare.valoriTrimise["sofer_id"] ??
                  corectura?.sofer_id ??
                  (props.fel === "corectura" ? (props.sugestieSoferId ?? "") : "")
                }
              >
                <option value="">— Nu se știe —</option>
                {soferLipsa && corectura?.sofer_id != null ? (
                  <option value={corectura.sofer_id}>
                    Șoferul legat acum (nu mai apare în listă)
                  </option>
                ) : null}
                {props.soferi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {etichetaSofer(s)}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="descriere"
            id={idc("descriere")}
            eticheta="Descrierea"
            fel="textarea"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["descriere"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={2000}
                rows={3}
                defaultValue={stare.valoriTrimise["descriere"] ?? corectura?.descriere ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="cost_estimat"
            id={idc("cost_estimat")}
            eticheta="Costul estimat (lei)"
            erori={stare.erori["cost_estimat"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={
                  stare.valoriTrimise["cost_estimat"] ??
                  (corectura?.cost_estimat == null ? "" : String(corectura.cost_estimat))
                }
              />
            )}
          </Camp>
          {corectura === null ? null : (
            <>
              <Camp
                nume="despagubire"
                id={idc("despagubire")}
                eticheta="Despăgubirea primită (lei)"
                erori={stare.erori["despagubire"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    defaultValue={
                      stare.valoriTrimise["despagubire"] ??
                      (corectura.despagubire == null ? "" : String(corectura.despagubire))
                    }
                  />
                )}
              </Camp>
              <Camp
                nume="asigurator"
                id={idc("asigurator")}
                eticheta="Asigurătorul"
                erori={stare.erori["asigurator"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={200}
                    defaultValue={stare.valoriTrimise["asigurator"] ?? corectura.asigurator ?? ""}
                  />
                )}
              </Camp>
              <Camp
                nume="dosar_numar"
                id={idc("dosar_numar")}
                eticheta="Numărul dosarului de daună"
                erori={stare.erori["dosar_numar"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={60}
                    defaultValue={stare.valoriTrimise["dosar_numar"] ?? corectura.dosar_numar ?? ""}
                  />
                )}
              </Camp>
              <Camp
                nume="work_accident_id"
                id={idc("work_accident_id")}
                eticheta="Cercetarea SSM (dacă a fost vătămare)"
                fel="select"
                className="sm:col-span-2"
                ajutor={
                  props.fel === "corectura" && props.cercetari.length === 0
                    ? "Nicio cercetare SSM disponibilă (sau nu aveți acces la modulul SSM)."
                    : "Doar cercetările din modulul SSM pe care le puteți citi."
                }
                erori={stare.erori["work_accident_id"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={
                      stare.valoriTrimise["work_accident_id"] ?? corectura.work_accident_id ?? ""
                    }
                  >
                    <option value="">— Fără legătură —</option>
                    {cercetareLipsa && corectura?.work_accident_id != null ? (
                      <option value={corectura.work_accident_id}>
                        {cercetareLegata === null
                          ? "Cercetarea legată acum (indisponibilă pentru contul dumneavoastră)"
                          : etichetaCercetare(cercetareLegata)}
                      </option>
                    ) : null}
                    {cercetari.map((c) => (
                      <option key={c.id} value={c.id}>
                        {etichetaCercetare(c)}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
            </>
          )}
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
                defaultValue={stare.valoriTrimise["observatii"] ?? corectura?.observatii ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
