// src/app/(app)/concedii/actions-decizie.test.ts
//
// `decideCerere`: decizia unui aprobator pe o sarcină din lanț. Trei ramuri —
// respingere, aprobare pe ultimul pas, aprobare cu pași rămași — și trei
// locuri în care un UPDATE poate fi respins tăcut de `USING`.

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

const colaboratori = vi.hoisted(() => ({
  sincronizeazaZileleDeConcediu: vi.fn(),
  declaraSuspendareaContractului: vi.fn(),
}));
vi.mock("@/app/(app)/pontaj/sincronizare-concediu", () => ({
  sincronizeazaZileleDeConcediu: colaboratori.sincronizeazaZileleDeConcediu,
}));
vi.mock("./suspendare-contract", () => ({
  declaraSuspendareaContractului: colaboratori.declaraSuspendareaContractului,
}));

import {
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { decideCerere } from "./actions";

const SARCINA = ID_1;
const CERERE = ID_2;
const FISA_APROBATOR = ID_3;
const ANGAJAT = "88888888-8888-4888-8888-888888888888";
const ACUM = new Date("2026-07-01T09:30:00Z");

const PERMIS = { "leave:approve": "team" } as const;
const NIMIC_DE_DECLARAT = { ceruta: false, declarata: false, termen: null, motiv: null };
const SUSPENDARE = {
  ceruta: true,
  declarata: false,
  termen: "2026-07-05",
  motiv: "Fișa nu are contract activ.",
};

const aprobare = { taskId: SARCINA, decizie: "aprobata", comentariu: "De acord." };
const respingere = {
  taskId: SARCINA,
  decizie: "respinsa",
  motivRespingere: "Perioadă aglomerată în proiect.",
};

/** Sarcina deschisă, fișa aprobatorului, decizia pe sarcină și numărătoarea pașilor rămași. */
function inceput(server: ClientFals, admin: ClientFals, ramase = 0) {
  server.raspunde("approval_tasks", "select", { data: { id: SARCINA, entity_id: CERERE } });
  admin.raspunde("employees", "select", { data: { id: FISA_APROBATOR } });
  server.raspunde("approval_tasks", "update", { data: { id: SARCINA } });
  admin.raspunde("approval_tasks", "select", { count: ramase });
}

/** Ce citește sincronizarea cu pontajul după aprobarea finală. */
function sincronizare(admin: ClientFals) {
  admin.raspunde("leave_requests", "select", {
    data: { employee_id: ANGAJAT, tip: { tip_zi_pontaj: "medical" } },
  });
  admin.raspunde("employees", "select", { data: { user_id: null } });
  admin.raspunde("leave_request_days", "select", {
    data: [{ data: "2026-07-06", leave_request_id: CERERE }],
  });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ACUM);
  colaboratori.sincronizeazaZileleDeConcediu
    .mockReset()
    .mockResolvedValue({ create: 1, actualizate: 0, inlocuite: 0, pastrate: 0 });
  colaboratori.declaraSuspendareaContractului.mockReset().mockResolvedValue(SUSPENDARE);
  return () => vi.useRealTimers();
});

describe("decideCerere — autorizare și sarcina", () => {
  it("scope `own` (sub pragul `team`): INTERZIS, fără nicio interogare", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "leave:approve": "own" },
    });
    const r = await decideCerere(aprobare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("respingere cu motiv prea scurt: VALIDARE pe `motivRespingere`", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    const r = await decideCerere({ taskId: SARCINA, decizie: "respinsa", motivRespingere: "nu" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("motivRespingere");
    expect(server.apeluri).toHaveLength(0);
  });

  it("sarcina nu e a lui sau e deja rezolvată (invizibilă): NEGASIT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("approval_tasks", "select", { data: null });
    const r = await decideCerere(aprobare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    const [citire] = server.apeluriPe("approval_tasks", "select");
    expect(areFiltru(citire, "eq", "id", SARCINA)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "entity_type", "leave_request")).toBe(true);
    expect(areFiltru(citire, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("eroare la citirea sarcinii: EROARE_INTERNA, nu „sarcina nu a fost găsită”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("approval_tasks", "select", { error: eroarePostgrest("57014") });
    const r = await decideCerere(aprobare);
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(admin.apeluri).toHaveLength(0);
    expect(server.apeluriPe("approval_tasks", "update")).toHaveLength(0);
  });

  it("eroare la citirea fișei aprobatorului: EROARE_INTERNA, nu „fără fișă”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("approval_tasks", "select", { data: { id: SARCINA, entity_id: CERERE } });
    admin.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    const r = await decideCerere(aprobare);
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("approval_tasks", "update")).toHaveLength(0);
  });

  it("aprobator fără fișă principală de angajat: CONFLICT explicat, nu INTERZIS opac", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("approval_tasks", "select", { data: { id: SARCINA, entity_id: CERERE } });
    admin.raspunde("employees", "select", { data: null });
    const r = await decideCerere(aprobare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("fișă de angajat principală") },
    });
    const [fisa] = admin.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("approval_tasks", "update")).toHaveLength(0);
  });

  it("sarcina respinsă tăcut de `USING` (zero rânduri): CONFLICT, cererea nu se atinge", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("approval_tasks", "select", { data: { id: SARCINA, entity_id: CERERE } });
    admin.raspunde("employees", "select", { data: { id: FISA_APROBATOR } });
    server.raspunde("approval_tasks", "update", { data: null });
    const r = await decideCerere(aprobare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Reîncărcați lista") },
    });
    expect(server.apeluriPe("leave_requests")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 la decizia pe sarcină: CONFLICT cu textul triggerului", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("approval_tasks", "select", { data: { id: SARCINA, entity_id: CERERE } });
    admin.raspunde("employees", "select", { data: { id: FISA_APROBATOR } });
    const mesaj = "Sarcina a expirat.";
    server.raspunde("approval_tasks", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await decideCerere(aprobare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("decideCerere — aprobare pe ultimul pas", () => {
  it("sarcina primește decizia și momentul; cererea trece pe `aprobata` cu `.select()`", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    sincronizare(admin);

    const r = await decideCerere(aprobare);

    expect(r).toEqual({
      ok: true,
      data: { id: CERERE, zileInlocuite: 0, suspendare: SUSPENDARE },
    });

    const [sarcina] = server.apeluriPe("approval_tasks", "update");
    expect(sarcina?.payload).toEqual({
      status: "aprobata",
      comentariu: "De acord.",
      decis_la: ACUM.toISOString(),
    });
    expect(areFiltru(sarcina, "eq", "id", SARCINA)).toBe(true);
    expect(areFiltru(sarcina, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(sarcina?.selectDupaScriere).toBeDefined();

    const [ramase] = admin.apeluriPe("approval_tasks", "select");
    expect(ramase?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(ramase, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(ramase, "eq", "entity_type", "leave_request")).toBe(true);
    expect(areFiltru(ramase, "eq", "entity_id", CERERE)).toBe(true);
    expect(areFiltru(ramase, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(ramase, "is", "deleted_at", null)).toBe(true);

    const [cerere] = server.apeluriPe("leave_requests", "update");
    expect(cerere?.payload).toEqual({ status: "aprobata", decis_de: USER_ID });
    expect(areFiltru(cerere, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(cerere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(cerere?.selectDupaScriere).toBeDefined();
  });

  it("zilele aprobate intră în pontaj cu tipul lor, iar suspendarea se declară", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    sincronizare(admin);

    await decideCerere(aprobare);

    expect(colaboratori.sincronizeazaZileleDeConcediu).toHaveBeenCalledWith(admin.client, ORG_ID, [
      { employee_id: ANGAJAT, data: "2026-07-06", leave_request_id: CERERE, tip_zi: "medical" },
    ]);
    expect(colaboratori.declaraSuspendareaContractului).toHaveBeenCalledWith(
      admin.client,
      ORG_ID,
      CERERE,
      USER_ID,
      expect.any(String),
    );
    const [citire] = admin.apeluriPe("leave_requests", "select");
    expect(areFiltru(citire, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    // Clientul de serviciu nu filtrează nimic prin RLS: filtrele sunt tot ce
    // ține zilele altor cereri departe de pontajul acestui angajat.
    const [zile] = admin.apeluriPe("leave_request_days");
    expect(areFiltru(zile, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(zile, "eq", "leave_request_id", CERERE)).toBe(true);
    expect(areFiltru(zile, "eq", "este_lucratoare", true)).toBe(true);
    // [0] e fișa aprobatorului; [1] e contul angajatului, pentru notificare.
    const angajat = admin.apeluriPe("employees", "select")[1];
    expect(areFiltru(angajat, "eq", "id", ANGAJAT)).toBe(true);
    expect(areFiltru(angajat, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("zile pontate trecute pe concediu, angajat fără cont: numărul ajunge la aprobator, fără notificare", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    colaboratori.sincronizeazaZileleDeConcediu.mockResolvedValue({
      create: 0,
      actualizate: 0,
      inlocuite: 1,
      pastrate: 0,
    });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    sincronizare(admin);

    const r = await decideCerere(aprobare);

    expect(r).toMatchObject({ ok: true, data: { zileInlocuite: 1 } });
    expect(admin.apeluriPe("notifications")).toHaveLength(0);
  });

  it("notificarea zilelor înlocuite cade: aprobarea rămâne validă", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    colaboratori.sincronizeazaZileleDeConcediu.mockResolvedValue({
      create: 0,
      actualizate: 0,
      inlocuite: 3,
      pastrate: 0,
    });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    admin.raspunde("leave_requests", "select", { data: { employee_id: ANGAJAT, tip: null } });
    admin.raspunde("employees", "select", { data: { user_id: USER_ID } });
    admin.raspunde("leave_request_days", "select", { data: [] });
    admin.raspunde("notifications", "insert", { error: eroarePostgrest("42501") });

    const r = await decideCerere(aprobare);

    expect(r).toMatchObject({ ok: true, data: { zileInlocuite: 3 } });
    expect(admin.apeluriPe("notifications", "insert")[0]?.payload).toMatchObject({
      user_id: USER_ID,
      kind: "info",
      link: "/portal/pontajul-meu",
    });
  });

  it("cererea respinsă tăcut la aprobare: CONFLICT, pontajul nu se atinge", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: null });

    const r = await decideCerere(aprobare);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("„aprobată”") },
    });
    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
    expect(colaboratori.declaraSuspendareaContractului).not.toHaveBeenCalled();
  });

  it("eroare la numărarea pașilor rămași: nu se dă aprobarea FINALĂ pe ghicite", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("approval_tasks", "select", { data: { id: SARCINA, entity_id: CERERE } });
    admin.raspunde("employees", "select", { data: { id: FISA_APROBATOR } });
    server.raspunde("approval_tasks", "update", { data: { id: SARCINA } });
    admin.raspunde("approval_tasks", "select", { error: eroarePostgrest("57014") });

    const r = await decideCerere(aprobare);

    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriPe("leave_requests")).toHaveLength(0);
    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
    expect(colaboratori.declaraSuspendareaContractului).not.toHaveBeenCalled();
  });

  it("42501 la aprobarea cererii: INTERZIS, nu „nu a trecut pe aprobată”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { error: eroarePostgrest("42501") });

    const r = await decideCerere(aprobare);

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
  });

  it("revalidează lista, aprobările, soldul și fișa CERERII din portal (nu a sarcinii)", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    sincronizare(admin);

    await decideCerere(aprobare);

    expect(caiRevalidate()).toEqual([
      "/concedii",
      "/concedii/aprobari",
      "/concedii/sold",
      "/portal",
      "/portal/concediile-mele",
      `/portal/concediile-mele/${CERERE}`,
      "/portal/pontajul-meu",
    ]);
  });

  it("auditul de succes poartă sarcina ca entitate și doar câmpurile permise", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    sincronizare(admin);

    await decideCerere(aprobare);
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_id: SARCINA,
        p_after: {
          taskId: SARCINA,
          decizie: "aprobata",
          comentariu: "De acord.",
          motivRespingere: null,
        },
      }),
    ]);
  });
});

describe("decideCerere — aprobare cu pași rămași", () => {
  it("cererea NU se atinge: rămâne trimisă, nimic nu pleacă spre pontaj", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 2);

    const r = await decideCerere(aprobare);

    expect(r).toEqual({
      ok: true,
      data: { id: CERERE, zileInlocuite: 0, suspendare: NIMIC_DE_DECLARAT },
    });
    expect(server.apeluriPe("leave_requests")).toHaveLength(0);
    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
    expect(colaboratori.declaraSuspendareaContractului).not.toHaveBeenCalled();
  });
});

describe("decideCerere — respingere", () => {
  it("cererea trece pe `respinsa` cu motivul, iar sarcinile rămase se anulează pe clientul admin", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 1);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    admin.raspunde("approval_tasks", "update", { data: null });

    const r = await decideCerere(respingere);

    expect(r).toEqual({
      ok: true,
      data: { id: CERERE, zileInlocuite: 0, suspendare: NIMIC_DE_DECLARAT },
    });
    const [sarcina] = server.apeluriPe("approval_tasks", "update");
    expect(sarcina?.payload).toMatchObject({ status: "respinsa", comentariu: null });

    const [cerere] = server.apeluriPe("leave_requests", "update");
    expect(cerere?.payload).toEqual({
      status: "respinsa",
      motiv_respingere: "Perioadă aglomerată în proiect.",
      decis_de: USER_ID,
    });
    expect(areFiltru(cerere, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(cerere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(cerere?.selectDupaScriere).toBeDefined();

    const [maturare] = admin.apeluriPe("approval_tasks", "update");
    expect(maturare?.payload).toEqual({ status: "anulata", decis_la: ACUM.toISOString() });
    expect(areFiltru(maturare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(maturare, "eq", "entity_type", "leave_request")).toBe(true);
    expect(areFiltru(maturare, "eq", "entity_id", CERERE)).toBe(true);
    expect(areFiltru(maturare, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(maturare, "is", "deleted_at", null)).toBe(true);

    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
  });

  it("cererea respinsă tăcut: CONFLICT, iar măturarea sarcinilor nu mai rulează", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 0);
    server.raspunde("leave_requests", "update", { data: null });

    const r = await decideCerere(respingere);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("„respinsă”") },
    });
    expect(admin.apeluriPe("approval_tasks", "update")).toHaveLength(0);
  });

  it("42501 la respingerea cererii: INTERZIS, iar măturarea nu mai rulează", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 1);
    server.raspunde("leave_requests", "update", { error: eroarePostgrest("42501") });

    const r = await decideCerere(respingere);

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(admin.apeluriPe("approval_tasks", "update")).toHaveLength(0);
  });

  it("eroare la măturarea sarcinilor: eșecul nu se înghite", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    inceput(server, admin, 1);
    server.raspunde("leave_requests", "update", { data: { id: CERERE } });
    admin.raspunde("approval_tasks", "update", { error: eroarePostgrest("40001") });

    const r = await decideCerere(respingere);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });
});
