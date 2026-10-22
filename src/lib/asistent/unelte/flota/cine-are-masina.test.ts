// src/lib/asistent/unelte/flota/cine-are-masina.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries/flota-asistent", () => ({
  vehiculeDupaNumar: vi.fn(),
  foiInInterval: vi.fn(),
  alocarileInceputeInainte: vi.fn(),
  rezervarileZilei: vi.fn(),
  curseleFoilor: vi.fn(),
}));
vi.mock("@/lib/queries/fleet", () => ({ angajatiDupaId: vi.fn() }));

import { momentDinOraRomaniei } from "@/lib/format/date";
import { angajatiDupaId, type AngajatRezumat } from "@/lib/queries/fleet";
import {
  alocarileInceputeInainte,
  curseleFoilor,
  foiInInterval,
  rezervarileZilei,
  vehiculeDupaNumar,
  type VehiculScurt,
} from "@/lib/queries/flota-asistent";

import { verificaAcces } from "../poarta";
import { unealtaCineAreMasina } from "./cine-are-masina";
import { VEHICUL_NEGASIT } from "./comun";
import { contextFlota } from "./context-de-test";

const V = "e1111111-1111-4111-8111-111111111111";
const FOAIE = "f1111111-1111-4111-8111-111111111111";
const ION = "a0000000-0000-4000-8000-000000000001";
const DANA = "a0000000-0000-4000-8000-000000000002";
const STRAIN = "a0000000-0000-4000-8000-000000000003";

const la = (zi: string, ora: string): string => momentDinOraRomaniei(`${zi}T${ora}`) ?? "";

const vehicul = (partial: Partial<VehiculScurt> = {}): VehiculScurt => ({
  id: V,
  nr_inmatriculare: "B123ABC",
  status: "activ",
  pool: false,
  km_curent: 1000,
  categorie: "autoturism",
  masa_maxima_kg: null,
  consum_mediu_declarat: null,
  data_achizitie: null,
  data_iesire: null,
  ...partial,
});
const om = (id: string, nume: string): AngajatRezumat => ({
  id,
  full_name: nume,
  marca: "M",
  deleted_at: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Joi, 22 octombrie 2026, 10:00 ora României.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(la("2026-10-22", "10:00")));
  vi.mocked(vehiculeDupaNumar).mockResolvedValue([vehicul()]);
  vi.mocked(foiInInterval).mockResolvedValue([]);
  vi.mocked(alocarileInceputeInainte).mockResolvedValue([]);
  vi.mocked(rezervarileZilei).mockResolvedValue([]);
  vi.mocked(curseleFoilor).mockResolvedValue([]);
  vi.mocked(angajatiDupaId).mockResolvedValue(
    new Map([
      [ION, om(ION, "Ion Popescu")],
      [DANA, om(DANA, "Dana Ionescu")],
    ]),
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("cine_are_masina — poarta (decizia I-e7)", () => {
  it("org_admin, super_admin și managerul; nu angajatul, nu hr", () => {
    for (const rol of ["super_admin", "org_admin", "manager"] as const) {
      expect(verificaAcces(unealtaCineAreMasina, contextFlota(rol)).permis, rol).toBe(true);
    }
    for (const rol of ["employee", "hr"] as const) {
      expect(verificaAcces(unealtaCineAreMasina, contextFlota(rol)).permis, rol).toBe(false);
    }
  });
});

describe("cine_are_masina — azi", () => {
  it("cursa în desfășurare: șoferul foii, numărul foii și intervalul, fără locuri", async () => {
    vi.mocked(foiInInterval).mockResolvedValue([
      {
        id: FOAIE,
        vehicle_id: V,
        employee_id: ION,
        numar: "FP-2026-0042",
        data: "2026-10-22",
        status: "trimis",
      },
    ]);
    vi.mocked(curseleFoilor).mockResolvedValue([
      // Un câmp de loc strecurat de o citire viitoare nu are voie să ajungă în text.
      {
        id: "c1",
        trip_sheet_id: FOAIE,
        plecare_la: la("2026-10-22", "09:10"),
        sosire_la: la("2026-10-22", "11:30"),
        de_la_loc: "Cluj-Napoca",
      } as never,
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "b123abc",
    });
    expect(r.text).toContain(
      `B123ABC e acum la Ion Popescu, pe FP-2026-0042 → foaie.${FOAIE} (cursa 09:10–11:30).`,
    );
    expect(r.text).not.toContain("Cluj");
    expect(r.text).not.toContain("Verifică pe foaie");
    expect((r.destinatiiEfemere ?? []).map((d) => d.id)).toEqual([
      `vehicul.${V}`,
      `foaie.${FOAIE}`,
    ]);
    // Foile de ieri intră: o cursă de noapte poate acoperi dimineața.
    expect(vi.mocked(foiInInterval).mock.calls[0]?.slice(1, 3)).toEqual([
      "2026-10-21",
      "2026-10-22",
    ]);
  });

  it("fără foaie, alocarea deschisă", async () => {
    vi.mocked(alocarileInceputeInainte).mockResolvedValue([
      { id: "a", employee_id: DANA, de_la: la("2026-10-01", "08:00"), pana_la: null },
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B123ABC",
    });
    expect(r.text).toContain(
      "B123ABC e acum în alocare (șofer: Dana Ionescu, din 01.10.2026, 08:00).",
    );
  });

  it("numele invizibil sub RLS nu se inventează", async () => {
    vi.mocked(alocarileInceputeInainte).mockResolvedValue([
      { id: "a", employee_id: STRAIN, de_la: la("2026-10-01", "08:00"), pana_la: null },
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("manager"), {
      nr_inmatriculare: "B123ABC",
    });
    expect(r.text).toContain("șofer: un angajat la a cărui fișă nu ai acces");
    expect(r.text).toContain(
      "Răspunsul ține cont doar de foile și alocările pe care le poți vedea.",
    );
  });

  it("managerul pe o mașină de pool fără nimic vizibil: „dintre cele pe care le poți vedea”", async () => {
    vi.mocked(vehiculeDupaNumar).mockResolvedValue([vehicul({ pool: true })]);
    const r = await unealtaCineAreMasina.executa(contextFlota("manager"), {
      nr_inmatriculare: "B123ABC",
    });
    expect(r.text).toContain("dintre cele pe care le poți vedea");
    expect(r.text).not.toContain("fără foaie în ziua aceea");
  });

  it("foaia zilei fără cursă acum: „nealocată” doar sub vizibilitate completă", async () => {
    // Mașina comună cu foaia subordonatului, fără cursă la ora asta. Alocarea unui
    // ne-subordonat ar fi invizibilă managerului: „nu e alocată nimănui” ar fi falsă.
    vi.mocked(vehiculeDupaNumar).mockResolvedValue([vehicul({ pool: true })]);
    vi.mocked(foiInInterval).mockResolvedValue([
      {
        id: FOAIE,
        vehicle_id: V,
        employee_id: ION,
        numar: null,
        data: "2026-10-22",
        status: "draft",
      },
    ]);
    const manager = await unealtaCineAreMasina.executa(contextFlota("manager"), {
      nr_inmatriculare: "B123ABC",
    });
    expect(manager.text).toContain("e foaia zilei (șofer: Ion Popescu");
    expect(manager.text).not.toContain("nu e alocată nimănui");
    expect(manager.text).toContain("nicio alocare dintre cele pe care le poți vedea");

    const admin = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B123ABC",
    });
    expect(admin.text).toContain("iar mașina nu e alocată nimănui atunci");
  });

  it("rezervarea zilei se pomenește după alocare", async () => {
    vi.mocked(vehiculeDupaNumar).mockResolvedValue([vehicul({ pool: true })]);
    vi.mocked(rezervarileZilei).mockResolvedValue([
      {
        id: "r",
        employee_id: ION,
        de_la: "2026-10-22",
        pana_la: "2026-10-23",
        status: "confirmata",
      },
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B123ABC",
    });
    expect(r.text).toContain("Rezervare pe ziua aceea: Ion Popescu (confirmată).");
  });
});

describe("cine_are_masina — o zi trecută", () => {
  it("o predare la prânz dă ambele nume, cu orele, și cere verificarea pe foaie", async () => {
    vi.mocked(alocarileInceputeInainte).mockResolvedValue([
      {
        id: "a1",
        employee_id: ION,
        de_la: la("2026-09-01", "08:00"),
        pana_la: la("2026-10-03", "12:00"),
      },
      { id: "a2", employee_id: DANA, de_la: la("2026-10-03", "12:00"), pana_la: null },
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B123ABC",
      data: "2026-10-03",
    });
    expect(r.text).toContain("Pe 03.10.2026, B123ABC apare la:");
    expect(r.text).toContain("- Ion Popescu, alocare din 01.09.2026, 08:00 până la 12:00");
    expect(r.text).toContain("- Dana Ionescu, alocare din 12:00");
    expect(r.text).toContain("spune și ora");
    expect(r.text).toContain("Verifică pe foaie înainte de a răspunde poliției.");
    expect(vi.mocked(alocarileInceputeInainte).mock.calls[0]?.[2]).toBe("2026-10-03T21:00:00.000Z");
  });

  it("cu ora faptei, un singur nume", async () => {
    vi.mocked(alocarileInceputeInainte).mockResolvedValue([
      {
        id: "a1",
        employee_id: ION,
        de_la: la("2026-09-01", "08:00"),
        pana_la: la("2026-10-03", "12:00"),
      },
      { id: "a2", employee_id: DANA, de_la: la("2026-10-03", "12:00"), pana_la: null },
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B123ABC",
      data: "2026-10-03",
      ora: "14:20",
    });
    expect(r.text).toContain(
      "B123ABC era pe 03.10.2026 la ora 14:20 în alocare (șofer: Dana Ionescu",
    );
    expect(r.text).not.toContain("Ion Popescu");
  });

  it("după ieșirea din parc, nu răspunde", async () => {
    vi.mocked(vehiculeDupaNumar).mockResolvedValue([
      vehicul({ status: "vandut", data_iesire: "2026-09-30" }),
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B123ABC",
      data: "2026-10-03",
    });
    expect(r.text).toContain("a ieșit din parc pe 30.09.2026");
    expect(foiInInterval).not.toHaveBeenCalled();
  });
});

describe("cine_are_masina — refuzurile", () => {
  it("o zi din viitor, o zi scrisă greșit, o oră greșită sau încă nevenită", async () => {
    const ctx = contextFlota("org_admin");
    const nr = { nr_inmatriculare: "B123ABC" };
    expect((await unealtaCineAreMasina.executa(ctx, { ...nr, data: "2026-10-23" })).text).toContain(
      "azi sau într-o zi trecută",
    );
    expect((await unealtaCineAreMasina.executa(ctx, { ...nr, data: "03.10.2026" })).text).toContain(
      "AAAA-LL-ZZ",
    );
    expect((await unealtaCineAreMasina.executa(ctx, { ...nr, data: "2026-02-30" })).text).toContain(
      "AAAA-LL-ZZ",
    );
    expect((await unealtaCineAreMasina.executa(ctx, { ...nr, ora: "25:00" })).text).toContain(
      "HH:MM",
    );
    expect((await unealtaCineAreMasina.executa(ctx, { ...nr, ora: "18:00" })).text).toContain(
      "n-a venit încă",
    );
    expect((await unealtaCineAreMasina.executa(ctx, {})).text).toContain("nu sunt valizi");
    expect(vehiculeDupaNumar).not.toHaveBeenCalled();
  });

  it("vehiculul negăsit: „printre cele la care ai acces”", async () => {
    vi.mocked(vehiculeDupaNumar).mockResolvedValue([]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "CJ99ZZZ",
    });
    expect(r.text).toBe(VEHICUL_NEGASIT);
  });

  it("mai multe potriviri: le enumeră și cere alegerea", async () => {
    vi.mocked(vehiculeDupaNumar).mockResolvedValue([
      vehicul({ id: "x1", nr_inmatriculare: "B12ABC" }),
      vehicul({ id: "x2", nr_inmatriculare: "B123XYZ" }),
    ]);
    const r = await unealtaCineAreMasina.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B12",
    });
    expect(r.text).toContain("Care dintre ele?");
    expect(r.text).toContain("- B12ABC");
    expect(r.text).toContain("- B123XYZ");
    expect(foiInInterval).not.toHaveBeenCalled();
  });
});
