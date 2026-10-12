/**
 * Seturile de criterii predefinite, pe tipuri de post.
 *
 * Sunt PUNCTE DE PLECARE, nu „criteriile legale”: Codul muncii lasă criteriile
 * la angajator (art. 40 alin. (1) lit. f)) și cere doar ca ele să fie aduse la
 * cunoștința salariatului și trecute în contract (art. 17 alin. (3) lit. e) și
 * alin. (4)). De aceea fiecare set e scurt (șase criterii), formulat față de
 * fișa postului, cu ponderi rotunde care fac 100 — omul le schimbă după firmă.
 *
 * Pur, fără importuri: îl citesc și pagina, și grila din browser.
 */

export type CheieSet = "general" | "vanzari" | "productie" | "administrativ";

export type CriteriuPonderat = Readonly<{ criteriu: string; pondere: number }>;

export type SetCriterii = Readonly<{
  cheie: CheieSet;
  eticheta: string;
  criterii: readonly CriteriuPonderat[];
}>;

export const SETURI: readonly SetCriterii[] = [
  {
    cheie: "general",
    eticheta: "General (orice post)",
    criterii: [
      { criteriu: "Cunoștințe și competențe profesionale", pondere: 20 },
      { criteriu: "Calitatea muncii", pondere: 20 },
      { criteriu: "Respectarea termenelor", pondere: 15 },
      { criteriu: "Comunicare și lucru în echipă", pondere: 15 },
      { criteriu: "Inițiativă și rezolvarea problemelor", pondere: 15 },
      { criteriu: "Respectarea procedurilor (SSM, regulament intern)", pondere: 15 },
    ],
  },
  {
    cheie: "vanzari",
    eticheta: "Vânzări",
    criterii: [
      { criteriu: "Realizarea obiectivelor de vânzări stabilite pentru perioadă", pondere: 30 },
      { criteriu: "Relația cu clienții și calitatea serviciului", pondere: 20 },
      { criteriu: "Cunoașterea produselor și a ofertei firmei", pondere: 15 },
      { criteriu: "Atragerea de clienți noi", pondere: 15 },
      { criteriu: "Raportarea și evidența vânzărilor", pondere: 10 },
      { criteriu: "Respectarea procedurilor (SSM, regulament intern)", pondere: 10 },
    ],
  },
  {
    cheie: "productie",
    eticheta: "Producție",
    criterii: [
      { criteriu: "Realizarea normei sau a volumului planificat", pondere: 25 },
      { criteriu: "Calitatea execuției (rebuturi, remedieri)", pondere: 25 },
      { criteriu: "Respectarea normelor SSM și purtarea echipamentului de protecție", pondere: 20 },
      { criteriu: "Folosirea și întreținerea utilajelor", pondere: 10 },
      { criteriu: "Disciplina și respectarea programului de lucru", pondere: 10 },
      { criteriu: "Lucrul în echipă și preluarea sarcinilor noi", pondere: 10 },
    ],
  },
  {
    cheie: "administrativ",
    eticheta: "Administrativ (birou)",
    criterii: [
      { criteriu: "Corectitudinea și calitatea lucrărilor", pondere: 25 },
      { criteriu: "Respectarea termenelor", pondere: 20 },
      { criteriu: "Organizarea muncii și stabilirea priorităților", pondere: 15 },
      { criteriu: "Comunicarea cu colegii, clienții și instituțiile", pondere: 15 },
      { criteriu: "Cunoașterea procedurilor și a legislației aplicabile postului", pondere: 15 },
      { criteriu: "Inițiativă și îmbunătățirea modului de lucru", pondere: 10 },
    ],
  },
];

export const SET_IMPLICIT: CheieSet = "general";

/**
 * Setul după cheia din adresă; orice altceva (lipsă, greșit, `constructor`)
 * dă setul general. `find` pe listă, nu indexare într-un obiect: nicio cheie
 * a prototipului nu poate răspunde.
 */
export function setDupaCheie(cheie: string | null): SetCriterii {
  const gasit = SETURI.find((s) => s.cheie === cheie);
  if (gasit !== undefined) return gasit;
  const implicit = SETURI.find((s) => s.cheie === SET_IMPLICIT);
  if (implicit === undefined) throw new Error("Setul implicit lipsește din SETURI.");
  return implicit;
}
