// src/app/(app)/mentenanta/interventii/actions.test.ts
//
// Gesturile de pe intervenție (M6, 0192): corectarea, anularea, liniile de
// piese. Ce refuză garda din bază (anularea intervenției care a rezolvat o
// sesizare, schimbarea echipamentului) se verifică în
// `tests/rls/proba-interventii.sql`; aici: poarta, filtrele, `.select()` după
// scriere, traducerea P0001 și căile revalidate.

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

import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { actualizeazaInterventie, adaugaPiesa, anuleazaInterventie, stergePiesa } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const UPDATE = { "maintenance:update": "team" } as const;

const corectura = {
  id: ID_1,
  tip: "preventiva",
  data: "2026-10-01",
  descriere: "Revizie, cu filtre noi.",
  executant_extern: "Service Hidraulic SRL",
  cost_piese: "10",
  cost_manopera: "200",
  rezultat: "reusita",
};

const piesa = {
  intervention_id: ID_1,
  denumire: "Filtru ulei",
  cod: "FU-12",
  cantitate: "2",
  unitate: "buc",
  pret_unitar: "45.5",
};

describe("poarta și modulul", () => {
  it.each([
    ["actualizeazaInterventie", actualizeazaInterventie, corectura],
    ["anuleazaInterventie", anuleazaInterventie, { id: ID_1 }],
    ["adaugaPiesa", adaugaPiesa, piesa],
    ["stergePiesa", stergePiesa, { id: ID_2 }],
  ] as const)("%s: `maintenance:update` own < team ⇒ INTERZIS, zero apeluri", async (_n, a, x) => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "maintenance:update": "own", "maintenance:read": "team" },
    });
    const r = await a(x as never);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([
    ["actualizeazaInterventie", actualizeazaInterventie, corectura],
    ["anuleazaInterventie", anuleazaInterventie, { id: ID_1 }],
    ["adaugaPiesa", adaugaPiesa, piesa],
    ["stergePiesa", stergePiesa, { id: ID_2 }],
  ] as const)("%s: modulul `maintenance` oprit ⇒ MODUL_DEZACTIVAT", async (_n, a, x) => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE, functii: ["ssm"] });
    const r = await a(x as never);
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaInterventie", () => {
  it("UPDATE pe intervenția vie a organizației, fără id/plan/echipament/număr în payload; `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_interventions", "update", {
      data: { id: ID_1, equipment_id: ID_2, plan_id: ID_3 },
    });

    const r = await actualizeazaInterventie(corectura);

    expect(r).toEqual({ ok: true, data: { id: ID_1, equipment_id: ID_2, plan_id: ID_3 } });
    const [apel] = server.apeluriPe("maintenance_interventions", "update");
    expect(apel?.payload).toMatchObject({
      tip: "preventiva",
      data: "2026-10-01",
      cost_manopera: 200,
      executant_extern: "Service Hidraulic SRL",
      acoperit_de_garantie: false,
    });
    for (const cheie of [
      "id",
      "plan_id",
      "equipment_id",
      "fault_report_id",
      "numar",
      "cost_total",
    ]) {
      expect(apel?.payload).not.toHaveProperty(cheie);
    }
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id, plan_id");
    expect(caiRevalidate()).toEqual([
      "/mentenanta",
      "/mentenanta/interventii",
      `/mentenanta/interventii/${ID_1}`,
      `/mentenanta/interventii/${ID_1}/proces-verbal`,
      `/mentenanta/echipamente/${ID_2}`,
      "/mentenanta/planuri",
      `/mentenanta/planuri/${ID_3}`,
    ]);
  });

  it("zero rânduri (anulată între timp, altă firmă): NEGASIT, nimic revalidat", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_interventions", "update", { data: null });
    const r = await actualizeazaInterventie(corectura);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("garda din bază (P0001) ajunge la om cu mesajul ei", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const mesaj = "Sesizarea de care ține o intervenție nu se schimbă prin editare.";
    server.raspunde("maintenance_interventions", "update", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await actualizeazaInterventie(corectura);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("exact un executant (cazul 33): amândoi ⇒ VALIDARE pe `executant_extern`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await actualizeazaInterventie({ ...corectura, executant_employee_id: ID_3 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("executant_extern");
    expect(server.apeluri).toHaveLength(0);
  });

  it("niciun executant ⇒ VALIDARE pe `executant_employee_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await actualizeazaInterventie({ ...corectura, executant_extern: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("executant_employee_id");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("anuleazaInterventie", () => {
  it("ștergere logică pe intervenția vie, cu `.select()` după; planul se revalidează", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_interventions", "update", {
      data: { id: ID_1, equipment_id: ID_2, plan_id: null },
    });

    const r = await anuleazaInterventie({ id: ID_1 });

    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("maintenance_interventions", "update");
    expect(Object.keys(apel?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id, plan_id");
    expect(caiRevalidate()).not.toContain("/mentenanta/planuri/null");
  });

  it("intervenția care a rezolvat o sesizare: refuzul gărzii, cu numărul sesizării (cazul 31)", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const mesaj =
      "Intervenția a rezolvat sesizarea SZ-2026-0004. Redeschideți întâi sesizarea SZ-2026-0004, apoi anulați intervenția.";
    server.raspunde("maintenance_interventions", "update", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await anuleazaInterventie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("deja anulată: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_interventions", "update", { data: null });
    const r = await anuleazaInterventie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});

describe("adaugaPiesa / stergePiesa", () => {
  it("INSERT cu organizația din sesiune, fără `valoare` (GENERATĂ) și fără `cost_piese` pe intervenție", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_intervention_parts", "insert", {
      data: { id: ID_2, intervention_id: ID_1 },
    });

    const r = await adaugaPiesa(piesa);

    expect(r).toEqual({ ok: true, data: { id: ID_2, intervention_id: ID_1 } });
    const [apel] = server.apeluriPe("maintenance_intervention_parts");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      intervention_id: ID_1,
      denumire: "Filtru ulei",
      cod: "FU-12",
      cantitate: 2,
      unitate: "buc",
      pret_unitar: 45.5,
    });
    // Suma o face triggerul: acțiunea nu atinge intervenția.
    expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
    expect(caiRevalidate()).toContain(`/mentenanta/interventii/${ID_1}`);
  });

  it.each([
    ["cantitate 0", { cantitate: "0" }, "cantitate"],
    ["preț negativ", { pret_unitar: "-1" }, "pret_unitar"],
    ["fără denumire", { denumire: " " }, "denumire"],
  ] as const)("%s: VALIDARE pe `%s`", async (_n, schimbare, camp) => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await adaugaPiesa({ ...piesa, ...schimbare });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("intervenția anulată: garda (P0001) se traduce", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const mesaj =
      "Intervenția nu există în această organizație sau a fost anulată. Piesele nu se mai pot modifica.";
    server.raspunde("maintenance_intervention_parts", "insert", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await adaugaPiesa(piesa);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("ștergerea: logică, pe linia vie a organizației; revalidează intervenția din rândul întors", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_intervention_parts", "update", {
      data: { id: ID_2, intervention_id: ID_1 },
    });

    const r = await stergePiesa({ id: ID_2 });

    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("maintenance_intervention_parts", "update");
    expect(Object.keys(apel?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, intervention_id");
    expect(caiRevalidate()).toContain(`/mentenanta/interventii/${ID_1}`);
  });

  it("ștergerea, zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_intervention_parts", "update", { data: null });
    const r = await stergePiesa({ id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});
