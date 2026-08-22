/**
 * Datele de contact reale, într-un singur loc.
 *
 * Apar în trei locuri pe pagină — banda de contact, subsolul și datele
 * structurate pentru motoarele de căutare — și n-au voie să difere între ele.
 */
export const CONTACT = {
  telefon: "0767 991 625",
  telefonLegatura: "tel:+40767991625",
  email: "maleticimiroslavzvonco@gmail.com",
} as const;

/**
 * Adresa publică a site-ului. Se coace la BUILD, nu la pornire: schimbarea
 * domeniului cere o imagine nouă, nu doar un restart. Rezerva există ca build-ul
 * să nu cadă când variabila lipsește (de exemplu în integrarea continuă).
 */
export const ADRESA_SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://administrativo.ro";
