// src/domain/attendance/calcul-ore.ts
// Funcții pure pentru derivarea orelor dintr-o zi de pontaj — folosite din UI
// (`celula-zi.tsx`) ca sugestie editabilă, nu ca sursă finală de adevăr:
// utilizatorul poate suprascrie oricând valoarea calculată.

/** `"08:30"` → minute de la miezul nopții, sau `null` dacă formatul e invalid. */
function minuteDinOra(ora: string): number | null {
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
