// src/app/(app)/inventar/actions-alocari.test.ts
//
// Predarea-primirea: predarea unui obiect, returnarea lui și confirmarea
// primirii de către angajat. `confirmaPrimirea` e singura acțiune autorizată
// cu o permisiune de CITIRE (`inventory:read = own`), fiindcă politica de
// UPDATE are o ramură pentru rândul propriu. Straturile comune ale lui
// `createAction` sunt în `salarizare/actions.test.ts`.

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
import { formatDateTime } from "@/lib/format/date";
import { confirmaPrimirea, predaObiect, returneazaObiect } from "./actions";

const ACUM = "2026-09-15T10:00:00.000Z";
const SCRIERE = { "inventory:update": "all" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(ACUM));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("predaObiect", () => {
  const predare = { item_id: ID_1, employee_id: ID_2 };

  it("scope `team` pe `inventory:update`: INTERZIS, fără interogare", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "inventory:read": "team", "inventory:update": "team" },
    });
    const r = await predaObiect(predare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: verifică obiectul și alocarea deschisă, apoi inserează predarea", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: SCRIERE });
    server.raspunde("inventory_items", "select", {
      data: { id: ID_1, denumire: "Laptop", status: "in_stoc" },
    });
    server.raspunde("inventory_allocations", "select", { data: null });
    server.raspunde("inventory_allocations", "insert", { data: { id: ID_3, item_id: ID_1 } });

    const r = await predaObiect({ ...predare, observatii: "Cu încărcător" });

    expect(r).toEqual({ ok: true, data: { id: ID_3, item_id: ID_1 } });

    const [obiect] = server.apeluriPe("inventory_items");
    expect(areFiltru(obiect, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(obiect, "eq", "organization_id", ORG_ID)).toBe(true);

    const [deschisa, insert] = server.apeluriPe("inventory_allocations");
    expect(areFiltru(deschisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(deschisa, "eq", "item_id", ID_1)).toBe(true);
    expect(areFiltru(deschisa, "is", "returnat_la", null)).toBe(true);
    expect(areFiltru(deschisa, "is", "deleted_at", null)).toBe(true);

    expect(insert?.operatie).toBe("insert");
    // Fără RETURNING, `data.item_id` aruncă după ce predarea s-a scris deja.
    expect(insert?.selectDupaScriere).toBe("id, item_id");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      item_id: ID_1,
      employee_id: ID_2,
      stare_la_predare: "bun",
      observatii: "Cu încărcător",
      pv_document_path: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // Fără `predat_la` trimis, rămâne implicitul bazei; returnarea nu se scrie aici.
    expect(insert?.payload).not.toHaveProperty("predat_la");
    expect(insert?.payload).not.toHaveProperty("returnat_la");
    expect(caiRevalidate()).toEqual(["/inventar", `/inventar/${ID_1}`, "/inventar/in-primire"]);
  });

  it("un moment de predare dat explicit se scrie ca ISO", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "select", {
      data: { id: ID_1, denumire: "Laptop", status: "in_stoc" },
    });
    server.raspunde("inventory_allocations", "select", { data: null });
    server.raspunde("inventory_allocations", "insert", { data: { id: ID_3, item_id: ID_1 } });

    await predaObiect({ ...predare, predat_la: "2026-09-14T09:30:00Z" });

    expect(server.apeluriPe("inventory_allocations", "insert")[0]?.payload).toMatchObject({
      predat_la: "2026-09-14T09:30:00.000Z",
    });
  });

  it("obiect negăsit în organizație: NEGASIT, nicio predare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "select", { data: null });
    const r = await predaObiect(predare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("inventory_allocations")).toHaveLength(0);
  });

  it("obiect casat: CONFLICT, fără să caute alocări", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "select", {
      data: { id: ID_1, denumire: "Laptop", status: "casat" },
    });
    const r = await predaObiect(predare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("inventory_allocations")).toHaveLength(0);
  });

  it("deja predat: CONFLICT care numește obiectul, deținătorul și momentul", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "select", {
      data: { id: ID_1, denumire: "Laptop Dell", status: "alocat" },
    });
    server.raspunde("inventory_allocations", "select", {
      data: { employee_id: ID_3, predat_la: "2026-09-01T07:00:00Z" },
    });
    server.raspunde("employees", "select", { data: { full_name: "Maria Ionescu" } });

    const r = await predaObiect(predare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("„Laptop Dell”");
    expect(r.error.message).toContain("Maria Ionescu");
    expect(r.error.message).toContain(formatDateTime("2026-09-01T07:00:00Z"));
    expect(areFiltru(server.apeluriPe("employees")[0], "eq", "id", ID_3)).toBe(true);
    expect(server.apeluriPe("inventory_allocations", "insert")).toHaveLength(0);
  });

  it("deținător invizibil (RLS): mesajul spune „un alt angajat”, nu „null”", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "select", {
      data: { id: ID_1, denumire: "Laptop", status: "alocat" },
    });
    server.raspunde("inventory_allocations", "select", {
      data: { employee_id: ID_3, predat_la: "2026-09-01T07:00:00Z" },
    });
    server.raspunde("employees", "select", { data: null });

    const r = await predaObiect(predare);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("un alt angajat");
    expect(r.error.message).not.toContain("null");
  });

  it("predare concurentă (23P01 la inserare): CONFLICT fără DETAIL-ul brut", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_items", "select", {
      data: { id: ID_1, denumire: "Laptop", status: "in_stoc" },
    });
    server.raspunde("inventory_allocations", "select", { data: null });
    server.raspunde("inventory_allocations", "insert", {
      error: eroarePostgrest("23P01", "conflicting key value", `Key (item_id)=(${ID_1})`),
    });

    const r = await predaObiect(predare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).not.toContain(ID_1);
  });
});

describe("returneazaObiect", () => {
  const returnare = { id: ID_3, stare_la_returnare: "bun" };

  it("scope `team` pe `inventory:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "inventory:update": "team" } });
    const r = await returneazaObiect(returnare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: închide predarea acum, cu `.select()`, și revalidează fișa obiectului din bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_allocations", "select", {
      data: { id: ID_3, item_id: ID_1, returnat_la: null },
    });
    server.raspunde("inventory_allocations", "update", { data: { id: ID_3 } });

    const r = await returneazaObiect({ ...returnare, stare_la_returnare: "defect" });

    expect(r).toEqual({ ok: true, data: { id: ID_3, item_id: ID_1 } });
    const [citire, scriere] = server.apeluriPe("inventory_allocations");
    expect(areFiltru(citire, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    expect(scriere?.operatie).toBe("update");
    expect(scriere?.payload).toEqual({
      returnat_la: ACUM,
      stare_la_returnare: "defect",
      observatii: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBeDefined();
    // Calea fișei vine din rândul citit, nu din formular.
    expect(caiRevalidate()).toEqual(["/inventar", `/inventar/${ID_1}`, "/inventar/in-primire"]);
  });

  it("un moment de returnare dat explicit bate momentul curent", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_allocations", "select", {
      data: { id: ID_3, item_id: ID_1, returnat_la: null },
    });
    server.raspunde("inventory_allocations", "update", { data: { id: ID_3 } });
    await returneazaObiect({ ...returnare, returnat_la: "2026-09-10T08:00:00Z" });
    expect(server.apeluriPe("inventory_allocations", "update")[0]?.payload).toMatchObject({
      returnat_la: "2026-09-10T08:00:00.000Z",
    });
  });

  it("predare negăsită: NEGASIT, nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_allocations", "select", { data: null });
    const r = await returneazaObiect(returnare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("inventory_allocations", "update")).toHaveLength(0);
  });

  it("predare deja returnată: CONFLICT, nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_allocations", "select", {
      data: { id: ID_3, item_id: ID_1, returnat_la: "2026-09-01T08:00:00Z" },
    });
    const r = await returneazaObiect(returnare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("inventory_allocations", "update")).toHaveLength(0);
  });

  it("zero rânduri la UPDATE (citire permisă, scriere nu): CONFLICT, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: SCRIERE });
    server.raspunde("inventory_allocations", "select", {
      data: { id: ID_3, item_id: ID_1, returnat_la: null },
    });
    server.raspunde("inventory_allocations", "update", { data: null });
    const r = await returneazaObiect(returnare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  // Între citire și UPDATE, altcineva poate închide aceeași predare (două file,
  // doi operatori). `inventory_alloc_imutabile` lasă `returnat_la` și
  // `stare_la_returnare` modificabile, iar politica de UPDATE nu cere
  // `returnat_la is null` — deci al doilea UPDATE trece și rescrie data și
  // starea primei returnări. Mesajul de pe ramura `null` („închisă de altcineva
  // între timp”) promite exact garda care lipsește din filtru.
  it.fails(
    "DEFECT: UPDATE-ul de returnare cere ca predarea să fie încă deschisă (`.is(returnat_la, null)`)",
    async () => {
      const { server } = configureazaActiunea({ permisiuni: SCRIERE });
      server.raspunde("inventory_allocations", "select", {
        data: { id: ID_3, item_id: ID_1, returnat_la: null },
      });
      server.raspunde("inventory_allocations", "update", { data: { id: ID_3 } });
      const r = await returneazaObiect(returnare);
      const [scriere] = server.apeluriPe("inventory_allocations", "update");
      // Precondiție: dacă acțiunea nu mai ajunge la UPDATE, testul TRECE, deci
      // `it.fails` devine roșu — nu documentează în gol un defect pe o cale moartă.
      if (!r.ok || scriere === undefined) return;
      expect(areFiltru(scriere, "is", "returnat_la", null)).toBe(true);
    },
  );
});

describe("confirmaPrimirea", () => {
  it("fără `inventory:read`: INTERZIS, chiar cu `inventory:update`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "inventory:update": "all" } });
    const r = await confirmaPrimirea({ id: ID_3 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("angajatul (`read = own`) confirmă: doar momentul și autorul, pe o predare deschisă", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "inventory:read": "own" },
    });
    server.raspunde("inventory_allocations", "update", { data: { id: ID_3 } });

    const r = await confirmaPrimirea({ id: ID_3 });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("inventory_allocations");
    expect(apel?.payload).toEqual({ confirmat_de_angajat_la: ACUM, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "returnat_la", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/inventar/in-primire", "/portal", "/portal/in-primirea-mea"]);
  });

  it("zero rânduri (returnată sau a altcuiva): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "inventory:read": "own" } });
    server.raspunde("inventory_allocations", "update", { data: null });
    const r = await confirmaPrimirea({ id: ID_3 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("P0001 (încearcă să schimbe alt câmp): mesajul triggerului, CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "inventory:read": "own" } });
    const mesaj = "Puteți doar confirma primirea obiectului.";
    server.raspunde("inventory_allocations", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await confirmaPrimirea({ id: ID_3 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});
