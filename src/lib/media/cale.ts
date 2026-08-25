// src/lib/media/cale.ts
/**
 * Contractul de cale pentru materialele de curs, singurul loc unde se
 * construiește: `{organization_id}/courses/{material_id}/v{versiune}-{uuid}-{slug}`.
 *
 * ── SEGMENTUL 2 E O RESURSĂ DE PERMISIUNE, NU UN CUVÂNT ───────────────────
 * `app.can_path` (0002_authz.sql) îl dă direct lui `app.has_permission`. Un
 * cuvânt care nu există în catalogul de resurse întoarce `none`, adică refuz
 * TĂCUT la fiecare încărcare. Exact asta a ținut moartă încărcarea documentelor
 * de personal — vezi migrarea 0073 și `src/lib/documents/cale.ts`. Aici
 * segmentul e `courses`, identic literă cu literă cu numele resursei și cu
 * numele feature-ului, iar `cale.test.ts` îl verifică împotriva lui
 * `PERMISSION_KEYS`.
 *
 * Politica de INSERT din 0075 fixează în plus `app.path_resource(name) =
 * 'courses'` în `WITH CHECK`: politicile de Storage sunt PERMISSIVE, deci fără
 * asta cineva ar putea încărca în bucket sub `{org}/employees/…` și ar moșteni
 * permisiunile de personal.
 */

import { slugFisier } from "@/lib/documents/cale";

/** Numele REAL al bucket-ului, cel creat în 0075_cursuri.sql. */
export const BUCKET_CURSURI = "org-courses";

/** Segmentul 2. Constantă, nu literal repetat: aici s-a rupt contractul o dată. */
export const RESURSA_CURSURI = "courses";

/**
 * Plafoane pe tip. Mai stricte decât bucket-ul (200 MiB) în mod deliberat:
 * bucket-ul e ultima plasă, formularul trebuie să refuze mai devreme și cu un
 * mesaj pe care omul îl înțelege, nu cu un 413 după trei minute de încărcare.
 *
 * ⚠ Plafonul GLOBAL al proiectului Supabase (Dashboard → Storage) plafonează
 * `file_size_limit` al bucket-ului. Dacă o încărcare mare cade cu 413 deși
 * trece verificările de aici, acolo e limita — nu în cod.
 */
export const LIMITA_PDF_BYTES = 25 * 1024 * 1024;
export const LIMITA_VIDEO_BYTES = 200 * 1024 * 1024;
export const LIMITA_SUBTITRARE_BYTES = 2 * 1024 * 1024;

export const MIME_PDF = ["application/pdf"] as const;
/**
 * Fără `video/quicktime`: un `.mov` de iPhone e adesea HEVC, se încarcă fără
 * eroare și nu se redă în Chrome. Un fișier care trece încărcarea și pică la
 * redare e mai rău decât unul respins la selecție.
 */
export const MIME_VIDEO = ["video/mp4", "video/webm"] as const;
export const MIME_SUBTITRARE = ["text/vtt"] as const;

export type FelMaterial = "pdf" | "video";

export function construiesteCaleMaterial(input: {
  readonly organizationId: string;
  readonly materialId: string;
  readonly versiune: number;
  readonly numeFisier: string;
}): string {
  return (
    `${input.organizationId}/${RESURSA_CURSURI}/${input.materialId}/` +
    `v${input.versiune}-${crypto.randomUUID()}-${slugFisier(input.numeFisier)}`
  );
}

/** Prefixul verificat anti-traversal. Lângă constructor, ca să nu poată diverge. */
export function prefixCaleMaterial(organizationId: string, materialId: string): string {
  return `${organizationId}/${RESURSA_CURSURI}/${materialId}/`;
}

/** Ce scrie pe formular ÎNAINTE de alegere, nu ca eroare după. */
export const RESTRICTII_INCARCARE: Readonly<Record<FelMaterial, string>> = {
  pdf: "PDF, până la 25 MB.",
  video:
    "MP4 (H.264/AAC) sau WebM, până la 200 MB. Peste ~15 minute de film, folosiți un link extern.",
};

export function verificaMaterial(
  fel: FelMaterial,
  mime: string,
  dimensiune: number,
): string | null {
  const acceptate: readonly string[] = fel === "pdf" ? MIME_PDF : MIME_VIDEO;
  if (!acceptate.includes(mime)) {
    return fel === "pdf"
      ? "Acceptăm doar fișiere PDF."
      : "Acceptăm doar filme MP4 sau WebM. Un fișier .mov de iPhone nu se redă în toate browserele.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  const limita = fel === "pdf" ? LIMITA_PDF_BYTES : LIMITA_VIDEO_BYTES;
  if (dimensiune > limita) {
    return fel === "pdf"
      ? "Fișierul depășește 25 MB."
      : "Filmul depășește 200 MB. Încărcați o versiune comprimată sau folosiți un link extern.";
  }
  return null;
}

export function verificaSubtitrare(mime: string, dimensiune: number): string | null {
  if (!(MIME_SUBTITRARE as readonly string[]).includes(mime)) {
    return "Subtitrarea trebuie să fie un fișier .vtt (WebVTT).";
  }
  if (dimensiune <= 0) return "Fișierul de subtitrare este gol.";
  if (dimensiune > LIMITA_SUBTITRARE_BYTES) return "Subtitrarea depășește 2 MB.";
  return null;
}

/**
 * Semnăturile de început de fișier („magic bytes").
 *
 * MIME-ul trimis de formular e cel declarat de browser — un HTML redenumit
 * `.mp4` îl raportează cum vrea cel care încarcă. Verificarea reală se face pe
 * server, citind primii octeți ai obiectului DEJA încărcat, înainte de a scrie
 * rândul. La nepotrivire obiectul se șterge și rândul se refuză.
 */
export function potrivesteSemnatura(mime: string, primiiOcteti: Uint8Array): boolean {
  const are = (offset: number, ...octeti: number[]): boolean =>
    octeti.every((o, i) => primiiOcteti[offset + i] === o);

  switch (mime) {
    case "application/pdf":
      // "%PDF"
      return are(0, 0x25, 0x50, 0x44, 0x46);
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
    default:
      return false;
  }
}
