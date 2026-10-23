// src/app/(app)/flota/foi/cheie-caseta-foaie.ts
//
// Fără `"use client"` și fără `server-only`: o cheamă paginile (server), iar o
// funcție exportată dintr-un modul client ar ajunge la ele ca PROXY.

/**
 * Cheia lui `DialogFoaieNoua` pe `/flota/foi` și pe `/portal/masina-mea`.
 *
 * Caseta își ține vehiculul și kilometrajul în `useState`, inițializate din
 * `vehiculInitial` o singură dată, la montare. Asistentul (F12e) propune foaia
 * prin `?foaie=noua&vehicul=<id>`; când a doua propunere venea pe ALT vehicul,
 * cheia rămânea „foaie-noua”, React păstra instanța veche, iar caseta arăta tot
 * vehiculul primei propuneri (sau rămânea închisă după prima salvare). Cu
 * vehiculul în cheie, fiecare propunere nouă remontează caseta, deschisă, pe
 * vehiculul ei.
 */
export function cheieCasetaFoaie(deschide: boolean, vehiculInitial: string | null): string {
  return `${deschide ? "foaie-noua" : "lista"}:${vehiculInitial ?? "-"}`;
}
