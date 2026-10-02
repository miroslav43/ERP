// src/app/(app)/reges/actiuni-api-propuneri.test.ts
//
// Acțiunile care vorbesc cu Inspecția Muncii: anularea unui mesaj neplecat,
// răspunsul la o propunere primită și propunerea de detașare/mutare.
//
// ⚠ Orice apel de aici ar produce un efect IREVERSIBIL în registrul oficial.
// Clientul HTTP (`cheamaReges`), jetonul și credențialele sunt înlocuite
// COMPLET, iar `fetch` global aruncă: un drum scăpat de mock pică testul în
// loc să plece spre ITM.

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

const falsuriReges = vi.hoisted(() => ({
  cheamaReges: vi.fn(),
  jetonValid: vi.fn(),
  citesteCredentiale: vi.fn(),
  citesteRezumatCredentiale: vi.fn(),
  scrieCredentiale: vi.fn(),
  sincronizeazaNomenclatoare: vi.fn(),
  pregatesteMesaje: vi.fn(),
  compuneSalariat: vi.fn(),
}));
vi.mock("@/lib/reges/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/reges/client")>()),
  cheamaReges: falsuriReges.cheamaReges,
}));
vi.mock("@/lib/reges/jeton", () => ({ jetonValid: falsuriReges.jetonValid }));
vi.mock("@/lib/reges/credentiale", () => ({
  citesteCredentiale: falsuriReges.citesteCredentiale,
  citesteRezumatCredentiale: falsuriReges.citesteRezumatCredentiale,
  scrieCredentiale: falsuriReges.scrieCredentiale,
}));
vi.mock("@/lib/reges/nomenclatoare", () => ({
  sincronizeazaNomenclatoare: falsuriReges.sincronizeazaNomenclatoare,
}));
vi.mock("@/lib/reges/coada", async (orig) => ({
  ...(await orig<typeof import("@/lib/reges/coada")>()),
  pregatesteMesaje: falsuriReges.pregatesteMesaje,
}));
vi.mock("@/lib/reges/compune", async (orig) => ({
  ...(await orig<typeof import("@/lib/reges/compune")>()),
  compuneSalariat: falsuriReges.compuneSalariat,
}));

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

import { anuleazaMesajul, propunePlecarea, raspundePropunerii } from "./actiuni-api";
import type { PropunePlecareInput, RaspundePropuneriiInput } from "./constante";

const RUTE = ["/reges", "/reges/setari", "/reges/propuneri"];
const CRED = {
  organizationId: ORG_ID,
  mediu: "test",
  cuiAngajator: "123",
  clientId: "client",
  utilizator: "operator",
  clientSecret: "secret",
  parola: "parola",
  consumerId: "consumer-1",
  activ: true,
} as const;
const JETON = { ok: true, jeton: "jwt", expiraLa: new Date("2030-01-01T00:00:00Z") } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch real interzis în teste: apelurile REGES sunt ireversibile");
  });
  for (const f of Object.values(falsuriReges)) f.mockReset();
  falsuriReges.citesteCredentiale.mockResolvedValue(CRED);
  falsuriReges.jetonValid.mockResolvedValue(JETON);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* -------------------------------- anularea ------------------------------- */

describe("anuleazaMesajul", () => {
  const PERMIS = { "reges:update": "all" } as const;

  it("fără `reges:update` la `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:transmit": "all" } });
    const r = await anuleazaMesajul({ mesajId: ID_1, motiv: "Greșeală" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("anulează doar un mesaj NEPLECAT al firmei, cu `.select()` după UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "update", { data: [{ id: ID_1 }] });

    const r = await anuleazaMesajul({ mesajId: ID_1, motiv: "  Date greșite  " });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("reges_mesaje");
    expect(apel?.payload).toEqual({ stare: "anulat", eroare: "Date greșite" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "stare", "de_transmis")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it.each([
    ["listă goală", []],
    ["null", null],
  ])("zero rânduri (%s): CONFLICT „a plecat deja”", async (_e, data) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "update", { data });
    const r = await anuleazaMesajul({ mesajId: ID_1, motiv: "Greșeală" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("eroarea scrierii se propagă (42501 ⇒ INTERZIS), nu ca „a plecat deja”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "update", { error: eroarePostgrest("42501") });
    const r = await anuleazaMesajul({ mesajId: ID_1, motiv: "Greșeală" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("motivul sub trei caractere e respins", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await anuleazaMesajul({ mesajId: ID_1, motiv: "x" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

/* ------------------------- răspunsul la propunere ------------------------ */

describe("raspundePropunerii", () => {
  const PERMIS = { "reges:transmit": "all" } as const;
  const propunere = (peste: Record<string, unknown> = {}) => ({
    id: ID_1,
    fel: "detasare",
    directie: "primita",
    stare: "noua",
    reges_propunere_id: "prop-77",
    reges_contract_id: "ctr-1",
    ...peste,
  });

  it("fără `reges:transmit` la `all`: INTERZIS, nimic nu pleacă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:update": "all" } });
    const r = await raspundePropunerii({ propunereId: ID_1, raspuns: "acceptata" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it.each([
    [
      "detasare",
      "acceptata",
      "AcceptarePropunereDetasareContract",
      "/api/Detasare/Propuneri",
      "propunereDetasareContract",
    ],
    [
      "detasare",
      "respinsa",
      "RespingerePropunereDetasareContract",
      "/api/Detasare/Propuneri",
      "propunereDetasareContract",
    ],
    [
      "mutare",
      "acceptata",
      "AcceptarePropunereMutareContract",
      "/api/Mutare/Propuneri",
      "propunereMutareContract",
    ],
    [
      "mutare",
      "respinsa",
      "RespingerePropunereMutareContract",
      "/api/Mutare/Propuneri",
      "propunereMutareContract",
    ],
  ])("%s %s ⇒ operația %s pe %s", async (fel, raspuns, operatie, cale, tip) => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_propuneri", "select", { data: propunere({ fel }) });
    falsuriReges.cheamaReges.mockResolvedValue({ ok: true, date: {}, status: 200, durataMs: 3 });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    server.raspunde("reges_propuneri", "update", { data: [{ id: ID_1 }] });

    const r = await raspundePropunerii({
      propunereId: ID_1,
      raspuns: raspuns as RaspundePropuneriiInput["raspuns"],
      observatii: "Bine",
    });

    expect(r).toEqual({ ok: true, data: { stare: raspuns } });
    const [citire] = server.apeluriPe("reges_propuneri", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const cerere = falsuriReges.cheamaReges.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(cerere).toMatchObject({ cale, metoda: "POST", parametri: { consumerId: "consumer-1" } });
    expect(cerere.corp).toMatchObject({
      $type: tip,
      header: { operation: operatie, authorId: USER_ID },
      referintaPropunere: { $type: "referinta", id: "prop-77" },
      explicatie: "Bine",
    });
    const [actualizare] = server.apeluriPe("reges_propuneri", "update");
    expect(actualizare?.payload).toMatchObject({
      stare: raspuns,
      raspuns_de: USER_ID,
      observatii: "Bine",
    });
    expect(areFiltru(actualizare, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(actualizare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(actualizare, "eq", "stare", "noua")).toBe(true);
    expect(actualizare?.selectDupaScriere).toBeDefined();
  });

  it.each([
    ["trimisă de noi", { directie: "trimisa" }, "Doar propunerile PRIMITE"],
    ["deja răspunsă", { stare: "acceptata" }, "Propunerii i s-a răspuns deja"],
    ["fără identificator REGES", { reges_propunere_id: null }, "nu are identificator REGES"],
  ])("propunerea %s: CONFLICT, nimic nu pleacă", async (_e, peste, fragment) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_propuneri", "select", { data: propunere(peste) });
    const r = await raspundePropunerii({ propunereId: ID_1, raspuns: "acceptata" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain(fragment);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("ITM respinge: CONFLICT, iar starea locală NU se mută", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_propuneri", "select", { data: propunere() });
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: false,
      motiv: "validare",
      mesaj: "Referință inexistentă",
      status: 400,
      durataMs: 3,
    });
    admin.raspunde("reges_apeluri", "insert", { data: null });

    const r = await raspundePropunerii({ propunereId: ID_1, raspuns: "respinsa" });

    expect(r).toMatchObject({
      ok: false,
      error: { message: "Inspecția Muncii a respins răspunsul: Referință inexistentă" },
    });
    expect(server.apeluriPe("reges_propuneri", "update")).toHaveLength(0);
  });

  it("plecat la ITM, dar zero rânduri local: CONFLICT care spune ce s-a întâmplat", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_propuneri", "select", { data: propunere() });
    falsuriReges.cheamaReges.mockResolvedValue({ ok: true, date: {}, status: 200, durataMs: 3 });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    server.raspunde("reges_propuneri", "update", { data: [] });
    const r = await raspundePropunerii({ propunereId: ID_1, raspuns: "acceptata" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("a plecat la Inspecția Muncii");
  });

  it("eroarea scrierii stării locale se propagă (42501 ⇒ INTERZIS), nu ca CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_propuneri", "select", { data: propunere() });
    falsuriReges.cheamaReges.mockResolvedValue({ ok: true, date: {}, status: 200, durataMs: 3 });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    server.raspunde("reges_propuneri", "update", { error: eroarePostgrest("42501") });
    const r = await raspundePropunerii({ propunereId: ID_1, raspuns: "acceptata" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it("eroarea citirii propunerii se propagă (42501 ⇒ INTERZIS), nimic nu pleacă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_propuneri", "select", { error: eroarePostgrest("42501") });
    const r = await raspundePropunerii({ propunereId: ID_1, raspuns: "acceptata" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });
});

/* -------------------------- propunerea de plecare ------------------------ */

describe("propunePlecarea", () => {
  const PERMIS = { "reges:create": "all" } as const;
  const intrare: PropunePlecareInput = {
    contractId: ID_1,
    fel: "detasare",
    cuiDestinatie: "RO999",
    numeDestinatie: "Altă Firmă SRL",
    dataInceput: "2026-10-01",
    dataSfarsit: "2026-12-31",
    temeiLegal: "Art45",
  };
  const contract = (peste: Record<string, unknown> = {}) => ({
    id: ID_1,
    employee_id: ID_2,
    status: "activ",
    reges_contract_id: "ctr-1",
    ...peste,
  });

  it("fără `reges:create` la `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:create": "own" } });
    const r = await propunePlecarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("scrie mesajul și propunerea legate, cu organizația din sesiune, fără să trimită nimic", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract() });
    server.raspunde("reges_mesaje", "insert", { data: { id: ID_3 } });
    server.raspunde("reges_propuneri", "insert", { data: { id: "prop-local" } });

    const r = await propunePlecarea(intrare);

    expect(r).toEqual({ ok: true, data: { id: "prop-local" } });
    const [c] = server.apeluriPe("employment_contracts");
    expect(areFiltru(c, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(c, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(c, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("reges_mesaje")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ID_2,
      contract_id: ID_1,
      tip: "propunere_detasare",
      operatie: "PropunereDetasareContract",
      cerere_rezumat: { fel: "detasare", cuiDestinatie: "RO999" },
    });
    expect(server.apeluriPe("reges_propuneri")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      directie: "trimisa",
      fel: "detasare",
      contract_id: ID_1,
      mesaj_id: ID_3,
      reges_contract_id: "ctr-1",
      angajator_partener_cui: "RO999",
      angajator_partener_nume: "Altă Firmă SRL",
      data_inceput: "2026-10-01",
      data_sfarsit: "2026-12-31",
      temei_legal: "Art45",
    });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("mutarea fără dată de sfârșit: tipul și operația de mutare, sfârșit null", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract() });
    server.raspunde("reges_mesaje", "insert", { data: { id: ID_3 } });
    server.raspunde("reges_propuneri", "insert", { data: { id: "p" } });
    await propunePlecarea({ ...intrare, fel: "mutare", dataSfarsit: undefined });
    expect(server.apeluriPe("reges_mesaje")[0]?.payload).toMatchObject({
      tip: "propunere_mutare",
      operatie: "PropunereMutareContract",
    });
    expect(server.apeluriPe("reges_propuneri")[0]?.payload).toMatchObject({ data_sfarsit: null });
  });

  it.each([
    ["contract inexistent", null, "NEGASIT"],
    ["contract încetat", { status: "incetat" }, "CONFLICT"],
    ["contract netransmis la ITM", { reges_contract_id: null }, "CONFLICT"],
  ])("%s: %s, nimic nu se scrie", async (_e, peste, cod) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", {
      data: peste === null ? null : contract(peste),
    });
    const r = await propunePlecarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: cod } });
    expect(server.apeluriPe("reges_mesaje")).toHaveLength(0);
  });

  it("sfârșitul înaintea începutului: CONFLICT; aceeași zi e permisă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract() });
    const r = await propunePlecarea({ ...intrare, dataSfarsit: "2026-09-30" });
    expect(r).toMatchObject({
      ok: false,
      error: { message: "Data de sfârșit e înaintea celei de început." },
    });
    expect(server.apeluriPe("reges_mesaje")).toHaveLength(0);

    server.raspunde("employment_contracts", "select", { data: contract() });
    server.raspunde("reges_mesaje", "insert", { data: { id: ID_3 } });
    server.raspunde("reges_propuneri", "insert", { data: { id: "p" } });
    const r2 = await propunePlecarea({ ...intrare, dataSfarsit: "2026-10-01" });
    expect(r2.ok).toBe(true);
  });

  it("inserarea mesajului refuzată (42501): INTERZIS, propunerea nu se mai scrie", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract() });
    server.raspunde("reges_mesaje", "insert", { error: eroarePostgrest("42501") });
    const r = await propunePlecarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("reges_propuneri")).toHaveLength(0);
  });

  it("inserarea propunerii refuzată după mesaj: eroarea se propagă (INTERZIS), nu un succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { data: contract() });
    server.raspunde("reges_mesaje", "insert", { data: { id: ID_3 } });
    server.raspunde("reges_propuneri", "insert", { error: eroarePostgrest("42501") });
    const r = await propunePlecarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("eroarea citirii contractului se propagă (42501 ⇒ INTERZIS), nu ca NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "select", { error: eroarePostgrest("42501") });
    const r = await propunePlecarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("reges_mesaje")).toHaveLength(0);
  });
});
