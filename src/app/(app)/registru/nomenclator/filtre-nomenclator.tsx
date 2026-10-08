"use client";

// src/app/(app)/registru/nomenclator/filtre-nomenclator.tsx
//
// Un singur câmp: căutarea. Nomenclatorul nu e paginat (se citește întreg, ca
// anexa nr. 1), deci filtrarea se face pe server, în TypeScript, peste lista
// completă — iar starea stă în adresă, ca la orice listă din aplicație.

import { useSearchParams } from "next/navigation";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";

export function FiltreNomenclator() {
  const parametri = useSearchParams();
  const cautare = parametri.get("q") ?? "";

  const active: readonly FiltruActiv[] =
    cautare === "" ? [] : [{ cheie: "q", eticheta: `Caută: ${cautare}` }];

  return (
    <BaraFiltre active={active} cheiProprii={["q"]} textAplica="Caută">
      <Camp nume="q" eticheta="Caută în nomenclator" className="w-full sm:w-80">
        {(atribute) => (
          <input
            {...atribute}
            key={cautare}
            type="search"
            defaultValue={cautare}
            placeholder="Indicativ, dosar, compartiment, tip de document"
          />
        )}
      </Camp>
    </BaraFiltre>
  );
}
