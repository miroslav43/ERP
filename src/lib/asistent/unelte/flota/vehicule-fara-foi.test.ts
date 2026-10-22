// src/lib/asistent/unelte/flota/vehicule-fara-foi.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries/flota-asistent", () => ({
  vehiculeFirmei: vi.fn(),
  foiInInterval: vi.fn(),
  regimuriFiscale: vi.fn(),
}));

import {
  foiInInterval,
  regimuriFiscale,
  vehiculeFirmei,
  type VehiculScurt,
} from "@/lib/queries/flota-asistent";

import { destinatiaDupaId } from "../../destinatii";
import { uneltelePermise, verificaAcces } from "../poarta";
import { contextFlota } from "./context-de-test";
import { MENTIUNE_DEDUCERE_INTEGRALA, unealtaVehiculeFaraFoi } from "./vehicule-fara-foi";

const V = (n: number): string => `b${String(n)}000000-0000-4000-8000-000000000000`;

const vehicul = (partial: Partial<VehiculScurt>): VehiculScurt => ({
  id: V(1),
  nr_inmatriculare: "B100AAA",
  status: "activ",
  pool: false,
  km_curent: 0,
  categorie: "autoturism",
  masa_maxima_kg: null,
  consum_mediu_declarat: null,
  data_achizitie: null,
  data_iesire: null,
  ...partial,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(vehiculeFirmei).mockResolvedValue([
    vehicul({ id: V(1), nr_inmatriculare: "B100AAA" }),
    vehicul({ id: V(2), nr_inmatriculare: "B200BBB", status: "in_service" }),
    vehicul({ id: V(3), nr_inmatriculare: "B300CCC", pool: true }),
    // Ieșit din parc înainte de octombrie: nu e în parcul lunii.
    vehicul({ id: V(4), nr_inmatriculare: "B400DDD", status: "vandut", data_iesire: "2026-09-15" }),
  ]);
  vi.mocked(foiInInterval).mockResolvedValue([
    {
      id: "f1",
      vehicle_id: V(2),
      employee_id: "e",
      numar: null,
      data: "2026-10-03",
      status: "draft",
    },
    {
      id: "f2",
      vehicle_id: V(3),
      employee_id: "e",
      numar: "FP-1",
      data: "2026-10-04",
      status: "aprobat",
    },
  ]);
  vi.mocked(regimuriFiscale).mockResolvedValue([
    {
      id: "r1",
      vehicle_id: V(1),
      regim: "integral_exclusiv_economic",
      valabil_de_la: "2026-01-01",
    },
  ]);
});

describe("vehicule_fara_foi — poarta (D4, decizia I-e1)", () => {
  it("doar org_admin și super_admin: managerul vede doar foile echipei", () => {
    expect(verificaAcces(unealtaVehiculeFaraFoi, contextFlota("org_admin")).permis).toBe(true);
    expect(verificaAcces(unealtaVehiculeFaraFoi, contextFlota("super_admin")).permis).toBe(true);
    for (const rol of ["manager", "hr", "employee"] as const) {
      expect(verificaAcces(unealtaVehiculeFaraFoi, contextFlota(rol)).permis, rol).toBe(false);
      expect(uneltelePermise([unealtaVehiculeFaraFoi], contextFlota(rol)), rol).toEqual([]);
    }
  });

  it("parcul întreg nu ajunge: fără foile TUTUROR, răspunsul ar minți despre pool", () => {
    // O firmă care îi dă managerului `vehicles:read = all` dar foile doar pe echipă.
    const ctx = contextFlota("manager", {
      permisiuni: new Map([
        ["vehicles:read", "all"],
        ["trip_sheets:read", "team"],
      ]) as ReturnType<typeof contextFlota>["permisiuni"],
    });
    expect(verificaAcces(unealtaVehiculeFaraFoi, ctx).permis).toBe(false);
  });
});

describe("vehicule_fara_foi — luna curentă", () => {
  it("clasifică, marchează service-ul și pune mențiunea fiscală neutră", async () => {
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), {});
    expect(r.text).toContain(
      "În octombrie 2026 (până azi), 2 vehicule din cele 3 aflate în parc n-au",
    );
    expect(r.text).toContain(`- B100AAA: nicio foaie (deducere integrală) → vehicul.${V(1)}`);
    expect(r.text).toContain(
      `- B200BBB: doar ciorne sau foi respinse, nimic trimis (în service acum) → vehicul.${V(2)}`,
    );
    expect(r.text).not.toContain("B300CCC");
    expect(r.text).not.toContain("B400DDD");
    expect(r.text).toContain(MENTIUNE_DEDUCERE_INTEGRALA);
    // Fără verdict: nicio concluzie despre deducere.
    expect(r.text).not.toMatch(/riscați|pierdeți|nu are justificare/u);
    expect(vi.mocked(foiInInterval).mock.calls[0]?.slice(1, 3)).toEqual([
      "2026-10-01",
      "2026-10-31",
    ]);
  });

  it("destinațiile sunt ale vehiculelor citite, iar referințele există", async () => {
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), {});
    expect((r.destinatiiEfemere ?? []).map((d) => d.id)).toEqual([
      `vehicul.${V(1)}`,
      `vehicul.${V(2)}`,
    ]);
    for (const id of r.referinte ?? []) expect(destinatiaDupaId(id), id).toBeDefined();
  });
});

describe("vehicule_fara_foi — celelalte cazuri", () => {
  it("o lună trecută nu spune „până azi”, iar mențiunea lipsește fără regim integral", async () => {
    vi.mocked(regimuriFiscale).mockResolvedValue([]);
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), {
      an: 2026,
      luna: 9,
    });
    expect(r.text).toContain("În septembrie 2026, ");
    expect(r.text).not.toContain("până azi");
    expect(r.text).not.toContain("HG 1/2016");
  });

  it("o lună din viitor e refuzată fără drum la bază", async () => {
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), {
      an: 2027,
      luna: 1,
    });
    expect(r.text).toContain("n-a început încă");
    expect(vehiculeFirmei).not.toHaveBeenCalled();
  });

  it("parcul gol nu e o listă tăcută", async () => {
    vi.mocked(vehiculeFirmei).mockResolvedValue([]);
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), {});
    expect(r.text).toBe("Firma nu are vehicule în parc în octombrie 2026.");
  });

  it("toate cu foi: o spune, cu numărul vehiculelor", async () => {
    vi.mocked(foiInInterval).mockResolvedValue(
      [1, 2, 3].map((n) => ({
        id: `f${String(n)}`,
        vehicle_id: V(n),
        employee_id: "e",
        numar: "FP",
        data: "2026-10-02",
        status: "trimis" as const,
      })),
    );
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), {});
    expect(r.text).toContain("toate cele 3 vehicule din parc au cel puțin o foaie");
  });

  it("plafonează la 12 rânduri, cu pastile doar pe cele arătate, dar numără tot", async () => {
    vi.mocked(vehiculeFirmei).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) =>
        vehicul({ id: V(i + 10), nr_inmatriculare: `B${String(500 + i)}XYZ` }),
      ),
    );
    vi.mocked(foiInInterval).mockResolvedValue([]);
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), {});
    expect(r.text).toContain("20 de vehicule din cele 20 aflate în parc");
    expect(r.text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(12);
    expect(r.text).toContain("…și încă 8.");
    expect(r.destinatiiEfemere).toHaveLength(12);
  });

  it("un argument nevalid întoarce refuzul, nu o excepție", async () => {
    const r = await unealtaVehiculeFaraFoi.executa(contextFlota("org_admin"), { luna: 13 });
    expect(r.text).toContain("nu sunt valizi");
  });
});
