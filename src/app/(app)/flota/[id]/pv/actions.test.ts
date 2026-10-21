// src/app/(app)/flota/[id]/pv/actions.test.ts
//
// Procesul-verbal de predare-primire (0215, F12c), pe clientul fals: filtrul
// de organizație pe fiecare scriere, `.select()` după tranziții și zero rânduri
// = CONFLICT, autorul trimis explicit, coloana de confirmare aleasă după partea
// omului. Clientul fals NU prinde o politică RLS greșită — aceea e în
// `tests/rls/proba-flota-pv.sql` și în `izolare.sql` (l), blocul F12c.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  actualizeazaPv,
  anuleazaPv,
  confirmaPv,
  creeazaPv,
  finalizeazaPv,
  stergePv,
} from "./actions";
import { MESAJ_PV_DUBLAT } from "./erori";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PV = ID_1;
const VEHICUL = ID_2;
const ALOCARE = ID_3;
const FISA = "88888888-8888-4888-8888-888888888888";
const ALTA_FISA = "99999999-9999-4999-8999-999999999999";

const ADMIN = { "vehicles:update": "all" } as const;

describe("creeazaPv", () => {
  it.each([["team"], ["own"], ["none"]] as const)(
    "sub `vehicles:update = %s`: INTERZIS, fără drum la bază",
    async (scope) => {
      const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": scope } });
      const r = await creeazaPv({ vehicle_id: VEHICUL, alocare_primita_id: ALOCARE });
      expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("INSERT cu firma din tenant, autorul explicit și fără coloanele bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "insert", { data: { id: PV } });

    const r = await creeazaPv({
      vehicle_id: VEHICUL,
      alocare_primita_id: ALOCARE,
      km_bord: "51200",
      nivel_rezervor: "plin",
      dotari: ["extinctor", "trusa_medicala", "extinctor"],
      daune_constatate: "nu",
      sofer_employee_id: FISA,
      numar: "PVA-2026-0001",
    });

    expect(r).toEqual({ ok: true, data: { id: PV } });
    const [scriere] = server.apeluriPe("vehicle_handovers", "insert");
    expect(scriere?.payload).toEqual({
      organization_id: ORG_ID,
      vehicle_id: VEHICUL,
      alocare_predata_id: null,
      alocare_primita_id: ALOCARE,
      km_bord: 51200,
      nivel_rezervor: "plin",
      numar_chei: null,
      stare_generala: null,
      anvelope: null,
      documente_bord: [],
      dotari: ["extinctor", "trusa_medicala"],
      daune_constatate: false,
      daune: [],
      observatii: null,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // GENERATED: trimisă, ar da 428C9 (capcana 30). Numărul îl dă baza.
    expect(scriere?.payload).not.toHaveProperty("sofer_employee_id");
    expect(scriere?.payload).not.toHaveProperty("numar");
    expect(scriere?.payload).not.toHaveProperty("tip");
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/flota", `/flota/${VEHICUL}`, `/flota/${VEHICUL}/pv/${PV}`]);
  });

  it("al doilea PV viu pe aceeași predare (23505) ajunge pe alocare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "insert", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "pvv_primita_uq"',
      ),
    });
    const r = await creeazaPv({ vehicle_id: VEHICUL, alocare_primita_id: ALOCARE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { alocare_primita_id: [MESAJ_PV_DUBLAT] } },
    });
  });

  it("fără nicio alocare: refuz în schemă, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const r = await creeazaPv({ vehicle_id: VEHICUL });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("actualizeazaPv", () => {
  it("UPDATE doar pe ciornă, pe firmă și nesters; `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "update", { data: { id: PV } });

    const r = await actualizeazaPv({
      id: PV,
      vehicle_id: VEHICUL,
      stare_generala: "buna",
      daune_constatate: "nu",
    });

    expect(r).toEqual({ ok: true, data: { id: PV } });
    const [scriere] = server.apeluriPe("vehicle_handovers", "update");
    expect(scriere?.payload).toMatchObject({
      stare_generala: "buna",
      daune_constatate: false,
      updated_by: USER_ID,
    });
    expect(scriere?.payload).not.toHaveProperty("stare");
    expect(scriere?.payload).not.toHaveProperty("alocare_primita_id");
    expect(areFiltru(scriere, "eq", "id", PV)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "eq", "stare", "ciorna")).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("zero rânduri (PV-ul a fost finalizat între timp) = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "update", { data: null });
    const r = await actualizeazaPv({ id: PV, vehicle_id: VEHICUL });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("finalizeazaPv", () => {
  it("trimite doar starea și autorul; întoarce numărul și înregistrarea date de bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "update", {
      data: { id: PV, numar: "PVA-2026-0003", numar_registru: "437/12.10.2026" },
    });

    const r = await finalizeazaPv({ id: PV, vehicle_id: VEHICUL });

    expect(r).toEqual({
      ok: true,
      data: { id: PV, numar: "PVA-2026-0003", numar_registru: "437/12.10.2026" },
    });
    const [scriere] = server.apeluriPe("vehicle_handovers", "update");
    expect(scriere?.payload).toEqual({ stare: "finalizat", updated_by: USER_ID });
    expect(areFiltru(scriere, "eq", "stare", "ciorna")).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id, numar, numar_registru");
    expect(caiRevalidate()).toEqual([
      "/flota",
      `/flota/${VEHICUL}`,
      `/flota/${VEHICUL}/pv/${PV}`,
      "/portal/masina-mea",
    ]);
  });

  it("al doilea clic (PV deja finalizat): zero rânduri = CONFLICT, nu P0001", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "update", { data: null });
    const r = await finalizeazaPv({ id: PV, vehicle_id: VEHICUL });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("kilometrajul diferit de alocare (P0001) ajunge pe `km_bord`, cu cifrele", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const mesaj =
      "Kilometrajul din procesul-verbal (50500 km) diferă de cel al alocării (50000 km).";
    server.raspunde("vehicle_handovers", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await finalizeazaPv({ id: PV, vehicle_id: VEHICUL });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { km_bord: [mesaj] } },
    });
  });

  it("anul de registru închis (P0001 din registru) urcă la om ca atare", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    const mesaj =
      "Registrul pe anul 2026 este închis. Redeschide exercițiul înainte de a mai înregistra sau modifica documente.";
    server.raspunde("vehicle_handovers", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await finalizeazaPv({ id: PV, vehicle_id: VEHICUL });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("anuleazaPv", () => {
  it("UPDATE pe finalizat și neanulat, cu motivul; `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "update", { data: { id: PV } });

    const r = await anuleazaPv({
      id: PV,
      vehicle_id: VEHICUL,
      motiv_anulare: "  Kilometrajul a fost citit greșit.  ",
    });

    expect(r).toEqual({ ok: true, data: { id: PV } });
    const [scriere] = server.apeluriPe("vehicle_handovers", "update");
    expect(scriere?.payload).toMatchObject({
      motiv_anulare: "Kilometrajul a fost citit greșit.",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "stare", "finalizat")).toBe(true);
    expect(areFiltru(scriere, "is", "anulat_la", null)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("anularea dublă: zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "update", { data: null });
    const r = await anuleazaPv({
      id: PV,
      vehicle_id: VEHICUL,
      motiv_anulare: "Kilometrajul a fost citit greșit.",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergePv", () => {
  it("ștergere logică doar pe ciornă; zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: ADMIN });
    server.raspunde("vehicle_handovers", "update", { data: { id: PV } });
    const r = await stergePv({ id: PV, vehicle_id: VEHICUL });
    expect(r).toEqual({ ok: true, data: { id: PV } });
    const [scriere] = server.apeluriPe("vehicle_handovers", "update");
    expect(scriere?.payload).toMatchObject({ deleted_at: expect.any(String), updated_by: USER_ID });
    expect(areFiltru(scriere, "eq", "stare", "ciorna")).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);

    configureazaActiunea({ permisiuni: ADMIN }).server.raspunde("vehicle_handovers", "update", {
      data: null,
    });
    expect(await stergePv({ id: PV, vehicle_id: VEHICUL })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});

describe("confirmaPv", () => {
  /** `fisaMea` citește fișele omului, principala întâi. */
  function cuFisa(server: ReturnType<typeof configureazaActiunea>["server"], id: string): void {
    server.raspunde("employees", "select", {
      data: [
        {
          id,
          full_name: "Popescu Ana",
          marca: "A-12",
          hired_on: null,
          department_id: null,
          functie: null,
          status: "activ",
          is_primary: true,
        },
      ],
    });
  }

  it("`hr` fără `vehicles:read` trece de poartă: decizia 3, partea la PV confirmă", async () => {
    const { server } = configureazaActiunea({ rol: "hr", permisiuni: { "employees:read": "all" } });
    cuFisa(server, FISA);
    server.raspunde("vehicle_handovers", "select", {
      data: { id: PV, predator_employee_id: null, primitor_employee_id: FISA },
    });
    server.raspunde("vehicle_handovers", "update", { data: { id: PV } });

    const r = await confirmaPv({ id: PV });

    expect(r).toEqual({ ok: true, data: { id: PV } });
    expect(caiRevalidate()).toEqual(["/portal/masina-mea", "/portal"]);
  });

  it("primitorul își confirmă primirea: coloana lui, cu gărzile pe stare, anulare și confirmare", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "employees:read": "own" },
    });
    cuFisa(server, FISA);
    server.raspunde("vehicle_handovers", "select", {
      data: { id: PV, predator_employee_id: ALTA_FISA, primitor_employee_id: FISA },
    });
    server.raspunde("vehicle_handovers", "update", { data: { id: PV } });

    await confirmaPv({ id: PV });

    const [citire] = server.apeluriPe("vehicle_handovers", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [scriere] = server.apeluriPe("vehicle_handovers", "update");
    expect(Object.keys(scriere?.payload as object).sort()).toEqual([
      "confirmat_primitor_la",
      "updated_by",
    ]);
    expect(areFiltru(scriere, "is", "confirmat_primitor_la", null)).toBe(true);
    expect(areFiltru(scriere, "is", "anulat_la", null)).toBe(true);
    expect(areFiltru(scriere, "eq", "stare", "finalizat")).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("predătorul își confirmă predarea, pe coloana lui", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "employees:read": "own" },
    });
    cuFisa(server, FISA);
    server.raspunde("vehicle_handovers", "select", {
      data: { id: PV, predator_employee_id: FISA, primitor_employee_id: ALTA_FISA },
    });
    server.raspunde("vehicle_handovers", "update", { data: { id: PV } });

    await confirmaPv({ id: PV });

    const [scriere] = server.apeluriPe("vehicle_handovers", "update");
    expect(Object.keys(scriere?.payload as object).sort()).toEqual([
      "confirmat_predator_la",
      "updated_by",
    ]);
    expect(areFiltru(scriere, "is", "confirmat_predator_la", null)).toBe(true);
  });

  it("omul care nu e parte: CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "employees:read": "own" },
    });
    cuFisa(server, FISA);
    server.raspunde("vehicle_handovers", "select", {
      data: { id: PV, predator_employee_id: null, primitor_employee_id: ALTA_FISA },
    });

    const r = await confirmaPv({ id: PV });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("vehicle_handovers", "update")).toHaveLength(0);
  });

  it("PV-ul invizibil sau inexistent: NEGASIT", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "employees:read": "own" },
    });
    cuFisa(server, FISA);
    server.raspunde("vehicle_handovers", "select", { data: null });
    expect(await confirmaPv({ id: PV })).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("a doua confirmare: zero rânduri = CONFLICT", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "employees:read": "own" },
    });
    cuFisa(server, FISA);
    server.raspunde("vehicle_handovers", "select", {
      data: { id: PV, predator_employee_id: null, primitor_employee_id: FISA },
    });
    server.raspunde("vehicle_handovers", "update", { data: null });
    expect(await confirmaPv({ id: PV })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("fără fișă principală: CONFLICT, fără citirea PV-ului", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "employees:read": "own" },
    });
    server.raspunde("employees", "select", { data: [] });
    expect(await confirmaPv({ id: PV })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("vehicle_handovers", "select")).toHaveLength(0);
  });

  it("fără `employees:read`: INTERZIS", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "vehicles:read": "own" },
    });
    expect(await confirmaPv({ id: PV })).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });
});
