// src/app/(app)/evaluari/actions-evaluari.test.ts
//
// Evaluarea anuală propriu-zisă: creare pe instantaneul șablonului, corectarea
// ciornei, finalizarea și redeschiderea. Straturile comune ale lui
// `createAction` sunt verificate în `src/app/(app)/salarizare/actions.test.ts`.

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
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaEvaluare,
  creeazaEvaluare,
  finalizeazaEvaluare,
  planificaEvaluari,
  redeschideEvaluare,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const ANGAJAT = ID_2;
const SABLON = ID_3;

const CRITERII = [
  {
    cod: "calitate",
    denumire: "Calitate",
    descriere: null,
    tip: "scala",
    scala_max: 5,
    pondere: null,
  },
  { cod: "note", denumire: "Note", descriere: null, tip: "text", scala_max: 0, pondere: null },
];

const SABLON_ACTIV = { id: SABLON, criterii: CRITERII, versiune: 7, activ: true };

const CAI = ["/evaluari", `/angajati/${ANGAJAT}`];

const intrareNoua = (extra: object = {}) => ({
  employee_id: ANGAJAT,
  template_id: SABLON,
  data_evaluarii: "2026-09-30",
  raspunsuri: [
    { criteriu_cod: "calitate", scor: 4, comentariu: "Constant" },
    { criteriu_cod: "disparut", scor: 3 },
    { criteriu_cod: "note", raspuns_text: "Merge bine" },
  ],
  concluzie: "Bun",
  ...extra,
});

describe("creeazaEvaluare", () => {
  const PERMIS = { "evaluations:create": "team" } as const;

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "evaluations:create": "own" },
    });
    const r = await creeazaEvaluare(intrareNoua());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: răspunsurile se aliniază la șablon și instantaneul criteriilor intră pe rând", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    server.raspunde("employee_evaluations", "insert", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });

    const r = await creeazaEvaluare(intrareNoua());

    expect(r).toEqual({ ok: true, data: { id: ID_1, employee_id: ANGAJAT } });
    const [sablon] = server.apeluriPe("evaluation_templates");
    expect(areFiltru(sablon, "eq", "id", SABLON)).toBe(true);
    expect(areFiltru(sablon, "is", "deleted_at", null)).toBe(true);

    const [apel] = server.apeluriPe("employee_evaluations", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ANGAJAT,
      template_id: SABLON,
      evaluator_id: USER_ID,
      data_evaluarii: "2026-09-30",
      // Codul necunoscut dispare; criteriul text nu poartă notă.
      raspunsuri: [
        { criteriu_cod: "calitate", scor: 4, raspuns_text: null, comentariu: "Constant" },
        { criteriu_cod: "note", scor: null, raspuns_text: "Merge bine", comentariu: null },
      ],
      criterii_sablon: CRITERII,
      versiune_sablon: 7,
      concluzie: "Bun",
      status: "draft",
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.selectDupaScriere).toBe("id, employee_id");
  });

  it("șablonul nu mai există: NEGASIT, fără INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: null });
    const r = await creeazaEvaluare(intrareNoua());
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("employee_evaluations")).toHaveLength(0);
  });

  it.each([
    ["șablon arhivat", { ...SABLON_ACTIV, activ: false }, /arhivat/u],
    ["șablon fără criterii", { ...SABLON_ACTIV, criterii: [] }, /niciun criteriu/u],
  ])("%s: CONFLICT, fără INSERT", async (_caz, sablon, mesaj) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: sablon });
    const r = await creeazaEvaluare(intrareNoua());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(mesaj);
    expect(server.apeluriPe("employee_evaluations")).toHaveLength(0);
  });

  it("nota peste scala criteriului: CONFLICT care numește criteriul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    const r = await creeazaEvaluare(
      intrareNoua({ raspunsuri: [{ criteriu_cod: "calitate", scor: 8 }] }),
    );
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("Calitate");
    expect(server.apeluriPe("employee_evaluations")).toHaveLength(0);
  });

  it("finalizată direct fără nicio notă: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    const r = await creeazaEvaluare(
      intrareNoua({
        status: "finalizat",
        raspunsuri: [{ criteriu_cod: "note", raspuns_text: "doar text" }],
      }),
    );
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employee_evaluations")).toHaveLength(0);
  });

  it("finalizată direct cu o notă: statusul cerut ajunge în bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    server.raspunde("employee_evaluations", "insert", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });
    await creeazaEvaluare(intrareNoua({ status: "finalizat" }));
    const [apel] = server.apeluriPe("employee_evaluations", "insert");
    expect(apel?.payload).toMatchObject({ status: "finalizat" });
  });

  it("succes: revalidează lista și fișa angajatului evaluat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    server.raspunde("employee_evaluations", "insert", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });
    await creeazaEvaluare(intrareNoua());
    expect(caiRevalidate()).toEqual(CAI);
  });
});

const EXISTENTA_DRAFT = {
  id: ID_1,
  employee_id: ANGAJAT,
  status: "draft",
  criterii_sablon: CRITERII,
  raspunsuri: [{ criteriu_cod: "calitate", scor: 3, raspuns_text: null, comentariu: null }],
};

describe("actualizeazaEvaluare", () => {
  const PERMIS = { "evaluations:update": "team" } as const;
  const intrare = (raspunsuri: unknown[] = [{ criteriu_cod: "calitate", scor: 5 }]) => ({
    id: ID_1,
    data_evaluarii: "2026-10-01",
    raspunsuri,
    concluzie: "",
  });

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "evaluations:update": "own" } });
    const r = await actualizeazaEvaluare(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: UPDATE doar pe ciornă, pe id + organizație, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: EXISTENTA_DRAFT });
    server.raspunde("employee_evaluations", "update", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });

    const r = await actualizeazaEvaluare(intrare());

    expect(r).toEqual({ ok: true, data: { id: ID_1, employee_id: ANGAJAT } });
    const [citire] = server.apeluriPe("employee_evaluations", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [apel] = server.apeluriPe("employee_evaluations", "update");
    expect(apel?.payload).toEqual({
      data_evaluarii: "2026-10-01",
      raspunsuri: [
        { criteriu_cod: "calitate", scor: 5, raspuns_text: null, comentariu: null },
        { criteriu_cod: "note", scor: null, raspuns_text: null, comentariu: null },
      ],
      concluzie: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, employee_id");
  });

  it("scala se verifică pe INSTANTANEUL evaluării, nu pe șablonul curent", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", {
      data: {
        ...EXISTENTA_DRAFT,
        criterii_sablon: [{ ...CRITERII[0], scala_max: 3 }],
      },
    });
    const r = await actualizeazaEvaluare(intrare([{ criteriu_cod: "calitate", scor: 4 }]));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employee_evaluations", "update")).toHaveLength(0);
    // Instantaneul e singura sursă: șablonul nu se citește deloc.
    expect(server.apeluriPe("evaluation_templates")).toHaveLength(0);
  });

  it("evaluarea nu mai există: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: null });
    const r = await actualizeazaEvaluare(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("evaluarea e finalizată: CONFLICT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", {
      data: { ...EXISTENTA_DRAFT, status: "finalizat" },
    });
    const r = await actualizeazaEvaluare(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employee_evaluations", "update")).toHaveLength(0);
  });

  it("zero rânduri (finalizată între timp): CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: EXISTENTA_DRAFT });
    server.raspunde("employee_evaluations", "update", { data: null });
    const r = await actualizeazaEvaluare(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează lista și fișa angajatului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: EXISTENTA_DRAFT });
    server.raspunde("employee_evaluations", "update", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });
    await actualizeazaEvaluare(intrare());
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("finalizeazaEvaluare", () => {
  const PERMIS = { "evaluations:update": "team" } as const;

  it("scope `own` sub pragul `team`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "evaluations:update": "own" } });
    const r = await finalizeazaEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: tranziția draft → finalizat, condiționată de status, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: EXISTENTA_DRAFT });
    server.raspunde("employee_evaluations", "update", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });

    const r = await finalizeazaEvaluare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1, employee_id: ANGAJAT } });
    const [citire] = server.apeluriPe("employee_evaluations", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    // O evaluare ștearsă soft nu se finalizează: UPDATE-ul nu filtrează `deleted_at`.
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [apel] = server.apeluriPe("employee_evaluations", "update");
    expect(apel?.payload).toEqual({ status: "finalizat", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, employee_id");
  });

  it("evaluarea nu mai există: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: null });
    const r = await finalizeazaEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it.each([
    ["era deja finalizată", { ...EXISTENTA_DRAFT, status: "finalizat" }],
    [
      "nicio notă dată",
      { ...EXISTENTA_DRAFT, raspunsuri: [{ criteriu_cod: "calitate", scor: null }] },
    ],
    ["răspunsuri stricate în jsonb", { ...EXISTENTA_DRAFT, raspunsuri: { nu: "listă" } }],
  ])("%s: CONFLICT, fără UPDATE", async (_caz, existenta) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: existenta });
    const r = await finalizeazaEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employee_evaluations", "update")).toHaveLength(0);
  });

  it("zero rânduri (finalizată de altcineva între timp): CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: EXISTENTA_DRAFT });
    server.raspunde("employee_evaluations", "update", { data: null });
    const r = await finalizeazaEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează lista și fișa angajatului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "select", { data: EXISTENTA_DRAFT });
    server.raspunde("employee_evaluations", "update", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });
    await finalizeazaEvaluare({ id: ID_1 });
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("redeschideEvaluare", () => {
  const PERMIS = { "evaluations:update": "all" } as const;

  it("managerul (scope `team`) nu poate redeschide: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "evaluations:update": "team" },
    });
    const r = await redeschideEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: tranziția finalizat → draft, condiționată de status, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "update", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });

    const r = await redeschideEvaluare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1, employee_id: ANGAJAT } });
    const [apel] = server.apeluriPe("employee_evaluations", "update");
    expect(apel?.payload).toEqual({ status: "draft", updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "finalizat")).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, employee_id");
  });

  it("zero rânduri (era deja ciornă): CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "update", { data: null });
    const r = await redeschideEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează lista și fișa angajatului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "update", {
      data: { id: ID_1, employee_id: ANGAJAT },
    });
    await redeschideEvaluare({ id: ID_1 });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("refuzul RLS la scriere (42501) iese INTERZIS, nu EROARE_INTERNA", async () => {
    // Același mecanism ca la șabloane: `throw mapPostgrestError(...)` aruncă un
    // obiect pe care `createAction` nu-l recunoaște ca eroare tradusă.
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_evaluations", "update", { error: eroarePostgrest("42501") });
    const r = await redeschideEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});

describe("planificaEvaluari", () => {
  const ALT = ID_1;
  const PERMIS_CREARE = { "evaluations:create": "all" } as const;
  const formular = (angajati: readonly string[]) => {
    const f = new FormData();
    f.set("template_id", SABLON);
    f.set("data_evaluarii", "2026-12-15");
    for (const id of angajati) f.append("employee_ids", id);
    return f;
  };

  it("fără `evaluations:create` la team: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "evaluations:create": "own" },
    });
    const r = await planificaEvaluari(formular([ANGAJAT]));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("niciun angajat bifat: VALIDARE pe `employee_ids`", async () => {
    configureazaActiunea({ permisiuni: PERMIS_CREARE });
    const r = await planificaEvaluari(formular([]));
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors?.["employee_ids"]).toBeDefined();
  });

  it("succes: o ciornă fără note per angajat, cu instantaneul; sare peste cine are deja ciornă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    server.raspunde("employee_evaluations", "select", { data: [{ employee_id: ALT }] });
    server.raspunde("employee_evaluations", "insert", { data: null });

    const r = await planificaEvaluari(formular([ANGAJAT, ALT]));

    expect(r).toEqual({ ok: true, data: { create: 1, sarite: 1 } });
    const [existente] = server.apeluriPe("employee_evaluations", "select");
    expect(areFiltru(existente, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(existente, "eq", "template_id", SABLON)).toBe(true);
    expect(areFiltru(existente, "eq", "status", "draft")).toBe(true);
    expect(areFiltru(existente, "is", "deleted_at", null)).toBe(true);

    const [insert] = server.apeluriPe("employee_evaluations", "insert");
    expect(insert?.payload).toEqual([
      {
        organization_id: ORG_ID,
        employee_id: ANGAJAT,
        template_id: SABLON,
        evaluator_id: USER_ID,
        data_evaluarii: "2026-12-15",
        // Câte un răspuns gol per criteriu: ciorna se deschide cu toate criteriile.
        raspunsuri: [
          { criteriu_cod: "calitate", scor: null, raspuns_text: null, comentariu: null },
          { criteriu_cod: "note", scor: null, raspuns_text: null, comentariu: null },
        ],
        criterii_sablon: CRITERII,
        versiune_sablon: 7,
        concluzie: null,
        status: "draft",
        created_by: USER_ID,
        updated_by: USER_ID,
      },
    ]);
    expect(caiRevalidate()).toEqual(["/evaluari"]);
  });

  it("un singur angajat bifat (FormData dă text, nu listă) merge la fel", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    server.raspunde("employee_evaluations", "select", { data: [] });
    server.raspunde("employee_evaluations", "insert", { data: null });

    const r = await planificaEvaluari(formular([ANGAJAT]));

    expect(r).toEqual({ ok: true, data: { create: 1, sarite: 0 } });
  });

  it("toți aveau deja ciornă: niciun INSERT, raportul spune câți au fost săriți", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    server.raspunde("employee_evaluations", "select", { data: [{ employee_id: ANGAJAT }] });

    const r = await planificaEvaluari(formular([ANGAJAT]));

    expect(r).toEqual({ ok: true, data: { create: 0, sarite: 1 } });
    expect(server.apeluriPe("employee_evaluations", "insert")).toHaveLength(0);
  });

  it("șablon arhivat între timp: CONFLICT, nimic scris", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("evaluation_templates", "select", {
      data: { ...SABLON_ACTIV, activ: false },
    });
    const r = await planificaEvaluari(formular([ANGAJAT]));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employee_evaluations", "insert")).toHaveLength(0);
  });

  it("un angajat din afara echipei respinge lotul (42501 din RLS): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CREARE });
    server.raspunde("evaluation_templates", "select", { data: SABLON_ACTIV });
    server.raspunde("employee_evaluations", "select", { data: [] });
    server.raspunde("employee_evaluations", "insert", { error: eroarePostgrest("42501") });
    const r = await planificaEvaluari(formular([ANGAJAT]));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});
