// src/schemas/cursuri.test.ts
//
// Fiecare `superRefine` din `cursuri.ts` e oglinda unui CHECK din 0075/0078.
// Testele de aici fixează AMBELE capete: ce trece și ce nu. Motivul e practic —
// dacă validarea din cod e mai permisivă decât baza, omul primește un 23514 pe
// care interfața nu-l poate lega de un câmp; dacă e mai strictă, un caz legitim
// devine imposibil fără nicio explicație.

import { describe, expect, it } from "vitest";

import {
  CURS_TREAPTA_DOVADA,
  creeazaMaterialSchema,
  creeazaRegulaSchema,
  salveazaTestSchema,
} from "./cursuri";

const material = (peste: Record<string, unknown>) => ({
  cod: "regulament",
  titlu: "Regulament intern",
  descriere: "",
  fel: "pdf",
  sursa: "fisier",
  treapta_dovada: "bifa",
  procent_minim: "",
  prag_test: "",
  declaratie_text: "",
  transcriere: "",
  ...peste,
});

/** Câmpurile pe care Zod le-a marcat, ca să verificăm CE anume s-a reclamat. */
const campuri = (rezultat: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (rezultat.error?.issues ?? []).map((i) => String(i.path[0] ?? ""));

describe("materialul — oglinda lui course_materials_*_ck", () => {
  it("bifa nu cere nimic în plus", () => {
    expect(creeazaMaterialSchema.safeParse(material({})).success).toBe(true);
  });

  it("un PDF nu poate veni dintr-un link extern", () => {
    const r = creeazaMaterialSchema.safeParse(material({ fel: "pdf", sursa: "link" }));
    expect(r.success).toBe(false);
    expect(campuri(r)).toContain("sursa");
  });

  it("parcurgerea măsurată e doar pentru filme", () => {
    const r = creeazaMaterialSchema.safeParse(
      material({ fel: "pdf", treapta_dovada: "parcurgere", procent_minim: "80" }),
    );
    expect(r.success).toBe(false);
    expect(campuri(r)).toContain("treapta_dovada");
  });

  it("parcurgerea măsurată e imposibilă pe un film extern", () => {
    const r = creeazaMaterialSchema.safeParse(
      material({ fel: "video", sursa: "link", treapta_dovada: "parcurgere", procent_minim: "80" }),
    );
    expect(r.success).toBe(false);
    expect(campuri(r)).toContain("treapta_dovada");
  });

  it("parcurgerea măsurată cere procentul", () => {
    const r = creeazaMaterialSchema.safeParse(
      material({ fel: "video", sursa: "fisier", treapta_dovada: "parcurgere" }),
    );
    expect(r.success).toBe(false);
    expect(campuri(r)).toContain("procent_minim");
  });

  it("un film propriu cu procent trece", () => {
    const r = creeazaMaterialSchema.safeParse(
      material({
        fel: "video",
        sursa: "fisier",
        treapta_dovada: "parcurgere",
        procent_minim: "80",
      }),
    );
    expect(r.success).toBe(true);
  });

  it("testul cere pragul, iar pragul cere testul", () => {
    expect(
      campuri(creeazaMaterialSchema.safeParse(material({ treapta_dovada: "test" }))),
    ).toContain("prag_test");
    expect(
      campuri(
        creeazaMaterialSchema.safeParse(material({ treapta_dovada: "bifa", prag_test: "70" })),
      ),
    ).toContain("prag_test");
    expect(
      creeazaMaterialSchema.safeParse(material({ treapta_dovada: "test", prag_test: "70" }))
        .success,
    ).toBe(true);
  });

  it("declarația cere textul, iar textul cere declarația", () => {
    expect(
      campuri(creeazaMaterialSchema.safeParse(material({ treapta_dovada: "declaratie" }))),
    ).toContain("declaratie_text");
    expect(
      campuri(
        creeazaMaterialSchema.safeParse(
          material({ treapta_dovada: "bifa", declaratie_text: "Declar că am citit." }),
        ),
      ),
    ).toContain("declaratie_text");
  });

  it("codul refuză majuscule și spații — intră în calea din Storage", () => {
    expect(creeazaMaterialSchema.safeParse(material({ cod: "Regulament Intern" })).success).toBe(
      false,
    );
  });

  it("toate cele patru trepte se pot alege", () => {
    expect([...CURS_TREAPTA_DOVADA].sort()).toEqual(
      ["bifa", "declaratie", "parcurgere", "test"].sort(),
    );
  });
});

describe("testul grilă — oglinda cheii de răspuns", () => {
  const intrebare = (peste: Record<string, unknown> = {}) => ({
    id: "q1",
    text: "Purtați cască pe șantier?",
    optiuni: [
      { id: "o1", text: "Da" },
      { id: "o2", text: "Nu" },
    ],
    corect: "o1",
    ...peste,
  });

  it("o întrebare validă trece", () => {
    expect(
      salveazaTestSchema.safeParse({
        version_id: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
        intrebari: [intrebare()],
      }).success,
    ).toBe(true);
  });

  it("varianta corectă trebuie să existe printre variante", () => {
    const r = salveazaTestSchema.safeParse({
      version_id: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
      intrebari: [intrebare({ corect: "o9" })],
    });
    expect(r.success).toBe(false);
  });

  it("o întrebare are cel puțin două variante", () => {
    const r = salveazaTestSchema.safeParse({
      version_id: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
      intrebari: [intrebare({ optiuni: [{ id: "o1", text: "Da" }] })],
    });
    expect(r.success).toBe(false);
  });

  it("identificatorii de întrebare nu se repetă — ar suprascrie cheia", () => {
    const r = salveazaTestSchema.safeParse({
      version_id: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
      intrebari: [intrebare(), intrebare()],
    });
    expect(r.success).toBe(false);
  });

  it("un test gol nu se salvează", () => {
    const r = salveazaTestSchema.safeParse({
      version_id: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
      intrebari: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("regula de atribuire — oglinda lui course_assignment_rules_criteriu_ck", () => {
  const CURS = "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4";
  const TINTA = "774fb27a-98e7-4224-927c-49613223e00d";
  /** Ținta criteriului „funcție" e un COD COR real, nu un uuid (0110). */
  const COD_COR = "721208";

  const regula = (peste: Record<string, unknown>) => ({
    course_id: CURS,
    criteriu: "toti",
    department_id: "",
    cod_cor: "",
    rol: "",
    employee_id: "",
    decalaj_zile: "0",
    termen_zile: "",
    ...peste,
  });

  it("criteriul „toți” nu cere nicio țintă", () => {
    expect(creeazaRegulaSchema.safeParse(regula({})).success).toBe(true);
  });

  it("fiecare criteriu cere exact ținta lui", () => {
    for (const [criteriu, camp, tinta] of [
      ["departament", "department_id", TINTA],
      ["functie", "cod_cor", COD_COR],
      ["angajat", "employee_id", TINTA],
    ] as const) {
      // Fără țintă: pică pe câmpul potrivit.
      const fara = creeazaRegulaSchema.safeParse(regula({ criteriu }));
      expect(fara.success, criteriu).toBe(false);
      expect(campuri(fara), criteriu).toContain(camp);

      // Cu ținta lui: trece.
      expect(
        creeazaRegulaSchema.safeParse(regula({ criteriu, [camp]: tinta })).success,
        criteriu,
      ).toBe(true);
    }
  });

  it("criteriul „rol” cere rolul", () => {
    expect(creeazaRegulaSchema.safeParse(regula({ criteriu: "rol" })).success).toBe(false);
    expect(creeazaRegulaSchema.safeParse(regula({ criteriu: "rol", rol: "manager" })).success).toBe(
      true,
    );
  });

  it("o țintă străină de criteriu e refuzată — altfel regula ar prinde alt set de oameni", () => {
    const r = creeazaRegulaSchema.safeParse(regula({ criteriu: "toti", department_id: TINTA }));
    expect(r.success).toBe(false);
    expect(campuri(r)).toContain("department_id");
  });

  it("două ținte deodată sunt refuzate", () => {
    const r = creeazaRegulaSchema.safeParse(
      regula({ criteriu: "departament", department_id: TINTA, cod_cor: COD_COR }),
    );
    expect(r.success).toBe(false);
  });

  it("decalajul se plafonează la un an", () => {
    expect(creeazaRegulaSchema.safeParse(regula({ decalaj_zile: "366" })).success).toBe(false);
    expect(creeazaRegulaSchema.safeParse(regula({ decalaj_zile: "365" })).success).toBe(true);
  });
});
