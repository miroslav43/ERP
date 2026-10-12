import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXCEPTII_FISCALE,
  LOCURI_MAXIME_LIMITARE,
  MASA_MAXIMA_LIMITARE_KG,
  PROCENT_AVANTAJ_LUNAR,
  REGIMURI_FISCALE,
  REGIMURI_IMPOZITARE,
  TITLURI_FOLOSINTA,
  avertismenteRegim,
  cereFoaie,
  esteMasinaPersonala,
  mutaLuna,
  perioadaLa,
  procentDeducere,
  proportiePeKm,
  regimSugerat,
  sugereazaAvantaj,
  ultimaZiALunii,
  verdictLuna,
  type FapteAvantaj,
  type LunaVehicul,
} from "./fiscal";

describe("nomenclatoarele", () => {
  it("oglindesc enum-urile din 0205", () => {
    expect(REGIMURI_FISCALE).toEqual([
      "limitat_50",
      "integral_exclusiv_economic",
      "exceptat_categorie",
      "peste_3500_sau_9_locuri",
    ]);
    expect(EXCEPTII_FISCALE).toHaveLength(5);
    expect(TITLURI_FOLOSINTA).toContain("comodat");
    expect(PROCENT_AVANTAJ_LUNAR).toBe(1.7);
  });
});

describe("oglinda migrării 0205", () => {
  const migrare = readFileSync(
    join(process.cwd(), "supabase/migrations/0205_flota_fiscal.sql"),
    "utf8",
  );

  /** Migrarea fără comentariile SQL: unele conțin paranteze (art. 25 alin. (3)). */
  const faraComentarii = migrare.replace(/--[^\n]*/gu, "");

  /** Valorile unui `create type … as enum (...)`. */
  function valoriEnum(nume: string): string[] {
    const potrivire = new RegExp(`create type public\\.${nume} as enum \\(([^)]*)\\)`, "u").exec(
      faraComentarii,
    );
    if (potrivire === null) throw new Error(`enum-ul ${nume} lipsește din 0205`);
    return [...(potrivire[1] ?? "").matchAll(/'([a-z0-9_]+)'/gu)].map((m) => m[1] as string);
  }

  it("cele patru enum-uri din domeniu sunt cele din bază, în aceeași ordine", () => {
    expect(valoriEnum("vehicle_fiscal_regime")).toEqual([...REGIMURI_FISCALE]);
    expect(valoriEnum("vehicle_exceptie_fiscala")).toEqual([...EXCEPTII_FISCALE]);
    expect(valoriEnum("vehicle_titlu_folosinta")).toEqual([...TITLURI_FOLOSINTA]);
    expect(valoriEnum("regim_impozitare")).toEqual([...REGIMURI_IMPOZITARE]);
  });

  it("pragurile legale din trigger sunt cele din domeniu", () => {
    expect(migrare).toContain(`masa_maxima_kg <= ${String(MASA_MAXIMA_LIMITARE_KG)}`);
    expect(migrare).toContain(`numar_locuri <= ${String(LOCURI_MAXIME_LIMITARE)}`);
  });

  it("norma are aceeași plajă ca instantaneul foii: peste 0, cel mult 300", () => {
    expect(migrare).toContain("check (l_100km > 0 and l_100km <= 300)");
  });
});

describe("procentDeducere și cereFoaie", () => {
  it("doar regimul limitat dă 50% și nu cere foaie", () => {
    expect(procentDeducere("limitat_50")).toBe(50);
    expect(cereFoaie("limitat_50")).toBe(false);
    for (const r of REGIMURI_FISCALE.filter((x) => x !== "limitat_50")) {
      expect(procentDeducere(r)).toBe(100);
      expect(cereFoaie(r)).toBe(true);
    }
  });

  it("mașina personală e comodatul și chiria de la persoana fizică", () => {
    expect(esteMasinaPersonala("comodat")).toBe(true);
    expect(esteMasinaPersonala("chirie_persoana_fizica")).toBe(true);
    expect(esteMasinaPersonala("leasing_financiar")).toBe(false);
  });
});

describe("perioadaLa", () => {
  const perioade = [
    { valabil_de_la: "2026-01-01", id: "a" },
    { valabil_de_la: "2026-06-01", id: "b" },
    { valabil_de_la: "2026-03-01", id: "c" },
  ];

  it("alege perioada cu cel mai mare început ≤ zi, oricum ar fi ordonate", () => {
    expect(perioadaLa(perioade, "2026-05-31")?.id).toBe("c");
    expect(perioadaLa(perioade, "2026-06-01")?.id).toBe("b");
    expect(perioadaLa(perioade, "2026-12-31")?.id).toBe("b");
  });

  it("înainte de prima perioadă: null", () => {
    expect(perioadaLa(perioade, "2025-12-31")).toBeNull();
    expect(perioadaLa([], "2026-01-01")).toBeNull();
  });
});

describe("regimSugerat și avertismenteRegim", () => {
  it("propune regimul de peste 3,5 t sau 9 locuri doar când fișa o spune", () => {
    expect(regimSugerat({ masa_maxima_kg: 7500, numar_locuri: 3, categorie: "camion" })).toBe(
      "peste_3500_sau_9_locuri",
    );
    expect(regimSugerat({ masa_maxima_kg: 2800, numar_locuri: 17, categorie: "microbuz" })).toBe(
      "peste_3500_sau_9_locuri",
    );
    expect(
      regimSugerat({ masa_maxima_kg: 1500, numar_locuri: 5, categorie: "autoturism" }),
    ).toBeNull();
    expect(
      regimSugerat({ masa_maxima_kg: null, numar_locuri: null, categorie: "autoturism" }),
    ).toBeNull();
  });

  it("3.500 kg și 9 locuri exact sunt încă în limitare", () => {
    expect(
      regimSugerat({ masa_maxima_kg: 3500, numar_locuri: 9, categorie: "autoutilitara" }),
    ).toBeNull();
  });

  it("limitarea la 50% pe un vehicul greu: avertisment, nu refuz", () => {
    const a = avertismenteRegim("limitat_50", {
      masa_maxima_kg: 7500,
      numar_locuri: 3,
      categorie: "camion",
    });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/nu i se aplică/u);
  });

  it("regimul greu fără masă și locuri pe fișă cere completarea lor", () => {
    const a = avertismenteRegim("peste_3500_sau_9_locuri", {
      masa_maxima_kg: null,
      numar_locuri: null,
      categorie: "autoutilitara",
    });
    expect(a[0]).toMatch(/masa maximă/u);
  });

  it("remorca primește nota despre vehiculele motorizate", () => {
    const a = avertismenteRegim("limitat_50", {
      masa_maxima_kg: 750,
      numar_locuri: null,
      categorie: "remorca",
    });
    expect(a.some((t) => /motorizate/u.test(t))).toBe(true);
  });

  it("un autoturism limitat la 50% n-are nimic de semnalat", () => {
    expect(
      avertismenteRegim("limitat_50", {
        masa_maxima_kg: 1500,
        numar_locuri: 5,
        categorie: "autoturism",
      }),
    ).toEqual([]);
  });
});

describe("verdictLuna", () => {
  const baza: LunaVehicul = {
    regim: "integral_exclusiv_economic",
    titlu_folosinta: "proprietate",
    zile_luna: 31,
    zile_integral: 31,
    zile_fara_regim: 0,
    foi_aprobate: 0,
    foi_neaprobate: 0,
  };

  it("fără niciun regim în toată luna: nestabilit", () => {
    expect(
      verdictLuna({
        ...baza,
        regim: null,
        titlu_folosinta: null,
        zile_integral: 0,
        zile_fara_regim: 31,
      }).stare,
    ).toBe("nestabilit");
  });

  it("limitat toată luna: foaia nu e cerută", () => {
    const v = verdictLuna({ ...baza, regim: "limitat_50", zile_integral: 0 });
    expect(v.stare).toBe("limitat");
    expect(v.mesaj).toMatch(/nu e cerută/u);
  });

  it("deducere integrală fără nicio foaie: riscul, cu numărul de zile", () => {
    const v = verdictLuna({ ...baza, zile_integral: 21 });
    expect(v.stare).toBe("fara_foi");
    expect(v.ton).toBe("pericol");
    expect(v.mesaj).toContain("21 de zile");
  });

  it("deducere integrală cu foi doar trimise: de aprobat", () => {
    expect(verdictLuna({ ...baza, foi_neaprobate: 2 }).stare).toBe("foi_neaprobate");
  });

  it("deducere integrală cu foi aprobate: acoperit, cu foile rămase de aprobat în mesaj", () => {
    const v = verdictLuna({ ...baza, foi_aprobate: 12, foi_neaprobate: 1 });
    expect(v.stare).toBe("acoperit");
    expect(v.mesaj).toContain("12 foi aprobate");
    expect(v.mesaj).toContain("o foaie");
  });

  it("zilele fără regim din lună se spun separat", () => {
    const v = verdictLuna({ ...baza, zile_integral: 10, zile_fara_regim: 21, foi_aprobate: 3 });
    expect(v.mesaj).toContain("21 de zile fără regim");
  });
});

describe("sugereazaAvantaj", () => {
  const fapte: FapteAvantaj = {
    vehicul_nr: "B-01-ABC",
    regim: "exceptat_categorie",
    titlu_folosinta: "proprietate",
    valoare_intrare: 85000,
    chirie_lunara: null,
    regim_impozitare: "profit",
  };

  it("1,7% pe lună din valoarea de intrare, rotunjit la bani", () => {
    const s = sugereazaAvantaj(fapte);
    expect(s.fel).toBe("sugestie");
    if (s.fel !== "sugestie") return;
    expect(s.valoareLunara).toBe(1445);
    expect(s.baza).toBe("valoare_intrare");
    expect(s.temei).toMatch(/pct\. 12 alin\. \(5\) lit\. a\)/u);
    expect(s.avertismente).toEqual([]);
  });

  it("rotunjirea e la doi bani, nu la leu", () => {
    const s = sugereazaAvantaj({ ...fapte, valoare_intrare: 12345.67 });
    expect(s.fel === "sugestie" ? s.valoareLunara : null).toBe(209.88);
  });

  it("firma fără regim de impozitare: incomplet, nimic calculat", () => {
    expect(sugereazaAvantaj({ ...fapte, regim_impozitare: null }).fel).toBe("incomplet");
  });

  it("micro și impozit specific: neimpozabil (art. 76 alin. (4) lit. ț^1))", () => {
    for (const r of ["micro", "specific"] as const) {
      const s = sugereazaAvantaj({ ...fapte, regim_impozitare: r });
      expect(s.fel).toBe("neaplicabil");
      if (s.fel === "neaplicabil") expect(s.temei).toMatch(/ț\^1\)/u);
    }
  });

  it("micro cu un vehicul peste 3.500 kg: tot neaplicabil, dar cu avertismentul că lit. ț^1) nu-l acoperă literal", () => {
    const s = sugereazaAvantaj({
      ...fapte,
      regim: "peste_3500_sau_9_locuri",
      regim_impozitare: "micro",
    });
    expect(s.fel).toBe("neaplicabil");
    if (s.fel === "neaplicabil") expect(s.motiv).toMatch(/3\.500 kg/u);
    const obisnuit = sugereazaAvantaj({ ...fapte, regim_impozitare: "micro" });
    if (obisnuit.fel === "neaplicabil") expect(obisnuit.motiv).not.toMatch(/Atenție/u);
  });

  it("regimul limitat la 50%: neimpozabil (art. 76 alin. (4) lit. ț))", () => {
    const s = sugereazaAvantaj({ ...fapte, regim: "limitat_50" });
    expect(s.fel).toBe("neaplicabil");
    if (s.fel === "neaplicabil") expect(s.temei).toMatch(/lit\. ț\)/u);
  });

  it("vehiculul fără regim fiscal: incomplet", () => {
    expect(sugereazaAvantaj({ ...fapte, regim: null, titlu_folosinta: null }).fel).toBe(
      "incomplet",
    );
  });

  it("mașina personală (comodat, chirie de la persoana fizică): nu e bunul firmei", () => {
    for (const t of ["comodat", "chirie_persoana_fizica"] as const) {
      expect(sugereazaAvantaj({ ...fapte, titlu_folosinta: t }).fel).toBe("neaplicabil");
    }
  });

  it("vehiculul închiriat: avantajul e chiria", () => {
    const s = sugereazaAvantaj({ ...fapte, titlu_folosinta: "inchiriat", chirie_lunara: 1200 });
    expect(s.fel).toBe("sugestie");
    if (s.fel !== "sugestie") return;
    expect(s.baza).toBe("chirie");
    expect(s.valoareLunara).toBe(1200);
    expect(s.procent).toBeNull();
  });

  it("închiriat fără chirie completată: incomplet", () => {
    expect(sugereazaAvantaj({ ...fapte, titlu_folosinta: "inchiriat" }).fel).toBe("incomplet");
  });

  it("leasingul operațional e tratat ca închiriere, cu avertisment de confirmat", () => {
    const s = sugereazaAvantaj({
      ...fapte,
      titlu_folosinta: "leasing_operational",
      chirie_lunara: 900,
    });
    expect(s.fel === "sugestie" ? s.avertismente.join(" ") : "").toMatch(/contabilul/u);
  });

  it("fără valoarea de intrare: incomplet", () => {
    expect(sugereazaAvantaj({ ...fapte, valoare_intrare: null }).fel).toBe("incomplet");
  });

  it("„exclusiv economic” cu folosință personală: sugestie plus avertismentul contradicției", () => {
    const s = sugereazaAvantaj({ ...fapte, regim: "integral_exclusiv_economic" });
    expect(s.fel).toBe("sugestie");
    if (s.fel === "sugestie") expect(s.avertismente[0]).toMatch(/contrazice/u);
  });
});

describe("proportiePeKm", () => {
  it("proporționează avantajul pe km personali din total (pct. 12 alin. (6) lit. a))", () => {
    expect(proportiePeKm(1445, 300, 1200)).toBe(361.25);
  });

  it("fără total sau cu cifre imposibile: null", () => {
    expect(proportiePeKm(1445, 10, 0)).toBeNull();
    expect(proportiePeKm(1445, -1, 100)).toBeNull();
    expect(proportiePeKm(1445, 200, 100)).toBeNull();
  });
});

describe("luna paginii fiscale", () => {
  it("mutaLuna trece peste granița anului în ambele sensuri", () => {
    expect(mutaLuna("2026-10", 1)).toBe("2026-11");
    expect(mutaLuna("2026-12", 1)).toBe("2027-01");
    expect(mutaLuna("2026-01", -1)).toBe("2025-12");
    expect(mutaLuna("2026-03", -14)).toBe("2025-01");
    expect(mutaLuna("2026-03", 0)).toBe("2026-03");
  });

  it("ultimaZiALunii știe lunile scurte și anul bisect", () => {
    expect(ultimaZiALunii("2026-02")).toBe("2026-02-28");
    expect(ultimaZiALunii("2028-02")).toBe("2028-02-29");
    expect(ultimaZiALunii("2026-04")).toBe("2026-04-30");
    expect(ultimaZiALunii("2026-12")).toBe("2026-12-31");
  });
});
