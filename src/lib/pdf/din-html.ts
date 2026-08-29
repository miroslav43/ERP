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
// Șabloanele le scriem noi, în migrări, iar `randeaza()` evadează fiecare
// valoare interpolată (`generator.ts:42`) — deci marcajul care poate ajunge
// aici e exact cel din `continut_html`, nu ceva venit de la un utilizator. Un
// parser complet ar fi o dependență nouă și o suprafață de atac pentru zero
// câștig.
//
// O firmă care își scrie propriul șablon poate folosi etichete din afara
// subsetului: acelea se degradează la text simplu, nu rup randarea.
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
import { Cursor, lista, paragraf, titluSectiune } from "./flux";

/** Blocurile pe care le produc șabloanele proiectului. */
const BLOC = /<(h1|h2|p|ul|ol)>([\s\S]*?)<\/\1>/giu;
const ELEMENT_LISTA = /<li>([\s\S]*?)<\/li>/giu;

/**
 * Entitățile pe care le produce `escapeHtml` din `layout.ts`, plus `&nbsp;`.
 *
 * Fără decodare, un nume ca „Ionescu & Fiii" s-ar tipări „Ionescu &amp; Fiii" —
 * evadarea e corectă pentru HTML și greșită pentru hârtie.
 */
function decodeaza(text: string): string {
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
      .trim()
  );
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
      const elemente: string[] = [];
      let element: RegExpExecArray | null;
      ELEMENT_LISTA.lastIndex = 0;
      while ((element = ELEMENT_LISTA.exec(interior)) !== null) {
        const text = decodeaza(element[1] ?? "");
        if (text !== "") elemente.push(text);
      }
      lista(cursor, elemente, { numerotata: eticheta === "ol" });
      cursor.coboara(4);
      continue;
    }
    const text = decodeaza(interior);
    if (text !== "") paragraf(cursor, text, { spatiuDupa: 6 });
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
    if (brut !== "") paragraf(cursor, brut, { spatiuDupa: 6 });
  }

  numeroteazaPaginile(
    context,
    `Cod de verificare: ${parametri.codVerificare} · amprentă ${parametri.amprenta}`,
  );
  return context.doc.save();
}

export { MARGINE };
