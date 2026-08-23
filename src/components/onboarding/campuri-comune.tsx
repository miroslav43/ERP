// src/components/onboarding/campuri-comune.tsx

/**
 * Ce a mai rămas comun celor șapte pași ai asistentului, după ce câmpurile au
 * trecut pe `<Camp>`.
 *
 * ── CE ERA AICI ȘI DE CE A DISPĂRUT ───────────────────────────────────────
 * `claseCamp`, `claseLabel` și componenta `Eroare` — adică o a doua definiție,
 * locală, a ceea ce `src/components/ui/camp.tsx` face pentru tot restul
 * produsului. Diferența nu era de stil, ci de comportament: `Eroare` randa
 * mesajul cu un `id`, dar LEGAREA lui de control rămânea în grija fiecărui
 * câmp, iar la aproape toate lipsea. Rezultatul: pe cel mai lung formular din
 * produs, mesajele de validare erau invizibile pentru cititoarele de ecran.
 *
 * Fișierul nu mai are `"use client"`: nu mai exportă nicio componentă, doar o
 * funcție pură. Un fișier marcat inutil ca „de client" trage tot ce importă în
 * pachetul de JavaScript al rutei.
 */

/**
 * Mesajul de eroare al lui react-hook-form, în forma cerută de `<Camp erori>`.
 *
 * RHF dă cel mult un mesaj per câmp (`errors.x?.message`), iar `Camp` primește
 * o listă — fiindcă `ActionResult.fieldErrors` de pe server poate întoarce mai
 * multe. Conversia stă aici, nu la fiecare câmp, ca cele două forme de validare
 * (client și server) să ajungă în ACELAȘI marcaj, cu aceeași legătură ARIA.
 *
 * Întoarce LISTĂ GOALĂ, nu `undefined`, iar asta nu e o preferință de stil:
 * `exactOptionalPropertyTypes: true` face ca `erori={undefined}` să nu
 * compileze, deci fiecare câmp ar fi avut nevoie de o împrăștiere condiționată.
 * `Camp` tratează lista goală drept „fără eroare”, deci apelul rămâne o linie.
 */
export function mesajeEroare(mesaj: string | undefined): readonly string[] {
  return mesaj === undefined || mesaj === "" ? [] : [mesaj];
}
