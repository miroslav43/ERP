// src/app/(app)/reges/actions.test.ts
//
// Acțiunile REGES care NU ating rețeaua: marcarea manuală a unui eveniment ca
// transmis și exportul CSV de lucru. Marcarea e o afirmație despre registrul
// oficial, deci poarta ei e `reges:update` — exact ce gatează pagina.

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

import { exportaEvenimente, marcheazaTransmis } from "./actions";

const ACTUALIZARE = { "reges:update": "all" } as const;
const EXPORT = { "reges:export": "all" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  // 10:00 la București, 15 septembrie 2026.
  vi.setSystemTime(new Date("2026-09-15T07:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("marcheazaTransmis", () => {
  const intrare = {
    evenimentId: ID_1,
    transmisLa: "2026-09-14",
    numarInregistrare: "  ITM-123  ",
  };

  it("cheia de CITIRE nu ajunge: INTERZIS fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:read": "all" } });
    const r = await marcheazaTransmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("`reges:update` la `team`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:update": "team" } });
    const r = await marcheazaTransmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("modulul REGES oprit: MODUL_DEZACTIVAT", async () => {
    configureazaActiunea({ functii: ["nucleu"], permisiuni: ACTUALIZARE });
    const r = await marcheazaTransmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
  });

  it("citește evenimentul firmei, apoi îl marchează cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { data: { id: ID_1, status: "pregatit" } });
    server.raspunde("reges_evenimente", "update", { data: { id: ID_1 } });

    const r = await marcheazaTransmis({ ...intrare, observatii: "Depus la ghișeu" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = server.apeluriPe("reges_evenimente", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [scriere] = server.apeluriPe("reges_evenimente", "update");
    expect(scriere?.payload).toEqual({
      status: "transmis",
      transmis_la: "2026-09-14T00:00:00Z",
      transmis_de: USER_ID,
      numar_inregistrare: "ITM-123",
      eroare: null,
      observatii: "Depus la ghișeu",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/reges"]);
  });

  it("fără observații, câmpul nu se trimite (nu se șterge ce era scris)", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { data: { id: ID_1, status: "de_pregatit" } });
    server.raspunde("reges_evenimente", "update", { data: { id: ID_1 } });
    await marcheazaTransmis(intrare);
    expect(server.apeluriPe("reges_evenimente", "update")[0]?.payload).not.toHaveProperty(
      "observatii",
    );
  });

  it("data transmiterii azi e acceptată (limita inclusă)", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { data: { id: ID_1, status: "respins" } });
    server.raspunde("reges_evenimente", "update", { data: { id: ID_1 } });
    const r = await marcheazaTransmis({ ...intrare, transmisLa: "2026-09-15" });
    expect(r.ok).toBe(true);
  });

  it("data transmiterii în viitor e refuzată înainte de orice citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await marcheazaTransmis({ ...intrare, transmisLa: "2026-09-16" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Data transmiterii nu poate fi în viitor." },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("evenimentul inexistent sau al altei firme: NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { data: null });
    const r = await marcheazaTransmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("reges_evenimente", "update")).toHaveLength(0);
  });

  it.each([
    ["anulat", "Evenimentul este anulat și nu mai poate fi marcat ca transmis."],
    ["transmis", "Evenimentul este deja marcat ca transmis."],
    ["confirmat", "Evenimentul este deja marcat ca transmis."],
  ])("status `%s`: CONFLICT, fără UPDATE", async (status, mesaj) => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { data: { id: ID_1, status } });
    const r = await marcheazaTransmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(server.apeluriPe("reges_evenimente", "update")).toHaveLength(0);
  });

  it("UPDATE cu zero rânduri: CONFLICT „a rămas netransmis”, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { data: { id: ID_1, status: "pregatit" } });
    server.raspunde("reges_evenimente", "update", { data: null });
    const r = await marcheazaTransmis(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Marcarea ca transmis a fost respinsă. Evenimentul a rămas netransmis.",
      },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("eroarea citirii oprește marcarea și nu se deghizează în „negăsit”", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { error: eroarePostgrest("42501") });
    const r = await marcheazaTransmis(intrare);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).not.toBe("NEGASIT");
    expect(server.apeluriPe("reges_evenimente", "update")).toHaveLength(0);
  });

  // `throw mapPostgrestError(...)` aruncă un `ActionError` SIMPLU — nici
  // `ActionDenied`, nici eroare PostgREST (n-are `details`) — deci `createAction`
  // îl tratează ca excepție necunoscută: EROARE_INTERNA, cu codul bazei pierdut.
  it.fails("DEFECT: 42501 la citire devine EROARE_INTERNA în loc de INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("reges_evenimente", "select", { error: eroarePostgrest("42501") });
    const r = await marcheazaTransmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it.fails(
    "DEFECT: P0001 din triggerul de tranziție devine EROARE_INTERNA în loc de CONFLICT",
    async () => {
      const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
      server.raspunde("reges_evenimente", "select", { data: { id: ID_1, status: "pregatit" } });
      server.raspunde("reges_evenimente", "update", { error: eroarePostgrest("P0001") });
      const r = await marcheazaTransmis(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    },
  );

  it("numărul de înregistrare gol e respins de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await marcheazaTransmis({ ...intrare, numarInregistrare: "   " });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("exportaEvenimente", () => {
  const eveniment = (id: string, angajat: string, contract: string | null) => ({
    id,
    event_type: "angajare",
    data_evenimentului: "2026-09-10",
    termen_transmitere: "2026-09-09",
    employee_id: angajat,
    contract_id: contract,
  });

  function programeazaRestul(server: ReturnType<typeof configureazaActiunea>["server"]) {
    server.raspunde("employees", "select", {
      data: [{ id: ID_2, marca: "0042", first_name: "Ion", last_name: "Pop", cetatenie: "RO" }],
    });
    server.raspunde("employee_sensitive_data", "select", {
      data: [{ employee_id: ID_2, cnp_last4: "1234" }],
    });
    server.raspunde("organizations", "select", {
      data: { id: ORG_ID, name: "Firma Test", cui: "RO 123", reg_com: "J40/1/2020" },
    });
  }

  it("cheia de citire nu ajunge: exportul cere `reges:export`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:read": "all" } });
    const r = await exportaEvenimente({ doarNetransmise: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("`reges:export` la `own`: INTERZIS", async () => {
    configureazaActiunea({ permisiuni: { "reges:export": "own" } });
    const r = await exportaEvenimente({ doarNetransmise: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it("doar netransmise: filtrul de status, organizația, rândurile vii, plafonul explicit", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, null)] });
    programeazaRestul(server);

    const r = await exportaEvenimente({ doarNetransmise: true });

    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("reges_evenimente");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["de_pregatit", "pregatit", "respins"])).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [2000] });
    // Fără contracte în lot: nicio interogare pe contracte.
    expect(server.apeluriPe("employment_contracts")).toHaveLength(0);
  });

  it("toate evenimentele: fără filtru de status", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, null)] });
    programeazaRestul(server);
    await exportaEvenimente({ doarNetransmise: false });
    expect(areFiltru(server.apeluriPe("reges_evenimente")[0], "in", "status")).toBe(false);
  });

  it("numele fișierului vine din CUI-ul curățat și ziua de azi; CNP-ul iese mascat", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, ID_3)] });
    server.raspunde("employees", "select", {
      data: [{ id: ID_2, marca: "0042", first_name: "Ion", last_name: "Pop", cetatenie: "RO" }],
    });
    server.raspunde("employee_sensitive_data", "select", {
      data: [{ employee_id: ID_2, cnp_last4: "1234" }],
    });
    server.raspunde("employment_contracts", "select", {
      data: [
        {
          id: ID_3,
          numar: "12",
          data_contract: "2026-09-01",
          valabil_de_la: "2026-09-10",
          valabil_pana: null,
          contract_duration: "nedeterminat",
          norma_ore_saptamana: "40",
          norma_ore_zi: "8",
          functie: "Contabil",
          cod_cor: "241103",
          conditii_munca: "normale",
          salariu_baza: "5000",
          moneda: "RON",
          cod_revisal: null,
          temei_incetare: null,
          incetat_la: null,
        },
      ],
    });
    server.raspunde("organizations", "select", {
      data: { id: ORG_ID, name: "Firma Test", cui: "RO 123", reg_com: "J40/1/2020" },
    });

    const r = await exportaEvenimente({ doarNetransmise: true });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.numeFisier).toBe("reges-RO123-2026-09-15.csv");
    expect(r.data.totalIntrari).toBe(1);
    expect(r.data.continut).toContain("*********1234");
    expect(r.data.continut).not.toMatch(/\d{13}/);
    expect(r.data.continut).toContain("Contabil");
    expect(areFiltru(server.apeluriPe("employment_contracts")[0], "in", "id", [ID_3])).toBe(true);
    expect(areFiltru(server.apeluriPe("organizations")[0], "eq", "id", ORG_ID)).toBe(true);
  });

  it("un eveniment al unui angajat care nu mai e citibil iese din export, nu cu date goale", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    const ALT = "88888888-8888-4888-8888-888888888888";
    server.raspunde("reges_evenimente", "select", {
      data: [eveniment(ID_1, ID_2, null), eveniment(ID_3, ALT, null)],
    });
    programeazaRestul(server);

    const r = await exportaEvenimente({ doarNetransmise: true });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.totalIntrari).toBe(1);
    // Angajații se cer o singură dată, pe id-uri unice.
    expect(areFiltru(server.apeluriPe("employees")[0], "in", "id", [ID_2, ALT])).toBe(true);
  });

  it("niciun eveniment pentru filtru: CONFLICT cu mesaj, fără alte interogări", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [] });
    const r = await exportaEvenimente({ doarNetransmise: true });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu există evenimente de exportat pentru filtrul ales." },
    });
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("eroarea unei citiri secundare oprește exportul (nu iese un CSV incomplet)", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, null)] });
    server.raspunde("employees", "select", { data: [] });
    server.raspunde("employee_sensitive_data", "select", { error: eroarePostgrest("42501") });
    server.raspunde("organizations", "select", {
      data: { id: ORG_ID, name: "F", cui: "1", reg_com: null },
    });
    const r = await exportaEvenimente({ doarNetransmise: true });
    expect(r.ok).toBe(false);
  });

  it("eroarea citirii angajaților oprește exportul (altfel ar ieși un CSV gol, cu ok)", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, null)] });
    server.raspunde("employees", "select", { error: eroarePostgrest("42501") });
    server.raspunde("employee_sensitive_data", "select", {
      data: [{ employee_id: ID_2, cnp_last4: "1234" }],
    });
    server.raspunde("organizations", "select", {
      data: { id: ORG_ID, name: "F", cui: "1", reg_com: null },
    });
    const r = await exportaEvenimente({ doarNetransmise: true });
    expect(r.ok).toBe(false);
  });

  it("eroarea citirii contractelor oprește exportul (altfel evenimentul ar ieși fără contract)", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, ID_3)] });
    programeazaRestul(server);
    server.raspunde("employment_contracts", "select", { error: eroarePostgrest("42501") });
    const r = await exportaEvenimente({ doarNetransmise: true });
    expect(r.ok).toBe(false);
  });

  it("eroarea citirii firmei oprește exportul, chiar dacă vine și cu un rând", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, null)] });
    server.raspunde("employees", "select", {
      data: [{ id: ID_2, marca: "0042", first_name: "Ion", last_name: "Pop", cetatenie: "RO" }],
    });
    server.raspunde("employee_sensitive_data", "select", {
      data: [{ employee_id: ID_2, cnp_last4: "1234" }],
    });
    // Rândul e prezent intenționat: fără verificarea erorii, exportul ar ieși cu
    // ok; cu `data: null` ar cădea oricum, pe `organizatie.data.cui`.
    server.raspunde("organizations", "select", {
      data: { id: ORG_ID, name: "F", cui: "1", reg_com: null },
      error: eroarePostgrest("42501"),
    });
    const r = await exportaEvenimente({ doarNetransmise: true });
    expect(r.ok).toBe(false);
  });

  it.fails(
    "DEFECT: 42501 pe o citire secundară devine EROARE_INTERNA în loc de INTERZIS",
    async () => {
      const { server } = configureazaActiunea({ permisiuni: EXPORT });
      server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, null)] });
      server.raspunde("employees", "select", { data: [] });
      server.raspunde("employee_sensitive_data", "select", { error: eroarePostgrest("42501") });
      server.raspunde("organizations", "select", {
        data: { id: ORG_ID, name: "F", cui: "1", reg_com: null },
      });
      const r = await exportaEvenimente({ doarNetransmise: true });
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    },
  );

  it("exportul nu revalidează nimic (nu schimbă starea)", async () => {
    const { server } = configureazaActiunea({ permisiuni: EXPORT });
    server.raspunde("reges_evenimente", "select", { data: [eveniment(ID_1, ID_2, null)] });
    programeazaRestul(server);
    await exportaEvenimente({ doarNetransmise: true });
    expect(caiRevalidate()).toEqual([]);
  });
});
