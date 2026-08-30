// src/lib/pdf/din-html.ts
// Randează în PDF un document deja EMIS, pornind de la HTML-ul lui stocat.
//
// ── DE CE NU SE COMPUNE PDF-UL DIRECT DIN DATE ───────────────────────────────
// Documentul de referință e rândul din `hr_issued_documents`: el poartă numărul
// alocat pe serie, amprenta SHA-256 peste conținut și codul de verificare
// publică. Un PDF compus separat, din aceleași date, ar fi un AL DOILEA izvor de
// adevăr — două documente cu același număr, a căror potrivire nimeni n-o
// garantează, iar amprenta n-ar mai dovedi nimic.
//
// Aici PDF-ul e o RANDARE a documentului emis. Consecința bună: merge pentru
// tot ce trece prin `genereazaDocument`, inclusiv adeverințele, fără nicio linie
// în plus.
//
// ── DE CE UN SUBSET DE ETICHETE, ȘI NU UN PARSER DE HTML ────────────────────
// ATENȚIE: motivul de aici s-a SCHIMBAT. Până la editorul de șabloane, textul
// de mai jos spunea „șabloanele le scriem noi, în migrări, deci marcajul nu
// vine de la un utilizator". De când o firmă își editează singură șablonul
// (`/angajati/sabloane-documente`), premisa aia e falsă, iar un comentariu care
// justifică o decizie de securitate cu o premisă moartă e mai rău decât niciunul.
//
// Motivul real, azi: marcajul e curățat la SALVARE de
// `src/lib/documents/curata-html.ts`, care reconstruiește HTML-ul dintr-o
// mulțime de șapte etichete, fără niciun atribut. Subsetul de mai jos e capătul
// celălalt al aceluiași contract — ce poate produce editorul, atât randează
// PDF-ul. Cele trei fișiere se schimbă împreună.
//
// Un șablon mai vechi, sau lipit din afară, poate conține totuși etichete din
// afara subsetului: acelea se degradează la text simplu, nu rup randarea.
import "server-only";

import {
  INALTIME_A4,
  LATIME_A4,
  MARGINE,
  deseneazaAntet,
  numeroteazaPaginile,
  pornesteDocument,
  type AntetOrganizatie,
} from "./document";
import { Cursor, listaBogata, paragrafBogat, titluSectiune, type Segment } from "./flux";

/** Blocurile pe care le produc șabloanele proiectului. */
const BLOC = /<(h1|h2|p|ul|ol)>([\s\S]*?)<\/\1>/giu;
const ELEMENT_LISTA = /<li>([\s\S]*?)<\/li>/giu;
const ALDIN = /<strong>([\s\S]*?)<\/strong>/giu;

/**
 * Entitățile pe care le produce `escapeHtml` din `layout.ts`, plus `&nbsp;`.
 *
 * Fără decodare, un nume ca „Ionescu & Fiii" s-ar tipări „Ionescu &amp; Fiii" —
 * evadarea e corectă pentru HTML și greșită pentru hârtie.
 */
function decodeazaBrut(text: string): string {
  return (
    text
      .replace(/<br\s*\/?>/giu, " ")
      .replace(/<[^>]+>/gu, "")
      .replace(/&nbsp;/gu, " ")
      .replace(/&lt;/gu, "<")
      .replace(/&gt;/gu, ">")
      .replace(/&quot;/gu, '"')
      .replace(/&#0?39;/gu, "'")
      .replace(/&#x27;/giu, "'")
      // `&amp;` LA FINAL: altfel „&amp;lt;" ar deveni „<" în doi pași.
      .replace(/&amp;/gu, "&")
      .replace(/\s+/gu, " ")
  );
}

function decodeaza(text: string): string {
  return decodeazaBrut(text).trim();
}

/**
 * Taie interiorul unui bloc în bucăți normale și aldine, pe `<strong>`.
 *
 * Bucățile NU se retează la capete: „text <strong>aldin</strong> încă" are
 * spațiile exact la granițe, iar un `trim()` per bucată le-ar șterge și cele
 * trei cuvinte s-ar lipi într-unul singur. Spațiile de la capetele
 * paragrafului le ignoră oricum `inCuvinte`, care rupe pe `\S+`.
 */
export function inSegmente(interior: string): readonly Segment[] {
  const segmente: Segment[] = [];
  const adauga = (brut: string, aldin: boolean): void => {
    const text = decodeazaBrut(brut);
    if (text !== "") segmente.push({ text, aldin });
  };

  let pozitie = 0;
  let potrivire: RegExpExecArray | null;
  ALDIN.lastIndex = 0;
  while ((potrivire = ALDIN.exec(interior)) !== null) {
    adauga(interior.slice(pozitie, potrivire.index), false);
    adauga(potrivire[1] ?? "", true);
    pozitie = ALDIN.lastIndex;
  }
  adauga(interior.slice(pozitie), false);
  return segmente;
}

/** `true` dacă segmentele conțin măcar un caracter care nu e spațiu. */
function areText(segmente: readonly Segment[]): boolean {
  return segmente.some((s) => s.text.trim() !== "");
}

export type ParametriPdfDocument = Readonly<{
  html: string;
  /** Numărul afișat, ex. „CIM 2026/000042". */
  numarAfisat: string;
  titlu: string;
  organizatie: AntetOrganizatie;
  /** Codul public de verificare, tipărit în subsol. */
  codVerificare: string;
  /** Primele caractere din amprenta SHA-256 — dovada că textul n-a fost atins. */
  amprenta: string;
}>;

export async function pdfDinDocument(parametri: ParametriPdfDocument): Promise<Uint8Array> {
  const context = await pornesteDocument(parametri.titlu, parametri.organizatie.denumire);
  const cursor = new Cursor(context, LATIME_A4, INALTIME_A4);

  deseneazaAntet(cursor, parametri.organizatie, parametri.titlu, `Nr. ${parametri.numarAfisat}`);

  let potrivire: RegExpExecArray | null;
  BLOC.lastIndex = 0;
  let aGasitCeva = false;

  while ((potrivire = BLOC.exec(parametri.html)) !== null) {
    const eticheta = (potrivire[1] ?? "").toLowerCase();
    const interior = potrivire[2] ?? "";
    aGasitCeva = true;

    if (eticheta === "h1") {
      // Titlul mare e deja în antet; repetat aici, ar apărea de două ori pe
      // prima pagină. Se sare deliberat.
      continue;
    }
    if (eticheta === "h2") {
      titluSectiune(cursor, decodeaza(interior));
      continue;
    }
    if (eticheta === "ul" || eticheta === "ol") {
      const elemente: (readonly Segment[])[] = [];
      let element: RegExpExecArray | null;
      ELEMENT_LISTA.lastIndex = 0;
      while ((element = ELEMENT_LISTA.exec(interior)) !== null) {
        const segmente = inSegmente(element[1] ?? "");
        if (areText(segmente)) elemente.push(segmente);
      }
      listaBogata(cursor, elemente, { numerotata: eticheta === "ol" });
      cursor.coboara(4);
      continue;
    }
    const segmente = inSegmente(interior);
    if (areText(segmente)) paragrafBogat(cursor, segmente, { spatiuDupa: 6 });
  }

  /*
   * Șablon fără niciun bloc cunoscut.
   *
   * Se întâmplă dacă o firmă și-a scris conținutul fără `<p>`. Un PDF cu antet
   * și pagină albă ar arăta ca un defect; textul brut, degradat, e cel puțin
   * documentul.
   */
  if (!aGasitCeva) {
    const brut = decodeaza(parametri.html);
    if (brut !== "") paragrafBogat(cursor, [{ text: brut, aldin: false }], { spatiuDupa: 6 });
  }

  numeroteazaPaginile(
    context,
    `Cod de verificare: ${parametri.codVerificare} · amprentă ${parametri.amprenta}`,
  );
  return context.doc.save();
}

export { MARGINE };
