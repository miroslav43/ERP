// src/app/api/export/salarizare/d112/route.test.ts
//
// Declarația 112 ca XML. Decriptarea CNP-ului și numărul din registru sunt
// înlocuite cu spioni; aici se verifică ce CITEȘTE ruta din `payroll_entries`
// și ce DECLARĂ în `A_5` (baza CAM) pentru un salariat la salariul minim.
// Generatorul însuși e testat în `genereaza.test.ts`.

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
vi.mock("@/lib/crypto/aes-gcm", async (orig) => ({
  ...(await orig<object>()),
  // Cheia de criptare nu face parte din ce se verifică aici.
  decrypt: () => "1800101410013",
  dinBytea: (valoare: unknown) => valoare,
}));
vi.mock("@/lib/registru/document-generat", async (orig) => ({
  ...(await orig<object>()),
  inregistreazaDocumentGenerat: vi.fn(),
}));

import { inregistreazaDocumentGenerat } from "@/lib/registru/document-generat";
import { configureazaActiunea, ID_1, ID_2 } from "@/lib/teste/actiune";
import type { ClientFals } from "@/lib/teste/supabase-fals";

import { GET } from "./route";

const PERMISIUNI = { "payroll:export": "all", "employees:read": "all" } as const;

/** Un rând de salariu, ca în `calc.facilitate.test.ts`: iulie 2026, 4.325 lei. */
function rand(calcBreakdown: unknown, brut = 4325) {
  return {
    employee_id: ID_2,
    impozit: 182,
    cas: 1031,
    cass: 413,
    cam_angajator: 92.81,
    brut,
    calc_breakdown: calcBreakdown,
    ore_lucrate: 176,
    zile_absenta_nemotivata: 0,
    zile_fara_plata: 0,
    angajat: {
      full_name: "Ioana Țîrlea",
      first_name: "Ioana",
      last_name: "Țîrlea",
      hired_on: "2024-03-01",
      terminated_on: null,
    },
  };
}

function programeaza(server: ClientFals, randSalariu: unknown): void {
  server.raspunde("payroll_periods", "select", {
    data: { id: ID_1, an: 2026, luna: 7, status: "aprobat" },
  });
  server.raspunde("organizations", "select", {
    data: {
      name: "Firma Test",
      legal_name: "Firma Test SRL",
      cui_normalizat: "12345678",
      reg_com: "J12/345/2010",
      cod_caen: "4120",
      adresa: "Str. Libertății 1",
      oras: "Cluj-Napoca",
      judet: "Cluj",
    },
  });
  server.raspunde("payroll_settings", "select", {
    data: { casa_sanatate_angajator: "CJ", functie_declarant: "Administrator" },
  });
  server.raspunde("payroll_entries", "select", { data: [randSalariu] });
  server.raspunde("employment_contracts", "select", {
    data: [{ employee_id: ID_2, norma_ore_zi: 8 }],
  });
  server.raspundeRpc("hr_read_sensitive", {
    data: [{ cnp_ciphertext: "c", cnp_iv: "i", cnp_tag: "t", cnp_key_version: 1 }],
  });
}

const cere = () => GET(new Request(`https://app.test/api/export/salarizare/d112?perioada=${ID_1}`));

beforeEach(() => {
  vi.mocked(inregistreazaDocumentGenerat)
    .mockReset()
    .mockResolvedValue({ ok: true, numarAfisat: "D112-0001" } as never);
});

describe("GET /api/export/salarizare/d112", () => {
  it("fără `employees:read = all`: 403, fără nicio citire din salarii", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:export": "all" } });
    const r = await cere();
    expect(r.status).toBe(403);
    expect(server.apeluriPe("payroll_entries")).toHaveLength(0);
  });

  it("citește `calc_breakdown`: altfel suma scutită n-ar ajunge niciodată în declarație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    programeaza(server, rand([]));

    const r = await cere();

    expect(r.status).toBe(200);
    const [apel] = server.apeluriPe("payroll_entries");
    expect(apel?.coloane?.split(",").map((c) => c.trim())).toContain("calc_breakdown");
  });

  it("salariat la minim: A_5 = brut − suma din calcul, iar atenționarea ajunge în antet", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    programeaza(
      server,
      rand([
        { pas: "brut", valoare: 4325 },
        { pas: "sumaNeimpozabila", valoare: 200 },
      ]),
    );

    const r = await cere();

    expect(r.status).toBe(200);
    const xml = await r.text();
    expect(xml).toContain('A_5="4125"');
    // Una pe asigurat; butonul de descărcare o citește și o arată în notificare.
    expect(r.headers.get("x-atentionari")).toBe("1");
  });

  it("rând dinaintea facilității: A_5 rămâne brutul, fără antetul de atenționări", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    programeaza(server, rand([{ pas: "brut", valoare: 5000 }], 5000));

    const r = await cere();

    expect(r.status).toBe(200);
    expect(await r.text()).toContain('A_5="5000"');
    expect(r.headers.get("x-atentionari")).toBeNull();
  });
});
