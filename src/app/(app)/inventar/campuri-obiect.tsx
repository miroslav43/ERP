"use client";

import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { STARI_OBIECT } from "@/schemas/inventory";
import type { StareObiect } from "@/schemas/inventory";

import { ETICHETE_STARE } from "./etichete";

/**
 * Câmpurile unui obiect de inventar, scrise o singură dată pentru adăugare și
 * pentru modificare.
 *
 * Erau două seturi identice, în două fișiere și două arhitecturi:
 * `nou/formular-obiect.tsx` avea etichete de mână peste o constantă `CLASA_CAMP`
 * copiată local, iar `[id]/actiuni-obiect.tsx` folosea `<Camp>` peste
 * react-hook-form. Douăsprezece câmpuri ținute sincronizate cu ochiul, într-un
 * modul unde adăugarea unei coloane înseamnă două editări care se pot uita una
 * pe alta.
 *
 * ── CE NU E AICI ─────────────────────────────────────────────────────────
 * `status` (starea de circuit) nu e câmp editabil în nicio schemă, deliberat:
 * politica `inventory_items_insert` cere literal `status = 'in_stoc'`, iar
 * mișcarea mai departe o fac alocările, prin trigger. Ieșirea din „în reparație”
 * are acțiune proprie (`readuInStoc`), casarea la fel.
 *
 * ── DE CE `stare` ARE IMPLICIT DIFERIT LA CREARE ─────────────────────────
 * `campuriObiect` dă `"nou"`, coloana din bază dă `"bun"`. Nu e o contradicție:
 * acțiunea trimite mereu câmpul, deci implicitul coloanei nu se atinge
 * niciodată. Formularul propune „Nou” fiindcă un obiect care tocmai se
 * înregistrează e, cel mai des, tocmai cumpărat.
 */
export interface ValoriInitialeObiect {
  readonly denumire: string;
  readonly numar_inventar: string;
  readonly serie: string | null;
  readonly model: string | null;
  readonly producator: string | null;
  readonly category_id: string | null;
  readonly data_achizitie: string | null;
  readonly valoare: number | null;
  readonly garantie_expira: string | null;
  readonly stare: StareObiect;
  readonly locatie: string | null;
  readonly observatii: string | null;
}

export interface OptiuneCategorie {
  readonly id: string;
  readonly denumire: string;
}

export interface ProprietatiCampuriObiect<TData> {
  readonly stare: StareFormular<TData>;
  readonly idc: (sufix: string) => string;
  readonly categorii: readonly OptiuneCategorie[];
  /** Obiectul care se modifică. Absent la adăugare. */
  readonly obiect?: ValoriInitialeObiect | undefined;
}

/** `?? ""` singur ar transforma o valoare de 0 lei într-un câmp gol. */
function cifra(valoare: number | null | undefined): string {
  return valoare === null || valoare === undefined ? "" : String(valoare);
}

export function CampuriObiect<TData>({
  stare,
  idc,
  categorii,
  obiect,
}: ProprietatiCampuriObiect<TData>): ReactElement {
  const trimis = stare.valoriTrimise;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Camp
        nume="denumire"
        id={idc("denumire")}
        eticheta="Denumire"
        obligatoriu
        erori={stare.erori["denumire"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={200}
            defaultValue={trimis["denumire"] ?? obiect?.denumire ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="numar_inventar"
        id={idc("numar_inventar")}
        eticheta="Număr de inventar"
        obligatoriu
        ajutor="Litere, cifre, punct, liniuță și slash. Se compară fără să conteze majusculele."
        erori={stare.erori["numar_inventar"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={40}
            defaultValue={trimis["numar_inventar"] ?? obiect?.numar_inventar ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="category_id"
        id={idc("category_id")}
        eticheta="Categorie"
        fel="select"
        erori={stare.erori["category_id"] ?? []}
      >
        {(a) => (
          <select {...a} defaultValue={trimis["category_id"] ?? obiect?.category_id ?? ""}>
            <option value="">Necategorizat</option>
            {categorii.map((optiune) => (
              <option key={optiune.id} value={optiune.id}>
                {optiune.denumire}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp nume="serie" id={idc("serie")} eticheta="Serie" erori={stare.erori["serie"] ?? []}>
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={100}
            defaultValue={trimis["serie"] ?? obiect?.serie ?? ""}
          />
        )}
      </Camp>

      <Camp nume="model" id={idc("model")} eticheta="Model" erori={stare.erori["model"] ?? []}>
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={120}
            defaultValue={trimis["model"] ?? obiect?.model ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="producator"
        id={idc("producator")}
        eticheta="Producător"
        erori={stare.erori["producator"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={120}
            defaultValue={trimis["producator"] ?? obiect?.producator ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="stare"
        id={idc("stare")}
        eticheta="Stare fizică"
        erori={stare.erori["stare"] ?? []}
        fel="select"
      >
        {(a) => (
          <select {...a} defaultValue={trimis["stare"] ?? obiect?.stare ?? "nou"}>
            {STARI_OBIECT.map((valoare) => (
              <option key={valoare} value={valoare}>
                {ETICHETE_STARE[valoare]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="locatie"
        id={idc("locatie")}
        eticheta="Locație"
        ajutor="Unde stă obiectul cât timp nu e predat cuiva."
        erori={stare.erori["locatie"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={200}
            defaultValue={trimis["locatie"] ?? obiect?.locatie ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="valoare"
        id={idc("valoare")}
        eticheta="Valoare (lei)"
        erori={stare.erori["valoare"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={trimis["valoare"] ?? cifra(obiect?.valoare)}
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
            defaultValue={trimis["data_achizitie"] ?? obiect?.data_achizitie ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="garantie_expira"
        id={idc("garantie_expira")}
        eticheta="Garanția expiră la"
        ajutor="Nu poate fi înainte de data achiziției."
        erori={stare.erori["garantie_expira"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            defaultValue={trimis["garantie_expira"] ?? obiect?.garantie_expira ?? ""}
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
          <textarea
            {...a}
            rows={3}
            maxLength={2000}
            defaultValue={trimis["observatii"] ?? obiect?.observatii ?? ""}
          />
        )}
      </Camp>
    </div>
  );
}
