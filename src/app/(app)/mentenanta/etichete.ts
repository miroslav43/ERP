// src/app/(app)/mentenanta/etichete.ts
import type {
  RezultatInterventie,
  StatusEchipament,
  StatusSesizare,
  TipContor,
  TipMentenanta,
  UrgentaSesizare,
} from "@/schemas/maintenance";
import type { StareScadentaMentenanta } from "@/domain/maintenance/scadente";
import type { TonStare } from "@/components/ui/badge";

export const ETICHETE_STATUS_ECHIPAMENT: Readonly<Record<StatusEchipament, string>> = {
  in_functiune: "În funcțiune",
  in_reparatie: "În reparație",
  in_conservare: "În conservare",
  casat: "Casat",
};

export const TONURI_STATUS_ECHIPAMENT: Readonly<Record<StatusEchipament, TonStare>> = {
  in_functiune: "succes",
  // În reparație = utilajul lipsește din producție acum; e o stare de urmărit, nu o reușită.
  in_reparatie: "atentie",
  in_conservare: "neutru",
  casat: "neutru",
};

export const ETICHETE_TIP_CONTOR: Readonly<Record<TipContor, string>> = {
  ore: "Ore de funcționare",
  km: "Kilometri",
  cicluri: "Cicluri",
};

/**
 * Unitatea, pe scurt, pentru locurile în care contorul stă lângă o cifră.
 * „1.284 Ore de funcționare” într-o celulă de tabel citește prost; „1.284 ore”,
 * nu.
 */
export const UNITATI_CONTOR: Readonly<Record<TipContor, string>> = {
  ore: "ore",
  km: "km",
  cicluri: "cicluri",
};

/**
 * Cifrele de contor se scriu cu separator de mii, ca sumele.
 *
 * `citire` e `numeric(14,2)` în bază, deci poate purta zecimale; se arată numai
 * dacă există. Fără separator, „1284” și „12840” se disting greu pe verticală,
 * iar coloana de contoare exact asta cere — o comparație între rânduri.
 */
const NUMAR_CONTOR = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

export function formatContor(valoare: number, tip: TipContor): string {
  return `${NUMAR_CONTOR.format(valoare)} ${UNITATI_CONTOR[tip]}`;
}

/** Doar cifra, fără unitate — pentru celulele care au deja unitatea în antet. */
export function formatCifraContor(valoare: number): string {
  return NUMAR_CONTOR.format(valoare);
}

/**
 * Periodicitatea unui plan, în cuvinte.
 *
 * Era construită din trei ternare lipite, în două fișiere. `maintenance_plans`
 * cere prin CHECK cel puțin una dintre periodicități, deci „—” n-ar trebui să
 * apară niciodată — dar un implicit scris e mai bun decât o celulă goală pe
 * care nimeni n-o poate explica.
 */
export function formatPeriodicitate(plan: {
  readonly periodicitate_zile: number | null;
  readonly periodicitate_contor: number | null;
  readonly tip_contor: TipContor | null;
}): string {
  const bucati: string[] = [];
  if (plan.periodicitate_zile !== null) bucati.push(`La ${String(plan.periodicitate_zile)} zile`);
  if (plan.periodicitate_contor !== null && plan.tip_contor !== null) {
    bucati.push(`La ${formatContor(plan.periodicitate_contor, plan.tip_contor)}`);
  }
  return bucati.length === 0 ? "—" : bucati.join(" · ");
}

export const ETICHETE_TIP_MENTENANTA: Readonly<Record<TipMentenanta, string>> = {
  preventiva: "Preventivă",
  predictiva: "Predictivă",
  corectiva: "Corectivă",
};

export const ETICHETE_REZULTAT_INTERVENTIE: Readonly<Record<RezultatInterventie, string>> = {
  reusita: "Reușită",
  partiala: "Parțială",
  esuata: "Eșuată",
  amanata: "Amânată",
};

export const TONURI_REZULTAT_INTERVENTIE: Readonly<Record<RezultatInterventie, TonStare>> = {
  reusita: "succes",
  // Parțială = lucrarea s-a făcut pe jumătate, rămâne de revenit — atenție, nu succes.
  partiala: "atentie",
  esuata: "pericol",
  // Amânată = nu s-a încheiat nimic; intervenția s-a închis fără efect.
  amanata: "neutru",
};

export const ETICHETE_URGENTA_SESIZARE: Readonly<Record<UrgentaSesizare, string>> = {
  scazuta: "Scăzută",
  medie: "Medie",
  ridicata: "Ridicată",
  critica: "Critică",
};

/**
 * Urgența e o SCARĂ, nu o stare: nu există „succes” pe ea. Scăzută rămâne
 * neutră (nu cere nimic), medie și ridicată împart tonul de atenție — se
 * despart prin CUVÂNT, singurul purtător de înțeles — iar critica e pericol.
 */
export const TONURI_URGENTA_SESIZARE: Readonly<Record<UrgentaSesizare, TonStare>> = {
  scazuta: "neutru",
  medie: "atentie",
  ridicata: "atentie",
  critica: "pericol",
};

export const ETICHETE_STATUS_SESIZARE: Readonly<Record<StatusSesizare, string>> = {
  nou: "Nouă",
  in_analiza: "În analiză",
  in_lucru: "În lucru",
  rezolvat: "Rezolvată",
  respins: "Respinsă",
};

export const TONURI_STATUS_SESIZARE: Readonly<Record<StatusSesizare, TonStare>> = {
  // Nouă = nimeni n-a atins-o încă; e neînceput, nu „în regulă”.
  nou: "ciorna",
  in_analiza: "atentie",
  // În lucru = deschisă și în sarcina cuiva. Atenție, nu succes: succesul e „Rezolvată”.
  in_lucru: "atentie",
  rezolvat: "succes",
  respins: "pericol",
};

export const ETICHETE_STARE_SCADENTA: Readonly<Record<StareScadentaMentenanta, string>> = {
  in_intarziere: "În întârziere",
  scadenta_apropiata: "Scadență apropiată",
  in_regula: "În regulă",
  fara_scadenta: "Fără scadență",
};

/*
 * `TONURI_STARE_SCADENTA` a dispărut odată cu trecerea ultimului ecran de
 * mentenanță pe `<Scadenta>` — la fel ca perechile ei din
 * `src/app/(app)/ssm/etichete.ts` și `src/app/(app)/flota/etichete.ts`.
 * Severitatea vine acum dintr-un singur loc: `TREPTE_MENTENANTA` din
 * `src/domain/maintenance/scadente.ts`, iar pastila își ia și culoarea, și
 * forma din treaptă. O hartă de tonuri paralelă ar fi fost a doua sursă pentru
 * aceeași stare — exact felul de divergență din care s-a născut primitiva.
 * Rămâne numai CUVÂNTUL, în `ETICHETE_STARE_SCADENTA`.
 */

/**
 * Un număr cu substantivul lui, scris ca în limba română.
 *
 * Panoul scria „1 planuri de mentenanță”, iar antetul listei de planuri lipea
 * un „de” fix: „3 de planuri ACTIVE”. Regula cere „de” peste 19, după ULTIMELE
 * DOUĂ cifre, nu după mărime — „20 de planuri”, dar „101 planuri”. Aceeași
 * regulă e implementată pentru zile în `src/app/(app)/diurna/etichete.ts`;
 * dacă mai apare un al treilea apelant, locul ei e un modul de format comun.
 */
export function textNumarat(numar: number, singular: string, plural: string): string {
  const cifre = Math.abs(Math.trunc(numar));
  if (cifre === 1) return `${numar.toLocaleString("ro-RO")} ${singular}`;
  const ultimeleDoua = cifre % 100;
  const cereDe = cifre >= 20 && (ultimeleDoua === 0 || ultimeleDoua >= 20);
  return `${numar.toLocaleString("ro-RO")} ${cereDe ? "de " : ""}${plural}`;
}
