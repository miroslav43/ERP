"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatDate, formatDateTime } from "@/lib/format/date";
import type { ChecklistItemStatus } from "@/schemas/checklist";
import { CHECKLIST_ITEM_STATUS } from "@/schemas/checklist";

import { bifeazaPas } from "../actions";
import {
  CLASE_STATUS_ITEM,
  ETICHETE_RESPONSABIL_TIP,
  ETICHETE_ROL,
  ETICHETE_STATUS_ITEM,
  ETICHETE_TIP_DOVADA,
} from "../etichete";

export interface PasAfisat {
  readonly id: string;
  readonly ordine: number;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly responsabil_tip: "rol" | "angajat" | "manager_direct";
  readonly responsabil_rol:
    | "super_admin"
    | "org_admin"
    | "manager"
    | "hr"
    | "employee"
    | null;
  readonly responsabil_employee_id: string | null;
  readonly termen: string | null;
  readonly obligatoriu: boolean;
  readonly tip_dovada: "niciuna" | "bifa" | "document" | "semnatura";
  readonly verificare_automata: "inventar_returnat" | "acces_revocat" | "documente_semnate" | null;
  readonly status: ChecklistItemStatus;
  readonly bifat_de: string | null;
  readonly bifat_la: string | null;
  readonly bifat_automat: boolean;
  readonly dovada: string | null;
  readonly dovada_document_id: string | null;
  readonly observatii: string | null;
}

interface Proprietati {
  readonly pasi: readonly PasAfisat[];
  /** Id-urile pașilor pe care viewerul curent are voie să-i bifeze — calculat pe server. */
  readonly idPasuriBifabile: readonly string[];
}

export function PasChecklist({ pasi, idPasuriBifabile }: Proprietati) {
  const bifabile = new Set(idPasuriBifabile);

  return (
    <ol className="space-y-3">
      {pasi.map((pas) => (
        <li key={pas.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <PasRand pas={pas} poateBifa={bifabile.has(pas.id)} />
        </li>
      ))}
    </ol>
  );
}

function responsabilText(pas: PasAfisat): string {
  if (pas.responsabil_tip === "manager_direct") return ETICHETE_RESPONSABIL_TIP.manager_direct;
  if (pas.responsabil_tip === "rol" && pas.responsabil_rol !== null) {
    return `${ETICHETE_RESPONSABIL_TIP.rol}: ${ETICHETE_ROL[pas.responsabil_rol]}`;
  }
  if (pas.responsabil_tip === "angajat") return ETICHETE_RESPONSABIL_TIP.angajat;
  return ETICHETE_RESPONSABIL_TIP[pas.responsabil_tip];
}

function PasRand({ pas, poateBifa }: { readonly pas: PasAfisat; readonly poateBifa: boolean }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [status, setStatus] = useState<ChecklistItemStatus>(pas.status);

  const idStatus = useId();
  const idDovadaDoc = useId();
  const idDovadaSemn = useId();
  const idObservatii = useId();

  function salveaza(formular: FormData): void {
    setEroare(null);
    const statusAles = String(formular.get("status") ?? pas.status) as ChecklistItemStatus;
    const dovadaDoc = String(formular.get("dovada_document_id") ?? "").trim();
    const dovadaSemn = String(formular.get("dovada") ?? "").trim();
    const observatii = String(formular.get("observatii") ?? "").trim();

    porneste(async () => {
      const rezultat = await bifeazaPas({
        id: pas.id,
        status: statusAles,
        dovada: pas.tip_dovada === "semnatura" && dovadaSemn.length > 0 ? dovadaSemn : null,
        dovada_document_id:
          pas.tip_dovada === "document" && dovadaDoc.length > 0 ? dovadaDoc : null,
        observatii: observatii.length === 0 ? null : observatii,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {pas.ordine}. {pas.titlu}
            {pas.obligatoriu ? (
              <span className="ml-1 text-xs text-zinc-500">(obligatoriu)</span>
            ) : null}
          </p>
          {pas.descriere === null ? null : (
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{pas.descriere}</p>
          )}
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Responsabil: {responsabilText(pas)}
            {pas.termen === null ? "" : ` · Termen: ${formatDate(pas.termen)}`}
          </p>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_ITEM[pas.status]}`}>
          {ETICHETE_STATUS_ITEM[pas.status]}
        </span>
      </div>

      {pas.verificare_automata !== null ? (
        <p className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Se bifează automat de sistem, pe baza altui modul.
          {pas.observatii === null ? "" : ` ${pas.observatii}`}
        </p>
      ) : !poateBifa ? (
        pas.observatii === null ? null : (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Observații: {pas.observatii}</p>
        )
      ) : (
        <form action={salveaza} className="space-y-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={idStatus} className="text-xs font-medium">
                Stare
              </label>
              <select
                id={idStatus}
                name="status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ChecklistItemStatus);
                }}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {CHECKLIST_ITEM_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {ETICHETE_STATUS_ITEM[s]}
                  </option>
                ))}
              </select>
            </div>

            {pas.tip_dovada === "document" ? (
              <div className="flex flex-col gap-1">
                <label htmlFor={idDovadaDoc} className="text-xs font-medium">
                  {ETICHETE_TIP_DOVADA.document}
                </label>
                <input
                  id={idDovadaDoc}
                  name="dovada_document_id"
                  defaultValue={pas.dovada_document_id ?? ""}
                  placeholder="id-ul documentului"
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            ) : null}

            {pas.tip_dovada === "semnatura" ? (
              <div className="flex flex-col gap-1">
                <label htmlFor={idDovadaSemn} className="text-xs font-medium">
                  {ETICHETE_TIP_DOVADA.semnatura}
                </label>
                <input
                  id={idDovadaSemn}
                  name="dovada"
                  defaultValue={pas.dovada ?? ""}
                  placeholder="numele semnatarului"
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={inCurs}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {inCurs ? "Se salvează…" : "Salvează"}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idObservatii} className="text-xs font-medium">
              Observații
            </label>
            <input
              id={idObservatii}
              name="observatii"
              defaultValue={pas.observatii ?? ""}
              maxLength={1000}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          {eroare === null ? null : (
            <p role="alert" className="text-xs text-red-700 dark:text-red-400">
              {eroare}
            </p>
          )}
        </form>
      )}

      {pas.bifat_la === null ? null : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Bifat {pas.bifat_automat ? "automat" : ""} la {formatDateTime(pas.bifat_la)}.
        </p>
      )}
    </div>
  );
}
