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
 * Antetul de cache al oricărei descărcări de unealtă.
 *
 * A fost `public, max-age=3600` până la 8 oct 2026, pe fișiere care poartă
 * numele angajaților, firma și salariul. `public` dă voie oricărui cache
 * intermediar să păstreze o oră documentul unui alt om. Acum e aceeași
 * politică pe care Next o pune deja paginilor uneltelor.
 */
export const ANTET_CACHE_DESCARCARE = "private, no-store";

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
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}
