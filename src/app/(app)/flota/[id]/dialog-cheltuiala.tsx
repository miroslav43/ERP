"use client";

import { Receipt } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { StareFormular } from "@/components/ui/formular";
import { CATEGORII_CHELTUIALA } from "@/schemas/fleet-service";

import { adaugaCheltuiala } from "../actions-service";
import { ETICHETE_CATEGORIE_CHELTUIALA } from "../etichete-service";
import { valoriCheltuiala } from "./valori-service";

/**
 * O cheltuială care nu e service și nu e pe foaie: parcare, spălătorie, taxe,
 * combustibil cumpărat fără foaie. Suma în lei, cu TVA.
 *
 * Litrii apar doar la „Combustibil fără foaie”: baza refuză litri pe orice altă
 * categorie (`vex_litri_ck`), iar un câmp care nu se poate completa corect e zgomot.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly azi: string;
}

function CampuriCheltuiala({
  stare,
  idc,
  azi,
}: Readonly<{
  stare: StareFormular<unknown>;
  idc: (sufix: string) => string;
  azi: string;
}>): ReactElement {
  const trimis = stare.valoriTrimise;
  const [categorie, setCategorie] = useState(trimis["categorie"] ?? "parcare");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Camp
        nume="categorie"
        id={idc("categorie")}
        eticheta="Categoria"
        fel="select"
        obligatoriu
        erori={stare.erori["categorie"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            value={categorie}
            onChange={(e) => {
              setCategorie(e.target.value);
            }}
          >
            {CATEGORII_CHELTUIALA.map((c) => (
              <option key={c} value={c}>
                {ETICHETE_CATEGORIE_CHELTUIALA[c]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="data_cheltuielii"
        id={idc("data_cheltuielii")}
        eticheta="Data"
        obligatoriu
        erori={stare.erori["data_cheltuielii"] ?? []}
      >
        {(a) => (
          <input {...a} type="date" max={azi} defaultValue={trimis["data_cheltuielii"] ?? azi} />
        )}
      </Camp>

      <Camp
        nume="suma"
        id={idc("suma")}
        eticheta="Suma (lei, cu TVA)"
        obligatoriu
        erori={stare.erori["suma"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            defaultValue={trimis["suma"] ?? ""}
          />
        )}
      </Camp>

      {categorie === "combustibil_fara_foaie" ? (
        <Camp
          nume="litri"
          id={idc("litri")}
          eticheta="Litri"
          ajutor="Combustibilul fără foaie nu intră în consumul real calculat din foi."
          erori={stare.erori["litri"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              defaultValue={trimis["litri"] ?? ""}
            />
          )}
        </Camp>
      ) : null}

      <Camp
        nume="km_bord"
        id={idc("km_bord")}
        eticheta="Kilometraj la bord"
        erori={stare.erori["km_bord"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={trimis["km_bord"] ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="numar_document"
        id={idc("numar_document")}
        eticheta="Număr bon sau factură"
        erori={stare.erori["numar_document"] ?? []}
      >
        {(a) => (
          <input {...a} type="text" maxLength={60} defaultValue={trimis["numar_document"] ?? ""} />
        )}
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
          <textarea {...a} maxLength={1000} rows={2} defaultValue={trimis["observatii"] ?? ""} />
        )}
      </Camp>
    </div>
  );
}

export function DialogCheltuiala({ vehiculId, azi }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return adaugaCheltuiala({ vehicle_id: vehiculId, ...valoriCheltuiala(date) });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Cheltuială nouă",
        varianta: "secundar",
        pictograma: <Receipt aria-hidden="true" className="size-4" />,
      }}
      titlu="Cheltuială pe vehicul"
      descriere="Pentru ce nu e service și nu e pe foaia de parcurs. Cheltuiala nu se mai modifică după salvare: o ștergeți și o adăugați din nou."
      actiune={trimite}
      mesajReusita="Cheltuiala a fost înregistrată."
      etichetaTrimite="Salvează cheltuiala"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => <CampuriCheltuiala stare={stare} idc={idc} azi={azi} />}
    </FormularDialog>
  );
}
