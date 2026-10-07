// src/app/(app)/mentenanta/actions-sesizari.test.ts
//
// Partea de mentenanță deschisă oricui: sesizarea unei defecțiuni, căutarea
// echipamentului pentru formular și lista sesizărilor proprii. Toate trei
// stau pe `own` și folosesc clientul admin acolo unde RLS ar ascunde rândul
// de organizație (`equipment`) — cu filtru explicit pe organizație.

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
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { cautaEchipament, creeazaSesizare, numeleEchipamentelorMele } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const SESIZARE = { "maintenance:create": "own" } as const;
const CITIRE = { "maintenance:read": "own" } as const;

const sesizare = {
  equipment_id: ID_1,
  descriere: "Banda transportoare scârțâie și se oprește.",
  urgenta: "ridicata",
  opreste_functionarea: true,
};

describe("pragul de permisiune", () => {
  it.each([
    ["creeazaSesizare", creeazaSesizare, sesizare],
    ["cautaEchipament", cautaEchipament, { q: "banda" }],
  ] as const)(
    "%s: fără `maintenance:create` ⇒ INTERZIS, niciun client atins",
    async (_n, actiune, intrare) => {
      const { server, admin } = configureazaActiunea({
        rol: "employee",
        permisiuni: { "maintenance:read": "all" },
      });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(admin.apeluri).toHaveLength(0);
    },
  );

  it("numeleEchipamentelorMele: fără `maintenance:read` ⇒ INTERZIS", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: SESIZARE });
    const r = await numeleEchipamentelorMele({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });
});

describe("creeazaSesizare", () => {
  it("fișa raportorului se rezolvă pe server, nu din formular, și intră în INSERT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: SESIZARE });
    admin.raspunde("employees", "select", { data: { id: ID_2 } });
    server.raspunde("fault_reports", "insert", { data: { id: ID_3 } });

    const r = await creeazaSesizare({ ...sesizare, raportat_de_employee_id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [cautare] = admin.apeluriPe("employees");
    expect(areFiltru(cautare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cautare, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(cautare, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(cautare, "is", "deleted_at", null)).toBe(true);

    const [insert] = server.apeluriPe("fault_reports");
    expect(insert?.operatie).toBe("insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      equipment_id: ID_1,
      raportat_de_employee_id: ID_2,
      descriere: sesizare.descriere,
      urgenta: "ridicata",
      opreste_functionarea: true,
    });
    expect(insert?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/mentenanta", "/mentenanta/sesizari"]);
  });

  it("cont fără fișă de angajat activă: CONFLICT explicat, fără INSERT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("employees", "select", { data: null });

    const r = await creeazaSesizare(sesizare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("nu este legat de o fișă de angajat");
    expect(server.apeluriPe("fault_reports")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("administratorul fără fișă de angajat raportează totuși: INSERT cu raportor null", async () => {
    // Patronul sau contabilul extern cu rol `org_admin`: politica din 0150
    // acceptă `raportat_de_employee_id = null` pentru cine are `create ≥ team`,
    // iar SELECT-ul de după INSERT trece pe `read ≥ team`.
    const { server, admin } = configureazaActiunea({
      rol: "org_admin",
      permisiuni: { "maintenance:create": "all", "maintenance:update": "all" },
    });
    admin.raspunde("employees", "select", { data: null });
    server.raspunde("fault_reports", "insert", { data: { id: ID_3 } });

    const r = await creeazaSesizare(sesizare);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [insert] = server.apeluriPe("fault_reports");
    expect(insert?.payload).toMatchObject({ raportat_de_employee_id: null, equipment_id: ID_1 });
    expect(insert?.selectDupaScriere).toBe("id");
  });

  it("un manager fără fișă și fără `maintenance:update` rămâne la CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "maintenance:create": "all", "maintenance:read": "team" },
    });
    admin.raspunde("employees", "select", { data: null });
    const r = await creeazaSesizare(sesizare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("fault_reports")).toHaveLength(0);
  });

  it("eroarea la căutarea fișei nu ajunge la INSERT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaSesizare(sesizare);
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("fault_reports")).toHaveLength(0);
  });

  it("descrierea sub 10 caractere e refuzată înainte de orice citire", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: SESIZARE });
    const r = await creeazaSesizare({ ...sesizare, descriere: "Strică" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("descriere");
    expect(admin.apeluri).toHaveLength(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("P0001 din garda sesizărilor: textul ajunge la om", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("employees", "select", { data: { id: ID_2 } });
    const mesaj = "Echipamentul a fost casat.";
    server.raspunde("fault_reports", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await creeazaSesizare(sesizare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("cautaEchipament", () => {
  it("un UUID caută exact rândul, cu clientul admin filtrat pe organizație (prefill din QR)", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: SESIZARE });
    const rand = { id: ID_1, cod: "BT-1", denumire: "Bandă", locatie: "Hala 1" };
    admin.raspunde("equipment", "select", { data: rand });
    admin.raspunde("fault_reports", "select", { data: [] });

    const r = await cautaEchipament({ q: ` ${ID_1.toUpperCase()} ` });

    expect(r).toEqual({ ok: true, data: [{ ...rand, sesizare_deschisa: null }] });
    expect(server.apeluriPe("equipment")).toHaveLength(0);
    const [apel] = admin.apeluriPe("equipment");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1.toUpperCase())).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("fiecare echipament găsit vine cu cea mai veche sesizare DESCHISĂ pe el (avertismentul de duplicat), citită cu admin pe organizație", async () => {
    const { admin } = configureazaActiunea({ rol: "employee", permisiuni: SESIZARE });
    admin.raspunde("equipment", "select", {
      data: [
        { id: ID_1, cod: "BT-1", denumire: "Bandă", locatie: null },
        { id: ID_2, cod: "PR-2", denumire: "Presă", locatie: null },
      ],
    });
    admin.raspunde("fault_reports", "select", {
      data: [
        { id: ID_3, numar: "SZ-2026-0003", equipment_id: ID_1 },
        { id: ID_2, numar: "SZ-2026-0009", equipment_id: ID_1 },
      ],
    });

    const r = await cautaEchipament({ q: "banda" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data[0]?.sesizare_deschisa).toEqual({ id: ID_3, numar: "SZ-2026-0003" });
    expect(r.data[1]?.sesizare_deschisa).toBeNull();
    const [sesizari] = admin.apeluriPe("fault_reports");
    expect(areFiltru(sesizari, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(sesizari, "in", "equipment_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(sesizari, "is", "deleted_at", null)).toBe(true);
    expect(
      areFiltru(sesizari, "in", "status", ["nou", "in_analiza", "in_lucru", "in_asteptare"]),
    ).toBe(true);
  });

  it("UUID fără rând (alt tenant sau șters): listă goală", async () => {
    const { admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("equipment", "select", { data: null });
    const r = await cautaEchipament({ q: ID_2 });
    expect(r).toEqual({ ok: true, data: [] });
  });

  it("textul: cod SAU denumire, fără casate, limitat la 10, pe organizație", async () => {
    const { admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("equipment", "select", { data: [] });

    const r = await cautaEchipament({ q: "bandă" });

    expect(r).toEqual({ ok: true, data: [] });
    const [apel] = admin.apeluriPe("equipment");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "neq", "status", "casat")).toBe(true);
    expect(apel?.filtre).toContainEqual({
      metoda: "or",
      argumente: ['cod.ilike."%bandă%",denumire.ilike."%bandă%"'],
    });
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [10] });
  });

  it("`%` și `_` tastate de om se caută literal, nu ca jokeri", async () => {
    const { admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("equipment", "select", { data: [] });
    await cautaEchipament({ q: "100%_x" });
    const [apel] = admin.apeluriPe("equipment");
    const or = apel?.filtre.find((f) => f.metoda === "or")?.argumente[0];
    // LIKE primește `\%` și `\_`; ghilimelarea `or=` dublează apoi backslash-ul.
    expect(or).toBe(String.raw`cod.ilike."%100\\%\\_x%",denumire.ilike."%100\\%\\_x%"`);
  });

  it("sintaxa `or=` (virgulă, paranteze, două puncte, ghilimele) e scoasă din termen", async () => {
    const { admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("equipment", "select", { data: [] });
    await cautaEchipament({ q: 'a,b(c):"d"' });
    const [apel] = admin.apeluriPe("equipment");
    const or = apel?.filtre.find((f) => f.metoda === "or")?.argumente[0];
    expect(or).toBe('cod.ilike."%abcd%",denumire.ilike."%abcd%"');
  });

  it.each([[""], ["a"], ["  ,( "]])(
    "termen util sub 2 caractere (%j): listă goală fără interogare",
    async (q) => {
      const { admin } = configureazaActiunea({ permisiuni: SESIZARE });
      const r = await cautaEchipament({ q });
      expect(r).toEqual({ ok: true, data: [] });
      expect(admin.apeluri).toHaveLength(0);
    },
  );

  it("căutarea nu revalidează nimic", async () => {
    const { admin } = configureazaActiunea({ permisiuni: SESIZARE });
    admin.raspunde("equipment", "select", { data: [] });
    await cautaEchipament({ q: "pompa" });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("numeleEchipamentelorMele", () => {
  const rand = (id: string, equipmentId: string) => ({
    id,
    numar: "SZ-2026-0001",
    equipment_id: equipmentId,
    raportat_de_employee_id: ID_2,
    raportat_de_user_id: null,
    atribuit_employee_id: null,
    descriere: "Defect",
    urgenta: "medie",
    status: "nou",
    raportat_la: "2026-09-20T08:00:00Z",
    opreste_functionarea: false,
    rezolvat_la: null,
    motiv_respingere: null,
  });

  it("sesizările vin prin RLS; numele echipamentelor prin admin, doar pentru id-urile unice găsite", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: CITIRE });
    server.raspunde("fault_reports", "select", {
      data: [rand(ID_1, ID_3), rand(ID_2, ID_3)],
    });
    admin.raspunde("equipment", "select", {
      data: [{ id: ID_3, cod: "BT-1", denumire: "Bandă" }],
    });

    const r = await numeleEchipamentelorMele({});

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(2);
    expect(r.data[0]).toEqual({
      id: ID_1,
      numar: "SZ-2026-0001",
      raportat_de_employee_id: ID_2,
      raportat_de_user_id: null,
      atribuit_employee_id: null,
      descriere: "Defect",
      urgenta: "medie",
      status: "nou",
      raportat_la: "2026-09-20T08:00:00Z",
      opreste_functionarea: false,
      rezolvat_la: null,
      motiv_respingere: null,
      echipament: { cod: "BT-1", denumire: "Bandă" },
    });
    // `equipment_id` nu iese spre client.
    expect(r.data[0]).not.toHaveProperty("equipment_id");

    const [citire] = server.apeluriPe("fault_reports");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(citire?.filtre).toContainEqual({ metoda: "limit", argumente: [100] });

    const [nume] = admin.apeluriPe("equipment");
    expect(areFiltru(nume, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(nume, "in", "id", [ID_3])).toBe(true);
    expect(caiRevalidate()).toEqual([]);
  });

  it("niciun rând propriu: fără a doua citire, cu admin neatins", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("fault_reports", "select", { data: [] });
    const r = await numeleEchipamentelorMele({});
    expect(r).toEqual({ ok: true, data: [] });
    expect(admin.apeluri).toHaveLength(0);
  });

  it("echipament negăsit (șters sau din alt tenant): `echipament: null`, nu eroare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("fault_reports", "select", { data: [rand(ID_1, ID_2)] });
    admin.raspunde("equipment", "select", { data: [] });
    const r = await numeleEchipamentelorMele({});
    expect(r.ok && r.data[0]?.echipament).toBeNull();
  });

  it("eroarea la citirea numelor nu e mascată ca listă fără nume", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("fault_reports", "select", { data: [rand(ID_1, ID_2)] });
    admin.raspunde("equipment", "select", { error: eroarePostgrest("42501") });
    const r = await numeleEchipamentelorMele({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});
