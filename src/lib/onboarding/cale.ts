// src/lib/onboarding/cale.ts
//
// Contractul de cale pentru dovezile de pas, în bucketul `org-checklists`.
//
//   {organization_id}/checklists/{employee_id}/{instance_item_id}/{uuid}-{slug}
//
// Segmentul 2 e un nume de RESURSĂ DE PERMISIUNE, nu un cuvânt ales liber.
// `app.path_resource` îl validează doar ca FORMĂ (`^[a-z][a-z0-9_]{1,63}$`) —
// nu ca listă albă. Un cuvânt care trece regexul dar nu există în catalogul de
// resurse, cum ar fi `onboarding`, face `app.has_permission` să întoarcă
// `'none'`, adică refuz TĂCUT. Exact asta a ținut moartă încărcarea
// documentelor de personal până la migrarea 0073.
//
// De aceea constanta stă într-un singur loc și e verificată în test împotriva
// lui `PERMISSION_KEYS`.

import { slugFisier } from "@/lib/documents/cale";

/** Bucketul creat în 0092. Privat. */
export const BUCKET_CHECKLISTS = "org-checklists";

/** Segmentul 2. Trebuie să fie o resursă REALĂ din catalogul de permisiuni. */
export const RESURSA_CHECKLISTS = "checklists";

/**
 * Plafon mai strict decât bucketul (25 MiB), deliberat: bucketul e ultima
 * plasă, formularul trebuie să refuze mai devreme și cu un mesaj pe care omul
 * îl înțelege, nu cu un 413 după ce a așteptat încărcarea.
 */
export const LIMITA_DOVADA_BYTES = 20 * 1024 * 1024;

export const MIME_DOVADA = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** Ce scrie pe formular ÎNAINTE de alegere, nu ca eroare după. */
export const RESTRICTII_DOVADA = "PDF, imagine, Word sau Excel, până la 20 MB.";

export function construiesteCaleDovada(input: {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly instanceItemId: string;
  readonly numeFisier: string;
}): string {
  return (
    `${input.organizationId}/${RESURSA_CHECKLISTS}/${input.employeeId}/${input.instanceItemId}/` +
    `${crypto.randomUUID()}-${slugFisier(input.numeFisier)}`
  );
}

/**
 * Prefixul verificat anti-traversal, lângă constructor ca să nu poată diverge.
 *
 * Include PASUL, nu doar persoana: poarta din bază (`app.checklist_poate_dovada`)
 * se ancorează pe segmentul 4, iar o verificare de aplicație mai laxă decât cea
 * din bază e o verificare care nu servește la nimic.
 */
export function prefixCaleDovada(
  organizationId: string,
  employeeId: string,
  instanceItemId: string,
): string {
  return `${organizationId}/${RESURSA_CHECKLISTS}/${employeeId}/${instanceItemId}/`;
}

export interface ProblemaDovada {
  readonly mesaj: string;
}

/** Verificările pe care le poate face clientul, înainte să urce vreun octet. */
export function verificaDovada(fisier: {
  readonly size: number;
  readonly type: string;
}): ProblemaDovada | null {
  if (fisier.size <= 0) return { mesaj: "Fișierul este gol." };
  if (fisier.size > LIMITA_DOVADA_BYTES) {
    return { mesaj: `Fișierul depășește 20 MB. ${RESTRICTII_DOVADA}` };
  }
  if (!(MIME_DOVADA as readonly string[]).includes(fisier.type)) {
    return { mesaj: `Tipul „${fisier.type || "necunoscut"}” nu e acceptat. ${RESTRICTII_DOVADA}` };
  }
  return null;
}
