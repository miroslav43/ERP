"use client";

import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { CATEGORII_VEHICUL, COMBUSTIBILI } from "@/schemas/fleet";
import type { CategorieVehicul, Combustibil } from "@/schemas/fleet";

import { ETICHETE_CATEGORIE, ETICHETE_COMBUSTIBIL } from "./etichete";

/**
 * Câmpurile unui vehicul, scrise o singură dată pentru creare și modificare.
 *
 * Vechiul formular de adăugare avea `Camp`-ul lui LOCAL, un `<div>` cu `<label>`
 * și `<input>` — deci nu arăta erori pe câmp, iar un refuz al bazei apărea ca o
 * singură frază sub buton, oricâte câmpuri ar fi fost greșite. Aici se folosește
 * `@/components/ui/camp`, care leagă eticheta, ajutorul și eroarea prin
 * `aria-describedby`.
 *
 * ── CE NU E AICI ─────────────────────────────────────────────────────────────
 * `status` și `motiv_iesire` — apar doar la modificare, fiindcă `vehicule_insert`
 * cere literal `status = 'activ'`: un vehicul nu poate intra direct „vândut".
 * Caseta de modificare le randează ea, deasupra acestor câmpuri.
 *
 * `km_curent` — îl ridică triggerul la aprobarea unei foi de parcurs. Editabil
 * din formular, ar fi a doua sursă pentru aceeași cifră.
 *
 * `employee_id` / `department_id` — nu există încă selector. Caseta de
 * modificare le trimite prin câmpuri ascunse ca să nu le șteargă; vezi
 * `valori-vehicul.ts`.
 */
export interface ValoriInitialeVehicul {
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
  readonly vin: string | null;
  readonly categorie: CategorieVehicul;
  readonly tip_combustibil: Combustibil;
  readonly an_fabricatie: number | null;
  readonly culoare: string | null;
  readonly consum_mediu_declarat: number | null;
  readonly data_achizitie: string | null;
  readonly valoare_achizitie: number | null;
  readonly prag_salt_km: number | null;
  readonly observatii: string | null;
}

export interface ProprietatiCampuriVehicul<TData> {
  readonly stare: StareFormular<TData>;
  readonly idc: (sufix: string) => string;
  /** Vehiculul care se modifică. Absent la adăugare. */
  readonly vehicul?: ValoriInitialeVehicul | undefined;
}

/** `?? ""` singur ar transforma un `0` legitim în câmp gol. */
function cifra(valoare: number | null | undefined): string {
  return valoare === null || valoare === undefined ? "" : String(valoare);
}

export function CampuriVehicul<TData>({
  stare,
  idc,
  vehicul,
}: ProprietatiCampuriVehicul<TData>): ReactElement {
  const trimis = stare.valoriTrimise;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Camp
        nume="nr_inmatriculare"
        id={idc("nr_inmatriculare")}
        eticheta="Număr de înmatriculare"
        obligatoriu
        erori={stare.erori["nr_inmatriculare"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={16}
            defaultValue={trimis["nr_inmatriculare"] ?? vehicul?.nr_inmatriculare ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="marca"
        id={idc("marca")}
        eticheta="Marca"
        obligatoriu
        erori={stare.erori["marca"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={60}
            defaultValue={trimis["marca"] ?? vehicul?.marca ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="model"
        id={idc("model")}
        eticheta="Model"
        obligatoriu
        erori={stare.erori["model"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={60}
            defaultValue={trimis["model"] ?? vehicul?.model ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="vin"
        id={idc("vin")}
        eticheta="VIN"
        ajutor="17 caractere, fără literele I, O și Q."
        erori={stare.erori["vin"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={17}
            defaultValue={trimis["vin"] ?? vehicul?.vin ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="categorie"
        id={idc("categorie")}
        eticheta="Categorie"
        fel="select"
        erori={stare.erori["categorie"] ?? []}
      >
        {(a) => (
          <select {...a} defaultValue={trimis["categorie"] ?? vehicul?.categorie ?? "autoturism"}>
            {CATEGORII_VEHICUL.map((c) => (
              <option key={c} value={c}>
                {ETICHETE_CATEGORIE[c]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="tip_combustibil"
        id={idc("tip_combustibil")}
        eticheta="Combustibil"
        fel="select"
        erori={stare.erori["tip_combustibil"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            defaultValue={trimis["tip_combustibil"] ?? vehicul?.tip_combustibil ?? "motorina"}
          >
            {COMBUSTIBILI.map((c) => (
              <option key={c} value={c}>
                {ETICHETE_COMBUSTIBIL[c]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="an_fabricatie"
        id={idc("an_fabricatie")}
        eticheta="An fabricație"
        erori={stare.erori["an_fabricatie"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="1900"
            max="2200"
            defaultValue={trimis["an_fabricatie"] ?? cifra(vehicul?.an_fabricatie)}
          />
        )}
      </Camp>

      <Camp
        nume="culoare"
        id={idc("culoare")}
        eticheta="Culoare"
        erori={stare.erori["culoare"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={40}
            defaultValue={trimis["culoare"] ?? vehicul?.culoare ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="consum_mediu_declarat"
        id={idc("consum_mediu_declarat")}
        eticheta="Consum declarat (l/100 km)"
        ajutor="Baza de comparație pentru consumul real, calculat din alimentări."
        erori={stare.erori["consum_mediu_declarat"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            max="300"
            step="0.1"
            defaultValue={trimis["consum_mediu_declarat"] ?? cifra(vehicul?.consum_mediu_declarat)}
          />
        )}
      </Camp>

      <Camp
        nume="data_achizitie"
        id={idc("data_achizitie")}
        eticheta="Data achiziției"
        erori={stare.erori["data_achizitie"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            defaultValue={trimis["data_achizitie"] ?? vehicul?.data_achizitie ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="valoare_achizitie"
        id={idc("valoare_achizitie")}
        eticheta="Valoare achiziție (lei)"
        erori={stare.erori["valoare_achizitie"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            defaultValue={trimis["valoare_achizitie"] ?? cifra(vehicul?.valoare_achizitie)}
          />
        )}
      </Camp>

      <Camp
        nume="prag_salt_km"
        id={idc("prag_salt_km")}
        eticheta="Prag salt kilometraj"
        ajutor="Peste câți km o diferență devine anomalie. Gol = pragul implicit al flotei."
        erori={stare.erori["prag_salt_km"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="10"
            max="100000"
            defaultValue={trimis["prag_salt_km"] ?? cifra(vehicul?.prag_salt_km)}
          />
        )}
      </Camp>

      <Camp
        nume="observatii"
        id={idc("observatii")}
        eticheta="Observații"
        fel="textarea"
        ajutor="Ce trebuie știut despre mașina asta: dotări, defecte cunoscute, unde stă cheia."
        className="sm:col-span-2 lg:col-span-3"
        erori={stare.erori["observatii"] ?? []}
      >
        {(a) => (
          <textarea
            {...a}
            maxLength={2000}
            rows={3}
            defaultValue={trimis["observatii"] ?? vehicul?.observatii ?? ""}
          />
        )}
      </Camp>
    </div>
  );
}
