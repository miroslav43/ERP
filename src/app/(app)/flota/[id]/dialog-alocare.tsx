"use client";

import { KeyRound } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type { OptiuneAngajat } from "@/lib/queries/fleet";

import { alocaVehicul } from "../actions";

/**
 * Predarea vehiculului unui șofer (0173).
 *
 * Dacă mașina avea deja un șofer, alocarea lui se încheie singură, în bază, la
 * momentul predării, cu kilometrajul de aici ca restituire. De aceea descrierea
 * o spune: omul nu trebuie să „încheie întâi” și apoi să predea.
 *
 * „Acum” se calculează la DESCHIDEREA casetei, în client. Interiorul lui
 * `FormularDialog` se montează doar deschis, deci nu există randare pe server
 * cu care să difere la hidratare.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly kmCurent: number;
  readonly soferCurent: string | null;
  readonly angajati: readonly OptiuneAngajat[];
}

export function DialogAlocare({
  vehiculId,
  kmCurent,
  soferCurent,
  angajati,
}: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    const deLa = String(date.get("de_la") ?? "").trim();
    return alocaVehicul({
      vehicle_id: vehiculId,
      employee_id: String(date.get("employee_id") ?? ""),
      de_la: deLa,
      km_predare: String(date.get("km_predare") ?? "").trim(),
      folosinta_personala: date.get("folosinta_personala") === "on",
      observatii: String(date.get("observatii") ?? "").trim() || null,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: soferCurent === null ? "Alocă un șofer" : "Predă altui șofer",
        varianta: "secundar",
        pictograma: <KeyRound aria-hidden="true" className="size-4" />,
      }}
      titlu="Predarea vehiculului"
      descriere={
        soferCurent === null
          ? "Vehiculul nu are acum șofer. Predarea îl alocă celui ales, de la momentul de mai jos."
          : `Acum îl are ${soferCurent}. Predarea îi încheie alocarea la momentul de mai jos, cu kilometrajul de predare ca restituire.`
      }
      actiune={trimite}
      mesajReusita="Vehiculul a fost predat."
      etichetaTrimite="Predă vehiculul"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="employee_id"
            id={idc("employee_id")}
            eticheta="Șofer"
            fel="select"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["employee_id"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["employee_id"] ?? ""}>
                <option value="" disabled>
                  Alegeți angajatul
                </option>
                {angajati.map((ang) => (
                  <option key={ang.id} value={ang.id}>
                    {ang.full_name}
                    {ang.marca === null ? "" : ` (${ang.marca})`}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="de_la"
            id={idc("de_la")}
            eticheta="Predat la"
            obligatoriu
            erori={stare.erori["de_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                defaultValue={stare.valoriTrimise["de_la"] ?? oraRomanieiPentruCamp(new Date())}
              />
            )}
          </Camp>
          <Camp
            nume="km_predare"
            id={idc("km_predare")}
            eticheta="Kilometraj la predare"
            erori={stare.erori["km_predare"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={stare.valoriTrimise["km_predare"] ?? String(kmCurent)}
              />
            )}
          </Camp>
          <label className="text-corp flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="folosinta_personala" className="size-4" />
            Poate folosi mașina și în scop personal
          </label>
          <p className="text-muted-foreground text-nota -mt-2 sm:col-span-2">
            Contează la avantajul în natură și la deductibilitatea cheltuielilor auto.
          </p>
          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații la predare"
            fel="textarea"
            ajutor="Starea mașinii, dotări, chei, documente predate."
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={1000}
                rows={2}
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
