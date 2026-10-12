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

/** Rândul de dinainte de corectare: corectura verifică PV-ul doar la o tranziție (cazul 34). */
const RAND_INAINTE = { tip: "preventiva", rezultat: "reusita", plan_id: null } as const;

describe("actualizeazaInterventie", () => {
  it("UPDATE pe intervenția vie a organizației, fără id/plan/echipament/număr în payload; `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_interventions", "select", { data: RAND_INAINTE });
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
    server.raspunde("maintenance_interventions", "select", { data: RAND_INAINTE });
    server.raspunde("maintenance_interventions", "update", { data: null });
    const r = await actualizeazaInterventie(corectura);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("intervenția nu se vede la citire (anulată, altă firmă): NEGASIT, niciun UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_interventions", "select", { data: null });
    const r = await actualizeazaInterventie(corectura);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    const [citire] = server.apeluriPe("maintenance_interventions", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("maintenance_interventions", "update")).toHaveLength(0);
  });

  // Cazul 34 nu se ocolește prin corectare: înregistrarea cere PV-ul, deci o
  // verificare legală „amânată” (fără PV) trecută apoi pe „reușită”, sau o
  // intervenție oarecare retipizată „verificare legală”, ar ajunge în registru
  // drept făcută fără document.
  describe("verificarea legală devenită „făcută” prin corectare (cazul 34)", () => {
    it("tipul schimbat pe `verificare_legala`, fără PV/buletin ⇒ VALIDARE pe `tip`, niciun UPDATE", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_interventions", "select", { data: RAND_INAINTE });
      server.raspunde("maintenance_attachments", "select", { data: null, count: 0 });

      const r = await actualizeazaInterventie({ ...corectura, tip: "verificare_legala" });

      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("tip");
      const [atasamente] = server.apeluriPe("maintenance_attachments", "select");
      expect(areFiltru(atasamente, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(atasamente, "eq", "entity_type", "intervention")).toBe(true);
      expect(areFiltru(atasamente, "eq", "entity_id", ID_1)).toBe(true);
      expect(areFiltru(atasamente, "in", "tip", ["pv", "buletin"])).toBe(true);
      expect(areFiltru(atasamente, "is", "deleted_at", null)).toBe(true);
      expect(server.apeluriPe("maintenance_interventions", "update")).toHaveLength(0);
    });

    it("„amânată” → „reușită” pe un plan de verificare legală, fără PV ⇒ VALIDARE pe `rezultat`", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_interventions", "select", {
        data: { tip: "preventiva", rezultat: "amanata", plan_id: ID_3 },
      });
      server.raspunde("maintenance_plans", "select", { data: { tip: "verificare_legala" } });
      server.raspunde("maintenance_attachments", "select", { data: null, count: 0 });

      const r = await actualizeazaInterventie(corectura);

      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("rezultat");
      const [plan] = server.apeluriPe("maintenance_plans", "select");
      expect(areFiltru(plan, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(plan, "eq", "id", ID_3)).toBe(true);
      expect(server.apeluriPe("maintenance_interventions", "update")).toHaveLength(0);
    });

    it("aceeași tranziție, cu PV-ul deja urcat pe fișă ⇒ corectura trece", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_interventions", "select", {
        data: { tip: "preventiva", rezultat: "amanata", plan_id: ID_3 },
      });
      server.raspunde("maintenance_plans", "select", { data: { tip: "verificare_legala" } });
      server.raspunde("maintenance_attachments", "select", { data: null, count: 1 });
      server.raspunde("maintenance_interventions", "update", {
        data: { id: ID_1, equipment_id: ID_2, plan_id: ID_3 },
      });

      const r = await actualizeazaInterventie(corectura);

      expect(r.ok).toBe(true);
      expect(server.apeluriPe("maintenance_interventions", "update")).toHaveLength(1);
    });

    it("o verificare legală veche, deja „reușită”, se corectează fără PV (cazul 46: nu se cere retroactiv)", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_interventions", "select", {
        data: { tip: "verificare_legala", rezultat: "reusita", plan_id: null },
      });
      server.raspunde("maintenance_interventions", "update", {
        data: { id: ID_1, equipment_id: ID_2, plan_id: null },
      });

      const r = await actualizeazaInterventie({ ...corectura, tip: "verificare_legala" });

      expect(r.ok).toBe(true);
      expect(server.apeluriPe("maintenance_attachments")).toHaveLength(0);
    });

    it("rezultatul rămâne „amânată” ⇒ PV-ul nu se cere", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_interventions", "select", { data: RAND_INAINTE });
      server.raspunde("maintenance_interventions", "update", {
        data: { id: ID_1, equipment_id: ID_2, plan_id: null },
      });

      const r = await actualizeazaInterventie({
        ...corectura,
        tip: "verificare_legala",
        rezultat: "amanata",
      });

      expect(r.ok).toBe(true);
      expect(server.apeluriPe("maintenance_attachments")).toHaveLength(0);
    });
  });

  it("garda din bază (P0001) ajunge la om cu mesajul ei", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_interventions", "select", { data: RAND_INAINTE });
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
