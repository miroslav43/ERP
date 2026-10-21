// src/app/(app)/flota/bon/actions.test.ts
//
// Citirea bonului de pe poză (F12a) și urcarea pozei înainte de salvare.
// Straturile comune ale lui `createAction` sunt în `salarizare/actions.test.ts`.
// Modelul de viziune e o DUBLURĂ: niciun apel real la OpenRouter.

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

const { env, viziune } = vi.hoisted(() => ({
  env: { cheie: "sk-or-v1-test" },
  viziune: { citesteImagineStructurat: vi.fn() },
}));

vi.mock("@/config/env", async (orig) => {
  const original = await orig<typeof import("@/config/env")>();
  return {
    ...original,
    serverEnv: {
      ...original.serverEnv,
      get OPENROUTER_API_KEY() {
        return env.cheie;
      },
    },
  };
});
vi.mock("@/lib/asistent/viziune", () => viziune);

import { FEATURE_KEYS } from "@/config/features";
import {
  asteaptaDupa,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";
import { verificaJeton } from "@/lib/fleet/jeton-bon";

import { citesteBonul, pregatesteBonNou } from "./actions";

const FOAIE = ID_1;
const SOFER = ID_2;
const CALE = `${ORG_ID}/trip_sheets/${FOAIE}/abc-bon.jpg`;

/** JPEG minimal: SOI, APP1 cu „Exif”, SOS, EOI. */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff, 0xda, 0x00, 0x04,
  0x01, 0x02, 0xff, 0xd9,
]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const RASPUNS_BON = {
  lizibil: true,
  motiv_ilizibil: null,
  data: "14.09.2026",
  ora: "12:30",
  statie: "OMV Pitești",
  cui_emitent: "RO14399840",
  cif_cumparator: null,
  numar_bon: "0042",
  linii: [{ denumire: "MOTORINA", tip: "carburant", litri: "45,32", valoare: "312,50" }],
  total: "312,50",
};

const foaieDraft = (modificari: Record<string, unknown> = {}) => ({
  id: FOAIE,
  status: "draft",
  employee_id: SOFER,
  plecare_la: "2026-09-14T05:00:00.000Z",
  sosire_la: null,
  data: "2026-09-14",
  ...modificari,
});

beforeEach(() => {
  env.cheie = "sk-or-v1-test";
  viziune.citesteImagineStructurat.mockReset();
  viziune.citesteImagineStructurat.mockResolvedValue({
    ok: true,
    continut: JSON.stringify(RASPUNS_BON),
    model: "google/gemini-3.7-flash",
    cost: 0.0035,
    tokeni: { intrare: 1800, iesire: 500 },
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function limitePermise(admin: ClientFals, permis = true): void {
  for (let i = 0; i < 3; i += 1) admin.raspundeRpc("consume_rate_limit", { data: permis });
}

/** Drumul fericit, până la apelul extern inclusiv. */
function programeazaDrumul(server: ClientFals, admin: ClientFals): void {
  limitePermise(admin);
  server.raspunde("trip_sheets", "select", { data: foaieDraft() });
  server.raspunde("employees", "select", { data: { id: SOFER } });
  server.raspundeStocare("org-flota", "info", {
    data: { size: JPEG.length, contentType: "image/jpeg" },
  });
  server.raspundeStocare("org-flota", "download", { data: new Blob([JPEG]) });
  server.raspunde("organizations", "select", { data: { cui_normalizat: "5022670" } });
  server.raspunde("fuel_entries", "select", { data: [] });
  server.raspunde("fuel_entries", "select", { data: [] });
}

const angajat = () =>
  configureazaActiunea({ rol: "employee", permisiuni: { "trip_sheets:update": "own" } });

describe("citesteBonul", () => {
  it("fără `trip_sheets:update` (hr): INTERZIS, viziunea nu e chemată", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: {} });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("managerul pe foaia unui subordonat: INTERZIS, fără Storage și fără terț (R6)", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "trip_sheets:update": "own", "trip_sheets:read": "team" },
    });
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft({ employee_id: ID_3 }) });
    server.raspunde("employees", "select", { data: { id: SOFER } });

    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("scope `team` pe update (rol personalizat) pe foaia altcuiva: tot INTERZIS", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "trip_sheets:update": "team" },
    });
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft({ employee_id: ID_3 }) });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
  });

  it("cheia OpenRouter goală: CONFLICT, fără niciun apel", async () => {
    env.cheie = "";
    const { server, admin } = angajat();
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(admin.apeluriRpc).toHaveLength(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("modulul `asistent` stins: CONFLICT, fără apel", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "trip_sheets:update": "own" },
      functii: FEATURE_KEYS.filter((f) => f !== "asistent"),
    });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/Asistent AI/u);
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
    expect(admin.apeluriRpc).toHaveLength(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("limita atinsă: LIMITA_DEPASITA, fără apel; cheile încep cu `ocr-bon:`", async () => {
    const { admin } = angajat();
    limitePermise(admin, false);
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "LIMITA_DEPASITA" } });
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
    const chei = admin.apeluriRpc.map((a) => (a.argumente as { p_key: string }).p_key);
    expect(chei).toEqual([
      `ocr-bon:utilizator:${USER_ID}`,
      `ocr-bon:organizatie:${ORG_ID}`,
      "ocr-bon:global",
    ]);
  });

  it("foaia inexistentă: NEGASIT; citirea foii e filtrată pe firmă", async () => {
    const { server, admin } = angajat();
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: null });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    const [apel] = server.apeluriPe("trip_sheets", "select");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("foaia aprobată: CONFLICT, fără apel extern", async () => {
    const { server, admin } = angajat();
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft({ status: "aprobat" }) });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
  });

  it.each([
    ["cu `..`", `${ORG_ID}/trip_sheets/${FOAIE}/../x.jpg`],
    ["în folderul altei foi", `${ORG_ID}/trip_sheets/${ID_3}/abc-bon.jpg`],
    ["în altă firmă", `22222222-2222-4222-8222-222222222222/trip_sheets/${FOAIE}/a.jpg`],
  ])("calea %s: VALIDARE, Storage neatins", async (_e, cale) => {
    const { server, admin } = angajat();
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
  });

  it("obiectul e PNG: CONFLICT, fără apel extern", async () => {
    const { server, admin } = angajat();
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    server.raspundeStocare("org-flota", "info", { data: { size: 8, contentType: "image/png" } });
    server.raspundeStocare("org-flota", "download", { data: new Blob([PNG]) });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/doar pe fotografii JPEG/u);
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
  });

  it("obiectul lipsă din Storage: CONFLICT", async () => {
    const { server, admin } = angajat();
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    server.raspundeStocare("org-flota", "info", { error: { message: "Object not found" } });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(viziune.citesteImagineStructurat).not.toHaveBeenCalled();
  });

  it("drumul fericit: propunerea, jetonul valid, fără nicio scriere; imaginea pleacă FĂRĂ Exif", async () => {
    const { server, admin } = angajat();
    programeazaDrumul(server, admin);

    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });

    expect(r.ok).toBe(true);
    if (!r.ok || r.data.propunere === null) throw new Error("fără propunere");
    expect(r.data.propunere).toEqual({
      alimentat_la: "2026-09-14T12:30",
      litri: 45.32,
      cost: 312.5,
      statie: "OMV Pitești",
      numar_bon: "0042",
      cui_statie: "14399840",
    });
    const v = verificaJeton(r.data.jeton, { org: ORG_ID, user: USER_ID, foaie: FOAIE, cale: CALE });
    expect(v.stare).toBe("ok");

    // Nimic nu se scrie: nicio operație în afară de citiri.
    expect(server.apeluri.every((a) => a.operatie === "select")).toBe(true);
    expect(admin.apeluri).toHaveLength(0);
    expect(server.neconsumate()).toEqual([]);

    const [apelViziune] = viziune.citesteImagineStructurat.mock.calls[0] as [
      { jpegBase64: string; schema: { name: string } },
    ];
    const trimis = Buffer.from(apelViziune.jpegBase64, "base64");
    expect(trimis.includes(Buffer.from("Exif"))).toBe(false);
    expect([...trimis.subarray(0, 2)]).toEqual([0xff, 0xd8]);

    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_action: "export", p_entity_type: "fuel_receipt_ocr" });
    expect(Object.keys((audit?.["p_after"] ?? {}) as object).sort()).toEqual([
      "cale",
      "trip_sheet_id",
    ]);
  });

  it("bonul deja pe foaia asta ⇒ avertismentul de refuz la salvare; `ilike` escapat", async () => {
    const { server, admin } = angajat();
    viziune.citesteImagineStructurat.mockResolvedValue({
      ok: true,
      continut: JSON.stringify({ ...RASPUNS_BON, numar_bon: "12_3%" }),
      model: "m",
      cost: null,
      tokeni: { intrare: 0, iesire: 0 },
    });
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: JPEG.length, contentType: "image/jpeg" },
    });
    server.raspundeStocare("org-flota", "download", { data: new Blob([JPEG]) });
    server.raspunde("organizations", "select", { data: { cui_normalizat: "5022670" } });
    server.raspunde("fuel_entries", "select", { data: [{ id: ID_3 }] });

    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });

    expect(r.ok).toBe(true);
    if (!r.ok || r.data.propunere === null) throw new Error("fără propunere");
    expect(r.data.avertismente[0]).toMatch(/deja înregistrat pe foaia asta/u);
    const [apel] = server.apeluriPe("fuel_entries", "select");
    expect(areFiltru(apel, "ilike", "numar_bon", "12\\_3\\%")).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "trip_sheet_id", FOAIE)).toBe(true);
  });

  it("același bon pe ALTĂ foaie, aceeași stație și zi ⇒ avertisment de dublură", async () => {
    const { server, admin } = angajat();
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: JPEG.length, contentType: "image/jpeg" },
    });
    server.raspundeStocare("org-flota", "download", { data: new Blob([JPEG]) });
    server.raspunde("organizations", "select", { data: { cui_normalizat: null } });
    server.raspunde("fuel_entries", "select", { data: [] });
    server.raspunde("fuel_entries", "select", { data: [{ id: ID_3, trip_sheet_id: ID_2 }] });

    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });

    if (!r.ok || r.data.propunere === null) throw new Error("fără propunere");
    expect(r.data.avertismente[0]).toMatch(/deja pe altă foaie/u);
    const [, apel] = server.apeluriPe("fuel_entries", "select");
    expect(areFiltru(apel, "eq", "cui_statie", "14399840")).toBe(true);
    // Ziua bonului, în ora României: 14.09 00:00 EEST = 13.09 21:00 UTC.
    expect(areFiltru(apel, "gte", "alimentat_la", "2026-09-13T21:00:00.000Z")).toBe(true);
    expect(areFiltru(apel, "lt", "alimentat_la", "2026-09-14T21:00:00.000Z")).toBe(true);
    expect(areFiltru(apel, "neq", "trip_sheet_id", FOAIE)).toBe(true);
  });

  it("bonul ilizibil ⇒ fără propunere și fără jeton", async () => {
    const { server, admin } = angajat();
    viziune.citesteImagineStructurat.mockResolvedValue({
      ok: true,
      continut: JSON.stringify({ ...RASPUNS_BON, lizibil: false, motiv_ilizibil: "neclar" }),
      model: "m",
      cost: null,
      tokeni: { intrare: 0, iesire: 0 },
    });
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: JPEG.length, contentType: "image/jpeg" },
    });
    server.raspundeStocare("org-flota", "download", { data: new Blob([JPEG]) });
    server.raspunde("organizations", "select", { data: { cui_normalizat: "5022670" } });

    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });

    expect(r).toEqual({
      ok: true,
      data: { propunere: null, motivGol: expect.stringMatching(/neclară/u) as unknown },
    });
  });

  it("viziunea indisponibilă ⇒ CONFLICT cu mesajul omenesc", async () => {
    const { server, admin } = angajat();
    viziune.citesteImagineStructurat.mockResolvedValue({
      ok: false,
      motiv: "fara_endpoint",
      mesaj: "Citirea automată nu este disponibilă acum. Completați manual.",
    });
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: JPEG.length, contentType: "image/jpeg" },
    });
    server.raspundeStocare("org-flota", "download", { data: new Blob([JPEG]) });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Citirea automată nu este disponibilă acum. Completați manual.",
      },
    });
  });

  it("răspunsul care nu trece de schemă ⇒ CONFLICT „completați manual”", async () => {
    const { server, admin } = angajat();
    viziune.citesteImagineStructurat.mockResolvedValue({
      ok: true,
      continut: '{"lizibil": "da"}',
      model: "m",
      cost: null,
      tokeni: { intrare: 0, iesire: 0 },
    });
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft() });
    server.raspunde("employees", "select", { data: { id: SOFER } });
    server.raspundeStocare("org-flota", "info", {
      data: { size: JPEG.length, contentType: "image/jpeg" },
    });
    server.raspundeStocare("org-flota", "download", { data: new Blob([JPEG]) });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/Completați manual\.$/u);
  });

  it("org_admin (`all`) nu cere fișa proprie", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "trip_sheets:update": "all" } });
    limitePermise(admin);
    server.raspunde("trip_sheets", "select", { data: foaieDraft({ employee_id: ID_3 }) });
    server.raspundeStocare("org-flota", "info", {
      data: { size: JPEG.length, contentType: "image/jpeg" },
    });
    server.raspundeStocare("org-flota", "download", { data: new Blob([JPEG]) });
    server.raspunde("organizations", "select", { data: { cui_normalizat: "5022670" } });
    server.raspunde("fuel_entries", "select", { data: [] });
    server.raspunde("fuel_entries", "select", { data: [] });
    const r = await citesteBonul({ trip_sheet_id: FOAIE, cale: CALE });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });
});

describe("pregatesteBonNou", () => {
  const declarat = {
    trip_sheet_id: FOAIE,
    numeFisier: "bon.jpg",
    dimensiune: 300_000,
    mime: "image/jpeg",
  };

  it("semnează o cale în folderul foii, pe clientul omului", async () => {
    const { server } = angajat();
    server.raspunde("trip_sheets", "select", { data: { id: FOAIE, status: "draft" } });
    server.raspundeStocare("org-flota", "createSignedUploadUrl", {
      data: { signedUrl: "https://s/u", path: "x", token: "t" },
    });
    const r = await pregatesteBonNou(declarat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://s/u");
    expect(r.data.cale.startsWith(`${ORG_ID}/trip_sheets/${FOAIE}/`)).toBe(true);
    expect(r.data.cale.endsWith("-bon.jpg")).toBe(true);
    const [apel] = server.apeluriPe("trip_sheets", "select");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("foaia trimisă: CONFLICT, fără semnare", async () => {
    const { server } = angajat();
    server.raspunde("trip_sheets", "select", { data: { id: FOAIE, status: "trimis" } });
    const r = await pregatesteBonNou(declarat);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("tipul nepermis de bucket: VALIDARE, fără citire", async () => {
    const { server } = angajat();
    const r = await pregatesteBonNou({ ...declarat, mime: "application/zip" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("semnarea refuzată de politică: CONFLICT", async () => {
    const { server } = angajat();
    server.raspunde("trip_sheets", "select", { data: { id: FOAIE, status: "draft" } });
    server.raspundeStocare("org-flota", "createSignedUploadUrl", { error: { message: "denied" } });
    const r = await pregatesteBonNou(declarat);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
