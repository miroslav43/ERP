// src/app/(app)/flota/rezervari/etichete.ts
//
// Tonurile stărilor afișate ale rezervării. Modul NEUTRU (fără `"use client"`,
// fără `server-only`): îl folosesc și paginile de server, și componentele client
// (memoria „Constantă client importată în server”).
import type { TonStare } from "@/components/ui/badge";
import type { StareAfisata } from "@/domain/fleet/rezervari";

export { ETICHETE_STARE_AFISATA } from "@/domain/fleet/rezervari";

export const TONURI_STARE_AFISATA: Readonly<Record<StareAfisata, TonStare>> = {
  // Cererea așteaptă pe altcineva: atenție, ca foaia trimisă.
  in_asteptare: "atentie",
  expirata_nedecisa: "neutru",
  viitoare: "succes",
  in_curs: "succes",
  incheiata: "neutru",
  respinsa: "pericol",
  anulata: "neutru",
};

/** Ziua săptămânii, scurt, pentru antetul grilei (din șirul `YYYY-MM-DD`, în UTC). */
const ZILE_SCURT = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"] as const;

export function ziuaScurt(zi: string): string {
  return ZILE_SCURT[new Date(`${zi}T00:00:00Z`).getUTCDay()] ?? "";
}

/** „14.10” — ziua și luna, pentru antetul grilei. */
export function ziLuna(zi: string): string {
  return `${zi.slice(8, 10)}.${zi.slice(5, 7)}`;
}
