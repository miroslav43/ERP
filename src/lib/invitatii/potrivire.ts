// src/lib/invitatii/potrivire.ts
// Care invitație în așteptare e „aceeași" cu cea pe care o cere butonul.
//
// Funcție PURĂ, fără I/O: apelantul aduce lista invitațiilor `pending` ale
// organizației. Stă separat fiindcă decizia are trei ieșiri și patru capcane, iar
// toate patru sunt tăcute — se văd abia peste săptămâni, în invitații încurcate
// între oameni.
//
// ── DE CE NU E DOAR „CAUTĂ DUPĂ ADRESĂ" ─────────────────────────────────────
// Baza ține DOUĂ indexuri unice parțiale, nu unul, iar 0099 explică de ce:
//
//   invitations_org_email_pending_uq  (organization_id, email)  → una per adresă
//   invitations_employee_pending_uq   (employee_id)             → una per fișă
//
// Al doilea a fost adăugat tocmai fiindcă primul NU acoperă cazul: „două fișe pot
// purta aceeași adresă de e-mail (soți la aceeași firmă, o adresă de familie)".
//
// Deci adresa nu identifică omul. O căutare doar după ea ar fi retrimis
// invitația SOȚULUI și i-ar fi mutat-o pe fișa soției — un cont pornit pe fișa
// greșită, fără nicio eroare pe drum.
import { esteAdresaSintetica } from "./adresa";

export type InvitatiePendinta = Readonly<{
  id: string;
  email: string;
  employee_id: string | null;
}>;

export type Potrivire =
  /** Nu există nimic în așteptare pentru omul ăsta: se inserează un rând nou. */
  | Readonly<{ fel: "creeaza" }>
  /** Există rândul lui: se reînnoiește tokenul și termenul. */
  | Readonly<{ fel: "retrimite"; id: string }>
  /**
   * Adresa e ținută de invitația ALTCUIVA. Nici nu se poate insera (indexul
   * unic pe adresă ar da 23505), nici nu se poate retrimite (ar fi invitația
   * altui om). Singura ieșire e o decizie umană: revocarea celeilalte.
   */
  | Readonly<{ fel: "coliziune"; adresa: string }>;

/**
 * @param pendinte  invitațiile `status = 'pending'` ale organizației
 * @param email     adresa aleasă acum, deja normalizată (`trim` + minuscule)
 * @param employeeId fișa pentru care se invită; `null` = invitație de membru pur
 */
export function potrivesteInvitatia(
  pendinte: readonly InvitatiePendinta[],
  email: string,
  employeeId: string | null,
): Potrivire {
  const adresa = email.trim().toLowerCase();
  const alAdresei = pendinte.find((invitatie) => invitatie.email.trim().toLowerCase() === adresa);

  // Ecranul de membri invită o ADRESĂ, nu o fișă. Acolo adresa e identitatea.
  if (employeeId === null) {
    return alAdresei === undefined ? { fel: "creeaza" } : { fel: "retrimite", id: alAdresei.id };
  }

  const alFisei = pendinte.find((invitatie) => invitatie.employee_id === employeeId);

  if (alFisei !== undefined) {
    // Fișa are deja o invitație — pe altă adresă decât cea de acum, dacă i s-a
    // completat între timp e-mailul real peste unul sintetic
    // (`marca-0042@firma.intern`). Se retrimite pe adresa nouă, dar numai dacă
    // adresa nu e deja prinsă de alt rând.
    if (alAdresei !== undefined && alAdresei.id !== alFisei.id) {
      return { fel: "coliziune", adresa };
    }
    return { fel: "retrimite", id: alFisei.id };
  }

  if (alAdresei === undefined) return { fel: "creeaza" };

  /*
   * Adresa are o invitație, fișa n-are niciuna. Două situații foarte diferite:
   *
   *   employee_id = null  → invitație de MEMBRU PUR, trimisă din Setări →
   *                         Membri pe aceeași adresă. E același om; se
   *                         retrimite, iar rândul se leagă acum de fișă.
   *   employee_id ≠ null  → invitația ALTEI FIȘE. Adresa de familie. Nu se
   *                         atinge.
   */
  return alAdresei.employee_id === null
    ? { fel: "retrimite", id: alAdresei.id }
    : { fel: "coliziune", adresa };
}

/**
 * Adresa pe care s-a trimis efectiv invitația, așa cum se arată omului.
 *
 * O adresă sintetică nu e o adresă: e un nume de utilizator, iar „Invitație
 * trimisă pe marca-0042@firma.intern" ar fi o minciună — nu s-a trimis nimic
 * acolo, prin proiectare (domeniu rezervat prin RFC 8375).
 */
export function descrieAdresaInvitatiei(email: string): string {
  return esteAdresaSintetica(email) ? `utilizatorul ${email} (fără e-mail)` : email;
}
