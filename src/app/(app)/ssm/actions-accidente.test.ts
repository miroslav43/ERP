// src/app/(app)/ssm/actions-accidente.test.ts
//
// Accidentele de muncă: înregistrarea, comunicarea la ITM și finalizarea
// cercetării. Cele două tranziții sunt UPDATE-uri pe care USING-ul politicii le
// poate respinge tăcut — de aceea `.select()` după scriere și NEGASIT pe gol.

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
import { comunicaAccidentLaItm, finalizeazaCercetare, inregistreazaAccident } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const CREARE = { "ssm:create": "team" } as const;
const ACTUALIZARE = { "ssm:update": "team" } as const;

const accident = {
  numar_intern: "AM-3/2026",
  employee_id: ID_2,
  data_producerii: "2026-09-20",
  ora_producerii: "10:15",
  locul: "Hala 2",
  imprejurari: "Alunecare pe pardoseala udă.",
  tip: "usor",
  zile_incapacitate: "4",
};

const comunicare = {
  id: ID_1,
  comunicat_la_itm_la: "2026-09-20T14:30",
  numar_proces_verbal: "PV-77",
};

const cercetare = {
  id: ID_1,
  cercetare_finalizata_la: "2026-09-25",
  urmari: "Revenire la lucru.",
  zile_incapacitate: "6",
};

describe("pragul de permisiune", () => {
  it.each([
    ["inregistreazaAccident", inregistreazaAccident, { "ssm:create": "own" }, accident],
    ["comunicaAccidentLaItm", comunicaAccidentLaItm, { "ssm:update": "own" }, comunicare],
    ["finalizeazaCercetare", finalizeazaCercetare, { "ssm:update": "own" }, cercetare],
  ] as const)(
    "%s: scope `own` sub pragul `team` ⇒ INTERZIS",
    async (_n, actiune, perm, intrare) => {
      const { server } = configureazaActiunea({ rol: "employee", permisiuni: perm });
      const r = await actiune(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("comunicarea la ITM cere `ssm:update`; `ssm:create` = all nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "ssm:create": "all" } });
    const r = await comunicaAccidentLaItm(comunicare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("inregistreazaAccident", () => {
  it("INSERT cu organizația din sesiune, fără termenul de comunicare (îl pune triggerul)", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("work_accidents", "insert", { data: { id: ID_1 } });

    const r = await inregistreazaAccident(accident);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("work_accidents");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      numar_intern: "AM-3/2026",
      tip: "usor",
      zile_incapacitate: 4,
      ora_producerii: "10:15",
    });
    expect(apel?.payload).not.toHaveProperty("termen_comunicare_ore");
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/accidente"]);
  });

  it("accident fără victimă nominală: `employee_id` gol devine null", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("work_accidents", "insert", { data: { id: ID_1 } });
    await inregistreazaAccident({ ...accident, employee_id: "", numar_intern: "" });
    const [apel] = server.apeluriPe("work_accidents");
    expect(apel?.payload).toMatchObject({ employee_id: null, numar_intern: null });
  });

  it("numărul intern duplicat: mesajul spune că accidentul există deja", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("work_accidents", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "work_accidents_uq"',
      ),
    });
    const r = await inregistreazaAccident(accident);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja un accident înregistrat cu acest număr intern.",
      },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("auditul nu poartă împrejurările (text liber), doar câmpurile din allow-list", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("work_accidents", "insert", { data: { id: ID_1 } });
    await inregistreazaAccident(accident);
    await asteaptaDupa();
    const [audit] = server.audituri();
    expect(audit).toMatchObject({ p_status: "success", p_entity_id: ID_1 });
    expect(audit?.p_after).not.toHaveProperty("imprejurari");
    expect(audit?.p_after).not.toHaveProperty("locul");
  });
});

describe("comunicaAccidentLaItm", () => {
  it("UPDATE doar pe cele două câmpuri, pe id + organizație, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: ACTUALIZARE });
    server.raspunde("work_accidents", "update", { data: { id: ID_1 } });

    const r = await comunicaAccidentLaItm(comunicare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("work_accidents");
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).toEqual({
      comunicat_la_itm_la: "2026-09-20T14:30",
      numar_proces_verbal: "PV-77",
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/accidente"]);
  });

  it("zero rânduri (accident invizibil sau inexistent): NEGASIT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("work_accidents", "update", { data: null });
    const r = await comunicaAccidentLaItm(comunicare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
    expect(server.audituri()).toEqual([
      expect.objectContaining({ p_status: "failure", p_error_code: "NEGASIT" }),
    ]);
  });

  it("P0001 (comunicare anterioară producerii): textul triggerului ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const mesaj = "Comunicarea către ITM nu poate fi anterioară producerii accidentului.";
    server.raspunde("work_accidents", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await comunicaAccidentLaItm(comunicare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("momentul comunicării cere dată și oră, nu doar dată", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    const r = await comunicaAccidentLaItm({ ...comunicare, comunicat_la_itm_la: "2026-09-20" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("finalizeazaCercetare", () => {
  it("UPDATE pe data finalizării, urmări și zile de incapacitate, pe id + organizație", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("work_accidents", "update", { data: { id: ID_1 } });

    const r = await finalizeazaCercetare(cercetare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("work_accidents");
    expect(apel?.payload).toEqual({
      cercetare_finalizata_la: "2026-09-25",
      urmari: "Revenire la lucru.",
      zile_incapacitate: 6,
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/accidente"]);
  });

  it("zero rânduri: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("work_accidents", "update", { data: null });
    const r = await finalizeazaCercetare(cercetare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("zile de incapacitate negative sau fracționare sunt refuzate înainte de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    for (const zile of ["-1", "2.5"]) {
      const r = await finalizeazaCercetare({ ...cercetare, zile_incapacitate: zile });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    }
    expect(server.apeluri).toHaveLength(0);
  });

  it("depășirea numerică (22003) primește mesajul modulului, nu eroare internă", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("work_accidents", "update", { error: eroarePostgrest("22003") });
    const r = await finalizeazaCercetare({ ...cercetare, id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).toContain("în afara intervalului acceptat");
  });
});
