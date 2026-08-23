// src/app/(app)/inventar/filtre-inventar.tsx
// Server Component: fără stare, fără handler, fără JavaScript trimis în browser.
// Trimiterea și pastilele stau în `BaraFiltre`.
import { Search } from "lucide-react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import {
  STARI_OBIECT,
  STATUSURI_OBIECT,
  type FiltreInventar as ValoriFiltre,
} from "@/schemas/inventory";

import { ETICHETE_STARE, ETICHETE_STATUS } from "./etichete";

interface OptiuneCategorie {
  readonly id: string;
  readonly denumire: string;
}

interface Proprietati {
  readonly categorii: readonly OptiuneCategorie[];
  /**
   * Filtrele deja trecute prin `filtreDinUrl` — exact valorile pe care le-a
   * folosit lista. Citite brut din adresă, un `?status=zzz` ar fi arătat în
   * formular altceva decât ce s-a filtrat de fapt.
   */
  readonly filtre: ValoriFiltre;
}

/**
 * Cheile pe care le administrează bara. `sort`, `limita` și `cursor` NU sunt
 * aici: nu sunt filtre, iar bara nu are voie să le atingă. Înainte, `aplica()`
 * pornea dintr-un `URLSearchParams` gol, deci fiecare apăsare pe „Filtrează”
 * arunca sortarea aleasă din tabel și mărimea de pagină aleasă din paginare.
 */
const CHEI_PROPRII = ["q", "numar", "status", "stare", "category_id"] as const;

const CLASA_SELECT = "border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2";

export function FiltreInventar({ categorii, filtre }: Proprietati) {
  const numeCategorii = new Map(categorii.map((categorie) => [categorie.id, categorie.denumire]));

  // Pastilele poartă DENUMIREA, nu identificatorul: „Categorie: Scule”, nu un UUID.
  const active: FiltruActiv[] = [];
  if (filtre.q !== null) active.push({ cheie: "q", eticheta: `Denumire: ${filtre.q}` });
  if (filtre.numar !== null) {
    active.push({ cheie: "numar", eticheta: `Număr de inventar: ${filtre.numar}` });
  }
  if (filtre.status !== null) {
    active.push({
      cheie: "status",
      eticheta: `Stare de circuit: ${ETICHETE_STATUS[filtre.status]}`,
    });
  }
  if (filtre.stare !== null) {
    active.push({ cheie: "stare", eticheta: `Stare fizică: ${ETICHETE_STARE[filtre.stare]}` });
  }
  if (filtre.category_id !== null) {
    active.push({
      cheie: "category_id",
      eticheta: `Categorie: ${numeCategorii.get(filtre.category_id) ?? "necunoscută"}`,
    });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII} textAplica="Aplică filtrele">
      <div className="min-w-56 flex-1">
        <label htmlFor="filtru-inventar-q" className="text-corp block font-medium">
          Caută după denumire
        </label>
        <div className="border-foreground/60 rounded-control mt-1 flex items-center gap-2 border px-2 focus-within:outline-2">
          <Search aria-hidden="true" className="text-muted-foreground size-4" />
          <input
            // `key` legat de valoarea din adresă: un control NECONTROLAT își ia
            // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi rămas
            // cu valoarea veche în câmp — și ar fi reaplicat-o la următoarea
            // apăsare pe „Aplică filtrele”.
            key={filtre.q ?? ""}
            id="filtru-inventar-q"
            name="q"
            type="search"
            defaultValue={filtre.q ?? ""}
            placeholder="Ex. Laptop Dell"
            className="text-corp w-full bg-transparent py-2"
          />
        </div>
      </div>

      <div className="min-w-40">
        <label htmlFor="filtru-inventar-numar" className="text-corp block font-medium">
          Număr de inventar
        </label>
        <input
          key={filtre.numar ?? ""}
          id="filtru-inventar-numar"
          name="numar"
          type="search"
          defaultValue={filtre.numar ?? ""}
          placeholder="Ex. INV-0042"
          className="border-foreground/60 rounded-control text-corp mt-1 w-full border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="filtru-inventar-status" className="text-corp block font-medium">
          Stare de circuit
        </label>
        <select
          key={filtre.status ?? ""}
          id="filtru-inventar-status"
          name="status"
          defaultValue={filtre.status ?? ""}
          className={CLASA_SELECT}
        >
          <option value="">Toate</option>
          {STATUSURI_OBIECT.map((status) => (
            <option key={status} value={status}>
              {ETICHETE_STATUS[status]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filtru-inventar-stare" className="text-corp block font-medium">
          Stare fizică
        </label>
        <select
          key={filtre.stare ?? ""}
          id="filtru-inventar-stare"
          name="stare"
          defaultValue={filtre.stare ?? ""}
          className={CLASA_SELECT}
        >
          <option value="">Toate</option>
          {STARI_OBIECT.map((stare) => (
            <option key={stare} value={stare}>
              {ETICHETE_STARE[stare]}
            </option>
          ))}
        </select>
      </div>

      {categorii.length > 0 ? (
        <div>
          <label htmlFor="filtru-inventar-categorie" className="text-corp block font-medium">
            Categorie
          </label>
          <select
            key={filtre.category_id ?? ""}
            id="filtru-inventar-categorie"
            name="category_id"
            defaultValue={filtre.category_id ?? ""}
            className={CLASA_SELECT}
          >
            <option value="">Toate</option>
            {categorii.map((optiune) => (
              <option key={optiune.id} value={optiune.id}>
                {optiune.denumire}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </BaraFiltre>
  );
}
