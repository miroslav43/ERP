/**
 * Constantele ecranului de cereri demo.
 *
 * Separate de `actions.ts` fiindcă acela e marcat `"use server"`, iar un modul
 * de server poate exporta EXCLUSIV funcții async. Restricția e intenționată:
 * tot ce exportă un astfel de modul devine un punct de intrare apelabil din
 * rețea, deci o listă sau un dicționar nu au ce căuta acolo.
 */

export const STATUSURI_CERERE = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "rejected",
  "spam",
] as const;

export type StatusCerere = (typeof STATUSURI_CERERE)[number];

export const ETICHETE_STATUS: Readonly<Record<StatusCerere, string>> = {
  new: "Nouă",
  contacted: "Contactată",
  qualified: "Calificată",
  converted: "Convertită",
  rejected: "Respinsă",
  spam: "Spam",
};
