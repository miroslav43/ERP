import "server-only";

import {
  curataDocument,
  numeFisierSigur,
  type DocumentTabelar,
  type Format,
} from "./document-tabelar";
import { randeazaDocx, randeazaDocxMultiplu } from "./docx";
import { randeazaPdf, randeazaPdfMultiplu } from "./pdf";
import { randeazaXlsx } from "./xlsx";

const TIP: Readonly<Record<Format, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const RANDARI: Readonly<Record<Format, (d: DocumentTabelar) => Promise<Uint8Array>>> = {
  pdf: randeazaPdf,
  docx: randeazaDocx,
  xlsx: randeazaXlsx,
};

/**
 * Antetul de cache al oricărei descărcări de unealtă.
 *
 * A fost `public, max-age=3600` până la 8 oct 2026, pe fișiere care poartă
 * numele angajaților, firma și salariul. `public` dă voie oricărui cache
 * intermediar să păstreze o oră documentul unui alt om. Acum e aceeași
 * politică pe care Next o pune deja paginilor uneltelor.
 */
export const ANTET_CACHE_DESCARCARE = "private, no-store";

/**
 * Octeții unui fișier ca răspuns de descărcare. `new Uint8Array(...)` copiază
 * într-un `ArrayBuffer` propriu: tipurile din `lib.dom` nu acceptă ca
 * `BodyInit` un `Uint8Array<ArrayBufferLike>`, iar `Buffer`-ul din `docx` e
 * exact asta.
 *
 * Exportată pentru rutele cu Excel propriu (foaia de pontaj, condica): ele își
 * construiesc registrul cu formule, dar antetele trebuie să fie aceleași —
 * inclusiv `private, no-store`, ca nicio rută să nu-și scrie singură antetul.
 */
export function raspunsBinar(continut: Uint8Array, format: Format, numeFisier: string): Response {
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(numeFisier)}.${format}"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}

export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  // Punctul unic de curățare pentru toate uneltele și toate formatele: vezi `curataText`.
  return raspunsBinar(await RANDARI[format](curataDocument(d)), format, d.numeFisier);
}

/** Mai multe documente (fișele individuale de pontaj) într-un singur PDF sau Word. */
export async function raspunsDocumente(
  documente: readonly DocumentTabelar[],
  format: "pdf" | "docx",
  numeFisier: string,
): Promise<Response> {
  // Aceeași curățare ca la un singur document: o fișă cu un nume lipit din Word
  // (U+000B) nu are voie să strice tot fișierul cu 60 de fișe.
  const curate = documente.map((d) => curataDocument(d));
  const continut =
    format === "pdf" ? await randeazaPdfMultiplu(curate) : await randeazaDocxMultiplu(curate);
  return raspunsBinar(continut, format, numeFisier);
}
