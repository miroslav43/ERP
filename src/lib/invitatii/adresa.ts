// src/lib/invitatii/adresa.ts
// Pe ce adresă pleacă invitația — și ce se face când angajatul n-are niciuna.
//
// Funcții PURE, fără I/O: apelantul aduce fișa și slug-ul organizației.

/**
 * Domeniul rezervat pentru adresele sintetice.
 *
 * `.intern` e rezervat prin RFC 8375 pentru uz privat, exact ca să nu se poată
 * ciocni vreodată cu un domeniu real. `example.com` ar fi fost o adresă
 * LIVRABILĂ către un server care nu e al nostru, iar `.local` e revendicat de
 * mDNS. Nimic nu pleacă vreodată spre adresele astea.
 */
const DOMENIU_INTERN = "intern";

/** Marca, curățată cât să încapă în partea locală a unei adrese. */
function marcaCurata(marca: string): string {
  const curat = marca
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return curat.length === 0 ? "fara-marca" : curat.slice(0, 40);
}

/**
 * Adresa sintetică a unui angajat fără e-mail: `marca-0042@hala-nord.intern`.
 *
 * ── DE CE EXISTĂ ────────────────────────────────────────────────────────────
 * Contul se creează EXCLUSIV prin invitație, iar Supabase Auth are nevoie de o
 * adresă ca să existe un cont cu parolă: `accept_invitation` rulează CA
 * UTILIZATOR și compară `auth.email()` cu adresa din invitație. O invitație fără
 * adresă n-ar avea cu ce să se potrivească.
 *
 * Deci „fără e-mail" înseamnă, în realitate, „cu un NUME DE UTILIZATOR care
 * arată ca o adresă". Nu se trimite nimic acolo și nu se așteaptă nimic de
 * acolo — invitația ajunge la om pe hârtie, ca link și cod QR.
 *
 * ⚠️ E o decizie de PRODUS: angajatul se va autentifica de acum înainte cu ea,
 * deci trebuie tipărită pe fișă, lângă link.
 */
export function adresaSintetica(marca: string, slugOrganizatie: string): string {
  return `marca-${marcaCurata(marca)}@${slugOrganizatie}.${DOMENIU_INTERN}`;
}

/** `true` dacă adresa a fost fabricată de noi, nu dată de om. */
export function esteAdresaSintetica(email: string): boolean {
  return email.endsWith(`.${DOMENIU_INTERN}`);
}

export type FelAdresa = "personala" | "serviciu" | "sintetica";

export type AlegereAdresa = Readonly<{
  adresa: string;
  fel: FelAdresa;
  /** `false` pentru adresa sintetică: n-are unde ajunge un mesaj. */
  seTrimiteEmail: boolean;
}>;

/**
 * Pe ce adresă se invită angajatul, în ordinea în care contează.
 *
 * PERSONALA prima, deliberat: e a lui, îi rămâne după plecare și e cea pe care o
 * citește. Adresa de serviciu vine a doua — există, dar i se ia înapoi la
 * lichidare, iar o invitație trimisă acolo se pierde exact în ziua în care omul
 * are cel mai mult nevoie de acces la fișele lui.
 *
 * A treia ramură nu e o eroare, e cazul obișnuit pe un șantier: omul n-are
 * adresă. Atunci primește una fabricată și o fișă tipărită.
 */
/**
 * Adresa REALĂ a angajatului, sau `null` dacă n-are niciuna.
 *
 * Ordinea e cea din `alegeAdresaDeInvitatie` — există separat pentru locurile
 * care trebuie să știe DACĂ se poate trimite un mesaj, fără să fabrice o adresă:
 * la înrolare, o invitație sintetică ar consuma un loc din `seats_limit` și ar
 * expira în șapte zile cu un link pe care nu l-a văzut nimeni. Acolo e mai bine
 * un avertisment care trimite omul la fișă, unde fișa tipăribilă chiar se vede.
 */
export function adresaRealaDinFisa(
  fisa: Readonly<{ email_personal: string | null; email_serviciu: string | null }>,
): string | null {
  const personala = fisa.email_personal?.trim() ?? "";
  if (personala.length > 0) return personala.toLowerCase();
  const serviciu = fisa.email_serviciu?.trim() ?? "";
  if (serviciu.length > 0) return serviciu.toLowerCase();
  return null;
}

export function alegeAdresaDeInvitatie(
  fisa: Readonly<{
    marca: string;
    email_personal: string | null;
    email_serviciu: string | null;
  }>,
  slugOrganizatie: string,
): AlegereAdresa {
  const personala = fisa.email_personal?.trim() ?? "";
  if (personala.length > 0) {
    return { adresa: personala.toLowerCase(), fel: "personala", seTrimiteEmail: true };
  }
  const serviciu = fisa.email_serviciu?.trim() ?? "";
  if (serviciu.length > 0) {
    return { adresa: serviciu.toLowerCase(), fel: "serviciu", seTrimiteEmail: true };
  }
  return {
    adresa: adresaSintetica(fisa.marca, slugOrganizatie),
    fel: "sintetica",
    seTrimiteEmail: false,
  };
}
