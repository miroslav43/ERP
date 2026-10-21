// src/lib/import/csv.ts
// Citirea unui CSV în memorie, cu aceleași limite și aceeași formă de ieșire ca
// `citesteExcelDinBuffer` (`FoaieCitita`), ca un import să nu știe din ce fel de
// fișier vin rândurile. Folosit de importul extraselor de card (F12b).
//
// ── CODIFICAREA ─────────────────────────────────────────────────────────────
// BOM UTF-8 → UTF-8; BOM UTF-16 (`FF FE` / `FE FF`) → UTF-16 (exportul „Text
// Unicode” din Excel e UTF-16LE cu tab). Fără BOM: UTF-8 strict, iar la eroare
// Windows-1250 — un CSV „ANSI” românesc NU e UTF-8 valid (`fatal: true` aruncă
// pe el, verificat empiric), deci detecția e sigură pentru diacritice.
// Windows-1250 n-are ș/ț cu virgulă: ies cu sedilă, iar normalizarea textelor
// din extras le corectează (`src/domain/fleet/carduri/text.ts`).

import { LIMITA_RANDURI, type FoaieCitita, type RandBrut } from "./excel";

export type Codificare = "auto" | "utf-8" | "windows-1250";
export type Delimitator = ";" | "," | "\t";

export function decodeazaText(octeti: Uint8Array, codificare: Codificare = "auto"): string {
  if (octeti.length >= 3 && octeti[0] === 0xef && octeti[1] === 0xbb && octeti[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(octeti.subarray(3));
  }
  if (octeti.length >= 2 && octeti[0] === 0xff && octeti[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(octeti.subarray(2));
  }
  if (octeti.length >= 2 && octeti[0] === 0xfe && octeti[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(octeti.subarray(2));
  }
  if (codificare === "windows-1250") return new TextDecoder("windows-1250").decode(octeti);
  if (codificare === "utf-8") return new TextDecoder("utf-8").decode(octeti);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octeti);
  } catch {
    return new TextDecoder("windows-1250").decode(octeti);
  }
}

/** Câte apariții are fiecare candidat pe o linie, în afara ghilimelelor. */
function numaraInAfaraGhilimelelor(linie: string, caracter: string): number {
  let n = 0;
  let inGhilimele = false;
  for (const c of linie) {
    if (c === '"') inGhilimele = !inGhilimele;
    else if (c === caracter && !inGhilimele) n += 1;
  }
  return n;
}

/**
 * Delimitatorul dintre `;`, `,` și tab: cel care apare de același număr de ori
 * (nenul) pe cele mai multe dintre primele 10 linii nevide. Excel cu setări
 * regionale românești scrie `;` (virgula e zecimală), deci la egalitate `;`
 * câștigă înaintea virgulei.
 */
export function detecteazaDelimitator(text: string): Delimitator {
  const linii = text
    .split(/\r?\n/u)
    .filter((l) => l.trim().length > 0)
    .slice(0, 10);
  let celMai: Delimitator = ";";
  let scorMaxim = -1;
  for (const candidat of [";", "\t", ","] as const) {
    const numere = linii.map((l) => numaraInAfaraGhilimelelor(l, candidat));
    const frecvente = new Map<number, number>();
    for (const n of numere) if (n > 0) frecvente.set(n, (frecvente.get(n) ?? 0) + 1);
    const scor = Math.max(0, ...frecvente.values());
    if (scor > scorMaxim) {
      scorMaxim = scor;
      celMai = candidat;
    }
  }
  return celMai;
}

/** RFC 4180: ghilimele, `""` în ghilimele, linii noi în câmp, CRLF sau LF. */
function inregistrari(text: string, delimitator: Delimitator): string[][] {
  const iesire: string[][] = [];
  let rand: string[] = [];
  let camp = "";
  let inGhilimele = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    if (inGhilimele) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          camp += '"';
          i += 1;
        } else {
          inGhilimele = false;
        }
      } else {
        camp += c;
      }
      continue;
    }
    if (c === '"') {
      inGhilimele = true;
    } else if (c === delimitator) {
      rand.push(camp);
      camp = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text.charAt(i + 1) === "\n") i += 1;
      rand.push(camp);
      iesire.push(rand);
      rand = [];
      camp = "";
    } else {
      camp += c;
    }
  }
  if (camp.length > 0 || rand.length > 0) {
    rand.push(camp);
    iesire.push(rand);
  }
  return iesire;
}

export type OptiuniCsv = Readonly<{
  delimitator: Delimitator;
  /**
   * Rândul de antet, numărat de la 1 ca în Excel (logo, nume de firmă
   * deasupra): același număr înseamnă același rând și într-un `.xlsx`.
   */
  randAntet?: number;
}>;

export type RezultatCsv =
  | { readonly ok: true; readonly foaie: FoaieCitita }
  | { readonly ok: false; readonly mesaj: string };

/**
 * Rândurile de date ale unui CSV, ca `FoaieCitita`. Rândurile goale se sar,
 * antetul duplicat se sufixează ca în `excel.ts`. Peste `LIMITA_RANDURI` de
 * rânduri de date, `trunchiat: true` — iar apelantul REFUZĂ, nu taie.
 */
export function citesteCsv(text: string, optiuni: OptiuniCsv): RezultatCsv {
  const randAntet = optiuni.randAntet ?? 1;
  const toate = inregistrari(text, optiuni.delimitator).map((celule, i) => ({
    celule: celule.map((c) => c.trim()),
    linie: i + 1,
  }));
  const areContinut = (r: { readonly celule: readonly string[] }) =>
    r.celule.some((c) => c.length > 0);

  const antetBrut = toate[randAntet - 1];
  if (antetBrut === undefined || !areContinut(antetBrut)) {
    return { ok: false, mesaj: "Fișierul nu are un antet pe rândul indicat." };
  }
  const antet = antetBrut.celule.map((t, i) => (t.length > 0 ? t : `Coloana ${String(i + 1)}`));
  const antetUnic = antet.map((nume, i) =>
    antet.indexOf(nume) === i ? nume : `${nume} (${String(i + 1)})`,
  );

  const date = toate.slice(randAntet).filter(areContinut);
  if (date.length === 0) {
    return { ok: false, mesaj: "Fișierul nu conține niciun rând de date sub linia de antet." };
  }
  const randuri: RandBrut[] = date.slice(0, LIMITA_RANDURI).map((r) => {
    const celule = new Map<string, string>();
    antetUnic.forEach((cheie, c) => celule.set(cheie, r.celule[c] ?? ""));
    return { rand: r.linie, celule };
  });
  return {
    ok: true,
    foaie: {
      numeFoaie: "CSV",
      antet: antetUnic,
      randuri,
      trunchiat: date.length > LIMITA_RANDURI,
    },
  };
}
