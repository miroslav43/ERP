// src/lib/reges/genereaza-evenimente.test.ts
//
// Generarea evenimentelor REGES: un singur SELECT de deduplicare și un singur
// INSERT pe lot, termenul calculat din `reges_termene` (organizația bate
// platforma), evenimentele invalide raportate, nu aruncate, și anunțul către
// cine poate transmite — care NU desface niciodată înregistrarea.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  calendarPentruAnul,
  genereazaEvenimenteReges,
  incarcaTermeneReges,
  type EvenimentDeGenerat,
} from "./genereaza-evenimente";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "33333333-3333-4333-8333-333333333333";
const ANGAJAT = "66666666-6666-4666-8666-666666666666";
const ALT_ANGAJAT = "88888888-8888-4888-8888-888888888888";

const termen = (peste: Record<string, unknown> = {}) => ({
  id: "t-platforma",
  organization_id: null,
  event_type: "modificare_salariu",
  termen_zile: 20,
  reper: "data_eveniment",
  zile_lucratoare: false,
  descriere: null,
  valabil_de_la: "2020-01-01",
  valabil_pana: null,
  ...peste,
});

const eveniment = (peste: Partial<EvenimentDeGenerat> = {}): EvenimentDeGenerat => ({
  employeeId: ANGAJAT,
  contractId: null,
  tip: "modificare_salariu",
  dataEvenimentului: "2026-09-01",
  valabilDeLa: null,
  dataContract: null,
  payload: { salariu: 5000 },
  ...peste,
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("incarcaTermeneReges", () => {
  it("rândurile de platformă ȘI ale firmei, vii, mapate pe configurare", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", {
      data: [termen({ organization_id: ORG, id: "t-org" })],
    });

    const r = await incarcaTermeneReges(fals.client, ORG);

    expect(r).toEqual([
      {
        id: "t-org",
        organizationId: ORG,
        eventType: "modificare_salariu",
        termenZile: 20,
        reper: "data_eveniment",
        zileLucratoare: false,
        descriere: null,
        valabilDeLa: "2020-01-01",
        valabilPana: null,
      },
    ]);
    const [apel] = fals.apeluri;
    expect(apel?.filtre).toContainEqual({
      metoda: "or",
      argumente: [`organization_id.is.null,organization_id.eq.${ORG}`],
    });
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("eroarea se aruncă (tradusă), nu se înghite", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { error: eroarePostgrest("42501") });
    await expect(incarcaTermeneReges(fals.client, ORG)).rejects.toMatchObject({ code: "INTERZIS" });
  });
});

describe("calendarPentruAnul", () => {
  it("acoperă anul de referință plus vecinii (termenele trec peste 1 ianuarie)", () => {
    const calendar = calendarPentruAnul("2026-12-30");
    // 1 ianuarie e sărbătoare legală — și în anul următor, și în cel dinainte.
    expect(calendar.zileLibere.has("2027-01-01")).toBe(true);
    expect(calendar.zileLibere.has("2025-01-01")).toBe(true);
    expect(calendar.zileLibere.has("2026-12-25")).toBe(true);
    // O zi obișnuită de lucru nu e liberă.
    expect(calendar.zileLibere.has("2026-12-30")).toBe(false);
  });
});

describe("genereazaEvenimenteReges", () => {
  it("lot gol: nicio interogare", async () => {
    const fals = clientFals();
    const r = await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [],
    });
    expect(r).toEqual({ create: 0, sarite: 0, respinse: [] });
    expect(fals.apeluri).toHaveLength(0);
  });

  it("un INSERT pentru tot lotul, cu termenul calculat și starea fixată de server", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", { data: [] });

    const r = await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment(), eveniment({ employeeId: ALT_ANGAJAT })],
    });

    expect(r).toEqual({ create: 2, sarite: 0, respinse: [] });
    const [deduplicare] = fals.apeluriPe("reges_evenimente", "select");
    expect(areFiltru(deduplicare, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(deduplicare, "in", "employee_id", [ANGAJAT, ALT_ANGAJAT])).toBe(true);
    expect(areFiltru(deduplicare, "neq", "status", "anulat")).toBe(true);
    // Un eveniment șters nu mai blochează regenerarea lui.
    expect(areFiltru(deduplicare, "is", "deleted_at", null)).toBe(true);
    const inserari = fals.apeluriPe("reges_evenimente", "insert");
    expect(inserari).toHaveLength(1);
    const randuri = inserari[0]?.payload as Record<string, unknown>[];
    expect(randuri).toHaveLength(2);
    expect(randuri[0]).toMatchObject({
      organization_id: ORG,
      employee_id: ANGAJAT,
      event_type: "modificare_salariu",
      data_evenimentului: "2026-09-01",
      termen_transmitere: "2026-09-21",
      status: "de_pregatit",
      created_by: USER,
      updated_by: USER,
    });
    expect((randuri[0]?.payload as Record<string, unknown>).salariu).toBe(5000);
    expect(typeof (randuri[0]?.payload as Record<string, unknown>).explicatie_termen).toBe(
      "string",
    );
  });

  it("deduplicare: evenimentul existent se sare, iar dublura din același lot se inserează o dată", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", {
      data: [
        {
          employee_id: ANGAJAT,
          event_type: "modificare_salariu",
          data_evenimentului: "2026-09-01",
        },
      ],
    });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", { data: [] });

    const r = await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [
        eveniment(),
        eveniment({ employeeId: ALT_ANGAJAT }),
        eveniment({ employeeId: ALT_ANGAJAT }),
      ],
    });

    expect(r).toEqual({ create: 1, sarite: 2, respinse: [] });
  });

  it("totul deja existent: niciun INSERT și niciun anunț", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", {
      data: [
        {
          employee_id: ANGAJAT,
          event_type: "modificare_salariu",
          data_evenimentului: "2026-09-01",
        },
      ],
    });
    const r = await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment()],
    });
    expect(r).toEqual({ create: 0, sarite: 1, respinse: [] });
    expect(fals.apeluriPe("reges_evenimente", "insert")).toHaveLength(0);
    expect(fals.apeluriPe("notifications")).toHaveLength(0);
  });

  it("fără termen configurat: evenimentul e RESPINS cu motiv, restul lotului merge", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", { data: [] });

    const r = await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment(), eveniment({ tip: "incetare", employeeId: ALT_ANGAJAT })],
    });

    expect(r.create).toBe(1);
    expect(r.respinse).toEqual([
      { employeeId: ALT_ANGAJAT, tip: "incetare", motiv: expect.stringContaining("incetare") },
    ]);
  });

  it("termenul organizației bate termenul de platformă", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", {
      data: [termen(), termen({ id: "t-org", organization_id: ORG, termen_zile: 5 })],
    });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", { data: [] });

    await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment()],
    });

    const [rand] = fals.apeluriPe("reges_evenimente", "insert")[0]?.payload as Record<
      string,
      unknown
    >[];
    expect(rand?.termen_transmitere).toBe("2026-09-06");
  });

  it("anunță org_admin și hr activi, cu numărul evenimentelor și cel mai apropiat termen", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", {
      data: [termen(), termen({ id: "t2", event_type: "modificare_functie", termen_zile: 3 })],
    });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", {
      data: [
        { user_id: "u-admin", role: "org_admin" },
        { user_id: "u-hr", role: "hr" },
      ],
    });
    fals.raspunde("notifications", "insert", { data: null });

    await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment(), eveniment({ tip: "modificare_functie" })],
    });

    const [membri] = fals.apeluriPe("organization_members");
    expect(areFiltru(membri, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(membri, "eq", "status", "active")).toBe(true);
    expect(areFiltru(membri, "in", "role", ["org_admin", "hr"])).toBe(true);
    expect(areFiltru(membri, "is", "deleted_at", null)).toBe(true);
    const anunturi = fals.apeluriPe("notifications")[0]?.payload as Record<string, unknown>[];
    expect(anunturi.map((a) => a.user_id)).toEqual(["u-admin", "u-hr"]);
    expect(anunturi[0]).toMatchObject({
      organization_id: ORG,
      kind: "task",
      title: "Aveți 2 evenimente de transmis în REGES",
      link: "/reges?stare=de_transmis",
    });
    expect(String(anunturi[0]?.body)).toContain("2026-09-04");
  });

  it("cu modulul REGES oprit, evenimentul se scrie, dar nu se anunță nimeni", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: null });
    await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment()],
    });
    expect(fals.apeluriPe("reges_evenimente").some((a) => a.operatie === "insert")).toBe(true);
    expect(fals.apeluriPe("organization_members")).toHaveLength(0);
    expect(fals.apeluriPe("notifications")).toHaveLength(0);
  });

  it("un singur eveniment: titlul la singular", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", { data: [{ user_id: "u", role: "hr" }] });
    fals.raspunde("notifications", "insert", { data: null });
    await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment()],
    });
    const [anunt] = fals.apeluriPe("notifications")[0]?.payload as Record<string, unknown>[];
    expect(anunt?.title).toBe("Aveți un eveniment de transmis în REGES");
  });

  it("eșecul anunțului NU desface înregistrarea: rezultatul rămâne, eroarea se loghează", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", { data: [{ user_id: "u", role: "hr" }] });
    fals.raspunde("notifications", "insert", { error: eroarePostgrest("42501") });

    const r = await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment()],
    });

    expect(r.create).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("eroarea citirii destinatarilor se loghează (nu trece drept „nimeni de anunțat”), fără anunț", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { data: null });
    fals.raspunde("organization_features", "select", { data: { feature_key: "reges" } });
    fals.raspunde("organization_members", "select", { error: eroarePostgrest("57014") });
    vi.mocked(console.error).mockClear();

    const r = await genereazaEvenimenteReges({
      supabase: fals.client,
      organizationId: ORG,
      userId: USER,
      evenimente: [eveniment()],
    });

    expect(r.create).toBe(1);
    expect(console.error).toHaveBeenCalled();
    expect(fals.apeluriPe("notifications")).toHaveLength(0);
  });

  it("eroarea INSERT-ului de evenimente se aruncă (tradusă)", async () => {
    const fals = clientFals();
    fals.raspunde("reges_termene", "select", { data: [termen()] });
    fals.raspunde("reges_evenimente", "select", { data: [] });
    fals.raspunde("reges_evenimente", "insert", { error: eroarePostgrest("23505") });
    await expect(
      genereazaEvenimenteReges({
        supabase: fals.client,
        organizationId: ORG,
        userId: USER,
        evenimente: [eveniment()],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fals.apeluriPe("notifications")).toHaveLength(0);
  });
});
