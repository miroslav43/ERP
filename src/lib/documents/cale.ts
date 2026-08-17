// src/lib/documents/cale.ts
// Contractul de cale în Storage, singurul loc unde se construiește:
// {organization_id}/{entity}/{entity_id}/{uuid}-{filename}
/**
 * Numele REAL al bucket-ului, cel creat în `0002_authz.sql`.
 *
 * Codul folosea „documente", care nu există: politicile de pe `storage.objects`
 * restrâng explicit la `org-documents` și `org-branding`, deci orice încărcare
 * ar fi eșuat la primul fișier real. Numele trăiește într-o singură constantă
 * tocmai ca să nu poată diverge din nou de schemă.
 */
export const BUCKET_DOCUMENTE = "org-documents";
export const LIMITA_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MIME_ACCEPTATE = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type EntitateDocument = "angajati" | "contracte" | "adeverinte" | "import";

export function slugFisier(nume: string): string {
  const fara = nume.normalize("NFD").replace(/\p{M}+/gu, "");
  const curatat = fara
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return curatat.length > 0 ? curatat.slice(-120) : "fisier";
}

export function construiesteCaleDocument(input: {
  readonly organizationId: string;
  readonly entitate: EntitateDocument;
  readonly entitateId: string;
  readonly numeFisier: string;
}): string {
  return `${input.organizationId}/${input.entitate}/${input.entitateId}/${crypto.randomUUID()}-${slugFisier(input.numeFisier)}`;
}

/** Lotul validat al unui import: cale fixă, ca pasul de aplicare să nu depindă de client. */
export function caleLotImport(organizationId: string, batchId: string): string {
  return `${organizationId}/import/${batchId}/lot-validat.json`;
}

export function verificaDocument(mime: string, dimensiune: number): string | null {
  if (!MIME_ACCEPTATE.some((acceptat) => acceptat === mime)) {
    return "Acceptăm doar PDF, imagini (JPG, PNG, WEBP), Word sau Excel.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  if (dimensiune > LIMITA_DOCUMENT_BYTES) return "Fișierul depășește 20 MB.";
  return null;
}
