"use client";

import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { IntrareDurata, IntrareOra } from "@/components/ui/intrare-ora";
import { REZULTATE_INTERVENTIE, TIPURI_MENTENANTA } from "@/schemas/maintenance";

import { ETICHETE_REZULTAT_INTERVENTIE, ETICHETE_TIP_MENTENANTA } from "../etichete";

export interface OptiuneInterventie {
  readonly id: string;
  readonly nume: string;
}

export interface ProprietatiCampuriInterventie<TData> {
  readonly stare: StareFormular<TData>;
  readonly idc: (sufix: string) => string;
  readonly angajati: readonly OptiuneInterventie[];
  /** Planurile active ale echipamentului. Absent ⇒ fără câmpul „Din planul” (ex. rezolvarea unei sesizări). */
  readonly planuri?: readonly OptiuneInterventie[] | undefined;
  /** Planul preselectat — „Execută” de pe un plan. */
  readonly planImplicit?: string | undefined;
  readonly tipImplicit?: "preventiva" | "predictiva" | "corectiva";
  /** Data pre-completată (ISO) — „Rezolvă” pune ziua de azi. */
  readonly dataImplicita?: string | undefined;
}

/**
 * Câmpurile unei intervenții de mentenanță, scrise o singură dată pentru trei
 * casete: intervenția de pe fișa echipamentului, „Execută" de pe plan și
 * „Rezolvă" de pe sesizare.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Rezolvarea unei sesizări avea propriul formular inline, cu CINCI dintre cele
 * treisprezece câmpuri și restul fixate pe `null`: cine rezolva o defecțiune nu
 * putea spune cine a lucrat, cât a durat, ce citire avea contorul sau cât a
 * stat utilajul oprit — exact datele din care se calculează costul și
 * disponibilitatea. Acum toate casetele au aceleași câmpuri.
 *
 * ── DE CE `id` EXPLICIT ───────────────────────────────────────────────────
 * `Camp` derivă identificatorul din `nume`, iar fișa echipamentului randează
 * mai multe formulare simultan (`tip` apare în patru, `observatii` în două).
 * Prefixul `idc` din `useId()` ține identificatorii distincți.
 */
export function CampuriInterventie<TData>({
  stare,
  idc,
  angajati,
  planuri,
  planImplicit,
  tipImplicit = "corectiva",
  dataImplicita,
}: ProprietatiCampuriInterventie<TData>): ReactElement {
  // Formularul rămâne pe ecran după un refuz, deci repornește de la ce s-a
  // trimis; după reușită caseta se demontează și `trimise` nu mai contează.
  const trimise: Readonly<Record<string, string>> = stare.data === null ? stare.valoriTrimise : {};

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {planuri === undefined ? null : (
        <Camp
          nume="plan_id"
          id={idc("plan")}
          eticheta="Din planul"
          fel="select"
          erori={stare.erori["plan_id"] ?? []}
        >
          {(a) => (
            <select {...a} defaultValue={trimise["plan_id"] ?? planImplicit ?? ""}>
              <option value="">Fără plan (intervenție de sine stătătoare)</option>
              {planuri.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nume}
                </option>
              ))}
            </select>
          )}
        </Camp>
      )}

      <Camp nume="tip" id={idc("tip")} eticheta="Tip" fel="select" erori={stare.erori["tip"] ?? []}>
        {(a) => (
          <select {...a} defaultValue={trimise["tip"] ?? tipImplicit}>
            {TIPURI_MENTENANTA.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_MENTENANTA[t]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="data"
        id={idc("data")}
        eticheta="Data"
        obligatoriu
        erori={stare.erori["data"] ?? []}
      >
        {(a) => <input {...a} type="date" defaultValue={trimise["data"] ?? dataImplicita ?? ""} />}
      </Camp>

      <Camp
        nume="ora_start"
        id={idc("ora-start")}
        eticheta="Ora de început"
        erori={stare.erori["ora_start"] ?? []}
      >
        {(a) => <IntrareOra {...a} implicit={trimise["ora_start"] ?? ""} />}
      </Camp>

      <Camp
        nume="durata_ore"
        id={idc("durata")}
        eticheta="Durata"
        ajutor="Ore și minute, de pildă 1:30."
        erori={stare.erori["durata_ore"] ?? []}
      >
        {(a) => (
          <IntrareDurata
            {...a}
            implicit={
              trimise["durata_ore"] === undefined || trimise["durata_ore"] === ""
                ? null
                : Number(trimise["durata_ore"])
            }
          />
        )}
      </Camp>

      <Camp
        nume="executant_employee_id"
        id={idc("executant-angajat")}
        eticheta="Executant (angajat)"
        fel="select"
        erori={stare.erori["executant_employee_id"] ?? []}
      >
        {(a) => (
          <select {...a} defaultValue={trimise["executant_employee_id"] ?? ""}>
            <option value="">—</option>
            {angajati.map((ang) => (
              <option key={ang.id} value={ang.id}>
                {ang.nume}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="executant_extern"
        id={idc("executant-extern")}
        eticheta="Executant (firmă externă)"
        erori={stare.erori["executant_extern"] ?? []}
      >
        {(a) => <input {...a} maxLength={200} defaultValue={trimise["executant_extern"] ?? ""} />}
      </Camp>

      <Camp
        nume="descriere"
        id={idc("descriere")}
        eticheta="Ce s-a făcut"
        fel="textarea"
        obligatoriu
        className="sm:col-span-2 lg:col-span-3"
        erori={stare.erori["descriere"] ?? []}
      >
        {(a) => (
          <textarea {...a} rows={2} maxLength={2000} defaultValue={trimise["descriere"] ?? ""} />
        )}
      </Camp>

      <Camp
        nume="piese"
        id={idc("piese")}
        eticheta="Piese folosite"
        fel="textarea"
        className="sm:col-span-2 lg:col-span-3"
        erori={stare.erori["piese"] ?? []}
      >
        {(a) => <textarea {...a} rows={2} maxLength={2000} defaultValue={trimise["piese"] ?? ""} />}
      </Camp>

      <Camp
        nume="cost_piese"
        id={idc("cost-piese")}
        eticheta="Cost piese (lei)"
        erori={stare.erori["cost_piese"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            defaultValue={trimise["cost_piese"] ?? "0"}
          />
        )}
      </Camp>

      <Camp
        nume="cost_manopera"
        id={idc("cost-manopera")}
        eticheta="Cost manoperă (lei)"
        erori={stare.erori["cost_manopera"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            defaultValue={trimise["cost_manopera"] ?? "0"}
          />
        )}
      </Camp>

      <Camp
        nume="rezultat"
        id={idc("rezultat")}
        eticheta="Rezultat"
        fel="select"
        erori={stare.erori["rezultat"] ?? []}
      >
        {(a) => (
          <select {...a} defaultValue={trimise["rezultat"] ?? "reusita"}>
            {REZULTATE_INTERVENTIE.map((r) => (
              <option key={r} value={r}>
                {ETICHETE_REZULTAT_INTERVENTIE[r]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="oprire_minute"
        id={idc("oprire-minute")}
        eticheta="Oprire (minute)"
        erori={stare.erori["oprire_minute"] ?? []}
      >
        {(a) => (
          <input {...a} type="number" min="0" defaultValue={trimise["oprire_minute"] ?? ""} />
        )}
      </Camp>

      <Camp
        nume="citire_contor"
        id={idc("citire-contor")}
        eticheta="Citire contor la momentul intervenției"
        erori={stare.erori["citire_contor"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            defaultValue={trimise["citire_contor"] ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="observatii"
        id={idc("observatii")}
        eticheta="Observații"
        fel="textarea"
        className="sm:col-span-2 lg:col-span-3"
        erori={stare.erori["observatii"] ?? []}
      >
        {(a) => (
          <textarea {...a} rows={2} maxLength={2000} defaultValue={trimise["observatii"] ?? ""} />
        )}
      </Camp>
    </div>
  );
}
