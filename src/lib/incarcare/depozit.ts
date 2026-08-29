// src/lib/incarcare/depozit.ts

import { PLAFON_TARE } from "./praguri";

/**
 * Depozitarul stării de încărcare.
 *
 * ── DE CE NU EXISTĂ PROVIDER ──────────────────────────────────────────────
 * Același raționament ca la `src/components/ui/toast.tsx`, și din aceeași
 * cauză: `(app)/layout.tsx` și layout-ul rădăcină sunt Server Components. Un
 * `createContext` le-ar transforma în client, cu tot arborele de deasupra
 * paginilor. Așa, depozitarul trăiește la nivel de modul, iar `porneste()` se
 * poate chema de oriunde — inclusiv din afara React.
 *
 * ── DE CE CONTOR, NU BOOLEAN ──────────────────────────────────────────────
 * Un `seIncarca: boolean` pare suficient până în ziua în care două lucruri se
 * suprapun: utilizatorul apasă „Aprobă" într-un dialog, iar între timp expiră
 * un `router.refresh()` pornit de altcineva. Cine se termină primul stinge
 * voalul peste cel care încă lucrează, iar ecranul minte. Cu o listă de surse,
 * voalul cade când se golește lista, nu la primul `opreste()`.
 *
 * ── DE CE FIECARE SURSĂ ARE UN PLAFON ─────────────────────────────────────
 * O sursă scursă (senzor demontat fără curățare, tranziție care nu se închide)
 * ar lăsa voalul aprins la nesfârșit, iar voalul înghite clicurile. `PLAFON_TARE`
 * o stinge din oficiu. E o plasă, nu o scuză să nu chemi `opreste()`.
 */

export type Sursa = Readonly<{
  readonly id: number;
  /** Ce se așteaptă, la persoana a treia: „panoul", „lista de angajați". Intră în textul voalului. */
  readonly eticheta?: string | undefined;
  readonly pornitLa: number;
}>;

type Ascultator = (surse: readonly Sursa[]) => void;

let urmatorulId = 1;
let surse: readonly Sursa[] = [];
const ascultatori = new Set<Ascultator>();
const cronometre = new Map<number, ReturnType<typeof setTimeout>>();

function publica(): void {
  for (const a of ascultatori) a(surse);
}

function scoate(id: number): void {
  const cronometru = cronometre.get(id);
  if (cronometru !== undefined) {
    clearTimeout(cronometru);
    cronometre.delete(id);
  }
  const lungimeInainte = surse.length;
  surse = surse.filter((s) => s.id !== id);
  if (surse.length !== lungimeInainte) publica();
}

/**
 * Anunță că începe o așteptare. Întoarce funcția care o încheie.
 *
 * Funcția întoarsă e idempotentă: a doua chemare nu face nimic. Asta contează
 * fiindcă apelantul tipic o cheamă și din `finally`, și din curățarea unui
 * `useEffect`, iar dubla scădere ar stinge voalul altcuiva.
 */
export function porneste(eticheta?: string): () => void {
  const id = urmatorulId++;
  surse = [...surse, { id, eticheta, pornitLa: Date.now() }];
  cronometre.set(
    id,
    setTimeout(() => scoate(id), PLAFON_TARE),
  );
  publica();

  let oprita = false;
  return () => {
    if (oprita) return;
    oprita = true;
    scoate(id);
  };
}

export function aboneaza(ascultator: Ascultator): () => void {
  ascultatori.add(ascultator);
  return () => {
    ascultatori.delete(ascultator);
  };
}

export function surseCurente(): readonly Sursa[] {
  return surse;
}

/**
 * Golește depozitarul.
 *
 * Starea supraviețuiește demontării consumatorului — corect în aplicație, unde
 * voalul stă în layout-ul rădăcină și nu se demontează niciodată, dar o scurgere
 * între teste. La deconectare nu e nevoie: `PLAFON_TARE` acoperă cazul.
 */
export function goleste(): void {
  for (const cronometru of cronometre.values()) clearTimeout(cronometru);
  cronometre.clear();
  surse = [];
  publica();
}
