import { describe, expect, it } from "vitest";

import {
  lunaDinParametru,
  normaConsumNouaSchema,
  regimFiscalNouSchema,
  regimImpozitareSchema,
} from "./flota-fiscal";

const VEHICUL = "11111111-1111-4111-8111-111111111111";
const ANGAJAT = "22222222-2222-4222-8222-222222222222";

const regim = (m: Record<string, unknown> = {}) => ({
  vehicle_id: VEHICUL,
  valabil_de_la: "2026-10-01",
  regim: "limitat_50",
  exceptie: "",
  motiv: "Folosit și în interes personal",
  titlu_folosinta: "proprietate",
  proprietar_employee_id: "",
  chirie_lunara: "",
  contract_numar: "",
  contract_data: "",
  ...m,
});

function erori(r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return r.success ? [] : (r.error?.issues.map((i) => i.path.join(".")) ?? []);
}

describe("regimFiscalNouSchema", () => {
  it("golurile formularului devin null", () => {
    const r = regimFiscalNouSchema.parse(regim());
    expect(r).toMatchObject({
      exceptie: null,
      proprietar_employee_id: null,
      chirie_lunara: null,
      contract_numar: null,
      contract_data: null,
    });
  });

  it("categoria exceptată e cerută exact la regimul exceptat", () => {
    expect(erori(regimFiscalNouSchema.safeParse(regim({ regim: "exceptat_categorie" })))).toEqual([
      "exceptie",
    ]);
    expect(
      erori(regimFiscalNouSchema.safeParse(regim({ exceptie: "agenti_vanzari_achizitii" }))),
    ).toEqual(["exceptie"]);
    expect(
      regimFiscalNouSchema.safeParse(
        regim({ regim: "exceptat_categorie", exceptie: "agenti_vanzari_achizitii" }),
      ).success,
    ).toBe(true);
  });

  it("mașina personală cere proprietarul, iar celelalte titluri îl refuză", () => {
    expect(erori(regimFiscalNouSchema.safeParse(regim({ titlu_folosinta: "comodat" })))).toEqual([
      "proprietar_employee_id",
    ]);
    expect(
      erori(regimFiscalNouSchema.safeParse(regim({ proprietar_employee_id: ANGAJAT }))),
    ).toEqual(["proprietar_employee_id"]);
    expect(
      regimFiscalNouSchema.safeParse(
        regim({
          titlu_folosinta: "chirie_persoana_fizica",
          proprietar_employee_id: ANGAJAT,
          chirie_lunara: "500",
        }),
      ).success,
    ).toBe(true);
  });

  it("chiria doar la titlurile cu chirie; „0” e o chirie, nu un gol", () => {
    expect(erori(regimFiscalNouSchema.safeParse(regim({ chirie_lunara: "300" })))).toEqual([
      "chirie_lunara",
    ]);
    const r = regimFiscalNouSchema.parse(
      regim({ titlu_folosinta: "inchiriat", chirie_lunara: "0" }),
    );
    expect(r.chirie_lunara).toBe(0);
  });

  it("motivul e obligatoriu și fără spații de umplutură", () => {
    expect(erori(regimFiscalNouSchema.safeParse(regim({ motiv: "  " })))).toEqual(["motiv"]);
  });

  it("data trebuie să fie o zi reală", () => {
    expect(erori(regimFiscalNouSchema.safeParse(regim({ valabil_de_la: "2026-13-01" })))).toEqual([
      "valabil_de_la",
    ]);
  });
});

describe("normaConsumNouaSchema", () => {
  const norma = (m: Record<string, unknown> = {}) => ({
    vehicle_id: VEHICUL,
    valabil_de_la: "2026-10-01",
    l_100km: "6.5",
    decizie_numar: "",
    decizie_data: "",
    observatii: "",
    ...m,
  });

  it("norma golită spune „lipsește”, nu trece drept zero", () => {
    const r = normaConsumNouaSchema.safeParse(norma({ l_100km: "" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/Scrieți norma/u);
  });

  it("plaja e cea a bazei: (0, 300]", () => {
    expect(normaConsumNouaSchema.safeParse(norma({ l_100km: "0" })).success).toBe(false);
    expect(normaConsumNouaSchema.safeParse(norma({ l_100km: "301" })).success).toBe(false);
    expect(normaConsumNouaSchema.parse(norma()).l_100km).toBe(6.5);
  });
});

describe("regimImpozitareSchema", () => {
  it("golul înseamnă nestabilit", () => {
    expect(regimImpozitareSchema.parse({ regim_impozitare: "" }).regim_impozitare).toBeNull();
    expect(regimImpozitareSchema.parse({ regim_impozitare: "micro" }).regim_impozitare).toBe(
      "micro",
    );
    expect(regimImpozitareSchema.safeParse({ regim_impozitare: "pfa" }).success).toBe(false);
  });
});

describe("lunaDinParametru", () => {
  it("acceptă doar AAAA-LL cu o lună reală", () => {
    expect(lunaDinParametru("2026-08", "2026-10")).toBe("2026-08");
    expect(lunaDinParametru("2026-13", "2026-10")).toBe("2026-10");
    expect(lunaDinParametru(undefined, "2026-10")).toBe("2026-10");
    expect(lunaDinParametru("2026-8", "2026-10")).toBe("2026-10");
  });
});
