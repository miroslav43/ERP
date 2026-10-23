// src/domain/fleet/contabil/articole.test.ts
import { describe, expect, it } from "vitest";

import {
  bazaDinTotal,
  construiesteArticole,
  numarDocument,
  type ArticolContabil,
  type RezultatExport,
} from "./articole";
import { cotaTvaLa } from "./cote-tva";
import { configurare, FIRMA, idTest, linie } from "./test-linii";

const sume = (articole: readonly ArticolContabil[]) =>
  articole.map((a) => [a.rol, a.contDebit, a.contCredit, a.sumaBani] as const);

function singuraInclusa(r: RezultatExport) {
  expect(r.excluse).toEqual([]);
  expect(r.probleme).toEqual([]);
  expect(r.incluse).toHaveLength(1);
  const [inclusa] = r.incluse;
  if (inclusa === undefined) throw new Error("lipsă");
  return inclusa;
}

describe("cotaTvaLa", () => {
  it("19% până la 31.07.2025, 21% de la 01.08.2025; înainte de 2017, nicio cotă", () => {
    expect(cotaTvaLa("2025-07-31")).toBe(19);
    expect(cotaTvaLa("2025-08-01")).toBe(21);
    expect(cotaTvaLa("2017-01-01")).toBe(19);
    expect(cotaTvaLa("2016-12-31")).toBeNull();
  });
});

describe("construiesteArticole — separarea TVA-ului, pe bani întregi", () => {
  it("100,00 lei, 21%, integral → bază 82,64 + TVA 17,36", () => {
    const r = construiesteArticole([linie()], configurare(), FIRMA);
    const inclusa = singuraInclusa(r);
    expect(sume(inclusa.articole)).toEqual([
      ["baza", "6022", "542", 8264],
      ["tva_deductibil", "4426", "542", 1736],
    ]);
    expect(inclusa.regim).toBe("integral");
    expect(inclusa.regimDedus).toBe(false);
    expect(r.totalDebitBani).toBe(10_000);
    expect(r.totalCreditBani).toBe(10_000);
  });

  it("limitat_50, pe cheltuială → trei articole; partea nedeductibilă e articol separat pe 6022", () => {
    const r = construiesteArticole([linie({ regimDeclarat: "limitat_50" })], configurare(), FIRMA);
    expect(sume(singuraInclusa(r).articole)).toEqual([
      ["baza", "6022", "542", 8264],
      ["tva_deductibil", "4426", "542", 868],
      ["tva_nedeductibil", "6022", "542", 868],
    ]);
  });

  it("TVA impar (17,37): deductibilul se rotunjește în jos (8,68), nedeductibilul ia banul (8,69)", () => {
    const r = construiesteArticole(
      [linie({ regimDeclarat: "limitat_50", totalBani: 10_006 })],
      configurare(),
      FIRMA,
    );
    expect(sume(singuraInclusa(r).articole)).toEqual([
      ["baza", "6022", "542", 8269],
      ["tva_deductibil", "4426", "542", 868],
      ["tva_nedeductibil", "6022", "542", 869],
    ]);
  });

  it("cont separat → același articol nedeductibil, pe 635", () => {
    const r = construiesteArticole(
      [linie({ regimDeclarat: "limitat_50" })],
      configurare({ tvaNedeductibila: "cont_separat" }),
      FIRMA,
    );
    expect(sume(singuraInclusa(r).articole)).toEqual([
      ["baza", "6022", "542", 8264],
      ["tva_deductibil", "4426", "542", 868],
      ["tva_nedeductibil", "635", "542", 868],
    ]);
  });

  // Limita proprie, nu cea de 5 s: 40.000 de linii și ~160.000 de `expect`,
  // ~1 s pe mașina liberă, dar 5,2 s pe runner-ul încărcat (staging 39970781251).
  // Invariantul nu se micșorează: tocmai acoperirea plajei întregi e rostul lui.
  it(
    "invariantul pe 10.000 de totaluri (0,01 … 100,00 lei), ambele regimuri și ambele tratamente",
    { timeout: 30_000 },
    () => {
      const linii = Array.from({ length: 10_000 }, (_, i) => i + 1);
      for (const regim of ["integral", "limitat_50"] as const) {
        for (const tvaNedeductibila of ["pe_cheltuiala", "cont_separat"] as const) {
          const r = construiesteArticole(
            linii.map((total, i) =>
              linie({ id: idTest(i + 1), totalBani: total, regimDeclarat: regim }),
            ),
            configurare({ tvaNedeductibila }),
            FIRMA,
          );
          expect(r.incluse).toHaveLength(10_000);
          for (const { linie: l, articole } of r.incluse) {
            expect(articole.reduce((s, a) => s + a.sumaBani, 0)).toBe(l.totalBani);
            for (const a of articole) expect(a.sumaBani).toBeGreaterThan(0);
          }
          expect(r.totalDebitBani).toBe(r.totalCreditBani);
          expect(r.totalDebitBani).toBe((10_000 * 10_001) / 2);
        }
      }
    },
  );

  it("baza din total, pe întregi: rotunjirea aritmetică a lui total / 1,21", () => {
    expect(bazaDinTotal(10_000, 21)).toBe(8264);
    expect(bazaDinTotal(121, 21)).toBe(100);
    expect(bazaDinTotal(1, 21)).toBe(1);
    expect(bazaDinTotal(5000, 0)).toBe(5000);
  });

  it("cota după data liniei: 31.07.2025 → 19%, 01.08.2025 → 21%", () => {
    const r = construiesteArticole(
      [
        linie({ id: idTest(1), data: "2025-07-31", totalBani: 11_900 }),
        linie({ id: idTest(2), data: "2025-08-01", totalBani: 12_100 }),
      ],
      configurare(),
      FIRMA,
    );
    expect(r.incluse.map((i) => [i.cotaProcent, i.bazaBani, i.tvaDeductibilBani])).toEqual([
      [19, 10_000, 1900],
      [21, 10_000, 2100],
    ]);
  });

  it("o dată dinaintea lui 2017 e problemă blocantă, nu o cotă ghicită", () => {
    const veche = linie({ data: "2016-12-31" });
    const r = construiesteArticole([veche], configurare(), FIRMA);
    expect(r.incluse).toEqual([]);
    expect(r.probleme).toHaveLength(1);
    expect(r.probleme[0]?.cod).toBe("cota_necunoscuta");
    expect(r.probleme[0]?.linie.id).toBe(veche.id);
    expect(r.probleme[0]?.detalii).toMatch(/\.$/u);
  });

  it("firma neplătitoare de TVA: un singur articol, totalul pe cheltuială", () => {
    const r = construiesteArticole([linie({ regimDeclarat: "limitat_50" })], configurare(), {
      ...FIRMA,
      platitorTva: false,
    });
    const inclusa = singuraInclusa(r);
    expect(sume(inclusa.articole)).toEqual([["total", "6022", "542", 10_000]]);
    expect(inclusa.regim).toBeNull();
  });

  it("cota „zero” pe o categorie: totalul întreg e bază, fără TVA", () => {
    const r = construiesteArticole(
      [
        linie({
          sursa: "cheltuiala",
          categorie: "taxe_drum",
          sursaAreCui: false,
          cuiFurnizor: null,
        }),
      ],
      configurare({
        coeficientTva: { ...configurare().coeficientTva, taxe_drum: "zero" },
      }),
      FIRMA,
    );
    expect(sume(singuraInclusa(r).articole)).toEqual([["baza", "635", "542", 10_000]]);
  });
});

describe("construiesteArticole — ce intră și ce nu, fiecare cu motivul ei", () => {
  it("suma zero, service (implicit), card de flotă, foaie neaprobată, foaie ștearsă", () => {
    const linii = [
      linie({ id: idTest(1), totalBani: 0 }),
      linie({
        id: idTest(2),
        sursa: "service",
        categorie: "revizie_reparatii",
        sursaAreCui: false,
      }),
      linie({ id: idTest(3), peCardDeFlota: true }),
      linie({ id: idTest(4), stareFoaie: "trimis" }),
      linie({ id: idTest(5), foaieStearsa: true }),
      linie({ id: idTest(6) }),
    ];
    const r = construiesteArticole(linii, configurare(), FIRMA);
    // În ordinea (data, sursa, id): alimentările înaintea service-ului din aceeași zi.
    expect(r.excluse.map((e) => [e.linie.id, e.motiv])).toEqual([
      [idTest(1), "suma_zero"],
      [idTest(3), "card_flota"],
      [idTest(4), "foaie_neaprobata"],
      [idTest(5), "foaie_stearsa"],
      [idTest(2), "service_spv"],
    ]);
    expect(r.incluse.map((i) => i.linie.id)).toEqual([idTest(6)]);
  });

  it("cu `doarAprobate = false`, foaia neaprobată intră; cu `includeService`, și service-ul", () => {
    const linii = [
      linie({ id: idTest(1), stareFoaie: "draft" }),
      linie({
        id: idTest(2),
        sursa: "service",
        categorie: "revizie_reparatii",
        sursaAreCui: false,
      }),
    ];
    const r = construiesteArticole(
      linii,
      configurare({ doarAprobate: false, includeService: true }),
      FIRMA,
    );
    expect(r.excluse).toEqual([]);
    expect(r.incluse.map((i) => i.linie.id)).toEqual([idTest(1), idTest(2)]);
    expect(r.avertismente.some((a) => a.includes("SPV"))).toBe(true);
  });

  it("cardul de flotă bate `doarAprobate = false`: alimentarea plătită cu cardul nu intră niciodată în note", () => {
    const r = construiesteArticole(
      [linie({ peCardDeFlota: true, stareFoaie: "draft" })],
      configurare({ doarAprobate: false }),
      FIRMA,
    );
    expect(r.excluse.map((e) => e.motiv)).toEqual(["card_flota"]);
  });
});

describe("construiesteArticole — regimul de deducere", () => {
  it("F10 bate masa: un vehicul de 5.000 kg declarat `limitat_50` deduce 50%", () => {
    const r = construiesteArticole(
      [
        linie({
          regimDeclarat: "limitat_50",
          vehicul: { id: idTest(), nr: "B1", masaMaximaKg: 5000 },
        }),
      ],
      configurare(),
      FIRMA,
    );
    expect(singuraInclusa(r).regim).toBe("limitat_50");
  });

  it("fără F10, peste 3.500 kg → integral (art. 298 alin. 2), fără avertisment", () => {
    const r = construiesteArticole(
      [linie({ regimDeclarat: null, vehicul: { id: idTest(), nr: "B2", masaMaximaKg: 3501 } })],
      configurare(),
      FIRMA,
    );
    const inclusa = singuraInclusa(r);
    expect(inclusa.regim).toBe("integral");
    expect(inclusa.regimDedus).toBe(true);
    expect(r.avertismente.some((a) => a.includes("B2"))).toBe(false);
  });

  it("fără F10, exact 3.500 kg → regimul implicit, cu avertisment care numește vehiculul", () => {
    const r = construiesteArticole(
      [linie({ regimDeclarat: null, vehicul: { id: idTest(), nr: "B3", masaMaximaKg: 3500 } })],
      configurare(),
      FIRMA,
    );
    expect(singuraInclusa(r).regim).toBe("limitat_50");
    expect(r.avertismente.find((a) => a.includes("B3"))).toMatch(/regim fiscal declarat/u);
  });

  it("regimul implicit `integral` din formular se aplică vehiculului fără regim", () => {
    const r = construiesteArticole(
      [linie({ regimDeclarat: null, vehicul: { id: idTest(), nr: "B4", masaMaximaKg: null } })],
      configurare({ regimImplicit: "integral" }),
      FIRMA,
    );
    expect(singuraInclusa(r).regim).toBe("integral");
  });
});

describe("construiesteArticole — bonul fără CUI și avertismentele fixe", () => {
  it("alimentare fără CUI-ul stației → TVA deductibil zero, tot TVA-ul pe nedeductibil (L13)", () => {
    const r = construiesteArticole([linie({ cuiFurnizor: null })], configurare(), FIRMA);
    expect(sume(singuraInclusa(r).articole)).toEqual([
      ["baza", "6022", "542", 8264],
      ["tva_nedeductibil", "6022", "542", 1736],
    ]);
    expect(r.avertismente.find((a) => a.includes("fără CUI"))).toMatch(/contabilului\.$/u);
  });

  it("cheltuiala (sursă fără câmp de CUI) își separă TVA-ul deductibil, cu avertisment", () => {
    const r = construiesteArticole(
      [linie({ sursa: "cheltuiala", categorie: "parcare", sursaAreCui: false, cuiFurnizor: null })],
      configurare(),
      FIRMA,
    );
    expect(sume(singuraInclusa(r).articole)).toEqual([
      ["baza", "628", "542", 8264],
      ["tva_deductibil", "4426", "542", 1736],
    ]);
    expect(r.avertismente.some((a) => a.includes("Cheltuielile"))).toBe(true);
  });

  it("avertismentele fixe: străinătate, bon + factură, regimul de TVA al firmei", () => {
    const r = construiesteArticole([linie()], configurare(), FIRMA);
    expect(r.avertismente.some((a) => a.includes("afara României"))).toBe(true);
    expect(r.avertismente.some((a) => a.includes("și factură"))).toBe(true);
    expect(r.avertismente.some((a) => a.includes("cel curent al firmei"))).toBe(true);
    for (const a of r.avertismente) expect(a).toMatch(/\.$/u);
  });

  it("același bon pe două foi, apoi același număr și dată la alt furnizor: câte un avertisment", () => {
    const r = construiesteArticole(
      [
        linie({ id: idTest(1), document: "100" }),
        linie({ id: idTest(2), document: "100" }),
        linie({ id: idTest(3), document: "200", cuiFurnizor: "111" }),
        linie({ id: idTest(4), document: "200", cuiFurnizor: "222", furnizor: "Petrom" }),
      ],
      configurare(),
      FIRMA,
    );
    expect(r.avertismente.find((a) => a.includes("„100”"))).toMatch(/de mai multe ori/u);
    expect(r.avertismente.find((a) => a.includes("„200”"))).toMatch(/furnizori diferiți/u);
  });
});

describe("numarDocument (L14)", () => {
  it("bonul de 1–16 caractere rămâne; altfel FL + primele 8 caractere ale id-ului", () => {
    const id = "abcdef01-2222-4333-8444-555555555555";
    expect(numarDocument(linie({ id, document: "4521" }))).toBe("4521");
    expect(numarDocument(linie({ id, document: "12345678901234567" }))).toBe("FLABCDEF01");
    expect(numarDocument(linie({ id, document: null }))).toBe("FLABCDEF01");
    expect(numarDocument(linie({ id, document: "  " }))).toBe("FLABCDEF01");
  });

  it("e determinist: același id dă același număr la două apeluri", () => {
    const l = linie({ document: null });
    expect(numarDocument(l)).toBe(numarDocument({ ...l }));
  });

  it("numărul din articol e cel din L14, iar explicația nu conține numele șoferului (D11)", () => {
    const r = construiesteArticole([linie({ sofer: "Ionescu Maria" })], configurare(), FIRMA);
    for (const a of singuraInclusa(r).articole) {
      expect(a.numarDocument).toBe("4521");
      expect(a.explicatie).not.toContain("Ionescu");
    }
    expect(singuraInclusa(r).articole[0]?.explicatie).toBe(
      "Combustibil B123ABC, bon 4521, OMV Pipera",
    );
  });
});

describe("construiesteArticole — ordinea și erorile de intrare", () => {
  it("liniile ies în ordinea (data, sursa, id), oricum ar veni", () => {
    const r = construiesteArticole(
      [
        linie({ id: idTest(3), data: "2026-10-05" }),
        linie({ id: idTest(2), data: "2026-10-01", sursa: "service", sursaAreCui: false }),
        linie({ id: idTest(1), data: "2026-10-01" }),
      ],
      configurare({ includeService: true }),
      FIRMA,
    );
    expect(r.incluse.map((i) => i.linie.id)).toEqual([idTest(1), idTest(2), idTest(3)]);
  });

  it("aruncă RangeError pe un total care nu e întreg nenegativ", () => {
    expect(() => construiesteArticole([linie({ totalBani: 10.5 })], configurare(), FIRMA)).toThrow(
      RangeError,
    );
    expect(() => construiesteArticole([linie({ totalBani: -1 })], configurare(), FIRMA)).toThrow(
      RangeError,
    );
  });
});
