// src/app/(app)/setari/organizatie/actions.test.ts
//
// Setările firmei. Organizația vine din tenant, nu din payload (S1); `cui` și
// `tara` sunt NOT NULL, deci lipsa lor se OMITE din UPDATE în loc să trimită
// null; regulile care altfel ar cădea în bază ca 23514 fără câmp sunt în schemă.

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
  ALTA_ORG_ID,
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { actualizeazaOrganizatia } from "./actions";

const PERMIS = { "organizations:update": "all" } as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const minim = {
  name: "  Firma Test  ",
  platitor_tva: true,
  sistem_dualist: false,
  zile_concediu_anual_implicit: "21",
};

function payloadScris(server: ReturnType<typeof configureazaActiunea>["server"]) {
  return server.apeluriPe("organizations", "update")[0]?.payload as Record<string, unknown>;
}

describe("actualizeazaOrganizatia", () => {
  it("fără `organizations:update` la `all`: INTERZIS și nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "organizations:update": "team" } });
    const r = await actualizeazaOrganizatia(minim);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("UPDATE pe organizația din sesiune (nu din payload), viu, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });

    const r = await actualizeazaOrganizatia({ ...minim, id: ALTA_ORG_ID });

    expect(r).toEqual({ ok: true, data: { id: ORG_ID, name: "Firma Test" } });
    const [apel] = server.apeluriPe("organizations");
    expect(areFiltru(apel, "eq", "id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ALTA_ORG_ID)).toBe(false);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(["/setari/organizatie", "/panou"]);
  });

  it("câmpurile goale devin null, iar câmpurile blocate (plan, locuri) nu intră în payload", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });

    await actualizeazaOrganizatia({
      ...minim,
      legal_name: "   ",
      adresa: " Str. Lungă 1 ",
      email_contact: "",
      website: "",
      capital_social: "",
      cod_caen: "",
      plan: "enterprise",
      seats_limit: 999,
    });

    const p = payloadScris(server);
    expect(p).toMatchObject({
      name: "Firma Test",
      legal_name: null,
      adresa: "Str. Lungă 1",
      email_contact: null,
      website: null,
      capital_social: null,
      capital_social_varsat: null,
      cod_caen: null,
      cod_caen_secundare: [],
      platitor_tva: true,
      sistem_dualist: false,
      zile_concediu_anual_implicit: 21,
      updated_by: USER_ID,
    });
    expect(p).not.toHaveProperty("plan");
    expect(p).not.toHaveProperty("seats_limit");
    expect(p).not.toHaveProperty("status");
    expect(Number.isNaN(Date.parse(String(p.updated_at)))).toBe(false);
  });

  it("`cui` și `tara` lipsă se OMIT din UPDATE (coloane NOT NULL), nu se trimit ca null", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });

    await actualizeazaOrganizatia({ ...minim, tara: "" });

    const p = payloadScris(server);
    expect(p).not.toHaveProperty("cui");
    expect(p).not.toHaveProperty("tara");
  });

  it.each([
    ["ro 123456", "RO123456"],
    ["RO123456", "RO123456"],
    ["12345678", "12345678"],
  ])("CUI-ul %j se scrie normalizat ca %j", async (cui, asteptat) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });
    await actualizeazaOrganizatia({ ...minim, cui });
    expect(payloadScris(server).cui).toBe(asteptat);
  });

  it("țara se scrie ca cod ISO cu majuscule", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });
    await actualizeazaOrganizatia({ ...minim, tara: "ro" });
    expect(payloadScris(server).tara).toBe("RO");
  });

  it("capitalul vine numeric, iar codurile CAEN se scriu așa cum au fost validate", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });
    await actualizeazaOrganizatia({
      ...minim,
      capital_social: "200",
      capital_social_varsat: "200",
      cod_caen: "6920",
      cod_caen_secundare: ["4711"],
    });
    expect(payloadScris(server)).toMatchObject({
      capital_social: 200,
      capital_social_varsat: 200,
      cod_caen: "6920",
      cod_caen_secundare: ["4711"],
    });
  });

  it.each([
    [
      "capital vărsat peste cel subscris",
      { capital_social: "100", capital_social_varsat: "150" },
      "capital_social_varsat",
    ],
    [
      "principalul repetat printre secundare",
      { cod_caen: "6920", cod_caen_secundare: ["6920"] },
      "cod_caen_secundare",
    ],
    ["țară inexistentă", { tara: "XX" }, "tara"],
    ["CUI cu litere", { cui: "RO12AB" }, "cui"],
    ["capital negativ", { capital_social: "-1" }, "capital_social"],
    [
      "zile de concediu peste 60",
      { zile_concediu_anual_implicit: "61" },
      "zile_concediu_anual_implicit",
    ],
    ["denumire de un caracter", { name: "A" }, "name"],
  ])("regula de business „%s” e oprită în schemă, cu câmpul numit", async (_e, peste, camp) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await actualizeazaOrganizatia({ ...minim, ...peste });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty(camp);
    expect(server.apeluri).toHaveLength(0);
  });

  it("capital vărsat egal cu cel subscris e permis (limita inclusă)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });
    const r = await actualizeazaOrganizatia({
      ...minim,
      capital_social: "100",
      capital_social_varsat: "100",
    });
    expect(r.ok).toBe(true);
  });

  it("zero rânduri (organizație ștearsă sau blocată de politică): NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: null });
    const r = await actualizeazaOrganizatia(minim);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Organizația nu a fost găsită sau nu mai este activă." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("23514 din bază: VALIDARE cu cod de referință", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { error: eroarePostgrest("23514") });
    const r = await actualizeazaOrganizatia(minim);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.message).toContain("Cod de referință");
  });

  it("auditul de succes poartă id-ul firmei și doar câmpurile din allow-list", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organizations", "update", { data: { id: ORG_ID, name: "Firma Test" } });

    await actualizeazaOrganizatia({ ...minim, seats_limit: 999 });
    await asteaptaDupa();

    const audit = server.audituri().find((a) => a.p_status === "success");
    expect(audit).toMatchObject({
      p_action: "update",
      p_entity_type: "organizations",
      p_entity_id: ORG_ID,
    });
    expect(audit?.p_after).not.toHaveProperty("seats_limit");
    expect(audit?.p_after).toHaveProperty("name");
  });
});
