// src/lib/documents/foto-bon-pregatire.ts

/**
 * Poza bonului de combustibil se aduce în browser la JPEG ≤ 2048 px, ÎNAINTE de
 * urcare (F12a D7). Doar în browser: folosește `<img>` și `<canvas>`.
 *
 * ── DE CE ───────────────────────────────────────────────────────────────────
 * · Citirea automată merge doar pe JPEG: OpenRouter nu ia HEIC, iar serverul
 *   refuză orice nu începe cu `FF D8 FF`.
 * · Canvasul NU păstrează EXIF-ul, deci coordonatele GPS ale șoferului nu
 *   ajung nici în Storage, nici la terț. Serverul taie oricum APP1 înainte de
 *   trimitere (`faraMetadateJpeg`), ca plasă.
 * · 2048 px păstrează lizibile bonurile lungi și înguste; fișierul iese de
 *   câteva sute de KB, nu de 4–6 MB.
 *
 * `<img>` aplică orientarea EXIF, deci poza ridicată pe verticală nu iese
 * culcată. HEIC: Safari ≥ 17 îl decodează; Chrome, Firefox și Edge nu, iar
 * omul primește mesajul cu pașii (F12a M5, fără bibliotecă de decodare).
 *
 * Funcțiile pure (`esteHeic`, `numeJpeg`) se testează; desenarea nu — happy-dom
 * n-are canvas real.
 */

import { deseneaza, dimensiuniTinta, incarcaImaginea } from "./sigla-redimensionare";

export const LATURA_BON = 2048;
export const CALITATE_BON = 0.85;

export const MESAJ_HEIC =
  "Browserul nu poate deschide fotografii HEIC. Pe iPhone, alegeți poza din formular (se convertește singură) sau setați Cameră → Formate → Cel mai compatibil; pe calculator, convertiți-o în JPEG.";
export const MESAJ_NECITIBILA =
  "Fotografia nu a putut fi deschisă. Folosiți o poză JPG sau PNG a bonului.";

export class FotoBonNecitibila extends Error {
  constructor(mesaj: string = MESAJ_NECITIBILA) {
    super(mesaj);
    this.name = "FotoBonNecitibila";
  }
}

/** HEIC/HEIF după tip SAU după extensie: un fișier copiat pe PC vine des cu `type` gol. */
export function esteHeic(fisier: Readonly<{ name: string; type: string }>): boolean {
  const tip = fisier.type.toLowerCase();
  return (
    tip === "image/heic" ||
    tip === "image/heif" ||
    tip === "image/heic-sequence" ||
    tip === "image/heif-sequence" ||
    /\.(heic|heif)$/i.test(fisier.name)
  );
}

/** `IMG_0042.HEIC` → `IMG_0042.jpg`; un nume gol → `bon.jpg`. */
export function numeJpeg(nume: string): string {
  const baza = nume.replace(/\.[^./\\]+$/, "").trim();
  return `${baza === "" ? "bon" : baza}.jpg`;
}

/** Imaginile se convertesc; un PDF (bon scanat) nu e treaba canvasului. */
export function seConvertesteInJpeg(fisier: Readonly<{ type: string; name: string }>): boolean {
  return fisier.type.startsWith("image/") || esteHeic(fisier);
}

/**
 * Întoarce JPEG-ul de urcat. Aruncă `FotoBonNecitibila` dacă browserul nu
 * poate decoda imaginea, cu mesajul despre HEIC când e cazul.
 */
export async function pregatesteFotoBon(fisier: File): Promise<File> {
  let imagine: HTMLImageElement;
  try {
    imagine = await incarcaImaginea(fisier);
  } catch {
    throw new FotoBonNecitibila(esteHeic(fisier) ? MESAJ_HEIC : MESAJ_NECITIBILA);
  }
  if (imagine.naturalWidth <= 0 || imagine.naturalHeight <= 0) {
    throw new FotoBonNecitibila(esteHeic(fisier) ? MESAJ_HEIC : MESAJ_NECITIBILA);
  }
  const tinta = dimensiuniTinta(
    { latime: imagine.naturalWidth, inaltime: imagine.naturalHeight },
    LATURA_BON,
  );
  let blob: Blob;
  try {
    blob = await deseneaza(imagine, tinta, "image/jpeg", CALITATE_BON);
  } catch {
    throw new FotoBonNecitibila();
  }
  return new File([blob], numeJpeg(fisier.name), { type: "image/jpeg" });
}
