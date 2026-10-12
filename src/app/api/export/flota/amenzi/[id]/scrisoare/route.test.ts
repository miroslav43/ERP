// src/app/api/export/flota/amenzi/[id]/scrisoare/route.test.ts
//
// Porțile scrisorii de răspuns către autoritate (0203). Scrisoarea poartă CNP-ul
// întreg al unui om, deci porțile contează mai mult decât PDF-ul: fără
// `employees:read = all` ruta nu are voie să citească nimic sensibil, nici măcar
// să cheme `hr_read_sensitive`. Așezarea PDF-ului e în
// `src/lib/pdf/scrisoare-desemnare.test.ts`, conținutul în
// `src/domain/fleet/amenzi.test.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
// Ruta cheamă `requireTenant`, nu `resolveTenant`: falsul din `falsuri` înlocuiește
// doar a doua (o referință în același modul nu trece prin mock), deci aici se
// înlocuiește direct garda, cu tenantul din `configureazaActiunea`.
vi.mock("@/lib/tenant/resolve-tenant", async () => {
  const { stare } = await import("@/lib/teste/actiune");
  return {
    requireTenant: async () => {
      const r = stare.rezolvare;
      if (r.status !== "ok") throw new Error("sesiune neconfigurată în test");
      return { user: r.user, tenant: r.tenant };
    },
  };
});
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
// Aceeași poveste ca la `requireTenant`: `requireFeature` nu trece prin falsul lui
// `getEnabledFeatures` (referință în același modul). Modulul `fleet` e activ.
vi.mock("@/lib/auth/features", async (orig) => ({
  ...(await orig<object>()),
  requireFeature: async () => undefined,
}));
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

const cnpComplet = vi.hoisted(() => vi.fn<(db: unknown, id: string) => Promise<string>>());
vi.mock("@/lib/documents/inrolare", () => ({ cnpComplet }));

const genereaza = vi.hoisted(() =>
  vi.fn<(p: { model: unknown }) => Promise<Uint8Array>>(async () =>
    Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
  ),
);
vi.mock("@/lib/pdf/scrisoare-desemnare", () => ({ genereazaScrisoareDesemnare: genereaza }));

vi.mock("@/lib/pdf/antet-organizatie", () => ({
  antetOrganizatie: async () => ({
    denumire: "Firma Test SRL",
    formaJuridica: "S.R.L.",
    cui: "RO1",
    regCom: null,
    adresa: null,
    capitalSocial: null,
    capitalVarsat: null,
    sistemDualist: false,
    telefon: null,
    email: null,
    pozitie: "antet",
    sigla: null,
  }),
}));

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru } from "@/lib/teste/supabase-fals";

import type { ModelScrisoare } from "@/domain/fleet/amenzi";

import { GET } from "./route";

const AMENDA = ID_1;
const VEHICUL = ID_2;
const SOFER = ID_3;

const PERMISIUNI = { "vehicle_fines:read": "all", "employees:read": "all" } as const;

const randAmenda = {
  id: AMENDA,
  vehicle_id: VEHICUL,
  numar_pv: "PV 12/A",
  data_pv: "2026-10-09",
  constatata_la: "2026-10-09T06:30:00.000Z",
  locul: "DN1, Ploiești",
  fapta: "Depășirea vitezei legale",
  autoritate: "Poliția Rutieră Prahova",
  suma: 580,
  primita_la: "2026-10-11",
  termen_raspuns: "2026-10-19",
  stadiu: "sofer_desemnat",
  sofer_desemnat_id: SOFER,
  desemnat_la: "2026-10-11T10:00:00.000Z",
  raspuns_trimis_la: null,
  raspuns_numar: null,
  motiv: null,
  observatii: null,
};

const randSofer = {
  full_name: "Popescu Ana",
  marca: "AM-A",
  adresa_strada: "Str. Teiului 4",
  adresa_oras: "Ploiești",
  adresa_judet: "Prahova",
  adresa_resedinta_strada: null,
  adresa_resedinta_oras: null,
  adresa_resedinta_judet: null,
  tip_act_identitate: "CI",
  serie_act: "PH",
  numar_act: "123456",
};

function cerere(id: string = AMENDA): Promise<Response> {
  return GET(new Request("http://test.local/x"), { params: Promise.resolve({ id }) });
}

function modelul(): ModelScrisoare {
  const apel = genereaza.mock.calls.at(-1);
  return (apel?.[0] as { model: ModelScrisoare }).model;
}

beforeEach(() => {
  cnpComplet.mockReset();
  genereaza.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/export/flota/amenzi/[id]/scrisoare — porțile", () => {
  it("un id care nu e UUID dă 404, fără să atingă baza", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    const r = await cerere("nu-e-uuid");
    expect(r.status).toBe(404);
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără `vehicle_fines:read = all`: 403, fără drum la bază și fără citirea CNP-ului", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicle_fines:read": "team", "employees:read": "all" },
    });
    const r = await cerere();
    expect(r.status).toBe(403);
    expect(server.apeluri).toHaveLength(0);
    expect(cnpComplet).not.toHaveBeenCalled();
  });

  it.each([["own"], ["team"], ["none"]] as const)(
    "cu amenzile, dar cu `employees:read = %s`: 403, iar CNP-ul nu se citește",
    async (scope) => {
      const { server } = configureazaActiunea({
        permisiuni: { "vehicle_fines:read": "all", "employees:read": scope },
      });
      const r = await cerere();
      expect(r.status).toBe(403);
      expect(await r.text()).toContain("CNP");
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriRpc).toHaveLength(0);
      expect(cnpComplet).not.toHaveBeenCalled();
    },
  );

  it("`vehicles:read = all` nu înlocuiește cheia amenzilor", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:read": "all", "employees:read": "all" },
    });
    const r = await cerere();
    expect(r.status).toBe(403);
    expect(server.apeluri).toHaveLength(0);
  });

  it("amenda inexistentă sau invizibilă (RLS) dă 404", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("vehicle_fines", "select", { data: null });
    const r = await cerere();
    expect(r.status).toBe(404);
    expect(cnpComplet).not.toHaveBeenCalled();
  });

  it("amenda fără șofer desemnat dă 409, fără citirea CNP-ului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("vehicle_fines", "select", {
      data: { ...randAmenda, stadiu: "primita", sofer_desemnat_id: null },
    });
    const r = await cerere();
    expect(r.status).toBe(409);
    expect(cnpComplet).not.toHaveBeenCalled();
  });
});

describe("GET /api/export/flota/amenzi/[id]/scrisoare — scrisoarea", () => {
  it("amenda cu șofer desemnat: PDF atașat, fără cache, CNP citit pentru șoferul desemnat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("vehicle_fines", "select", { data: randAmenda });
    server.raspunde("vehicles", "select", {
      data: [{ id: VEHICUL, nr_inmatriculare: "PH12ABC" }],
    });
    server.raspunde("employees", "select", { data: randSofer });
    cnpComplet.mockResolvedValue("2900101123456");

    const r = await cerere();

    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-disposition")).toMatch(
      /^attachment; filename="scrisoare-art39-/u,
    );
    expect(cnpComplet).toHaveBeenCalledTimes(1);
    expect(cnpComplet.mock.calls[0]?.[1]).toBe(SOFER);

    const model = modelul();
    const rubrici = new Map(model.rubriciSofer);
    expect(rubrici.get("Cod numeric personal")).toBe("2900101123456");
    expect(rubrici.get("Nume și prenume")).toBe("Popescu Ana");
    expect(rubrici.get("Domiciliul sau reședința")).toBe("Str. Teiului 4, Ploiești, Prahova");
    expect(rubrici.get("Act de identitate")).toBe("CI, seria PH, nr. 123456");
    expect(model.lipsuri).toEqual([]);
    expect(model.destinatar).toBe("Către: Poliția Rutieră Prahova");
    // Momentul faptei e în ora României (06:30 UTC = 09:30 EEST).
    expect(model.paragrafe.join(" ")).toContain("09.10.2026, ora 09:30");
  });

  it("citirile pleacă pe firma din tenant, pe amenda și șoferul cerute", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("vehicle_fines", "select", { data: randAmenda });
    server.raspunde("vehicles", "select", { data: [{ id: VEHICUL, nr_inmatriculare: "PH12ABC" }] });
    server.raspunde("employees", "select", { data: randSofer });
    cnpComplet.mockResolvedValue("2900101123456");

    await cerere();

    const [amenda] = server.apeluriPe("vehicle_fines", "select");
    expect(areFiltru(amenda, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(amenda, "eq", "id", AMENDA)).toBe(true);
    expect(areFiltru(amenda, "is", "deleted_at", null)).toBe(true);
    const [sofer] = server.apeluriPe("employees", "select");
    expect(areFiltru(sofer, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(sofer, "eq", "id", SOFER)).toBe(true);
  });

  it("CNP lipsă din fișă: tot 200, cu linie de completat și lipsa spusă pe document", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("vehicle_fines", "select", { data: randAmenda });
    server.raspunde("vehicles", "select", { data: [{ id: VEHICUL, nr_inmatriculare: "PH12ABC" }] });
    server.raspunde("employees", "select", {
      data: {
        ...randSofer,
        adresa_strada: null,
        adresa_oras: null,
        adresa_judet: null,
        serie_act: null,
      },
    });
    cnpComplet.mockResolvedValue("CNP nefurnizat la înrolare");

    const r = await cerere();

    expect(r.status).toBe(200);
    const model = modelul();
    expect(new Map(model.rubriciSofer).get("Cod numeric personal")).toBe("");
    expect(model.lipsuri).toEqual([
      "codul numeric personal",
      "domiciliul sau reședința",
      "seria și numărul actului de identitate",
    ]);
  });

  it("citirea CNP-ului care aruncă nu strică scrisoarea: linie de completat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("vehicle_fines", "select", { data: randAmenda });
    server.raspunde("vehicles", "select", { data: [{ id: VEHICUL, nr_inmatriculare: "PH12ABC" }] });
    server.raspunde("employees", "select", { data: randSofer });
    cnpComplet.mockRejectedValue(new Error("cheie de criptare lipsă"));

    const r = await cerere();

    expect(r.status).toBe(200);
    expect(modelul().lipsuri).toContain("codul numeric personal");
  });
});
