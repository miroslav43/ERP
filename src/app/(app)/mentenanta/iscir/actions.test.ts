// src/app/(app)/mentenanta/iscir/actions.test.ts
//
// Gesturile de pe autorizația ISCIR (M7, 0193): corectarea, suspendarea,
// ridicarea suspendării, reînnoirea, ștergerea. Ce refuză garda din bază
// (rândul înlocuit, mutarea pe alt echipament, suspendarea fără motiv) se
// verifică în `tests/rls/proba-iscir.sql`; aici: poarta, filtrele de tranziție,
// `.select()` după scriere, zero rânduri = CONFLICT, traducerea P0001, RPC-ul
// reînnoirii și căile revalidate.

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

import {
  actualizeazaAutorizatie,
  reactiveazaAutorizatie,
  reinnoiesteAutorizatie,
  stergeAutorizatie,
  suspendaAutorizatie,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const UPDATE = { "maintenance:update": "team" } as const;

const corectura = {
  id: ID_1,
  numar: "ISCIR-77",
  tip: "macara",
  emitent: "ISCIR",
  emis_la: "2026-01-10",
  valabil_pana: "2027-01-10",
  scadenta_verificare_tehnica: "2026-12-01",
  conditii: "",
};

const suspendare = { id: ID_1, suspendata_la: "2026-10-01", motiv_suspendare: "Cablu uzat." };

const reinnoire = {
  id: ID_1,
  numar: "ISCIR-77",
  emis_la: "2026-10-12",
  valabil_pana: "2028-10-12",
  scadenta_verificare_tehnica: "2028-10-12",
};

const RAND = { id: ID_1, equipment_id: ID_2 } as const;

const CAI = ["/mentenanta", "/mentenanta/iscir", `/mentenanta/echipamente/${ID_2}`];

describe("poarta și modulul", () => {
  const cazuri = [
    ["actualizeazaAutorizatie", actualizeazaAutorizatie, corectura],
    ["suspendaAutorizatie", suspendaAutorizatie, suspendare],
    ["reactiveazaAutorizatie", reactiveazaAutorizatie, { id: ID_1 }],
    ["reinnoiesteAutorizatie", reinnoiesteAutorizatie, reinnoire],
    ["stergeAutorizatie", stergeAutorizatie, { id: ID_1 }],
  ] as const;

  it.each(cazuri)(
    "%s: `maintenance:update` own < team ⇒ INTERZIS, zero apeluri",
    async (_n, actiune, intrare) => {
      const { server } = configureazaActiunea({
        rol: "manager",
        permisiuni: { "maintenance:update": "own", "maintenance:read": "team" },
      });
      const r = await actiune(intrare as never);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
    },
  );

  it.each(cazuri)("%s: modulul `maintenance` oprit ⇒ MODUL_DEZACTIVAT", async (_n, a, x) => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE, functii: ["ssm"] });
    const r = await a(x as never);
    expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaAutorizatie", () => {
  it("UPDATE pe rândul curent al organizației, fără id/echipament în payload; `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: RAND });

    const r = await actualizeazaAutorizatie(corectura);

    expect(r).toEqual({ ok: true, data: RAND });
    const [apel] = server.apeluriPe("iscir_authorizations", "update");
    expect(apel?.payload).toMatchObject({
      regim: "inregistrat",
      numar: "ISCIR-77",
      valabil_pana: "2027-01-10",
      conditii: null,
    });
    for (const cheie of [
      "id",
      "equipment_id",
      "suspendata_la",
      "inlocuita_de_id",
      "reactivata_la",
    ]) {
      expect(apel?.payload).not.toHaveProperty(cheie);
    }
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "inlocuita_de_id", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id");
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("zero rânduri (reînnoită, ștearsă, inaccesibilă) ⇒ CONFLICT, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: null });
    const r = await actualizeazaAutorizatie(corectura);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din gardă ajunge întreg, ca CONFLICT", async () => {
    const mesaj =
      "O autorizație nu se mută pe alt echipament. Ștergeți-o și adăugați-o pe echipamentul corect.";
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await actualizeazaAutorizatie(corectura);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("regimul RSVTI fără număr trece; înregistrat fără număr ⇒ VALIDARE, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: RAND });
    const ok = await actualizeazaAutorizatie({
      ...corectura,
      regim: "neinregistrat_rsvti",
      numar: "",
    });
    expect(ok).toMatchObject({ ok: true });
    expect(server.apeluriPe("iscir_authorizations", "update")[0]?.payload).toMatchObject({
      numar: null,
    });

    const { server: altul } = configureazaActiunea({ permisiuni: UPDATE });
    const refuz = await actualizeazaAutorizatie({ ...corectura, numar: "" });
    expect(refuz).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(altul.apeluri).toHaveLength(0);
  });
});

describe("suspendaAutorizatie", () => {
  it("tranziția se păzește în UPDATE: doar o autorizație nesuspendată, curentă", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: RAND });

    const r = await suspendaAutorizatie(suspendare);

    expect(r).toEqual({ ok: true, data: RAND });
    const [apel] = server.apeluriPe("iscir_authorizations", "update");
    expect(apel?.payload).toEqual({ suspendata_la: "2026-10-01", motiv_suspendare: "Cablu uzat." });
    expect(areFiltru(apel, "is", "suspendata_la", null)).toBe(true);
    expect(areFiltru(apel, "is", "inlocuita_de_id", null)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id");
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("motiv sub 5 caractere ⇒ VALIDARE pe `motiv_suspendare`, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await suspendaAutorizatie({ ...suspendare, motiv_suspendare: "uzat" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("motiv_suspendare");
    expect(server.apeluri).toHaveLength(0);
  });

  it("deja suspendată (zero rânduri) ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: null });
    const r = await suspendaAutorizatie(suspendare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("deja suspendată");
  });

  it("dată în viitor: mesajul gărzii trece neschimbat", async () => {
    const mesaj = "Data suspendării nu poate fi în viitor.";
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await suspendaAutorizatie(suspendare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("reactiveazaAutorizatie", () => {
  it("golește `suspendata_la` doar pe o autorizație suspendată; `reactivata_la` n-o trimite", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: RAND });

    const r = await reactiveazaAutorizatie({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: RAND });
    const [apel] = server.apeluriPe("iscir_authorizations", "update");
    expect(apel?.payload).toEqual({ suspendata_la: null });
    expect(areFiltru(apel, "not", "suspendata_la")).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id");
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("nesuspendată (zero rânduri) ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: null });
    const r = await reactiveazaAutorizatie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("reinnoiesteAutorizatie", () => {
  it("citește rândul vechi pe organizație, apoi cheamă RPC-ul; întoarce id-ul nou", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "select", { data: RAND });
    server.raspundeRpc("reinnoieste_autorizatie_iscir", { data: ID_3 });

    const r = await reinnoiesteAutorizatie(reinnoire);

    expect(r).toEqual({ ok: true, data: { id: ID_3, equipment_id: ID_2 } });
    const [citire] = server.apeluriPe("iscir_authorizations", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriRpc).toContainEqual({
      nume: "reinnoieste_autorizatie_iscir",
      argumente: {
        p_autorizatie: ID_1,
        p_valabil_pana: "2028-10-12",
        p_numar: "ISCIR-77",
        p_emitent: null,
        p_emis_la: "2026-10-12",
        p_scadenta_verificare_tehnica: "2028-10-12",
        p_conditii: null,
      },
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("rândul vechi nu e al organizației ⇒ NEGASIT, fără RPC", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "select", { data: null });
    const r = await reinnoiesteAutorizatie(reinnoire);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(
      server.apeluriRpc.filter((a) => a.nume === "reinnoieste_autorizatie_iscir"),
    ).toHaveLength(0);
  });

  it("deja reînnoită: mesajul funcției trece neschimbat", async () => {
    const mesaj = "Autorizația a fost deja reînnoită. Reînnoiți autorizația care o înlocuiește.";
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "select", { data: RAND });
    server.raspundeRpc("reinnoieste_autorizatie_iscir", { error: eroarePostgrest("P0001", mesaj) });
    const r = await reinnoiesteAutorizatie(reinnoire);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("fără dată de valabilitate ⇒ VALIDARE, fără apeluri", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    const r = await reinnoiesteAutorizatie({ ...reinnoire, valabil_pana: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("stergeAutorizatie", () => {
  it("ștergere logică pe rândul curent; `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: RAND });

    const r = await stergeAutorizatie({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: RAND });
    const [apel] = server.apeluriPe("iscir_authorizations", "update");
    expect(Object.keys(apel?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "inlocuita_de_id", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, equipment_id");
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: UPDATE });
    server.raspunde("iscir_authorizations", "update", { data: null });
    const r = await stergeAutorizatie({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
