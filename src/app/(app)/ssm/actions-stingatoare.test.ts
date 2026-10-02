// src/app/(app)/ssm/actions-stingatoare.test.ts
//
// Stingătoarele (PSI): adăugarea, editarea și verificările periodice.
// Scadențele le rescrie triggerul la fiecare scriere — acțiunile nu au voie să
// le trimită, iar verificarea nu face un al doilea UPDATE pe stingător.

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

import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaStingator,
  adaugaStingator,
  inregistreazaVerificareStingator,
} from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const CREARE = { "ssm:create": "team" } as const;
const ACTUALIZARE = { "ssm:update": "team" } as const;

const stingator = {
  cod: "ST-01",
  tip: "P6",
  masa_kg: "6",
  cladire: "Corp A",
  locatie: "Hol etaj 1",
  ultima_verificare: "2026-03-01",
};

const verificare = {
  extinguisher_id: ID_1,
  tip_verificare: "reincarcare",
  data: "2026-09-01",
  firma_autorizata: "PSI Expert SRL",
  cost: "80",
};

const SCADENTE = ["scadenta_verificare", "scadenta_reincarcare", "scadenta_proba_presiune"];

describe("pragul de permisiune", () => {
  it.each([
    ["adaugaStingator", adaugaStingator, { "ssm:create": "own" }, stingator],
    [
      "actualizeazaStingator",
      actualizeazaStingator,
      { "ssm:update": "own" },
      { ...stingator, id: ID_1 },
    ],
    [
      "inregistreazaVerificareStingator",
      inregistreazaVerificareStingator,
      { "ssm:create": "own" },
      verificare,
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

  it("editarea cere `ssm:update`, nu `ssm:create`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "ssm:create": "all" } });
    const r = await actualizeazaStingator({ ...stingator, id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("adaugaStingator", () => {
  it("INSERT cu organizația din sesiune, status implicit activ, fără scadențe trimise", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: CREARE });
    server.raspunde("fire_extinguishers", "insert", { data: { id: ID_2 } });

    const r = await adaugaStingator(stingator);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("fire_extinguishers");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      cod: "ST-01",
      masa_kg: 6,
      status: "activ",
      ultima_verificare: "2026-03-01",
      ultima_reincarcare: null,
    });
    for (const coloana of SCADENTE) expect(apel?.payload).not.toHaveProperty(coloana);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/stingatoare"]);
  });

  it("cod duplicat în organizație: mesajul numește stingătorul", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("fire_extinguishers", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fire_extinguishers_uq"',
      ),
    });
    const r = await adaugaStingator(stingator);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Există deja un stingător cu acest cod în organizație." },
    });
  });

  it("masa în afara intervalului 0,1–200 kg e refuzată de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await adaugaStingator({ ...stingator, masa_kg: "0" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("masa_kg");
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaStingator", () => {
  it("UPDATE fără id în payload, pe id + organizație, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("fire_extinguishers", "update", { data: { id: ID_1 } });

    const r = await actualizeazaStingator({ ...stingator, id: ID_1, status: "in_service" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("fire_extinguishers");
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).not.toHaveProperty("organization_id");
    expect(apel?.payload).toMatchObject({ cod: "ST-01", status: "in_service" });
    for (const coloana of SCADENTE) expect(apel?.payload).not.toHaveProperty(coloana);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(apel?.terminal).toBe("maybeSingle");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/stingatoare"]);
  });

  it("zero rânduri: NEGASIT, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("fire_extinguishers", "update", { data: null });
    const r = await actualizeazaStingator({ ...stingator, id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("codul mutat peste al altui stingător: CONFLICT cu mesajul de cod duplicat", async () => {
    const { server } = configureazaActiunea({ permisiuni: ACTUALIZARE });
    server.raspunde("fire_extinguishers", "update", {
      error: eroarePostgrest("23505", "fire_extinguishers_uq"),
    });
    const r = await actualizeazaStingator({ ...stingator, id: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Există deja un stingător cu acest cod în organizație." },
    });
  });
});

describe("inregistreazaVerificareStingator", () => {
  it("INSERT doar în verificări — niciun UPDATE pe stingător din acțiune", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("fire_extinguisher_checks", "insert", { data: { id: ID_2 } });

    const r = await inregistreazaVerificareStingator(verificare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [apel] = server.apeluriPe("fire_extinguisher_checks");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      extinguisher_id: ID_1,
      tip_verificare: "reincarcare",
      rezultat: "conform",
      cost: 80,
    });
    expect(server.apeluriPe("fire_extinguishers")).toHaveLength(0);
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/ssm", "/ssm/stingatoare"]);
  });

  it("stingător inexistent (23503): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("fire_extinguisher_checks", "insert", { error: eroarePostgrest("23503") });
    const r = await inregistreazaVerificareStingator(verificare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("tip de verificare necunoscut e refuzat de schemă", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    const r = await inregistreazaVerificareStingator({ ...verificare, tip_verificare: "revizie" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});
