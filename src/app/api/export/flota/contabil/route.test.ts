// src/app/api/export/flota/contabil/route.test.ts
//
// Exportul contabil al flotei (F12g), pe clientul fals: poarta (cheia de export
// ȘI drepturile pe toată flota), parametrii din adresă (400, nu implicite),
// luna goală (404), problema blocantă (409) și fișierele care ies. Ce vede
// fiecare rol din RLS e pe `tests/rls/proba-flota-export-contabil.sql`.

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
vi.mock("@/lib/format/date", async (orig) => ({
  ...(await orig<typeof import("@/lib/format/date")>()),
  todayInBucharest: () => "2026-10-22",
}));

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
const VEH = "99999999-9999-4999-8999-999999999999";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea(ADMIN).server;
});

const cere = (parametri: string) =>
  GET(new Request(`https://exemplu.test/api/export/flota/contabil${parametri}`));

const alimentare = (id: string, status: string, alimentat_la = "2026-09-03T07:00:00+00:00") => ({
  id,
  alimentat_la,
  cost: 100,
  litri: 14,
  numar_bon: id === ID_1 ? "4521" : "4522",
  statie: "OMV Pipera",
  cui_statie: "1590082",
  foaie: {
    status,
    deleted_at: null,
    vehicle_id: VEH,
    vehicul_nr: "B100ABC",
    vehicul_combustibil: "motorina",
    vehicul: { nr_inmatriculare: "B100ABC", masa_maxima_kg: 1800, tip_combustibil: "motorina" },
    sofer: { full_name: "Popescu Ion" },
  },
});

/** O lună cu o alimentare pe foaie aprobată și una pe foaie trimisă. */
function programeazaLuna(alimentari = [alimentare(ID_1, "aprobat"), alimentare(ID_2, "trimis")]) {
  db.raspunde("organizations", "select", {
    data: {
      name: "Firma Test",
      legal_name: "Firma Test SRL",
      cui: "RO12345678",
      cui_normalizat: "12345678",
      platitor_tva: true,
    },
  });
  db.raspunde("fuel_entries", "select", { data: alimentari });
  db.raspunde("vehicle_expenses", "select", { data: [] });
  db.raspunde("vehicle_service_entries", "select", { data: [] });
  if (alimentari.length > 0) db.raspunde("fuel_card_transactions", "select", { data: [] });
  db.raspunde("vehicle_fiscal_regimes", "select", {
    data:
      alimentari.length > 0
        ? [
            {
              id: ID_1,
              vehicle_id: VEH,
              valabil_de_la: "2026-01-01",
              regim: "integral_exclusiv_economic",
            },
          ]
        : [],
  });
}

describe("GET /api/export/flota/contabil — poarta", () => {
  it("fără cheia `vehicles:export`: 403, iar baza nu e atinsă", async () => {
    db = configureazaActiunea({
      permisiuni: { "vehicles:read": "all", "trip_sheets:read": "all" },
    }).server;
    const r = await cere("?luna=2026-09&format=jurnal_csv");
    expect(r.status).toBe(403);
    expect(await r.text()).toMatch(/dreptul de a exporta.*\.$/u);
    expect(db.apeluri).toHaveLength(0);
  });

  it("cu cheia de export, dar cu foile doar la `team`: 403 cu motivul notei incomplete", async () => {
    db = configureazaActiunea({
      rol: "manager",
      permisiuni: {
        "vehicles:read": "team",
        "trip_sheets:read": "team",
        "vehicles:export": "all",
      },
    }).server;
    const r = await cere("?luna=2026-09&format=saga");
    expect(r.status).toBe(403);
    expect(await r.text()).toContain("nota ar ieși incompletă");
    expect(db.apeluri).toHaveLength(0);
  });

  it("fără sesiune: 401; fără organizație aleasă: 403; cu modulul oprit: 404", async () => {
    configureazaActiunea({ ...ADMIN, sesiune: "neautentificat" });
    expect((await cere("?luna=2026-09&format=saga")).status).toBe(401);
    configureazaActiunea({ ...ADMIN, sesiune: "fara_organizatie" });
    expect((await cere("?luna=2026-09&format=saga")).status).toBe(403);
    db = configureazaActiunea({ ...ADMIN, functii: ["attendance"] }).server;
    expect((await cere("?luna=2026-09&format=saga")).status).toBe(404);
    expect(db.apeluri).toHaveLength(0);
  });
});

describe("GET /api/export/flota/contabil — parametrii", () => {
  it.each([
    ["?luna=2026-09&format=saga&cont_combustibil=60%2022", "cont_combustibil"],
    ["?luna=2026-11&format=saga", "Luna aleasă e în viitor."],
    ["?luna=2026-09&format=xlsx", "format"],
    ["?format=saga", "luna"],
    ["?luna=2026-09&format=jurnal_csv&csv_separator=virgula&csv_zecimale=virgula", "csv_zecimale"],
  ])("%s → 400 cu motivul, fără să citească ceva", async (parametri, motiv) => {
    const r = await cere(parametri);
    expect(r.status).toBe(400);
    expect(await r.text()).toContain(motiv);
    expect(db.apeluri).toHaveLength(0);
  });

  it("parametrul absent: doar foile aprobate (foaia trimisă iese din note, dar rămâne în jurnal)", async () => {
    programeazaLuna();
    const r = await cere("?luna=2026-09&format=articole_csv");
    const text = await r.text();
    expect(text).toContain('"4521"');
    expect(text).not.toContain('"4522"');
  });

  it("`doar_aprobate=nu` trimis explicit: foaia neaprobată intră în note", async () => {
    programeazaLuna();
    const r = await cere("?luna=2026-09&format=articole_csv&doar_aprobate=nu");
    const text = await r.text();
    expect(text).toContain('"4521"');
    expect(text).toContain('"4522"');
  });

  it("conturile din adresă ajung în fișier", async () => {
    programeazaLuna();
    const r = await cere(
      "?luna=2026-09&format=articole_csv&cont_combustibil=6022.01&cont_decontare=5311",
    );
    expect(await r.text()).toContain(";6022.01;5311;82,64;");
  });
});

describe("GET /api/export/flota/contabil — răspunsurile", () => {
  it("o lună fără nicio cheltuială: 404 cu mesaj, nu un fișier gol", async () => {
    programeazaLuna([]);
    const r = await cere("?luna=2026-09&format=saga");
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Nicio cheltuială a flotei în luna aleasă.");
  });

  it("`articole_csv`: 200, text/csv, fără cache, numele exact", async () => {
    programeazaLuna();
    const r = await cere("?luna=2026-09&format=articole_csv");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="articole-contabile-flota-2026-09.csv"',
    );
  });

  it("`jurnal_csv`: numele exact; foaia trimisă apare cu motivul", async () => {
    programeazaLuna();
    const r = await cere("?luna=2026-09&format=jurnal_csv");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="jurnal-costuri-flota-2026-09.csv"',
    );
    const text = await r.text();
    expect(text).toContain("Foaie neaprobată");
    expect(text).toContain("Popescu Ion");
  });

  it("`winmentor`: un ZIP care conține NoteContabile.txt, cu nota bonului aprobat", async () => {
    programeazaLuna();
    const r = await cere("?luna=2026-09&format=winmentor");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="winmentor-flota-2026-09.zip"',
    );
    const zip = await JSZip.loadAsync(new Uint8Array(await r.arrayBuffer()));
    const note = await zip.file("NoteContabile.txt")?.async("string");
    expect(note).toContain("Tipdocument=NOTA CONTABILA\r\nTotalNote=1\r\n");
    expect(note).toContain("NrDoc=4521\r\n");
    expect(note).not.toContain("Popescu");
    expect(zip.file("Partner.txt")).not.toBeNull();
  });

  it("`saga`: un ZIP cu XML-ul bonului, plata lui și ce n-a intrat", async () => {
    programeazaLuna();
    const r = await cere("?luna=2026-09&format=saga");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="saga-flota-2026-09.zip"',
    );
    const zip = await JSZip.loadAsync(new Uint8Array(await r.arrayBuffer()));
    expect(Object.keys(zip.files).sort()).toEqual([
      "CITESTE-MA.txt",
      "F_1590082_4521_03.09.2026.xml",
      "P_03.09.2026.xml",
      "de-verificat.csv",
    ]);
    const xml = await zip.file("F_1590082_4521_03.09.2026.xml")?.async("string");
    expect(xml).toContain("<ClientCIF>12345678</ClientCIF>");
  });

  it("o problemă blocantă (un document din 2016) dă 409 și nicio descărcare", async () => {
    programeazaLuna([alimentare(ID_1, "aprobat", "2016-12-15T07:00:00+00:00")]);
    const r = await cere("?luna=2016-12&format=saga");
    expect(r.status).toBe(409);
    expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await r.text()).toContain("dinaintea primei cote de TVA cunoscute");
  });
});
