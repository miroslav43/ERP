// src/app/(app)/registru/actions.test.ts
//
// Acțiunile registrului de înregistrare. Niciuna nu inserează în
// `registru_documente` (grantul e revocat din 0135): numerele vin din RPC-uri,
// iar nomenclatorul se scrie prin UPDATE cu `.select()` și prin upsert.
// Straturile comune ale lui `createAction` sunt în `salarizare/actions.test.ts`.

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
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaAvizNomenclator,
  actualizeazaDosarNomenclator,
  inchideExercitiu,
  inregistreazaDocumentManual,
  redeschideExercitiu,
} from "./actions";

const SCRIERE = { "registru:update": "all" } as const;
const ORGANIZATIE = { "organizations:update": "all" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const intrareManuala = {
  sens: "intrare",
  tip_document: "demisie",
  continut_rezumat: "  Demisia lui Ion Popescu  ",
  numar_document_emitent: "12",
  data_document_emitent: "2026-09-01",
  emitent: "Ion Popescu",
  numar_file: "2",
  numar_anexe: "",
  punct_lucru_id: "",
};

describe("inregistreazaDocumentManual", () => {
  it("fără `registru:update`: INTERZIS, fără niciun apel spre bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "registru:read": "all" } });
    const r = await inregistreazaDocumentManual(intrareManuala);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("scope `team` sub pragul `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "registru:update": "team" } });
    const r = await inregistreazaDocumentManual(intrareManuala);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("numărul vine din RPC, cu organizația din sesiune și câmpurile normalizate", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspundeRpc("inregistreaza_document_manual", { data: "437/02.09.2026" });

    const r = await inregistreazaDocumentManual(intrareManuala);

    expect(r).toEqual({ ok: true, data: { numarAfisat: "437/02.09.2026" } });
    const apel = server.apeluriRpc.find((a) => a.nume === "inregistreaza_document_manual");
    expect(apel?.argumente).toEqual({
      p_organization_id: ORG_ID,
      p_sens: "intrare",
      p_tip_document: "demisie",
      p_continut_rezumat: "Demisia lui Ion Popescu",
      p_numar_document_emitent: "12",
      p_data_document_emitent: "2026-09-01",
      p_emitent: "Ion Popescu",
      p_numar_file: 2,
      p_numar_anexe: null,
      p_punct_lucru_id: null,
    });
    // Nicio scriere directă în registru: grantul de INSERT e revocat.
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/registru"]);
  });

  it("auditul de succes păstrează doar câmpurile din allow-list", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspundeRpc("inregistreaza_document_manual", { data: "1/02.01.2026" });

    await inregistreazaDocumentManual(intrareManuala);
    await asteaptaDupa();

    const [audit] = server.audituri().filter((a) => a.p_status === "success");
    expect(audit).toMatchObject({ p_action: "create", p_entity_type: "registru_document" });
    expect(Object.keys(audit?.p_after as object).sort()).toEqual(
      ["continut_rezumat", "emitent", "numar_document_emitent", "sens", "tip_document"].sort(),
    );
  });

  it("o ieșire introdusă de mână e oprită de schemă, înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const r = await inregistreazaDocumentManual({ ...intrareManuala, sens: "iesire" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("sens");
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it.each([
    ["numar_file", "-1"],
    ["numar_file", "2.5"],
    ["numar_anexe", "10000"],
    ["data_document_emitent", "01.09.2026"],
    ["punct_lucru_id", "nu-e-uuid"],
    ["continut_rezumat", "ab"],
    ["tip_document", "Demisie"],
  ])("câmpul `%s` = %j e respins de schemă", async (camp, valoare) => {
    configureazaActiunea({ permisiuni: SCRIERE });
    const r = await inregistreazaDocumentManual({ ...intrareManuala, [camp]: valoare });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
  });

  it("P0001 din bază (an închis): CONFLICT cu mesajul bazei, nu cu cel generic", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const mesaj = "Registrul pe anul 2025 este închis.";
    server.raspundeRpc("inregistreaza_document_manual", { error: eroarePostgrest("P0001", mesaj) });

    const r = await inregistreazaDocumentManual(intrareManuala);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("23505 pe indexul numărului: CONFLICT cu îndemn la reîncercare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspundeRpc("inregistreaza_document_manual", {
      error: eroarePostgrest("23505", 'duplicate key value violates "registru_org_an_numar_uniq"'),
    });
    const r = await inregistreazaDocumentManual(intrareManuala);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Numărul acesta de înregistrare există deja pe anul curent. Reîncercați.",
      },
    });
  });
});

describe("inchideExercitiu", () => {
  it("fără `registru:update` la `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "registru:update": "team" } });
    const r = await inchideExercitiu({ an: 2025 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("închiderea întoarce amprenta calculată de bază, pe anul cerut", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspundeRpc("inchide_exercitiu_registru", { data: "ab12cd" });

    const r = await inchideExercitiu({ an: "2025" });

    expect(r).toEqual({ ok: true, data: { amprenta: "ab12cd" } });
    const apel = server.apeluriRpc.find((a) => a.nume === "inchide_exercitiu_registru");
    expect(apel?.argumente).toEqual({ p_organization_id: ORG_ID, p_an: 2025 });
    expect(caiRevalidate()).toEqual(["/registru"]);
  });

  it("anul în afara intervalului 2000–2200 nu ajunge la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const r = await inchideExercitiu({ an: 1999 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("P0001 (anul nu s-a încheiat): CONFLICT cu textul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const mesaj = "Exercițiul 2026 nu se poate închide înainte de 31 decembrie.";
    server.raspundeRpc("inchide_exercitiu_registru", { error: eroarePostgrest("P0001", mesaj) });
    const r = await inchideExercitiu({ an: 2026 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("redeschideExercitiu", () => {
  it("`registru:update` NU ajunge: redeschiderea cere `organizations:update`", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const r = await redeschideExercitiu({ an: 2025, motiv: "Corectură la control" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("scope `team` pe `organizations:update`: INTERZIS", async () => {
    configureazaActiunea({ permisiuni: { "organizations:update": "team" } });
    const r = await redeschideExercitiu({ an: 2025, motiv: "Corectură la control" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it("trimite anul și motivul, întoarce null și revalidează registrul", async () => {
    const { server } = configureazaActiunea({ permisiuni: ORGANIZATIE });
    server.raspundeRpc("redeschide_exercitiu_registru", { data: null });

    const r = await redeschideExercitiu({ an: 2025, motiv: "  Corectură la control  " });

    expect(r).toEqual({ ok: true, data: null });
    const apel = server.apeluriRpc.find((a) => a.nume === "redeschide_exercitiu_registru");
    expect(apel?.argumente).toEqual({
      p_organization_id: ORG_ID,
      p_an: 2025,
      p_motiv: "Corectură la control",
    });
    expect(caiRevalidate()).toEqual(["/registru"]);
  });

  it("motivul sub trei caractere e respins: redeschiderea cere un motiv", async () => {
    configureazaActiunea({ permisiuni: ORGANIZATIE });
    const r = await redeschideExercitiu({ an: 2025, motiv: "ok" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("motiv");
  });

  it("eroare nerecunoscută (nu PostgREST) din RPC: EROARE_INTERNA, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: ORGANIZATIE });
    server.raspundeRpc("redeschide_exercitiu_registru", { error: new Error("rețea") });
    const r = await redeschideExercitiu({ an: 2025, motiv: "Corectură la control" });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("actualizeazaDosarNomenclator", () => {
  const intrare = { id: ID_1, continut: "  Dosare de personal  ", termen_pastrare: "75 ani" };

  it("fără `registru:update`: INTERZIS și nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "registru:read": "all" } });
    const r = await actualizeazaDosarNomenclator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE pe id + organizație + rând viu, doar conținut și termen, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("nomenclator_dosare", "update", { data: { id: ID_1 } });

    const r = await actualizeazaDosarNomenclator(intrare);

    expect(r).toEqual({ ok: true, data: null });
    const [apel, ...altele] = server.apeluriPe("nomenclator_dosare");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("update");
    // Indicativul e coloană GENERATĂ: nu are voie să apară în payload.
    expect(apel?.payload).toEqual({ continut: "Dosare de personal", termen_pastrare: "75 ani" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(["/registru", "/registru/nomenclator"]);
  });

  it("zero rânduri (alt chiriaș sau rând șters): NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("nomenclator_dosare", "update", { data: null });
    const r = await actualizeazaDosarNomenclator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("23505 pe `nomenclator_dosare_uq`: mesajul spune că indicativul există deja", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("nomenclator_dosare", "update", {
      error: eroarePostgrest("23505", 'violates unique constraint "nomenclator_dosare_uq"'),
    });
    const r = await actualizeazaDosarNomenclator(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja un dosar cu acest indicativ în nomenclator.",
      },
    });
  });

  it("termenul de păstrare peste 20 de caractere e respins de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    const r = await actualizeazaDosarNomenclator({ ...intrare, termen_pastrare: "x".repeat(21) });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaAvizNomenclator", () => {
  const intrare = {
    avizat_la: "2026-05-04",
    numar_aviz: "  1234  ",
    directia_judeteana: "Cluj",
    observatii: "",
  };

  it("fără `registru:update` la `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "registru:update": "own" } });
    const r = await actualizeazaAvizNomenclator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("upsert pe cheia de firmă, cu organizația din sesiune și golurile ca null", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("nomenclator_config", "upsert", { data: null });

    const r = await actualizeazaAvizNomenclator({ ...intrare, organization_id: "fals" });

    expect(r).toEqual({ ok: true, data: null });
    const [apel] = server.apeluriPe("nomenclator_config");
    expect(apel?.operatie).toBe("upsert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      avizat_la: "2026-05-04",
      numar_aviz: "1234",
      directia_judeteana: "Cluj",
      observatii: null,
    });
    expect(apel?.optiuni).toEqual({ onConflict: "organization_id" });
    expect(caiRevalidate()).toEqual(["/registru", "/registru/nomenclator"]);
  });

  it("42501 (scriere respinsă de politică): refuz, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("nomenclator_config", "upsert", { error: eroarePostgrest("42501") });
    const r = await actualizeazaAvizNomenclator(intrare);
    expect(r.ok).toBe(false);
    expect(caiRevalidate()).toEqual([]);
  });

  // `traduEroare` dădea la ORICE 42501 textul scris pentru INSERT-ul direct în
  // `registru_documente`. Pe un upsert în `nomenclator_config` îl trimitea pe
  // utilizator spre „înregistrarea manuală”, fără legătură cu avizul.
  it("42501 pe nomenclator iese INTERZIS, fără mesajul despre numerele de registru", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("nomenclator_config", "upsert", {
      error: eroarePostgrest("42501", "permission denied for table nomenclator_config"),
    });
    const r = await actualizeazaAvizNomenclator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    if (r.ok) return;
    expect(r.error.message).not.toContain("Numerele de înregistrare");
  });
});
