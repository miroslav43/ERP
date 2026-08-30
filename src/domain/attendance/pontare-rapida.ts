// src/domain/attendance/pontare-rapida.ts
// Ce butoane de pontare vede angajatul, și ce se face cu codul de pe afiș.
// Funcții PURE: primesc rândul citit din `setari_pontare_rapida` și întorc
// decizii. Niciun I/O, nicio dată curentă — la fel ca restul modulelor din
// `src/domain/attendance/`.
//
// ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
// Cinci ecrane recompuneau aceeași decizie din `setari?.mod_pontare_rapida ??
// "oprit"`, iar unul dintre ele e poarta de scriere (`pregatirePontareRapida`).
// Implicitul „oprit" nu fusese ales de nimeni: venea din `ALTER TABLE … ADD
// COLUMN … DEFAULT 'oprit'` (0096), adică din backfill. Efectul se vedea în
// producție — o firmă cu modulul pornit și cu afiș QR tipărit primea, la
// scanare, „Pontarea prin cod nu e activată. Afișul pe care l-ați scanat e
// probabil vechi."
//
// Regula e aceeași cu a lui `configZiDin` din `calcul-ore.ts`: lipsa
// configurării e o stare NORMALĂ, cu implicite utile, nu o stare de refuz.

import type { Enums } from "@/types/database";

export type ModPontare = Enums<"mod_pontare_rapida">;
export type VerificarePontare = Enums<"verificare_pontare">;

/** Rândul din `setari_pontare_rapida`, cât îi trebuie modulului ăstuia. */
export interface RandPontareRapida {
  readonly mod_pontare_rapida: ModPontare;
  readonly verificare_pontare: VerificarePontare;
  /** `time` din Postgres, cu secunde: `"08:30:00"`. */
  readonly program_start: string | null;
}

export interface ConfigPontareRapida {
  readonly mod: ModPontare;
  /** `HH:MM`, fără secunde — forma cerută de aritmetica din `calcul-ore`. */
  readonly programStart: string | null;
  readonly verificare: VerificarePontare;
}

/**
 * Ce se aplică unei firme care n-a configurat nimic.
 *
 * `ceas` — „Am intrat" / „Am ieșit" — fiindcă e singurul mod care funcționează
 * fără configurare: `confirmare` și `ambele` propun un interval derivat din
 * `program_start`, iar fără el butonul nici nu s-ar desena.
 *
 * `optional` — afișul de la punctul de lucru pontează pentru cine îl scanează,
 * butonul obișnuit rămâne pentru restul. NU `cod_qr`: acela ascunde butonul, iar
 * pornit din oficiu ar bloca pontarea exact în firmele fără afiș tipărit. Și nu
 * `fara`: o firmă care ȘI-A tipărit afișul ar trebui altfel să configureze ceva
 * ca să-l poată folosi, ceea ce e chiar defectul reparat aici.
 */
export const IMPLICIT_PONTARE_RAPIDA = {
  mod: "ceas",
  verificare: "optional",
} as const satisfies { readonly mod: ModPontare; readonly verificare: VerificarePontare };

/** `"08:30:00"` → `"08:30"`. */
function faraSecunde(ora: string | null): string | null {
  return ora === null ? null : ora.slice(0, 5);
}

/**
 * Configurația în vigoare, cu implicitele aplicate.
 *
 * `null` înseamnă „firma n-a salvat niciodată nimic", nu „firma a stins
 * pontarea" — a doua se scrie `mod = 'oprit'` și e o alegere care se vede în
 * audit.
 */
export function configPontareRapida(rand: RandPontareRapida | null): ConfigPontareRapida {
  return {
    mod: rand?.mod_pontare_rapida ?? IMPLICIT_PONTARE_RAPIDA.mod,
    programStart: faraSecunde(rand?.program_start ?? null),
    verificare: rand?.verificare_pontare ?? IMPLICIT_PONTARE_RAPIDA.verificare,
  };
}

export interface PosibilitatiPontare {
  /** Butonul „Am intrat" / „Am ieșit". */
  readonly poateCeas: boolean;
  /** Butonul care pontează ziua standard dintr-o apăsare. */
  readonly poateConfirma: boolean;
  /** Firma cere scanarea: butoanele de mai sus NU se desenează fără cod. */
  readonly cereScanare: boolean;
  /** Scanarea e disponibilă ca a doua cale, pe lângă butoane. */
  readonly oferaScanare: boolean;
}

/**
 * Ce se desenează pe ecranul de pontare.
 *
 * `areAfis` spune dacă firma are măcar un punct de lucru activ cu `cod_pontaj`.
 * Fără el, `optional` n-are ce oferi: un îndemn la scanare fără nimic de scanat
 * e mai rău decât tăcerea.
 */
export function cePoateFace(config: ConfigPontareRapida, areAfis: boolean): PosibilitatiPontare {
  const cereScanare = config.verificare === "cod_qr";
  const modPermiteCeas = config.mod === "ceas" || config.mod === "ambele";
  const modPermiteConfirmare = config.mod === "confirmare" || config.mod === "ambele";

  return {
    poateCeas: modPermiteCeas && !cereScanare,
    poateConfirma: modPermiteConfirmare && !cereScanare,
    cereScanare,
    oferaScanare: config.verificare === "optional" && areAfis && config.mod !== "oprit",
  };
}

/** Ce face serverul cu codul primit de la client. */
export type TratareCod = "ignorat" | "de_rezolvat" | "cerut_lipsa";

/**
 * Regula codului de pe afiș, ca decizie separată de rezolvarea lui.
 *
 * Asimetria de la `optional` e intenționată: absența codului trece (omul a
 * apăsat butonul din portal, nu a scanat), dar un cod PREZENT se rezolvă
 * întotdeauna. Un afiș vechi sau al altei firme n-are voie să treacă tăcut
 * drept pontare fără punct de lucru — ar arăta ca o scanare reușită și ar
 * înregistra altceva decât crede omul.
 */
export function cumSeTrateazaCodul(verificare: VerificarePontare, cod: string | null): TratareCod {
  if (verificare === "fara") return "ignorat";
  if (verificare === "cod_qr") return cod === null ? "cerut_lipsa" : "de_rezolvat";
  return cod === null ? "ignorat" : "de_rezolvat";
}
