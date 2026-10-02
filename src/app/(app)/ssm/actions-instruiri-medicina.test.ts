// src/app/(app)/ssm/actions-instruiri-medicina.test.ts
//
// Acțiunile SSM pe instruiri și medicina muncii: înregistrarea în bloc a unei
// instruiri, fișa de aptitudine (art. 9 GDPR în audit) și nomenclatorul de
// tipuri citit cu clientul admin pentru dosarul propriu.
//
// Straturile comune (sesiune, organizație, modul, Zod generic) sunt verificate
// o singură dată în `salarizare/actions.test.ts`.

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
  ID_3,
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { adaugaFisaAptitudine, inregistreazaInstruireBloc, nomenclatorInstruiri } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const CREARE = { "ssm:create": "team" } as const;

const instruire = {
  training_type_id: ID_1,
  data_instruirii: "2026-09-15",
  durata_ore: "2",
  employee_ids: [ID_2, ID_3],
};

const fisa = {
  employee_id: ID_2,
  tip: "periodic",
  data_examinarii: "2026-09-10",
  medic: "Dr. Ionescu",
  unitate_medicala: "Clinica Sănătatea",
  rezultat: "apt_conditionat",
  valabil_pana: "2027-09-10",
  numar_fisa: "F-12",
  cost: "150",
};

describe("pragul de permisiune", () => {
  it.each([
    ["inregistreazaInstruireBloc", inregistreazaInstruireBloc, instruire],
    ["adaugaFisaAptitudine", adaugaFisaAptitudine, fisa],
  ] as const)(
    "%s: `ssm:create` doar pe propriul dosar (own < team) ⇒ INTERZIS, fără nicio interogare",
    async (_nume, actiune, intrare) => {
      const { server } = configureazaActiunea({
        rol: "employee",
        permisiuni: { "ssm:create": "own" },
      });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it.each([
    ["inregistreazaInstruireBloc", inregistreazaInstruireBloc, instruire],
    ["adaugaFisaAptitudine", adaugaFisaAptitudine, fisa],
  ] as const)(
    "%s: `ssm:update` = all nu ține loc de `ssm:create`",
    async (_n, actiune, intrare) => {
      const { server } = configureazaActiunea({ permisiuni: { "ssm:update": "all" } });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("nomenclatorInstruiri: fără `ssm:read` ⇒ INTERZIS, iar clientul admin nu e atins", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: {} });
    const r = await nomenclatorInstruiri({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });
});

describe("inregistreazaInstruireBloc", () => {
  it("un singur INSERT cu câte un rând per angajat, organizația din sesiune, fără scadență trimisă", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("ssm_trainings", "insert", { data: [{ id: ID_1 }, { id: ID_2 }] });

    const r = await inregistreazaInstruireBloc({
      ...instruire,
      lector_extern: "  SC Formare SRL ",
    });

    expect(r).toEqual({ ok: true, data: { ids: [ID_1, ID_2] } });
    const apeluri = server.apeluriPe("ssm_trainings");
    expect(apeluri).toHaveLength(1);
    const [apel] = apeluri;
    expect(apel?.operatie).toBe("insert");
    const randuri = apel?.payload as Record<string, unknown>[];
    expect(randuri).toHaveLength(2);
    expect(randuri.map((x) => x.employee_id)).toEqual([ID_2, ID_3]);
    for (const rand of randuri) {
      expect(rand).toMatchObject({
        organization_id: ORG_ID,
        training_type_id: ID_1,
        data_instruirii: "2026-09-15",
        durata_ore: 2,
        lector_extern: "SC Formare SRL",
        lector_employee_id: null,
      });
      // Triggerul `ssm_training_calc` calculează scadența DOAR când primește null.
      expect(rand).not.toHaveProperty("urmatoarea_scadenta");
    }
    expect(apel?.selectDupaScriere).toBe("id");
  });

  it("revalidează panoul SSM și matricea de instruiri", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("ssm_trainings", "insert", { data: [{ id: ID_1 }] });
    await inregistreazaInstruireBloc(instruire);
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/instruiri"]);
  });

  it("lista de angajați goală e refuzată de schemă, înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await inregistreazaInstruireBloc({ ...instruire, employee_ids: [] });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("employee_ids");
    expect(server.apeluri).toHaveLength(0);
  });

  it("P0001 din trigger (dată în viitor): mesajul triggerului ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const mesaj = "Data instruirii nu poate fi în viitor.";
    server.raspunde("ssm_trainings", "insert", { error: eroarePostgrest("P0001", mesaj) });

    const r = await inregistreazaInstruireBloc(instruire);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("auditul de lot păstrează lista de angajați, fără tematică sau observații", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("ssm_trainings", "insert", { data: [{ id: ID_1 }, { id: ID_2 }] });

    await inregistreazaInstruireBloc({
      ...instruire,
      tematica: "Lucru la înălțime",
      observatii: "x",
    });
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: null });
    expect(audit?.p_after).toMatchObject({ employee_ids: [ID_2, ID_3], training_type_id: ID_1 });
    expect(audit?.p_after).not.toHaveProperty("tematica");
    expect(audit?.p_after).not.toHaveProperty("observatii");
  });
});

describe("adaugaFisaAptitudine", () => {
  it("INSERT cu organizația din sesiune și întoarce id-ul fișei", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("occupational_health_exams", "insert", { data: { id: ID_3 } });

    const r = await adaugaFisaAptitudine(fisa);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel] = server.apeluriPe("occupational_health_exams");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_2,
      rezultat: "apt_conditionat",
      cost: 150,
    });
    // Restricția de muncă o scrie triggerul AFTER, nu acțiunea.
    expect(server.apeluriPe("employee_work_restrictions")).toHaveLength(0);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(apel?.terminal).toBe("single");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/medicina-muncii"]);
  });

  it("organizația nu poate veni din intrare: e mereu cea din sesiune", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("occupational_health_exams", "insert", { data: { id: ID_3 } });
    await adaugaFisaAptitudine({ ...fisa, organization_id: ID_1 });
    const [apel] = server.apeluriPe("occupational_health_exams");
    expect((apel?.payload as Record<string, unknown>).organization_id).toBe(ORG_ID);
  });

  it("art. 9 GDPR: rezultatul, medicul, unitatea și costul nu intră în jurnalul de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("occupational_health_exams", "insert", { data: { id: ID_3 } });

    await adaugaFisaAptitudine(fisa);
    await asteaptaDupa();

    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: ID_3 });
    expect(audit?.p_after).toEqual({
      employee_id: ID_2,
      tip: "periodic",
      data_examinarii: "2026-09-10",
      valabil_pana: "2027-09-10",
      numar_fisa: "F-12",
    });
  });

  it("art. 9 GDPR și pe calea de eșec: fișa respinsă nu scapă rezultatul în audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("occupational_health_exams", "insert", { error: eroarePostgrest("42501") });

    const r = await adaugaFisaAptitudine(fisa);

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "denied" });
    expect(audit?.p_after).not.toHaveProperty("rezultat");
    expect(audit?.p_after).not.toHaveProperty("medic");
  });

  it("23505 generic: CONFLICT cu mesajul de duplicat", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("occupational_health_exams", "insert", {
      error: eroarePostgrest("23505", 'duplicate key value violates "ceva_uq"'),
    });
    const r = await adaugaFisaAptitudine(fisa);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Există deja o înregistrare cu aceste date." },
    });
  });
});

describe("nomenclatorInstruiri", () => {
  it("scope `own` ajunge: citește cu clientul admin, filtrat explicit pe organizație, activ și nesters", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "ssm:read": "own" },
    });
    const tipuri = [
      { id: ID_1, cod: "IG", denumire: "Instruire generală", domeniu: "ssm", obligatoriu: true },
    ];
    admin.raspunde("ssm_training_types", "select", { data: tipuri });

    const r = await nomenclatorInstruiri({});

    expect(r).toEqual({ ok: true, data: tipuri });
    expect(server.apeluriPe("ssm_training_types")).toHaveLength(0);
    const [apel] = admin.apeluriPe("ssm_training_types");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("nu revalidează nimic: e chemată din randarea unui Server Component", async () => {
    const { admin } = configureazaActiunea({ permisiuni: { "ssm:read": "own" } });
    admin.raspunde("ssm_training_types", "select", { data: [] });
    const r = await nomenclatorInstruiri({});
    expect(r).toEqual({ ok: true, data: [] });
    expect(caiRevalidate()).toEqual([]);
  });

  it("data null din bază devine listă goală, nu null", async () => {
    const { admin } = configureazaActiunea({ permisiuni: { "ssm:read": "own" } });
    admin.raspunde("ssm_training_types", "select", { data: null });
    const r = await nomenclatorInstruiri({});
    expect(r).toEqual({ ok: true, data: [] });
  });

  it("o eroare a bazei iese tradusă, nu ca listă goală", async () => {
    const { admin } = configureazaActiunea({ permisiuni: { "ssm:read": "own" } });
    admin.raspunde("ssm_training_types", "select", { error: eroarePostgrest("57014") });
    const r = await nomenclatorInstruiri({});
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
  });
});
