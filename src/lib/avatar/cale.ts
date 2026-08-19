// src/lib/avatar/cale.ts
// Contractul de cale pentru bucket-ul `avatars` (0029_avatare.sql):
//   {user_id}/{uuid}-{nume_fișier}
// Distinct de `lib/documents/cale.ts`: avatarul ține de contul din `profiles`
// (`avatar_path`), nu de o organizație — de-aia calea NU începe cu
// organization_id, spre deosebire de org-documents/org-branding.
import { slugFisier } from "@/lib/documents/cale";
import { clientEnv } from "@/config/env";

export const BUCKET_AVATARE = "avatars";
export const LIMITA_AVATAR_BYTES = 2 * 1024 * 1024;
export const MIME_AVATAR_ACCEPTATE = ["image/png", "image/jpeg", "image/webp"] as const;

export function caleAvatar(userId: string, numeFisier: string): string {
  return `${userId}/${crypto.randomUUID()}-${slugFisier(numeFisier)}`;
}

export function verificaAvatar(mime: string, dimensiune: number): string | null {
  if (!MIME_AVATAR_ACCEPTATE.some((acceptat) => acceptat === mime)) {
    return "Acceptăm doar imagini JPG, PNG sau WEBP.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  if (dimensiune > LIMITA_AVATAR_BYTES) return "Fotografia depășește 2 MB.";
  return null;
}

/**
 * Bucket-ul e public: URL-ul e o construcție de string, nu un apel semnat.
 * `avatar_path` poate fi și un URL extern complet (avatarul din metadata OAuth
 * la primul sign-in, vezi `internal.handle_new_user`) — îl întoarcem neatins.
 */
export function urlAvatar(avatarPath: string | null): string | null {
  if (avatarPath === null || avatarPath.length === 0) return null;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) return avatarPath;
  return `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_AVATARE}/${avatarPath}`;
}
