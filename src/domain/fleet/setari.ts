// src/domain/fleet/setari.ts

/**
 * Setările flotei (0198, `fleet_settings`): implicitele și forma pragurilor de
 * alertă. Funcții pure, fără I/O.
 *
 * ── DE CE IMPLICITELE STAU AICI ──────────────────────────────────────────────
 * O firmă fără rând de setări folosește valorile `default` ale coloanelor, iar
 * ecranul trebuie să le arate pe ACELEAȘI. Sunt trei locuri care le știu:
 * coloanele din 0198, `internal.flota_prag_salt_km()` (0012, rezerva de 1.500
 * km) și `internal.praguri_implicite()` (0008, 30/14/7). Constantele de mai jos
 * le copiază, iar `setari.test.ts` le fixează, ca o schimbare într-o parte să
 * nu treacă tăcut.
 */

/** Pragul de salt al kilometrajului, în km, când nici vehiculul, nici firma nu-l schimbă. */
export const PRAG_SALT_IMPLICIT_KM = 1500;

/** Zilele dinainte de scadență la care pleacă alertele, când firma nu le schimbă. */
export const PRAGURI_ALERTA_IMPLICITE: readonly number[] = [30, 14, 7];

/** Limitele din CHECK-urile tabelei (`fleet_settings_*_ck`). */
export const LIMITE_SETARI_FLOTA = {
  pragSaltMin: 50,
  pragSaltMax: 100_000,
  pragAlertaMin: 1,
  pragAlertaMax: 365,
  praguriMaxim: 8,
  responsabiliMaxim: 20,
} as const;

/**
 * Pragurile de alertă scrise de om („30, 14, 7”), ca listă de zile.
 *
 * Desparte pe virgulă, punct și virgulă sau spațiu; ignoră golurile; păstrează
 * fiecare valoare o singură dată și le ordonează descrescător, exact cum le
 * normalizează triggerul din bază — ca ecranul să arate, după salvare, ce a
 * ajuns în `alert_rules`.
 *
 * Întoarce `null` dacă vreo bucată nu e un număr întreg pozitiv („30, două”,
 * „7.5”): un prag ghicit ar muta tăcut data unei alerte. Intervalul (1–365) și
 * numărul de praguri le verifică schema, cu mesajele lor.
 */
export function pragurileDinText(text: string): readonly number[] | null {
  const bucati = text
    .split(/[\s,;]+/u)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const zile: number[] = [];
  for (const bucata of bucati) {
    if (!/^\d{1,4}$/u.test(bucata)) return null;
    zile.push(Number(bucata));
  }
  return [...new Set(zile)].sort((a, b) => b - a);
}

/** Pragurile pentru câmpul de formular: „30, 14, 7”. */
export function textulPragurilor(praguri: readonly number[]): string {
  return praguri.join(", ");
}
