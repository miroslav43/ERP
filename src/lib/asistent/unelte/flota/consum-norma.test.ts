// src/lib/asistent/unelte/flota/consum-norma.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries/flota-asistent", () => ({ foiInInterval: vi.fn(), normeConsum: vi.fn() }));
vi.mock("@/lib/queries/fleet-rapoarte", () => ({ foiAprobateLuna: vi.fn() }));
vi.mock("@/lib/queries/fleet", () => ({ vehiculeDupaId: vi.fn() }));

import type { FoaieRaport } from "@/domain/fleet/rapoarte";
import { vehiculeDupaId, type RandVehicul } from "@/lib/queries/fleet";
import { foiAprobateLuna } from "@/lib/queries/fleet-rapoarte";
import { foiInInterval, normeConsum } from "@/lib/queries/flota-asistent";

import { verificaAcces } from "../poarta";
import { AVERTISMENT_ATRIBUIRE, unealtaConsumFataDeNorma } from "./consum-norma";
import { contextFlota } from "./context-de-test";

const V1 = "c1111111-1111-4111-8111-111111111111";
const V2 = "c2222222-2222-4222-8222-222222222222";
const V3 = "c3333333-3333-4333-8333-333333333333";

const foaie = (partial: Partial<FoaieRaport>): FoaieRaport => ({
  id: "f",
  vehicle_id: V1,
  employee_id: "ana",
  numar: "FP-1",
  data: "2026-09-10",
  km_parcursi: 620,
  vehicul_nr: "B123ABC",
  vehicul_combustibil: "motorina",
  norma_l_100km: 7,
  alimentari: [{ litri: 49, cost: 350 }],
  ...partial,
});

const vehicul = (id: string, nr: string, declarat: number | null = null): RandVehicul =>
  ({ id, nr_inmatriculare: nr, consum_mediu_declarat: declarat }) as RandVehicul;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(foiAprobateLuna).mockResolvedValue([
    foaie({ id: "a" }),
    foaie({ id: "b" }),
    // B456DEF: 250 km la 20 l = 8 l/100 km față de 6,5 → +23%, notabil și orientativ.
    foaie({
      id: "c",
      vehicle_id: V2,
      vehicul_nr: "B456DEF",
      km_parcursi: 250,
      norma_l_100km: 6.5,
      alimentari: [{ litri: 20, cost: 140 }],
    }),
  ]);
  vi.mocked(foiInInterval).mockResolvedValue([
    {
      id: "t",
      vehicle_id: V1,
      employee_id: "ana",
      numar: "FP-9",
      data: "2026-09-29",
      status: "trimis",
    },
  ]);
  vi.mocked(vehiculeDupaId).mockResolvedValue(
    new Map([
      [V1, vehicul(V1, "B123ABC", 7)],
      [V2, vehicul(V2, "B456DEF", 6.5)],
    ]),
  );
  vi.mocked(normeConsum).mockResolvedValue([]);
});

describe("consum_fata_de_norma — poarta", () => {
  it("org_admin, super_admin și managerul; nu angajatul și nici hr", () => {
    for (const rol of ["super_admin", "org_admin", "manager"] as const) {
      expect(verificaAcces(unealtaConsumFataDeNorma, contextFlota(rol)).permis, rol).toBe(true);
    }
    for (const rol of ["hr", "employee"] as const) {
      expect(verificaAcces(unealtaConsumFataDeNorma, contextFlota(rol)).permis, rol).toBe(false);
    }
  });
});

describe("consum_fata_de_norma — cifrele", () => {
  it("cifrele exacte, cu formula rapoartelor: Σlitri/Σkm și norma ponderată", async () => {
    const r = await unealtaConsumFataDeNorma.executa(contextFlota("org_admin"), {
      an: 2026,
      luna: 9,
    });
    expect(r.text).toContain("Consumul din septembrie 2026, pe toate foile aprobate:");
    expect(r.text).toContain(
      `- B123ABC: 1.240 km, 98 l → 7,9 l/100 km față de norma 7 (+13%) (plus o foaie trimisă, neaprobată) → vehicul.${V1}`,
    );
    // Abaterea notabilă e îngroșată; sub 300 km cifra e orientativă.
    expect(r.text).toContain(
      "- B456DEF: 250 km, 20 l → 8 l/100 km **față de norma 6,5 (+23%)** (cifră orientativă: puțini kilometri)",
    );
    expect(r.text).toContain(AVERTISMENT_ATRIBUIRE);
    expect(r.text).toContain("Mai e o foaie trimisă și neaprobată încă");
    expect(vi.mocked(foiAprobateLuna).mock.calls[0]?.[1]).toEqual({
      deLa: "2026-09-01",
      panaLa: "2026-09-30",
    });
  });

  it("managerul: „pe foile echipei tale”, fără normele F10 (le vede doar `all`)", async () => {
    const r = await unealtaConsumFataDeNorma.executa(contextFlota("manager"), { luna: 9 });
    expect(r.text).toContain("pe foile echipei tale");
    expect(r.text).not.toContain("pe toate foile");
    expect(normeConsum).not.toHaveBeenCalled();
  });

  it("filtrează pe numărul cerut", async () => {
    const r = await unealtaConsumFataDeNorma.executa(contextFlota("org_admin"), {
      luna: 9,
      nr_inmatriculare: "b 456",
    });
    expect(r.text).toContain("B456DEF");
    expect(r.text).not.toContain("B123ABC");
  });

  it("vehiculul invizibil fără instantaneu: „vehicul fără număr vizibil”, fără pastilă", async () => {
    vi.mocked(foiAprobateLuna).mockResolvedValue([
      foaie({ id: "x", vehicle_id: V3, vehicul_nr: null, norma_l_100km: null }),
    ]);
    vi.mocked(foiInInterval).mockResolvedValue([]);
    const r = await unealtaConsumFataDeNorma.executa(contextFlota("manager"), { luna: 9 });
    expect(r.text).toContain("- vehicul fără număr vizibil: 620 km");
    expect(r.text).toContain("fără normă declarată pe 1 foaie, deci abaterea nu se calculează");
    expect(r.text).not.toContain(`vehicul.${V3}`);
    expect(r.destinatiiEfemere).toEqual([]);
  });

  it("instantaneul lipsă ia norma de rezervă și o spune", async () => {
    vi.mocked(foiAprobateLuna).mockResolvedValue([foaie({ id: "x", norma_l_100km: null })]);
    vi.mocked(normeConsum).mockResolvedValue([
      { id: "n", vehicle_id: V1, valabil_de_la: "2026-01-01", l_100km: 8 },
    ]);
    const r = await unealtaConsumFataDeNorma.executa(contextFlota("org_admin"), { luna: 9 });
    expect(r.text).toContain("față de norma 8");
    expect(r.text).toContain("Pe 1 foaie veche fără normă fixată la trimitere");
  });

  it("nicio foaie aprobată: o spune, cu cele trimise", async () => {
    vi.mocked(foiAprobateLuna).mockResolvedValue([]);
    const r = await unealtaConsumFataDeNorma.executa(contextFlota("manager"), { luna: 9 });
    expect(r.text).toBe(
      "În septembrie 2026 nu e nicio foaie aprobată printre foile echipei tale. Mai e o foaie trimisă și neaprobată încă, care nu intră în cifră.",
    );
  });

  it("plafonează la 12 vehicule", async () => {
    vi.mocked(foiAprobateLuna).mockResolvedValue(
      Array.from({ length: 14 }, (_, i) =>
        foaie({
          id: `f${String(i)}`,
          vehicle_id: `v${String(i)}`,
          vehicul_nr: `B${String(100 + i)}AAA`,
        }),
      ),
    );
    vi.mocked(foiInInterval).mockResolvedValue([]);
    vi.mocked(vehiculeDupaId).mockResolvedValue(new Map());
    const r = await unealtaConsumFataDeNorma.executa(contextFlota("org_admin"), { luna: 9 });
    expect(r.text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(12);
    expect(r.text).toContain("…și încă 2.");
  });

  it("refuză luna din viitor și argumentul nevalid, fără drum la bază", async () => {
    expect(
      (await unealtaConsumFataDeNorma.executa(contextFlota("org_admin"), { an: 2026, luna: 11 }))
        .text,
    ).toContain("n-a început încă");
    expect(
      (await unealtaConsumFataDeNorma.executa(contextFlota("org_admin"), { luna: "sept" })).text,
    ).toContain("nu sunt valizi");
    expect(foiAprobateLuna).not.toHaveBeenCalled();
  });
});
