// src/domain/calendar/grila-lunara.ts
/**
 * Aritmetica unei grile lunare de calendar: unde începe luna în săptămână, câte
 * zile are, cum se împarte în rânduri de câte șapte.
 *
 * ── DE CE ÎN `domain`, NU LÂNGĂ COMPONENTĂ ────────────────────────────────
 * Partea predispusă la greșeli nu e marcajul, ci calculul: ziua 1 a lunii
 * convertită într-un `Date` LOCAL alunecă peste graniță în funcție de fus (în
 * România, o lună care începe la miezul nopții se poate citi ca ultima zi a
 * lunii precedente), iar februarie bisect se rupe tăcut o dată la patru ani. Un
 * calendar greșit nu aruncă nicio eroare — arată doar zilele în coloana greșită.
 *
 * Aici totul e în UTC și fără I/O, deci intră în proiectul `unit` din
 * `vitest.config.mts` și se verifică la fiecare `pnpm test`. O componentă de
 * pagină nu e ridicată de niciun proiect de test din depozit.
 *
 * `(app)/concedii/calendar/grila-calendar.tsx` are azi propriile copii ale
 * acelorași trei funcții, netestate. Nu le-am atins — modulul lor e al altei
 * sesiuni — dar ele sunt primul candidat la înlocuire cu ce e aici.
 */

/** ISO-dow al primei zile a lunii: luni = 1 … duminică = 7. */
export function isoDowPrimaZi(an: number, luna: number): number {
  const dow = new Date(Date.UTC(an, luna - 1, 1)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Câte zile are luna. Ziua 0 a lunii următoare = ultima zi a celei cerute. */
export function numarZileLuna(an: number, luna: number): number {
  return new Date(Date.UTC(an, luna, 0)).getUTCDate();
}

/** Ziua ca șir ISO, compus din cifre — niciodată prin `Date.toISOString()`. */
export function ziIso(an: number, luna: number, zi: number): string {
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

/**
 * Săptămânile lunii, de luni până duminică, cu `null` pentru căsuțele de
 * umplutură din afara lunii. Fiecare rând are exact șapte elemente.
 */
export function construiesteSaptamani(an: number, luna: number): readonly (number | null)[][] {
  const zilePad = isoDowPrimaZi(an, luna) - 1;
  const totalZile = numarZileLuna(an, luna);
  const celule: (number | null)[] = [
    ...Array.from({ length: zilePad }, () => null),
    ...Array.from({ length: totalZile }, (_, index) => index + 1),
  ];
  while (celule.length % 7 !== 0) celule.push(null);

  const saptamani: (number | null)[][] = [];
  for (let index = 0; index < celule.length; index += 7) {
    saptamani.push(celule.slice(index, index + 7));
  }
  return saptamani;
}

/**
 * Ziua ISO deplasată cu `zile` zile. `"2026-08-31"` + 1 → `"2026-09-01"`.
 *
 * Aritmetica navigării cu săgeți din calendar. E aici, nu în componentă,
 * fiindcă `new Date("2026-08-31")` interpretat LOCAL și readus cu
 * `toISOString()` pierde sau câștigă o zi în funcție de fus — iar rezultatul nu
 * e o eroare, ci un cursor care sare peste o zi la fiecare apăsare.
 *
 * `Date.UTC` cu ziua în afara intervalului normalizează singur: ziua 32 a lui
 * august devine 1 septembrie, ziua 0 a lui ianuarie devine 31 decembrie anul
 * precedent. Nu e nevoie de niciun caz special pentru capetele de lună sau de an.
 */
export function adaugaZileIso(zi: string, zile: number): string {
  const [an, luna, ziLunii] = zi.split("-").map(Number);
  if (an === undefined || luna === undefined || ziLunii === undefined) {
    throw new TypeError(`Zi calendaristică invalidă: ${JSON.stringify(zi)}`);
  }
  const mutata = new Date(Date.UTC(an, luna - 1, ziLunii + zile));
  return ziIso(mutata.getUTCFullYear(), mutata.getUTCMonth() + 1, mutata.getUTCDate());
}

/**
 * Luna deplasată cu `luni` luni, cu anul rostogolit corect.
 *
 * Săgeata de an nu e un caz aparte: e o deplasare de ±12.
 *
 * Scris prin `Date.UTC` și nu prin `%`, fiindcă restul negativ al lui
 * JavaScript e capcana: `(1 - 1 - 1) % 12` dă `-1`, nu `11`, iar ianuarie
 * înapoi ar da luna „zero”.
 */
export function deplaseazaLuna(
  an: number,
  luna: number,
  luni: number,
): { readonly an: number; readonly luna: number } {
  const mutata = new Date(Date.UTC(an, luna - 1 + luni, 1));
  return { an: mutata.getUTCFullYear(), luna: mutata.getUTCMonth() + 1 };
}
