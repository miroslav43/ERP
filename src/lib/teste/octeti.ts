// src/lib/teste/octeti.ts
//
// Capete de fișier pentru testele acțiunilor de încărcare. Folosit DOAR din
// `*.test.ts`.
//
// Din 12 oct 2026, fiecare salvare de fișier (dosar, concediu, dovadă de
// integrare, mentenanță, siglă, cele două avataruri, materiale de curs)
// citește primii octeți ai obiectului urcat — `createSignedUrl` sub sesiunea
// apelantului, apoi un `fetch` cu `Range` — și îi compară cu tipul măsurat
// (`src/lib/storage/primii-octeti.ts` + `semnatura.ts`). Testele programează
// deci semnarea pe clientul fals și pun aici un `fetch` care întoarce capul.
//
// `vi.stubGlobal` persistă între teste: fișierul care îl folosește scrie
// `afterEach(() => vi.unstubAllGlobals())`.

import { vi } from "vitest";

/** `%PDF-1.4` */
export const OCTETI_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
/** Semnătura PNG completă, 8 octeți. */
export const OCTETI_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** JFIF: `FF D8 FF E0`. */
export const OCTETI_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
/** Cazul HR-003 / ANG-014 literal: un fișier plin de zerouri. */
export const OCTETI_ZEROURI = new Uint8Array(1024);

/**
 * `fetch` întoarce capul obiectului urcat (sau 404 când `ok` e `false`).
 * Întoarce spionul, ca testul să poată verifica adresa și antetul `Range`.
 */
export function octetiUrcati(octeti: Uint8Array, ok = true): ReturnType<typeof vi.fn> {
  const spion = vi.fn(async () =>
    ok ? new Response(new Uint8Array(octeti)) : new Response(null, { status: 404 }),
  );
  vi.stubGlobal("fetch", spion);
  return spion;
}
