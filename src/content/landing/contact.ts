/**
 * Datele de contact reale, într-un singur loc.
 *
 * Apar în trei locuri pe pagină — banda de contact, subsolul și datele
 * structurate pentru motoarele de căutare — și n-au voie să difere între ele.
 */
export const CONTACT = {
  telefon: "0767 991 625",
  telefonLegatura: "tel:+40767991625",
  // DE MUTAT pe domeniu (contact@administrativo.ro) imediat ce cutia poștală
  // există. Un ERP care cere acces la datele de personal ale unei firme, promovat
  // de pe o adresă personală, pierde la întrebarea „e firmă reală?”. Se schimbă
  // aici, într-un singur loc.
  email: "maleticimiroslavzvonco@gmail.com",
} as const;

/**
 * Identitatea juridică a furnizorului.
 *
 * Legea 365/2002 art. 5 cere denumirea, sediul, codul de înregistrare și datele
 * de contact „în formă clară, vizibil și permanent, în interiorul paginii de
 * web”, pentru orice furnizor de servicii ale societății informaționale —
 * citatul e transcris cu virgulă dedesubt, nu cu sedila din textul oficial —
 * inclusiv în relația pur B2B, fiindcă art. 1 definește destinatarul ca persoană
 * fizică SAU juridică. Sancțiunea, art. 22: 1.000–100.000 lei.
 *
 * LIPSEȘTE numărul de ordine de la registrul comerțului (J35/…/…), care e tot
 * pe lista obligatorie. Se completează înainte de publicare.
 */
export const FIRMA = {
  denumire: "WISELEARNING SRL",
  strada: "Str. Metalurgiei nr. 2",
  oras: "Timișoara",
  judet: "jud. Timiș",
  tara: "România",
  codTara: "RO",
  cui: "50321210",
  /**
   * Firma NU e înregistrată în scopuri de TVA, deci sumele afișate sunt finale.
   * E un avantaj de comunicat, nu o omisiune: concurența afișează prețuri fără
   * TVA, la care cumpărătorul mai adaugă 21%.
   */
  platitorTva: false,
} as const;

/** Adresa completă, într-un singur rând — pentru subsol și pentru JSON-LD. */
export const ADRESA_FIRMA = `${FIRMA.strada}, ${FIRMA.oras}, ${FIRMA.judet}, ${FIRMA.tara}`;

/**
 * Adresa publică a site-ului. Se coace la BUILD, nu la pornire: schimbarea
 * domeniului cere o imagine nouă, nu doar un restart. Rezerva există ca build-ul
 * să nu cadă când variabila lipsește (de exemplu în integrarea continuă).
 */
export const ADRESA_SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://administrativo.ro";
