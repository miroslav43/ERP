// src/domain/attendance/sediu.ts
/**
 * Sediul zilei de pontaj (0163).
 *
 * Ziua poartă două coloane, cu sensuri diferite:
 *   · `punct_lucru_id`          — SCANAT din codul QR (0096). E dovadă.
 *   · `punct_lucru_declarat_id` — DECLARAT de om în formular. Nu e dovadă.
 * Sediul efectiv = scanat ?? declarat ?? cel din contract. `null` pe declarat
 * înseamnă „sediul din contract", nu „necunoscut".
 *
 * Regulile stau aici, nu în fiecare formular: sunt două formulare (portalul și
 * dialogul din `/pontaj`) plus acțiunea, iar o regulă scrisă de trei ori
 * diverge exact acolo unde nu se vede.
 */

import type { VerificarePontare } from "./pontare-rapida";

/**
 * Se întreabă sediul doar unde întrebarea are sens:
 *   · firma are cel puțin DOUĂ sedii — cu unul, răspunsul e mereu același;
 *   · firma nu cere codul QR — acolo sediul vine din scanare, nu din declarație.
 */
export function seAlegeSediul(numarSedii: number, verificare: VerificarePontare): boolean {
  return numarSedii >= 2 && verificare !== "cod_qr";
}

/**
 * Sediul se declară doar pentru munca LA SEDIU: „la birou" sau nedeclarat.
 * Homeoffice, deplasare și delegație n-au sediu — baza refuză combinația
 * (`attendance_entries_punct_declarat_ck`).
 */
export function tipulPermiteSediu(tipPrezenta: string | null): boolean {
  return tipPrezenta === null || tipPrezenta === "" || tipPrezenta === "birou";
}

/** Ce se trimite acțiunii: sediul ales, sau `null` când tipul zilei nu-l permite. */
export function sediulDeTrimis(tipPrezenta: string | null, sediu: string): string | null {
  return tipulPermiteSediu(tipPrezenta) && sediu.length > 0 ? sediu : null;
}

export type SursaSediu = "scanat" | "declarat" | "contract";

/** De unde vine sediul zilei — pentru eticheta din ecran. */
export function sursaSediului(zi: {
  readonly punctLucruId: string | null;
  readonly punctLucruDeclaratId: string | null;
}): SursaSediu {
  if (zi.punctLucruId !== null) return "scanat";
  if (zi.punctLucruDeclaratId !== null) return "declarat";
  return "contract";
}

/**
 * Eticheta sediului pentru o zi, sau `null` când n-are ce spune.
 *
 * Doar scanatul și declaratul se scriu: „sediul din contract" pe fiecare zi a
 * lunii ar fi un text care nu spune nimic. Numele vine din lista sediilor; un
 * sediu șters între timp, deci absent din listă, se scrie generic.
 */
export function etichetaSediului(
  zi: { readonly punctLucruId: string | null; readonly punctLucruDeclaratId: string | null },
  denumiri: ReadonlyMap<string, string>,
): string | null {
  const sursa = sursaSediului(zi);
  if (sursa === "contract") return null;
  const id = sursa === "scanat" ? zi.punctLucruId : zi.punctLucruDeclaratId;
  const nume = (id === null ? undefined : denumiri.get(id)) ?? "un sediu inactiv";
  return sursa === "scanat" ? `Scanat la ${nume}` : `Declarat: ${nume}`;
}
