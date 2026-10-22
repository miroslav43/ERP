// src/app/(app)/flota/rezervari/filtre-rezervari.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { filtreRezervariSchema, STATUS_REZERVARE } from "@/schemas/fleet-rezervari";

/** Etichetele statusurilor din BAZĂ, pentru filtru (nu stările afișate, derivate). */
const ETICHETE_STATUS: Readonly<Record<(typeof STATUS_REZERVARE)[number], string>> = {
  ceruta: "Cerute",
  confirmata: "Confirmate",
  respinsa: "Respinse",
  anulata: "Anulate",
};

const CHEI_PROPRII = ["stare", "vehicul"] as const;

export type PropsFiltreRezervari = Readonly<{
  parametri: Record<string, string | string[] | undefined>;
  vehicule: readonly Readonly<{ id: string; nr_inmatriculare: string }>[];
}>;

/** Filtrele listei de rezervări; `angajat` vine doar din linkuri (fișa angajatului). */
export function FiltreRezervari({ parametri, vehicule }: PropsFiltreRezervari): ReactElement {
  const filtre = filtreDinUrl(filtreRezervariSchema, parametri);
  const numar = new Map(vehicule.map((v) => [v.id, v.nr_inmatriculare]));
  const active: FiltruActiv[] = [];
  if (filtre.stare !== null) {
    active.push({ cheie: "stare", eticheta: `Stare: ${ETICHETE_STATUS[filtre.stare]}` });
  }
  if (filtre.vehicul !== null) {
    active.push({
      cheie: "vehicul",
      eticheta: `Mașina: ${numar.get(filtre.vehicul) ?? "alta decât cele de pool"}`,
    });
  }
  if (filtre.angajat !== null) {
    active.push({ cheie: "angajat", eticheta: "Angajatul ales" });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII} cheiExterne={["angajat"]}>
      <Camp nume="stare" eticheta="Stare" fel="select" className="w-full sm:w-48">
        {(a) => (
          <select {...a} key={filtre.stare ?? ""} defaultValue={filtre.stare ?? ""}>
            <option value="">Toate</option>
            {STATUS_REZERVARE.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>
      {vehicule.length === 0 ? null : (
        <Camp nume="vehicul" eticheta="Mașina" fel="select" className="w-full sm:w-48">
          {(a) => (
            <select {...a} key={filtre.vehicul ?? ""} defaultValue={filtre.vehicul ?? ""}>
              <option value="">Toate</option>
              {vehicule.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nr_inmatriculare}
                </option>
              ))}
            </select>
          )}
        </Camp>
      )}
    </BaraFiltre>
  );
}
