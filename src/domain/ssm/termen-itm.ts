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

/**
 * ── DE CE NU AJUNGE `oreRamasePanaLaTermen` LA AFIȘARE ────────────────────
 * Funcția de mai sus întoarce ore ZECIMALE, iar ecranele o randau ca atare:
 * „Mai sunt 11.5 ore până la termenul legal." Nimeni nu transformă mental
 * „11,5 ore" în „la ce oră trebuie să sun la ITM" — mai ales sub presiune, la
 * ora 3 dimineața, după un accident. Cifra rămâne pentru comparații (sortare,
 * praguri); pentru ochi se compun două lucruri: cât a mai rămas, în ore și
 * minute, și ORA-LIMITĂ ABSOLUTĂ.
 */

const formatorOraLimita = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatorZiLimita = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type RestTermenItm = Readonly<{
  /** Termenul a trecut deja. `ore` și `minute` măsoară atunci DEPĂȘIREA. */
  depasit: boolean;
  ore: number;
  minute: number;
}>;

/**
 * Cât a mai rămas până la termen, în ore și minute întregi.
 *
 * Minutele se rotunjesc în JOS (`Math.floor`) pe ramura rămasă și în SUS pe cea
 * depășită: în ambele cazuri, rotunjirea merge în defavoarea celui care trebuie
 * să sune. „Mai sunt 0 minute" e o afirmație pe care o poți crede; „mai este 1
 * minut" când de fapt au mai rămas 12 secunde nu e.
 */
export function restTermenItm(momentLimita: Date, acum: Date): RestTermenItm {
  const diferentaMs = momentLimita.getTime() - acum.getTime();
  const depasit = diferentaMs < 0;
  const minuteTotale = depasit
    ? Math.ceil(-diferentaMs / 60_000)
    : Math.floor(diferentaMs / 60_000);
  return {
    depasit,
    ore: Math.floor(minuteTotale / 60),
    minute: minuteTotale % 60,
  };
}

/**
 * Acordul lui „de" — regula românească: apare de la 20 în sus și la multiplii
 * de 100. „3 de ore" era una dintre erorile pe care le producea formatarea
 * naivă cu șablon.
 */
function numarCuUnitate(n: number, singular: string, plural: string): string {
  if (n === 1) return `1 ${singular}`;
  const rest = n % 100;
  const cuDe = n !== 0 && (rest === 0 || rest >= 20);
  return `${n} ${cuDe ? "de " : ""}${plural}`;
}

/** `{ ore: 7, minute: 12 }` → `"7 ore și 12 minute"`. */
export function formuleazaRestTermenItm(rest: RestTermenItm): string {
  const ore = numarCuUnitate(rest.ore, "oră", "ore");
  const minute = numarCuUnitate(rest.minute, "minut", "minute");
  if (rest.ore === 0) return minute;
  if (rest.minute === 0) return ore;
  return `${ore} și ${minute}`;
}

/**
 * Ora-limită, spusă cum ar spune-o un om: `"azi la 18:40"`, `"mâine la 09:00"`,
 * `"pe 17.01.2026, la 09:00"`.
 *
 * Ziua se compară în calendarul ROMÂNESC, nu în UTC: un termen la 01:30 ora
 * României cade în ziua UTC precedentă, iar „mâine" ar fi devenit „azi" pentru
 * cinci ore pe zi, iarna, și pentru trei vara.
 */
export function oraLimitaInCuvinte(momentLimita: Date, acum: Date): string {
  const ora = formatorOraLimita.format(momentLimita);
  const ziLimita = formatorZiLimita.format(momentLimita);
  const ziAcum = formatorZiLimita.format(acum);
  if (ziLimita === ziAcum) return `azi la ${ora}`;

  const [aL, lL, zL] = ziLimita.split("-").map(Number);
  const [aA, lA, zA] = ziAcum.split("-").map(Number);
  const zile = Math.round(
    (Date.UTC(aL ?? 0, (lL ?? 1) - 1, zL ?? 1) - Date.UTC(aA ?? 0, (lA ?? 1) - 1, zA ?? 1)) /
      86_400_000,
  );
  if (zile === 1) return `mâine la ${ora}`;
  if (zile === -1) return `ieri la ${ora}`;

  const zi = `${String(zL).padStart(2, "0")}.${String(lL).padStart(2, "0")}.${String(aL)}`;
  return `pe ${zi}, la ${ora}`;
}
