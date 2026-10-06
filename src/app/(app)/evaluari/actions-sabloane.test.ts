// src/app/(app)/evaluari/actions-sabloane.test.ts
//
// Șabloanele evaluării anuale: creare, editare cu versiune, duplicare și
// perechea arhivare / reactivare. Straturile comune ale lui `createAction` sunt
// verificate o singură dată, în `src/app/(app)/salarizare/actions.test.ts`.

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
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaSablonEvaluare,
  arhiveazaSablonEvaluare,
  creeazaSablonEvaluare,
  duplicaSablonEvaluare,
  personalizeazaSablonEvaluare,
  reactiveazaSablonEvaluare,
  stergeSablonEvaluare,
} from "./actions";

const PERMIS = { "evaluations:update": "all" } as const;
const SUB_PRAG = { "evaluations:update": "team" } as const;
const CAI = ["/evaluari", "/evaluari/sabloane"];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

/** Criteriul așa cum ajunge în bază după `pregatesteCriterii`. */
const criteriuScris = (cod: string, denumire: string, extra: object = {}) => ({
  cod,
  denumire,
  descriere: null,
  tip: "scala",
  scala_max: 5,
  pondere: null,
  ...extra,
});

describe("creeazaSablonEvaluare", () => {
  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: SUB_PRAG });
    const r = await creeazaSablonEvaluare({
      denumire: "Anual",
      criterii: [{ denumire: "Calitate" }],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: INSERT în firma activă, versiunea 1, coduri unice generate din denumiri", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "insert", { data: { id: ID_1 } });

    const r = await creeazaSablonEvaluare({
      denumire: "Evaluare anuală",
      descriere: "",
      criterii: JSON.stringify([
        { denumire: "Lucru în echipă" },
        // Altă denumire, același slug: al doilea primește sufix, nu cod duplicat.
        { denumire: "Lucru in echipa" },
        { denumire: "Punctualitate", tip: "da_nu", scala_max: 10 },
        { denumire: "Observații", tip: "text", pondere: 30 },
      ]),
    });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("evaluation_templates", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      denumire: "Evaluare anuală",
      descriere: null,
      criterii: [
        criteriuScris("lucru_in_echipa", "Lucru în echipă"),
        criteriuScris("lucru_in_echipa_2", "Lucru in echipa"),
        criteriuScris("punctualitate", "Punctualitate", { tip: "da_nu", scala_max: 1 }),
        criteriuScris("observatii", "Observații", { tip: "text", scala_max: 0 }),
      ],
      versiune: 1,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(apel?.selectDupaScriere).toBe("id");
  });

  it("ponderi parțiale (una pusă, alta nu): VALIDARE înaintea oricărei scrieri", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaSablonEvaluare({
      denumire: "Ponderat",
      criterii: [
        { denumire: "Calitate", pondere: 40 },
        { denumire: "Viteză", pondere: null },
      ],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("ponderi care nu însumează 100: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaSablonEvaluare({
      denumire: "Ponderat",
      criterii: [
        { denumire: "Calitate", pondere: 40 },
        { denumire: "Viteză", pondere: 40 },
      ],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });

  it("succes: auditul are id-ul nou și nu conține criteriile", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "insert", { data: { id: ID_1 } });
    await creeazaSablonEvaluare({ denumire: "Anual", criterii: [{ denumire: "Calitate" }] });
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_id: ID_1,
        p_after: { denumire: "Anual", descriere: null },
      }),
    ]);
  });

  it("succes: revalidează lista și pagina de șabloane", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "insert", { data: { id: ID_1 } });
    await creeazaSablonEvaluare({ denumire: "Anual", criterii: [{ denumire: "Calitate" }] });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("o eroare Postgres (23505) iese CONFLICT, nu EROARE_INTERNA", async () => {
    // `throw mapPostgrestError(...)` aruncă un `ActionError` simplu, care nu e
    // nici `ActionDenied`, nici PostgrestError (n-are `details`) — deci
    // `createAction` îl coboară la EROARE_INTERNA și mesajul tradus se pierde.
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "insert", { error: eroarePostgrest("23505") });
    const r = await creeazaSablonEvaluare({
      denumire: "Anual",
      criterii: [{ denumire: "Calitate" }],
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("actualizeazaSablonEvaluare", () => {
  const EXISTENT = {
    id: ID_1,
    denumire: "Anual",
    criterii: [criteriuScris("calitate", "Calitate")],
    versiune: 3,
    activ: true,
    organization_id: ORG_ID,
  };
  const intrare = (criterii: unknown[]) => ({
    id: ID_1,
    denumire: "Anual 2026",
    descriere: "Pentru tot personalul",
    criterii,
  });

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: SUB_PRAG });
    const r = await actualizeazaSablonEvaluare(intrare([{ denumire: "Calitate" }]));
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("criterii neschimbate: versiunea rămâne, UPDATE pe id + organizație cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: EXISTENT });
    server.raspunde("evaluation_templates", "update", { data: { id: ID_1, versiune: 3 } });

    const r = await actualizeazaSablonEvaluare(
      intrare([{ cod: "calitate", denumire: "Calitate" }]),
    );

    expect(r).toEqual({ ok: true, data: { id: ID_1, versiune: 3 } });
    const [citire] = server.apeluriPe("evaluation_templates", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [apel] = server.apeluriPe("evaluation_templates", "update");
    expect(apel?.payload).toEqual({
      denumire: "Anual 2026",
      descriere: "Pentru tot personalul",
      criterii: [criteriuScris("calitate", "Calitate")],
      versiune: 3,
      updated_by: USER_ID,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id, versiune");
  });

  it("criterii schimbate: versiunea crește cu unu, iar codul existent se păstrează la redenumire", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: EXISTENT });
    server.raspunde("evaluation_templates", "update", { data: { id: ID_1, versiune: 4 } });

    await actualizeazaSablonEvaluare(
      intrare([{ cod: "calitate", denumire: "Calitatea lucrului" }, { denumire: "Inițiativă" }]),
    );

    const [apel] = server.apeluriPe("evaluation_templates", "update");
    expect(apel?.payload).toMatchObject({
      versiune: 4,
      criterii: [
        criteriuScris("calitate", "Calitatea lucrului"),
        criteriuScris("initiativa", "Inițiativă"),
      ],
    });
  });

  it("șablonul nu mai există: NEGASIT, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: null });
    const r = await actualizeazaSablonEvaluare(intrare([{ denumire: "Calitate" }]));
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("evaluation_templates", "update")).toHaveLength(0);
  });

  it("șablon de platformă: CONFLICT cu îndrumare spre duplicare, fără UPDATE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", {
      data: { ...EXISTENT, organization_id: null },
    });
    const r = await actualizeazaSablonEvaluare(intrare([{ denumire: "Calitate" }]));
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/Duplicați/u);
    expect(server.apeluriPe("evaluation_templates", "update")).toHaveLength(0);
  });

  it("zero rânduri afectate: CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: EXISTENT });
    server.raspunde("evaluation_templates", "update", { data: null });
    const r = await actualizeazaSablonEvaluare(
      intrare([{ cod: "calitate", denumire: "Calitate" }]),
    );
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează lista și pagina de șabloane", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: EXISTENT });
    server.raspunde("evaluation_templates", "update", { data: { id: ID_1, versiune: 3 } });
    await actualizeazaSablonEvaluare(intrare([{ cod: "calitate", denumire: "Calitate" }]));
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("duplicaSablonEvaluare", () => {
  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: SUB_PRAG });
    const r = await duplicaSablonEvaluare({ id: ID_1, denumire: "Copie" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("copia unui șablon de platformă intră în firma activă, cu forma veche a criteriilor ridicată", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", {
      data: {
        id: ID_1,
        denumire: "Model platformă",
        descriere: "Generic",
        // Forma din 0038: fără `tip`, `descriere`, `pondere`.
        criterii: [{ cod: "comunicare", denumire: "Comunicare", scala_max: 10 }],
      },
    });
    server.raspunde("evaluation_templates", "insert", { data: { id: ID_2 } });

    const r = await duplicaSablonEvaluare({ id: ID_1, denumire: "Modelul nostru" });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [citire] = server.apeluriPe("evaluation_templates", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [apel] = server.apeluriPe("evaluation_templates", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      denumire: "Modelul nostru",
      descriere: "Generic",
      criterii: [criteriuScris("comunicare", "Comunicare", { scala_max: 10 })],
      versiune: 1,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
  });

  it("sursa nu mai există: NEGASIT, fără INSERT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", { data: null });
    const r = await duplicaSablonEvaluare({ id: ID_1, denumire: "Copie" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("evaluation_templates", "insert")).toHaveLength(0);
  });

  it("succes: revalidează lista și pagina de șabloane", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "select", {
      data: { id: ID_1, denumire: "X", descriere: null, criterii: [] },
    });
    server.raspunde("evaluation_templates", "insert", { data: { id: ID_2 } });
    await duplicaSablonEvaluare({ id: ID_1, denumire: "Copie" });
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe.each([
  {
    nume: "arhiveazaSablonEvaluare",
    actiune: arhiveazaSablonEvaluare,
    activNou: false,
    mesaj: /arhivat/u,
  },
  {
    nume: "reactiveazaSablonEvaluare",
    actiune: reactiveazaSablonEvaluare,
    activNou: true,
    mesaj: /reactivat/u,
  },
])("$nume", ({ actiune, activNou, mesaj }) => {
  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: SUB_PRAG });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: UPDATE condiționat de starea opusă, pe id + organizație, cu `.select()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "update", { data: { id: ID_1 } });

    const r = await actiune({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("evaluation_templates", "update");
    expect(apel?.payload).toEqual({ activ: activNou, updated_by: USER_ID });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "activ", !activNou)).toBe(true);
    expect(apel?.selectDupaScriere).toBe("id");
  });

  it("zero rânduri (era deja în starea cerută): CONFLICT cu mesajul tranziției", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "update", { data: null });
    const r = await actiune({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(mesaj);
    expect(caiRevalidate()).toEqual([]);
  });

  it("succes: revalidează lista și pagina de șabloane", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "update", { data: { id: ID_1 } });
    await actiune({ id: ID_1 });
    expect(caiRevalidate()).toEqual(CAI);
  });
});

describe("stergeSablonEvaluare", () => {
  it("scope `team` sub pragul `all`: INTERZIS, fără niciun apel la bază", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: SUB_PRAG });
    const r = await stergeSablonEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriRpc.filter((a) => a.nume === "sterge_sablon_evaluare")).toHaveLength(0);
  });

  it("succes: cheamă funcția cu organizația din context, nu cu una venită de la client", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("sterge_sablon_evaluare", { data: ID_1 });

    const r = await stergeSablonEvaluare({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const apel = server.apeluriRpc.find((a) => a.nume === "sterge_sablon_evaluare");
    expect(apel?.argumente).toEqual({ p_organization_id: ORG_ID, p_id: ID_1 });
    // Nu un UPDATE direct: politica SELECT l-ar respinge mereu cu 42501 (0162).
    expect(server.apeluriPe("evaluation_templates", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("șablon folosit (P0001): mesajul funcției ajunge neschimbat la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj =
      "Șablonul este folosit de 2 evaluări, deci nu poate fi șters. Arhivați-l: evaluările făcute pe el rămân neatinse.";
    server.raspundeRpc("sterge_sablon_evaluare", { error: eroarePostgrest("P0001", mesaj) });

    const r = await stergeSablonEvaluare({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("șablon inexistent sau de platformă (P0002): NEGASIT cu mesajul funcției", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Șablonul nu mai există sau nu poate fi șters.";
    server.raspundeRpc("sterge_sablon_evaluare", { error: eroarePostgrest("P0002", mesaj) });

    const r = await stergeSablonEvaluare({ id: ID_2 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT", message: mesaj } });
  });

  it("refuz de drept din bază (42501): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("sterge_sablon_evaluare", { error: eroarePostgrest("42501") });
    const r = await stergeSablonEvaluare({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
  });
});

describe("personalizeazaSablonEvaluare", () => {
  const intrare = () => ({
    sablon_platforma_id: ID_2,
    denumire: "Evaluare anuală standard",
    descriere: "",
    criterii: JSON.stringify([{ denumire: "Calitatea muncii" }]),
  });

  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: SUB_PRAG });
    const r = await personalizeazaSablonEvaluare(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: un singur INSERT, varianta firmei cu `derivat_din` = șablonul de platformă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "insert", { data: { id: ID_1 } });

    const r = await personalizeazaSablonEvaluare(intrare());

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    // Nimic înainte de salvare: niciun duplicat creat la deschiderea editorului.
    const apeluri = server.apeluriPe("evaluation_templates");
    expect(apeluri.map((a) => a.operatie)).toEqual(["insert"]);
    expect(apeluri[0]?.payload).toMatchObject({
      organization_id: ORG_ID,
      derivat_din: ID_2,
      denumire: "Evaluare anuală standard",
      versiune: 1,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("firma are deja o variantă (23505): CONFLICT care spune ce să facă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "insert", { error: eroarePostgrest("23505") });
    const r = await personalizeazaSablonEvaluare(intrare());
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toMatch(/deja propria variantă/u);
  });

  it("origine care nu e șablon de platformă (P0001 din trigger): mesajul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("evaluation_templates", "insert", {
      error: eroarePostgrest("P0001", "Se poate personaliza doar un șablon de platformă."),
    });
    const r = await personalizeazaSablonEvaluare(intrare());
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Se poate personaliza doar un șablon de platformă." },
    });
  });
});
