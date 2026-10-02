// src/app/(app)/ticketing/actions-operare.test.ts
//
// Uneltele IT-ului, toate pe `tickets:update = all`: suprascrierea priorității,
// repartizarea, marcarea ca duplicat și răspunsurile predefinite. Câmpurile
// atinse sunt păzite în bază, iar un rând sărit de politică nu dă eroare — dă
// zero rânduri, pe care fiecare acțiune îl transformă în conflict.

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

import { MACROURI } from "@/domain/ticketing/macrouri";
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
import { aplicaMacro, asigneaza, marcheazaDuplicat, suprascriePrioritatea } from "./actions";

const TICHET = ID_1;
const PARINTE = ID_2;
const FISA = ID_3;
const OPERATOR = "88888888-8888-4888-8888-888888888888";
const CAI = ["/ticketing", "/panou", "/portal", "/portal/tichetele-mele"];
const OPERARE = { "tickets:update": "all" } as const;
/**
 * Imediat sub prag: `team` e treapta de sub `all`, iar seed-ul
 * (0046_ticketing_it_reguli.sql) îi dă managerului exact `tickets:update = team`.
 * Dacă pragul coboară la `team`, managerul primește uneltele IT.
 */
const SUB_PRAG = { "tickets:update": "team" } as const;
/** Solicitantul își poate edita tichetul, dar nu-l operează. */
const SOLICITANT = { "tickets:update": "own" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("pragul de scope: uneltele IT cer `all`", () => {
  describe.each([
    [
      "suprascriePrioritatea",
      () =>
        suprascriePrioritatea({ ticket_id: TICHET, prioritate: "critica", motiv: "Server oprit" }),
    ],
    ["asigneaza", () => asigneaza({ ticket_id: TICHET, asignat_employee_id: OPERATOR })],
    [
      "marcheazaDuplicat",
      () => marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: PARINTE }),
    ],
    ["aplicaMacro", () => aplicaMacro({ ticket_id: TICHET, cod: "detalii" })],
  ] as const)("%s", (_nume, cheama) => {
    it("manager cu scope `team` (imediat sub prag): INTERZIS, fără interogări pe vreun client", async () => {
      const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: SUB_PRAG });
      const r = await cheama();
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(admin.apeluri).toHaveLength(0);
    });

    it("solicitant cu scope `own`: INTERZIS, fără interogări pe vreun client", async () => {
      const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: SOLICITANT });
      const r = await cheama();
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(admin.apeluri).toHaveLength(0);
    });
  });
});

// ── suprascriePrioritatea ─────────────────────────────────────────────────────

describe("suprascriePrioritatea", () => {
  const intrare = { ticket_id: TICHET, prioritate: "critica", motiv: "Blochează facturarea." };

  it("succes: prioritatea se marchează manuală, cu justificare, iar istoricul o consemnează", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "update", { data: { id: TICHET } });
    admin.raspunde("ticket_history", "insert", { data: null });

    const r = await suprascriePrioritatea(intrare);

    expect(r).toEqual({ ok: true, data: { prioritate: "critica" } });
    const [apel] = server.apeluriPe("tickets");
    expect(apel?.payload).toEqual({
      prioritate: "critica",
      prioritate_manuala: true,
      prioritate_motiv: "Blochează facturarea.",
    });
    expect(areFiltru(apel, "eq", "id", TICHET)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();

    expect(admin.apeluriPe("ticket_history")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      ticket_id: TICHET,
      actor_user_id: USER_ID,
      camp: "prioritate",
      valoare_noua: "critica",
      motiv: "Blochează facturarea.",
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("rând sărit de politică: CONFLICT, iar istoricul NU consemnează o schimbare care n-a avut loc", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "update", { data: null });
    const r = await suprascriePrioritatea(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: expect.stringContaining("Prioritatea nu a fost schimbată"),
      },
    });
    expect(admin.apeluriPe("ticket_history")).toHaveLength(0);
  });

  it("refuz de bază la UPDATE (42501): INTERZIS, nu „prioritatea nu a fost schimbată”", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "update", { error: eroarePostgrest("42501") });
    const r = await suprascriePrioritatea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(admin.apeluriPe("ticket_history")).toHaveLength(0);
  });

  it("justificare prea scurtă: VALIDARE pe `motiv`, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    const r = await suprascriePrioritatea({ ...intrare, motiv: "ok" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("motiv");
    expect(server.apeluri).toHaveLength(0);
  });

  // `actions.ts:335` face `await admin.from("ticket_history").insert(...)` fără
  // să citească `error`: dacă scrierea istoricului cade, acțiunea raportă
  // succes, prioritatea e schimbată, iar justificarea — singurul motiv pentru
  // care istoricul se scrie de mână aici — se pierde fără urmă.
  it.fails(
    "DEFECT: eșecul scrierii justificării în istoric e înghițit, iar acțiunea raportă succes",
    async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
      server.raspunde("tickets", "update", { data: { id: TICHET } });
      admin.raspunde("ticket_history", "insert", { error: eroarePostgrest("23514") });
      const r = await suprascriePrioritatea(intrare);
      expect(r.ok).toBe(false);
    },
  );
});

// ── asigneaza ─────────────────────────────────────────────────────────────────

describe("asigneaza", () => {
  it("succes: scrie doar persoana repartizată, pe id + organizație, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "update", { data: { id: TICHET } });
    const r = await asigneaza({ ticket_id: TICHET, asignat_employee_id: OPERATOR });
    expect(r).toEqual({ ok: true, data: { ok: true } });
    const [apel] = server.apeluriPe("tickets");
    expect(apel?.payload).toEqual({ asignat_employee_id: OPERATOR });
    expect(areFiltru(apel, "eq", "id", TICHET)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("`null` scoate repartizarea", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "update", { data: { id: TICHET } });
    const r = await asigneaza({ ticket_id: TICHET, asignat_employee_id: null });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("tickets")[0]?.payload).toEqual({ asignat_employee_id: null });
  });

  it("zero rânduri: CONFLICT, nu „repartizat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "update", { data: null });
    const r = await asigneaza({ ticket_id: TICHET, asignat_employee_id: OPERATOR });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: expect.stringContaining("Repartizarea nu a fost salvată"),
      },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("refuz de bază la UPDATE (42501): INTERZIS, nu „repartizarea nu a fost salvată”", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "update", { error: eroarePostgrest("42501") });
    const r = await asigneaza({ ticket_id: TICHET, asignat_employee_id: OPERATOR });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── marcheazaDuplicat ─────────────────────────────────────────────────────────

describe("marcheazaDuplicat", () => {
  it("un tichet nu poate fi duplicatul lui însuși: CONFLICT, fără interogări", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    const r = await marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: TICHET });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("lui însuși") },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: părintele se citește în organizație, apoi copilul primește legătura", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "select", {
      data: { id: PARINTE, tip: "defectiune", parent_ticket_id: null },
    });
    server.raspunde("tickets", "update", { data: { id: TICHET } });

    const r = await marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: PARINTE });

    expect(r).toEqual({ ok: true, data: { ok: true } });
    const [parinte] = server.apeluriPe("tickets", "select");
    expect(areFiltru(parinte, "eq", "id", PARINTE)).toBe(true);
    expect(areFiltru(parinte, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(parinte, "is", "deleted_at", null)).toBe(true);
    const [apel] = server.apeluriPe("tickets", "update");
    expect(apel?.payload).toEqual({ parent_ticket_id: PARINTE });
    expect(areFiltru(apel, "eq", "id", TICHET)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("părinte inexistent sau din altă firmă: NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "select", { data: null });
    const r = await marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: PARINTE });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("tickets", "update")).toHaveLength(0);
  });

  it("eroare la citirea părintelui: EROARE_INTERNA, nu NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "select", { error: eroarePostgrest("57014") });
    const r = await marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: PARINTE });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("tickets", "update")).toHaveLength(0);
  });

  it("refuz de bază la UPDATE (42501): INTERZIS, nu „marcarea nu a fost salvată”", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "select", {
      data: { id: PARINTE, tip: "defectiune", parent_ticket_id: null },
    });
    server.raspunde("tickets", "update", { error: eroarePostgrest("42501") });
    const r = await marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: PARINTE });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it("părintele e el însuși un duplicat: CONFLICT, fără lanțuri de duplicate", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "select", {
      data: { id: PARINTE, tip: "defectiune", parent_ticket_id: ID_3 },
    });
    const r = await marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: PARINTE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Alegeți originalul") },
    });
    expect(server.apeluriPe("tickets", "update")).toHaveLength(0);
  });

  it("copilul scos din rază între citire și scriere (zero rânduri): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: OPERARE });
    server.raspunde("tickets", "select", {
      data: { id: PARINTE, tip: "defectiune", parent_ticket_id: null },
    });
    server.raspunde("tickets", "update", { data: null });
    const r = await marcheazaDuplicat({ ticket_id: TICHET, parent_ticket_id: PARINTE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Marcarea ca duplicat") },
    });
  });
});

// ── aplicaMacro ───────────────────────────────────────────────────────────────

describe("aplicaMacro", () => {
  it("cod necunoscut: NEGASIT, fără nicio scriere și fără citirea fișei", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    const r = await aplicaMacro({ ticket_id: TICHET, cod: "inexistent" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it.each(MACROURI.map((m) => [m.cod, m] as const))(
    "macro `%s`: comentariul public cu textul lui, apoi tichetul trece în starea lui",
    async (cod, macro) => {
      const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
      admin.raspunde("employees", "select", { data: { id: FISA } });
      server.raspunde("ticket_comments", "insert", { data: null });
      server.raspunde("tickets", "update", { data: { id: TICHET } });

      const r = await aplicaMacro({ ticket_id: TICHET, cod });

      expect(r).toEqual({ ok: true, data: { status: macro.status } });
      expect(server.apeluriPe("ticket_comments")[0]?.payload).toEqual({
        organization_id: ORG_ID,
        ticket_id: TICHET,
        autor_employee_id: FISA,
        continut: macro.text,
        intern: false,
      });
      const [apel] = server.apeluriPe("tickets");
      expect(apel?.payload).toEqual({ status: macro.status });
      expect(areFiltru(apel, "eq", "id", TICHET)).toBe(true);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(apel?.selectDupaScriere).toBeDefined();
      expect(caiRevalidate()).toEqual(CAI);
    },
  );

  it("comentariul se publică ÎNAINTEA tranziției", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("ticket_comments", "insert", { data: null });
    server.raspunde("tickets", "update", { data: { id: TICHET } });
    await aplicaMacro({ ticket_id: TICHET, cod: "instalat" });
    expect(server.apeluri.map((a) => `${a.tabela}:${a.operatie}`)).toEqual([
      "ticket_comments:insert",
      "tickets:update",
    ]);
  });

  it("comentariul refuzat: tranziția nu se mai încearcă", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("ticket_comments", "insert", { error: eroarePostgrest("42501") });
    const r = await aplicaMacro({ ticket_id: TICHET, cod: "instalat" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("tickets")).toHaveLength(0);
  });

  it("tranziția sărită tăcut după comentariu: CONFLICT care spune că răspunsul a rămas publicat", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("ticket_comments", "insert", { data: null });
    server.raspunde("tickets", "update", { data: null });
    const r = await aplicaMacro({ ticket_id: TICHET, cod: "inlocuit" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Răspunsul a fost publicat") },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("refuz de bază la tranziție (42501): INTERZIS, nu „starea nu a putut fi schimbată”", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("ticket_comments", "insert", { data: null });
    server.raspunde("tickets", "update", { error: eroarePostgrest("42501") });
    const r = await aplicaMacro({ ticket_id: TICHET, cod: "inlocuit" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("operator fără fișă de angajat: CONFLICT, fără comentariu", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: OPERARE });
    admin.raspunde("employees", "select", { data: null });
    const r = await aplicaMacro({ ticket_id: TICHET, cod: "detalii" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });
});
