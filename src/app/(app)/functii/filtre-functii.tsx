// src/app/(app)/functii/filtre-functii.tsx
// Server Component: fără stare, fără handler, fără JavaScript trimis în browser.
// Trimiterea și pastilele de filtru activ stau în `BaraFiltre`.
import { Search } from "lucide-react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import type { FiltreFunctii } from "@/schemas/job-position";

/**
 * Cheile administrate de bară. `sort` NU e aici: nu e filtru, iar bara n-are
 * voie să-l atingă — altfel fiecare apăsare pe „Filtrează” ar arunca sortarea
 * aleasă din antetul tabelului.
 */
const CHEI_PROPRII = ["q", "stare", "cor"] as const;

const CLASA_SELECT = "border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2";

export function FiltreFunctii({ filtre }: Readonly<{ filtre: FiltreFunctii }>) {
  const active: FiltruActiv[] = [];
  if (filtre.q !== null) active.push({ cheie: "q", eticheta: `Caută: ${filtre.q}` });
  if (filtre.stare !== null) {
    active.push({
      cheie: "stare",
      eticheta: filtre.stare === "activa" ? "Doar active" : "Doar inactive",
    });
  }
  if (filtre.cor !== null) active.push({ cheie: "cor", eticheta: "Fără cod COR" });

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII} textAplica="Filtrează">
      <div className="min-w-56 flex-1">
        <label htmlFor="filtru-functii-q" className="text-corp block font-medium">
          Caută funcția
        </label>
        <div className="border-foreground/60 rounded-control mt-1 flex items-center gap-2 border px-2 focus-within:outline-2">
          <Search aria-hidden="true" className="text-muted-foreground size-4" />
          <input
            // `key` legat de valoarea din adresă: un control NECONTROLAT își ia
            // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi
            // rămas cu valoarea veche în câmp — și ar fi reaplicat-o la
            // următoarea apăsare pe „Filtrează”.
            key={filtre.q ?? ""}
            id="filtru-functii-q"
            name="q"
            type="search"
            defaultValue={filtre.q ?? ""}
            placeholder="Denumire, cod intern, cod COR sau ocupație"
            className="text-corp w-full bg-transparent py-2"
          />
        </div>
        <p className="text-muted-foreground text-nota mt-1">
          Caută și în denumirea ocupației din Clasificarea Ocupațiilor — „autoturisme” găsește
          funcția cu codul 832201.
        </p>
      </div>

      <div>
        <label htmlFor="filtru-functii-stare" className="text-corp block font-medium">
          Stare
        </label>
        <select
          key={filtre.stare ?? ""}
          id="filtru-functii-stare"
          name="stare"
          defaultValue={filtre.stare ?? ""}
          className={CLASA_SELECT}
        >
          <option value="">Toate</option>
          <option value="activa">Doar active</option>
          <option value="inactiva">Doar inactive</option>
        </select>
      </div>

      <div>
        <label htmlFor="filtru-functii-cor" className="text-corp block font-medium">
          Cod COR
        </label>
        <select
          key={filtre.cor ?? ""}
          id="filtru-functii-cor"
          name="cor"
          defaultValue={filtre.cor ?? ""}
          className={CLASA_SELECT}
        >
          <option value="">Toate</option>
          <option value="lipsa">Doar cele fără cod</option>
        </select>
      </div>
    </BaraFiltre>
  );
}
