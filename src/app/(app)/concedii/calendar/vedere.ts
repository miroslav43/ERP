// src/app/(app)/concedii/calendar/vedere.ts
//
// Cele două forme ale calendarului de concedii, într-un singur loc.
//
// Fișier separat, nu constante în `page.tsx`, dintr-un motiv mecanic: pagina e
// un modul de server cu `metadata` și componente async, iar `navigare-luna.tsx`
// are nevoie de aceeași uniune. Un import dinspre componentă spre pagină ar
// închide un ciclu.

export const VEDERI_CALENDAR = [
  {
    cheie: "planificator",
    eticheta: "Planificator",
    descriere: "Un rând pentru fiecare angajat, o coloană pentru fiecare zi.",
  },
  {
    cheie: "grila",
    eticheta: "Grilă lunară",
    descriere: "Luna în săptămâni, cu absențele adunate în ziua lor.",
  },
] as const;

export type VedereCalendar = (typeof VEDERI_CALENDAR)[number]["cheie"];

/**
 * Vederea implicită a calendarului.
 *
 * Planificatorul, nu grila: e forma care răspunde la întrebarea pentru care
 * oamenii deschid ecranul — „cine e disponibil săptămâna viitoare". Grila
 * lunară rămâne la un clic distanță, cu luna păstrată.
 */
export const VEDERE_IMPLICITA: VedereCalendar = "planificator";

/** Parametrul din URL → vedere. Orice altceva cade pe cea implicită. */
export function vedereDinParametru(valoare: string | string[] | undefined): VedereCalendar {
  const brut = Array.isArray(valoare) ? valoare[0] : valoare;
  const gasita = VEDERI_CALENDAR.find((v) => v.cheie === brut);
  return gasita?.cheie ?? VEDERE_IMPLICITA;
}
