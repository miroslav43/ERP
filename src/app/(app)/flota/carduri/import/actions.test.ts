// src/app/(app)/flota/carduri/import/actions.test.ts
//
// Importul extraselor de card (0214, F12b), pe clientul fals: calea verificată
// sub prefixul firmei, sursa ștearsă ÎNAINTEA parsării, refuzul la peste 1000
// de rânduri, pasul de mapare fără lot urcat și fără numere întregi în
// eșantion, aplicarea care filtrează cheile existente, reluarea rând cu rând la
// 23505, reluarea de la offset 0 fără dublarea lotului și anularea importului.
// Politicile RLS sunt în `tests/rls/proba-flota-carduri.sql`.

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

import { configureazaActiunea, ID_1, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import type { LotExtras } from "@/schemas/fleet-carduri";

import { analizeazaExtras, anuleazaImport, aplicaImportExtras } from "./actions";

const BUCKET = "org-documents";
const LOT = "88888888-8888-4888-8888-888888888888";
const CALE = `${ORG_ID}/vehicles/${LOT}/99999999-9999-4999-8999-999999999999-extras.csv`;
const PERMISIUNI = {
  "vehicles:create": "all",
  "vehicles:update": "all",
  "vehicles:read": "all",
} as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function csv(text: string): Blob {
  return new Blob([new TextEncoder().encode(text)], { type: "text/csv" });
}

const EXTRAS =
  "Numar card;Data;Produs;Cantitate;Valoare;Statie\n" +
  "7002 5100 0000 1234;05.10.2026 14:02;Motorina;52,30;380,15;OMV Pipera\n" +
  "7002 5100 0000 1234;06.10.2026 09:10;AdBlue;10,00;45,00;OMV Pipera\n" +
  "Total;;;;425,15;\n";

/** Citirile pe care le face analiza după parsare, cu baza goală. */
function citiriAnaliza(server: ClientFals): void {
  server.raspunde("fuel_card_import_profiles", "select", { data: null });
  server.raspunde("fuel_card_transactions", "select", { data: [] });
  server.raspunde("fuel_cards", "select", { data: [], count: 0 });
  server.raspunde("vehicles", "select", { data: [], count: 0 });
  server.raspunde("vehicle_assignments", "select", { data: [], count: 0 });
  server.raspunde("trip_sheets", "select", { data: [], count: 0 });
  server.raspunde("fuel_card_imports", "select", { data: [] });
}

describe("analizeazaExtras", () => {
  it("calea în afara prefixului lotului: VALIDARE, fără descărcare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    const r = await analizeazaExtras({
      batchId: LOT,
      cale: `${ORG_ID}/vehicles/${LOT}/../../${ID_1}/employees/x.csv`,
      emitent: "omv_petrom",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(admin.apeluriStocare).toHaveLength(0);
  });

  it("sursa se șterge cu clientul admin ÎNAINTE de parsare, chiar dacă fișierul e greșit", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspundeStocare(BUCKET, "download", {
      data: csv("doar un rând fără date"),
    });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });
    server.raspunde("fuel_card_import_profiles", "select", { data: null });

    const r = await analizeazaExtras({
      batchId: LOT,
      cale: CALE,
      emitent: "omv_petrom",
    });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(admin.apeluriStocare).toEqual([
      { bucket: BUCKET, metoda: "remove", argumente: [[CALE]] },
    ]);
  });

  it("peste 1000 de rânduri: refuz explicit, nu trunchiere", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    const linii = ["Numar card;Data;Produs;Valoare"];
    for (let i = 0; i < 1001; i += 1) linii.push(`1234;05.10.2026;Motorina;${String(i)}`);
    server.raspundeStocare(BUCKET, "download", { data: csv(linii.join("\n")) });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });
    server.raspunde("fuel_card_import_profiles", "select", { data: null });

    const r = await analizeazaExtras({
      batchId: LOT,
      cale: CALE,
      emitent: "omv_petrom",
    });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", message: expect.stringContaining("1000") },
    });
    expect(server.apeluriStocare.some((a) => a.metoda === "upload")).toBe(false);
  });

  it("coloane nerecunoscute: cere maparea, NU urcă lotul, iar eșantionul n-are numere întregi", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspundeStocare(BUCKET, "download", {
      data: csv("Col A;Col B;Col C\n7002 5100 0000 1234;05.10.2026;12,50\n"),
    });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });
    server.raspunde("fuel_card_import_profiles", "select", { data: null });

    const r = await analizeazaExtras({
      batchId: LOT,
      cale: CALE,
      emitent: "omv_petrom",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cereMapare).toBe(true);
    if (!r.data.cereMapare) return;
    expect(r.data.antet).toEqual(["Col A", "Col B", "Col C"]);
    const eșantion = JSON.stringify(r.data.esantion);
    expect(eșantion).toContain("•••• 1234");
    expect(/\d{12,}/u.test(eșantion.replace(/[\s-]/gu, ""))).toBe(false);
    expect(server.apeluriStocare.some((a) => a.metoda === "upload")).toBe(false);
  });

  it("extras recunoscut: lotul urcat fără numere întregi, rândul de total respins, AdBlue nu e combustibil", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspundeStocare(BUCKET, "download", { data: csv(EXTRAS) });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });
    citiriAnaliza(server);
    server.raspundeStocare(BUCKET, "upload", { data: { path: "x" } });

    const r = await analizeazaExtras({
      batchId: LOT,
      cale: CALE,
      emitent: "omv_petrom",
    });

    expect(r.ok).toBe(true);
    if (!r.ok || r.data.cereMapare) throw new Error("trebuia previzualizare");
    expect(r.data).toMatchObject({
      deImportat: 2,
      duplicate: 0,
      numarRespinse: 1,
      perioadaDeLa: "2026-10-05",
      perioadaPanaLa: "2026-10-06",
      peStare: { card_necunoscut: 2 },
    });
    const urcare = server.apeluriStocare.find((a) => a.metoda === "upload");
    expect(urcare?.argumente[0]).toBe(`${ORG_ID}/vehicles/${LOT}/lot-card.json`);
    const lot = JSON.parse(await (urcare?.argumente[1] as Blob).text()) as LotExtras;
    expect(JSON.stringify(lot)).not.toContain("7002510000001234");
    expect(lot.randuri.map((x) => x.categorie)).toEqual(["combustibil", "adblue"]);
    expect(lot.randuri[0]?.cifreCard).toBe("001234");
    expect(lot.randuri[0]?.amprentaCard).toMatch(/^[0-9a-f]{64}$/u);
    // Upload fără `upsert`: alt batchId la fiecare analiză.
    expect(urcare?.argumente[2]).not.toHaveProperty("upsert");
  });

  it("cheile deja importate se numără ca duplicate și nu se potrivesc din nou", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspundeStocare(BUCKET, "download", { data: csv(EXTRAS) });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });
    // Prima cheie există deja: o aflăm întâi dintr-o analiză curată.
    citiriAnaliza(server);
    server.raspundeStocare(BUCKET, "upload", { data: { path: "x" } });
    const prima = await analizeazaExtras({
      batchId: LOT,
      cale: CALE,
      emitent: "omv_petrom",
    });
    if (!prima.ok || prima.data.cereMapare) throw new Error("trebuia previzualizare");
    const urcare = server.apeluriStocare.find((a) => a.metoda === "upload");
    const lot = JSON.parse(await (urcare?.argumente[1] as Blob).text()) as LotExtras;

    const { server: s2, admin: a2 } = configureazaActiunea({
      permisiuni: PERMISIUNI,
    });
    s2.raspundeStocare(BUCKET, "download", { data: csv(EXTRAS) });
    a2.raspundeStocare(BUCKET, "remove", { data: [] });
    s2.raspunde("fuel_card_import_profiles", "select", { data: null });
    s2.raspunde("fuel_card_transactions", "select", {
      data: [{ cheie_dedup: lot.randuri[0]?.cheie }],
    });
    s2.raspunde("fuel_cards", "select", { data: [], count: 0 });
    s2.raspunde("vehicles", "select", { data: [], count: 0 });
    s2.raspunde("vehicle_assignments", "select", { data: [], count: 0 });
    s2.raspunde("trip_sheets", "select", { data: [], count: 0 });
    s2.raspunde("fuel_card_imports", "select", {
      data: [{ id: ID_1, created_at: "2026-10-07T10:00:00Z" }],
    });
    s2.raspundeStocare(BUCKET, "upload", { data: { path: "x" } });

    const doua = await analizeazaExtras({
      batchId: LOT,
      cale: CALE,
      emitent: "omv_petrom",
    });
    if (!doua.ok || doua.data.cereMapare) throw new Error("trebuia previzualizare");
    expect(doua.data).toMatchObject({
      deImportat: 1,
      duplicate: 1,
      importatDejaLa: ["2026-10-07T10:00:00Z"],
    });
  });
});

function lotDeTest(chei: readonly string[]): LotExtras {
  return {
    versiune: 1,
    emitent: "omv_petrom",
    fisierNume: "extras.csv",
    fisierSha256: "a".repeat(64),
    perioadaDeLa: "2026-10-05",
    perioadaPanaLa: "2026-10-05",
    randuriFisier: chei.length,
    respinse: 0,
    randuri: chei.map((cheie, i) => ({
      rand: i + 2,
      cheie,
      idTranzactie: null,
      cifreCard: "1234",
      amprentaCard: null,
      nrInmatriculare: null,
      efectuatLa: "2026-10-05T11:02:00.000Z",
      dataRo: "2026-10-05",
      areOra: true,
      produs: "Motorină",
      categorie: "combustibil",
      tipCombustibil: "motorina",
      cantitate: 50,
      pretUnitar: null,
      valoareBruta: 350,
      valoareNeta: null,
      tva: null,
      moneda: "RON",
      statie: null,
      localitate: null,
      tara: null,
      kmDeclarat: null,
      numarBon: null,
    })),
  };
}

function lotInStocare(server: ClientFals, lot: LotExtras): void {
  server.raspundeStocare(BUCKET, "download", {
    data: new Blob([JSON.stringify(lot)], { type: "application/json" }),
  });
}

/** Citirile potrivirii, cu baza goală (nicio foaie, niciun card). */
function citiriPotrivire(server: ClientFals): void {
  server.raspunde("fuel_cards", "select", { data: [], count: 0 });
  server.raspunde("vehicles", "select", { data: [], count: 0 });
  server.raspunde("vehicle_assignments", "select", { data: [], count: 0 });
  server.raspunde("trip_sheets", "select", { data: [], count: 0 });
}

describe("aplicaImportExtras", () => {
  it("offset 0: creează lotul cu id = batchId, filtrează cheile existente, scrie restul", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    lotInStocare(server, lotDeTest(["h:a#1", "h:b#1"]));
    server.raspunde("fuel_card_imports", "select", { data: null });
    server.raspunde("fuel_card_imports", "insert", {});
    server.raspunde("fuel_card_transactions", "select", {
      data: [{ cheie_dedup: "h:a#1" }],
    });
    citiriPotrivire(server);
    server.raspunde("fuel_card_transactions", "insert", {
      data: [{ id: ID_1 }],
    });
    server.raspunde("fuel_card_transactions", "select", { count: 1 });
    server.raspunde("fuel_card_imports", "update", { data: { id: LOT } });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });

    const r = await aplicaImportExtras({ batchId: LOT, offset: 0 });

    expect(r).toEqual({
      ok: true,
      data: {
        procesate: 2,
        importate: 1,
        duplicate: 1,
        urmator: 2,
        total: 2,
        gata: true,
      },
    });
    const [lot] = server.apeluriPe("fuel_card_imports", "insert");
    expect(lot?.payload).toMatchObject({
      id: LOT,
      organization_id: ORG_ID,
      fisier_sha256: "a".repeat(64),
    });
    const [scriere] = server.apeluriPe("fuel_card_transactions", "insert");
    expect(
      (scriere?.payload as readonly { cheie_dedup: string }[]).map((x) => x.cheie_dedup),
    ).toEqual(["h:b#1"]);
    expect(scriere?.payload).toMatchObject([
      {
        organization_id: ORG_ID,
        import_id: LOT,
        stare_potrivire: "card_necunoscut",
        created_by: USER_ID,
      },
    ]);
    const [contoare] = server.apeluriPe("fuel_card_imports", "update");
    expect(contoare?.payload).toMatchObject({
      importate: 1,
      duplicate: 1,
      finalizat_la: expect.any(String),
    });
    expect(contoare?.selectDupaScriere).toBe("id");
    // Lotul (stații, ore) pleacă din Storage după ultima felie.
    expect(admin.apeluriStocare).toEqual([
      {
        bucket: BUCKET,
        metoda: "remove",
        argumente: [[`${ORG_ID}/vehicles/${LOT}/lot-card.json`]],
      },
    ]);
  });

  it("offset 0 reluat: lotul există deja (același fișier), nu se mai inserează", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    lotInStocare(server, lotDeTest(["h:a#1"]));
    server.raspunde("fuel_card_imports", "select", {
      data: {
        id: LOT,
        organization_id: ORG_ID,
        emitent: "omv_petrom",
        fisier_sha256: "a".repeat(64),
        randuri_fisier: 1,
        finalizat_la: null,
        deleted_at: null,
      },
    });
    server.raspunde("fuel_card_transactions", "select", {
      data: [{ cheie_dedup: "h:a#1" }],
    });
    server.raspunde("fuel_card_transactions", "select", { count: 1 });
    server.raspunde("fuel_card_imports", "update", { data: { id: LOT } });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });

    const r = await aplicaImportExtras({ batchId: LOT, offset: 0 });

    expect(r).toMatchObject({
      ok: true,
      data: { importate: 0, duplicate: 1, gata: true },
    });
    expect(server.apeluriPe("fuel_card_imports", "insert")).toHaveLength(0);
    expect(server.apeluriPe("fuel_card_transactions", "insert")).toHaveLength(0);
  });

  it("23505 pe id-ul lotului, cu ALT fișier: refuz, nu reluare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    lotInStocare(server, lotDeTest(["h:a#1"]));
    server.raspunde("fuel_card_imports", "select", { data: null });
    server.raspunde("fuel_card_imports", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fuel_card_imports_pkey"',
      ),
    });
    server.raspunde("fuel_card_imports", "select", {
      data: {
        id: LOT,
        organization_id: ORG_ID,
        emitent: "omv_petrom",
        fisier_sha256: "b".repeat(64),
        randuri_fisier: 1,
        finalizat_la: null,
        deleted_at: null,
      },
    });

    const r = await aplicaImportExtras({ batchId: LOT, offset: 0 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("fuel_card_transactions", "insert")).toHaveLength(0);
  });

  it("23505 în bloc: reluare rând cu rând, cu contorul de duplicate", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMISIUNI });
    lotInStocare(server, lotDeTest(["h:a#1", "h:b#1"]));
    server.raspunde("fuel_card_imports", "select", {
      data: {
        id: LOT,
        organization_id: ORG_ID,
        emitent: "omv_petrom",
        fisier_sha256: "a".repeat(64),
        randuri_fisier: 2,
        finalizat_la: null,
        deleted_at: null,
      },
    });
    server.raspunde("fuel_card_transactions", "select", { data: [] });
    citiriPotrivire(server);
    const dublura = eroarePostgrest(
      "23505",
      'duplicate key value violates unique constraint "fctx_dedup_uq"',
    );
    server.raspunde("fuel_card_transactions", "insert", { error: dublura });
    server.raspunde("fuel_card_transactions", "insert", {
      data: [{ id: ID_1 }],
    });
    server.raspunde("fuel_card_transactions", "insert", { error: dublura });
    server.raspunde("fuel_card_transactions", "select", { count: 1 });
    server.raspunde("fuel_card_imports", "update", { data: { id: LOT } });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });

    const r = await aplicaImportExtras({ batchId: LOT, offset: 0 });

    expect(r).toMatchObject({
      ok: true,
      data: { importate: 1, duplicate: 1, gata: true },
    });
    expect(server.apeluriPe("fuel_card_transactions", "insert")).toHaveLength(3);
  });

  it("lotul expirat din Storage: CONFLICT cu instrucțiunea de reluare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspundeStocare(BUCKET, "download", {
      error: { message: "not found" },
    });
    const r = await aplicaImportExtras({ batchId: LOT, offset: 0 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Reluați") },
    });
  });

  it("`vehicles:update = team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "vehicles:update": "team" },
    });
    expect(await aplicaImportExtras({ batchId: LOT, offset: 0 })).toMatchObject({
      ok: false,
      error: { code: "INTERZIS" },
    });
    expect(server.apeluriStocare).toHaveLength(0);
  });
});

describe("anuleazaImport", () => {
  it("șterge logic ÎNTÂI tranzacțiile lotului, apoi lotul, cu firma și `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "update", {
      data: [{ id: "t1" }, { id: "t2" }],
    });
    server.raspunde("fuel_card_imports", "update", { data: { id: LOT } });

    const r = await anuleazaImport({ id: LOT });

    expect(r).toEqual({ ok: true, data: { id: LOT, tranzactii: 2 } });
    const ordine = server.apeluri.filter((a) => a.operatie === "update").map((a) => a.tabela);
    expect(ordine).toEqual(["fuel_card_transactions", "fuel_card_imports"]);
    const [tx] = server.apeluriPe("fuel_card_transactions", "update");
    expect(areFiltru(tx, "eq", "import_id", LOT)).toBe(true);
    expect(areFiltru(tx, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(tx, "is", "deleted_at", null)).toBe(true);
    expect(tx?.selectDupaScriere).toBe("id");
  });

  it("lotul deja anulat: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "update", { data: [] });
    server.raspunde("fuel_card_imports", "update", { data: null });
    expect(await anuleazaImport({ id: LOT })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});
