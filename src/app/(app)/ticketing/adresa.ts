// src/app/(app)/ticketing/adresa.ts
//
// Construirea adreselor de listă, pentru cele două ecrane care afișează tichete.
//
// ── DE CE PORNEȘTE DIN PARAMETRII EXISTENȚI ──────────────────────────────────
// Fiindcă altfel fiecare control se șterge pe rând: o schimbare de mărime de
// pagină pornită dintr-un `URLSearchParams` gol ar arunca filtrele, iar un link
// de filtrare ar arunca mărimea de pagină. Aceeași lecție e scrisă pe larg în
// `components/ui/bara-filtre.tsx`: cheile necunoscute supraviețuiesc prin
// construcție, nu prin grija fiecărui autor.

/**
 * Adresa curentă cu o singură schimbare aplicată peste parametrii existenți.
 *
 * `cale` e ruta de bază („/ticketing" sau „/ticketing/coada"), `parametri` sunt
 * `searchParams` așa cum îi primește pagina, iar `schimba` primește o copie a
 * lor și scrie doar ce are de scris.
 */
export function adresaCu(
  cale: string,
  parametri: Record<string, string | string[] | undefined>,
  schimba: (p: URLSearchParams) => void,
): string {
  const p = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
  }
  schimba(p);
  return p.size === 0 ? cale : `${cale}?${p.toString()}`;
}
