"use client";

import type { ReactElement } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { IntrareDurata, IntrareOra } from "@/components/ui/intrare-ora";
import {
  LIMITA_DOCUMENT_MENTENANTA_BYTES,
  MIME_DOCUMENT_MENTENANTA,
  REZULTATE_INTERVENTIE,
  TIPURI_ATASAMENT_INTERVENTIE,
  TIPURI_MENTENANTA,
  type TipMentenanta,
} from "@/schemas/maintenance";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_TIP_ATASAMENT,
  ETICHETE_TIP_MENTENANTA,
} from "../etichete";

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
  /** Tipul preselectat — „Execută” de pe plan îl ia din plan (inclusiv `verificare_legala`). */
  readonly tipImplicit?: TipMentenanta;
  /** Data pre-completată (ISO) — „Rezolvă” pune ziua de azi. */
  readonly dataImplicita?: string | undefined;
  /**
   * Valorile intervenției EXISTENTE, ca text (forma din `FormData`), pentru
   * caseta de corectare. Ce s-a trimis deja are prioritate peste ele.
   */
  readonly existenta?: Readonly<Record<string, string>> | undefined;
  /** Intervenția are linii de piese: `cost_piese` e calculat din ele (cazul 32). */
  readonly costPieseDinLinii?: boolean | undefined;
  /**
   * Câmpul de document (PV, buletin, factură) urcat ÎNAINTE de trimitere.
   * `obligatoriu`: verificare legală — acțiunea refuză fără PV/buletin (cazul 34).
   */
  readonly document?: Readonly<{ obligatoriu: boolean }> | undefined;
}

const ACCEPT_DOCUMENT = MIME_DOCUMENT_MENTENANTA.join(",");

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
  existenta,
  costPieseDinLinii = false,
  document,
}: ProprietatiCampuriInterventie<TData>): ReactElement {
  // Formularul rămâne pe ecran după un refuz, deci repornește de la ce s-a
  // trimis; după reușită caseta se demontează și `trimise` nu mai contează.
  // Pe o corectare, valorile intervenției existente vin înaintea implicitelor.
  const dinTrimitere: Readonly<Record<string, string>> =
    stare.data === null ? stare.valoriTrimise : {};
  const trimise: Readonly<Record<string, string>> = { ...existenta, ...dinTrimitere };
  // O bifă nebifată lipsește din `FormData`: după o trimitere, absența ei
  // înseamnă „nebifat”, nu „ia valoarea existentă”.
  const acoperitImplicit =
    Object.keys(dinTrimitere).length > 0
      ? dinTrimitere["acoperit_de_garantie"] === "on"
      : existenta?.["acoperit_de_garantie"] === "on";

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
        {...(costPieseDinLinii
          ? { ajutor: "Calculat din piese: se schimbă din lista de piese a intervenției." }
          : {})}
        erori={stare.erori["cost_piese"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            readOnly={costPieseDinLinii}
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
        nume="numar_document_furnizor"
        id={idc("doc-furnizor")}
        eticheta="Nr. document furnizor"
        ajutor="Devizul, factura sau raportul de service, dacă există."
        erori={stare.erori["numar_document_furnizor"] ?? []}
      >
        {(a) => (
          <input {...a} maxLength={80} defaultValue={trimise["numar_document_furnizor"] ?? ""} />
        )}
      </Camp>

      <Camp
        nume="garantie_lucrare_pana"
        id={idc("garantie-lucrare")}
        eticheta="Garanția lucrării până la"
        ajutor="O defecțiune nouă până atunci se cere întâi celui care a reparat."
        erori={stare.erori["garantie_lucrare_pana"] ?? []}
      >
        {(a) => <input {...a} type="date" defaultValue={trimise["garantie_lucrare_pana"] ?? ""} />}
      </Camp>

      <div className="flex items-center gap-2 self-end pb-2">
        <input
          id={idc("acoperit-garantie")}
          name="acoperit_de_garantie"
          type="checkbox"
          className={clasaBifa}
          defaultChecked={acoperitImplicit}
        />
        <label htmlFor={idc("acoperit-garantie")} className="text-corp">
          Costul e acoperit de garanție
        </label>
      </div>

      {document === undefined ? null : (
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[14rem_1fr] lg:col-span-3">
          <Camp
            nume="document_tip"
            id={idc("document-tip")}
            eticheta="Tipul documentului"
            fel="select"
          >
            {(a) => (
              <select {...a} defaultValue={trimise["document_tip"] ?? "pv"}>
                {TIPURI_ATASAMENT_INTERVENTIE.map((t) => (
                  <option key={t} value={t}>
                    {ETICHETE_TIP_ATASAMENT[t]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <div className="space-y-1">
            <IncarcareFisier
              nume="document"
              eticheta={
                document.obligatoriu
                  ? "Procesul-verbal sau buletinul (obligatoriu)"
                  : "Document (opțional)"
              }
              accept={ACCEPT_DOCUMENT}
              maxOcteti={LIMITA_DOCUMENT_MENTENANTA_BYTES}
              mesajPreaMare="Documentul depășește 25 MB."
              mesajTipRespins="Acceptăm PDF, Word sau fotografii (JPG, PNG, WEBP, HEIC)."
              textAlegere="Alege documentul"
              etichetaScoate="Scoate documentul"
              restrictii={
                document.obligatoriu
                  ? "O verificare legală se înregistrează cu PV-ul sau buletinul ei. PDF, Word sau fotografie, până în 25 MB."
                  : "PDF, Word sau fotografie, până în 25 MB. Se urcă la salvare."
              }
            />
            {(stare.erori["document"] ?? []).length > 0 ? (
              <p role="alert" className="text-danger text-nota">
                {stare.erori["document"]?.[0]}
              </p>
            ) : null}
          </div>
        </div>
      )}

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
