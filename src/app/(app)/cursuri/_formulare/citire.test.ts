// src/app/(app)/cursuri/_formulare/citire.test.ts
//
// Testul care ar fi prins totul.
//
// Modulul a fost livrat MORT la scriere — material, versiune de fișier,
// atribuire și regulă eșuau întotdeauna, tăcut — iar 1868 de teste au trecut
// peste el. Cauza n-a fost lipsa testelor, ci forma lor: fixture-urile
// construiau obiectul de mână, cu `""` pe câmpurile absente, în timp ce
// componentele trimiteau `null`.
//
// Aici se rulează FUNCȚIA REALĂ pe care o folosește componenta, peste un
// `FormData` construit ca în browser, iar rezultatul intră în EXACT schema pe
// care o primește serverul. Dacă cele două diverg vreodată, testul cade.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  atribuieCursSchema,
  creeazaCursSchema,
  creeazaMaterialSchema,
  creeazaRegulaSchema,
  salveazaVersiuneFisierSchema,
  salveazaVersiuneLinkSchema,
} from "@/schemas/cursuri";

import {
  citesteCurs,
  citesteMaterial,
  citesteVersiuneFisier,
  citesteVersiuneLink,
  intrareAtribuire,
  intrareRegula,
} from "./citire";

const UUID = "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4";

/**
 * `FormData` ca în browser.
 *
 * Regula pe care fixture-ul de dinainte o rata: un control RANDAT dar golit
 * trimite ȘIRUL GOL, iar o bifă DEBIFATĂ e complet absentă. Nu există `null`
 * în `FormData` — el apare abia în obiectul construit de componentă.
 */
function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(campuri)) date.append(cheie, valoare);
  return date;
}

/** Mesajele pe câmp, ca să verificăm CE anume s-a reclamat, nu doar că a picat. */
const erori = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (r.error?.issues ?? []).map((i) => String(i.path[0] ?? ""));

// ═══════════════════════════════════════════════════════════════════════════
// Cursul
// ═══════════════════════════════════════════════════════════════════════════

describe("cursul — ce trimite formularul chiar trece prin schemă", () => {
  const complet = {
    denumire: "Instructaj introductiv",
    cod: "instructaj_intro",
    descriere: "",
    termen_zile: "30",
    valabilitate_luni: "12",
    prag_avertizare_zile: "30",
    obligatoriu: "on",
  };

  it("cazul complet trece", () => {
    const r = creeazaCursSchema.safeParse(citesteCurs(formular(complet)));
    expect(r.success).toBe(true);
  });

  it("VALABILITATEA GOALĂ trece — textul de pe ecran spune „Lăsați gol dacă nu expiră”", () => {
    // Defectul livrat: `optional()` nu accepta `null`, deci exact gestul pe care
    // ecranul îl recomanda era refuzat, cu mesajul „Valabilitatea are cel puțin
    // o lună.” pe un câmp lăsat gol intenționat.
    const r = creeazaCursSchema.safeParse(
      citesteCurs(formular({ ...complet, valabilitate_luni: "" })),
    );
    expect(r.success, erori(r).join(", ")).toBe(true);
    expect(r.success && r.data.valabilitate_luni).toBeNull();
  });

  it("TERMENUL GOL trece și înseamnă „fără termen” (migrarea 0079)", () => {
    const r = creeazaCursSchema.safeParse(citesteCurs(formular({ ...complet, termen_zile: "" })));
    expect(r.success, erori(r).join(", ")).toBe(true);
    expect(r.success && r.data.termen_zile).toBeNull();
  });

  it("PREAVIZUL GOL revine la 30 — e o preferință de afișare, nu o proprietate a cursului", () => {
    const r = creeazaCursSchema.safeParse(
      citesteCurs(formular({ ...complet, prag_avertizare_zile: "" })),
    );
    expect(r.success, erori(r).join(", ")).toBe(true);
    expect(r.success && r.data.prag_avertizare_zile).toBe(30);
  });

  it("bifa debifată e ABSENTĂ din FormData și devine `false`", () => {
    const { obligatoriu: _sters, ...faraBifa } = complet;
    const r = creeazaCursSchema.safeParse(citesteCurs(formular(faraBifa)));
    expect(r.success).toBe(true);
    expect(r.success && r.data.obligatoriu).toBe(false);
  });

  it("refuză în continuare un cod cu majuscule și spații", () => {
    const r = creeazaCursSchema.safeParse(
      citesteCurs(formular({ ...complet, cod: "Instructaj Intro" })),
    );
    expect(r.success).toBe(false);
    expect(erori(r)).toContain("cod");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Materialul — toate patru treptele
// ═══════════════════════════════════════════════════════════════════════════

describe("materialul — toate patru treptele, exact cum le trimite dialogul", () => {
  const baza = { titlu: "Regulament intern", cod: "regulament", descriere: "", transcriere: "" };

  it.each([
    ["bifă", { fel: "pdf", sursa: "fisier", treapta_dovada: "bifa" }],
    [
      "parcurgere măsurată",
      { fel: "video", sursa: "fisier", treapta_dovada: "parcurgere", procent_minim: "80" },
    ],
    ["test grilă", { fel: "pdf", sursa: "fisier", treapta_dovada: "test", prag_test: "70" }],
    [
      "declarație asumată",
      {
        fel: "pdf",
        sursa: "fisier",
        treapta_dovada: "declaratie",
        declaratie_text: "Declar că am citit și am înțeles.",
      },
    ],
  ])("treapta „%s” trece", (_nume, campuri) => {
    // Livrat, TOATE patru eșuau: câmpurile treptelor nealese pleacă `null`, iar
    // `optional()` nu-l accepta. Iar mesajul era invizibil — controlul vinovat
    // nu e randat, deci n-avea unde să apară.
    const r = creeazaMaterialSchema.safeParse(citesteMaterial(formular({ ...baza, ...campuri })));
    expect(r.success, erori(r).join(", ")).toBe(true);
  });

  it("refuză un PDF adus prin link extern", () => {
    const r = creeazaMaterialSchema.safeParse(
      citesteMaterial(formular({ ...baza, fel: "pdf", sursa: "link", treapta_dovada: "bifa" })),
    );
    expect(r.success).toBe(false);
    expect(erori(r)).toContain("sursa");
  });

  it("refuză parcurgerea măsurată pe un film extern — nu deținem filmul", () => {
    const r = creeazaMaterialSchema.safeParse(
      citesteMaterial(
        formular({
          ...baza,
          fel: "video",
          sursa: "link",
          treapta_dovada: "parcurgere",
          procent_minim: "80",
        }),
      ),
    );
    expect(r.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Versiunile
// ═══════════════════════════════════════════════════════════════════════════

describe("versiunea de fișier", () => {
  const incarcare = {
    materialId: UUID,
    cale: `org/courses/${UUID}/v1-abc-regulament.pdf`,
    numeFisier: "regulament.pdf",
    mime: "application/pdf",
  };

  it("un PDF fără durată și fără subtitrare trece", () => {
    // Livrat: `subtitrare_cale: null` și durata goală picau amândouă, DUPĂ ce
    // octeții urcaseră deja — deci fiecare încercare lăsa un obiect orfan.
    const r = salveazaVersiuneFisierSchema.safeParse(
      citesteVersiuneFisier(formular({ numar_pagini: "", nota_versiune: "" }), incarcare),
    );
    expect(r.success, erori(r).join(", ")).toBe(true);
    expect(r.success && r.data.durata_secunde).toBeNull();
    expect(r.success && r.data.subtitrare_cale).toBeNull();
  });

  it("un film cu durată completată trece", () => {
    const r = salveazaVersiuneFisierSchema.safeParse(
      citesteVersiuneFisier(formular({ durata_secunde: "600", nota_versiune: "" }), {
        ...incarcare,
        mime: "video/mp4",
        numeFisier: "film.mp4",
      }),
    );
    expect(r.success, erori(r).join(", ")).toBe(true);
    expect(r.success && r.data.durata_secunde).toBe(600);
  });
});

describe("versiunea de tip link", () => {
  it("un link fără durată trece", () => {
    const r = salveazaVersiuneLinkSchema.safeParse(
      citesteVersiuneLink(
        formular({
          adresa: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          durata_secunde: "",
          nota_versiune: "",
        }),
        UUID,
      ),
    );
    expect(r.success, erori(r).join(", ")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Atribuirea și regulile
// ═══════════════════════════════════════════════════════════════════════════

describe("atribuirea", () => {
  it("trece fără suprascriere de termen", () => {
    // Livrat: `termen: null` pica cu „Invalid input", iar ecranul afișa doar
    // mesajul generic — câmpul nici nu există în formular.
    const r = atribuieCursSchema.safeParse(intrareAtribuire({ cursId: UUID, angajati: [UUID] }));
    expect(r.success, erori(r).join(", ")).toBe(true);
  });

  it("refuză o listă goală de persoane", () => {
    const r = atribuieCursSchema.safeParse(intrareAtribuire({ cursId: UUID, angajati: [] }));
    expect(r.success).toBe(false);
  });
});

describe("regula de atribuire", () => {
  it.each([
    ["toti", ""],
    ["departament", UUID],
    ["functie", UUID],
    ["angajat", UUID],
    ["rol", "manager"],
  ] as const)("criteriul „%s” trece", (criteriu, tinta) => {
    // Livrat: cele patru ținte `null` picau simultan, iar butonul „Aplică acum"
    // rămânea `disabled` pe veci fiindcă nu se putea crea nicio regulă.
    const r = creeazaRegulaSchema.safeParse(
      intrareRegula({ cursId: UUID, criteriu, tinta, decalaj: "0" }),
    );
    expect(r.success, erori(r).join(", ")).toBe(true);
  });

  it("refuză un criteriu fără ținta lui", () => {
    const r = creeazaRegulaSchema.safeParse(
      intrareRegula({ cursId: UUID, criteriu: "departament", tinta: "", decalaj: "0" }),
    );
    expect(r.success).toBe(false);
    expect(erori(r)).toContain("department_id");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Poarta
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fără asta, testele de mai sus măsoară o funcție pe care componentele au
 * încetat s-o folosească — exact felul în care 1868 de teste au trecut peste un
 * modul mort.
 */
describe("componentele nu construiesc singure sarcina acțiunii", () => {
  const RADACINA = join(process.cwd(), "src/app/(app)/cursuri");

  function fisiere(director: string): readonly string[] {
    return readdirSync(director, { withFileTypes: true }).flatMap((intrare) => {
      const cale = join(director, intrare.name);
      if (intrare.isDirectory()) return fisiere(cale);
      return intrare.name.endsWith(".tsx") ? [cale] : [];
    });
  }

  const componente = fisiere(RADACINA).map((cale) => ({
    nume: cale.replace(RADACINA, ""),
    sursa: readFileSync(cale, "utf8"),
  }));

  it("găsește componentele", () => {
    expect(componente.length).toBeGreaterThan(8);
  });

  it.each([
    ["creeazaCurs", "citesteCurs"],
    ["creeazaMaterial", "citesteMaterial"],
    ["salveazaVersiuneFisier", "citesteVersiuneFisier"],
    ["salveazaVersiuneLink", "citesteVersiuneLink"],
    ["atribuieCurs", "intrareAtribuire"],
    ["creeazaRegula", "intrareRegula"],
  ])("`%s` se apelează prin `%s`, nu cu obiect literal", (actiune, citire) => {
    const vinovate = componente
      .filter((c) => new RegExp(`\\b${actiune}\\s*\\(\\s*\\{`, "u").test(c.sursa))
      .map((c) => c.nume);
    expect(
      vinovate,
      `${actiune} primește un obiect literal în: ${vinovate.join(", ")}. ` +
        `Folosește ${citire}() din _formulare/citire.ts — altfel testul de mai sus nu mai măsoară nimic.`,
    ).toEqual([]);
  });
});
