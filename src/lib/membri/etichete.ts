// src/lib/membri/etichete.ts
// Cum se numesc rolurile pe ecran. Fără import de server: fișierul e citit și de
// componente client (`membri-client.tsx`, `selector-rol.tsx`).
//
// Lista trăia în `membri-client.tsx`, iar al doilea ecran care are nevoie de ea
// ar fi copiat-o. Copia e locul unde „Resurse umane" devine „HR" într-un singur
// loc și nimeni nu observă, fiindcă nimic nu dă eroare.
// `import type`, nu import obișnuit: e ȘTERS complet la compilare, deci nu trage
// `schimba-rol.ts` — și odată cu el clientul Supabase de server — în pachetul
// trimis browserului.
import type { RolAtribuibil } from "./schimba-rol";

export const ROLURI: readonly Readonly<{ valoare: RolAtribuibil; eticheta: string }>[] = [
  { valoare: "org_admin", eticheta: "Administrator" },
  { valoare: "manager", eticheta: "Manager" },
  { valoare: "hr", eticheta: "Resurse umane" },
  { valoare: "employee", eticheta: "Angajat" },
];

/** Rolul necunoscut se afișează ca atare, nu se ascunde: e un semn că baza a luat-o înainte. */
export function etichetaRol(rol: string): string {
  return ROLURI.find((element) => element.valoare === rol)?.eticheta ?? rol;
}
