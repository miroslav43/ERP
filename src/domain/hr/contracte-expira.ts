// src/domain/hr/contracte-expira.ts
/**
 * Fereastra „contracte care expiră": cartela de pe panou și filtrul
 * `/angajati?contract=expira` numără ACELAȘI lucru — contracte pe durată
 * determinată, neîncetate, cu `valabil_pana` în următoarele N zile. Pragul stă
 * aici, nu în două fișiere, ca cifra și lista să nu poată diverge.
 */
export const PRAG_CONTRACTE_EXPIRA_ZILE = 30;

/** `YYYY-MM-DD` peste `zile` zile de la `azi` (UTC, ca `peste()` din panou). */
export function dataLimitaExpirare(zile: number, acum: Date = new Date()): string {
  const d = new Date(acum);
  d.setUTCDate(d.getUTCDate() + zile);
  return d.toISOString().slice(0, 10);
}
