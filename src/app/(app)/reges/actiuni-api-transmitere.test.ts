// src/app/(app)/reges/actiuni-api-transmitere.test.ts
//
// Acțiunile care vorbesc cu Inspecția Muncii, partea de COADĂ: pregătirea și
// trimiterea unui mesaj de salariat. Anularea și propunerile sunt în
// `actiuni-api-propuneri.test.ts`.
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

import { catreBytea, encrypt } from "@/lib/crypto/aes-gcm";
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

import { pregatesteTransmiterea, transmiteMesajul } from "./actiuni-api";

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
const CNP = "1990101123456";

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

/* ------------------------------- pregătirea ------------------------------ */

describe("pregatesteTransmiterea", () => {
  it("fără `reges:create` la `all`: INTERZIS, coada nu se atinge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:create": "team" } });
    const r = await pregatesteTransmiterea({ evenimentId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(falsuriReges.pregatesteMesaje).not.toHaveBeenCalled();
  });

  it("citește evenimentul firmei și referințele REGES, apoi pune mesajele în coadă", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:create": "all" } });
    server.raspunde("reges_evenimente", "select", {
      data: { id: ID_1, event_type: "angajare", employee_id: ID_2, contract_id: ID_3 },
    });
    server.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
    server.raspunde("employment_contracts", "select", { data: { reges_contract_id: null } });
    falsuriReges.pregatesteMesaje.mockResolvedValue({ ok: true, mesajeCreate: 2, deja: false });

    const r = await pregatesteTransmiterea({ evenimentId: ID_1 });

    expect(r).toEqual({ ok: true, data: { mesaje: 2 } });
    const [ev] = server.apeluriPe("reges_evenimente");
    expect(areFiltru(ev, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(ev, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(ev, "is", "deleted_at", null)).toBe(true);
    const [ang] = server.apeluriPe("employees");
    expect(areFiltru(ang, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(ang, "eq", "organization_id", ORG_ID)).toBe(true);
    const [ctr] = server.apeluriPe("employment_contracts");
    expect(areFiltru(ctr, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(ctr, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(falsuriReges.pregatesteMesaje).toHaveBeenCalledWith(server.client, {
      organizationId: ORG_ID,
      evenimentId: ID_1,
      employeeId: ID_2,
      contractId: ID_3,
      tipEveniment: "angajare",
      regesSalariatId: "sal-1",
      regesContractId: null,
    });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("eveniment fără contract: contractele nu se citesc", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:create": "all" } });
    server.raspunde("reges_evenimente", "select", {
      data: { id: ID_1, event_type: "suspendare", employee_id: ID_2, contract_id: null },
    });
    server.raspunde("employees", "select", { data: null });
    falsuriReges.pregatesteMesaje.mockResolvedValue({ ok: true, mesajeCreate: 0, deja: true });

    const r = await pregatesteTransmiterea({ evenimentId: ID_1 });

    expect(r).toEqual({ ok: true, data: { mesaje: 0 } });
    expect(server.apeluriPe("employment_contracts")).toHaveLength(0);
    expect(falsuriReges.pregatesteMesaje.mock.calls[0]?.[1]).toMatchObject({
      contractId: null,
      regesSalariatId: null,
      regesContractId: null,
    });
  });

  it("eroarea citirii evenimentului se propagă (42501 ⇒ INTERZIS), nu ca NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:create": "all" } });
    server.raspunde("reges_evenimente", "select", { error: eroarePostgrest("42501") });
    const r = await pregatesteTransmiterea({ evenimentId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(falsuriReges.pregatesteMesaje).not.toHaveBeenCalled();
  });

  it("eveniment inexistent: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:create": "all" } });
    server.raspunde("reges_evenimente", "select", { data: null });
    const r = await pregatesteTransmiterea({ evenimentId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(falsuriReges.pregatesteMesaje).not.toHaveBeenCalled();
  });

  it("planul refuză (motiv de domeniu): CONFLICT cu motivul", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:create": "all" } });
    server.raspunde("reges_evenimente", "select", {
      data: { id: ID_1, event_type: "incetare", employee_id: ID_2, contract_id: null },
    });
    server.raspunde("employees", "select", { data: { reges_salariat_id: null } });
    falsuriReges.pregatesteMesaje.mockResolvedValue({
      ok: false,
      motiv: "Contractul nu a fost încă înregistrat la ITM.",
    });
    const r = await pregatesteTransmiterea({ evenimentId: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Contractul nu a fost încă înregistrat la ITM." },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

/* ------------------------------- trimiterea ------------------------------ */

describe("transmiteMesajul", () => {
  const PERMIS = { "reges:transmit": "all" } as const;
  const mesaj = (peste: Record<string, unknown> = {}) => ({
    id: ID_1,
    tip: "salariat",
    operatie: "InregistrareSalariat",
    stare: "de_transmis",
    message_id: "msg-1",
    employee_id: ID_2,
    contract_id: null,
    depinde_de: null,
    incercari: 1,
    ...peste,
  });
  const cnpCriptat = () => {
    const v = encrypt(CNP);
    return {
      cnp_ciphertext: catreBytea(v.ciphertext),
      cnp_iv: catreBytea(v.iv),
      cnp_tag: catreBytea(v.tag),
      cnp_key_version: Number(v.keyVersion),
    };
  };
  const angajat = {
    first_name: "Ion",
    last_name: "Pop",
    adresa_strada: "Str. 1",
    adresa_oras: "Cluj",
    adresa_judet: "CJ",
    adresa_cod_postal: null,
    cetatenie: "RO",
    data_nasterii: "1999-01-01",
    reges_tip_act: null,
    reges_salariat_id: null,
  };

  function pregatesteDrumulFericit(server: ReturnType<typeof configureazaActiunea>["server"]) {
    server.raspunde("reges_mesaje", "select", { data: mesaj() });
    server.raspundeRpc("hr_read_sensitive", { data: [cnpCriptat()] });
    server.raspunde("employees", "select", { data: angajat });
    falsuriReges.compuneSalariat.mockResolvedValue({ ok: true, mesaj: { corp: "salariat" } });
  }

  it("`reges:update` nu ajunge: trimiterea cere `reges:transmit`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "reges:update": "all" } });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("drumul fericit: CNP decriptat prin RPC-ul auditat, POST /api/Salariat, mesajul trece în așteptare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: true,
      date: { responseId: "resp-9" },
      status: 202,
      durataMs: 40,
    });
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } }); // revendicarea
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } }); // marcarea

    const r = await transmiteMesajul({ mesajId: ID_1 });

    expect(r).toMatchObject({ ok: true, data: { stare: "asteapta_raspuns" } });
    // Citirea mesajului: al firmei, viu.
    const [citire] = server.apeluriPe("reges_mesaje");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    // CNP-ul vine prin `hr_read_sensitive`, nu printr-un select pe date sensibile.
    expect(server.apeluriRpc.find((a) => a.nume === "hr_read_sensitive")?.argumente).toEqual({
      p_employee: ID_2,
    });
    expect(server.apeluriPe("employee_sensitive_data")).toHaveLength(0);
    // Fișa angajatului: a firmei, nu doar după id.
    const [fisa] = server.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(falsuriReges.compuneSalariat.mock.calls[0]?.[2]).toBe(CNP);
    expect(falsuriReges.cheamaReges).toHaveBeenCalledWith({
      mediu: "test",
      cale: "/api/Salariat",
      metoda: "POST",
      jeton: "jwt",
      corp: { corp: "salariat" },
    });
    // Jurnalul apelului, fără corp.
    expect(admin.apeluriPe("reges_apeluri")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      mesaj_id: ID_1,
      metoda: "POST",
      cale: "/api/Salariat",
      http_status: 202,
      durata_ms: 40,
      consumer_id: "consumer-1",
      eroare: null,
    });
    const [, stare] = admin.apeluriPe("reges_mesaje", "update");
    expect(stare?.selectDupaScriere).toBeDefined();
    expect(stare?.payload).toMatchObject({
      stare: "asteapta_raspuns",
      response_id: "resp-9",
      trimis_de: USER_ID,
      incercari: 2,
      http_status: 202,
      eroare: null,
    });
    expect(areFiltru(stare, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(stare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("mesajul plecat deja: CONFLICT înainte de credențiale și de rețea", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj({ stare: "asteapta_raspuns" }) });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(falsuriReges.citesteCredentiale).not.toHaveBeenCalled();
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("mesaj inexistent: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: null });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("fără credențiale: CONFLICT care trimite spre Setări, fără rețea", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj() });
    falsuriReges.citesteCredentiale.mockResolvedValue(null);
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Setări");
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("jetonul refuzat: CONFLICT cu mesajul jetonului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj() });
    falsuriReges.jetonValid.mockResolvedValue({
      ok: false,
      motiv: "credentiale",
      mesaj: "Parola REGES e greșită.",
    });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Parola REGES e greșită." },
    });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("mesajele de contract nu pleacă de aici (ciclul le duce, fără CNP)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj({ tip: "contract" }) });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriRpc.some((a) => a.nume === "hr_read_sensitive")).toBe(false);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("angajat fără CNP: CONFLICT, nimic nu pleacă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj() });
    server.raspundeRpc("hr_read_sensitive", { data: [{ ...cnpCriptat(), cnp_tag: null }] });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { message: "Angajatul nu are CNP înregistrat, iar REGES îl cere obligatoriu." },
    });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("fișa incompletă: CONFLICT cu problemele de validare, nimic nu pleacă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj() });
    server.raspundeRpc("hr_read_sensitive", { data: [cnpCriptat()] });
    server.raspunde("employees", "select", { data: angajat });
    falsuriReges.compuneSalariat.mockResolvedValue({
      ok: false,
      probleme: [{ camp: "adresa", mesaj: "Adresa lipsește." }],
    });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { message: "Fișa nu poate fi transmisă încă: Adresa lipsește." },
    });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("400 de la ITM: mesajul devine `esuat` (nu se reîncearcă), eroarea e mascată în jurnal", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: false,
      motiv: "validare",
      mesaj: `CNP ${CNP} invalid`,
      status: 400,
      durataMs: 5,
    });
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } }); // revendicarea
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_mesaje", "update", { data: null });

    const r = await transmiteMesajul({ mesajId: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const jurnal = admin.apeluriPe("reges_apeluri")[0]?.payload as Record<string, unknown>;
    expect(jurnal.eroare).toBe("CNP *********3456 invalid");
    const actualizare = admin.apeluriPe("reges_mesaje", "update")[1]?.payload as Record<
      string,
      unknown
    >;
    expect(actualizare.stare).toBe("esuat");
    expect(actualizare).not.toHaveProperty("incercari");
    expect(actualizare.eroare).toBe("CNP *********3456 invalid");
    // Clientul e admin: filtrele sunt singura barieră între firme.
    const [, scriere] = admin.apeluriPe("reges_mesaje", "update");
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toEqual([]);
  });

  it("ITM indisponibil (5xx): mesajul rămâne de transmis, cu încercarea numărată", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    falsuriReges.cheamaReges.mockResolvedValue({
      ok: false,
      motiv: "indisponibil",
      mesaj: "503",
      status: 503,
      durataMs: 20_000,
    });
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } }); // revendicarea
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_mesaje", "update", { data: null });

    const r = await transmiteMesajul({ mesajId: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [, scriere] = admin.apeluriPe("reges_mesaje", "update");
    const actualizare = scriere?.payload as Record<string, unknown>;
    // Iese din `in_curs` înapoi în coadă, ca să poată fi reîncercat.
    expect(actualizare.stare).toBe("de_transmis");
    expect(actualizare.incercari).toBe(2);
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("eroarea citirii mesajului se propagă (42501 ⇒ INTERZIS), nimic nu pleacă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { error: eroarePostgrest("42501") });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("refuzul RPC-ului de date sensibile se propagă (INTERZIS), nu ca „fără CNP”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj() });
    server.raspundeRpc("hr_read_sensitive", { error: eroarePostgrest("42501") });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("mesaj de salariat fără angajat: CONFLICT, CNP-ul nu se citește", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj({ employee_id: null }) });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Mesajul nu are angajat asociat." },
    });
    expect(server.apeluriRpc.some((a) => a.nume === "hr_read_sensitive")).toBe(false);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("fișa angajatului dispărută: NEGASIT, nimic nu pleacă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("reges_mesaje", "select", { data: mesaj() });
    server.raspundeRpc("hr_read_sensitive", { data: [cnpCriptat()] });
    server.raspunde("employees", "select", { data: null });
    const r = await transmiteMesajul({ mesajId: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Fișa angajatului nu mai există." },
    });
    expect(falsuriReges.compuneSalariat).not.toHaveBeenCalled();
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  // Ruda ei, `raspundePropunerii`, face exact asta: „Răspunsul a plecat la
  // Inspecția Muncii, dar starea locală nu s-a putut actualiza". Ignorată,
  // eroarea lăsa mesajul fără `response_id`, iar a doua apăsare îl retrimitea —
  // un duplicat de CNP refuzat asincron de ITM.
  it("eșecul marcării `asteapta_raspuns` după trimitere NU e raportat ca succes", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    falsuriReges.cheamaReges.mockResolvedValue({ ok: true, date: {}, status: 202, durataMs: 1 });
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_mesaje", "update", { error: eroarePostgrest("57014") });

    const r = await transmiteMesajul({ mesajId: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Nu-l retrimiteți");
  });

  it("marcarea cu zero rânduri după trimitere NU e raportată ca succes", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    falsuriReges.cheamaReges.mockResolvedValue({ ok: true, date: {}, status: 202, durataMs: 1 });
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_mesaje", "update", { data: null });

    const r = await transmiteMesajul({ mesajId: ID_1 });

    expect(r.ok).toBe(false);
  });

  // Pagina vault-ului: „`in_curs` există exact ca să nu trimită de două ori
  // același mesaj". Rândul se revendică ÎNAINTE de POST, condiționat pe
  // `de_transmis`; două apăsări simultane nu mai trec amândouă.
  it("mesajul e revendicat (`in_curs`) înainte de POST, condiționat pe `de_transmis`", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } });
    admin.raspunde("reges_apeluri", "insert", { data: null });
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } });
    let revendicatInainte = false;
    falsuriReges.cheamaReges.mockImplementation(async () => {
      revendicatInainte = admin
        .apeluriPe("reges_mesaje", "update")
        .some((a) => (a.payload as Record<string, unknown>).stare === "in_curs");
      return { ok: true, date: {}, status: 202, durataMs: 1 };
    });

    await transmiteMesajul({ mesajId: ID_1 });

    expect(revendicatInainte).toBe(true);
    const [revendicare] = admin.apeluriPe("reges_mesaje", "update");
    expect(revendicare?.payload).toEqual({ stare: "in_curs" });
    expect(areFiltru(revendicare, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(revendicare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(revendicare, "eq", "stare", "de_transmis")).toBe(true);
    expect(revendicare?.selectDupaScriere).toBeDefined();
  });

  it("revendicarea pierdută (altă apăsare a câștigat): CONFLICT, nimic nu pleacă", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    admin.raspunde("reges_mesaje", "update", { data: null });

    const r = await transmiteMesajul({ mesajId: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("o excepție la apelul ITM readuce mesajul în coadă (`de_transmis`)", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    pregatesteDrumulFericit(server);
    admin.raspunde("reges_mesaje", "update", { data: { id: ID_1 } });
    admin.raspunde("reges_mesaje", "update", { data: null });
    falsuriReges.cheamaReges.mockRejectedValue(new Error("socket închis"));

    const r = await transmiteMesajul({ mesajId: ID_1 });

    expect(r.ok).toBe(false);
    const [, inapoi] = admin.apeluriPe("reges_mesaje", "update");
    expect(inapoi?.payload).toEqual({ stare: "de_transmis" });
    expect(areFiltru(inapoi, "eq", "organization_id", ORG_ID)).toBe(true);
  });
});
