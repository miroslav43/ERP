// src/lib/text/diacritice.ts

/**
 * Textul românesc, adus la o formă comparabilă.
 *
 * ── DE CE EXISTĂ FIȘIERUL ─────────────────────────────────────────────────
 * `normalize("NFD")` apărea de CINCISPREZECE ori, în treisprezece fișiere, sub
 * patru nume diferite (`faraDiacritice`, `normalizeaza`, `cheieComparatie`,
 * `normalizeazaGen`) și cu TREI regexuri diferite pentru „scoate semnele":
 *
 *     .replace(/\p{M}+/gu, "")        — orice marcaj combinat
 *     .replace(/\p{Diacritic}/gu, "") — proprietatea Unicode `Diacritic`
 *     .replace(/[̀-ͯ]/g, "") — doar blocul „Combining Diacritical Marks"
 *
 * Cele trei NU sunt echivalente în general. Pe română sunt — verificat rulând,
 * nu dedus: toate cele cinci litere cu semn se descompun în blocul 0300–036F.
 *
 *     ș → U+0073 U+0326      ț → U+0074 U+0326
 *     ş → U+0073 U+0327      ţ → U+0074 U+0327
 *     ă → U+0061 U+0306      î → U+0069 U+0302
 *
 * Consecința utilă: virgula dedesubt (U+0326) și sedila (U+0327) cad amândouă,
 * deci `Ţucă` importat dintr-un fișier vechi și `Țucă` scris corect ajung la
 * aceeași cheie. Asta contează: jumătate din numele clienților vin din Excel-uri
 * făcute înainte ca Windows să scrie virgula dedesubt.
 *
 * `src/domain/hr/cor-nomenclator.ts` avea în plus `.replace(/[țţ]/gu, "t")`
 * DUPĂ ștergerea marcajelor — cod mort: pe text descompus nu mai există niciun
 * `ț` pe care să-l prindă.
 *
 * ── CE NU E AICI (ÎNCĂ) ───────────────────────────────────────────────────
 * Mai există două familii de normalizare care fac și altceva decât să scoată
 * semnele, și care se unifică la fazele lor de modul, nu aici:
 *   · SLUG de identificator sau de fișier — `lib/documents/cale.ts`,
 *     `lib/pdf/document.ts`, `(app)/evaluari/actions.ts` și cele două ecrane de
 *     înrolare din consola de platformă. Diferă prin separator (`-` față de `_`).
 *   · ANTET de import — `domain/import/mapare.ts` și `domain/import/validare.ts`,
 *     care mai și înlocuiesc punctuația cu spațiu și taie marginile.
 */

/** Scoate semnele diacritice. NU schimbă litera mare în mică. */
export function faraDiacritice(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "");
}

/**
 * Cheia după care se caută și se compară: fără semne, cu litere mici.
 *
 * Se aplică pe AMBELE părți ale comparației — și pe ce s-a tastat, și pe ce e
 * în listă. Aplicată doar pe una, „stanescu" tot n-ar găsi „Stănescu".
 */
export function cheieCautare(text: string): string {
  return faraDiacritice(text).toLowerCase();
}
