// src/app/(app)/mentenanta/sesizari/actions.test.ts
//
// Fluxul complet al sesizării (0181): atribuire, gesturile tehnicianului și ale
// raportorului, comentarii, atașamente, opriri, setări. Dreptul real îl decide
// baza (politica + garda) — aici se verifică ce TRIMITE acțiunea: payload-ul,
// filtrul pe starea curentă din UPDATE, `.select()` după scriere, zero rânduri
// tratat ca eroare și căile revalidate.

import { beforeEach, describe, expect, it, vi } from "vitest";

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
  asteaptaDupa,
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
  actualizeazaSesizare,
  atribuieSesizare,
  comenteazaSesizare,
  confirmaFisier,
  inchideOprire,
  inchideSesizare,
  inregistreazaOprire,
  pregatesteFisier,
  redeschideSesizare,
  retrageSesizare,
  salveazaSetariMentenanta,
  stergeFisier,
  tehnicianSchimbaStarea,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const BUCKET = "org-mentenanta";
const UPDATE_TEAM = { "maintenance:update": "team" } as const;
const CITIRE_OWN = { "maintenance:read": "own" } as const;
const STARI_DESCHISE = ["nou", "in_analiza", "in_lucru", "in_asteptare"];
const INCEPUT = "2026-10-07T10:00:00.000Z";
const SFARSIT = "2026-10-07T12:00:00.000Z";

describe("atribuieSesizare", () => {
  it("`maintenance:update` own < team: INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await atribuieSesizare({ id: ID_1, atribuit_employee_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE pe atribuit_employee_id, filtrat pe stările deschise, cu `.select()` și revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await atribuieSesizare({ id: ID_1, atribuit_employee_id: ID_2 });

    expect(r).toEqual({ ok: true, data: { id: ID_1, atribuit: ID_2 } });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({ atribuit_employee_id: ID_2 });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "in", "status", STARI_DESCHISE)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(
      expect.arrayContaining([`/mentenanta/sesizari/${ID_1}`, `/portal/sesizari/${ID_1}`]),
    );
  });

  it("`eu: true`: întâi fișa proprie a apelantului, apoi UPDATE cu fișa găsită", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("employees", "select", { data: { id: ID_3 } });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await atribuieSesizare({ id: ID_1, eu: true });

    expect(r).toEqual({ ok: true, data: { id: ID_1, atribuit: ID_3 } });
    expect(server.apeluri.map((a) => `${a.tabela}:${a.operatie}`)).toEqual([
      "employees:select",
      "fault_reports:update",
    ]);
    const [fisa] = server.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("fault_reports", "update")[0]?.payload).toEqual({
      atribuit_employee_id: ID_3,
    });
  });

  it("`eu: true` fără fișă de angajat: CONFLICT, niciun UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("employees", "select", { data: null });

    const r = await atribuieSesizare({ id: ID_1, eu: true });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("fault_reports")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("luarea atribuirii înapoi (null) merge doar din `nou` și `in_analiza`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await atribuieSesizare({ id: ID_1, atribuit_employee_id: null });

    expect(r).toEqual({ ok: true, data: { id: ID_1, atribuit: null } });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({ atribuit_employee_id: null });
    expect(areFiltru(apel, "in", "status", ["nou", "in_analiza"])).toBe(true);
  });

  it("zero rânduri la UPDATE: CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("fault_reports", "update", { data: null });
    const r = await atribuieSesizare({ id: ID_1, atribuit_employee_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din garda bazei: CONFLICT cu mesajul gărzii", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    const mesaj = "Tehnicianul ales nu este activ în organizație.";
    server.raspunde("fault_reports", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await atribuieSesizare({ id: ID_1, atribuit_employee_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("tehnicianSchimbaStarea", () => {
  it("`in_lucru`: pornește din `nou`, `in_analiza` sau `in_asteptare`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await tehnicianSchimbaStarea({ id: ID_1, status: "in_lucru" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({ status: "in_lucru" });
    expect(areFiltru(apel, "in", "status", ["nou", "in_analiza", "in_asteptare"])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
  });

  it("`in_asteptare`: pornește doar din `in_lucru`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });
    await tehnicianSchimbaStarea({ id: ID_1, status: "in_asteptare" });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({ status: "in_asteptare" });
    expect(areFiltru(apel, "in", "status", ["in_lucru"])).toBe(true);
  });

  it("`rezolvat` nu e un gest al tehnicianului: VALIDARE, zero apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await tehnicianSchimbaStarea({ id: ID_1, status: "rezolvat" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri: CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: null });
    const r = await tehnicianSchimbaStarea({ id: ID_1, status: "in_lucru" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("fără `maintenance:read`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await tehnicianSchimbaStarea({ id: ID_1, status: "in_lucru" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("gesturile raportorului", () => {
  it("retrageSesizare: `{ status: retrasa }` din `nou` și `in_analiza`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await retrageSesizare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({ status: "retrasa" });
    expect(areFiltru(apel, "in", "status", ["nou", "in_analiza"])).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("inchideSesizare: `{ status: inchis }` doar din `rezolvat`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await inchideSesizare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({ status: "inchis" });
    expect(areFiltru(apel, "in", "status", ["rezolvat"])).toBe(true);
  });

  it("redeschideSesizare: `in_lucru` cu motivul tăiat, doar din `rezolvat`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await redeschideSesizare({
      id: ID_1,
      motiv_redeschidere: "  Defectul a reapărut.  ",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({
      status: "in_lucru",
      motiv_redeschidere: "Defectul a reapărut.",
    });
    expect(areFiltru(apel, "in", "status", ["rezolvat"])).toBe(true);
  });

  it("redeschideSesizare: motiv sub 5 caractere ⇒ VALIDARE pe `motiv_redeschidere`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await redeschideSesizare({ id: ID_1, motiv_redeschidere: "  abc " });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("motiv_redeschidere");
    expect(server.apeluri).toHaveLength(0);
  });

  it("actualizeazaSesizare: `{ descriere, urgenta }` din cele patru stări deschise", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: { id: ID_1 } });

    const r = await actualizeazaSesizare({
      id: ID_1,
      descriere: "Banda transportoare face zgomot.",
      urgenta: "ridicata",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fault_reports", "update");
    expect(apel?.payload).toEqual({
      descriere: "Banda transportoare face zgomot.",
      urgenta: "ridicata",
    });
    expect(areFiltru(apel, "in", "status", STARI_DESCHISE)).toBe(true);
  });

  it("actualizeazaSesizare: descriere sub 10 caractere ⇒ VALIDARE pe `descriere`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await actualizeazaSesizare({ id: ID_1, descriere: "scurt", urgenta: "medie" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("descriere");
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([
    ["retrageSesizare", () => retrageSesizare({ id: ID_1 })],
    ["inchideSesizare", () => inchideSesizare({ id: ID_1 })],
    [
      "redeschideSesizare",
      () => redeschideSesizare({ id: ID_1, motiv_redeschidere: "Defectul a reapărut." }),
    ],
    [
      "actualizeazaSesizare",
      () =>
        actualizeazaSesizare({
          id: ID_1,
          descriere: "Descriere suficient de lungă.",
          urgenta: "medie",
        }),
    ],
  ])("%s: zero rânduri ⇒ CONFLICT, fără revalidare", async (_nume, apeleaza) => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("fault_reports", "update", { data: null });
    const r = await apeleaza();
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("comenteazaSesizare", () => {
  it("autor cu fișă: INSERT cu `autor_employee_id` și `autor_user_id` null", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("fault_report_comments", "insert", { data: { id: ID_3 } });

    const r = await comenteazaSesizare({
      fault_report_id: ID_1,
      continut: "  Piesa a sosit.  ",
      intern: true,
    });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    expect(server.apeluri.map((a) => `${a.tabela}:${a.operatie}`)).toEqual([
      "employees:select",
      "fault_report_comments:insert",
    ]);
    const [apel] = server.apeluriPe("fault_report_comments", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      fault_report_id: ID_1,
      autor_employee_id: ID_2,
      autor_user_id: null,
      continut: "Piesa a sosit.",
      intern: true,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("single");
    expect(caiRevalidate()).toEqual(
      expect.arrayContaining([`/mentenanta/sesizari/${ID_1}`, `/portal/sesizari/${ID_1}`]),
    );
  });

  it("autor fără fișă: `autor_employee_id` null, `autor_user_id` = utilizatorul", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("employees", "select", { data: null });
    server.raspunde("fault_report_comments", "insert", { data: { id: ID_3 } });

    const r = await comenteazaSesizare({ fault_report_id: ID_1, continut: "Mulțumesc." });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("fault_report_comments", "insert")[0]?.payload).toMatchObject({
      autor_employee_id: null,
      autor_user_id: USER_ID,
      intern: false,
    });
  });

  it("conținut gol ⇒ VALIDARE pe `continut`, zero apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await comenteazaSesizare({ fault_report_id: ID_1, continut: "   " });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("continut");
    expect(server.apeluri).toHaveLength(0);
  });

  it("42501 din politica de INSERT (notă internă a unui raportor): eroare, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("fault_report_comments", "insert", { error: eroarePostgrest("42501") });

    const r = await comenteazaSesizare({
      fault_report_id: ID_1,
      continut: "Notă internă.",
      intern: true,
    });

    expect(r.ok).toBe(false);
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("pregatesteFisier", () => {
  const poza = {
    entity_type: "fault_report",
    entity_id: ID_1,
    numeFisier: "Defect motor.jpg",
    dimensiune: 1000,
    mime: "image/jpeg",
  } as const;

  it("fotografie pe sesizare: numără pozele vii, apoi semnează calea sub prefixul entității", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("maintenance_attachments", "select", { count: 0 });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
      data: { signedUrl: "https://x/semnat", path: "p", token: "t" },
    });

    const r = await pregatesteFisier(poza);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://x/semnat");
    expect(r.data.cale.startsWith(`${ORG_ID}/fault_report/${ID_1}/`)).toBe(true);
    expect(r.data.cale.endsWith("-defect-motor.jpg")).toBe(true);

    const [numarare] = server.apeluriPe("maintenance_attachments", "select");
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(numarare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(numarare, "eq", "entity_id", ID_1)).toBe(true);
    expect(areFiltru(numarare, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriStocare).toHaveLength(1);
    expect(server.apeluriStocare[0]?.argumente[0]).toBe(r.data.cale);
  });

  it("PDF pe sesizare ⇒ VALIDARE, fără numărătoare și fără storage", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await pregatesteFisier({ ...poza, mime: "application/pdf", numeFisier: "a.pdf" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("fotografie peste 5 MB ⇒ VALIDARE", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await pregatesteFisier({ ...poza, dimensiune: 5 * 1024 * 1024 + 1 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("cinci fotografii deja urcate ⇒ CONFLICT, fără apel la storage", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("maintenance_attachments", "select", { count: 5 });

    const r = await pregatesteFisier(poza);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("pe echipament, PDF-ul trece fără numărătoare: direct la storage", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
      data: { signedUrl: "https://x/semnat", path: "p", token: "t" },
    });

    const r = await pregatesteFisier({
      entity_type: "equipment",
      entity_id: ID_2,
      numeFisier: "Carte tehnică.pdf",
      dimensiune: 2_000_000,
      mime: "application/pdf",
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.cale.startsWith(`${ORG_ID}/equipment/${ID_2}/`)).toBe(true);
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriStocare).toHaveLength(1);
  });

  it("eroare la semnare ⇒ CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("maintenance_attachments", "select", { count: 0 });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
      error: { message: "Politica bucketului a refuzat." },
    });

    const r = await pregatesteFisier(poza);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    // Fără drept pe folder, nici curățenie: clientul admin nu se atinge.
    expect(admin.apeluriStocare).toHaveLength(0);
  });

  describe("curățarea încărcărilor neconfirmate (M9)", () => {
    const FOLDER = `${ORG_ID}/fault_report/${ID_1}`;
    const ACUM_2_ZILE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const ACUM_O_ORA = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    function semneaza(server: ReturnType<typeof configureazaActiunea>["server"]): void {
      server.raspunde("maintenance_attachments", "select", { count: 0 });
      server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
        data: { signedUrl: "https://x/semnat", path: "p", token: "t" },
      });
    }

    it("șterge DOAR obiectele vechi de peste 24 h fără rând; cele legate și cele recente rămân", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      semneaza(server);
      admin.raspundeStocare(BUCKET, "list", {
        data: [
          { id: "o1", name: "orfan.jpg", created_at: ACUM_2_ZILE },
          { id: "o2", name: "legat.jpg", created_at: ACUM_2_ZILE },
          { id: "o3", name: "recent.jpg", created_at: ACUM_O_ORA },
          { id: null, name: "subfolder", created_at: null },
        ],
      });
      admin.raspunde("maintenance_attachments", "select", {
        data: [{ storage_path: `${FOLDER}/legat.jpg` }],
      });
      admin.raspundeStocare(BUCKET, "remove", { data: [] });

      const r = await pregatesteFisier(poza);

      expect(r.ok).toBe(true);
      expect(admin.apeluriStocare.map((a) => a.metoda)).toEqual(["list", "remove"]);
      expect(admin.apeluriStocare[0]?.argumente[0]).toBe(FOLDER);
      expect(admin.apeluriStocare[1]?.argumente[0]).toEqual([`${FOLDER}/orfan.jpg`]);

      const [legaturi] = admin.apeluriPe("maintenance_attachments", "select");
      expect(areFiltru(legaturi, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(legaturi, "eq", "entity_type", "fault_report")).toBe(true);
      expect(areFiltru(legaturi, "eq", "entity_id", ID_1)).toBe(true);
      // Rândurile șterse logic țin obiectul în viață: fără filtru pe `deleted_at`.
      expect(areFiltru(legaturi, "is", "deleted_at")).toBe(false);
      expect(
        areFiltru(legaturi, "in", "storage_path", [`${FOLDER}/orfan.jpg`, `${FOLDER}/legat.jpg`]),
      ).toBe(true);
    });

    it("multe obiecte vechi ⇒ legăturile se citesc pe bucăți, ca URL-ul lui `.in()` să rămână scurt", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      semneaza(server);
      const nume = Array.from({ length: 60 }, (_, i) => `vechi-${String(i).padStart(2, "0")}.jpg`);
      admin.raspundeStocare(BUCKET, "list", {
        data: nume.map((n, i) => ({ id: `o${String(i)}`, name: n, created_at: ACUM_2_ZILE })),
      });
      // Primul obiect e legat; celelalte 59 sunt orfane.
      admin.raspunde("maintenance_attachments", "select", {
        data: [{ storage_path: `${FOLDER}/vechi-00.jpg` }],
      });
      admin.raspunde("maintenance_attachments", "select", { data: [] });
      admin.raspunde("maintenance_attachments", "select", { data: [] });
      admin.raspundeStocare(BUCKET, "remove", { data: [] });

      const r = await pregatesteFisier(poza);

      expect(r.ok).toBe(true);
      const citiri = admin.apeluriPe("maintenance_attachments", "select");
      expect(citiri.length).toBeGreaterThan(1);
      for (const c of citiri) {
        const filtru = c.filtre.find((f) => f.metoda === "in" && f.argumente[0] === "storage_path");
        const valori = filtru?.argumente[1];
        expect(Array.isArray(valori)).toBe(true);
        expect((valori as readonly string[]).length).toBeLessThanOrEqual(25);
      }
      const sterse = admin.apeluriStocare.find((a) => a.metoda === "remove")?.argumente[0];
      expect(sterse).toHaveLength(59);
      expect(sterse).not.toContain(`${FOLDER}/vechi-00.jpg`);
    });

    it("niciun obiect vechi ⇒ nicio citire de rânduri și nicio ștergere", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      semneaza(server);
      admin.raspundeStocare(BUCKET, "list", {
        data: [{ id: "o3", name: "recent.jpg", created_at: ACUM_O_ORA }],
      });

      const r = await pregatesteFisier(poza);

      expect(r.ok).toBe(true);
      expect(admin.apeluriStocare.map((a) => a.metoda)).toEqual(["list"]);
      expect(admin.apeluri).toHaveLength(0);
    });

    it("listarea eșuează ⇒ încărcarea merge mai departe, fără ștergere", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      semneaza(server);
      admin.raspundeStocare(BUCKET, "list", { error: { message: "Storage indisponibil." } });

      const r = await pregatesteFisier(poza);

      expect(r).toMatchObject({ ok: true, data: { urlSemnat: "https://x/semnat" } });
      expect(admin.apeluriStocare.map((a) => a.metoda)).toEqual(["list"]);
    });

    it("o excepție în curățenie nu strică încărcarea", async () => {
      const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      semneaza(server);
      // Niciun răspuns programat pe admin: clientul fals respinge promisiunea.

      const r = await pregatesteFisier(poza);

      expect(r.ok).toBe(true);
    });
  });

  // M6: procesul-verbal urcă pe `{org}/intervention/{id generat în browser}/`
  // ÎNAINTE de intervenție. O casetă închisă fără trimitere (sau un fișier
  // schimbat, care primește alt id) lasă folderul unei intervenții care nu va
  // exista niciodată — curățarea pe entitate n-ar mai ajunge la el, fiindcă
  // id-ul nu se refolosește. Se mătură la următoarea rezervare din firmă.
  describe("rezervările abandonate ale intervențiilor (M6)", () => {
    const RADACINA = `${ORG_ID}/intervention`;
    const ACUM_2_ZILE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const pv = {
      entity_type: "intervention",
      entity_id: ID_1,
      numeFisier: "PV verificare.pdf",
      dimensiune: 2_000_000,
      mime: "application/pdf",
    } as const;

    it("folderul unei intervenții inexistente: obiectele vechi fără rând se șterg; al unei intervenții reale nu se atinge", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
        data: { signedUrl: "https://x/semnat", path: "p", token: "t" },
      });
      // 1) folderul rezervării curente (gol), 2) rădăcina intervențiilor firmei.
      admin.raspundeStocare(BUCKET, "list", { data: [] });
      admin.raspundeStocare(BUCKET, "list", {
        data: [
          { id: null, name: ID_1, created_at: null },
          { id: null, name: ID_2, created_at: null },
          { id: null, name: ID_3, created_at: null },
          { id: "f", name: "ratacit.pdf", created_at: ACUM_2_ZILE },
        ],
      });
      admin.raspunde("maintenance_interventions", "select", { data: [{ id: ID_3 }] });
      // 3) folderul rezervării abandonate.
      admin.raspundeStocare(BUCKET, "list", {
        data: [{ id: "o1", name: "pv-vechi.pdf", created_at: ACUM_2_ZILE }],
      });
      admin.raspunde("maintenance_attachments", "select", { data: [] });
      admin.raspundeStocare(BUCKET, "remove", { data: [] });

      const r = await pregatesteFisier(pv);

      expect(r.ok).toBe(true);
      const listari = admin.apeluriStocare.filter((a) => a.metoda === "list");
      expect(listari.map((a) => a.argumente[0])).toEqual([
        `${RADACINA}/${ID_1}`,
        RADACINA,
        `${RADACINA}/${ID_2}`,
      ]);
      const [existente] = admin.apeluriPe("maintenance_interventions", "select");
      expect(areFiltru(existente, "eq", "organization_id", ORG_ID)).toBe(true);
      // Rezervarea în curs (ID_1) nu se verifică și nu se mătură.
      expect(areFiltru(existente, "in", "id", [ID_2, ID_3])).toBe(true);
      const sterse = admin.apeluriStocare.find((a) => a.metoda === "remove")?.argumente[0];
      expect(sterse).toEqual([`${RADACINA}/${ID_2}/pv-vechi.pdf`]);
    });

    it("nicio rezervare abandonată ⇒ nicio ștergere", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
        data: { signedUrl: "https://x/semnat", path: "p", token: "t" },
      });
      admin.raspundeStocare(BUCKET, "list", { data: [] });
      admin.raspundeStocare(BUCKET, "list", {
        data: [{ id: null, name: ID_3, created_at: null }],
      });
      admin.raspunde("maintenance_interventions", "select", { data: [{ id: ID_3 }] });

      const r = await pregatesteFisier(pv);

      expect(r.ok).toBe(true);
      expect(admin.apeluriStocare.map((a) => a.metoda)).toEqual(["list", "list"]);
    });

    it("pe o sesizare nu se mătură rădăcina intervențiilor", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: CITIRE_OWN });
      server.raspunde("maintenance_attachments", "select", { count: 0 });
      server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
        data: { signedUrl: "https://x/semnat", path: "p", token: "t" },
      });
      admin.raspundeStocare(BUCKET, "list", { data: [] });

      const r = await pregatesteFisier(poza);

      expect(r.ok).toBe(true);
      expect(admin.apeluriStocare.map((a) => a.argumente[0])).toEqual([
        `${ORG_ID}/fault_report/${ID_1}`,
      ]);
    });
  });
});

describe("confirmaFisier", () => {
  const intrare = {
    entity_type: "fault_report",
    entity_id: ID_1,
    cale: `${ORG_ID}/fault_report/${ID_1}/poza.png`,
    denumire: "Poză defect",
    tip: "manual",
  } as const;

  it.each([
    ["alt id de entitate", `${ORG_ID}/fault_report/${ID_2}/x.jpg`],
    ["traversare cu `..`", `${ORG_ID}/fault_report/${ID_1}/..x.jpg`],
    ["segment suplimentar", `${ORG_ID}/fault_report/${ID_1}/sub/x.jpg`],
    ["cale goală după prefix", `${ORG_ID}/fault_report/${ID_1}/`],
  ])("cale în afara prefixului (%s): VALIDARE, fără storage", async (_n, cale) => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const r = await confirmaFisier({ ...intrare, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("`info` cu eroare: CONFLICT, niciun INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspundeStocare(BUCKET, "info", { error: { message: "Obiectul nu există." } });
    const r = await confirmaFisier(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("maintenance_attachments")).toHaveLength(0);
  });

  it("`info` fără date: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspundeStocare(BUCKET, "info", { data: null });
    const r = await confirmaFisier(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("pe sesizare: mărimea și tipul din Storage, `tip` forțat la `foto`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspundeStocare(BUCKET, "info", { data: { size: 2048, contentType: "image/png" } });
    server.raspunde("maintenance_attachments", "insert", { data: { id: ID_3 } });

    const r = await confirmaFisier(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("maintenance_attachments", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      entity_type: "fault_report",
      entity_id: ID_1,
      storage_path: intrare.cale,
      denumire: "Poză defect",
      tip: "foto",
      mime: "image/png",
      marime_bytes: 2048,
      created_by: USER_ID,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("single");
    expect(server.apeluriStocare[0]?.argumente[0]).toBe(intrare.cale);
    expect(caiRevalidate()).toEqual(
      expect.arrayContaining([`/mentenanta/sesizari/${ID_1}`, `/portal/sesizari/${ID_1}`]),
    );
  });

  it("pe echipament, `tip` rămâne cel trimis, iar revalidarea merge pe echipament", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    const cale = `${ORG_ID}/equipment/${ID_2}/carte.pdf`;
    server.raspundeStocare(BUCKET, "info", {
      data: { size: 4096, contentType: "application/pdf" },
    });
    server.raspunde("maintenance_attachments", "insert", { data: { id: ID_3 } });

    const r = await confirmaFisier({
      entity_type: "equipment",
      entity_id: ID_2,
      cale,
      denumire: "Carte tehnică",
      tip: "carte_tehnica",
    });

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("maintenance_attachments", "insert")[0]?.payload).toMatchObject({
      tip: "carte_tehnica",
      mime: "application/pdf",
      marime_bytes: 4096,
    });
    expect(caiRevalidate()).toEqual([`/mentenanta/echipamente/${ID_2}`, "/mentenanta/interventii"]);
  });
});

describe("stergeFisier", () => {
  it("ștergere logică: `deleted_at` singura cheie, pe id + organizație + rând viu", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("maintenance_attachments", "update", { data: { id: ID_1 } });

    const r = await stergeFisier({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("maintenance_attachments", "update");
    expect(Object.keys(apel?.payload as Record<string, unknown>)).toEqual(["deleted_at"]);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
  });

  it("zero rânduri: NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("maintenance_attachments", "update", { data: null });
    const r = await stergeFisier({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("inchideOprire", () => {
  it("UPDATE cu `sfarsit` trimis, doar pe opriri vii și deschise", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("equipment_opriri", "update", { data: { id: ID_1 } });

    const r = await inchideOprire({ id: ID_1, sfarsit: SFARSIT });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("equipment_opriri", "update");
    expect(apel?.payload).toEqual({ sfarsit: SFARSIT });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "sfarsit", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
  });

  it("`sfarsit: null` generează momentul curent, în format ISO", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("equipment_opriri", "update", { data: { id: ID_1 } });

    await inchideOprire({ id: ID_1, sfarsit: null });

    const payload = server.apeluriPe("equipment_opriri", "update")[0]?.payload as {
      sfarsit: string;
    };
    expect(payload.sfarsit).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("zero rânduri: CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE_OWN });
    server.raspunde("equipment_opriri", "update", { data: null });
    const r = await inchideOprire({ id: ID_1, sfarsit: SFARSIT });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("inregistreazaOprire", () => {
  it("INSERT cu `organization_id` adăugat și valorile implicite ale schemei", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    server.raspunde("equipment_opriri", "insert", { data: { id: ID_3 } });

    const r = await inregistreazaOprire({ equipment_id: ID_2, inceput: INCEPUT });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("equipment_opriri", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      equipment_id: ID_2,
      inceput: INCEPUT,
      sfarsit: null,
      tip: "neplanificata",
      motiv: null,
    });
    expect(apel?.terminal).toBe("single");
    expect(caiRevalidate()).toEqual([`/mentenanta/echipamente/${ID_2}`, "/mentenanta"]);
  });

  it("`sfarsit` înaintea lui `inceput` ⇒ VALIDARE pe `sfarsit`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE_TEAM });
    const r = await inregistreazaOprire({ equipment_id: ID_2, inceput: SFARSIT, sfarsit: INCEPUT });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("sfarsit");
    expect(server.apeluri).toHaveLength(0);
  });

  it("`maintenance:update` own < team: INTERZIS", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await inregistreazaOprire({ equipment_id: ID_2, inceput: INCEPUT });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("salveazaSetariMentenanta", () => {
  const SETARI = { "maintenance:update": "all" } as const;

  it("`maintenance:update` team < all: INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: UPDATE_TEAM });
    const r = await salveazaSetariMentenanta({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără rând existent: INSERT cu `organization_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: SETARI });
    server.raspunde("maintenance_settings", "select", { data: null });
    server.raspunde("maintenance_settings", "insert", { data: { id: ID_3 } });

    const r = await salveazaSetariMentenanta({ inchidere_automata_zile: "7" });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    expect(server.apeluri.map((a) => `${a.tabela}:${a.operatie}`)).toEqual([
      "maintenance_settings:select",
      "maintenance_settings:insert",
    ]);
    const [citire] = server.apeluriPe("maintenance_settings", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("maintenance_settings", "insert")[0]?.payload).toMatchObject({
      organization_id: ORG_ID,
      inchidere_automata_zile: 7,
      prag_avertizare_zile: 15,
    });
    expect(caiRevalidate()).toEqual(["/mentenanta", "/mentenanta/setari"]);
  });

  it("cu rând existent: UPDATE pe id + organizație, nu INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: SETARI });
    server.raspunde("maintenance_settings", "select", { data: { id: ID_2 } });
    server.raspunde("maintenance_settings", "update", { data: { id: ID_2 } });

    const r = await salveazaSetariMentenanta({ inchidere_automata_zile: 10 });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    expect(server.apeluriPe("maintenance_settings", "insert")).toHaveLength(0);
    const [apel] = server.apeluriPe("maintenance_settings", "update");
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.payload).toMatchObject({ inchidere_automata_zile: 10 });
    expect(apel?.selectDupaScriere).toBeDefined();
  });

  it("UPDATE cu zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: SETARI });
    server.raspunde("maintenance_settings", "select", { data: { id: ID_2 } });
    server.raspunde("maintenance_settings", "update", { data: null });
    const r = await salveazaSetariMentenanta({});
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("pragurile de alertă: implicit 30/14/7; dublurile și ordinea se normalizează", async () => {
    const { server } = configureazaActiunea({ permisiuni: SETARI });
    server.raspunde("maintenance_settings", "select", { data: { id: ID_2 } });
    server.raspunde("maintenance_settings", "update", { data: { id: ID_2 } });
    server.raspunde("maintenance_settings", "select", { data: null });
    server.raspunde("maintenance_settings", "insert", { data: { id: ID_3 } });

    await salveazaSetariMentenanta({ praguri_alerta_zile: ["7", "30", "7", "3"] });
    await salveazaSetariMentenanta({});

    expect(server.apeluriPe("maintenance_settings", "update")[0]?.payload).toMatchObject({
      praguri_alerta_zile: [30, 7, 3],
    });
    expect(server.apeluriPe("maintenance_settings", "insert")[0]?.payload).toMatchObject({
      praguri_alerta_zile: [30, 14, 7],
    });
  });

  it("auditul acțiunii poartă pragurile noi, normalizate", async () => {
    const { server } = configureazaActiunea({ permisiuni: SETARI });
    server.raspunde("maintenance_settings", "select", { data: { id: ID_2 } });
    server.raspunde("maintenance_settings", "update", { data: { id: ID_2 } });

    await salveazaSetariMentenanta({ praguri_alerta_zile: ["7", "60"] });
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success" });
    expect(audit?.p_after).toMatchObject({ praguri_alerta_zile: [60, 7] });
  });

  it.each([
    ["gol", []],
    ["nenumeric", ["30", "abc"]],
    ["zero", ["0"]],
    ["peste un an", ["400"]],
    ["fracționar", ["7.5"]],
    ["nouă praguri", ["1", "2", "3", "4", "5", "6", "7", "8", "9"]],
  ])("prag de alertă %s ⇒ VALIDARE pe câmp, zero apeluri", async (_caz, praguri) => {
    const { server } = configureazaActiunea({ permisiuni: SETARI });
    const r = await salveazaSetariMentenanta({ praguri_alerta_zile: praguri });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("praguri_alerta_zile");
    expect(server.apeluri).toHaveLength(0);
  });

  it("`inchidere_automata_zile: 0` ⇒ VALIDARE, zero apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: SETARI });
    const r = await salveazaSetariMentenanta({ inchidere_automata_zile: 0 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("inchidere_automata_zile");
    expect(server.apeluri).toHaveLength(0);
  });
});
