import "server-only";

import { numeFisierSigur, type DocumentTabelar, type Format } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { randeazaPdf } from "./pdf";
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
 * Fișierul ca răspuns de descărcare. `new Uint8Array(...)` copiază într-un
 * `ArrayBuffer` propriu: tipurile din `lib.dom` nu acceptă ca `BodyInit` un
 * `Uint8Array<ArrayBufferLike>`, iar `Buffer`-ul din `docx` e exact asta.
 */
export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  const continut = await RANDARI[format](d);
  return new Response(new Uint8Array(continut), {
    headers: {
      "content-type": TIP[format],
      "content-disposition": `attachment; filename="${numeFisierSigur(d.numeFisier)}.${format}"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
