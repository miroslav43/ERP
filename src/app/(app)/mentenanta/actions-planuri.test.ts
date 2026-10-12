// src/app/(app)/mentenanta/actions-planuri.test.ts
//
// Planurile de mentenanță și intervențiile. Scadențele planului și costul
// total al intervenției le calculează baza — acțiunile nu au voie să le
// trimită (`maintenance_plans_calc`, coloana GENERATED `cost_total`).

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
import { actualizeazaPlan, creeazaPlan, inregistreazaInterventie } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const UPDATE = { "maintenance:update": "team" } as const;

const plan = {
  equipment_id: ID_1,
  denumire: "Revizie anuală",
  periodicitate_zile: "365",
  periodicitate_contor: "500",
  tip_contor: "ore",
};

const interventie = {
  plan_id: ID_2,
  equipment_id: ID_1,
  data: "2026-09-22",
  descriere: "Schimb ulei și filtre.",
  executant_extern: "Service Hidraulic SRL",
  cost_piese: "300",
  cost_manopera: "150",
  rezultat: "reusita",
};

const SCADENTE_PLAN = ["urmatoarea_scadenta", "urmatoarea_scadenta_contor"];

describe("pragul de permisiune", () => {
  it.each([
    ["creeazaPlan", creeazaPlan, plan],
    ["actualizeazaPlan", actualizeazaPlan, { ...plan, id: ID_3 }],
    ["inregistreazaInterventie", inregistreazaInterventie, interventie],
  ] as const)("%s: `maintenance:update` own < team ⇒ INTERZIS", async (_n, actiune, intrare) => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "maintenance:update": "own", "maintenance:create": "all" },
    });
    const r = await actiune(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("creeazaPlan", () => {
  it("INSERT cu organizația din sesiune, fără scadențele recalculate de trigger", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "insert", { data: { id: ID_3 } });

    const r = await creeazaPlan({
      ...plan,
      ultima_citire_contor: "3200",
      urmatoarea_scadenta: "2027-01-01",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("maintenance_plans");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      equipment_id: ID_1,
      tip: "preventiva",
      periodicitate_zile: 365,
      periodicitate_contor: 500,
      tip_contor: "ore",
      // Citirea de pornire intră DOAR la creare — de aici pleacă scadența pe contor.
      ultima_citire_contor: 3200,
      activ: true,
    });
    for (const coloana of SCADENTE_PLAN) expect(apel?.payload).not.toHaveProperty(coloana);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual([
      `/mentenanta/echipamente/${ID_1}`,
      "/mentenanta/planuri",
      "/mentenanta",
    ]);
  });

  it("fără nicio periodicitate: VALIDARE pe `periodicitate_zile`, înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await creeazaPlan({ equipment_id: ID_1, denumire: "Fără ritm" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("periodicitate_zile");
    expect(server.apeluri).toHaveLength(0);
  });

  it("periodicitate pe contor fără tipul contorului: VALIDARE pe `tip_contor`", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await creeazaPlan({ ...plan, tip_contor: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("tip_contor");
    expect(server.apeluri).toHaveLength(0);
  });

  it("doar periodicitate în zile, fără contor: acceptat", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "insert", { data: { id: ID_3 } });
    const r = await creeazaPlan({
      equipment_id: ID_1,
      denumire: "Verificare",
      periodicitate_zile: 30,
    });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("maintenance_plans")[0]?.payload).toMatchObject({
      periodicitate_contor: null,
      tip_contor: null,
    });
  });

  it("CHECK din bază (23514): VALIDARE cu cod de referință", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "insert", { error: eroarePostgrest("23514") });
    const r = await creeazaPlan(plan);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.message).toContain("Cod de referință");
  });
});

describe("actualizeazaPlan", () => {
  it("UPDATE fără id, pe id + organizație, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: { id: ID_3 } });

    const r = await actualizeazaPlan({
      ...plan,
      id: ID_3,
      activ: false,
      ultima_citire_contor: null,
    });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("maintenance_plans");
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).toMatchObject({ activ: false, denumire: "Revizie anuală" });
    for (const coloana of SCADENTE_PLAN) expect(apel?.payload).not.toHaveProperty(coloana);
    // DEFECTUL reparat în 0180/M1: formularul trimitea `ultima_citire_contor:
    // null` la orice editare, UPDATE-ul o scria, iar triggerul recalcula
    // scadența pe contor de la zero. Acum coloana nu intră deloc în UPDATE.
    expect(apel?.payload).not.toHaveProperty("ultima_citire_contor");
    expect(areFiltru(apel, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual([
      `/mentenanta/echipamente/${ID_1}`,
      "/mentenanta/planuri",
      "/mentenanta",
    ]);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "update", { data: null });
    const r = await actualizeazaPlan({ ...plan, id: ID_3 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("regula periodicității se aplică și la editare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await actualizeazaPlan({
      ...plan,
      id: ID_3,
      periodicitate_zile: null,
      periodicitate_contor: null,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("inregistreazaInterventie", () => {
  /** Planul legat se citește întâi: tipul lui spune dacă PV-ul e obligatoriu. */
  function planPreventiv(server: ReturnType<typeof configureazaActiunea>["server"]): void {
    server.raspunde("maintenance_plans", "select", { data: { id: ID_2, tip: "preventiva" } });
  }

  it("INSERT cu organizația din sesiune, fără `cost_total` (coloană GENERATED)", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    planPreventiv(server);
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });

    const r = await inregistreazaInterventie({ ...interventie, cost_total: 450 });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("maintenance_interventions");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      plan_id: ID_2,
      equipment_id: ID_1,
      tip: "corectiva",
      cost_piese: 300,
      cost_manopera: 150,
      ora_start: null,
      acoperit_de_garantie: false,
    });
    expect(apel?.payload).not.toHaveProperty("cost_total");
    // Fără document: id-ul îl dă baza, numărul PV-ului îl dă triggerul.
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).not.toHaveProperty("numar");
    expect(apel?.payload).not.toHaveProperty("atasament");
    expect(apel?.selectDupaScriere).toBe("id");
    // Planul DOAR se citește; îl actualizează triggerul AFTER, nu acțiunea.
    expect(server.apeluriPe("maintenance_plans").map((a) => a.operatie)).toEqual(["select"]);
    const [plan] = server.apeluriPe("maintenance_plans");
    expect(areFiltru(plan, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(plan, "is", "deleted_at", null)).toBe(true);
    expect(caiRevalidate()).toEqual([
      `/mentenanta/echipamente/${ID_1}`,
      "/mentenanta/interventii",
      "/mentenanta/planuri",
      "/mentenanta",
    ]);
  });

  it("costuri negative sunt refuzate de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await inregistreazaInterventie({ ...interventie, cost_piese: "-5" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  // Cazul 33: exact un executant.
  it.each([
    ["niciun executant", { executant_extern: null }, "executant_employee_id"],
    ["amândoi", { executant_employee_id: ID_3 }, "executant_extern"],
  ] as const)("%s: VALIDARE pe `%s`, înainte de bază", async (_n, schimbare, camp) => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await inregistreazaInterventie({ ...interventie, ...schimbare });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("garanția lucrării înaintea intervenției: VALIDARE", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await inregistreazaInterventie({
      ...interventie,
      garantie_lucrare_pana: "2026-09-01",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("garantie_lucrare_pana");
    expect(server.apeluri).toHaveLength(0);
  });

  it("planul șters sau din altă firmă: NEGASIT, nicio inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "select", { data: null });
    const r = await inregistreazaInterventie(interventie);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
  });

  // Cazul 34: verificarea legală cere PV sau buletin — și după tipul planului.
  it.each([
    ["tipul intervenției", { tip: "verificare_legala", plan_id: null }, "corectiva"],
    ["tipul planului", {}, "verificare_legala"],
  ] as const)(
    "verificare legală după %s, fără document: VALIDARE pe `document`, nicio inserare",
    async (_n, schimbare, tipPlan) => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_plans", "select", { data: { id: ID_2, tip: tipPlan } });
      const r = await inregistreazaInterventie({ ...interventie, ...schimbare });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("document");
      expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
    },
  );

  it("verificare legală amânată (fără PV de dat): se înregistrează", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("maintenance_plans", "select", {
      data: { id: ID_2, tip: "verificare_legala" },
    });
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    const r = await inregistreazaInterventie({ ...interventie, rezultat: "amanata" });
    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
  });

  describe("cu procesul-verbal urcat înainte (M6)", () => {
    const ID_NOU = "88888888-8888-4888-8888-888888888888";
    const cale = `${ORG_ID}/intervention/${ID_NOU}/abc-pv.pdf`;
    const legala = {
      ...interventie,
      id: ID_NOU,
      atasament: { cale, denumire: "PV verificare.pdf", tip: "pv" },
    };

    function pregatit(server: ReturnType<typeof configureazaActiunea>["server"]): void {
      server.raspunde("maintenance_plans", "select", {
        data: { id: ID_2, tip: "verificare_legala" },
      });
      server.raspundeStocare("org-mentenanta", "info", {
        data: { size: 4096, contentType: "application/pdf" },
      });
    }

    it("măsoară obiectul REAL, scrie intervenția cu id-ul din browser, apoi rândul atașamentului", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      pregatit(server);
      server.raspunde("maintenance_interventions", "insert", { data: { id: ID_NOU } });
      server.raspunde("maintenance_attachments", "insert", { data: null });

      const r = await inregistreazaInterventie(legala);

      expect(r).toEqual({ ok: true, data: { id: ID_NOU } });
      const [interv] = server.apeluriPe("maintenance_interventions");
      expect(interv?.payload).toMatchObject({ id: ID_NOU, organization_id: ORG_ID });
      expect(interv?.payload).not.toHaveProperty("atasament");
      const [atas] = server.apeluriPe("maintenance_attachments");
      expect(atas?.payload).toEqual({
        organization_id: ORG_ID,
        entity_type: "intervention",
        entity_id: ID_NOU,
        storage_path: cale,
        denumire: "PV verificare.pdf",
        tip: "pv",
        created_by: USER_ID,
      });
    });

    it("calea din alt folder (altă intervenție, altă firmă): VALIDARE, nicio inserare", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_plans", "select", {
        data: { id: ID_2, tip: "verificare_legala" },
      });
      const r = await inregistreazaInterventie({
        ...legala,
        atasament: { ...legala.atasament, cale: `${ORG_ID}/intervention/${ID_3}/pv.pdf` },
      });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
    });

    it("factura nu ține loc de PV la o verificare legală: VALIDARE", async () => {
      const { server } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_plans", "select", {
        data: { id: ID_2, tip: "verificare_legala" },
      });
      const r = await inregistreazaInterventie({
        ...legala,
        atasament: { ...legala.atasament, tip: "factura" },
      });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("document");
    });

    it("atașamentul refuzat de bază: intervenția se anulează logic, obiectul nefolosit se șterge", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: UPDATE });
      pregatit(server);
      server.raspunde("maintenance_interventions", "insert", { data: { id: ID_NOU } });
      server.raspunde("maintenance_attachments", "insert", { error: eroarePostgrest("42501") });
      server.raspunde("maintenance_interventions", "update", { data: [{ id: ID_NOU }] });
      admin.raspunde("maintenance_attachments", "select", { data: [] });
      admin.raspundeStocare("org-mentenanta", "remove", { data: [] });

      const r = await inregistreazaInterventie(legala);

      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      const [anulare] = server.apeluriPe("maintenance_interventions", "update");
      expect(anulare?.payload).toHaveProperty("deleted_at");
      expect(areFiltru(anulare, "eq", "id", ID_NOU)).toBe(true);
      expect(areFiltru(anulare, "eq", "organization_id", ORG_ID)).toBe(true);
      const [legatura] = admin.apeluriPe("maintenance_attachments");
      expect(areFiltru(legatura, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(legatura, "eq", "storage_path", cale)).toBe(true);
      expect(admin.apeluriStocare.map((a) => a.metoda)).toEqual(["remove"]);
    });

    it("obiectul folosit deja de un rând NU se șterge (id și cale ale unei intervenții reale)", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: UPDATE });
      pregatit(server);
      server.raspunde("maintenance_interventions", "insert", { error: eroarePostgrest("23514") });
      admin.raspunde("maintenance_attachments", "select", { data: [{ id: ID_3 }] });

      const r = await inregistreazaInterventie({ ...legala, id: ID_NOU });
      expect(r.ok).toBe(false);
      expect(admin.apeluriStocare).toHaveLength(0);
    });

    it("a doua trimitere a aceleiași casete (23505 pe id): CONFLICT „trimitere dublă”, fișierul rămâne", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: UPDATE });
      pregatit(server);
      server.raspunde("maintenance_interventions", "insert", { error: eroarePostgrest("23505") });

      const r = await inregistreazaInterventie(legala);

      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      if (!r.ok) expect(r.error.message).toContain("trimitere dublă");
      expect(admin.apeluri).toHaveLength(0);
    });

    it("documentul urcat nu e PDF/Word/fotografie: VALIDARE, iar obiectul se șterge", async () => {
      const { server, admin } = configureazaActiunea({ permisiuni: UPDATE });
      server.raspunde("maintenance_plans", "select", {
        data: { id: ID_2, tip: "verificare_legala" },
      });
      server.raspundeStocare("org-mentenanta", "info", {
        data: { size: 4096, contentType: "application/x-msdownload" },
      });
      admin.raspunde("maintenance_attachments", "select", { data: [] });
      admin.raspundeStocare("org-mentenanta", "remove", { data: [] });

      const r = await inregistreazaInterventie(legala);
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      expect(server.apeluriPe("maintenance_interventions")).toHaveLength(0);
      expect(admin.apeluriStocare.map((a) => a.metoda)).toEqual(["remove"]);
    });
  });

  it("depășire numerică (22003): CONFLICT cu îndrumare spre costuri și durate", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    planPreventiv(server);
    server.raspunde("maintenance_interventions", "insert", { error: eroarePostgrest("22003") });
    const r = await inregistreazaInterventie(interventie);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("costurile și duratele");
  });

  it("auditul de succes nu poartă descrierea și piesele (text liber)", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    planPreventiv(server);
    server.raspunde("maintenance_interventions", "insert", { data: { id: ID_3 } });
    await inregistreazaInterventie({ ...interventie, piese: "Filtru X" });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: ID_3 });
    expect(audit?.p_after).toMatchObject({ cost_piese: 300, rezultat: "reusita" });
    expect(audit?.p_after).not.toHaveProperty("descriere");
    expect(audit?.p_after).not.toHaveProperty("piese");
  });
});
