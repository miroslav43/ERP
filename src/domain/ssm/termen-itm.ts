// src/domain/ssm/termen-itm.ts

/**
 * Momentul-limită de comunicare a unui accident de muncă la ITM și orele
 * rămase până acolo — pentru banda de pe `/ssm` care numără invers.
 *
 * `work_accidents.termen_comunicare_ore` e completat de triggerul
 * `internal.ssm_accident_guard` (0011) din `ssm_legal_parameters`, cu
 * valoarea implicită 24 de ore dacă parametrul nu există. Termenul legal
 * curge de la `data_producerii` + `ora_producerii` (dacă e cunoscută; altfel
 * de la miezul nopții acelei zile) — NU de la momentul înregistrării în
 * aplicație, care poate fi mai târziu.
 *
 * `data_producerii` e o coloană `date`, `ora_producerii` e o coloană `time`,
 * ambele fără fus orar — reprezintă ora de perete din România. Conversia la
 * un moment UTC exact ține cont de ora de vară/iarnă prin `Intl.DateTimeFormat`
 * cu `timeZone: "Europe/Bucharest"`, fără nicio dependență de bibliotecă:
 * se formatează o presupunere UTC în ora locală, iar diferența dintre cele
 * două dă exact deplasamentul UTC valabil la acea dată.
 */

const TIMEZONE = "Europe/Bucharest";

const formatorOffset = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function extrage(parti: readonly Intl.DateTimeFormatPart[], tip: string): number {
  const parte = parti.find((p) => p.type === tip);
  if (parte === undefined) throw new Error(`Componenta „${tip}” lipsește din formatul de dată.`);
  // `Intl` poate întoarce „24” pentru miezul nopții la unele locale; normalizăm.
  return parte.value === "24" ? 0 : Number(parte.value);
}

/** Deplasamentul UTC (în minute) al fusului României, la momentul dat. */
function decalajBucurestiMinute(presupunereUtc: Date): number {
  const parti = formatorOffset.formatToParts(presupunereUtc);
  const local = Date.UTC(
    extrage(parti, "year"),
    extrage(parti, "month") - 1,
    extrage(parti, "day"),
    extrage(parti, "hour"),
    extrage(parti, "minute"),
    extrage(parti, "second"),
  );
  return Math.round((local - presupunereUtc.getTime()) / 60_000);
}

/**
 * Convertește o oră de perete din România (an/lună/zi/oră/minut) în momentul
 * UTC corespunzător, ținând cont corect de ora de vară/iarnă.
 */
function laMomentUtc(an: number, luna: number, zi: number, ora: number, minut: number): Date {
  const presupunere = new Date(Date.UTC(an, luna - 1, zi, ora, minut));
  const decalaj = decalajBucurestiMinute(presupunere);
  return new Date(presupunere.getTime() - decalaj * 60_000);
}

const TIPAR_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIPAR_ORA = /^(\d{2}):(\d{2})/;

/**
 * Momentul-limită până la care accidentul trebuie comunicat la ITM.
 *
 * @param dataProducerii Zi ISO (`work_accidents.data_producerii`).
 * @param oraProducerii Oră `"HH:MM"` sau `"HH:MM:SS"` (`ora_producerii`), sau
 *   `null` dacă nu e cunoscută — se ia miezul nopții acelei zile.
 * @param termenComunicareOre `work_accidents.termen_comunicare_ore`.
 */
export function momentLimitaComunicareItm(
  dataProducerii: string,
  oraProducerii: string | null,
  termenComunicareOre: number,
): Date {
  const potrivireData = TIPAR_DATA.exec(dataProducerii);
  if (potrivireData === null) {
    throw new TypeError(`Dată invalidă pentru producerea accidentului: ${dataProducerii}`);
  }
  const [, anText, lunaText, ziText] = potrivireData;
  const an = Number(anText);
  const luna = Number(lunaText);
  const zi = Number(ziText);

  let ora = 0;
  let minut = 0;
  if (oraProducerii !== null) {
    const potrivireOra = TIPAR_ORA.exec(oraProducerii);
    if (potrivireOra === null) {
      throw new TypeError(`Oră invalidă pentru producerea accidentului: ${oraProducerii}`);
    }
    ora = Number(potrivireOra[1]);
    minut = Number(potrivireOra[2]);
  }

  const momentProducerii = laMomentUtc(an, luna, zi, ora, minut);
  return new Date(momentProducerii.getTime() + termenComunicareOre * 3_600_000);
}

/**
 * Orele rămase până la termenul-limită. Negativ dacă termenul a trecut deja —
 * apelantul decide cum afișează depășirea (nu funcția asta).
 */
export function oreRamasePanaLaTermen(momentLimita: Date, acum: Date): number {
  return (momentLimita.getTime() - acum.getTime()) / 3_600_000;
}
