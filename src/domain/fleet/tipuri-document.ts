// src/domain/fleet/tipuri-document.ts

/**
 * Nomenclatorul de documente de vehicul, așa cum îl vede O FIRMĂ (0199).
 * Funcții pure, fără I/O.
 *
 * ── DE CE SE COMBINĂ AICI, NU ÎN POSTGRES ────────────────────────────────────
 * Tipurile de platformă sunt aceleași pentru toate firmele; fiecare firmă poate
 * activa, retrage sau face obligatoriu un tip DE PLATFORMĂ prin
 * `vehicle_document_type_setari`. Valoarea efectivă e `coalesce(setarea, tipul)`
 * — exact regula pe care `internal.vdoc_inainte` o aplică la scriere. Combinată
 * în TypeScript, nu într-o vedere: `.rpc()` nu ajunge la schema `app`, iar o
 * vedere nouă ar fi cerut încă o politică de oglindit. `tipuri-document.test.ts`
 * fixează regula, ca ecranul să nu promită un tip pe care baza îl refuză.
 *
 * Tipul PROPRIU firmei nu primește setare (baza o refuză, P0001): se modifică pe
 * rândul lui. O setare rătăcită pe el se ignoră aici.
 */

/** Rândul din `vehicle_document_types`, cum îl citește stratul de citire. */
export interface TipBrut {
  readonly id: string;
  readonly organization_id: string | null;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly cere_expirare: boolean;
  readonly obligatoriu: boolean;
  readonly ordine: number;
  readonly activ: boolean;
  readonly categorii_aplicabile: readonly string[] | null;
  readonly masa_max_kg: number | null;
}

/** Rândul din `vehicle_document_type_setari` al firmei. */
export interface SetareTip {
  readonly document_type_id: string;
  readonly activ: boolean;
  readonly obligatoriu: boolean;
}

/** Tipul cu valorile EFECTIVE ale firmei, plus de unde vin. */
export interface TipEfectiv extends TipBrut {
  /** `true` = tipul e al firmei (`organization_id` nenul). */
  readonly propriu: boolean;
  /** Valorile platformei, înainte de setare — pentru ecranul de setări. */
  readonly activ_platforma: boolean;
  readonly obligatoriu_platforma: boolean;
  /** Setarea firmei, dacă există (doar pe tipurile de platformă). */
  readonly setare: SetareTip | null;
}

export function aplicaSetariTipuri(
  tipuri: readonly TipBrut[],
  setari: readonly SetareTip[],
): TipEfectiv[] {
  const dupaTip = new Map(setari.map((s) => [s.document_type_id, s]));
  return tipuri
    .map((t): TipEfectiv => {
      const propriu = t.organization_id !== null;
      const setare = propriu ? null : (dupaTip.get(t.id) ?? null);
      const activ = setare?.activ ?? t.activ;
      return {
        ...t,
        propriu,
        activ,
        // Un tip retras nu se cere nimănui (aceeași regulă ca `vdts_inainte`).
        obligatoriu: activ && (setare?.obligatoriu ?? t.obligatoriu),
        activ_platforma: t.activ,
        obligatoriu_platforma: t.obligatoriu,
        setare,
      };
    })
    .sort((a, b) => a.ordine - b.ordine || a.denumire.localeCompare(b.denumire, "ro"));
}

/** Lungimea maximă a codului: `vdt_cod_ck` cere `^[a-z][a-z0-9_]{1,48}$`. */
const COD_MAXIM = 48;

/**
 * Codul unui tip propriu, din denumirea lui. Omul scrie „Autorizație de
 * transport județean”, nu un identificator: codul devine `expirables.kind`,
 * deci trebuie să treacă `vdt_cod_ck` (literă la început, apoi litere mici,
 * cifre și `_`). `internal.vdt_normalizeaza` face aceeași curățare la scriere;
 * aici se calculează DINAINTE, ca acțiunea să poată spune pe câmpul denumirii
 * că există deja un tip de platformă cu același cod.
 */
export function codDinDenumire(denumire: string): string {
  const baza = denumire
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  const cuLitera = /^[a-z]/u.test(baza) ? baza : `tip_${baza}`.replace(/_+$/u, "");
  const cod = cuLitera.length < 2 ? "tip_propriu" : cuLitera;
  return cod.slice(0, COD_MAXIM).replace(/_+$/u, "");
}

/**
 * Tipurile din selectorul unui document EXISTENT: cele active ale firmei, plus
 * tipul documentului însuși, când acela a fost retras între timp.
 *
 * Fără el, un document CASCO rămas pe fișă după ce firma a retras CASCO nu se
 * mai putea corecta: `<select defaultValue>` nu-și găsea opțiunea, cădea pe
 * „Alegeți tipul”, iar salvarea cerea alt tip. Baza permite corectura cât
 * timp tipul nu se schimbă (`vdoc_inainte` verifică disponibilitatea doar la
 * schimbarea tipului, 0199 §4); ecranul trebuie să permită același lucru.
 */
export function tipuriPentruDocument<T extends Readonly<{ id: string; activ: boolean }>>(
  nomenclator: readonly T[],
  tipDocumentId: string,
): T[] {
  return nomenclator.filter((t) => t.activ || t.id === tipDocumentId);
}
