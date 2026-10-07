// src/app/(app)/mentenanta/echipamente/filtre-echipamente.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { clasaBifa } from "@/components/ui/camp";
import { STATUS_ECHIPAMENT, type FiltreEchipamente } from "@/schemas/maintenance";

import { ETICHETE_STATUS_ECHIPAMENT } from "../etichete";

/**
 * Cheile pe care le administrează bara — exact cele pe care le scria vechiul
 * `aplica()`, nici una în plus, nici una în minus.
 *
 * Vechiul `aplica()` pornea din `new URLSearchParams()` GOL și repopula doar
 * `cauta` și `status`, deci orice apăsare pe „Filtrează” arunca `sort` și
 * `limita` — ordinea aleasă din antetul tabelului și mărimea de pagină
 * dispăreau tăcut. Aici nu mai apar: bara pleacă din parametrii existenți și
 * nu poate șterge decât ce i s-a declarat.
 */
const CHEI_PROPRII = [
  "cauta",
  "status",
  "categorie",
  "punct_lucru",
  "iscir",
  "responsabil",
] as const;

export interface OptiuneFiltru {
  readonly id: string;
  readonly nume: string;
}

export type PropsFiltreEchipamente = Readonly<{
  /** Filtrele DEJA validate de pagină, ca pastilele să nu arate valori inventate. */
  filtre: Pick<
    FiltreEchipamente,
    "cauta" | "status" | "categorie" | "punct_lucru" | "iscir" | "responsabil"
  >;
  categorii: readonly string[];
  puncteLucru: readonly OptiuneFiltru[];
  responsabili: readonly OptiuneFiltru[];
}>;

const CLASA_CONTROL = "border-foreground/60 rounded-control text-corp border px-3 py-2";

/**
 * Fișierul n-are `"use client"` și nu mai are ce căuta: fără `aplica()`, fără
 * `useRouter`/`usePathname`/`useSearchParams` și fără `useTransition`, nu-i
 * rămâne nici stare, nici handler. Valorile curente vin ca prop de la pagină,
 * deci formularul se randează pe server și pleacă din pachetul rutei.
 */
export function FiltreEchipamenteForm({
  filtre,
  categorii,
  puncteLucru,
  responsabili,
}: PropsFiltreEchipamente): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.cauta !== null) {
    active.push({ cheie: "cauta", eticheta: `Cod sau denumire: ${filtre.cauta}` });
  }
  if (filtre.status !== null) {
    active.push({
      cheie: "status",
      eticheta: `Stare: ${ETICHETE_STATUS_ECHIPAMENT[filtre.status]}`,
    });
  }
  if (filtre.categorie !== null) {
    active.push({ cheie: "categorie", eticheta: `Categorie: ${filtre.categorie}` });
  }
  if (filtre.punct_lucru !== null) {
    active.push({
      cheie: "punct_lucru",
      eticheta: `Punct de lucru: ${puncteLucru.find((p) => p.id === filtre.punct_lucru)?.nume ?? "ales"}`,
    });
  }
  if (filtre.iscir === "da") active.push({ cheie: "iscir", eticheta: "Doar ISCIR" });
  if (filtre.responsabil !== null) {
    active.push({
      cheie: "responsabil",
      eticheta: `Responsabil: ${responsabili.find((r) => r.id === filtre.responsabil)?.nume ?? "ales"}`,
    });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-echipamente-cauta" className="text-corp font-medium">
          Cod sau denumire
        </label>
        <input
          // `key` legat de valoarea din adresă: ștergerea unei pastile schimbă
          // adresa fără să atingă formularul, iar un control NECONTROLAT și-ar
          // păstra în DOM valoarea veche, deja scoasă din listă.
          key={filtre.cauta ?? ""}
          id="filtru-echipamente-cauta"
          name="cauta"
          type="search"
          defaultValue={filtre.cauta ?? ""}
          placeholder="Ex. CMP-014"
          className={CLASA_CONTROL}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-echipamente-status" className="text-corp font-medium">
          Stare
        </label>
        <select
          key={filtre.status ?? ""}
          id="filtru-echipamente-status"
          name="status"
          defaultValue={filtre.status ?? ""}
          className={CLASA_CONTROL}
        >
          <option value="">Toate</option>
          {STATUS_ECHIPAMENT.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_ECHIPAMENT[s]}
            </option>
          ))}
        </select>
      </div>

      {categorii.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtru-echipamente-categorie" className="text-corp font-medium">
            Categorie
          </label>
          <select
            key={filtre.categorie ?? ""}
            id="filtru-echipamente-categorie"
            name="categorie"
            defaultValue={filtre.categorie ?? ""}
            className={CLASA_CONTROL}
          >
            <option value="">Toate</option>
            {categorii.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {puncteLucru.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtru-echipamente-punct" className="text-corp font-medium">
            Punct de lucru
          </label>
          <select
            key={filtre.punct_lucru ?? ""}
            id="filtru-echipamente-punct"
            name="punct_lucru"
            defaultValue={filtre.punct_lucru ?? ""}
            className={CLASA_CONTROL}
          >
            <option value="">Toate</option>
            {puncteLucru.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nume}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-echipamente-responsabil" className="text-corp font-medium">
          Responsabil
        </label>
        <select
          key={filtre.responsabil ?? ""}
          id="filtru-echipamente-responsabil"
          name="responsabil"
          defaultValue={filtre.responsabil ?? ""}
          className={CLASA_CONTROL}
        >
          <option value="">Oricare</option>
          {responsabili.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 self-end pb-2">
        <input
          key={filtre.iscir ?? ""}
          id="filtru-echipamente-iscir"
          name="iscir"
          type="checkbox"
          value="da"
          defaultChecked={filtre.iscir === "da"}
          className={clasaBifa}
        />
        <label htmlFor="filtru-echipamente-iscir" className="text-corp">
          Doar ISCIR
        </label>
      </div>
    </BaraFiltre>
  );
}
