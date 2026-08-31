// src/lib/asistent/protocol.ts
/**
 * Cadrele care circulă de la `/api/asistent` către bula din colț.
 *
 * Fișierul e importat de AMBELE capete — ruta de server și componenta client —
 * exact ca să nu existe două definiții ale aceluiași format. Un protocol scris
 * de două ori se desincronizează, iar simptomul e cel mai neplăcut cu putință:
 * răspunsul curge, nimic nu dă eroare, doar că pe ecran nu apare nimic.
 *
 * De aceea nu importă nimic din `server-only` și nu atinge baza.
 */
import type { Destinatie } from "./destinatii";

export type Cadru =
  /** O bucată de text, exact cum a produs-o modelul. Se adaugă la ce e deja. */
  | Readonly<{ t: "text"; b: string }>
  /** O unealtă a pornit. UI-ul arată „Caut soldul de concediu…”. */
  | Readonly<{ t: "unealta"; n: string }>
  /**
   * Destinații valabile doar pentru răspunsul acesta — fișele găsite de o
   * căutare. Sosesc ÎNAINTE de textul care le pomenește, ca marcajul să aibă ce
   * rezolva în clipa în care apare.
   */
  | Readonly<{ t: "destinatii"; d: readonly Destinatie[] }>
  | Readonly<{ t: "gata" }>
  | Readonly<{ t: "eroare"; m: string }>;

/** Un cadru, gata de scris în fluxul SSE. */
export function scrieCadru(cadru: Cadru): string {
  // JSON pe o singură linie: `\n` în interiorul unei încărcături `data:` ar
  // rupe cadrul în două. `JSON.stringify` scapă oricum orice `\n` din text.
  return `data: ${JSON.stringify(cadru)}\n\n`;
}

/**
 * Citește un cadru primit. `null` pentru orice nu se recunoaște.
 *
 * Nu se folosește Zod aici: fișierul ajunge în pachetul de client, iar cadrele
 * vin de la propriul nostru server, prin același origine. Verificarea de formă e
 * pentru robustețe la o versiune veche a paginii rămasă deschisă într-o filă
 * peste un deploy, nu pentru date ostile.
 */
export function citesteCadru(brut: string): Cadru | null {
  let valoare: unknown;
  try {
    valoare = JSON.parse(brut);
  } catch {
    return null;
  }
  if (typeof valoare !== "object" || valoare === null) return null;
  const cadru = valoare as { t?: unknown };
  switch (cadru.t) {
    case "text":
      return typeof (valoare as { b?: unknown }).b === "string" ? (valoare as Cadru) : null;
    case "unealta":
      return typeof (valoare as { n?: unknown }).n === "string" ? (valoare as Cadru) : null;
    case "destinatii":
      return Array.isArray((valoare as { d?: unknown }).d) ? (valoare as Cadru) : null;
    case "gata":
      return { t: "gata" };
    case "eroare":
      return typeof (valoare as { m?: unknown }).m === "string" ? (valoare as Cadru) : null;
    default:
      return null;
  }
}
