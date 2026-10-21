// src/app/api/export/salarizare/fluturas/route.test.ts
//
// Fluturașul PDF al unui salariat. Generatorul PDF, antetul firmei și numărul
// din registru sunt înlocuite cu spioni: aici se verifică ce CITEȘTE ruta din
// `payroll_entries` și ce LINII dă generatorului — adică exact ce ajunge pe
// document. O coloană uitată din `select` nu produce nicio eroare, doar un
// fluturaș din care lipsește un rând.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant/resolve-tenant", async (orig) => {
  const { stare } = await import("@/lib/teste/actiune");
  return {
    ...(await orig<object>()),
    // `requireTenant` din modulul real își cheamă `resolveTenant` local, deci
    // falsul de la `falsuri.resolveTenant` nu l-ar atinge.
    requireTenant: async () => {
      if (stare.rezolvare.status !== "ok") throw new Error("sesiune lipsă");
      return { user: stare.rezolvare.user, tenant: stare.rezolvare.tenant };
    },
  };
});
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/auth/features", async (orig) => ({
  ...(await orig<object>()),
  requireFeature: async () => undefined,
}));
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);
vi.mock("@/lib/pdf/antet-organizatie", () => ({ antetOrganizatie: vi.fn() }));
vi.mock("@/lib/pdf/fluturas", () => ({ genereazaFluturas: vi.fn() }));
vi.mock("@/lib/registru/document-generat", async (orig) => ({
  ...(await orig<object>()),
  inregistreazaDocumentGenerat: vi.fn(),
}));

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { genereazaFluturas } from "@/lib/pdf/fluturas";
import { inregistreazaDocumentGenerat } from "@/lib/registru/document-generat";
import { configureazaActiunea, ID_1, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import { GET } from "./route";

const ETICHETA_SCUTIRE = "Sumă neimpozabilă (OUG 89/2025 art. III)";
const PDF = new Uint8Array([37, 80, 68, 70]);

const ANTET: AntetOrganizatie = {
  denumire: "Firma Test SRL",
  formaJuridica: "S.R.L.",
  cui: "RO123",
  regCom: "J12/1/2020",
  adresa: "Str. Test 1",
  capitalSocial: 200,
  capitalVarsat: null,
  sistemDualist: false,
  telefon: null,
  email: null,
  pozitie: "antet",
  sigla: null,
};

/** Un rând de salariu la minim, ca în `calc.facilitate.test.ts`: iulie 2026, 4.325 lei. */
function rand(calcBreakdown: unknown) {
  return {
    id: ID_1,
    baza_salariu: 4325,
    suma_ore_suplimentare: 0,
    spor_noapte: 0,
    prime_total: 0,
    valoare_tichete: 0,
    brut: 4325,
    cas: 1031,
    cass: 413,
    deducere_personala: 865,
    scutire_fiscala: 0,
    impozit: 182,
    net: 2699,
    retineri_total: 0,
    net_de_plata: 2699,
    rest_de_plata: 2699,
    zile_lucratoare_luna: 22,
    zile_lucrate: 22,
    zile_concediu_odihna: 0,
    zile_concediu_medical: 0,
    ore_lucrate: 176,
    ore_suplimentare: 0,
    ore_noapte: 0,
    calc_breakdown: calcBreakdown,
    calc_warnings: [],
    perioada: { an: 2026, luna: 7, status: "aprobat" },
    angajat: { full_name: "Ion Pop", marca: "7", functie: "Contabil" },
  };
}

function programeaza(server: ClientFals, randSalariu: unknown): void {
  server.raspunde("payroll_entries", "select", { data: randSalariu });
}

const cere = () =>
  GET(new Request(`https://app.test/api/export/salarizare/fluturas?inregistrare=${ID_1}`));

beforeEach(() => {
  vi.mocked(antetOrganizatie).mockReset().mockResolvedValue(ANTET);
  vi.mocked(genereazaFluturas).mockReset().mockResolvedValue(PDF);
  vi.mocked(inregistreazaDocumentGenerat)
    .mockReset()
    .mockResolvedValue({ ok: true, numarAfisat: "FL-0001" } as never);
});

describe("GET /api/export/salarizare/fluturas", () => {
  it("fără `payroll:read`: 403, fără nicio citire din salarii", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await cere();
    expect(r.status).toBe(403);
    expect(server.apeluriPe("payroll_entries")).toHaveLength(0);
    expect(genereazaFluturas).not.toHaveBeenCalled();
  });

  it("citește `calc_breakdown`, filtrat pe organizație: altfel rândul sumei dispare tăcut din PDF", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:read": "own" } });
    programeaza(server, rand([]));

    const r = await cere();

    expect(r.status).toBe(200);
    const [apel] = server.apeluriPe("payroll_entries");
    expect(apel?.coloane?.split(",").map((c) => c.trim())).toContain("calc_breakdown");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("fluturașul unui salariat la minim poartă rândul sumei neimpozabile, cu suma din calcul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:read": "own" } });
    programeaza(
      server,
      rand([
        { pas: "brut", valoare: 4325 },
        { pas: "sumaNeimpozabila", valoare: 200 },
      ]),
    );

    await cere();

    const date = vi.mocked(genereazaFluturas).mock.calls[0]?.[0];
    expect(date?.retineri).toContainEqual({ eticheta: ETICHETA_SCUTIRE, valoare: 200 });
  });

  it("un rând dinaintea facilității (pașii fără `sumaNeimpozabila`) nu primește rândul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:read": "own" } });
    programeaza(server, rand([{ pas: "brut", valoare: 4325 }]));

    await cere();

    const date = vi.mocked(genereazaFluturas).mock.calls[0]?.[0];
    expect(date).toBeDefined();
    expect(date?.retineri.map((l) => l.eticheta)).not.toContain(ETICHETA_SCUTIRE);
  });
});
