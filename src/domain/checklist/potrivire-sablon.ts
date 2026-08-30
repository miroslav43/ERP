// src/domain/checklist/potrivire-sablon.ts
// Care șablon de integrare i se pornește unui angajat nou.
//
// ── DE CE E O FUNCȚIE PURĂ, ȘI NU O RAMURĂ ÎN ACȚIUNE ───────────────────────
// Regula a trăit inline în `inroleazaAngajat` (`angajati/nou/actions.ts`), într-un
// `try` care înghite orice eroare ca să nu strice înrolarea. Adică: netestabilă
// fără o bază, și tăcută dacă alegea greșit. Când migrarea 0110 a mutat
// criteriul de pe `job_position_id` pe `cod_cor`, schimbarea ar fi trecut prin
// singurul loc din tot lanțul care n-avea cum să fie verificat.
//
// ── ORDINEA DE SPECIFICITATE ────────────────────────────────────────────────
// Ocupația (2) cântărește mai mult decât departamentul (1), deci un șablon legat
// de amândouă (3) le bate pe amândouă. Ocupația bate departamentul fiindcă
// instruirea unui sudor îl urmărește oriunde e repartizat, pe când un șablon de
// departament e o regulă de organizare.
//
// La specificitate egală câștigă primul din listă. Apelantul o ordonează
// descrescător după `created_at`: o firmă care și-a rescris șablonul vrea
// varianta nouă, nu pe cea din primul an. `Array.prototype.sort` e stabil, deci
// ordinea primită se păstrează.

export interface SablonPotrivibil {
  readonly id: string;
  readonly denumire: string;
  /** `null` = șablonul nu e restrâns la un departament. */
  readonly department_id: string | null;
  /** `null` = șablonul nu e restrâns la o ocupație. */
  readonly cod_cor: string | null;
}

export interface IncadrareaFisei {
  readonly department_id: string | null;
  readonly cod_cor: string | null;
}

/**
 * Șablonul cel mai specific care se potrivește fișei, sau `null` dacă niciunul
 * nu se potrivește.
 *
 * `null` NU e o eroare: o firmă care n-a definit niciun șablon pur și simplu nu
 * pornește niciun checklist, iar apelantul adaugă un avertisment. De aceea
 * funcția întoarce `null` în loc să arunce — un `throw` aici ar rupe înrolarea
 * pentru o lipsă care nu-i aparține.
 */
export function alegeSablon(
  sabloane: readonly SablonPotrivibil[],
  fisa: IncadrareaFisei,
): SablonPotrivibil | null {
  // Un șablon legat de o ocupație nu se aplică unei fișe FĂRĂ cod COR: pe baza
  // reală de azi, toți angajații au `cod_cor` NULL, iar o potrivire pe „null e
  // ca oricine" le-ar da tuturor instruirea sudorilor.
  const potrivite = sabloane.filter(
    (s) =>
      (s.cod_cor === null || s.cod_cor === fisa.cod_cor) &&
      (s.department_id === null || s.department_id === fisa.department_id),
  );

  const specificitate = (s: SablonPotrivibil): number =>
    (s.cod_cor === null ? 0 : 2) + (s.department_id === null ? 0 : 1);

  // Copia e obligatorie: `sort` mută pe loc, iar lista vine de la apelant.
  return [...potrivite].sort((a, b) => specificitate(b) - specificitate(a))[0] ?? null;
}
