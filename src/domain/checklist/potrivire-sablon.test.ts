// src/domain/checklist/potrivire-sablon.test.ts
import { describe, expect, it } from "vitest";

import { alegeSablon, type SablonPotrivibil } from "./potrivire-sablon";

/**
 * Cele patru forme pe care le poate lua un șablon de integrare: fără nicio
 * restricție, restrâns la un departament, restrâns la o ocupație, sau la
 * amândouă.
 */
const SABLOANE: readonly SablonPotrivibil[] = [
  { id: "generic", denumire: "Integrare standard", department_id: null, cod_cor: null },
  { id: "dep", denumire: "Integrare Producție", department_id: "d1", cod_cor: null },
  { id: "cor", denumire: "Integrare sudori", department_id: null, cod_cor: "721208" },
  { id: "ambele", denumire: "Sudori în Producție", department_id: "d1", cod_cor: "721208" },
];

describe("alegeSablon", () => {
  it("alege șablonul cel mai specific când se potrivesc mai multe", () => {
    const ales = alegeSablon(SABLOANE, { department_id: "d1", cod_cor: "721208" });
    expect(ales?.id).toBe("ambele");
  });

  /**
   * Ocupația bate departamentul: un șablon de instruire pentru sudori se aplică
   * sudorului indiferent unde e repartizat, pe când unul de departament e o
   * regulă de organizare. Aceeași ordine ca înainte de migrarea 0110, când
   * discriminantul era `job_position_id`.
   */
  it("codul COR cântărește mai mult decât departamentul", () => {
    const ales = alegeSablon(SABLOANE, { department_id: "d2", cod_cor: "721208" });
    expect(ales?.id).toBe("cor");
  });

  it("cade pe șablonul generic când nimic specific nu se potrivește", () => {
    const ales = alegeSablon(SABLOANE, { department_id: "d9", cod_cor: "111101" });
    expect(ales?.id).toBe("generic");
  });

  /**
   * Cazul real de azi: pe baza de producție, toți cei 8 angajați cu funcție au
   * `cod_cor` NULL, fiindcă nomenclatorul n-a fost niciodată completat. O fișă
   * fără cod NU trebuie să prindă un șablon legat de o ocupație — altfel toată
   * lumea ar primi instruirea sudorilor.
   */
  it("o fișă fără cod COR nu prinde un șablon legat de o ocupație", () => {
    const ales = alegeSablon(SABLOANE, { department_id: null, cod_cor: null });
    expect(ales?.id).toBe("generic");
  });

  it("o fișă fără cod COR prinde totuși șablonul departamentului ei", () => {
    const ales = alegeSablon(SABLOANE, { department_id: "d1", cod_cor: null });
    expect(ales?.id).toBe("dep");
  });

  /**
   * Lista goală nu e o eroare: o firmă care n-a definit niciun șablon nu
   * pornește niciun checklist, iar acțiunea de înrolare adaugă un avertisment.
   * Ce NU are voie să facă e să arunce.
   */
  it("întoarce null pe listă goală, nu aruncă", () => {
    expect(alegeSablon([], { department_id: "d1", cod_cor: "721208" })).toBeNull();
  });

  it("întoarce null când niciun șablon nu se potrivește", () => {
    const doarSpecifice = SABLOANE.filter((s) => s.id !== "generic");
    expect(alegeSablon(doarSpecifice, { department_id: "d9", cod_cor: null })).toBeNull();
  });

  /**
   * La specificitate egală câștigă primul din listă, iar apelantul o ordonează
   * descrescător după `created_at`: o firmă care și-a rescris șablonul vrea
   * varianta nouă, nu pe cea din primul an.
   */
  it("la specificitate egală păstrează ordinea primită", () => {
    const doua: readonly SablonPotrivibil[] = [
      { id: "nou", denumire: "Rescris", department_id: "d1", cod_cor: null },
      { id: "vechi", denumire: "Original", department_id: "d1", cod_cor: null },
    ];
    expect(alegeSablon(doua, { department_id: "d1", cod_cor: null })?.id).toBe("nou");
  });

  it("nu modifică lista primită", () => {
    const copie = [...SABLOANE];
    alegeSablon(SABLOANE, { department_id: "d1", cod_cor: "721208" });
    expect(SABLOANE).toEqual(copie);
  });
});
