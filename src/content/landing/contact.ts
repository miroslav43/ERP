/**
 * Datele de contact reale, într-un singur loc.
 *
 * Apar în trei locuri pe pagină — banda de contact, subsolul și datele
 * structurate pentru motoarele de căutare — și n-au voie să difere între ele.
 */
export const CONTACT = {
  telefon: "0767 991 625",
  telefonLegatura: "tel:+40767991625",
  email: "contact@administrativo.ro",
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
 * Valorile de mai jos sunt copiate din rândul real al firmei din
 * `public.organizations` (CUI 50321210), nu transcrise din memorie — inclusiv
 * `platitor_tva = false`, care e chiar coloana din bază.
 */
export const FIRMA = {
  denumire: "WISELEARNING S.R.L.",
  strada: "Str. Metalurgiei nr. 2",
  oras: "Timișoara",
  judet: "jud. Timiș",
  codPostal: "300001",
  tara: "România",
  codTara: "RO",
  cui: "50321210",
  /** Numărul de ordine în registrul comerțului. Cerut de L. 365/2002 art. 5. */
  regCom: "J35/2618/2024",
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
