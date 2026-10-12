// src/lib/format/marime.ts
/**
 * Mărimea unui fișier, scrisă pentru om: „2,4 MB”.
 *
 * Funcție pură, FĂRĂ directivă — ca `numar.ts` și `money.ts` — fiindcă o
 * cheamă și Server Components (galeria de poze a sesizării, documentele
 * echipamentului), și câmpul de fișier din client.
 *
 * Până pe 12 oct 2026 stătea în `components/ui/incarcare-fisier.tsx`, care are
 * `"use client"`. Pe server, un export dintr-un asemenea modul NU e funcția, ci
 * o referință client: `galerie-foto.tsx` arunca „Attempted to call
 * marimeCitibila() from the server” de îndată ce o poză avea `marime_bytes`
 * completat, iar fișa sesizării cădea în error boundary. tsc, eslint și
 * vitest tac; de atunci îl prinde `pnpm check:server`
 * (`scripts/checks/client-imports-server-only.mjs`, direcția server → client).
 */

/** 1024, nu 1000. `angajati/import/import-client.tsx` calculează limita cu
 * 1024; dacă ecranul scrie „20 MB” cu o bază și verifică cu alta, un fișier de
 * 20,3 MB e respins de un ecran care tocmai i-a promis că încape. */
const PAS = 1024;

/** Simboluri SI, identice în orice limbă — deci nu sunt conținut traductibil. */
const UNITATI = ["B", "kB", "MB", "GB"] as const;

/** „2,4 MB”. Zecimală doar sub 10: „9,4 MB” ajută la decizie, „9,43 MB” nu. */
export function marimeCitibila(octeti: number): string {
  let valoare = Math.max(0, octeti);
  let treapta = 0;
  while (valoare >= PAS && treapta < UNITATI.length - 1) {
    valoare /= PAS;
    treapta += 1;
  }
  const zecimale = treapta === 0 || valoare >= 10 ? 0 : 1;
  // `minimumFractionDigits: 0`, nu `zecimale`: altfel un fișier de fix 1 MB se
  // scrie „1,0 MB”, iar zecimala aia sugerează o precizie care nu există.
  const cifre = valoare.toLocaleString("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: zecimale,
  });
  return `${cifre} ${UNITATI[treapta] ?? UNITATI[0]}`;
}
