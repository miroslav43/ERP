// src/domain/reges/nomenclator-raspuns.ts
// Citirea identificatorului dintr-un răspuns de creare de nomenclator.
// Modul PUR: fără I/O, ca forma răspunsului să poată fi testată fără rețea.

/**
 * Identificatorul întors de REGES pentru entitatea tocmai creată.
 *
 * Forma răspunsului nu e fixată în documentația pe care o avem — colecția
 * Postman arată `id` pentru unele entități și un șir gol-ambalat pentru altele
 * — deci se acceptă mai multe chei uzuale în loc să se presupună una. Ordinea
 * lor e cea din documentație, nu alfabetică: prima potrivire câștigă.
 *
 * Un răspuns fără niciuna dintre ele întoarce `null`, iar apelantul îl tratează
 * ca EȘEC. O „reușită" fără UUID ar lăsa sporul nereferențiabil și contractele
 * care îl folosesc blocate mai târziu, fără nicio urmă care să explice de ce.
 */
export function idNomenclatorDinRaspuns(date: unknown): string | null {
  if (typeof date === "string" && date.trim() !== "") return date.trim();
  if (typeof date !== "object" || date === null) return null;
  const obiect = date as Record<string, unknown>;
  for (const cheie of ["id", "referinta", "regesId", "reges_id", "uuid"]) {
    const valoare = obiect[cheie];
    if (typeof valoare === "string" && valoare.trim() !== "") return valoare.trim();
  }
  return null;
}
