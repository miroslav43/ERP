"use client";

import { Fuel } from "lucide-react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { IntrareData } from "@/components/ui/intrare-data";

import { adaugaNormaConsum } from "../actions-fiscal";

interface Proprietati {
  readonly vehiculId: string;
  readonly nrInmatriculare: string;
  /** Consumul declarat pe fișă (l/100 km), propus ca punct de plecare. */
  readonly consumDeclarat: number | null;
  /** `AAAA-LL-ZZ`, ziua României. */
  readonly azi: string;
}

/**
 * Norma proprie de consum a vehiculului (HG 1/2016, titlul II pct. 16 alin. (2)),
 * cu decizia internă care o stabilește. Trimiterea unei foi o fixează în
 * instantaneul foii; ștergerea sau o normă nouă nu schimbă foile deja trimise.
 *
 * Cheile trimise sunt EXACT cele din `normaConsumNouaSchema`.
 */
export function DialogNormaConsum({
  vehiculId,
  nrInmatriculare,
  consumDeclarat,
  azi,
}: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return adaugaNormaConsum({
      vehicle_id: vehiculId,
      valabil_de_la: String(date.get("valabil_de_la") ?? ""),
      l_100km: String(date.get("l_100km") ?? ""),
      decizie_numar: String(date.get("decizie_numar") ?? ""),
      decizie_data: String(date.get("decizie_data") ?? ""),
      observatii: String(date.get("observatii") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Normă nouă de consum",
        varianta: "secundar",
        pictograma: <Fuel aria-hidden="true" className="size-4" />,
      }}
      titlu={`Normă proprie de consum — ${nrInmatriculare}`}
      descriere="Norma se aplică de la data aleasă. Foaia de parcurs o preia în clipa trimiterii, din ziua ei; fără normă proprie, se folosește consumul declarat pe fișa vehiculului."
      actiune={trimite}
      mesajReusita="Norma de consum a fost adăugată."
      etichetaTrimite="Adaugă norma"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="valabil_de_la"
            id={idc("valabil_de_la")}
            eticheta="Se aplică de la"
            obligatoriu
            erori={stare.erori["valabil_de_la"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["valabil_de_la"] ?? azi} />}
          </Camp>
          <Camp
            nume="l_100km"
            id={idc("l_100km")}
            eticheta="Norma (litri la 100 km)"
            obligatoriu
            erori={stare.erori["l_100km"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0.01"
                max="300"
                step="0.01"
                inputMode="decimal"
                defaultValue={
                  stare.valoriTrimise["l_100km"] ??
                  (consumDeclarat === null ? "" : String(consumDeclarat))
                }
              />
            )}
          </Camp>
          <Camp
            nume="decizie_numar"
            id={idc("decizie_numar")}
            eticheta="Decizia internă (număr)"
            erori={stare.erori["decizie_numar"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={60}
                defaultValue={stare.valoriTrimise["decizie_numar"] ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="decizie_data"
            id={idc("decizie_data")}
            eticheta="Decizia internă (data)"
            erori={stare.erori["decizie_data"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["decizie_data"] ?? ""} />}
          </Camp>
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
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
