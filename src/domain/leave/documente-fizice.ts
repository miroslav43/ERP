// src/domain/leave/documente-fizice.ts
/**
 * Concediile la care documentul justificativ trebuie predat pe HÂRTIE, în
 * original — și nu poate fi înlocuit de o încărcare pe platformă.
 *
 * ── DE CE EXISTĂ LISTA ────────────────────────────────────────────────────
 * `leave_types.necesita_document` spune DACĂ e nevoie de un act, nu CE SE FACE
 * cu el. Pentru majoritatea tipurilor, o copie încărcată în dosar e suficientă:
 * actul justifică absența față de angajator, iar angajatorul îl păstrează.
 *
 * Trei fac excepție, și nu dintr-o preferință de proces — angajatorul trebuie
 * să înainteze mai departe exemplarul fizic:
 *
 * · certificatul medical tipizat pleacă la Casa de Sănătate în dosarul FNUASS,
 *   pe formularul original, cu exemplarele 1 și 2;
 * · maternitatea stă pe același certificat (cod 08), deci aceeași regulă;
 * · adeverința de donator se prezintă în original la control, ca dovadă a
 *   zilei libere plătite.
 *
 * O copie scanată NU închide niciuna dintre cele trei. De aceea platforma
 * cere originalul pe hârtie și acceptă fișierul doar ca ajutor, nu ca dovadă.
 *
 * ── DE CE ÎN COD, NU ÎNTR-O COLOANĂ ───────────────────────────────────────
 * Regula vine din lege, nu din politica unei firme: nicio organizație nu poate
 * decide că FNUASS îi acceptă un PDF. O coloană reglabilă din interfață ar
 * sugera că se poate.
 *
 * Prețul e că lista trăiește în DOUĂ locuri — aici și în
 * `internal.leave_requests_pregateste` (0096_concediu_document_original.sql),
 * care trebuie să nu blocheze trimiterea fără atașament. `documente-fizice.test.ts`
 * citește migrarea și pică dacă cele două se despart.
 */

/** Cheile din `leave_types.key`. Aceleași trei, în aceeași ordine, ca în 0096. */
export const TIPURI_CU_ORIGINAL_FIZIC = ["medical", "maternitate", "donator_sange"] as const;

export type TipCuOriginalFizic = (typeof TIPURI_CU_ORIGINAL_FIZIC)[number];

/** `leave_types.key` → cere originalul pe hârtie? Cheile necunoscute: nu. */
export function cereOriginalFizic(cheieTip: string | null | undefined): boolean {
  if (cheieTip === null || cheieTip === undefined) return false;
  return (TIPURI_CU_ORIGINAL_FIZIC as readonly string[]).includes(cheieTip);
}

/**
 * De ce anume are nevoie angajatorul, în cuvintele omului care aduce actul.
 *
 * Motivul e scris, nu doar cerința: „aduceți originalul" fără „altfel nu se
 * poate depune dosarul la Casa de Sănătate" sună a birocrație inventată de
 * firmă, și exact așa e tratat.
 */
const EXPLICATII: Readonly<Record<TipCuOriginalFizic, string>> = {
  medical:
    "Certificatul medical tipizat — exemplarele 1 și 2, foile albă și roz — se predă în ORIGINAL la resurse umane. " +
    "Fără el, angajatorul nu poate depune dosarul de recuperare a sumelor de la Casa de Sănătate (FNUASS).",
  maternitate:
    "Concediul stă tot pe un certificat medical (cod 08), deci se aplică aceeași regulă: " +
    "ORIGINALUL se predă la resurse umane, fiind obligatoriu pentru decontarea indemnizației.",
  donator_sange:
    "Adeverința eliberată de centrul de transfuzii se predă în ORIGINAL la resurse umane sau la contabilitate: " +
    "ea justifică legal ziua liberă plătită la un eventual control.",
};

/** Ce se scrie sub câmpul de încărcare, pentru cele trei. `null` pentru restul. */
export function explicatieOriginalFizic(cheieTip: string | null | undefined): string | null {
  if (!cereOriginalFizic(cheieTip)) return null;
  return EXPLICATII[cheieTip as TipCuOriginalFizic];
}

/**
 * Ce se cere la câmpul de document, pentru un tip anume.
 *
 * - `nu` — tipul nu cere niciun act.
 * - `incarcare` — fișierul ÎNCĂRCAT e documentul justificativ; fără el,
 *   trimiterea e respinsă de `internal.leave_requests_pregateste`.
 * - `original_fizic` — actul se predă pe hârtie; încărcarea rămâne posibilă,
 *   dar opțională, iar trimiterea trece și fără ea.
 */
export type ModDocument = "nu" | "incarcare" | "original_fizic";

export function modDocument(
  cheieTip: string | null | undefined,
  necesitaDocument: boolean,
): ModDocument {
  if (cereOriginalFizic(cheieTip)) return "original_fizic";
  return necesitaDocument ? "incarcare" : "nu";
}
