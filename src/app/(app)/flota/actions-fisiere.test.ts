// src/app/(app)/flota/actions-fisiere.test.ts
//
// Fișierele flotei (0199), pe clientul fals: scanarea documentului de vehicul
// și poza bonului. Poarta bucketului și regulile de cale pe rând sunt probate
// pe bază în `tests/rls/proba-flota-tipuri-fisiere.sql`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import {
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  confirmaBon,
  confirmaScanareDocument,
  pregatesteBon,
  pregatesteScanareDocument,
} from "./actions-fisiere";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fisier = { numeFisier: "Poliță RCA.pdf", dimensiune: 120_000, mime: "application/pdf" };

describe("pregatesteScanareDocument", () => {
  const intrare = { document_id: ID_1, vehicle_id: ID_2, ...fisier };

  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:update = %s`: INTERZIS, fără niciun drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": scope } });
      const r = await pregatesteScanareDocument(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriStocare).toHaveLength(0);
    },
  );

  it("semnează o cale în folderul VEHICULULUI, pe bucketul flotei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_documents", "select", { data: { id: ID_1 } });
    server.raspundeStocare("org-flota", "createSignedUploadUrl", {
      data: { signedUrl: "https://s/semnat" },
    });

    const r = await pregatesteScanareDocument(intrare);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://s/semnat");
    expect(r.data.cale.startsWith(`${ORG_ID}/vehicles/${ID_2}/`)).toBe(true);
    expect(r.data.cale.endsWith("-polita-rca.pdf")).toBe(true);
    const [citire] = server.apeluriPe("vehicle_documents", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "vehicle_id", ID_2)).toBe(true);
    expect(server.apeluriStocare[0]?.argumente).toEqual([r.data.cale]);
  });

  it("un tip de fișier neacceptat se refuză înaintea oricărui drum", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const r = await pregatesteScanareDocument({ ...intrare, mime: "application/zip" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("documentul altui vehicul sau al altei firme: NEGASIT, fără URL semnat", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_documents", "select", { data: null });
    const r = await pregatesteScanareDocument(intrare);
    expect(r.ok).toBe(false);
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("politica bucketului refuză semnarea: mesaj de business, nu eroare brută", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspunde("vehicle_documents", "select", { data: { id: ID_1 } });
    server.raspundeStocare("org-flota", "createSignedUploadUrl", {
      error: { message: "new row violates row-level security policy" },
    });
    const r = await pregatesteScanareDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("confirmaScanareDocument", () => {
  const cale = `${ORG_ID}/vehicles/${ID_2}/abc-polita.pdf`;
  const intrare = { document_id: ID_1, vehicle_id: ID_2, cale, numeFisier: "polita.pdf" };

  it("măsoară obiectul REAL și leagă calea, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: 120_000, contentType: "application/pdf" },
    });
    server.raspunde("vehicle_documents", "update", { data: { id: ID_1 } });

    const r = await confirmaScanareDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("vehicle_documents", "update");
    expect(scriere?.payload).toEqual({
      fisier_path: cale,
      fisier_nume: "polita.pdf",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "eq", "vehicle_id", ID_2)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual([`/flota/${ID_2}`, "/portal/masina-mea"]);
  });

  it.each([
    ["alt vehicul", `${ORG_ID}/vehicles/${ID_3}/abc.pdf`],
    ["altă firmă", `${ID_3}/vehicles/${ID_2}/abc.pdf`],
    ["traversare", `${ORG_ID}/vehicles/${ID_2}/../${ID_3}/abc.pdf`],
    ["subfolder", `${ORG_ID}/vehicles/${ID_2}/sub/abc.pdf`],
  ])("calea din %s se refuză înaintea Storage-ului", async (_caz, rea) => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    const r = await confirmaScanareDocument({ ...intrare, cale: rea });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("obiectul urcat de alt tip decât cel declarat se refuză, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: 120_000, contentType: "application/x-msdownload" },
    });
    const r = await confirmaScanareDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriPe("vehicle_documents", "update")).toHaveLength(0);
  });

  it("UPDATE cu zero rânduri = CONFLICT, nu succes tăcut", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "all" } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: 120_000, contentType: "application/pdf" },
    });
    server.raspunde("vehicle_documents", "update", { data: null });
    const r = await confirmaScanareDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("pregatesteBon și confirmaBon", () => {
  const prep = {
    alimentare_id: ID_1,
    trip_sheet_id: ID_2,
    numeFisier: "bon.jpg",
    dimensiune: 300_000,
    mime: "image/jpeg",
  };

  it("sub `trip_sheets:update = none`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "none" } });
    const r = await pregatesteBon(prep);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("șoferul cu `own` semnează o cale în folderul FOII", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    server.raspunde("fuel_entries", "select", { data: { id: ID_1 } });
    server.raspundeStocare("org-flota", "createSignedUploadUrl", {
      data: { signedUrl: "https://s/bon" },
    });
    const r = await pregatesteBon(prep);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cale.startsWith(`${ORG_ID}/trip_sheets/${ID_2}/`)).toBe(true);
    const [citire] = server.apeluriPe("fuel_entries", "select");
    expect(areFiltru(citire, "eq", "trip_sheet_id", ID_2)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("confirmarea leagă `fisier_bon_path` și revalidează foaia în ambele zone", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const cale = `${ORG_ID}/trip_sheets/${ID_2}/x-bon.jpg`;
    server.raspundeStocare("org-flota", "info", {
      data: { size: 300_000, contentType: "image/jpeg" },
    });
    server.raspunde("fuel_entries", "update", { data: { id: ID_1 } });

    const r = await confirmaBon({ alimentare_id: ID_1, trip_sheet_id: ID_2, cale });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_entries", "update");
    expect(scriere?.payload).toEqual({ fisier_bon_path: cale, updated_by: USER_ID });
    expect(areFiltru(scriere, "eq", "trip_sheet_id", ID_2)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual([
      `/flota/foi/${ID_2}`,
      "/portal/masina-mea",
      `/portal/masina-mea/foi/${ID_2}`,
    ]);
  });

  it("foaia trimisă (P0001 din `alimentari_inainte`) ajunge ca mesaj, nu ca eroare brută", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const cale = `${ORG_ID}/trip_sheets/${ID_2}/x-bon.jpg`;
    server.raspundeStocare("org-flota", "info", {
      data: { size: 300_000, contentType: "image/jpeg" },
    });
    server.raspunde("fuel_entries", "update", {
      error: eroarePostgrest(
        "P0001",
        "Alimentările se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.",
      ),
    });
    const r = await confirmaBon({ alimentare_id: ID_1, trip_sheet_id: ID_2, cale });
    expect(r).toMatchObject({ ok: false, error: { message: expect.stringMatching(/ciornă/u) } });
  });

  it("bonul din folderul altei foi se refuză înaintea Storage-ului", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "own" } });
    const r = await confirmaBon({
      alimentare_id: ID_1,
      trip_sheet_id: ID_2,
      cale: `${ORG_ID}/trip_sheets/${ID_3}/x-bon.jpg`,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });
});
