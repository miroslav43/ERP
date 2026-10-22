// src/domain/fleet/contabil/csv.ts
//
// Bucățile comune ale fișierelor CSV ale exportului contabil (F12g).
import type { DateString } from "@/lib/format/date";

export interface OptiuniCsv {
  readonly separator: ";" | ",";
  readonly zecimale: "," | ".";
}

export const CSV_IMPLICIT: OptiuniCsv = { separator: ";", zecimale: "," };

/** BOM-ul UTF-8: Excel deschide fișierul cu diacriticele corecte. */
export const BOM = "﻿";

/**
 * O celulă de TEXT. Excel interpretează `=`, `+`, `-`, `@` și tabul la început ca
 * formulă: se prefixează cu apostrof (aceeași protecție ca nota de salarii,
 * `src/app/api/export/salarizare/nota/route.ts`). Ghilimelele se dublează.
 *
 * Sumele, conturile și datele NU trec pe aici: sunt generate de noi, iar un `'`
 * în fața lor ar ajunge ca atare în programul de contabilitate.
 */
export function celulaText(valoare: string): string {
  const curat = valoare.replace(/\r?\n/gu, " ");
  const protejat = /^[=+\-@\t]/u.test(curat) ? `'${curat}` : curat;
  return `"${protejat.replace(/"/gu, '""')}"`;
}

/** Bani → `1234,56` sau `1234.56`, fără separator de mii și fără virgulă mobilă. */
export function sumaCsv(bani: number, zecimale: "," | "."): string {
  const semn = bani < 0 ? "-" : "";
  const absolut = Math.abs(bani);
  const lei = Math.floor(absolut / 100);
  const subunitati = absolut % 100;
  return `${semn}${String(lei)}${zecimale}${String(subunitati).padStart(2, "0")}`;
}

/** Bani → `1234.56`, cu punct: formatul fișierelor de import (WinMentor, Saga). */
export function sumaCuPunct(bani: number): string {
  return sumaCsv(bani, ".");
}

/** `2026-10-03` → `03.10.2026`. */
export function dataRo(zi: DateString): string {
  const [an = "", luna = "", ziua = ""] = zi.split("-");
  return `${ziua}.${luna}.${an}`;
}

/** Rândurile unite cu CRLF, plus CRLF final. */
export function randuri(linii: readonly string[]): string {
  return `${linii.join("\r\n")}\r\n`;
}
