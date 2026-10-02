// src/app/(app)/ticketing/actions-solicitant.test.ts
//
// Acțiunile pe care le face solicitantul sau aprobatorul lui: deschiderea
// tichetului, decizia de aprobare, schimbarea stării, comentariul și urmărirea.
// Fiecare scriere filtrează pe organizația din sesiune — politica
// `tickets_update` ar accepta altfel un tichet din altă firmă a aceluiași om.

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
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { comenteaza, creeazaTichet, decideTichet, schimbaStatusul, urmareste } from "./actions";

const TICHET = ID_1;
const FISA = ID_2;
const OBIECT = ID_3;
const DEPARTAMENT = "88888888-8888-4888-8888-888888888888";
const NUMAR = "IT-2026-00042";
const CAI = ["/ticketing", "/panou", "/portal", "/portal/tichetele-mele"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── creeazaTichet ─────────────────────────────────────────────────────────────

describe("creeazaTichet", () => {
  const PERMIS = { "tickets:create": "own" } as const;
  const comun = { titlu: "Laptop nou", descriere: "Cel vechi nu mai ține bateria." };

  /** Fișa proprie, numărul rezervat și departamentul fișei. */
  function pregatire(
    server: ClientFals,
    admin: ClientFals,
    departament: string | null = DEPARTAMENT,
  ) {
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeRpc("aloca_numar_tichet", { data: NUMAR });
    admin.raspunde("employees", "select", { data: { department_id: departament } });
    server.raspunde("tickets", "insert", { data: { id: TICHET, numar_afisat: NUMAR } });
  }

  it("fără `tickets:create`: INTERZIS, fără numere rezervate", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "tickets:read": "own" },
    });
    const r = await creeazaTichet({
      tip: "software",
      ...comun,
      aplicatie: "Figma",
      numar_licente: 1,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it.each([
    [
      "software",
      { aplicatie: "Figma", numar_licente: 2, motiv_necesitate: "Machete pentru client." },
      {
        status: "in_aprobare",
        aprobare_ceruta: true,
        aplicatie: "Figma",
        numar_licente: 2,
        motiv_necesitate: "Machete pentru client.",
      },
    ],
    [
      "hardware",
      {
        denumire_hardware: "Monitor 27”",
        loc_livrare: "domiciliu",
        adresa_livrare: "Str. Lungă 10, Cluj",
      },
      {
        status: "in_aprobare",
        aprobare_ceruta: true,
        denumire_hardware: "Monitor 27”",
        loc_livrare: "domiciliu",
        adresa_livrare: "Str. Lungă 10, Cluj",
      },
    ],
    [
      "defectiune",
      { inventory_item_id: OBIECT, blocheaza_activitatea: true, locatie: "Etaj 2" },
      {
        status: "nou",
        aprobare_ceruta: false,
        inventory_item_id: OBIECT,
        blocheaza_activitatea: true,
        locatie: "Etaj 2",
      },
    ],
    [
      "bug_erp",
      {
        modul: "Concedii",
        pasi_efectuati: "Am apăsat Trimite.",
        rezultat_asteptat: "Cererea pleacă.",
        rezultat_obtinut: "Ecran alb.",
        context: { url: "/concedii", versiune: "1.2.3" },
      },
      {
        status: "nou",
        aprobare_ceruta: false,
        modul: "Concedii",
        pasi_efectuati: "Am apăsat Trimite.",
        rezultat_asteptat: "Cererea pleacă.",
        rezultat_obtinut: "Ecran alb.",
        context: { url: "/concedii", versiune: "1.2.3" },
      },
    ],
  ] as const)(
    "tip `%s`: starea inițială, aprobarea și câmpurile proprii tipului",
    async (tip, specifice, asteptat) => {
      const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
      pregatire(server, admin);

      const r = await creeazaTichet({ tip, ...comun, ...specifice });

      expect(r).toEqual({ ok: true, data: { id: TICHET, numar: NUMAR } });
      const [insert] = server.apeluriPe("tickets", "insert");
      expect(insert?.payload).toEqual({
        organization_id: ORG_ID,
        numar_afisat: NUMAR,
        tip,
        titlu: "Laptop nou",
        descriere: "Cel vechi nu mai ține bateria.",
        solicitant_employee_id: FISA,
        department_id: DEPARTAMENT,
        ...asteptat,
      });
      expect(insert?.selectDupaScriere).toBeDefined();
      expect(insert?.terminal).toBe("single");
    },
  );

  it("numărul se rezervă pe organizația din sesiune; fișa e a utilizatorului din organizație", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    pregatire(server, admin);
    await creeazaTichet({ tip: "software", ...comun, aplicatie: "Figma", numar_licente: 1 });

    expect(server.apeluriRpc).toContainEqual({
      nume: "aloca_numar_tichet",
      argumente: { p_organization_id: ORG_ID },
    });
    const [fisa, departament] = admin.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(departament, "eq", "id", FISA)).toBe(true);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("câmpurile opționale goale nu ajung în rând; fișa fără departament nu scrie `department_id`", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    pregatire(server, admin, null);
    await creeazaTichet({
      tip: "software",
      ...comun,
      aplicatie: "Figma",
      numar_licente: 1,
      motiv_necesitate: "",
    });
    const payload = server.apeluriPe("tickets", "insert")[0]?.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("motiv_necesitate");
    expect(payload).not.toHaveProperty("department_id");
  });

  it("livrare la domiciliu fără adresă: VALIDARE pe `adresa_livrare`, fără număr rezervat", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    const r = await creeazaTichet({
      tip: "hardware",
      ...comun,
      denumire_hardware: "Monitor",
      loc_livrare: "domiciliu",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("adresa_livrare");
    expect(admin.apeluri).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("cont fără fișă de angajat: CONFLICT, niciun număr consumat din secvență", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { data: null });
    const r = await creeazaTichet({
      tip: "software",
      ...comun,
      aplicatie: "Figma",
      numar_licente: 1,
    });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("fișă de angajat") },
    });
    expect(server.apeluriRpc.filter((a) => a.nume === "aloca_numar_tichet")).toHaveLength(0);
    expect(server.apeluriPe("tickets")).toHaveLength(0);
  });

  it("eroare la citirea fișei proprii: EROARE_INTERNA, nu „cont fără fișă”, niciun număr consumat", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    const r = await creeazaTichet({
      tip: "software",
      ...comun,
      aplicatie: "Figma",
      numar_licente: 1,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriRpc.filter((a) => a.nume === "aloca_numar_tichet")).toHaveLength(0);
    expect(server.apeluriPe("tickets")).toHaveLength(0);
  });

  // `actions.ts:136-141`: departamentul fișei se citește cu clientul ADMIN
  // filtrat doar pe `id`. CLAUDE.md cere, la orice ocolire a RLS, filtru
  // explicit pe `organization_id`. Fișa vine dintr-o interogare deja filtrată
  // pe organizație, deci azi nu se scurge nimic — dar a doua plasă lipsește.
  it("departamentul fișei se citește cu clientul admin, filtrat explicit pe organizație", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    pregatire(server, admin);
    await creeazaTichet({ tip: "software", ...comun, aplicatie: "Figma", numar_licente: 1 });
    const departament = admin.apeluriPe("employees", "select")[1];
    expect(areFiltru(departament, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  // Tot acolo, `error` nu se citește deloc: o eroare la citirea departamentului
  // scrie tichetul fără `department_id`, fără nicio urmă — iar rutarea și
  // rapoartele pe departament îl pierd.
  it("o eroare la citirea departamentului NU e înghițită: tichetul nu se scrie fără el", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeRpc("aloca_numar_tichet", { data: NUMAR });
    admin.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    server.raspunde("tickets", "insert", { data: { id: TICHET, numar_afisat: NUMAR } });
    const r = await creeazaTichet({
      tip: "software",
      ...comun,
      aplicatie: "Figma",
      numar_licente: 1,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("tickets", "insert")).toHaveLength(0);
  });

  it("rezervarea numărului eșuează: eroarea se propagă, tichetul nu se inserează", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeRpc("aloca_numar_tichet", { error: eroarePostgrest("42501") });
    const r = await creeazaTichet({
      tip: "software",
      ...comun,
      aplicatie: "Figma",
      numar_licente: 1,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("tickets")).toHaveLength(0);
  });

  it("obiect de inventar nealocat (P0001 din trigger): CONFLICT, fără revalidare", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeRpc("aloca_numar_tichet", { data: NUMAR });
    admin.raspunde("employees", "select", { data: { department_id: null } });
    server.raspunde("tickets", "insert", {
      error: eroarePostgrest("P0001", "Obiectul nu e în primire."),
    });
    const r = await creeazaTichet({
      tip: "defectiune",
      ...comun,
      inventory_item_id: OBIECT,
      blocheaza_activitatea: false,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("auditul nu conține descrierea liberă (date personale)", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    pregatire(server, admin);
    await creeazaTichet({ tip: "software", ...comun, aplicatie: "Figma", numar_licente: 1 });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: TICHET });
    expect(audit?.p_after).toEqual({ tip: "software", titlu: "Laptop nou", numar_licente: 1 });
  });
});

// ── decideTichet ──────────────────────────────────────────────────────────────

describe("decideTichet", () => {
  const PERMIS = { "tickets:approve": "team" } as const;
  const deAprobat = { id: TICHET, status: "in_aprobare", aprobare_ceruta: true };

  it("scope `own` (sub pragul `team`): INTERZIS, fără interogări", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "tickets:approve": "own" },
    });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("aprobare: tichetul trece `in_lucru`, fără motiv de respingere, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("tickets", "select", { data: deAprobat });
    server.raspunde("tickets", "update", { data: { id: TICHET } });

    const r = await decideTichet({ ticket_id: TICHET, aprobat: true });

    expect(r).toEqual({ ok: true, data: { status: "in_lucru" } });
    const [citire] = server.apeluriPe("tickets", "select");
    expect(areFiltru(citire, "eq", "id", TICHET)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [apel] = server.apeluriPe("tickets", "update");
    expect(apel?.payload).toEqual({ status: "in_lucru" });
    expect(areFiltru(apel, "eq", "id", TICHET)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("respingere: tichetul trece `respins`, cu motivul scris", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("tickets", "select", { data: deAprobat });
    server.raspunde("tickets", "update", { data: { id: TICHET } });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: false, motiv: "Buget epuizat." });
    expect(r).toEqual({ ok: true, data: { status: "respins" } });
    expect(server.apeluriPe("tickets", "update")[0]?.payload).toEqual({
      status: "respins",
      motiv_respingere: "Buget epuizat.",
    });
  });

  it("respingere fără motiv: VALIDARE pe `motiv`", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: false, motiv: "  " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("motiv");
    expect(server.apeluri).toHaveLength(0);
  });

  it("tichet invizibil: NEGASIT", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("tickets", "select", { data: null });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: true });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("eroare la citirea tichetului: EROARE_INTERNA, nu NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("tickets", "select", { error: eroarePostgrest("57014") });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: true });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("tickets", "update")).toHaveLength(0);
  });

  it("refuz de bază la decizie (42501): INTERZIS, nu „deja decisă de altcineva”", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("tickets", "select", { data: deAprobat });
    server.raspunde("tickets", "update", { error: eroarePostgrest("42501") });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("tip fără aprobare (defecțiune, bug): CONFLICT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("tickets", "select", {
      data: { ...deAprobat, status: "nou", aprobare_ceruta: false },
    });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: true });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("nu trece prin aprobare") },
    });
    expect(server.apeluriPe("tickets", "update")).toHaveLength(0);
  });

  it.each(["in_lucru", "respins", "anulat"])(
    "cerere deja `%s`: CONFLICT, fără UPDATE",
    async (status) => {
      const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
      server.raspunde("tickets", "select", { data: { ...deAprobat, status } });
      const r = await decideTichet({ ticket_id: TICHET, aprobat: true });
      expect(r).toMatchObject({
        ok: false,
        error: { code: "CONFLICT", message: expect.stringContaining("nu mai este în așteptarea") },
      });
      expect(server.apeluriPe("tickets", "update")).toHaveLength(0);
    },
  );

  it("decisă de altcineva între citire și scriere (zero rânduri): CONFLICT, nu „aprobat”", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("tickets", "select", { data: deAprobat });
    server.raspunde("tickets", "update", { data: null });
    const r = await decideTichet({ ticket_id: TICHET, aprobat: true });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("deja decisă") },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── schimbaStatusul ───────────────────────────────────────────────────────────

describe("schimbaStatusul", () => {
  const PERMIS = { "tickets:update": "own" } as const;

  it("fără `tickets:update`: INTERZIS, fără interogări", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "tickets:read": "own" },
    });
    const r = await schimbaStatusul({ ticket_id: TICHET, status: "inchis" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: UPDATE doar pe `status`, pe id + organizație, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("tickets", "update", { data: { id: TICHET } });
    const r = await schimbaStatusul({ ticket_id: TICHET, status: "inchis" });
    expect(r).toEqual({ ok: true, data: { status: "inchis" } });
    const [apel] = server.apeluriPe("tickets");
    expect(apel?.payload).toEqual({ status: "inchis" });
    expect(areFiltru(apel, "eq", "id", TICHET)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("status necunoscut: VALIDARE, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    const r = await schimbaStatusul({ ticket_id: TICHET, status: "sters" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("rând sărit de politică (zero rânduri): CONFLICT", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("tickets", "update", { data: null });
    const r = await schimbaStatusul({ ticket_id: TICHET, status: "redeschis" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("nu a putut fi mutat") },
    });
  });

  it("tranziție nepermisă (P0001 din trigger): CONFLICT pe calea generică, nu „nu a putut fi mutat”", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("tickets", "update", {
      error: eroarePostgrest("P0001", "Tranziție nepermisă: anulat → in_lucru."),
    });
    const r = await schimbaStatusul({ ticket_id: TICHET, status: "in_lucru" });
    // Modulul nu are `traduEroare`: P0001 trece prin `mapPostgrestError`, cu
    // mesajul lui fix. Ramura de zero rânduri ar fi dat alt text.
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Operațiunea a fost respinsă de o regulă a sistemului." },
    });
  });

  it("refuz de bază la UPDATE (42501): INTERZIS, nu CONFLICT", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("tickets", "update", { error: eroarePostgrest("42501") });
    const r = await schimbaStatusul({ ticket_id: TICHET, status: "inchis" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

// ── comenteaza ────────────────────────────────────────────────────────────────

describe("comenteaza", () => {
  const PERMIS = { "tickets:read": "own" } as const;

  it("fără `tickets:read`: INTERZIS, fără interogări", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await comenteaza({ ticket_id: TICHET, continut: "Salut" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("succes: comentariul public al fișei proprii, în organizația din sesiune", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("ticket_comments", "insert", { data: { id: ID_3 } });

    const r = await comenteaza({ ticket_id: TICHET, continut: "  Merge acum, mulțumesc!  " });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("ticket_comments");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      ticket_id: TICHET,
      autor_employee_id: FISA,
      continut: "Merge acum, mulțumesc!",
      intern: false,
    });
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("nota internă a solicitantului e refuzată de bază (42501): INTERZIS", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspunde("ticket_comments", "insert", { error: eroarePostgrest("42501") });
    const r = await comenteaza({ ticket_id: TICHET, continut: "notă", intern: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("ticket_comments")[0]?.payload).toMatchObject({ intern: true });
  });

  it("cont fără fișă: CONFLICT, fără INSERT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    admin.raspunde("employees", "select", { data: null });
    const r = await comenteaza({ ticket_id: TICHET, continut: "Salut" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("comentariu gol după tăierea spațiilor: VALIDARE", async () => {
    const { admin } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    const r = await comenteaza({ ticket_id: TICHET, continut: "   " });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(admin.apeluri).toHaveLength(0);
  });
});

// ── urmareste ─────────────────────────────────────────────────────────────────

describe("urmareste", () => {
  const PERMIS = { "tickets:read": "own" } as const;

  it("fără `tickets:read`: INTERZIS, fără interogări", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await urmareste({ ticket_id: TICHET, employee_id: FISA });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: INSERT în `ticket_watchers` cu organizația din sesiune", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("ticket_watchers", "insert", { data: null });
    const r = await urmareste({ ticket_id: TICHET, employee_id: FISA });
    expect(r).toEqual({ ok: true, data: { ok: true } });
    expect(server.apeluriPe("ticket_watchers")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      ticket_id: TICHET,
      employee_id: FISA,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("deja urmărit (23505): succes idempotent, nu eroare", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("ticket_watchers", "insert", { error: eroarePostgrest("23505") });
    const r = await urmareste({ ticket_id: TICHET, employee_id: FISA });
    expect(r).toEqual({ ok: true, data: { ok: true } });
  });

  it("refuz de politică (42501): eroarea NU se înghite ca la duplicat", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("ticket_watchers", "insert", { error: eroarePostgrest("42501") });
    const r = await urmareste({ ticket_id: TICHET, employee_id: FISA });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });
});
