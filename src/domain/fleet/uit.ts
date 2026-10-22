// src/domain/fleet/uit.ts

/**
 * Codul UIT (RO e-Transport) pe cursele foii de parcurs (F12f, 0217).
 * Funcții pure, fără I/O și fără ceas: zilele sunt șiruri `AAAA-LL-ZZ`, iar
 * aritmetica merge în UTC (`adaugaZile`), ca să nu alunece peste granița zilei.
 *
 * ── CE FACE APLICAȚIA ─────────────────────────────────────────────────────
 * Ține minte codul primit de șofer, îl VERIFICĂ (format, cifre de control,
 * valabilitate în ziua foii) și AVERTIZEAZĂ când lipsește. Nu declară nimic la
 * ANAF, nu verifică online că UIT-ul există și nu transmite poziția GPS: toate
 * cer SPV sau dispozitivul de poziționare și rămân în afara aplicației.
 *
 * ── SURSELE (accesate pe 12.10.2026) ──────────────────────────────────────
 * - Formatul: XSD-ul ANAF `schema_ETR_v2_20230126.xsd`, tipul `UitType`:
 *   `[0-9ACDEFHJKLMNPQRTUVWXY]{14}[0-9]{2}`. Literele O, I, Z, S, G, B lipsesc
 *   din alfabet fiindcă seamănă cu 0, 1, 2, 5, 6, 8.
 * - Cifrele de control: regula BR-019 din Schematron-ul ANAF v2.0.2
 *   (12.08.2024) — ultimele două caractere = ultimele două cifre ale sumei
 *   codurilor ASCII ale primelor 14. Documentație tehnică, nu act normativ.
 * - Valabilitatea: OUG 41/2022 art. 11 alin. (2), consolidarea din 24.04.2025 —
 *   5 zile calendaristice, 15 la achizițiile intracomunitare, la tranzitul cu
 *   descărcare spre depozitare și la nontransfer (art. 2 pct. 9 lit. g) și j)),
 *   „începând cu data declarată pentru începerea transportului”.
 * - Ziua de început se numără (⚠ interpretare): `data_exp_uit` din API-ul ANAF
 *   e „data începând cu care UIT-ul este considerat expirat”, adică prima zi
 *   expirată; exemplul 24.06 + 5 → 29.06 vine din documentația secundară.
 * - Pragul de vehicul: 2,5 t masă maximă tehnic admisibilă (Ordinul
 *   1.337/1.268/2024 art. 1 alin. (4)). Doar notă informativă: `masa_maxima_kg`
 *   din fișă poate fi masa autorizată, nu cea tehnic admisibilă.
 *
 * Mesajele românești ale avertismentelor stau în `src/app/(app)/flota/etichete.ts`.
 */

import { adaugaZile } from "@/domain/attendance/saptamana";

/** Încadrarea cursei, ca în enum-ul `public.e_transport_incadrare` (0217). */
export const E_INCADRARI = ["neaplicabil", "risc_fiscal_national", "international"] as const;
export type EIncadrare = (typeof E_INCADRARI)[number];

/** Alfabetul primelor 14 caractere, fără O, I, Z, S, G, B. */
export const ALFABET_UIT = "0123456789ACDEFHJKLMNPQRTUVWXY";
export const TIPAR_UIT = /^[0-9ACDEFHJKLMNPQRTUVWXY]{14}[0-9]{2}$/u;
/** Ordinul 1.337/1.268/2024, art. 1 alin. (4). */
export const PRAG_MASA_E_TRANSPORT_KG = 2500;
/** OUG 41/2022 art. 11 alin. (2). Baza acceptă 1–31, formularul oferă doar acestea. */
export const VALABILITATI_UIT = [5, 15] as const;
export const VALABILITATE_UIT_IMPLICITA = 5;
/** OUG 41/2022 art. 11 alin. (1): declararea, cu cel mult 3 zile înainte de transport. */
export const ZILE_DECLARARE_INAINTE = 3;

const LUNGIME_UIT = 16;

/**
 * Literele scoase din alfabet, cu cifra cu care seamănă. Maparea e neambiguă
 * tocmai fiindcă ANAF le-a scos; cifrele de control prind orice mapare greșită.
 */
const ASEMANATOARE: Readonly<Record<string, string>> = {
  O: "0",
  I: "1",
  Z: "2",
  S: "5",
  G: "6",
  B: "8",
};

/**
 * Codul tastat de pe o hârtie, adus la forma ANAF: majuscule, fără spații,
 * puncte sau cratime, iar O, I, Z, S, G, B devin 0, 1, 2, 5, 6, 8.
 *
 * Maparea se face DOAR aici, în client. Baza normalizează doar majusculele și
 * separatorii: un import care trimite „O” primește un refuz clar, nu o
 * corectură tăcută.
 */
export function normalizeazaUit(brut: string): string {
  return brut
    .toUpperCase()
    .replace(/[\s.-]/gu, "")
    .replace(/[OIZSGB]/gu, (litera) => ASEMANATOARE[litera] ?? litera);
}

/** Ultimele două cifre ale sumei codurilor ASCII ale primelor 14 caractere (BR-019). */
export function cifreDeControlUit(primele14: string): string {
  let suma = 0;
  for (const caracter of primele14) suma += caracter.charCodeAt(0);
  return String(suma).padStart(2, "0").slice(-2);
}

export type ProblemaUit = "lungime" | "caractere" | "control";

/** Verifică un cod DEJA normalizat. Ordinea: lungimea, alfabetul, cifrele de control. */
export function verificaUit(uit: string): { ok: true } | { ok: false; problema: ProblemaUit } {
  if (uit.length !== LUNGIME_UIT) return { ok: false, problema: "lungime" };
  if (!TIPAR_UIT.test(uit)) return { ok: false, problema: "caractere" };
  if (cifreDeControlUit(uit.slice(0, 14)) !== uit.slice(14)) {
    return { ok: false, problema: "control" };
  }
  return { ok: true };
}

/** Codul în grupe de patru, cum se citește de pe hârtie: „3V0P 0L0P 0T3J UW46”. */
export function grupeazaUit(uit: string): string {
  return uit.replace(/(.{4})(?=.)/gu, "$1 ");
}

/**
 * Intervalul de valabilitate. Ziua de început e ziua 1, deci 24.06 cu 5 zile e
 * valabil 24–28.06, iar `primaZiExpirata` e 29.06, ca `data_exp_uit` de la ANAF
 * și ca `trip_sheet_uit.expira_la` din bază.
 */
export function intervalValabilitate(
  dataInceput: string,
  zile: number,
): { ultimaZiValabila: string; primaZiExpirata: string } {
  const primaZiExpirata = adaugaZile(dataInceput, zile);
  return { ultimaZiValabila: adaugaZile(primaZiExpirata, -1), primaZiExpirata };
}

export type StareUitLaZi = "valabil" | "neinceput" | "expirat";

/** Starea codului în ziua `zi` (ziua foii). Șirurile `AAAA-LL-ZZ` se compară lexicografic. */
export function stareUitLaZi(
  u: Readonly<{ data_inceput: string; valabilitate_zile: number }>,
  zi: string,
): StareUitLaZi {
  if (zi < u.data_inceput) return "neinceput";
  const { primaZiExpirata } = intervalValabilitate(u.data_inceput, u.valabilitate_zile);
  return zi >= primaZiExpirata ? "expirat" : "valabil";
}

export type AvertismentETransport =
  | { tip: "lipsa_uit" }
  | { tip: "uit_expirat"; uit: string; primaZiExpirata: string }
  | { tip: "uit_neinceput"; uit: string; dataInceput: string }
  | { tip: "vehicul_sub_prag"; masaKg: number };

/** Avertismentele care nu depind de vehicul: le numără și coada de aprobări. */
export const AVERTISMENTE_DE_NUMARAT: readonly AvertismentETransport["tip"][] = [
  "lipsa_uit",
  "uit_expirat",
  "uit_neinceput",
];

export interface UitPentruAvertisment {
  readonly uit: string;
  readonly data_inceput: string;
  readonly valabilitate_zile: number;
}

/**
 * Cursa e MONITORIZATĂ dacă omul a marcat-o sau dacă are deja un UIT. Pe una
 * monitorizată: lipsa codului, fiecare cod care nu e valabil în ziua foii și,
 * doar informativ, vehiculul cu masa sub prag. Una nemonitorizată nu primește
 * nimic. Nimic de aici nu blochează salvarea sau trimiterea (decizia I-T2).
 */
export function avertismenteCursa(
  cursa: Readonly<{ e_transport: EIncadrare }>,
  uituri: readonly UitPentruAvertisment[],
  ziuaFoii: string,
  masaVehiculKg: number | null,
): readonly AvertismentETransport[] {
  const monitorizata = cursa.e_transport !== "neaplicabil" || uituri.length > 0;
  if (!monitorizata) return [];

  const avertismente: AvertismentETransport[] = [];
  if (uituri.length === 0) avertismente.push({ tip: "lipsa_uit" });
  for (const u of uituri) {
    const stare = stareUitLaZi(u, ziuaFoii);
    if (stare === "expirat") {
      avertismente.push({
        tip: "uit_expirat",
        uit: u.uit,
        primaZiExpirata: intervalValabilitate(u.data_inceput, u.valabilitate_zile).primaZiExpirata,
      });
    } else if (stare === "neinceput") {
      avertismente.push({ tip: "uit_neinceput", uit: u.uit, dataInceput: u.data_inceput });
    }
  }
  if (masaVehiculKg !== null && masaVehiculKg < PRAG_MASA_E_TRANSPORT_KG) {
    avertismente.push({ tip: "vehicul_sub_prag", masaKg: masaVehiculKg });
  }
  return avertismente;
}

/**
 * Câte avertismente e-Transport are fiecare foaie, pentru coada de aprobări.
 * Numără DOAR `AVERTISMENTE_DE_NUMARAT`: nota de prag cere vehiculul, care
 * pentru aprobator poate veni NULL, iar numărată aici ar da altă cifră decât pe
 * pagina foii. Toate cursele contează, nu doar cele marcate: una „neaplicabil”
 * cu un UIT e monitorizată implicit.
 */
export function numaraAvertismentePeFoi(
  foi: readonly Readonly<{ id: string; data: string }>[],
  curse: readonly Readonly<{ id: string; trip_sheet_id: string; e_transport: EIncadrare }>[],
  uituri: readonly (UitPentruAvertisment & Readonly<{ cursa_id: string }>)[],
): ReadonlyMap<string, number> {
  const peCursa = new Map<string, UitPentruAvertisment[]>();
  for (const u of uituri) {
    const lista = peCursa.get(u.cursa_id) ?? [];
    lista.push(u);
    peCursa.set(u.cursa_id, lista);
  }
  const ziua = new Map(foi.map((f) => [f.id, f.data] as const));
  const rezultat = new Map<string, number>(foi.map((f) => [f.id, 0] as const));
  for (const c of curse) {
    const zi = ziua.get(c.trip_sheet_id);
    if (zi === undefined) continue;
    const numar = avertismenteCursa(c, peCursa.get(c.id) ?? [], zi, null).filter((a) =>
      AVERTISMENTE_DE_NUMARAT.includes(a.tip),
    ).length;
    rezultat.set(c.trip_sheet_id, (rezultat.get(c.trip_sheet_id) ?? 0) + numar);
  }
  return rezultat;
}

/**
 * Secțiunea UIT a cursei se arată (decizia I-f1): pe un vehicul cu masa
 * maximă ≥ 2.500 kg sau necunoscută (embed-ul vehiculului poate veni NULL,
 * capcana #18), plus pe orice cursă deja marcată sau cu coduri.
 */
export function arataSectiuneaUit(
  masaVehiculKg: number | null,
  cursa: Readonly<{ e_transport: EIncadrare }>,
  numarUituri: number,
): boolean {
  return (
    masaVehiculKg === null ||
    masaVehiculKg >= PRAG_MASA_E_TRANSPORT_KG ||
    cursa.e_transport !== "neaplicabil" ||
    numarUituri > 0
  );
}

/**
 * Nota nemodală pentru data de început tastată (fără CHECK în bază): mai mult
 * de 3 zile înainte de ziua foii (fereastra de declarare, art. 11 alin. (1)) sau
 * mai mult de 15 zile după (valabilitatea maximă). Un an greșit, 2062 în loc
 * de 2026, iese aici.
 */
export function dataInceputNeobisnuita(dataInceput: string, ziuaFoii: string): boolean {
  return (
    dataInceput < adaugaZile(ziuaFoii, -VALABILITATI_UIT[1]) ||
    dataInceput > adaugaZile(ziuaFoii, ZILE_DECLARARE_INAINTE)
  );
}
