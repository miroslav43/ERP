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

/**
 * Segmentul 2 al căii NU e un cuvânt liber ales de noi: `app.can_path`
 * (0002_authz.sql) îl dă direct lui `app.has_permission` ca NUME DE RESURSĂ.
 * Un cuvânt care nu există în `role_permissions.resource` întoarce `none` —
 * adică refuz TĂCUT, fără eroare, la fiecare încărcare.
 *
 * Exact asta s-a întâmplat: valorile erau „angajati", „contracte", „adeverinte",
 * „import", iar catalogul are doar nume englezești. Sondat pe baza reală în
 * 2026-08-25: pentru un `org_admin` care nu e platform admin,
 * `can_path('{org}/angajati/{emp}/x.pdf','create')` = false, iar cu `employees`
 * = true. Încărcarea documentelor de personal n-a funcționat niciodată.
 *
 * De aceea lista e un `as const` verificat de `cale.test.ts` împotriva lui
 * `PERMISSION_KEYS`: o valoare nouă care nu e resursă reală pică testul, nu
 * producția. Vezi migrarea 0073_cale_storage_resurse.sql pentru al doilea
 * defect, cel de citire.
 */
export const ENTITATI_DOCUMENT = ["employees"] as const;
export type EntitateDocument = (typeof ENTITATI_DOCUMENT)[number];

export function slugFisier(nume: string): string {
  const fara = nume.normalize("NFD").replace(/\p{M}+/gu, "");
  const curatat = fara
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return curatat.length > 0 ? curatat.slice(-120) : "fisier";
}

/**
 * Prefixul unei entități, singura formă în care se verifică o cale primită de
 * la client (anti-traversal). Trăiește lângă constructor tocmai ca cele două să
 * nu poată diverge: verificarea din `salveazaDocument` avea prefixul scris de
 * mână, deci reparația segmentului ar fi trecut pe lângă ea.
 */
export function prefixCaleDocument(
  organizationId: string,
  entitate: EntitateDocument,
  entitateId: string,
): string {
  return `${organizationId}/${entitate}/${entitateId}/`;
}

export function construiesteCaleDocument(input: {
  readonly organizationId: string;
  readonly entitate: EntitateDocument;
  readonly entitateId: string;
  readonly numeFisier: string;
}): string {
  return `${prefixCaleDocument(input.organizationId, input.entitate, input.entitateId)}${crypto.randomUUID()}-${slugFisier(input.numeFisier)}`;
}

/**
 * Lotul validat al unui import: cale fixă, ca pasul de aplicare să nu depindă
 * de client. Segmentul 2 e `employees`, nu `import`, pentru că ambele acțiuni
 * de import cer deja `employees:create` (import/actions.ts:28) — calea și
 * poarta acțiunii vorbesc acum aceeași limbă. Segmentul 3 e lotul, nu o fișă,
 * ceea ce e în regulă: `org_admin` și `hr` au `employees:create = all`.
 */
export function caleLotImport(organizationId: string, batchId: string): string {
  return `${organizationId}/employees/${batchId}/lot-validat.json`;
}

export function verificaDocument(mime: string, dimensiune: number): string | null {
  if (!MIME_ACCEPTATE.some((acceptat) => acceptat === mime)) {
    return "Acceptăm doar PDF, imagini (JPG, PNG, WEBP), Word sau Excel.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  if (dimensiune > LIMITA_DOCUMENT_BYTES) return "Fișierul depășește 20 MB.";
  return null;
}
