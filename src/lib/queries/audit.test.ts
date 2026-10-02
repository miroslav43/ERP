// src/lib/queries/audit.test.ts
//
// Jurnalul de audit: filtrele din URL, cursorul keyset (created_at, id) validat
// strict fiindcă ajunge într-un `or(...)` textual, intervalul de zile pe fusul
// Europe/Bucharest (inclusiv zilele de schimbare a orei), îmbogățirea cu
// actorii și organizațiile, exportul pe pagini.
//
// Funcțiile primesc clientul ca argument, deci falsul se pasează direct.

import { describe, expect, it, vi } from "vitest";

import { areFiltru, clientFals, eroarePostgrest, type ApelFals } from "@/lib/teste/supabase-fals";

import {
  cheieFiltre,
  codificaCursor,
  colecteazaPentruExport,
  decodificaCursor,
  interogheazaJurnal,
  LIMITA_IMPLICITA,
  LIMITA_MAXIMA,
  listeazaOrganizatiiPentruFiltru,
  parseazaFiltre,
  serializeazaFiltre,
  type FiltreAudit,
} from "./audit";

const ORG = "11111111-1111-4111-8111-111111111111";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const filtreDe = (peste: Partial<FiltreAudit> = {}): FiltreAudit => ({
  organizationId: null,
  deLa: null,
  panaLa: null,
  actor: null,
  actiune: null,
  status: null,
  entitate: null,
  entityId: null,
  cursor: null,
  limita: 2,
  ...peste,
});

const rand = (id: string, createdAt: string, peste: Record<string, unknown> = {}) => ({
  id,
  created_at: createdAt,
  organization_id: ORG,
  actor_id: ACTOR,
  action: "update",
  status: "success",
  entity_type: "employees",
  entity_id: "e1",
  before: null,
  after: { a: 1 },
  ip: "10.0.0.1",
  user_agent: "test",
  request_id: "r1",
  error_code: null,
  ...peste,
});

const filtruPe = (apel: ApelFals | undefined, metoda: string, coloana: string): unknown =>
  apel?.filtre.find((f) => f.metoda === metoda && f.argumente[0] === coloana)?.argumente[1];

const momentDin = (valoare: unknown): string => new Date(String(valoare)).toISOString();

/** Rulează o interogare cu jurnal gol și întoarce apelul pe `audit_logs`. */
async function apelJurnal(filtre: FiltreAudit): Promise<ApelFals | undefined> {
  const fals = clientFals();
  fals.raspunde("audit_logs", "select", { data: [] });
  await interogheazaJurnal(fals.client, filtre);
  return fals.apeluriPe("audit_logs")[0];
}

/* -------------------------------- filtre --------------------------------- */

describe("parseazaFiltre", () => {
  it("fără parametri: totul null, limita implicită", () => {
    expect(parseazaFiltre({})).toEqual(filtreDe({ limita: LIMITA_IMPLICITA }));
  });

  it("citește numele scurte și prima valoare dintr-o listă", () => {
    expect(
      parseazaFiltre({
        org: ORG,
        de_la: "2026-01-01",
        pana_la: "2026-01-31",
        actor: " ana@firma.ro ",
        actiune: ["role_changed", "create"],
        status: "denied",
        entitate: "employees",
        entity_id: "e1",
        cursor: "abc",
        limita: "100",
      }),
    ).toEqual({
      organizationId: ORG,
      deLa: "2026-01-01",
      panaLa: "2026-01-31",
      actor: "ana@firma.ro",
      actiune: "role_changed",
      status: "denied",
      entitate: "employees",
      entityId: "e1",
      cursor: "abc",
      limita: 100,
    });
  });

  it.each([
    ["org care nu e UUID", { org: "firma-mea" }, "organizationId", null],
    ["acțiune inexistentă", { actiune: "drop_table" }, "actiune", null],
    ["status inexistent", { status: "ok" }, "status", null],
    ["dată în format românesc", { de_la: "01.01.2026" }, "deLa", null],
    ["limită peste maxim", { limita: String(LIMITA_MAXIMA + 1) }, "limita", LIMITA_IMPLICITA],
    ["limită negativă", { limita: "-3" }, "limita", LIMITA_IMPLICITA],
  ])("valoare invalidă (%s) cade pe implicit", (_e, brute, cheie, asteptat) => {
    expect(parseazaFiltre(brute)[cheie as keyof FiltreAudit]).toBe(asteptat);
  });
});

describe("serializeazaFiltre / cheieFiltre", () => {
  it("doar filtrele completate, fără cursor și fără limită", () => {
    const s = serializeazaFiltre(
      filtreDe({ organizationId: ORG, actiune: "create", entityId: "x", cursor: "c", limita: 9 }),
    );
    expect(s).toBe(`org=${ORG}&actiune=create&entity_id=x`);
  });

  it("drum dus-întors prin URL fără pierderi", () => {
    const f = filtreDe({
      organizationId: ORG,
      deLa: "2026-02-01",
      panaLa: "2026-02-28",
      actor: "ana",
      actiune: "export",
      status: "failure",
      entitate: "payroll",
      entityId: "p1",
      limita: LIMITA_IMPLICITA,
    });
    expect(parseazaFiltre(Object.fromEntries(new URLSearchParams(serializeazaFiltre(f))))).toEqual(
      f,
    );
  });

  it("suplimentarul se adaugă, iar cheia diferă după cursor", () => {
    expect(serializeazaFiltre(filtreDe(), { cursor: "x", gol: "" })).toBe("cursor=x");
    expect(cheieFiltre(filtreDe({ cursor: "a" }))).not.toBe(cheieFiltre(filtreDe({ cursor: "b" })));
  });
});

/* -------------------------------- cursor --------------------------------- */

describe("codificaCursor / decodificaCursor", () => {
  it.each([
    "2026-09-01T10:00:00Z",
    "2026-09-01T10:00:00.123456+00:00",
    "2026-09-01T10:00:00.5+0300",
  ])("momentul %s face drumul dus-întors, URL-safe", (moment) => {
    const cursor = codificaCursor(moment, ID_A);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodificaCursor(cursor)).toEqual({ moment, id: ID_A });
  });

  it.each([
    ["null", null],
    ["nu e base64", "%%%"],
    ["fără separator", btoa("2026-09-01T10:00:00Z")],
    ["id care nu e UUID", btoa("2026-09-01T10:00:00Z|abc")],
    ["moment care nu e moment", btoa(`ieri|${ID_A}`)],
    ["injecție în id", btoa(`2026-09-01T10:00:00Z|${ID_A}",id.gt."0`)],
    ["injecție în moment", btoa(`2026-09-01T10:00:00Z),or(id.gt.0|${ID_A}`)],
  ])("cursor respins (%s) ⇒ null", (_e, brut) => {
    expect(decodificaCursor(brut)).toBeNull();
  });
});

/* --------------------------- intervalul de zile -------------------------- */

describe("interogheazaJurnal — intervalul de zile pe fusul București", () => {
  it.each([
    // iarnă, UTC+2
    ["2026-01-15", "2026-01-14T22:00:00.000Z"],
    // vară, UTC+3
    ["2026-07-15", "2026-07-14T21:00:00.000Z"],
    // ziua de DUPĂ trecerea la ora de vară
    ["2026-03-30", "2026-03-29T21:00:00.000Z"],
    // ziua de DUPĂ trecerea la ora de iarnă
    ["2026-10-26", "2026-10-25T22:00:00.000Z"],
  ])("`de_la` %s începe la miezul nopții locale (%s)", async (zi, moment) => {
    const apel = await apelJurnal(filtreDe({ deLa: zi }));
    expect(momentDin(filtruPe(apel, "gte", "created_at"))).toBe(moment);
  });

  it.each([
    ["2026-01-15", "2026-01-15T22:00:00.000Z"],
    ["2026-07-15", "2026-07-15T21:00:00.000Z"],
  ])(
    "`pana_la` %s e inclusiv: limita e miezul nopții zilei următoare (%s), exclusiv",
    async (zi, moment) => {
      const apel = await apelJurnal(filtreDe({ panaLa: zi }));
      expect(momentDin(filtruPe(apel, "lt", "created_at"))).toBe(moment);
      expect(filtruPe(apel, "lte", "created_at")).toBeUndefined();
    },
  );

  // `decalajOrar` citește decalajul la 12:00 UTC al zilei, nu la miezul nopții.
  // În ziua schimbării orei cele două diferă, iar intervalul alunecă o oră.
  it.fails(
    "DEFECT: `de_la` în ziua trecerii la ora de vară (29.03.2026) începe cu o oră prea devreme",
    async () => {
      const apel = await apelJurnal(filtreDe({ deLa: "2026-03-29" }));
      // Miezul nopții la București era încă UTC+2.
      expect(momentDin(filtruPe(apel, "gte", "created_at"))).toBe("2026-03-28T22:00:00.000Z");
    },
  );

  it.fails(
    "DEFECT: `de_la` în ziua trecerii la ora de iarnă (25.10.2026) pierde prima oră a zilei",
    async () => {
      const apel = await apelJurnal(filtreDe({ deLa: "2026-10-25" }));
      // Miezul nopții la București era încă UTC+3.
      expect(momentDin(filtruPe(apel, "gte", "created_at"))).toBe("2026-10-24T21:00:00.000Z");
    },
  );

  it.fails(
    "DEFECT: `pana_la` 28.03.2026 pierde ultima oră a zilei (limita vine din 29.03)",
    async () => {
      const apel = await apelJurnal(filtreDe({ panaLa: "2026-03-28" }));
      expect(momentDin(filtruPe(apel, "lt", "created_at"))).toBe("2026-03-28T22:00:00.000Z");
    },
  );

  it.fails("DEFECT: `pana_la` 24.10.2026 include prima oră din 25.10", async () => {
    const apel = await apelJurnal(filtreDe({ panaLa: "2026-10-24" }));
    expect(momentDin(filtruPe(apel, "lt", "created_at"))).toBe("2026-10-24T21:00:00.000Z");
  });
});

/* ------------------------------- interogare ------------------------------ */

describe("interogheazaJurnal", () => {
  it("ordonare (created_at, id) descrescător și limita+1", async () => {
    const apel = await apelJurnal(filtreDe({ limita: 5 }));
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["created_at", { ascending: false }] },
        { metoda: "order", argumente: ["id", { ascending: false }] },
        { metoda: "limit", argumente: [6] },
      ]),
    );
  });

  it("limita peste maxim e strânsă la maxim chiar dacă vine direct, nu prin parsare", async () => {
    const apel = await apelJurnal(filtreDe({ limita: 10_000 }));
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [LIMITA_MAXIMA + 1] });
  });

  it("fără organizație în filtre nu se pune `organization_id` (consola de platformă)", async () => {
    const apel = await apelJurnal(filtreDe());
    expect(areFiltru(apel, "eq", "organization_id")).toBe(false);
  });

  it("filtrele simple ajung în interogare", async () => {
    const apel = await apelJurnal(
      filtreDe({
        organizationId: ORG,
        actiune: "role_changed",
        status: "denied",
        entitate: "organization_members",
        entityId: "abc",
      }),
    );
    expect(areFiltru(apel, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(apel, "eq", "action", "role_changed")).toBe(true);
    expect(areFiltru(apel, "eq", "status", "denied")).toBe(true);
    expect(areFiltru(apel, "eq", "entity_type", "organization_members")).toBe(true);
    expect(areFiltru(apel, "ilike", "entity_id", "%abc%")).toBe(true);
  });

  it("acțiunea și statusul necunoscute (venite ocolind parsarea) nu ajung în `.eq`", async () => {
    const apel = await apelJurnal(filtreDe({ actiune: "drop", status: "meh" }));
    expect(areFiltru(apel, "eq", "action")).toBe(false);
    expect(areFiltru(apel, "eq", "status")).toBe(false);
  });

  it("actorul dat ca UUID se folosește direct, fără căutare în profiluri", async () => {
    const fals = clientFals();
    fals.raspunde("audit_logs", "select", { data: [] });
    await interogheazaJurnal(fals.client, filtreDe({ actor: ACTOR }));
    expect(fals.apeluriPe("profiles")).toHaveLength(0);
    expect(areFiltru(fals.apeluriPe("audit_logs")[0], "in", "actor_id", [ACTOR])).toBe(true);
  });

  it("actorul dat ca text se caută după e-mail, iar id-urile găsite filtrează jurnalul", async () => {
    const fals = clientFals();
    fals.raspunde("profiles", "select", { data: [{ id: ID_A }, { id: ID_B }] });
    fals.raspunde("audit_logs", "select", { data: [] });

    await interogheazaJurnal(fals.client, filtreDe({ actor: "ana" }));

    const [cautare] = fals.apeluriPe("profiles");
    expect(areFiltru(cautare, "ilike", "email", "%ana%")).toBe(true);
    expect(areFiltru(fals.apeluriPe("audit_logs")[0], "in", "actor_id", [ID_A, ID_B])).toBe(true);
  });

  it("niciun actor potrivit ⇒ listă goală FĂRĂ interogare pe jurnal", async () => {
    const fals = clientFals();
    fals.raspunde("profiles", "select", { data: [] });
    const r = await interogheazaJurnal(fals.client, filtreDe({ actor: "nimeni" }));
    expect(r).toEqual({ ok: true, randuri: [], cursorUrmator: null });
    expect(fals.apeluriPe("audit_logs")).toHaveLength(0);
  });

  it("cursorul valid devine predicatul keyset pe (created_at, id)", async () => {
    const moment = "2026-09-01T10:00:00.123+00:00";
    const apel = await apelJurnal(filtreDe({ cursor: codificaCursor(moment, ID_C) }));
    const or = apel?.filtre.find((f) => f.metoda === "or");
    expect(or?.argumente[0]).toBe(
      `created_at.lt."${moment}",and(created_at.eq."${moment}",id.lt."${ID_C}")`,
    );
  });

  it("un cursor fabricat nu ajunge în `or(...)`", async () => {
    const apel = await apelJurnal(filtreDe({ cursor: btoa(`x|${ID_A}`) }));
    expect(apel?.filtre.some((f) => f.metoda === "or")).toBe(false);
  });

  it("limita+1 rânduri ⇒ se păstrează limita, cursorul vine din ultimul rând păstrat", async () => {
    const fals = clientFals();
    fals.raspunde("audit_logs", "select", {
      data: [
        rand(ID_C, "2026-09-03T10:00:00+00:00"),
        rand(ID_B, "2026-09-02T10:00:00+00:00"),
        rand(ID_A, "2026-09-01T10:00:00+00:00"),
      ],
    });
    fals.raspunde("profiles", "select", { data: [] });
    fals.raspunde("organizations", "select", { data: [] });

    const r = await interogheazaJurnal(fals.client, filtreDe({ limita: 2 }));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.randuri.map((x) => x.id)).toEqual([ID_C, ID_B]);
    expect(decodificaCursor(r.cursorUrmator)).toEqual({
      moment: "2026-09-02T10:00:00+00:00",
      id: ID_B,
    });
  });

  it("îmbogățește cu numele actorului (cu rezervă pe prenume + nume) și al organizației", async () => {
    const fals = clientFals();
    const ALT_ACTOR = "44444444-4444-4444-8444-444444444444";
    fals.raspunde("audit_logs", "select", {
      data: [
        rand(ID_B, "2026-09-02T10:00:00+00:00"),
        rand(ID_A, "2026-09-01T10:00:00+00:00", { actor_id: ALT_ACTOR, ip: { brut: true } }),
        rand(ID_C, "2026-09-01T09:00:00+00:00", { actor_id: null, organization_id: null }),
      ],
    });
    fals.raspunde("profiles", "select", {
      data: [
        { id: ACTOR, full_name: "  Ana Pop  ", email: "ana@firma.ro" },
        { id: ALT_ACTOR, full_name: "", prenume: "Ion", nume_familie: "Ionescu", email: "" },
      ],
    });
    fals.raspunde("organizations", "select", { data: [{ id: ORG, name: "Firma Test" }] });

    const r = await interogheazaJurnal(fals.client, filtreDe({ limita: 10 }));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.randuri[0]).toMatchObject({
      actorNume: "Ana Pop",
      actorEmail: "ana@firma.ro",
      organizationName: "Firma Test",
      action: "update",
      ip: "10.0.0.1",
    });
    expect(r.randuri[1]).toMatchObject({ actorNume: "Ion Ionescu", actorEmail: null, ip: null });
    expect(r.randuri[2]).toMatchObject({ actorNume: null, organizationName: null });
    // Profilurile și organizațiile se cer o singură dată, pe id-uri unice.
    expect(areFiltru(fals.apeluriPe("profiles")[0], "in", "id", [ACTOR, ALT_ACTOR])).toBe(true);
    expect(areFiltru(fals.apeluriPe("organizations")[0], "in", "id", [ORG])).toBe(true);
  });

  it("eșecul îmbogățirii nu strică jurnalul: rândurile vin fără nume", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fals = clientFals();
    fals.raspunde("audit_logs", "select", { data: [rand(ID_A, "2026-09-01T10:00:00+00:00")] });
    fals.raspunde("profiles", "select", { error: eroarePostgrest("42501") });
    fals.raspunde("organizations", "select", { error: eroarePostgrest("42501") });

    const r = await interogheazaJurnal(fals.client, filtreDe());

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.randuri[0]).toMatchObject({ id: ID_A, actorNume: null, organizationName: null });
  });

  it("eroarea interogării ⇒ `ok: false` cu mesaj pentru om, nu excepție", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fals = clientFals();
    fals.raspunde("audit_logs", "select", { error: eroarePostgrest("57014") });
    const r = await interogheazaJurnal(fals.client, filtreDe());
    expect(r).toEqual({
      ok: false,
      mesaj: "Nu am putut încărca jurnalul de audit. Încearcă din nou.",
    });
  });
});

describe("colecteazaPentruExport", () => {
  it("parcurge paginile până la ultima și le lipește în ordine", async () => {
    const fals = clientFals();
    const randuri = Array.from({ length: 202 }, (_x, i) =>
      rand(
        `00000000-0000-4000-8000-${String(1000 - i).padStart(12, "0")}`,
        new Date(Date.UTC(2026, 8, 1) - i * 60_000).toISOString(),
      ),
    );
    // Pagina 1: limita e plafonată la LIMITA_MAXIMA (200) ⇒ 201 rânduri, continuă.
    fals.raspunde("audit_logs", "select", { data: randuri.slice(0, 201) });
    fals.raspunde("profiles", "select", { data: [] });
    fals.raspunde("organizations", "select", { data: [] });
    // Pagina 2: un singur rând, sub limită ⇒ ultima.
    fals.raspunde("audit_logs", "select", { data: randuri.slice(200, 201) });
    fals.raspunde("profiles", "select", { data: [] });
    fals.raspunde("organizations", "select", { data: [] });

    const r = await colecteazaPentruExport(fals.client, filtreDe({ organizationId: ORG }), 202);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.randuri.map((x) => x.id)).toEqual(randuri.slice(0, 201).map((x) => x.id));
    expect(r.cursorUrmator).toBeNull();
    const [prima, aDoua] = fals.apeluriPe("audit_logs");
    expect(prima?.filtre).toContainEqual({ metoda: "limit", argumente: [LIMITA_MAXIMA + 1] });
    // A doua pagină cere doar cât a mai rămas până la maxim (202 - 200 = 2).
    expect(aDoua?.filtre).toContainEqual({ metoda: "limit", argumente: [3] });
    expect(aDoua?.filtre.some((f) => f.metoda === "or")).toBe(true);
    expect(areFiltru(aDoua, "eq", "organization_id", ORG)).toBe(true);
  });

  it("la plafon se oprește și întoarce cursorul de continuare", async () => {
    const fals = clientFals();
    fals.raspunde("audit_logs", "select", {
      data: [rand(ID_C, "2026-09-03T00:00:00Z"), rand(ID_B, "2026-09-02T00:00:00Z")],
    });
    fals.raspunde("profiles", "select", { data: [] });
    fals.raspunde("organizations", "select", { data: [] });

    const r = await colecteazaPentruExport(fals.client, filtreDe(), 1);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.randuri).toHaveLength(1);
    expect(decodificaCursor(r.cursorUrmator)).toEqual({ moment: "2026-09-03T00:00:00Z", id: ID_C });
    expect(fals.apeluriPe("audit_logs")).toHaveLength(1);
  });

  it("eșecul unei pagini oprește exportul cu eroarea ei", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fals = clientFals();
    fals.raspunde("audit_logs", "select", { error: eroarePostgrest("57014") });
    const r = await colecteazaPentruExport(fals.client, filtreDe(), 10);
    expect(r.ok).toBe(false);
  });
});

describe("listeazaOrganizatiiPentruFiltru", () => {
  it("organizațiile vii, alfabetic, cu plafon", async () => {
    const fals = clientFals();
    fals.raspunde("organizations", "select", { data: [{ id: ORG, name: "Firma", extra: 1 }] });

    expect(await listeazaOrganizatiiPentruFiltru(fals.client)).toEqual([
      { id: ORG, name: "Firma" },
    ]);
    const [apel] = fals.apeluri;
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["name", { ascending: true }] },
        { metoda: "limit", argumente: [500] },
      ]),
    );
  });

  it("eroarea ⇒ listă goală, nu excepție", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fals = clientFals();
    fals.raspunde("organizations", "select", { error: eroarePostgrest("42501") });
    expect(await listeazaOrganizatiiPentruFiltru(fals.client)).toEqual([]);
  });
});
