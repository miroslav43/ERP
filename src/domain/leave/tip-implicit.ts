// src/domain/leave/tip-implicit.ts

/**
 * Tipul de concediu preselectat într-un formular de cerere nouă.
 *
 * ── DE CE NU „PRIMUL DIN LISTĂ" ────────────────────────────────────────────
 * Ambele formulare (aplicația mare și portalul) cereau lista `leave_types`
 * ordonată după `denumire` și preselectau `tipuri[0]`. Ordinea alfabetică
 * românească începe cu „Concediu creștere copil"; „Concediu de odihnă" cade
 * pe locul trei. Adică ecranul propunea implicit tipul cel mai rar, iar
 * cererea de odihnă — singura pe care o depune aproape toată lumea, de câteva
 * ori pe an — cerea de fiecare dată o atingere în plus. Mai rău: cine nu se
 * uita la câmp trimitea o cerere de creștere copil.
 *
 * Cheia `odihna` e din seed-ul `internal.seed_leave_defaults` și e aceeași în
 * toate organizațiile. Poate lipsi din listă — tipul se poate dezactiva
 * (`activ = false`), iar formularele cer doar tipurile active — de aceea
 * rezerva e primul din listă, nu o excepție.
 *
 * Funcție PURĂ, cu generic: fiecare formular are propria formă de tip (unul
 * cere `culoare` și `zile_implicite`, celălalt nu), dar amândouă au `id` și
 * `key`. Genericul păstrează forma apelantului, ca rezultatul să se poată
 * folosi direct, fără o a doua căutare în listă.
 */

export const CHEIE_TIP_IMPLICIT = "odihna";

export function tipImplicitConcediu<T extends { readonly key: string }>(
  tipuri: readonly T[],
): T | null {
  return tipuri.find((tip) => tip.key === CHEIE_TIP_IMPLICIT) ?? tipuri[0] ?? null;
}
