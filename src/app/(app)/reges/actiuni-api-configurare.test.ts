// src/app/(app)/reges/actiuni-api-configurare.test.ts
//
// Acțiunile REGES de CONFIGURARE: credențialele, testul de conexiune,
// pornirea transmiterii, sincronizarea nomenclatoarelor, clasificarea
// contractului și sporul propriu al angajatorului.
//
// ⚠ Clientul HTTP, jetonul și credențialele sunt înlocuite COMPLET, iar
// `fetch` global aruncă: niciun apel nu are voie să plece spre ITM.

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

import {
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  comutaActivarea,
  creeazaSporAngajator,
  salveazaClasificarea,
  salveazaCredentialele,
  sincronizeazaNomenclatoarele,
  testeazaConexiunea,
} from "./actiuni-api";
import type { ClasificareInput, CredentialeInput } from "./constante";

const RUTE = ["/reges", "/reges/setari", "/reges/propuneri"];
const CONFIGURARE = { "reges:configure": "all" } as const;
const CRED = {
  organizationId: ORG_ID,
  mediu: "productie",
  cuiAngajator: "123",
  clientId: "client",
  utilizator: "operator",
  clientSecret: "secret",
  parola: "parola",
  consumerId: "consumer-1",
  activ: false,
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

/* ------------------------------ credențialele ---------------------------- */

describe("salveazaCredentialele", () => {
  const intrare: CredentialeInput = {
    mediu: "test",
    cuiAngajator: " 123 ",
    clientId: "client",
    utilizator: "operator",
    clientSecret: "s3cret",
    parola: "",
  };

  it("`reges:update` nu ajunge: credențialele cer `reges:configure`", async () => {
    configureazaActiunea({ permisiuni: { "reges:update": "all" } });
    const r = await salveazaCredentialele(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(falsuriReges.scrieCredentiale).not.toHaveBeenCalled();
  });

  it("scrie pe organizația din sesiune; secretul gol devine null (se păstrează cel vechi)", async () => {
    const { server } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.scrieCredentiale.mockResolvedValue(undefined);

    const r = await salveazaCredentialele(intrare);

    expect(r).toEqual({ ok: true, data: { ok: true } });
    expect(falsuriReges.scrieCredentiale).toHaveBeenCalledWith(server.client, {
      organizationId: ORG_ID,
      mediu: "test",
      cuiAngajator: "123",
      clientId: "client",
      utilizator: "operator",
      clientSecret: "s3cret",
      parola: null,
    });
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("Client Secret gol devine null (cheia salvată nu se suprascrie cu șirul gol)", async () => {
    const { server } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.scrieCredentiale.mockResolvedValue(undefined);

    const r = await salveazaCredentialele({ ...intrare, clientSecret: "", parola: "p4rola" });

    expect(r).toEqual({ ok: true, data: { ok: true } });
    expect(falsuriReges.scrieCredentiale).toHaveBeenCalledWith(
      server.client,
      expect.objectContaining({ clientSecret: null, parola: "p4rola" }),
    );
  });

  it("secretele nu ajung NICIODATĂ în audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.scrieCredentiale.mockResolvedValue(undefined);
    await salveazaCredentialele({ ...intrare, parola: "parola-secreta" });
    await asteaptaDupa();
    const audit = JSON.stringify(server.audituri());
    expect(audit).not.toContain("s3cret");
    expect(audit).not.toContain("parola-secreta");
    expect(audit).toContain("operator");
  });

  it("mediu necunoscut e respins de schemă", async () => {
    configureazaActiunea({ permisiuni: CONFIGURARE });
    const r = await salveazaCredentialele({
      ...intrare,
      mediu: "staging",
    } as unknown as CredentialeInput);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(falsuriReges.scrieCredentiale).not.toHaveBeenCalled();
  });
});

/* --------------------------- testul de conexiune ------------------------- */

describe("testeazaConexiunea", () => {
  it("fără `reges:configure` la `all`: INTERZIS, niciun apel", async () => {
    configureazaActiunea({ permisiuni: { "reges:configure": "team" } });
    const r = await testeazaConexiunea();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("fără credențiale: răspuns explicativ, nimic scris, nimic trimis", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.citesteCredentiale.mockResolvedValue(null);
    const r = await testeazaConexiunea();
    expect(r).toEqual({
      ok: true,
      data: { ok: false, mesaj: "Completați și salvați întâi Client Secret și parola." },
    });
    expect(admin.apeluri).toHaveLength(0);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("GET /api/Profile reușit: jurnal + verificarea scrisă pe rândul firmei", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.cheamaReges.mockResolvedValue({ ok: true, date: {}, status: 200, durataMs: 7 });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_credentiale", "update", { data: null });

    const r = await testeazaConexiunea();

    expect(r).toEqual({
      ok: true,
      data: { ok: true, mesaj: "Legătura cu Inspecția Muncii funcționează." },
    });
    expect(falsuriReges.cheamaReges).toHaveBeenCalledWith({
      mediu: "productie",
      cale: "/api/Profile",
      metoda: "GET",
      jeton: "jwt",
    });
    expect(admin.apeluriPe("reges_apeluri")[0]?.payload).toMatchObject({
      organization_id: ORG_ID,
      metoda: "GET",
      cale: "/api/Profile",
      http_status: 200,
      eroare: null,
    });
    const [verificare] = admin.apeluriPe("reges_credentiale");
    expect(verificare?.payload).toMatchObject({
      verificat_ok: true,
      verificat_mesaj: "Legătura cu Inspecția Muncii funcționează.",
    });
    expect(areFiltru(verificare, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("jetonul refuzat: verificarea se scrie `false`, fără apel la /api/Profile", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.jetonValid.mockResolvedValue({
      ok: false,
      motiv: "credentiale",
      mesaj: "Utilizator sau parolă greșite.",
    });
    admin.raspunde("reges_credentiale", "update", { data: null });

    const r = await testeazaConexiunea();

    expect(r).toEqual({ ok: true, data: { ok: false, mesaj: "Utilizator sau parolă greșite." } });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
    expect(admin.apeluriPe("reges_apeluri")).toHaveLength(0);
    expect(admin.apeluriPe("reges_credentiale")[0]?.payload).toMatchObject({ verificat_ok: false });
  });

  it("autentificat, dar /api/Profile refuză: mesajul spune unde s-a rupt, mascat", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: false,
      motiv: "neautorizat",
      mesaj: "Forbidden pentru 1990101123456",
      status: 403,
      durataMs: 4,
    });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_credentiale", "update", { data: null });

    const r = await testeazaConexiunea();

    expect(r).toMatchObject({ ok: true, data: { ok: false } });
    const verificare = admin.apeluriPe("reges_credentiale")[0]?.payload as Record<string, unknown>;
    expect(String(verificare.verificat_mesaj)).toContain("/api/Profile");
    expect(String(verificare.verificat_mesaj)).not.toContain("1990101123456");
  });
});

/* -------------------------- pornirea transmiterii ------------------------ */

describe("comutaActivarea", () => {
  const rezumat = (peste: Record<string, unknown> = {}) => ({
    areSecret: true,
    areParola: true,
    verificatOk: true,
    ...peste,
  });

  it("fără `reges:configure` la `all`: INTERZIS", async () => {
    const { admin } = configureazaActiunea({ permisiuni: { "reges:transmit": "all" } });
    const r = await comutaActivarea({ activ: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(admin.apeluri).toHaveLength(0);
  });

  it("pornirea cu chei complete și verificate scrie `activ` pe rândul firmei", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.citesteRezumatCredentiale.mockResolvedValue(rezumat());
    admin.raspunde("reges_credentiale", "update", { data: null });

    const r = await comutaActivarea({ activ: true });

    expect(r).toEqual({ ok: true, data: { activ: true } });
    expect(falsuriReges.citesteRezumatCredentiale).toHaveBeenCalledWith(server.client, ORG_ID);
    const [apel] = admin.apeluriPe("reges_credentiale");
    expect(apel?.payload).toEqual({ activ: true });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it.each([
    ["fără rând de credențiale", null, "Completați Client Secret și parola"],
    ["fără secret", { areSecret: false }, "Completați Client Secret și parola"],
    ["fără parolă", { areParola: false }, "Completați Client Secret și parola"],
    ["neverificat", { verificatOk: null }, "Testați întâi conexiunea"],
    ["verificare eșuată", { verificatOk: false }, "Testați întâi conexiunea"],
  ])("pornirea %s e refuzată, nimic scris", async (_e, peste, fragment) => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.citesteRezumatCredentiale.mockResolvedValue(
      peste === null ? null : rezumat(peste),
    );
    const r = await comutaActivarea({ activ: true });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain(fragment);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("oprirea nu cere chei verificate", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("reges_credentiale", "update", { data: null });
    const r = await comutaActivarea({ activ: false });
    expect(r).toEqual({ ok: true, data: { activ: false } });
    expect(falsuriReges.citesteRezumatCredentiale).not.toHaveBeenCalled();
  });

  it("eroarea scrierii se propagă (42501 ⇒ INTERZIS)", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("reges_credentiale", "update", { error: eroarePostgrest("42501") });
    const r = await comutaActivarea({ activ: false });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});

/* ----------------------------- nomenclatoarele --------------------------- */

describe("sincronizeazaNomenclatoarele", () => {
  it("fără `reges:configure` la `all`: INTERZIS", async () => {
    configureazaActiunea({ permisiuni: { "reges:read": "all" } });
    const r = await sincronizeazaNomenclatoarele();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(falsuriReges.sincronizeazaNomenclatoare).not.toHaveBeenCalled();
  });

  it("cu jeton valid, sincronizează prin clientul admin și întoarce cifrele", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    falsuriReges.sincronizeazaNomenclatoare.mockResolvedValue({
      ok: true,
      tipuri: 12,
      randuri: 4000,
    });

    const r = await sincronizeazaNomenclatoarele();

    expect(r).toEqual({ ok: true, data: { tipuri: 12, randuri: 4000 } });
    expect(falsuriReges.sincronizeazaNomenclatoare).toHaveBeenCalledWith(admin.client, CRED, "jwt");
  });

  it.each([
    [
      "fără credențiale",
      () => falsuriReges.citesteCredentiale.mockResolvedValue(null),
      "Configurați întâi cheile API REGES.",
    ],
    [
      "jeton refuzat",
      () =>
        falsuriReges.jetonValid.mockResolvedValue({
          ok: false,
          motiv: "indisponibil",
          mesaj: "SSO indisponibil",
        }),
      "SSO indisponibil",
    ],
    [
      "sincronizare eșuată",
      () =>
        falsuriReges.sincronizeazaNomenclatoare.mockResolvedValue({
          ok: false,
          mesaj: "Răspuns invalid",
        }),
      "Răspuns invalid",
    ],
  ])("%s: CONFLICT cu mesajul cauzei", async (_e, pregateste, mesaj) => {
    configureazaActiunea({ permisiuni: CONFIGURARE });
    pregateste();
    const r = await sincronizeazaNomenclatoarele();
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

/* ------------------------------ clasificarea ----------------------------- */

describe("salveazaClasificarea", () => {
  const PERMIS = { "reges:update": "all" } as const;
  const intrare: ClasificareInput = {
    contractId: ID_1,
    tipContract: "ContractIndividualMunca",
    tipNorma: "NormaIntreaga",
    normaTimp: "NormaIntreaga840",
    repartizare: "OreDeZi",
  };

  it("fără `reges:update` la `all`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:update": "team" } });
    const r = await salveazaClasificarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("scrie cele patru valori pe contractul firmei, viu, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "update", { data: [{ id: ID_1 }] });

    const r = await salveazaClasificarea(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("employment_contracts");
    expect(apel?.payload).toEqual({
      reges_tip_contract: "ContractIndividualMunca",
      reges_tip_norma: "NormaIntreaga",
      reges_norma_timp: "NormaIntreaga840",
      reges_repartizare: "OreDeZi",
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it.each([
    ["", null],
    ["Art. 55 lit. b", "Art. 55 lit. b"],
  ])("temeiul de încetare %j se scrie ca %j", async (temei, scris) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "update", { data: [{ id: ID_1 }] });
    await salveazaClasificarea({ ...intrare, temeiIncetare: temei });
    expect(server.apeluriPe("employment_contracts")[0]?.payload).toMatchObject({
      reges_temei_incetare: scris,
    });
  });

  it("zero rânduri (lipsește dreptul pe dosarul de personal): CONFLICT care îl numește", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "update", { data: [] });
    const r = await salveazaClasificarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Angajați — modificare");
    expect(caiRevalidate()).toEqual([]);
  });

  it("eroarea scrierii se propagă (42501 ⇒ INTERZIS), nu ca CONFLICT cu o cauză falsă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employment_contracts", "update", { error: eroarePostgrest("42501") });
    const r = await salveazaClasificarea(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });

  it("un tip de contract din afara nomenclatorului e respins de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaClasificarea({
      ...intrare,
      tipContract: "Inventat",
    } as unknown as ClasificareInput);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

/* ------------------------- sporul angajatorului -------------------------- */

describe("creeazaSporAngajator", () => {
  const intrare = { componentTypeId: ID_1, dataInceputValabilitate: "2026-10-01" };
  const tip = (peste: Record<string, unknown> = {}) => ({
    id: ID_1,
    denumire: "Spor de fidelitate",
    kind: "spor_procent",
    reges_tip_spor_id: null,
    ...peste,
  });

  it("`reges:update` nu ajunge: sporul cere `reges:configure`", async () => {
    const { admin } = configureazaActiunea({ permisiuni: { "reges:update": "all" } });
    const r = await creeazaSporAngajator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(admin.apeluri).toHaveLength(0);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("tipul se caută STRICT printre ale firmei (nu și de platformă)", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: null });

    const r = await creeazaSporAngajator(intrare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [apel] = admin.apeluriPe("salary_component_types");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.filtre.some((f) => f.metoda === "or")).toBe(false);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it.each([
    ["o indemnizație", { kind: "indemnizatie" }, "Doar sporurile"],
    ["un spor deja mapat", { reges_tip_spor_id: "deja" }, "deja un identificator REGES"],
  ])("%s nu se înregistrează: CONFLICT, nimic nu pleacă", async (_e, peste, fragment) => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip(peste) });
    const r = await creeazaSporAngajator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain(fragment);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("drumul fericit: POST cu denumirea tipului, oglinda întâi, apoi maparea gardată", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip({ kind: "spor_suma" }) });
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: true,
      date: { id: "spor-uuid" },
      status: 201,
      durataMs: 9,
    });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_nomenclatoare", "upsert", { data: null });
    admin.raspunde("salary_component_types", "update", { data: { id: ID_1 } });

    const r = await creeazaSporAngajator(intrare);

    expect(r).toEqual({ ok: true, data: { regesId: "spor-uuid" } });
    expect(falsuriReges.cheamaReges).toHaveBeenCalledWith({
      mediu: "productie",
      cale: "/api/Nomenclatoare/SporAngajator",
      metoda: "POST",
      jeton: "jwt",
      corp: { denumire: "Spor de fidelitate", dataInceputValabilitate: "2026-10-01T00:00:00Z" },
    });
    const [oglinda] = admin.apeluriPe("reges_nomenclatoare");
    expect(oglinda?.payload).toMatchObject({
      organization_id: ORG_ID,
      tip: "SporAngajator",
      reges_id: "spor-uuid",
      nume: "Spor de fidelitate",
      activ: true,
    });
    expect(oglinda?.optiuni).toEqual({ onConflict: "organization_id,tip,reges_id" });
    const [mapare] = admin.apeluriPe("salary_component_types", "update");
    expect(mapare?.payload).toEqual({ reges_tip_spor_id: "spor-uuid" });
    // Fără filtrul pe id, UUID-ul primit de la ITM s-ar scrie pe TOATE sporurile
    // nemapate ale firmei (clientul e admin, RLS nu oprește nimic).
    expect(areFiltru(mapare, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(mapare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(mapare, "is", "reges_tip_spor_id", null)).toBe(true);
    expect(mapare?.selectDupaScriere).toBeDefined();
    // Ordinea: oglinda înaintea mapării.
    const ordine = admin.apeluri.map((a) => `${a.tabela}:${a.operatie}`);
    expect(ordine.indexOf("reges_nomenclatoare:upsert")).toBeLessThan(
      ordine.indexOf("salary_component_types:update"),
    );
  });

  it("ITM acceptă, dar nu întoarce identificatorul: CONFLICT, nimic scris local", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip() });
    falsuriReges.cheamaReges.mockResolvedValue({ ok: true, date: {}, status: 201, durataMs: 9 });
    admin.raspunde("reges_apeluri", "insert", { data: null });

    const r = await creeazaSporAngajator(intrare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(admin.apeluriPe("reges_nomenclatoare")).toHaveLength(0);
    expect(admin.apeluriPe("salary_component_types", "update")).toHaveLength(0);
  });

  it("maparea făcută între timp de altcineva (zero rânduri): CONFLICT, nu suprascriere", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip() });
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: true,
      date: "spor-2",
      status: 201,
      durataMs: 9,
    });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_nomenclatoare", "upsert", { data: null });
    admin.raspunde("salary_component_types", "update", { data: null });

    const r = await creeazaSporAngajator(intrare);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("de altcineva");
  });

  it("ITM refuză: CONFLICT cu mesajul, oglinda nu se atinge", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip() });
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: false,
      motiv: "validare",
      mesaj: "Denumire duplicată",
      status: 400,
      durataMs: 2,
    });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    const r = await creeazaSporAngajator(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Denumire duplicată" },
    });
    expect(admin.apeluriPe("reges_nomenclatoare")).toHaveLength(0);
  });

  it("fără credențiale: CONFLICT înainte de rețea", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip() });
    falsuriReges.citesteCredentiale.mockResolvedValue(null);
    const r = await creeazaSporAngajator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("eroarea citirii tipului se propagă (42501 ⇒ INTERZIS), nu se confundă cu „negăsit”", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { error: eroarePostgrest("42501") });
    const r = await creeazaSporAngajator(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("oglinda nomenclatorului cade: maparea NU se mai face (altfel sporul ar fi mapat la nimic)", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip() });
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: true,
      date: { id: "spor-uuid" },
      status: 201,
      durataMs: 9,
    });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_nomenclatoare", "upsert", { error: eroarePostgrest("23505") });

    const r = await creeazaSporAngajator(intrare);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Există deja o înregistrare cu aceste date." },
    });
    expect(admin.apeluriPe("salary_component_types", "update")).toHaveLength(0);
  });

  it("eroarea mapării se propagă (42501 ⇒ INTERZIS), nu se confundă cu „mapat de altcineva”", async () => {
    const { admin } = configureazaActiunea({ permisiuni: CONFIGURARE });
    admin.raspunde("salary_component_types", "select", { data: tip() });
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: true,
      date: { id: "spor-uuid" },
      status: 201,
      durataMs: 9,
    });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_nomenclatoare", "upsert", { data: null });
    admin.raspunde("salary_component_types", "update", { error: eroarePostgrest("42501") });

    const r = await creeazaSporAngajator(intrare);

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});
