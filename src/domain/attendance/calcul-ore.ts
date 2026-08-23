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
