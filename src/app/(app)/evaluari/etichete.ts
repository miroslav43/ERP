// src/app/(app)/evaluari/etichete.ts

/**
 * Vocabularul modulului, într-un singur loc.
 *
 * Convenția fișierului `etichete.ts` per modul există fiindcă opt module au azi
 * un astfel de fișier, iar portalul le importă direct: o hartă de etichete
 * scrisă în pagină ar trebui copiată acolo, iar cele două copii ar diverge la
 * prima redenumire.
 */

import type { TonStare } from "@/components/ui/badge";
import type { StatusEvaluare } from "@/schemas/evaluation";

export const ETICHETE_STATUS_EVALUARE: Readonly<Record<StatusEvaluare, string>> = {
  draft: "Ciornă",
  finalizat: "Finalizată",
};

/**
 * „Ciornă" e o treaptă neînceput, nu una de avertisment: nimic nu e în
 * neregulă cu o evaluare pe care cineva încă o scrie. Buluna goală a tonului
 * `ciorna` spune exact asta.
 */
export const TONURI_STATUS_EVALUARE: Readonly<Record<StatusEvaluare, TonStare>> = {
  draft: "ciorna",
  finalizat: "succes",
};

/**
 * Tonul barei de punctaj.
 *
 * Pragurile sunt o convenție de interfață, NU o regulă de HR: nicio lege și
 * niciun regulament din proiect nu spune că 60 % e „slab". De aceea nu ajung
 * niciodată în domeniu și nu se scriu în bază — dacă o firmă cere altele,
 * se schimbă aici, într-un singur loc, fără migrare.
 */
export function tonPunctaj(procent: number | null): "neutru" | "bun" | "atentie" | "rau" {
  if (procent === null) return "neutru";
  if (procent >= 80) return "bun";
  if (procent >= 60) return "neutru";
  if (procent >= 40) return "atentie";
  return "rau";
}
