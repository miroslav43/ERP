// src/app/(app)/mentenanta/actions-echipamente.test.ts
//
// Parcul de echipamente: creare, editare, citirile de contor și autorizațiile
// ISCIR. Poarta reală e `maintenance:update` / team — politica de INSERT din
// bază lasă să treacă și `employee`/`manager` (capcana 35), deci aplicația
// trebuie să refuze `maintenance:create`, oricât de larg.

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
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaEchipament,
  adaugaAutorizatieIscir,
  creeazaEchipament,
  inregistreazaContor,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const UPDATE = { "maintenance:update": "team" } as const;
/** Poarta citirii de contor (0182): „e în modul”; cine poate pe ce utilaj decide baza. */
const CITIRE = { "maintenance:read": "own" } as const;

const echipament = {
  cod: "CZ-01",
  denumire: "Cazan abur",
  an_fabricatie: "2015",
  este_iscir: true,
  tip_autorizare_necesara: "RSVTI",
  valoare_achizitie: "45000",
};

const contor = { equipment_id: ID_1, tip: "ore", citire: "1200", data_citirii: "2026-09-20" };

/**
 * Fișa apelantului, citită de handler DOAR când nu e gestionar: cine nu
 * administrează mentenanța (responsabilul utilajului, din portal) își semnează
 * citirea cu propria fișă, n-o atribuie unui coleg (0182).
 */
const ID_FISA_MEA = "00000000-0000-4000-8000-00000000f15a";
const FISA_MEA = { data: { id: ID_FISA_MEA } };

const iscir = {
  equipment_id: ID_1,
  numar: "ISCIR-77",
  tip: "Autorizare funcționare",
  valabil_pana: "2028-09-01",
};

describe("pragul de permisiune (capcana 35)", () => {
  const cazuri = [
    ["creeazaEchipament", creeazaEchipament, echipament],
    ["actualizeazaEchipament", actualizeazaEchipament, { ...echipament, id: ID_2 }],
    ["adaugaAutorizatieIscir", adaugaAutorizatieIscir, iscir],
  ] as const;

  // Citirea de contor a coborât la `maintenance:read`/own din 0182: o
  // înregistrează și RESPONSABILUL utilajului (din portal), iar cine poate pe ce
  // utilaj decide politica de INSERT, care nu mai trece prin `create = all`.
  it("inregistreazaContor: fără `maintenance:read` ⇒ INTERZIS, zero apeluri", async () => {
    const { server } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "maintenance:update": "own" },
    });
    const r = await inregistreazaContor(contor);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("inregistreazaContor: `maintenance:read` = own trece poarta — un străin e refuzat de BAZĂ (42501)", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: CITIRE });
    server.raspunde("employees", "select", FISA_MEA);
    server.raspunde("equipment_meters", "select", { data: null });
    server.raspunde("equipment_meters", "insert", { error: eroarePostgrest("42501") });
    const r = await inregistreazaContor(contor);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("equipment_meters", "insert")).toHaveLength(1);
  });

  it.each(cazuri)(
    "%s: `maintenance:update` own < team ⇒ INTERZIS",
    async (_n, actiune, intrare) => {
      const { server } = configureazaActiunea({
        rol: "employee",
        permisiuni: { "maintenance:update": "own" },
      });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it.each(cazuri)(
    "%s: `maintenance:create` = all (seed-ul angajatului) NU deschide parcul",
    async (_n, actiune, intrare) => {
      const { server } = configureazaActiunea({
        rol: "employee",
        permisiuni: { "maintenance:create": "all", "maintenance:read": "own" },
      });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );
});

describe("creeazaEchipament", () => {
  it("INSERT cu organizația din sesiune, fără câmpurile de derogare calculate de gardă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("equipment", "insert", { data: { id: ID_2 } });

    const r = await creeazaEchipament({ ...echipament, derogare_acordata_de: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("equipment");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      cod: "CZ-01",
      an_fabricatie: 2015,
      valoare_achizitie: 45000,
      status: "in_functiune",
      este_iscir: true,
    });
    expect(apel?.payload).not.toHaveProperty("derogare_acordata_de");
    expect(apel?.payload).not.toHaveProperty("derogare_acordata_la");
    expect(apel?.payload).not.toHaveProperty("created_by");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/mentenanta/echipamente", "/mentenanta"]);
  });

  it("cod duplicat (23505): mesajul modulului, nu cel generic", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("equipment", "insert", { error: eroarePostgrest("23505", "equipment_uq") });
    const r = await creeazaEchipament(echipament);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("codul echipamentului");
  });

  it("garda ISCIR (P0001): textul ei, cu pasul următor, ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const mesaj = "Echipamentul ISCIR cere un responsabil autorizat sau o derogare motivată.";
    server.raspunde("equipment", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await creeazaEchipament(echipament);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("auditul nu poartă valoarea de achiziție și nici motivul derogării", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("equipment", "insert", { data: { id: ID_2 } });
    await creeazaEchipament({ ...echipament, derogare_motiv: "Responsabilul e în concediu." });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: ID_2 });
    expect(audit?.p_after).toMatchObject({ cod: "CZ-01", este_iscir: true });
    expect(audit?.p_after).not.toHaveProperty("valoare_achizitie");
    expect(audit?.p_after).not.toHaveProperty("derogare_motiv");
  });
});

describe("actualizeazaEchipament", () => {
  it("UPDATE fără id în payload, pe id + organizație, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("equipment", "update", { data: { id: ID_2 } });

    const r = await actualizeazaEchipament({ ...echipament, id: ID_2, status: "in_reparatie" });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("equipment");
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).not.toHaveProperty("organization_id");
    expect(apel?.payload).toMatchObject({ status: "in_reparatie", cod: "CZ-01" });
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/mentenanta/echipamente", `/mentenanta/echipamente/${ID_2}`]);
  });

  it("zero rânduri: NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("equipment", "update", { data: null });
    const r = await actualizeazaEchipament({ ...echipament, id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("an de fabricație în afara 1900–2200 e refuzat de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await actualizeazaEchipament({ ...echipament, id: ID_2, an_fabricatie: "1850" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("inregistreazaContor", () => {
  it("prima citire: precitire pe (echipament, tip, nesters), ultima întâi; apoi INSERT, fără avertisment", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("employees", "select", FISA_MEA);
    server.raspunde("equipment_meters", "select", { data: null });
    server.raspunde("equipment_meters", "insert", { data: { id: ID_2 } });

    const r = await inregistreazaContor(contor);

    expect(r).toEqual({ ok: true, data: { id: ID_2, avertismentSalt: null } });
    const [precitire, insert] = server.apeluriPe("equipment_meters");
    expect(precitire?.operatie).toBe("select");
    expect(areFiltru(precitire, "eq", "equipment_id", ID_1)).toBe(true);
    expect(areFiltru(precitire, "eq", "tip", "ore")).toBe(true);
    expect(areFiltru(precitire, "is", "deleted_at", null)).toBe(true);
    expect(precitire?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["data_citirii", { ascending: false }] },
        { metoda: "order", argumente: ["created_at", { ascending: false }] },
        { metoda: "limit", argumente: [1] },
      ]),
    );
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      equipment_id: ID_1,
      tip: "ore",
      citire: 1200,
      resetare_contor: false,
      sursa: "manual",
      citit_de_employee_id: ID_FISA_MEA,
    });
    expect(insert?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual([
      `/mentenanta/echipamente/${ID_1}`,
      "/mentenanta",
      "/mentenanta/contoare",
      "/portal/sesizari",
    ]);
  });

  it("regres fără resetare: CONFLICT cu ambele cifre, fără INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("employees", "select", FISA_MEA);
    server.raspunde("equipment_meters", "select", { data: { citire: 10000 } });

    const r = await inregistreazaContor({ ...contor, citire: "9500" });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) {
      expect(r.error.message).toContain("(9500)");
      expect(r.error.message).toContain("(10000)");
      expect(r.error.message).toContain("Resetare contor");
    }
    expect(server.apeluriPe("equipment_meters", "insert")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("regres CU resetare bifată (gestionar): se înregistrează, fără avertisment", async () => {
    const { server } = configureazaActiunea({ permisiuni: { ...CITIRE, ...UPDATE } });
    server.raspunde("equipment_meters", "select", { data: { citire: 10000 } });
    server.raspunde("equipment_meters", "insert", { data: { id: ID_2 } });
    const r = await inregistreazaContor({ ...contor, citire: "5", resetare_contor: true });
    expect(r).toEqual({ ok: true, data: { id: ID_2, avertismentSalt: null } });
    expect(server.apeluriPe("equipment_meters", "insert")[0]?.payload).toMatchObject({
      resetare_contor: true,
      citire: 5,
    });
  });

  it("resetarea cere `maintenance:update` ≥ team: responsabilul utilajului (doar read) e refuzat înainte de orice apel", async () => {
    // Resetarea mută țintele planurilor pe contor — adică editează planuri;
    // politica de INSERT (0182) o refuză oricum, dar aici omul primește motivul.
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: CITIRE });
    const r = await inregistreazaContor({ ...contor, citire: "5", resetare_contor: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    if (!r.ok) expect(r.error.message).toContain("Resetarea contorului");
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([
    ["1000 → 2500 (exact pragul de 1500)", "2500", false],
    ["1000 → 2501 (peste prag)", "2501", true],
    ["1000 → 1000 (aceeași citire)", "1000", false],
  ])(
    "%s: avertisment de salt = %s, iar citirea se înregistrează oricum",
    async (_d, citire, salt) => {
      const { server } = configureazaActiunea({ permisiuni: CITIRE });
      server.raspunde("employees", "select", FISA_MEA);
      server.raspunde("equipment_meters", "select", { data: { citire: 1000 } });
      server.raspunde("equipment_meters", "insert", { data: { id: ID_2 } });

      const r = await inregistreazaContor({ ...contor, citire });

      expect(r.ok).toBe(true);
      if (!r.ok) return;
      if (salt) {
        expect(r.data.avertismentSalt).toContain(`(${citire})`);
        expect(r.data.avertismentSalt).toContain("(1000)");
      } else {
        expect(r.data.avertismentSalt).toBeNull();
      }
      expect(server.apeluriPe("equipment_meters", "insert")).toHaveLength(1);
    },
  );

  it("eroarea la precitire nu ajunge la INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("employees", "select", FISA_MEA);
    server.raspunde("equipment_meters", "select", { error: eroarePostgrest("42501") });
    const r = await inregistreazaContor(contor);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriPe("equipment_meters", "insert")).toHaveLength(0);
  });

  it("garda din bază are ultimul cuvânt: P0001 la INSERT ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("employees", "select", FISA_MEA);
    server.raspunde("equipment_meters", "select", { data: null });
    const mesaj = "Citirea (9500) este mai mică decât ultima citire înregistrată (10000).";
    server.raspunde("equipment_meters", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await inregistreazaContor(contor);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("fără `update`: `citit_de_employee_id` ales de om e înlocuit cu fișa proprie (nu-și atribuie citirea unui coleg)", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("employees", "select", FISA_MEA);
    server.raspunde("equipment_meters", "select", { data: null });
    server.raspunde("equipment_meters", "insert", { data: { id: ID_2 } });
    const r = await inregistreazaContor({ ...contor, citit_de_employee_id: ID_2 });
    expect(r.ok).toBe(true);
    const fisa = server.apeluriPe("employees", "select")[0];
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(server.apeluriPe("equipment_meters", "insert")[0]?.payload).toMatchObject({
      citit_de_employee_id: ID_FISA_MEA,
    });
  });

  it("fără `update` și fără fișă: citirea pleacă nesemnată (null), nu cu id-ul trimis", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("employees", "select", { data: null });
    server.raspunde("equipment_meters", "select", { data: null });
    server.raspunde("equipment_meters", "insert", { data: { id: ID_2 } });
    const r = await inregistreazaContor({ ...contor, citit_de_employee_id: ID_2 });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("equipment_meters", "insert")[0]?.payload).toMatchObject({
      citit_de_employee_id: null,
    });
  });

  it("cu `update`: `citit_de_employee_id` ales rămâne, fără citirea fișei", async () => {
    const { server } = configureazaActiunea({ permisiuni: { ...CITIRE, ...UPDATE } });
    server.raspunde("equipment_meters", "select", { data: null });
    server.raspunde("equipment_meters", "insert", { data: { id: ID_2 } });
    const r = await inregistreazaContor({ ...contor, citit_de_employee_id: ID_2 });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("employees")).toHaveLength(0);
    expect(server.apeluriPe("equipment_meters", "insert")[0]?.payload).toMatchObject({
      citit_de_employee_id: ID_2,
    });
  });

  it("citirea negativă e refuzată de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    const r = await inregistreazaContor({ ...contor, citire: "-1" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("adaugaAutorizatieIscir", () => {
  it("INSERT cu organizația din sesiune, emitent implicit ISCIR; revalidează fișa și panoul", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "insert", { data: { id: ID_2 } });

    const r = await adaugaAutorizatieIscir(iscir);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("iscir_authorizations");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      equipment_id: ID_1,
      numar: "ISCIR-77",
      emitent: "ISCIR",
      emis_la: null,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    // Și panoul `/mentenanta`: afișează autorizațiile care expiră, deci o
    // autorizație nouă trebuie să-i schimbe lista (lipsea până la M1).
    expect(caiRevalidate()).toEqual([`/mentenanta/echipamente/${ID_1}`, "/mentenanta"]);
  });

  it("număr duplicat: mesajul modulului pomenește autorizația ISCIR", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "insert", {
      error: eroarePostgrest("23505", "iscir_authorizations_uq"),
    });
    const r = await adaugaAutorizatieIscir(iscir);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("autorizației ISCIR");
  });

  it("fără dată de valabilitate: VALIDARE, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await adaugaAutorizatieIscir({ ...iscir, valabil_pana: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});
