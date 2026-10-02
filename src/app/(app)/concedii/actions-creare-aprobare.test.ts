// src/app/(app)/concedii/actions-creare-aprobare.test.ts
//
// `creeazaCerereConcediu`, aprobarea pe loc: cererea TRIMISĂ de cine are
// `leave:approve = all` nu mai are pe cine aștepta — sarcinile se închid,
// cererea trece pe „aprobată”, zilele pleacă în pontaj și suspendarea se
// declară. Restul acțiunii: `actions-creare.test.ts`.

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

// Colaboratorii aprobării: sincronizarea cu pontajul și declararea suspendării
// au testele lor; aici se verifică doar că aprobarea pe loc îi cheamă.
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
import { creeazaCerereConcediu } from "./actions";

const FISA = ID_2;
const TIP = ID_3;
const CERERE = ID_1;
const USER_ANGAJAT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ADMIN_FIRMA = { "leave:create": "all", "leave:approve": "all" } as const;

const CAI_DE_BAZA = ["/concedii", "/concedii/sold", "/portal", "/portal/concediile-mele"];
const CAI_APROBARE = [
  "/concedii/aprobari",
  "/concedii/echipa",
  "/concedii/calendar",
  "/pontaj",
  "/portal/pontajul-meu",
];

const SUSPENDARE_DECLARATA = {
  ceruta: true,
  declarata: true,
  termen: "2026-07-05",
  motiv: null,
};

/** Luni 6 – vineri 10 iulie 2026: cinci zile lucrătoare fără sărbători. */
const intrare = (extra: Record<string, unknown> = {}) => ({
  leave_type_id: TIP,
  data_inceput: "2026-07-06",
  data_sfarsit: "2026-07-10",
  ...extra,
});

const tipOdihna = (extra: Record<string, unknown> = {}) => ({
  id: TIP,
  key: "odihna",
  denumire: "Concediu de odihnă",
  scade_din_sold: true,
  zile_implicite: 21,
  plafon_anual_zile: null,
  ...extra,
});

/** Fișa proprie, citită cu clientul admin (rolul `employee` nu-și vede fișa prin RLS). */
function fisaProprie(admin: ClientFals, id: string | null = FISA) {
  admin.raspunde("employees", "select", { data: id === null ? null : { id } });
}

/** Drumul complet al unei trimiteri care trece toate verificările (fără plafon). */
function trimitereCurata(server: ClientFals) {
  server.raspunde("public_holidays", "select", { data: [] });
  server.raspunde("organization_holidays", "select", { data: [] });
  server.raspunde("leave_balances", "select", { data: { ramase: 21 } });
  server.raspunde("leave_requests", "select", { data: [] });
  server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  colaboratori.sincronizeazaZileleDeConcediu
    .mockReset()
    .mockResolvedValue({ create: 5, actualizate: 0, pastrate: 0 });
  colaboratori.declaraSuspendareaContractului.mockReset().mockResolvedValue(SUSPENDARE_DECLARATA);
});

describe("creeazaCerereConcediu — aprobarea pe loc (`leave:approve = all`)", () => {
  /** Drumul complet al aprobării pe loc, pe clientul admin. */
  function aprobarePeLoc(admin: ClientFals, cerereAprobata: unknown = { id: CERERE }) {
    admin.raspunde("approval_tasks", "update", { data: null });
    admin.raspunde("leave_requests", "update", { data: cerereAprobata });
    admin.raspunde("leave_requests", "select", {
      data: { employee_id: FISA, tip: { tip_zi_pontaj: "fara_plata" } },
    });
    admin.raspunde("employees", "select", { data: { user_id: USER_ANGAJAT } });
    admin.raspunde("leave_request_days", "select", {
      data: [
        { data: "2026-07-06", leave_request_id: CERERE },
        { data: "2026-07-07", leave_request_id: CERERE },
      ],
    });
  }

  it("trimisă de patron: sarcinile deschise se închid, cererea trece pe `aprobata` cu `.select()`", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    aprobarePeLoc(admin);

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toEqual({
      ok: true,
      data: {
        id: CERERE,
        zileLucratoare: 5,
        aprobataInstant: true,
        zilePastrate: 0,
        suspendare: SUSPENDARE_DECLARATA,
      },
    });

    const [sarcini] = admin.apeluriPe("approval_tasks", "update");
    expect(sarcini?.payload).toMatchObject({ status: "aprobata", comentariu: expect.any(String) });
    expect(areFiltru(sarcini, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(sarcini, "eq", "entity_type", "leave_request")).toBe(true);
    expect(areFiltru(sarcini, "eq", "entity_id", CERERE)).toBe(true);
    expect(areFiltru(sarcini, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(sarcini, "is", "deleted_at", null)).toBe(true);

    const [aprobare] = admin.apeluriPe("leave_requests", "update");
    expect(aprobare?.payload).toEqual({ status: "aprobata", decis_de: USER_ID });
    expect(areFiltru(aprobare, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(aprobare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(aprobare, "eq", "status", "trimisa")).toBe(true);
    expect(aprobare?.selectDupaScriere).toBeDefined();

    expect(caiRevalidate()).toEqual([...CAI_DE_BAZA, ...CAI_APROBARE]);
  });

  it("aprobarea pe loc lasă urmă proprie în jurnal, separată de crearea cererii", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    aprobarePeLoc(admin);

    await creeazaCerereConcediu(intrare({ trimite: true }));
    await asteaptaDupa();

    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_type: "leave_request",
        p_entity_id: CERERE,
        p_after: { eveniment: "aprobare_pe_loc", motiv: "leave:approve = all" },
      }),
      expect.objectContaining({ p_status: "success", p_action: "create", p_entity_id: CERERE }),
    ]);
  });

  it("zilele aprobate pleacă spre pontaj cu tipul de zi al concediului, iar suspendarea se declară", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    aprobarePeLoc(admin);

    await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(colaboratori.sincronizeazaZileleDeConcediu).toHaveBeenCalledWith(admin.client, ORG_ID, [
      { employee_id: FISA, data: "2026-07-06", leave_request_id: CERERE, tip_zi: "fara_plata" },
      { employee_id: FISA, data: "2026-07-07", leave_request_id: CERERE, tip_zi: "fara_plata" },
    ]);
    expect(colaboratori.declaraSuspendareaContractului).toHaveBeenCalledWith(
      admin.client,
      ORG_ID,
      CERERE,
      USER_ID,
      expect.any(String),
    );
    // Clientul e cel de serviciu: fără filtrul pe cerere, în pontaj ar intra
    // zilele lucrătoare ale TUTUROR cererilor din organizație.
    const [zile] = admin.apeluriPe("leave_request_days");
    expect(areFiltru(zile, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(zile, "eq", "leave_request_id", CERERE)).toBe(true);
    expect(areFiltru(zile, "eq", "este_lucratoare", true)).toBe(true);
    // [0] e fișa proprie a patronului; [1] e contul angajatului, pentru notificare.
    const angajat = admin.apeluriPe("employees", "select")[1];
    expect(areFiltru(angajat, "eq", "id", FISA)).toBe(true);
    expect(areFiltru(angajat, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("zile pontate păstrate peste concediu: numărul iese în rezultat și angajatul e anunțat", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    colaboratori.sincronizeazaZileleDeConcediu.mockResolvedValue({
      create: 0,
      actualizate: 0,
      pastrate: 2,
    });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    aprobarePeLoc(admin);
    admin.raspunde("notifications", "insert", { data: null });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({ ok: true, data: { zilePastrate: 2 } });
    const [notificare] = admin.apeluriPe("notifications", "insert");
    expect(notificare?.payload).toMatchObject({
      organization_id: ORG_ID,
      user_id: USER_ANGAJAT,
      kind: "warning",
      entity_type: "leave_request",
      entity_id: CERERE,
    });
  });

  it("sincronizarea cu pontajul cade: aprobarea rămâne dată, iar zilele păstrate ies 0", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    colaboratori.sincronizeazaZileleDeConcediu.mockRejectedValue(new Error("fără perioadă"));
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    aprobarePeLoc(admin);

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({ ok: true, data: { aprobataInstant: true, zilePastrate: 0 } });
  });

  it("cererea nu mai e `trimisa` la aprobare (zero rânduri): CONFLICT, nu „aprobată”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    aprobarePeLoc(admin, null);

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: expect.stringContaining("nu a putut fi aprobată pe loc"),
      },
    });
    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
    expect(colaboratori.declaraSuspendareaContractului).not.toHaveBeenCalled();
  });

  it("eroare la închiderea sarcinilor: nu se înghite, iar cererea nu trece pe `aprobata`", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    admin.raspunde("approval_tasks", "update", { error: eroarePostgrest("40001") });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("modificate între timp") },
    });
    expect(admin.apeluriPe("leave_requests", "update")).toHaveLength(0);
    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
  });

  it("P0001 la aprobarea cererii: textul triggerului, nu „nu a putut fi aprobată pe loc”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);
    admin.raspunde("approval_tasks", "update", { data: null });
    const mesaj = "Soldul de concediu nu acoperă perioada.";
    admin.raspunde("leave_requests", "update", { error: eroarePostgrest("P0001", mesaj) });

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
    expect(colaboratori.sincronizeazaZileleDeConcediu).not.toHaveBeenCalled();
    expect(colaboratori.declaraSuspendareaContractului).not.toHaveBeenCalled();
  });

  it("ciorna patronului nu se aprobă: n-a plecat nicăieri", async () => {
    const { server, admin } = configureazaActiunea({ rol: "org_admin", permisiuni: ADMIN_FIRMA });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    server.raspunde("leave_requests", "insert", { data: { id: CERERE, zile_lucratoare: 5 } });

    const r = await creeazaCerereConcediu(intrare());

    expect(r).toMatchObject({ ok: true, data: { aprobataInstant: false } });
    expect(admin.apeluriPe("approval_tasks")).toHaveLength(0);
    expect(admin.apeluriPe("leave_requests")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(CAI_DE_BAZA);
  });

  it("`leave:approve = team` (manager) nu aprobă pe loc: cererea lui urcă pe lanț", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "leave:create": "own", "leave:approve": "team" },
    });
    fisaProprie(admin);
    server.raspunde("leave_types", "select", { data: tipOdihna() });
    trimitereCurata(server);

    const r = await creeazaCerereConcediu(intrare({ trimite: true }));

    expect(r).toMatchObject({ ok: true, data: { aprobataInstant: false } });
    expect(admin.apeluriPe("approval_tasks")).toHaveLength(0);
  });
});
