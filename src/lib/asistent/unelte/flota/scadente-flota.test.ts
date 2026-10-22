// src/lib/asistent/unelte/flota/scadente-flota.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries/flota-asistent", () => ({
  vehiculeFirmei: vi.fn(),
  documenteCurente: vi.fn(),
  planuriServiceActive: vi.fn(),
  amenziCuTermen: vi.fn(),
}));
vi.mock("@/lib/queries/fleet", () => ({ tipuriDocument: vi.fn() }));

import { tipuriDocument, type TipDocument } from "@/lib/queries/fleet";
import {
  amenziCuTermen,
  documenteCurente,
  planuriServiceActive,
  vehiculeFirmei,
  type VehiculScurt,
} from "@/lib/queries/flota-asistent";

import { destinatiaDupaId } from "../../destinatii";
import { verificaAcces } from "../poarta";
import { ARGUMENTE_NEVALIDE, VEHICUL_NEGASIT } from "./comun";
import { contextFlota } from "./context-de-test";
import { unealtaScadenteFlota } from "./scadente-flota";

const V1 = "a1111111-1111-4111-8111-111111111111";
const V2 = "a2222222-2222-4222-8222-222222222222";
const V3 = "a3333333-3333-4333-8333-333333333333";
const RCA = "d1111111-1111-4111-8111-111111111111";
const ITP = "d2222222-2222-4222-8222-222222222222";
const ROV = "d3333333-3333-4333-8333-333333333333";

const vehicul = (partial: Partial<VehiculScurt>): VehiculScurt => ({
  id: V1,
  nr_inmatriculare: "B123ABC",
  status: "activ",
  pool: false,
  km_curent: 10_000,
  categorie: "autoturism",
  masa_maxima_kg: 1500,
  consum_mediu_declarat: 6,
  data_achizitie: null,
  data_iesire: null,
  ...partial,
});

const tip = (id: string, denumire: string, obligatoriu = false): TipDocument =>
  ({
    id,
    denumire,
    obligatoriu,
    activ: true,
    categorii_aplicabile: null,
    masa_max_kg: null,
  }) as TipDocument;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(vehiculeFirmei).mockResolvedValue([
    vehicul({ id: V1, nr_inmatriculare: "B123ABC" }),
    vehicul({ id: V2, nr_inmatriculare: "B456DEF", status: "in_service", km_curent: 49_500 }),
    vehicul({ id: V3, nr_inmatriculare: "B789GHI", status: "vandut" }),
  ]);
  vi.mocked(documenteCurente).mockResolvedValue([
    { id: "x1", vehicle_id: V1, document_type_id: RCA, expira_la: "2026-11-03", este_curent: true },
    { id: "x2", vehicle_id: V2, document_type_id: ITP, expira_la: "2026-10-01", este_curent: true },
    { id: "x3", vehicle_id: V2, document_type_id: ROV, expira_la: "2027-05-01", este_curent: true },
  ]);
  vi.mocked(tipuriDocument).mockResolvedValue([
    tip(RCA, "RCA"),
    tip(ITP, "ITP"),
    tip(ROV, "Rovinietă", true),
  ]);
  vi.mocked(planuriServiceActive).mockResolvedValue([
    {
      id: "p1",
      vehicle_id: V2,
      denumire: "Schimb ulei",
      activ: true,
      urmatoarea_data: null,
      urmatorii_km: 50_000,
      prag_avertizare_km: 1000,
    },
  ]);
  vi.mocked(amenziCuTermen).mockResolvedValue([
    {
      id: "a1",
      vehicle_id: V1,
      numar_pv: "PV123",
      termen_raspuns: "2026-10-25",
      stadiu: "primita",
      raspuns_trimis_la: null,
    },
    {
      id: "a2",
      vehicle_id: V1,
      numar_pv: "PV999",
      termen_raspuns: "2026-10-24",
      stadiu: "platita",
      raspuns_trimis_la: null,
    },
  ]);
});

describe("scadente_flota — poarta", () => {
  it("e pentru orice rol cu `vehicles:read`, nu și pentru hr", () => {
    for (const rol of ["super_admin", "org_admin", "manager", "employee"] as const) {
      expect(verificaAcces(unealtaScadenteFlota, contextFlota(rol)).permis, rol).toBe(true);
    }
    expect(verificaAcces(unealtaScadenteFlota, contextFlota("hr")).permis).toBe(false);
  });
});

describe("scadente_flota — org_admin în aplicație", () => {
  it("dă cifrele exacte, întâi ce a expirat, cu vehiculul vândut scos", async () => {
    const r = await unealtaScadenteFlota.executa(contextFlota("org_admin"), {});
    const linii = r.text.split("\n").filter((l) => l.startsWith("- "));

    expect(linii[0]).toBe(
      `- B456DEF (în service acum): ITP a expirat pe 01.10.2026 (acum 21 de zile) → vehicul.${V2}`,
    );
    expect(r.text).toContain(`- B123ABC: RCA expiră pe 03.11.2026 (în 12 zile) → vehicul.${V1}`);
    expect(r.text).toContain("lipsește documentul obligatoriu „Rovinietă”");
    expect(r.text).toContain("revizia „Schimb ulei” la 50.000 km: mai sunt 500 km");
    expect(r.text).toContain(
      "termenul de răspuns la amenda cu PV PV123 e pe 25.10.2026 (în 3 zile)",
    );
    // Amenda plătită nu mai are termen care curge.
    expect(r.text).not.toContain("PV999");
    // Vehiculul vândut nici nu se cere bazei.
    expect(vi.mocked(documenteCurente).mock.calls[0]?.[1]).toEqual([V1, V2]);
    expect(r.text).not.toContain("B789GHI");
  });

  it("nu spune niciodată „în regulă”", async () => {
    const r = await unealtaScadenteFlota.executa(contextFlota("org_admin"), { zile: 5 });
    expect(r.text).not.toMatch(/în regulă/u);
  });

  it("destinațiile efemere sunt doar ale vehiculelor citite, iar referințele există", async () => {
    const r = await unealtaScadenteFlota.executa(contextFlota("org_admin"), {});
    const ids = (r.destinatiiEfemere ?? []).map((d) => d.id).sort();
    expect(ids).toEqual([`vehicul.${V1}`, `vehicul.${V2}`].sort());
    for (const id of r.referinte ?? []) expect(destinatiaDupaId(id), id).toBeDefined();
    expect(r.referinte).toContain("flota.amenzi");
  });
});

describe("scadente_flota — angajatul, în portal", () => {
  it("nu cere reviziile și amenzile și nu le pomenește", async () => {
    const r = await unealtaScadenteFlota.executa(contextFlota("employee"), {});
    expect(planuriServiceActive).not.toHaveBeenCalled();
    expect(amenziCuTermen).not.toHaveBeenCalled();
    expect(r.text).not.toContain("revizi");
    expect(r.text).not.toContain("amenzi");
    for (const d of r.destinatiiEfemere ?? []) expect(d.href).toBe("/portal/masina-mea");
    expect(r.referinte).toEqual(["portal.masina"]);
  });
});

describe("scadente_flota — un număr anume", () => {
  it("filtrează pe numărul normalizat", async () => {
    const r = await unealtaScadenteFlota.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "b-123 abc",
    });
    expect(r.text).toContain("B123ABC");
    expect(r.text).not.toContain("B456DEF");
  });

  it("un număr invizibil dă „nu găsesc printre cele la care ai acces”, nu „nu există”", async () => {
    const r = await unealtaScadenteFlota.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "CJ99ZZZ",
    });
    expect(r.text).toBe(VEHICUL_NEGASIT);
    expect(r.text).not.toContain("nu există");
  });

  it("un număr care se normalizează la sub două caractere e refuzat fără drum la bază", async () => {
    const r = await unealtaScadenteFlota.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "--",
    });
    expect(r.text).toContain("destule litere și cifre");
    expect(vehiculeFirmei).not.toHaveBeenCalled();
  });
});

describe("scadente_flota — plafonul și argumentele", () => {
  it("scrie cel mult 12 rânduri și „…și încă N”", async () => {
    vi.mocked(documenteCurente).mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        id: `doc-${String(i)}`,
        vehicle_id: V1,
        document_type_id: RCA,
        expira_la: `2026-11-${String(i + 1).padStart(2, "0")}`,
        este_curent: true,
      })),
    );
    vi.mocked(tipuriDocument).mockResolvedValue([tip(RCA, "RCA")]);
    const r = await unealtaScadenteFlota.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B123",
      zile: 60,
    });
    const linii = r.text.split("\n").filter((l) => l.startsWith("- "));
    expect(linii).toHaveLength(12);
    expect(r.text).toContain("…și încă 4.");
  });

  it("un argument nevalid întoarce refuzul, nu o excepție", async () => {
    await expect(
      unealtaScadenteFlota.executa(contextFlota("org_admin"), { zile: 0 }),
    ).resolves.toBe(ARGUMENTE_NEVALIDE);
    await expect(
      unealtaScadenteFlota.executa(contextFlota("org_admin"), { nr_inmatriculare: 7 }),
    ).resolves.toBe(ARGUMENTE_NEVALIDE);
    expect(vehiculeFirmei).not.toHaveBeenCalled();
  });
});
