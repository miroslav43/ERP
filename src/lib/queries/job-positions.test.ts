// src/lib/queries/job-positions.test.ts
import { describe, expect, it } from "vitest";

import {
  filtreazaFunctii,
  imbogateste,
  numaraPeFunctie,
  sorteazaFunctii,
  type FunctieListata,
  type RandFunctie,
} from "./job-positions";
import { filtreFunctiiSchema, type FiltreFunctii } from "@/schemas/job-position";

/**
 * Poarta pe logica nomenclatorului de funcții.
 *
 * `PROGRESS.md` numește lipsa testelor pe `src/lib/queries/` blocajul #3 —
 * „fiecare defect real a scăpat exact de aici”. Fișierul ăsta acoperă partea
 * care se poate testa fără bază: îmbogățirea cu nomenclatorul COR, numărătoarea
 * pe funcție, filtrarea și sortarea. Interogarea propriu-zisă rămâne
 * neacoperită, dar ea nu conține nicio decizie — toate deciziile sunt aici.
 *
 * Codurile COR din fixturi sunt REALE (`251203`, `832201`, `121120`): un cod
 * inventat ar trece prin `ocupatiaDupaCod` întorcând `null`, deci testul ar
 * verifica exact ramura greșită și ar rămâne verde la o regresie.
 */

const FILTRE_GOALE: FiltreFunctii = filtreFunctiiSchema.parse({});

function functie(peste: Partial<RandFunctie> = {}): RandFunctie {
  return {
    id: peste.id ?? "11111111-1111-4111-8111-111111111111",
    cod: peste.cod ?? "F1",
    denumire: peste.denumire ?? "Funcție",
    cod_cor: peste.cod_cor ?? null,
    nivel_studii: peste.nivel_studii ?? null,
    descriere: peste.descriere ?? null,
    activ: peste.activ ?? true,
  };
}

describe("numaraPeFunctie", () => {
  it("grupează angajații pe funcție", () => {
    const harta = numaraPeFunctie([
      { job_position_id: "a" },
      { job_position_id: "b" },
      { job_position_id: "a" },
    ]);
    expect(harta.get("a")).toBe(2);
    expect(harta.get("b")).toBe(1);
  });

  it("ignoră angajații fără funcție atribuită, fără să-i numere la altcineva", () => {
    const harta = numaraPeFunctie([{ job_position_id: null }, { job_position_id: "a" }]);
    expect(harta.size).toBe(1);
    expect(harta.get("a")).toBe(1);
  });
});

describe("imbogateste", () => {
  it("aduce denumirea ocupației din nomenclatorul COR", () => {
    const [rand] = imbogateste([functie({ cod_cor: "251203" })], new Map());
    expect(rand?.ocupatie).toBe("inginer de sistem în informatică");
    expect(rand?.corNecunoscut).toBe(false);
  });

  it("marchează un cod de șase cifre care nu există în Clasificarea Ocupațiilor", () => {
    const [rand] = imbogateste([functie({ cod_cor: "999999" })], new Map());
    expect(rand?.ocupatie).toBeNull();
    expect(rand?.corNecunoscut).toBe(true);
  });

  it("nu confundă lipsa codului cu un cod greșit", () => {
    const [rand] = imbogateste([functie({ cod_cor: null })], new Map());
    expect(rand?.ocupatie).toBeNull();
    expect(rand?.corNecunoscut).toBe(false);
  });

  /**
   * Defectul pe care îl apără: dacă „n-am voie să număr” s-ar traduce în `0`,
   * ecranul ar spune „funcția nu are niciun angajat, se poate dezactiva”
   * tocmai despre o funcție ocupată — iar `dezactiveazaFunctie` ar refuza abia
   * după clic, cu o eroare pe care nimic n-a anunțat-o.
   */
  it("distinge „nu s-a numărat” de „zero angajați”", () => {
    const [fara] = imbogateste([functie()], null);
    expect(fara?.numarAngajati).toBeNull();

    const [cu] = imbogateste([functie()], new Map());
    expect(cu?.numarAngajati).toBe(0);
  });

  it("leagă numărătoarea de funcția potrivită", () => {
    const randuri = imbogateste(
      [functie({ id: "a", denumire: "Sudor" }), functie({ id: "b", denumire: "Șofer" })],
      new Map([["a", 9]]),
    );
    expect(randuri.find((r) => r.id === "a")?.numarAngajati).toBe(9);
    expect(randuri.find((r) => r.id === "b")?.numarAngajati).toBe(0);
  });
});

describe("filtreazaFunctii", () => {
  const toate: readonly FunctieListata[] = imbogateste(
    [
      functie({ id: "a", cod: "F1", denumire: "Șofer", cod_cor: "832201" }),
      functie({ id: "b", cod: "F2", denumire: "Contabil", cod_cor: "121120", activ: false }),
      functie({ id: "c", cod: "F3", denumire: "Muncitor necalificat", cod_cor: null }),
    ],
    new Map(),
  );

  const cu = (peste: Partial<FiltreFunctii>): FiltreFunctii => ({ ...FILTRE_GOALE, ...peste });

  it("fără filtre, întoarce tot", () => {
    expect(filtreazaFunctii(toate, FILTRE_GOALE)).toHaveLength(3);
  });

  it("caută în denumire fără să ceară diacritice", () => {
    expect(filtreazaFunctii(toate, cu({ q: "sofer" })).map((f) => f.id)).toEqual(["a"]);
  });

  it("caută și după codul intern", () => {
    expect(filtreazaFunctii(toate, cu({ q: "F2" })).map((f) => f.id)).toEqual(["b"]);
  });

  it("caută și după codul COR", () => {
    expect(filtreazaFunctii(toate, cu({ q: "832201" })).map((f) => f.id)).toEqual(["a"]);
  });

  /**
   * Motivul pentru care filtrarea nu e în bază: „autoturisme” nu apare în
   * niciun rând din `job_positions`, ci doar în nomenclatorul COR. Un `ilike`
   * în Postgres n-ar fi găsit nimic, deși omul citește cuvântul pe ecran.
   */
  it("caută în denumirea ocupației COR, care nu există în bază", () => {
    expect(filtreazaFunctii(toate, cu({ q: "autoturisme" })).map((f) => f.id)).toEqual(["a"]);
  });

  it("filtrează după stare", () => {
    expect(filtreazaFunctii(toate, cu({ stare: "activa" })).map((f) => f.id)).toEqual(["a", "c"]);
    expect(filtreazaFunctii(toate, cu({ stare: "inactiva" })).map((f) => f.id)).toEqual(["b"]);
  });

  it("izolează funcțiile fără cod COR — cele care blochează REVISAL-ul", () => {
    expect(filtreazaFunctii(toate, cu({ cor: "lipsa" })).map((f) => f.id)).toEqual(["c"]);
  });

  it("combină filtrele, nu le înlocuiește", () => {
    expect(filtreazaFunctii(toate, cu({ q: "co", stare: "inactiva" })).map((f) => f.id)).toEqual([
      "b",
    ]);
  });

  it("un termen care nu se potrivește nicăieri dă listă goală, nu lista întreagă", () => {
    expect(filtreazaFunctii(toate, cu({ q: "zzz" }))).toHaveLength(0);
  });
});

describe("sorteazaFunctii", () => {
  const toate: readonly FunctieListata[] = imbogateste(
    [
      functie({ id: "a", cod: "F10", denumire: "Șofer", cod_cor: "832201" }),
      functie({ id: "b", cod: "F2", denumire: "Sudor", cod_cor: null }),
      functie({ id: "c", cod: "F1", denumire: "Tâmplar", cod_cor: "121120" }),
    ],
    new Map([
      ["a", 3],
      ["b", 3],
      ["c", 1],
    ]),
  );

  /**
   * În alfabetul românesc `Ș` stă între `S` și `T`, dar în tabelul Unicode e
   * U+0218 — mai mare decât ORICE literă neaccentuată. Un `.sort()` fără
   * colator ar fi întors `["Sudor", "Tâmplar", "Șofer"]`, adică ar fi aruncat
   * „Șofer” la coada alfabetului. Asertiunea de mai jos e exact locul unde cele
   * două ordini se deosebesc.
   */
  it("sortează denumirile după regulile limbii române, nu după codul caracterului", () => {
    expect(
      sorteazaFunctii(toate, { cheie: "denumire", directie: "asc" }).map((f) => f.denumire),
    ).toEqual(["Sudor", "Șofer", "Tâmplar"]);

    // Ce ar fi dat comparația implicită, ca diferența să nu fie doar afirmată.
    expect([...toate].map((f) => f.denumire).sort()).toEqual(["Sudor", "Tâmplar", "Șofer"]);
  });

  it("inversează sensul", () => {
    expect(
      sorteazaFunctii(toate, { cheie: "denumire", directie: "desc" }).map((f) => f.denumire),
    ).toEqual(["Tâmplar", "Șofer", "Sudor"]);
  });

  it("sortează codurile interne numeric: F2 înaintea lui F10", () => {
    expect(sorteazaFunctii(toate, { cheie: "cod", directie: "asc" }).map((f) => f.cod)).toEqual([
      "F1",
      "F2",
      "F10",
    ]);
  });

  it("sortează după numărul de angajați", () => {
    expect(
      sorteazaFunctii(toate, { cheie: "angajati", directie: "desc" }).map((f) => f.numarAngajati),
    ).toEqual([3, 3, 1]);
  });

  /**
   * Fără un departajator stabil, cele două funcții cu câte 3 angajați și-ar
   * schimba locul între două randări ale aceleiași pagini.
   */
  it("departajează egalitățile prin denumire, în ambele sensuri", () => {
    expect(
      sorteazaFunctii(toate, { cheie: "angajati", directie: "desc" }).map((f) => f.denumire),
    ).toEqual(["Sudor", "Șofer", "Tâmplar"]);
    expect(
      sorteazaFunctii(toate, { cheie: "angajati", directie: "asc" }).map((f) => f.denumire),
    ).toEqual(["Tâmplar", "Sudor", "Șofer"]);
  });

  it("ține funcțiile fără cod COR la coadă, nu amestecate printre celelalte", () => {
    expect(sorteazaFunctii(toate, { cheie: "cor", directie: "asc" }).map((f) => f.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("nu modifică lista primită", () => {
    const original = [...toate];
    sorteazaFunctii(toate, { cheie: "cod", directie: "desc" });
    expect(toate).toEqual(original);
  });
});
