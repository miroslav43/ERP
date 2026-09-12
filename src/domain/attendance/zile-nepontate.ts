// src/domain/attendance/zile-nepontate.ts
/**
 * Zilele lucrătoare ale lunii pe care angajatul nu le-a scris încă.
 *
 * Ecranul de acasă al portalului aduna până acum orele lunii și atât: scria
 * „Luna aceasta: 48 ore" și tăcea despre ce lipsește. Cifra e adevărată și
 * inutilă — nimeni nu știe pe de rost câte ore ar fi trebuit să fie. Restanța
 * se vede numai deschizând calendarul lunii, adică exact drumul pe care omul
 * nu-l face.
 *
 * Funcția NU cere nimic bazei: primește zilele deja citite de pagină
 * (`pontajulMeu`) și regimul de lucru al firmei (`attendance_settings`), pe care
 * ecranul le are oricum pentru cardul „Astăzi".
 *
 * Funcție PURĂ, pe șiruri `YYYY-MM-DD`, ca tot restul modulului — coloana e
 * `date` în Postgres, iar un `Date` construit în fusul serverului ar aluneca
 * peste granița zilei.
 */

import { meritaPontata, type RegimZile } from "./zi-de-pontat";

const ZI_ISO = /^\d{4}-\d{2}-\d{2}$/u;

/** Doar câmpul care contează dintr-un rând de pontaj deja citit. */
export interface ZiScrisa {
  readonly data: string;
}

/**
 * Zilele lipsă, în ordine cronologică.
 *
 * ZIUA CURENTĂ NU INTRĂ, oricât ar fi de nescrisă. Cardul „Astăzi" o cere deja,
 * cu butoanele lui de pontare; numărată și aici, ar apărea ca restanță un
 * lucru pe care omul îl are încă înainte. „Nepontat" e o afirmație despre
 * trecut.
 *
 * `regim === null` întoarce lista goală, din același motiv ca `meritaPontata`:
 * firmei nu i s-a scris încă rândul de setări, deci nu știm ce zile lucrează.
 * Tăcerea e greșeala ieftină.
 */
export function zileNepontate(
  an: number,
  luna: number,
  azi: string,
  scrise: readonly ZiScrisa[],
  regim: RegimZile | null,
): readonly string[] {
  if (regim === null || !ZI_ISO.test(azi)) return [];

  // `Date.UTC(an, luna, 0)` e ultima zi a lunii `luna` (lunile sunt 0-indexate,
  // deci `luna` e deja luna următoare, iar ziua 0 dă ultima zi a celei dinainte).
  const ultima = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  if (Number.isNaN(ultima)) return [];

  const deja = new Set(scrise.map((z) => z.data));
  const lipsa: string[] = [];

  for (let zi = 1; zi <= ultima; zi += 1) {
    const data = `${String(an).padStart(4, "0")}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
    // Comparația pe șir e sigură: ISO `YYYY-MM-DD` se ordonează lexicografic la
    // fel ca în calendar. Se oprește la ziua curentă, nu la sfârșitul lunii.
    if (data >= azi) break;
    if (deja.has(data)) continue;
    if (!meritaPontata(data, regim)) continue;
    lipsa.push(data);
  }

  return lipsa;
}
