"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { STATUS_VEHICUL } from "@/schemas/fleet";
import type { StatusVehicul } from "@/schemas/fleet";

import { actualizeazaVehicul } from "../actions";
import { CampuriVehicul, type ValoriInitialeVehicul } from "../campuri-vehicul";
import { ETICHETE_STATUS_VEHICUL } from "../etichete";
import { valoriVehicul } from "../valori-vehicul";

/**
 * Modificarea vehiculului, inclusiv ieșirea lui din parc.
 *
 * ── STAREA APARE DOAR AICI, NU ȘI LA CREARE ──────────────────────────────────
 * `vehicule_insert` cere literal `status = 'activ'`, `data_iesire is null` și
 * `motiv_iesire is null`: o mașină nu poate intra în evidență direct „vândută"
 * fără să fi existat vreodată în parc. Politica de UPDATE n-are restricția, deci
 * drumul spre „vândut"/„casat" trece obligatoriu prin caseta asta.
 *
 * ── DE CE MOTIVUL E CONTROLAT DE STARE, ȘI NU MEREU VIZIBIL ──────────────────
 * `motiv_iesire` n-are sens pentru o mașină din parc, iar un câmp gol pe care
 * nu-l poți completa corect e zgomot. Apare când starea o cere, iar schema îl
 * și impune atunci (`superRefine`): peste un an, „de ce a ieșit mașina asta?"
 * e singura întrebare care se mai pune despre ea.
 *
 * `data_iesire` NU e în formular: `internal.vehicles_normalizeaza` o pune singură
 * din `status` și o golește la întoarcerea în parc.
 */
interface Proprietati {
  readonly vehicul: ValoriInitialeVehicul &
    Readonly<{
      id: string;
      status: StatusVehicul;
      motiv_iesire: string | null;
      employee_id: string | null;
      department_id: string | null;
    }>;
}

const IESE_DIN_PARC: ReadonlySet<StatusVehicul> = new Set<StatusVehicul>(["vandut", "casat"]);

export function DialogVehicul({ vehicul }: Proprietati): ReactElement {
  const [status, setStatus] = useState<StatusVehicul>(vehicul.status);

  async function trimite(date: FormData) {
    return actualizeazaVehicul({
      id: vehicul.id,
      status: String(date.get("status") ?? ""),
      motiv_iesire: String(date.get("motiv_iesire") ?? "").trim() || null,
      ...valoriVehicul(date),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Modifică",
        varianta: "secundar",
        pictograma: <Pencil aria-hidden="true" className="size-4" />,
      }}
      titlu={`Modifică ${vehicul.nr_inmatriculare}`}
      descriere="Kilometrajul nu se editează de aici — îl ridică singur aprobarea foilor de parcurs."
      marime="lucru"
      actiune={trimite}
      mesajReusita="Vehiculul a fost actualizat."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <>
          {/* Alocarea curentă călătorește nevăzută: fără ea, orice salvare a
              fișei ar șterge un șofer sau un departament setat altundeva.
              Vezi `valori-vehicul.ts`. */}
          <input type="hidden" name="employee_id" value={vehicul.employee_id ?? ""} />
          <input type="hidden" name="department_id" value={vehicul.department_id ?? ""} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="status"
              id={idc("status")}
              eticheta="Starea vehiculului"
              fel="select"
              erori={stare.erori["status"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as StatusVehicul);
                  }}
                >
                  {STATUS_VEHICUL.map((s) => (
                    <option key={s} value={s}>
                      {ETICHETE_STATUS_VEHICUL[s]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            {IESE_DIN_PARC.has(status) ? (
              <Camp
                nume="motiv_iesire"
                id={idc("motiv_iesire")}
                eticheta="Motivul ieșirii din parc"
                obligatoriu
                ajutor="Cui s-a vândut, de ce s-a casat. Data ieșirii se completează singură."
                erori={stare.erori["motiv_iesire"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={500}
                    defaultValue={stare.valoriTrimise["motiv_iesire"] ?? vehicul.motiv_iesire ?? ""}
                  />
                )}
              </Camp>
            ) : null}
          </div>

          <CampuriVehicul stare={stare} idc={idc} vehicul={vehicul} />
        </>
      )}
    </FormularDialog>
  );
}
