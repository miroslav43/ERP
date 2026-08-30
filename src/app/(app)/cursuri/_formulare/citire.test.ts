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
  actualizeazaMaterialSchema,
  atribuieCursSchema,
  creeazaCursSchema,
  creeazaMaterialSchema,
  creeazaRegulaSchema,
  salveazaVersiuneFisierSchema,
  salveazaVersiuneLinkSchema,
} from "@/schemas/cursuri";

import {
  alegereDinFel,
  citesteCurs,
  citesteMaterialEditat,
  felDinAlegere,
  intrareMaterial,
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

  it("TERMENUL GOL trece și înseamnă „fără termen” (migrarea 0085)", () => {
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

describe("materialul — toate patru treptele, exact cum le trimite asistentul", () => {
  const baza = {
    ales: "pdf" as const,
    cod: "regulament",
    titlu: "Regulament intern",
    descriere: "",
    treapta: "bifa" as const,
    procentMinim: "80",
    pragTest: "70",
    declaratieText: "Declar că am citit și am înțeles.",
    transcriere: "",
    faraVorbire: false,
  };

  it.each([
    ["bifă", { ales: "pdf" as const, treapta: "bifa" as const }],
    ["parcurgere măsurată", { ales: "video_fisier" as const, treapta: "parcurgere" as const }],
    ["test grilă", { ales: "pdf" as const, treapta: "test" as const }],
    ["declarație asumată", { ales: "pdf" as const, treapta: "declaratie" as const }],
  ])("treapta „%s” trece", (_nume, peste) => {
    // Livrat, TOATE patru eșuau: câmpurile treptelor nealese pleacă `null`, iar
    // `optional()` nu-l accepta. Iar mesajul era invizibil — controlul vinovat
    // nu e randat, deci n-avea unde să apară.
    const r = creeazaMaterialSchema.safeParse(intrareMaterial({ ...baza, ...peste }));
    expect(r.success, erori(r).join(", ")).toBe(true);
  });

  it("un PDF nu poate veni din link — alegerea de la pasul 1 le leagă", () => {
    // `felDinAlegere` face imposibilă combinația: nu există card „PDF din link”.
    expect(felDinAlegere("pdf")).toEqual({ fel: "pdf", sursa: "fisier" });
    expect(felDinAlegere("video_link")).toEqual({ fel: "video", sursa: "link" });
  });

  it("refuză parcurgerea măsurată pe un film extern — nu deținem filmul", () => {
    const r = creeazaMaterialSchema.safeParse(
      intrareMaterial({ ...baza, ales: "video_link", treapta: "parcurgere" }),
    );
    expect(r.success).toBe(false);
  });

  it("bifa „fără vorbire” scrie propoziția în transcriere, nu un gol", () => {
    const r = intrareMaterial({ ...baza, ales: "video_fisier", faraVorbire: true });
    expect(r.transcriere).toBe("Filmul nu conține vorbire.");
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
    // Ținta criteriului „funcție" e un cod COR, nu un uuid (0110).
    ["functie", "721208"],
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
// Editarea materialului
// ═══════════════════════════════════════════════════════════════════════════

describe("citesteMaterialEditat", () => {
  /** Formularul de editare, exact cum îl trimite browserul. */
  function formular(peste: Readonly<Record<string, string>> = {}): FormData {
    const date = new FormData();
    date.set("cod", "ssm_general");
    date.set("titlu", "Instructaj general");
    date.set("descriere", "");
    date.set("treapta_dovada", "bifa");
    for (const [cheie, valoare] of Object.entries(peste)) date.set(cheie, valoare);
    return date;
  }

  it("drumul invers al felului acoperă exact combinațiile legale", () => {
    expect(alegereDinFel("pdf", "fisier")).toBe("pdf");
    expect(alegereDinFel("video", "fisier")).toBe("video_fisier");
    expect(alegereDinFel("video", "link")).toBe("video_link");
  });

  it("felul și sursa vin din props, NU din formular", () => {
    // Miezul înghețării: chiar dacă cineva pune câmpurile în DOM, ele nu ajung
    // în sarcină. Singurul drum până la acțiune trece prin argument.
    const date = formular({ fel: "video", sursa: "link" });
    const iesire = citesteMaterialEditat(date, UUID, "pdf");
    expect(iesire.fel).toBe("pdf");
    expect(iesire.sursa).toBe("fisier");
  });

  it("un material editat fără câmpuri de treaptă trece de schemă", () => {
    // Reproducerea defectului original: câmpurile treptelor nealese nu sunt
    // randate, deci pleacă `null`. Cu `optional()` stricat, aici cădea tot.
    const r = actualizeazaMaterialSchema.safeParse(citesteMaterialEditat(formular(), UUID, "pdf"));
    expect(r.success).toBe(true);
  });

  it("descrierea goală devine `null`, nu șir gol", () => {
    const r = actualizeazaMaterialSchema.parse(citesteMaterialEditat(formular(), UUID, "pdf"));
    expect(r.descriere).toBeNull();
  });

  it("bifa „fără vorbire” scrie chiar propoziția în transcriere", () => {
    const date = formular({ transcriere: "ce scrisese omul" });
    date.set("fara_vorbire", "on");
    const r = actualizeazaMaterialSchema.parse(citesteMaterialEditat(date, UUID, "video_fisier"));
    expect(r.transcriere).toBe("Filmul nu conține vorbire.");
  });

  it("o treaptă necunoscută cade pe `bifa`, nu ajunge la server", () => {
    const r = citesteMaterialEditat(formular({ treapta_dovada: "inventat" }), UUID, "pdf");
    expect(r.treapta_dovada).toBe("bifa");
  });

  it("parcurgerea măsurată își duce procentul, iar celelalte praguri rămân goale", () => {
    const date = formular({ treapta_dovada: "parcurgere", procent_minim: "90", prag_test: "70" });
    const r = actualizeazaMaterialSchema.parse(citesteMaterialEditat(date, UUID, "video_fisier"));
    expect(r.procent_minim).toBe(90);
    expect(r.prag_test).toBeNull();
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
    ["creeazaMaterial", "intrareMaterial"],
    ["salveazaVersiuneFisier", "citesteVersiuneFisier"],
    ["salveazaVersiuneLink", "citesteVersiuneLink"],
    ["atribuieCurs", "intrareAtribuire"],
    ["creeazaRegula", "intrareRegula"],
    ["actualizeazaMaterial", "citesteMaterialEditat"],
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
