// src/domain/attendance/calcul-ore.ts
// Funcții pure pentru derivarea orelor dintr-o zi de pontaj — folosite din UI
// (`celula-zi.tsx`) ca sugestie editabilă, nu ca sursă finală de adevăr:
// utilizatorul poate suprascrie oricând valoarea calculată.

/**
 * `"08:30"` → minute de la miezul nopții, sau `null` dacă formatul e invalid.
 *
 * Exportată fiindcă grila orară (`grila-orara.ts`) trebuie să înțeleagă `"08:30"`
 * EXACT ca `oreleZilei`: dacă o citește altfel, blocul desenat pe ecran și ora
 * salvată în bază se despart, iar nimic nu semnalează. Rămâne strictă — fără
 * secunde — deci apelantul care primește o coloană `time` din Postgres
 * (`"08:30:00"`) o trece întâi prin `formatOraZi`.
 */
export function minuteDinOra(ora: string): number | null {
  const potrivire = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(ora);
  if (potrivire === null) return null;
  const ore = potrivire[1];
  const minute = potrivire[2];
  if (ore === undefined || minute === undefined) return null;
  return Number(ore) * 60 + Number(minute);
}

/**
 * Ore lucrate dintr-un interval `oraInceput`–`oraSfarsit` (format `"HH:MM"`).
 * `null` dacă vreo oră lipsește/e invalidă sau dacă sfârșitul nu e strict
 * după început — modelul are un rând pe zi, deci un tur peste miezul nopții
 * nu se poate exprima aici (rămâne de introdus manual, ca și până acum).
 */
export function oreLucrateDinInterval(oraInceput: string, oraSfarsit: string): number | null {
  const inceput = minuteDinOra(oraInceput);
  const sfarsit = minuteDinOra(oraSfarsit);
  if (inceput === null || sfarsit === null || sfarsit <= inceput) return null;
  return Math.round(((sfarsit - inceput) / 60) * 100) / 100;
}

/** Ore suplimentare peste pragul legal de ore/zi al organizației (implicit 8h). */
export function oreSuplimentareDinLucrate(oreLucrate: number, orePeZi: number): number {
  return Math.max(0, Math.round((oreLucrate - orePeZi) * 100) / 100);
}

/**
 * Orele lucrate care cad în intervalul de noapte al organizației.
 *
 * `attendance_settings.noapte_start` / `noapte_sfarsit` (0013:39-40) existau de
 * la început și NU le consuma niciun cod: `ore_noapte` se tasta de mână în
 * `celula-zi.tsx`. Cine uita, pierdea sporul de 25%; cine exagera, îl încasa
 * nemeritat — și nimic nu compara cifra cu intervalul efectiv lucrat.
 *
 * Intervalul de noapte trece peste miezul nopții (tipic 22:00–06:00), deci se
 * sparge în două ferestre: `noapteStart`–24:00 și 00:00–`noapteSfarsit`. Tura
 * se intersectează cu fiecare, iar rezultatul e suma. Când intervalul NU trece
 * peste miezul nopții (configurație neobișnuită, dar permisă), rămâne o
 * singură fereastră.
 *
 * `null` în aceleași condiții ca `oreLucrateDinInterval`: ore invalide sau tură
 * care nu se închide în aceeași zi.
 */
export function oreNoapteDinInterval(
  oraInceput: string,
  oraSfarsit: string,
  noapteStart: string,
  noapteSfarsit: string,
): number | null {
  const inceput = minuteDinOra(oraInceput);
  const sfarsit = minuteDinOra(oraSfarsit);
  const nStart = minuteDinOra(noapteStart);
  const nSfarsit = minuteDinOra(noapteSfarsit);
  if (inceput === null || sfarsit === null || nStart === null || nSfarsit === null) return null;
  if (sfarsit <= inceput) return null;

  const ferestre: readonly (readonly [number, number])[] =
    nStart > nSfarsit
      ? [
          [nStart, 24 * 60],
          [0, nSfarsit],
        ]
      : [[nStart, nSfarsit]];

  let minute = 0;
  for (const [de, pana] of ferestre) {
    minute += Math.max(0, Math.min(sfarsit, pana) - Math.max(inceput, de));
  }
  return Math.round((minute / 60) * 100) / 100;
}

/**
 * Sporul de noapte se acordă doar peste un prag de ore de noapte pe zi.
 *
 * Codul Muncii art. 126 leagă sporul de „cel puțin 3 ore de muncă de noapte”.
 * Coloana `prag_ore_noapte` exista din 0057 cu implicitul 0 („zero = fără
 * prag”) și ZERO consumatori în calcul: sporul se aplica pe orice fracțiune de
 * oră de noapte. `prag = 0` rămâne valid și înseamnă tot „fără prag”, pentru
 * organizațiile care au ales deliberat asta.
 */
export function sporDeNoapteSeAplica(oreNoapte: number, pragOreNoapte: number): boolean {
  if (oreNoapte <= 0) return false;
  return oreNoapte >= pragOreNoapte;
}

// ── Ziua întreagă, dintr-un singur interval ──────────────────────────────────

/**
 * Parametrii organizației care intră în derivarea unei zile.
 *
 * Toți vin din `attendance_settings`, tabelă ale cărei valori sunt marcate în
 * migrarea 0013 „DE VERIFICAT DE JURIST”. Funcția nu are opinie despre cât
 * TREBUIE să fie o pauză — o aplică pe cea configurată.
 */
export interface ConfigZi {
  /** Durata normală a zilei; peste ea încep orele suplimentare. */
  readonly orePeZi: number;
  readonly noapteStart: string;
  readonly noapteSfarsit: string;
  /** `attendance_settings.pauza_masa_minute`. */
  readonly pauzaMinute: number;
  /** Când e inclusă în program, pauza e plătită și NU se scade. */
  readonly pauzaInclusaInProgram: boolean;
  /**
   * `attendance_settings.pauza_obligatorie_peste_ore` — sub pragul ăsta pauza
   * nu se scade deloc. Cine intră la 09:00 și pleacă la 12:00 n-a luat masa de
   * prânz, iar o jumătate de oră tăiată dintr-o tură de trei ore e o greșeală
   * vizibilă pe fluturașul lui.
   */
  readonly pauzaObligatoriePesteOre: number;
}

/** Descompunerea unei zile — fiecare cifră cu linia ei, ca omul să vadă DE CE. */
export interface OreleZilei {
  /** Sfârșit − început, înainte de orice scădere. */
  readonly brut: number;
  /** Cât s-a scăzut pentru masă. `0` când nu se aplică. */
  readonly pauza: number;
  /** Ce se scrie în `ore_lucrate`. */
  readonly lucrate: number;
  readonly suplimentare: number;
  readonly noapte: number;
}

/**
 * Toate cifrele unei zile de pontaj, derivate dintr-un singur interval.
 *
 * ── DE CE O SINGURĂ FUNCȚIE ───────────────────────────────────────────────
 * Aceleași cifre se afișează în formularul angajatului ȘI se rescriu pe server
 * înainte de scriere. Două implementări ar diverge, iar divergența s-ar vedea
 * abia pe fluturașul de salariu.
 *
 * ── PAUZA ─────────────────────────────────────────────────────────────────
 * `pauza_masa_minute` și `pauza_masa_inclusa_in_program` există din 0013,
 * se configurează din `/pontaj/setari`, se salvează — și până acum NICIUN
 * calcul nu le citea. Consecința: 08:30–17:00 producea 8,5 ore lucrate și 0,5
 * ore suplimentare în fiecare zi, pentru orice firmă cu pauză neplătită.
 *
 * ── PLAFONAREA ORELOR DE NOAPTE ───────────────────────────────────────────
 * `attendance_entries_noapte_ck` (0013:157) cere `ore_noapte <= ore_lucrate`.
 * Când tura cade întreagă în fereastra de noapte și pauza se scade totuși
 * (prag configurat 0), noaptea brută ar depăși orele lucrate și INSERT-ul ar
 * cădea cu 23514 — un mesaj de bază de date pe ecranul unui angajat. Se
 * plafonează aici, nu se lasă pe seama bazei.
 *
 * `null` în aceleași condiții ca `oreLucrateDinInterval`: ore invalide sau tură
 * care nu se închide în aceeași zi (modelul are un rând pe zi).
 */
export function oreleZilei(
  oraInceput: string,
  oraSfarsit: string,
  config: ConfigZi,
): OreleZilei | null {
  const brut = oreLucrateDinInterval(oraInceput, oraSfarsit);
  if (brut === null) return null;

  const seScade = !config.pauzaInclusaInProgram && brut > config.pauzaObligatoriePesteOre;
  // Pauza nu poate scoate ziua sub zero: o pauză configurată mai lungă decât
  // tura ar produce ore negative, respinse de `ore_lucrate >= 0`.
  const pauza = seScade ? Math.min(Math.round((config.pauzaMinute / 60) * 100) / 100, brut) : 0;
  const lucrate = Math.round((brut - pauza) * 100) / 100;

  const noapteBruta =
    oreNoapteDinInterval(oraInceput, oraSfarsit, config.noapteStart, config.noapteSfarsit) ?? 0;

  return {
    brut,
    pauza,
    lucrate,
    suplimentare: oreSuplimentareDinLucrate(lucrate, config.orePeZi),
    noapte: Math.min(noapteBruta, lucrate),
  };
}

// ── Inversa: din ora de început, intervalul unei zile normale ────────────────

/** Minute de la miezul nopții → `"08:30"`. Perechea lui `minuteDinOra`. */
export function oraDinMinute(minute: number): string {
  const ore = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(ore).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export interface IntervalPropus {
  readonly inceput: string;
  readonly sfarsit: string;
}

/**
 * Intervalul unei zile NORMALE, pornind de la ora la care începe programul.
 *
 * ── DE CE E NEVOIE DE INVERSA ───────────────────────────────────────────────
 * Butonul „Confirm ziua de azi" trebuie să arate un interval concret ÎNAINTE de
 * apăsare — un buton care scrie ceva ce omul n-a văzut nu e o scurtătură, e o
 * capcană. Iar intervalul afișat trebuie să producă exact `ore_pe_zi` când trece
 * prin `oreleZilei` pe server; altfel angajatul confirmă „ziua normală" și se
 * trezește cu o jumătate de oră suplimentară sau lipsă în fiecare zi.
 *
 * ── DE CE NU E O SIMPLĂ ADUNARE ─────────────────────────────────────────────
 * `sfarsit = inceput + orePeZi` e corect DOAR când pauza e plătită. Când nu e,
 * omul trebuie să stea la muncă `orePeZi` PLUS pauza, ca să iasă `orePeZi`
 * lucrate. Dar pauza se scade doar peste pragul `pauzaObligatoriePesteOre`, deci
 * există și un al treilea caz, în care ziua e prea scurtă ca pauza să conteze.
 *
 * Cele două candidaturi și condiția fiecăreia:
 *   A. `brut = orePeZi + pauza`, valabilă când `brut > prag` (pauza se scade,
 *      rămâne exact `orePeZi`);
 *   B. `brut = orePeZi`, valabilă când `orePeZi <= prag` (pauza nu se scade).
 * Când amândouă se potrivesc, se alege A: descrie ce trăiește omul — e la muncă
 * de la intrare până la ieșire, cu pauza înăuntru.
 *
 * Invariantul e verificat prin test, nu prin raționament:
 * `oreleZilei(propus.inceput, propus.sfarsit, config).lucrate === config.orePeZi`.
 *
 * `null` când ora e invalidă sau când ziua ar trece de miezul nopții — modelul
 * are un rând pe zi, iar `oreleZilei` ar refuza oricum intervalul.
 */
export function intervalulPropus(programStart: string, config: ConfigZi): IntervalPropus | null {
  const inceput = minuteDinOra(programStart);
  if (inceput === null) return null;
  if (config.orePeZi <= 0) return null;

  const pauzaOre = config.pauzaInclusaInProgram
    ? 0
    : Math.round((config.pauzaMinute / 60) * 100) / 100;
  const brutCuPauza = config.orePeZi + pauzaOre;
  const brut =
    !config.pauzaInclusaInProgram && brutCuPauza > config.pauzaObligatoriePesteOre
      ? brutCuPauza
      : config.orePeZi;

  const sfarsit = inceput + Math.round(brut * 60);
  // Ziua trebuie să se închidă în aceeași zi calendaristică. `24:00` nu e o oră
  // validă în `time`, deci pragul e strict.
  if (sfarsit >= 24 * 60) return null;

  return { inceput: oraDinMinute(inceput), sfarsit: oraDinMinute(sfarsit) };
}

/**
 * Config-ul zilei, dintr-un rând de `attendance_settings` care poate lipsi.
 *
 * ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
 * Aceleași șase valori de rezervă (8 h, 22:00, 06:00, pauză 0, inclusă, prag 0)
 * erau scrise IDENTIC în patru locuri: `pontaj/actions.ts`, pagina zilei din
 * portal, pagina săptămânii și, de acum, pontarea rapidă. Patru copii ale unei
 * valori implicite diverg la prima schimbare, iar divergența se vede pe
 * fluturașul de salariu, nu în teste.
 *
 * Absența setărilor e NORMALĂ, nu o eroare: nu există seed pentru
 * `attendance_settings`. Pauza implicită e ZERO și „inclusă în program", adică
 * nu se scade nimic — o firmă care n-a configurat nimic nu trebuie să piardă
 * tăcut ore din pontajul oamenilor.
 *
 * Parametrul e tipat STRUCTURAL, nu prin importul lui `SetariPontaj` din stratul
 * de citiri: domeniul nu are voie să depindă de stratul de acces la date.
 */
export function configZiDin(
  setari: Readonly<{
    ore_pe_zi: number;
    noapte_start: string;
    noapte_sfarsit: string;
    pauza_masa_minute: number;
    pauza_masa_inclusa_in_program: boolean;
    pauza_obligatorie_peste_ore: number;
  }> | null,
): ConfigZi {
  return {
    orePeZi: setari?.ore_pe_zi ?? 8,
    // `time` din Postgres vine cu secunde (`"22:00:00"`); aritmetica de aici
    // lucrează pe `HH:MM`.
    noapteStart: setari?.noapte_start.slice(0, 5) ?? "22:00",
    noapteSfarsit: setari?.noapte_sfarsit.slice(0, 5) ?? "06:00",
    pauzaMinute: setari?.pauza_masa_minute ?? 0,
    pauzaInclusaInProgram: setari?.pauza_masa_inclusa_in_program ?? true,
    pauzaObligatoriePesteOre: setari?.pauza_obligatorie_peste_ore ?? 0,
  };
}
