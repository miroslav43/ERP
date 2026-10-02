// src/app/(app)/ssm/actions-eip-autorizatii.test.ts
//
// Echipamentul individual de protecție (predare, returnare, confirmarea
// semnăturii) și autorizațiile nominale (adăugare, suspendare / ridicare).

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
  adaugaAutorizatieNominala,
  confirmaPrimireaEip,
  marcheazaEipReturnat,
  predaEip,
  schimbaSuspendareaAutorizatiei,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const CREARE = { "ssm:create": "team" } as const;
const ACTUALIZARE = { "ssm:update": "team" } as const;

const predare = {
  employee_id: ID_2,
  articol: "Cască de protecție",
  cod_articol: "CP-1",
  cantitate: "2",
  data_predarii: "2026-09-01",
  durata_utilizare_luni: "",
  semnatura_confirmata: false,
};

const autorizatie = {
  employee_id: ID_2,
  tip: "Lucru la înălțime",
  grupa: "",
  numar: "A-100",
  emitent: "ISCIR",
  valabil_pana: "2028-01-01",
};

describe("pragul de permisiune", () => {
  it.each([
    ["predaEip", predaEip, { "ssm:create": "own" }, predare],
    ["marcheazaEipReturnat", marcheazaEipReturnat, { "ssm:update": "own" }, { id: ID_1 }],
    [
      "confirmaPrimireaEip",
      confirmaPrimireaEip,
      { "ssm:update": "own" },
      { id: ID_1, confirmata: true },
    ],
    ["adaugaAutorizatieNominala", adaugaAutorizatieNominala, { "ssm:create": "own" }, autorizatie],
    [
      "schimbaSuspendareaAutorizatiei",
      schimbaSuspendareaAutorizatiei,
      { "ssm:update": "own" },
      { id: ID_1, suspendata_la: "2026-09-30" },
    ],
  ] as const)(
    "%s: scope `own` sub pragul `team` ⇒ INTERZIS",
    async (_n, actiune, perm, intrare) => {
      const { server } = configureazaActiunea({ rol: "employee", permisiuni: perm });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("angajatul nu-și poate confirma singur primirea cu `ssm:read` = all", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: { "ssm:read": "all" } });
    const r = await confirmaPrimireaEip({ id: ID_1, confirmata: true });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("predaEip", () => {
  it("INSERT cu organizația din sesiune, fără data de înlocuire (o calculează triggerul)", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("ppe_issuances", "insert", { data: { id: ID_1 } });

    const r = await predaEip(predare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("ppe_issuances");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_2,
      cantitate: 2,
      unitate: "buc",
      durata_utilizare_luni: null,
      semnatura_confirmata: false,
    });
    expect(apel?.payload).not.toHaveProperty("data_inlocuirii");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/eip"]);
  });

  it("cantitatea zero e refuzată de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await predaEip({ ...predare, cantitate: "0" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("depășire numerică (22012/22003): CONFLICT cu mesajul modulului", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("ppe_issuances", "insert", { error: eroarePostgrest("22012") });
    const r = await predaEip(predare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("cantitățile introduse");
  });
});

describe("marcheazaEipReturnat", () => {
  it("scrie data returnării pe id + organizație, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("ppe_issuances", "update", { data: { id: ID_1 } });

    const r = await marcheazaEipReturnat({ id: ID_1, returnat_la: "2026-09-28" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("ppe_issuances");
    expect(apel?.payload).toEqual({ returnat_la: "2026-09-28" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/eip"]);
  });

  it.each([[""], [null], [undefined]])(
    "returnarea se poate anula: %j devine null în payload",
    async (valoare) => {
      const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
      server.raspunde("ppe_issuances", "update", { data: { id: ID_1 } });
      const r = await marcheazaEipReturnat({ id: ID_1, returnat_la: valoare });
      expect(r.ok).toBe(true);
      expect(server.apeluriPe("ppe_issuances")[0]?.payload).toEqual({ returnat_la: null });
    },
  );

  it("o dată care nu e ISO e refuzată", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await marcheazaEipReturnat({ id: ID_1, returnat_la: "28.09.2026" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("ppe_issuances", "update", { data: null });
    const r = await marcheazaEipReturnat({ id: ID_1, returnat_la: "2026-09-28" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

describe("confirmaPrimireaEip", () => {
  it.each([[true], [false]])(
    "confirmata=%s se scrie ca `semnatura_confirmata`, pe id + organizație",
    async (confirmata) => {
      const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
      server.raspunde("ppe_issuances", "update", { data: { id: ID_1 } });

      const r = await confirmaPrimireaEip({ id: ID_1, confirmata });

      expect(r).toEqual({ ok: true, data: { id: ID_1 } });
      const [apel] = server.apeluriPe("ppe_issuances");
      expect(apel?.payload).toEqual({ semnatura_confirmata: confirmata });
      expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(apel?.selectDupaScriere).toBeDefined();
    },
  );

  it("textul „false” nu e acceptat ca boolean (nu se transformă tăcut în true)", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await confirmaPrimireaEip({ id: ID_1, confirmata: "false" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri: NEGASIT, iar auditul de eșec poartă id-ul și valoarea cerută", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("ppe_issuances", "update", { data: null });
    const r = await confirmaPrimireaEip({ id: ID_1, confirmata: true });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "failure",
        p_after: { id: ID_1, confirmata: true },
      }),
    ]);
  });
});

describe("adaugaAutorizatieNominala", () => {
  it("INSERT cu organizația din sesiune; câmpurile goale devin null", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("personnel_authorizations", "insert", { data: { id: ID_1 } });

    const r = await adaugaAutorizatieNominala(autorizatie);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("personnel_authorizations");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_2,
      numar: "A-100",
      grupa: null,
      suspendata_la: null,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/autorizatii"]);
  });

  it("autorizație duplicată: mesajul numește tipul și numărul", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("personnel_authorizations", "insert", {
      error: eroarePostgrest("23505", "personnel_authorizations_uq"),
    });
    const r = await adaugaAutorizatieNominala(autorizatie);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja o autorizație de acest tip și cu acest număr pentru angajatul ales.",
      },
    });
  });

  it("auditul de succes poartă id-ul nou și nu poartă observațiile", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("personnel_authorizations", "insert", { data: { id: ID_1 } });
    await adaugaAutorizatieNominala({ ...autorizatie, observatii: "notă internă" });
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: ID_1 });
    expect(audit?.p_after).not.toHaveProperty("observatii");
  });
});

describe("schimbaSuspendareaAutorizatiei", () => {
  it("suspendarea scrie data pe id + organizație, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("personnel_authorizations", "update", { data: { id: ID_1 } });

    const r = await schimbaSuspendareaAutorizatiei({ id: ID_1, suspendata_la: "2026-09-30" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("personnel_authorizations");
    expect(apel?.payload).toEqual({ suspendata_la: "2026-09-30" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/autorizatii"]);
  });

  it("ridicarea suspendării: fără dată ⇒ `suspendata_la: null`", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("personnel_authorizations", "update", { data: { id: ID_1 } });
    const r = await schimbaSuspendareaAutorizatiei({ id: ID_1 });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("personnel_authorizations")[0]?.payload).toEqual({
      suspendata_la: null,
    });
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("personnel_authorizations", "update", { data: null });
    const r = await schimbaSuspendareaAutorizatiei({ id: ID_2, suspendata_la: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });
});
