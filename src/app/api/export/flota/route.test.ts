// src/app/api/export/flota/route.test.ts
//
// Excelul raportului lunar al flotei (F8), pe clientul fals: poarta (cheia
// `vehicles:export` ȘI drepturile pe toată flota), parametrii din adresă și
// fișierul care iese. Ce vede fiecare rol din RLS e pe `tests/rls/proba-flota-rapoarte.sql`.

import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import { configureazaActiunea, ID_1, ID_2, type ConfigurareActiune } from "@/lib/teste/actiune";
import type { ClientFals } from "@/lib/teste/supabase-fals";

import { GET } from "./route";

const ADMIN: ConfigurareActiune = {
  permisiuni: {
    "vehicles:read": "all",
    "trip_sheets:read": "all",
    "vehicles:export": "all",
  },
};
const SOFER = "88888888-8888-4888-8888-888888888888";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea(ADMIN).server;
});

const cere = (parametri: string) =>
  GET(new Request(`https://exemplu.test/api/export/flota${parametri}`));

function programeazaLuna(): void {
  db.raspunde("trip_sheets", "select", {
    data: [
      {
        id: ID_1,
        vehicle_id: ID_1,
        employee_id: SOFER,
        numar: "FP-2026-0001",
        data: "2026-09-02",
        km_parcursi: 400,
        vehicul_nr: "B100ABC",
        vehicul_combustibil: "motorina",
        norma_l_100km: 7,
        alimentari: [{ litri: 36, cost: 252.5 }],
      },
    ],
  });
  db.raspunde("trip_sheets", "select", { data: [] });
  db.raspunde("vehicle_service_entries", "select", { data: [] });
  db.raspunde("vehicle_expenses", "select", { data: [] });
  db.raspunde("vehicle_documents", "select", { data: [] });
  db.raspunde("vehicles", "select", { data: [{ id: ID_1, nr_inmatriculare: "B100ABC" }] });
  db.raspunde("employees", "select", {
    data: [{ id: SOFER, full_name: "Popescu Ion", marca: "M1", deleted_at: null }],
  });
}

describe("GET /api/export/flota", () => {
  it("fără cheia `vehicles:export`: 403, iar baza nu e atinsă", async () => {
    db = configureazaActiunea({
      permisiuni: { "vehicles:read": "all", "trip_sheets:read": "all" },
    }).server;
    const r = await cere("?luna=2026-09");
    expect(r.status).toBe(403);
    expect(await r.text()).toMatch(/\.$/u);
    expect(db.apeluri).toHaveLength(0);
  });

  it("fără sesiune: 401; fără organizație aleasă: 403; cu modulul oprit: 404", async () => {
    configureazaActiunea({ ...ADMIN, sesiune: "neautentificat" });
    expect((await cere("?luna=2026-09")).status).toBe(401);
    configureazaActiunea({ ...ADMIN, sesiune: "fara_organizatie" });
    expect((await cere("?luna=2026-09")).status).toBe(403);
    db = configureazaActiunea({ ...ADMIN, functii: ["attendance"] }).server;
    expect((await cere("?luna=2026-09")).status).toBe(404);
    expect(db.apeluri).toHaveLength(0);
  });

  it("managerul, cu vehicule și foi doar la `team`: 403, nu un fișier cu jumătate din cifre", async () => {
    db = configureazaActiunea({
      rol: "manager",
      permisiuni: {
        "vehicles:read": "team",
        "trip_sheets:read": "team",
        "vehicles:export": "all",
      },
    }).server;
    expect((await cere("?luna=2026-09")).status).toBe(403);
    expect(db.apeluri).toHaveLength(0);
  });

  it.each([
    ["", "luna lipsește"],
    ["?luna=2026-13", "luna nu există"],
    ["?luna=septembrie", "luna nu e în forma AAAA-LL"],
    ["?luna=2026-09&vehicul=B100ABC", "vehiculul nu e un identificator"],
  ])("%s → 400 (%s), fără să citească ceva", async (parametri) => {
    const r = await cere(parametri);
    expect(r.status).toBe(400);
    expect(db.apeluri).toHaveLength(0);
  });

  it("administratorul primește un .xlsx cu luna și foile, fără cache", async () => {
    programeazaLuna();
    const r = await cere("?luna=2026-09");

    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="raport-flota-2026-09.xlsx"',
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");

    const zip = await JSZip.loadAsync(new Uint8Array(await r.arrayBuffer()));
    const texte = await zip.file("xl/sharedStrings.xml")?.async("string");
    expect(texte).toContain("Raport flotă — septembrie 2026");
    expect(texte).toContain("Firma Test SRL");
    expect(texte).toContain("FP-2026-0001");
    expect(texte).toContain("Popescu Ion");
    // Export al aplicației plătite: fără subsolul uneltelor publice.
    expect(texte).not.toContain("Generat gratuit");
  });

  it("pe un vehicul: numele fișierului și subtitlul îl poartă, iar un vehicul care nu se vede e 404", async () => {
    db.raspunde("vehicles", "select", { data: [{ id: ID_2, nr_inmatriculare: "CJ200XYZ" }] });
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    const r = await cere(`?luna=2026-09&vehicul=${ID_2}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="raport-flota-2026-09-cj200xyz.xlsx"',
    );

    db = configureazaActiunea(ADMIN).server;
    db.raspunde("vehicles", "select", { data: [] });
    const lipsa = await cere(`?luna=2026-09&vehicul=${ID_2}`);
    expect(lipsa.status).toBe(404);
  });
});
