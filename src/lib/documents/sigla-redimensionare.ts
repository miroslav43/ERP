// src/lib/documents/sigla-redimensionare.ts
import { SIGLA_OCTETI_MAXIM } from "@/schemas/document-template";

/**
 * Sigla se aduce în browser la mărimea la care se tipărește, ÎNAINTE de urcare.
 *
 * ── DE CE ───────────────────────────────────────────────────────────────────
 * Plafonul de 512 KB (`SIGLA_OCTETI_MAXIM`) există fiindcă sigla se încorporează
 * în fiecare document emis. Dar pentru om era o barieră fără sens: sigla vine de
 * obicei exportată la 3000–4000 px din fișierul grafic, adică de zece ori mai
 * mare decât poate tipări hârtia, și era respinsă. Pe pagină ea ocupă cel mult
 * 4 × 1,6 cm (`generator.ts`, `.firma img.sigla`); la 300 dpi asta înseamnă
 * ~470 × 190 px. `LATURA_MAXIMA` lasă loc peste, ca să nu se vadă pixeli nici la
 * imprimantă bună.
 *
 * ── CE SE REENCODEAZĂ ȘI CE NU ──────────────────────────────────────────────
 * · PNG deja mic și în plafon → se urcă NESCHIMBAT. Encoderul PNG al canvasului
 *   comprimă mai slab decât un export din editor; reencodarea l-ar face mai mare.
 * · JPEG → se reencodează MEREU, oricât de mic. `pdf-lib` aruncă pe JPEG
 *   progresiv, iar `incorporeazaSigla` (`pdf/document.ts`) înghite eroarea ca să
 *   nu pice contractul — deci sigla dispărea din PDF fără nicio urmă. Canvasul
 *   scoate JPEG de bază.
 * · WebP, SVG, GIF → nu le poate încorpora `pdf-lib`, dar browserul le poate
 *   desena. Se convertesc în PNG, care păstrează transparența.
 *
 * Dacă PNG-ul rezultat tot trece de plafon (o fotografie folosită drept siglă),
 * se trece pe JPEG, pe fundal alb: JPEG n-are transparență, iar fundalul negru
 * implicit al canvasului ar ieși pe hârtie ca un dreptunghi negru.
 *
 * Serverul rămâne autoritatea (`salveazaSigla` măsoară obiectul real). Aici e
 * doar politețe: omul nu mai are de deschis un editor de imagini.
 */

/** Latura cea mai lungă, în pixeli, după redimensionare. */
export const LATURA_MAXIMA = 600;

/** Ce poate primi câmpul: tot ce se convertește sigur în PNG sau JPEG. */
export const SIGLA_MIME_INTRARE = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
] as const;

/** Calitatea JPEG la reencodare: sub 0,9 apar artefacte pe marginile literelor. */
const CALITATE_JPEG = 0.92;

export type Dimensiuni = Readonly<{ latime: number; inaltime: number }>;

/**
 * Dimensiunile țintă, cu proporția păstrată. O imagine raster deja în plafon
 * rămâne la mărimea ei: mărirea n-ar adăuga detaliu, doar octeți. Un SVG se
 * desenează ÎNTOTDEAUNA la plafon (`vectorial`): dimensiunile lui „naturale”
 * sunt cutia implicită a browserului — 300 × 150 când lipsesc `width`/`height`
 * — și ar ieși pe hârtie mai pixelat decât sursa.
 */
export function dimensiuniTinta(
  sursa: Dimensiuni,
  maxim: number = LATURA_MAXIMA,
  vectorial = false,
): Dimensiuni {
  const latura = Math.max(sursa.latime, sursa.inaltime);
  if (latura <= maxim && !vectorial) return sursa;
  const scara = maxim / latura;
  return {
    latime: Math.max(1, Math.round(sursa.latime * scara)),
    inaltime: Math.max(1, Math.round(sursa.inaltime * scara)),
  };
}

/**
 * Un PNG se urcă așa cum e doar când e deja la mărimea de tipar și în plafon.
 * Orice altceva trece prin canvas.
 */
export function seUrcaNeschimbat(mime: string, octeti: number, sursa: Dimensiuni): boolean {
  return (
    mime === "image/png" &&
    octeti <= SIGLA_OCTETI_MAXIM &&
    Math.max(sursa.latime, sursa.inaltime) <= LATURA_MAXIMA
  );
}

/** JPEG rămâne JPEG; tot restul devine PNG, ca să nu se piardă transparența. */
export function formatIesire(mime: string): "image/png" | "image/jpeg" {
  return mime === "image/jpeg" ? "image/jpeg" : "image/png";
}

/** `sigla.svg` → `sigla.png`. Numele contează doar pentru omul care se uită în depozit. */
export function numeCuExtensie(nume: string, mime: "image/png" | "image/jpeg"): string {
  const baza = nume.replace(/\.[^./\\]+$/, "") || "sigla";
  return `${baza}.${mime === "image/png" ? "png" : "jpg"}`;
}

/** Eroarea aruncată când browserul nu poate citi imaginea (fișier stricat, HEIC). */
export class SiglaNecitibila extends Error {
  constructor() {
    super("Imaginea nu a putut fi citită. Folosiți un fișier PNG sau JPEG.");
    this.name = "SiglaNecitibila";
  }
}

function incarcaImaginea(fisier: File): Promise<HTMLImageElement> {
  // `<img>`, nu `createImageBitmap`: acesta din urmă nu decodează SVG în
  // Chrome/Firefox, iar `<img>` aplică și orientarea EXIF a fotografiilor.
  return new Promise((rezolva, respinge) => {
    const url = URL.createObjectURL(fisier);
    const imagine = new Image();
    imagine.onload = () => {
      URL.revokeObjectURL(url);
      rezolva(imagine);
    };
    imagine.onerror = () => {
      URL.revokeObjectURL(url);
      respinge(new SiglaNecitibila());
    };
    imagine.src = url;
  });
}

function deseneaza(
  imagine: HTMLImageElement,
  tinta: Dimensiuni,
  mime: "image/png" | "image/jpeg",
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = tinta.latime;
  canvas.height = tinta.inaltime;
  const context = canvas.getContext("2d");
  if (context === null) return Promise.reject(new SiglaNecitibila());

  if (mime === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, tinta.latime, tinta.inaltime);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(imagine, 0, 0, tinta.latime, tinta.inaltime);

  return new Promise((rezolva, respinge) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) respinge(new SiglaNecitibila());
        else rezolva(blob);
      },
      mime,
      mime === "image/jpeg" ? CALITATE_JPEG : undefined,
    );
  });
}

/**
 * Întoarce fișierul de urcat: PNG sau JPEG, cu latura cea mai lungă de cel mult
 * `LATURA_MAXIMA` px. Aruncă `SiglaNecitibila` dacă browserul nu poate decoda
 * imaginea. Poate întoarce, rar, un fișier tot peste plafon — verificarea de
 * mărime rămâne la apelant.
 */
export async function pregatesteSiglaDeUrcat(fisier: File): Promise<File> {
  const imagine = await incarcaImaginea(fisier);
  // Un SVG fără `width`/`height` are dimensiunile naturale 0 în unele browsere.
  const sursa: Dimensiuni = {
    latime: imagine.naturalWidth > 0 ? imagine.naturalWidth : LATURA_MAXIMA,
    inaltime: imagine.naturalHeight > 0 ? imagine.naturalHeight : LATURA_MAXIMA,
  };

  if (seUrcaNeschimbat(fisier.type, fisier.size, sursa)) return fisier;

  const tinta = dimensiuniTinta(sursa, LATURA_MAXIMA, fisier.type === "image/svg+xml");
  let mime = formatIesire(fisier.type);
  let blob = await deseneaza(imagine, tinta, mime);
  if (blob.size > SIGLA_OCTETI_MAXIM && mime === "image/png") {
    mime = "image/jpeg";
    blob = await deseneaza(imagine, tinta, mime);
  }
  return new File([blob], numeCuExtensie(fisier.name, mime), { type: mime });
}
