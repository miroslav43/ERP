"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { STATUS_VEHICUL } from "@/schemas/fleet";
import type { StatusVehicul } from "@/schemas/fleet";

import { actualizeazaVehicul } from "../actions";
import {
  CampuriVehicul,
  type OptiuneDepartament,
  type ValoriInitialeVehicul,
} from "../campuri-vehicul";
import { ETICHETE_STATUS_VEHICUL } from "../etichete";
import { valoriVehicul } from "../valori-vehicul";

/**
 * Modificarea vehiculului. Ieșirea din parc NU mai trece pe aici.
 *
 * ── IEȘIREA E UN ASISTENT SEPARAT (0218, F12h) ───────────────────────────────
 * Din 0218, vânzarea, casarea, radierea și restituirea la locator se fac din
 * „Scoate din parc” (`iesire/dialog-iesire.tsx`): un INSERT în `vehicle_exits`
 * închide alocarea la data ieșirii și creează termenele de după ea. Baza refuză
 * trecerea directă în/din `vandut`/`casat` (`vehicles_iesire_garda`, P0001).
 * De aceea, cât vehiculul e în parc, starea are doar „În parc” / „În service”;
 * pe un vehicul ieșit, starea și motivul ieșirii se arată ca text și pleacă
 * NESCHIMBATE: așa trece `superRefine` din `actualizeazaVehiculSchema` (cere
 * motiv la vândut/casat), iar garda bazei nu se declanșează. Revenirea în parc
 * se face prin anularea ieșirii, din secțiunea „Ieșirea din parc”.
 *
 * `data_iesire` NU e în formular: o scrie asistentul, iar
 * `internal.vehicles_normalizeaza` o golește la întoarcerea în parc.
 */
interface Proprietati {
  readonly vehicul: ValoriInitialeVehicul &
    Readonly<{
      id: string;
      status: StatusVehicul;
      motiv_iesire: string | null;
    }>;
  readonly departamente: readonly OptiuneDepartament[];
}

const IESE_DIN_PARC: ReadonlySet<StatusVehicul> = new Set<StatusVehicul>(["vandut", "casat"]);

/** Stările care se pot alege de aici: doar cele din parc (0218). */
const STARI_IN_PARC = STATUS_VEHICUL.filter((s) => !IESE_DIN_PARC.has(s));

/**
 * Starea, ca subcomponent — NU ca stare a casetei.
 *
 * `FormularDialog` randează `{deschis ? <Dialog>… : null}`, deci interiorul se
 * REMONTEAZĂ la fiecare deschidere; componenta din jur, nu. Cât timp `status`
 * stătea în `DialogVehicul`, selectul era singurul câmp care nu-și relua
 * valoarea din `vehicul`: toate celelalte se remontau cu `defaultValue`, el
 * rămânea pe ultima alegere ABANDONATĂ. Mutat aici, `useState` se
 * inițializează din nou la fiecare deschidere.
 */
function StareaVehiculului<TData>({
  stare,
  idc,
  vehicul,
}: {
  readonly stare: StareFormular<TData>;
  readonly idc: (sufix: string) => string;
  readonly vehicul: Proprietati["vehicul"];
}): ReactElement {
  const [status, setStatus] = useState<StatusVehicul>(vehicul.status);

  // Vehiculul ieșit: starea și motivul se văd, nu se aleg (asistentul le-a scris).
  if (IESE_DIN_PARC.has(vehicul.status)) {
    return (
      <p className="text-muted-foreground text-corp">
        Vehiculul e ieșit din parc ({ETICHETE_STATUS_VEHICUL[vehicul.status].toLowerCase()}). Pentru
        a-l readuce, anulați ieșirea din secțiunea „Ieșirea din parc”.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Camp
        nume="status"
        id={idc("status")}
        eticheta="Starea vehiculului"
        fel="select"
        ajutor="Vânzarea, casarea sau radierea se înregistrează cu „Scoate din parc”."
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
            {STARI_IN_PARC.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS_VEHICUL[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>
    </div>
  );
}

export function DialogVehicul({ vehicul, departamente }: Proprietati): ReactElement {
  const iesit = IESE_DIN_PARC.has(vehicul.status);
  async function trimite(date: FormData) {
    return actualizeazaVehicul({
      id: vehicul.id,
      // Pe un vehicul ieșit, starea și motivul pleacă neschimbate (0218).
      status: iesit ? vehicul.status : String(date.get("status") ?? ""),
      motiv_iesire: iesit ? vehicul.motiv_iesire : null,
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
          {/* Șoferul nu mai călătorește prin câmp ascuns: din 0173 se schimbă
              doar prin alocare, iar acțiunea nu-l mai trimite. */}
          <StareaVehiculului stare={stare} idc={idc} vehicul={vehicul} />

          <CampuriVehicul stare={stare} idc={idc} vehicul={vehicul} departamente={departamente} />
        </>
      )}
    </FormularDialog>
  );
}
