// src/lib/storage/semnatura.ts
//
// Semnăturile de început de fișier („magic bytes”), pentru toate tipurile pe
// care le primește vreun ecran de încărcare din aplicație.
//
// ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
// MIME-ul trimis de formular e cel declarat de browser, iar `content-type`-ul
// pe care îl „măsoară” Storage (`masoaraObiectul`) e TOT cel declarat — antetul
// cu care s-a urcat fișierul. Un fișier de 1024 de zerouri numit `x.pdf` trece
// de amândouă (HR-003 în dosar, ANG-014 la concediu). Singurul lucru care spune
// ce E fișierul sunt primii lui octeți: pe server se citesc din obiectul deja
// urcat (`primii-octeti.ts`), pe client din capul `File`-ului ales, înainte să
// urce 20 MB degeaba.
//
// ── MODUL E PUR ────────────────────────────────────────────────────────────
// Fără `import "server-only"`: îl importă și componentele client
// (`formular-document.tsx`, `incarcare-document.tsx`) pentru pre-controlul de
// curtoazie. Cititorul de octeți din Storage stă separat, în
// `primii-octeti.ts`, care E `server-only` — capcana 53: o componentă client
// care l-ar importa pe acela pică doar la build și la `pnpm check:server`.
//
// ── LIMITE ASUMATE ─────────────────────────────────────────────────────────
// Word și Excel (OOXML) sunt arhive ZIP: se verifică doar antetul local
// `PK\x03\x04`, deci orice ZIP redenumit `.docx` trece. Distingerea reală cere
// citirea lui `[Content_Types].xml` — în afara lucrării de aici. HEIC/HEIF și
// MP4 împart containerul ISO-BMFF (`ftyp` la offset 4); nu se citește brandul,
// deci un MP4 declarat HEIC trece. Ambele rămân mult mai bune decât nimic: HTML,
// executabile și zerouri cad toate.

/**
 * Câți octeți din capul fișierului trebuie trimiși la verificare. WEBP e cel
 * mai lung: „RIFF” la 0 și „WEBP” la 8, adică 12; 16 lasă loc.
 */
export const OCTETI_SEMNATURA = 16;

/** Același mesaj pe server și pe client, în toate cele șapte ecrane. */
export const MESAJ_CONTINUT_NEPOTRIVIT = "Fișierul încărcat nu are conținutul tipului declarat.";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Primii octeți ai fișierului se potrivesc cu tipul declarat?
 *
 * Un tip necunoscut întoarce `false`: lista de aici e lista a ceea ce ȘTIM
 * verifica, nu a ceea ce acceptăm — acceptarea o decid `MIME_ACCEPTATE` & co.,
 * pe fiecare ecran. Un tip acceptat acolo și absent aici ar fi refuzat la
 * salvare, deci cele două liste se mișcă împreună.
 */
export function potrivesteSemnatura(mime: string, primiiOcteti: Uint8Array): boolean {
  const are = (offset: number, ...octeti: number[]): boolean =>
    octeti.every((o, i) => primiiOcteti[offset + i] === o);

  switch (mime) {
    case "application/pdf":
      // "%PDF"
      return are(0, 0x25, 0x50, 0x44, 0x46);
    case "image/jpeg":
      // Marcajul SOI, urmat de orice alt marcaj (FF E0 JFIF, FF E1 Exif...).
      return are(0, 0xff, 0xd8, 0xff);
    case "image/png":
      return are(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      // "RIFF" + 4 octeți de mărime + "WEBP". Fără al doilea, e un WAV sau un AVI.
      return are(0, 0x52, 0x49, 0x46, 0x46) && are(8, 0x57, 0x45, 0x42, 0x50);
    case "image/heic":
    case "image/heif":
    case "video/mp4":
      // "ftyp" la offset 4, în caseta de tip a containerului ISO-BMFF.
      return are(4, 0x66, 0x74, 0x79, 0x70);
    case "video/webm":
      // Antetul EBML.
      return are(0, 0x1a, 0x45, 0xdf, 0xa3);
    case "text/vtt": {
      // "WEBVTT", eventual după marca de ordine a octeților UTF-8.
      const start = are(0, 0xef, 0xbb, 0xbf) ? 3 : 0;
      return are(start, 0x57, 0x45, 0x42, 0x56, 0x54, 0x54);
    }
    case DOCX:
    case XLSX:
      // Antetul ZIP local, "PK\x03\x04". Vezi „Limite asumate” din antet.
      return are(0, 0x50, 0x4b, 0x03, 0x04);
    default:
      return false;
  }
}
