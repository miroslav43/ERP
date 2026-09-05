// src/app/(portal)/portal/notificarile-mele/feluri.ts

/**
 * Toate felurile de notificare din `public.notification_kind` (`0001:89-91`).
 *
 * Enumerate explicit, nu citite din bază: `notification_preferences` are un rând
 * PE FEL, iar „oprește notificările pe telefon" înseamnă toate. Dacă cineva
 * adaugă un fel nou în enum și uită lista asta, felul nou rămâne PORNIT — de
 * aceea există `preferinte-feluri.test.ts`, care compară lista cu tipul generat
 * și cade la prima divergență.
 *
 * ── DE CE STĂ ÎN FIȘIERUL ĂSTA ȘI NU ÎN `actions.ts` ──────────────────────
 * Fiindcă `actions.ts` poartă directiva `"use server"`, iar un asemenea fișier
 * **nu poate exporta decât funcții async**. O constantă exportată de acolo
 * devine „A `use server` file can only export async functions, found object" —
 * o eroare pe care `pnpm typecheck`, `pnpm lint` și `pnpm test` o ratează pe
 * toate trei: apare EXCLUSIV la `next build`, în faza „Collecting page data",
 * după trei minute de TypeScript. S-a întâmplat pe 2026-09-05, la build-ul de
 * producție din Docker, unde costul unei reveniri e cel mai mare.
 *
 * Regula, ca s-o poți aplica fără să reproduci eroarea: dacă valoarea nu e o
 * funcție async — nici direct, nici întoarsă de `createAction()` — nu se
 * exportă dintr-un fișier `"use server"`. Îi faci un modul alături, ca ăsta.
 * Vezi `docs/design/ecrane/capcane.md` și antetul din `CLAUDE.md`.
 */
export const FELURI_NOTIFICARE = [
  "info",
  "success",
  "warning",
  "error",
  "task",
  "reminder",
  "approval",
  "announcement",
] as const;
