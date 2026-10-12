// src/lib/queries/leave.test.ts
//
// Citirile modulului de concedii. Clientul e falsul din `@/lib/teste/supabase-fals`,
// primit prin `createServerSupabase()`; se verifică filtrul de organizație,
// excluderea rândurilor șterse logic, paginarea keyset, plafoanele care spun
// că lista a fost tăiată și maparea rândurilor.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import {
  areFiltru,
  eroarePostgrest,
  type ApelFals,
  type ClientFals,
} from "@/lib/teste/supabase-fals";
import { filtreCereriSchema, type FiltreCereri } from "@/schemas/leave";

import { codificaCursor, decodificaCursor } from "./cursor";
import {
  angajatiPlanificator,
  calendarLunii,
  cereriCareOcupaZile,
  citesteCerere,
  configurareConcedii,
  coduriIndemnizatieMedicala,
  deAprobat,
  grupeazaSoldDupaAngajat,
  imperecheazaSold,
  istoricSold,
  lantulAprobarii,
  listeazaCereri,
  numarDeAprobat,
  previzualizeazaDrepturi,
  soldAnual,
  varianteConcediu,
  zileleCererii,
  zileNelucratoare,
  type SoldTip,
  type TipConcediu,
} from "./leave";

const FISA = ID_2;
const TIP = ID_3;

let server: ClientFals;
beforeEach(() => {
  ({ server } = configureazaActiunea());
});

/** Argumentele unui modificator (`order`, `limit`, `or`), pe care `areFiltru` nu le tipează. */
const argumente = (apel: ApelFals | undefined, metoda: string) =>
  apel?.filtre.filter((f) => f.metoda === metoda).map((f) => f.argumente);

const filtre = (extra: Partial<FiltreCereri> = {}): FiltreCereri => ({
  ...filtreCereriSchema.parse({}),
  ...extra,
});

const cerere = (id: string, data_inceput: string, status = "trimisa") => ({
  id,
  employee_id: FISA,
  leave_type_id: TIP,
  data_inceput,
  data_sfarsit: data_inceput,
  zile_lucratoare: 1,
  zile_calendaristice: 1,
  status,
  trimisa_la: null,
  decis_la: null,
  created_at: "2026-01-01T00:00:00Z",
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ── listeazaCereri ────────────────────────────────────────────────────────────

describe("listeazaCereri", () => {
  it("„ale mele” fără fișă proprie: listă goală, fără nicio interogare", async () => {
    const r = await listeazaCereri(ORG_ID, "team", filtre(), null, "mele");
    expect(r).toEqual({
      randuri: [],
      urmatorulCursor: null,
      total: 0,
      sortare: { cheie: "perioada", directie: "desc" },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("lista și numărătoarea poartă ACELEAȘI filtre de mulțime; doar lista are ordine și limită", async () => {
    server.raspunde("leave_requests", "select", { data: [cerere(ID_1, "2026-07-06")] });
    server.raspunde("leave_requests", "select", { count: 42 });

    const r = await listeazaCereri(ORG_ID, "all", filtre());

    expect(r.total).toBe(42);
    expect(r.randuri).toHaveLength(1);
    expect(r.urmatorulCursor).toBeNull();
    const [lista, numarare] = server.apeluriPe("leave_requests");
    for (const apel of [lista, numarare]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    expect(argumente(lista, "order")).toEqual([
      ["data_inceput", { ascending: false, nullsFirst: false }],
      ["id", { ascending: false }],
    ]);
    expect(argumente(lista, "limit")).toEqual([[26]]);
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    expect(argumente(numarare, "limit")).toEqual([]);
  });

  it("pagină plină (limita + 1): taie surplusul și dă cursorul ultimului rând AFIȘAT", async () => {
    const randuri = [1, 2, 3, 4, 5, 6].map((n) => cerere(uuid(n), `2026-07-0${String(n)}`));
    server.raspunde("leave_requests", "select", { data: randuri });
    server.raspunde("leave_requests", "select", { count: 6 });

    const r = await listeazaCereri(ORG_ID, "all", filtre({ limita: 5 }));

    expect(r.randuri.map((x) => x.id)).toEqual([1, 2, 3, 4, 5].map(uuid));
    expect(r.urmatorulCursor).toBe(codificaCursor({ valoare: "2026-07-05", id: uuid(5) }));
  });

  it("cursorul din URL devine predicat keyset pe lista, NU pe numărătoare", async () => {
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "select", { count: 55 });
    const cursor = codificaCursor({ valoare: "2026-07-05", id: ID_1 });

    const r = await listeazaCereri(ORG_ID, "all", filtre({ cursor }));

    expect(r.total).toBe(55);
    const [lista, numarare] = server.apeluriPe("leave_requests");
    expect(argumente(lista, "or")).toEqual([
      [`data_inceput.lt."2026-07-05",and(data_inceput.eq."2026-07-05",id.lt."${ID_1}")`],
    ]);
    expect(argumente(numarare, "or")).toEqual([]);
  });

  it("cursor stricat: ignorat tăcut, prima pagină", async () => {
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "select", { count: 0 });
    await listeazaCereri(ORG_ID, "all", filtre({ cursor: "!!nu-e-cursor" }));
    expect(argumente(server.apeluriPe("leave_requests")[0], "or")).toEqual([]);
  });

  it("sortare după stare, crescător: ordinea și cursorul folosesc `status`", async () => {
    const randuri = [1, 2, 3, 4, 5, 6].map((n) => cerere(uuid(n), "2026-07-01", "aprobata"));
    server.raspunde("leave_requests", "select", { data: randuri });
    server.raspunde("leave_requests", "select", { count: 9 });

    const r = await listeazaCereri(ORG_ID, "all", filtre({ sort: "stare", limita: 5 }));

    expect(r.sortare).toEqual({ cheie: "stare", directie: "asc" });
    expect(argumente(server.apeluriPe("leave_requests")[0], "order")?.[0]).toEqual([
      "status",
      { ascending: true, nullsFirst: false },
    ]);
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "aprobata", id: uuid(5) });
  });

  it("sortare necunoscută din URL: cade pe implicit, nu ajunge într-un `.order()`", async () => {
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "select", { count: 0 });
    const r = await listeazaCereri(ORG_ID, "all", filtre({ sort: "-motiv" }));
    expect(r.sortare).toEqual({ cheie: "perioada", directie: "desc" });
    expect(argumente(server.apeluriPe("leave_requests")[0], "order")?.[0]?.[0]).toBe(
      "data_inceput",
    );
  });

  it.each([
    ["mele", "eq"],
    ["echipa", "neq"],
  ] as const)(
    "vizualizarea `%s` cu fișă: `%s(employee_id)` pe ambele interogări",
    async (viz, metoda) => {
      server.raspunde("leave_requests", "select", { data: [] });
      server.raspunde("leave_requests", "select", { count: 0 });
      await listeazaCereri(ORG_ID, "team", filtre(), FISA, viz);
      for (const apel of server.apeluriPe("leave_requests")) {
        expect(areFiltru(apel, metoda, "employee_id", FISA)).toBe(true);
      }
    },
  );

  it("filtrele din URL se aplică: stări, tip, interval (cu suprapunere, nu includere)", async () => {
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "select", { count: 0 });
    await listeazaCereri(
      ORG_ID,
      "all",
      filtre({
        status: ["trimisa", "aprobata"],
        leave_type_id: TIP,
        de_la: "2026-07-01",
        pana_la: "2026-07-31",
        employee_id: FISA,
      }),
    );
    for (const apel of server.apeluriPe("leave_requests")) {
      expect(areFiltru(apel, "in", "status", ["trimisa", "aprobata"])).toBe(true);
      expect(areFiltru(apel, "eq", "leave_type_id", TIP)).toBe(true);
      expect(areFiltru(apel, "gte", "data_sfarsit", "2026-07-01")).toBe(true);
      expect(areFiltru(apel, "lte", "data_inceput", "2026-07-31")).toBe(true);
      expect(areFiltru(apel, "eq", "employee_id", FISA)).toBe(true);
    }
  });

  it("scope `own`: filtrul explicit pe angajat din URL se ignoră (RLS restrânge deja)", async () => {
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("leave_requests", "select", { count: 0 });
    await listeazaCereri(ORG_ID, "own", filtre({ employee_id: FISA }));
    expect(areFiltru(server.apeluriPe("leave_requests")[0], "eq", "employee_id")).toBe(false);
  });

  it("numărătoare indisponibilă: totalul e lungimea paginii", async () => {
    server.raspunde("leave_requests", "select", { data: [cerere(ID_1, "2026-07-06")] });
    server.raspunde("leave_requests", "select", { count: null });
    const r = await listeazaCereri(ORG_ID, "all", filtre());
    expect(r.total).toBe(1);
  });

  it.each([
    ["lista", [{ error: eroarePostgrest("57014") }, { count: 1 }]],
    ["numărătoarea", [{ data: [] }, { error: eroarePostgrest("57014") }]],
  ] as const)("eroare pe %s: aruncă, nu întoarce o listă goală", async (_caz, raspunsuri) => {
    for (const r of raspunsuri) server.raspunde("leave_requests", "select", r);
    await expect(listeazaCereri(ORG_ID, "all", filtre())).rejects.toMatchObject({ code: "57014" });
  });
});

// ── Citiri simple pe o cerere ─────────────────────────────────────────────────

describe("citesteCerere, zileleCererii, lantulAprobarii", () => {
  it("citesteCerere: id + organizație + nesters; null dacă nu se vede", async () => {
    server.raspunde("leave_requests", "select", { data: null });
    expect(await citesteCerere(ORG_ID, ID_1)).toBeNull();
    const [apel] = server.apeluriPe("leave_requests");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("zileleCererii: ordonate după dată; lipsă ⇒ listă goală", async () => {
    server.raspunde("leave_request_days", "select", { data: null });
    expect(await zileleCererii(ID_1)).toEqual([]);
    const [apel] = server.apeluriPe("leave_request_days");
    expect(areFiltru(apel, "eq", "leave_request_id", ID_1)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["data"]]);
  });

  it("lantulAprobarii: sarcinile cererii în organizație, în ordinea pașilor", async () => {
    const pas = { id: ID_3, ordine: 1, status: "in_asteptare" };
    server.raspunde("approval_tasks", "select", { data: [pas] });
    expect(await lantulAprobarii(ORG_ID, ID_1)).toEqual([pas]);
    const [apel] = server.apeluriPe("approval_tasks");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "entity_type", "leave_request")).toBe(true);
    expect(areFiltru(apel, "eq", "entity_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["ordine"]]);
  });

  it("eroarea se aruncă", async () => {
    server.raspunde("approval_tasks", "select", { error: eroarePostgrest("42P17") });
    await expect(lantulAprobarii(ORG_ID, ID_1)).rejects.toMatchObject({ code: "42P17" });
  });

  it("citesteCerere: eroarea se aruncă, nu devine „cerere inexistentă”", async () => {
    server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
    await expect(citesteCerere(ORG_ID, ID_1)).rejects.toMatchObject({ code: "57014" });
  });

  it("zileleCererii: eroarea se aruncă, nu devine listă goală", async () => {
    server.raspunde("leave_request_days", "select", { error: eroarePostgrest("57014") });
    await expect(zileleCererii(ID_1)).rejects.toMatchObject({ code: "57014" });
  });
});

// ── Soldul ────────────────────────────────────────────────────────────────────

const tip = (id: string): TipConcediu => ({
  id,
  key: id,
  denumire: id,
  culoare: "#000000",
  zile_implicite: 21,
  scade_din_sold: true,
  se_reporteaza: false,
  plafon_reportare_zile: null,
});
const sold = (employee_id: string, leave_type_id: string): SoldTip => ({
  id: `${employee_id}-${leave_type_id}`,
  employee_id,
  leave_type_id,
  an: 2026,
  drept_anual: 21,
  reportate: 0,
  termen_folosire_reportate: null,
  folosite: 0,
  in_asteptare: 0,
  ramase: 21,
});

describe("soldAnual", () => {
  it("tipurile active și soldurile anului, ambele pe organizație și nesterse", async () => {
    server.raspunde("leave_types", "select", { data: [tip("odihna")] });
    server.raspunde("leave_balances", "select", { data: null });
    const r = await soldAnual(ORG_ID, 2031);
    expect(r).toEqual({ tipuri: [tip("odihna")], solduri: [] });
    const [tipuri] = server.apeluriPe("leave_types");
    expect(areFiltru(tipuri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(tipuri, "eq", "activ", true)).toBe(true);
    expect(areFiltru(tipuri, "is", "deleted_at", null)).toBe(true);
    expect(argumente(tipuri, "order")).toEqual([["denumire"]]);
    const [solduri] = server.apeluriPe("leave_balances");
    expect(areFiltru(solduri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(solduri, "eq", "an", 2031)).toBe(true);
    expect(areFiltru(solduri, "is", "deleted_at", null)).toBe(true);
  });

  it("eroare pe solduri: aruncă", async () => {
    server.raspunde("leave_types", "select", { data: [] });
    server.raspunde("leave_balances", "select", { error: eroarePostgrest("57014") });
    await expect(soldAnual(ORG_ID, 2032)).rejects.toMatchObject({ code: "57014" });
  });

  it("eroare pe tipuri: aruncă, nu întoarce un sold fără tipuri", async () => {
    server.raspunde("leave_types", "select", { error: eroarePostgrest("57014") });
    server.raspunde("leave_balances", "select", { data: [] });
    await expect(soldAnual(ORG_ID, 2033)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("imperecheazaSold și grupeazaSoldDupaAngajat", () => {
  it("fiecare tip primește soldul lui sau `null` (dreptul nu s-a atins încă)", () => {
    const s = sold(FISA, "odihna");
    expect(imperecheazaSold([tip("odihna"), tip("studii")], [s])).toEqual([
      { tip: tip("odihna"), sold: s },
      { tip: tip("studii"), sold: null },
    ]);
  });

  it("fără tipuri: nicio linie, chiar dacă există solduri", () => {
    expect(imperecheazaSold([], [sold(FISA, "odihna")])).toEqual([]);
  });

  it("grupează pe angajat, în ordinea primei apariții", () => {
    const a1 = sold("a", "odihna");
    const b1 = sold("b", "odihna");
    const a2 = sold("a", "studii");
    const harta = grupeazaSoldDupaAngajat([a1, b1, a2]);
    expect([...harta.keys()]).toEqual(["a", "b"]);
    expect(harta.get("a")).toEqual([a1, a2]);
    expect(harta.get("b")).toEqual([b1]);
    expect(grupeazaSoldDupaAngajat([]).size).toBe(0);
  });
});

describe("istoricSold", () => {
  it("cere un rând peste plafon ca să știe dacă a tăiat; ordine stabilă cu `id`", async () => {
    server.raspunde("leave_accruals", "select", { data: [{ an: 2026 }] });
    const r = await istoricSold(ORG_ID, 2026);
    expect(r).toEqual({ randuri: [{ an: 2026 }], trunchiat: false });
    const [apel] = server.apeluriPe("leave_accruals");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "an", 2026)).toBe(true);
    expect(argumente(apel, "limit")).toEqual([[501]]);
    expect(argumente(apel, "order")).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(apel?.coloane).toContain("employee_id");
  });

  it.each([
    [500, 500, false],
    [501, 500, true],
  ])("%i rânduri primite ⇒ %i afișate, trunchiat = %s", async (primite, afisate, trunchiat) => {
    server.raspunde("leave_accruals", "select", {
      data: Array.from({ length: primite }, (_v, i) => ({ an: 2026, i })),
    });
    const r = await istoricSold(ORG_ID, 2026);
    expect(r.randuri).toHaveLength(afisate);
    expect(r.trunchiat).toBe(trunchiat);
  });

  it("eroarea se aruncă, nu devine istoric gol", async () => {
    server.raspunde("leave_accruals", "select", { error: eroarePostgrest("57014") });
    await expect(istoricSold(ORG_ID, 2026)).rejects.toMatchObject({ code: "57014" });
  });
});

// ── Aprobările ────────────────────────────────────────────────────────────────

describe("numarDeAprobat", () => {
  it("numără doar sarcinile deschise ale utilizatorului, fără rânduri (`head`)", async () => {
    server.raspunde("approval_tasks", "select", { count: 7 });
    expect(await numarDeAprobat(ORG_ID, USER_ID)).toBe(7);
    const [apel] = server.apeluriPe("approval_tasks");
    expect(apel?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    // Doar sarcinile de concediu: badge-ul nu numără aprobările altor module.
    expect(areFiltru(apel, "eq", "entity_type", "leave_request")).toBe(true);
    expect(areFiltru(apel, "eq", "approver_user_id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("numărătoare lipsă ⇒ 0", async () => {
    server.raspunde("approval_tasks", "select", { count: null });
    expect(await numarDeAprobat(ORG_ID, USER_ID)).toBe(0);
  });

  it("eroarea se aruncă, nu devine „0 de aprobat”", async () => {
    server.raspunde("approval_tasks", "select", { error: eroarePostgrest("57014") });
    await expect(numarDeAprobat(ORG_ID, USER_ID)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("deAprobat", () => {
  const C1 = uuid(101);
  const C2 = uuid(102);
  const sarcina = (id: string, entity_id: string) => ({
    id,
    entity_id,
    ordine: 1,
    termen_la: null,
    created_at: "2026-07-01T00:00:00Z",
  });

  it("fără sarcini: o singură interogare, listă goală netrunchiată", async () => {
    server.raspunde("approval_tasks", "select", { data: [] });
    expect(await deAprobat(ORG_ID, USER_ID)).toEqual({ sarcini: [], trunchiat: false });
    expect(server.apeluri).toHaveLength(1);
  });

  it("împerechează sarcina cu cererea, angajatul și tipul; aruncă sarcinile cu cererea deja ieșită din aprobare", async () => {
    server.raspunde("approval_tasks", "select", {
      data: [sarcina(ID_1, C1), sarcina(ID_2, C2), sarcina(ID_3, C1)],
    });
    server.raspunde("leave_requests", "select", {
      data: [
        {
          id: C1,
          employee_id: FISA,
          leave_type_id: TIP,
          data_inceput: "2026-07-06",
          data_sfarsit: "2026-07-10",
          zile_lucratoare: 5,
          status: "trimisa",
        },
      ],
    });
    server.raspunde("employees", "select", {
      data: [{ id: FISA, full_name: "Ana Pop", marca: "M7" }],
    });
    server.raspunde("leave_types", "select", { data: [] });

    const r = await deAprobat(ORG_ID, USER_ID);

    expect(r.trunchiat).toBe(false);
    expect(r.sarcini.map((s) => s.taskId)).toEqual([ID_1, ID_3]);
    expect(r.sarcini[0]).toEqual({
      taskId: ID_1,
      ordine: 1,
      termenLa: null,
      createdAt: "2026-07-01T00:00:00Z",
      cerere: {
        id: C1,
        dataInceput: "2026-07-06",
        dataSfarsit: "2026-07-10",
        zileLucratoare: 5,
        status: "trimisa",
      },
      angajat: { id: FISA, fullName: "Ana Pop", marca: "M7" },
      tip: null,
    });

    const [sarcini] = server.apeluriPe("approval_tasks");
    expect(areFiltru(sarcini, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(sarcini, "eq", "entity_type", "leave_request")).toBe(true);
    expect(areFiltru(sarcini, "eq", "approver_user_id", USER_ID)).toBe(true);
    expect(areFiltru(sarcini, "eq", "status", "in_asteptare")).toBe(true);
    expect(areFiltru(sarcini, "is", "deleted_at", null)).toBe(true);
    // Ordinea decide granița tăierii la 100: termenul întâi, apoi `id`, stabil.
    expect(argumente(sarcini, "order")).toEqual([
      ["termen_la", { ascending: true, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    expect(argumente(sarcini, "limit")).toEqual([[101]]);
    const [cereri] = server.apeluriPe("leave_requests");
    expect(areFiltru(cereri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cereri, "in", "id", [C1, C2])).toBe(true);
    expect(areFiltru(cereri, "in", "status", ["trimisa", "in_aprobare"])).toBe(true);
    expect(areFiltru(server.apeluriPe("employees")[0], "in", "id", [FISA])).toBe(true);
  });

  it("nicio cerere rămasă: angajații și tipurile se cer cu o listă-santinelă, nu cu `in.()` gol", async () => {
    server.raspunde("approval_tasks", "select", { data: [sarcina(ID_1, C1)] });
    server.raspunde("leave_requests", "select", { data: [] });
    server.raspunde("employees", "select", { data: [] });
    server.raspunde("leave_types", "select", { data: [] });
    const r = await deAprobat(ORG_ID, USER_ID);
    expect(r.sarcini).toEqual([]);
    expect(areFiltru(server.apeluriPe("employees")[0], "in", "id", [""])).toBe(true);
    expect(areFiltru(server.apeluriPe("leave_types")[0], "in", "id", [""])).toBe(true);
  });

  describe("o eroare pe oricare dintre cele patru citiri se aruncă, nu golește coada", () => {
    const cerereC1 = {
      id: C1,
      employee_id: FISA,
      leave_type_id: TIP,
      data_inceput: "2026-07-06",
      data_sfarsit: "2026-07-06",
      zile_lucratoare: 1,
      status: "trimisa",
    };

    it("sarcinile", async () => {
      server.raspunde("approval_tasks", "select", { error: eroarePostgrest("57014") });
      await expect(deAprobat(ORG_ID, USER_ID)).rejects.toMatchObject({ code: "57014" });
    });

    it("cererile", async () => {
      server.raspunde("approval_tasks", "select", { data: [sarcina(ID_1, C1)] });
      server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
      await expect(deAprobat(ORG_ID, USER_ID)).rejects.toMatchObject({ code: "57014" });
    });

    it("angajații", async () => {
      server.raspunde("approval_tasks", "select", { data: [sarcina(ID_1, C1)] });
      server.raspunde("leave_requests", "select", { data: [cerereC1] });
      server.raspunde("employees", "select", { error: eroarePostgrest("57014") });
      server.raspunde("leave_types", "select", { data: [] });
      await expect(deAprobat(ORG_ID, USER_ID)).rejects.toMatchObject({ code: "57014" });
    });

    it("tipurile", async () => {
      server.raspunde("approval_tasks", "select", { data: [sarcina(ID_1, C1)] });
      server.raspunde("leave_requests", "select", { data: [cerereC1] });
      server.raspunde("employees", "select", { data: [] });
      server.raspunde("leave_types", "select", { error: eroarePostgrest("57014") });
      await expect(deAprobat(ORG_ID, USER_ID)).rejects.toMatchObject({ code: "57014" });
    });
  });

  it("101 sarcini: se afișează 100, iar lista se declară tăiată", async () => {
    server.raspunde("approval_tasks", "select", {
      data: Array.from({ length: 101 }, (_v, i) => sarcina(uuid(i + 1), C1)),
    });
    server.raspunde("leave_requests", "select", {
      data: [
        {
          id: C1,
          employee_id: FISA,
          leave_type_id: TIP,
          data_inceput: "2026-07-06",
          data_sfarsit: "2026-07-06",
          zile_lucratoare: 1,
          status: "in_aprobare",
        },
      ],
    });
    server.raspunde("employees", "select", { data: [] });
    server.raspunde("leave_types", "select", {
      data: [{ id: TIP, denumire: "Odihnă", culoare: "#123456" }],
    });
    const r = await deAprobat(ORG_ID, USER_ID);
    expect(r.trunchiat).toBe(true);
    expect(r.sarcini).toHaveLength(100);
    expect(r.sarcini[0]?.tip).toEqual({ id: TIP, denumire: "Odihnă", culoare: "#123456" });
  });
});

// ── Calendarul ────────────────────────────────────────────────────────────────

describe("calendarLunii", () => {
  it("zilele lucrătoare ale lunii, doar din cererile care ocupă (fără ciorne)", async () => {
    server.raspunde("leave_request_days", "select", { data: null });
    expect(await calendarLunii(ORG_ID, "2026-07-01", "2026-07-31")).toEqual([]);
    const [apel] = server.apeluriPe("leave_request_days");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "este_lucratoare", true)).toBe(true);
    expect(areFiltru(apel, "gte", "data", "2026-07-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-07-31")).toBe(true);
    expect(areFiltru(apel, "in", "status", ["trimisa", "in_aprobare", "aprobata"])).toBe(true);
    // Fără `!inner`: un embed ascuns de RLS dă NULL, nu scoate ziua.
    expect(apel?.coloane).not.toContain("!inner");
  });

  it("eroarea se aruncă, nu devine o lună fără absențe", async () => {
    server.raspunde("leave_request_days", "select", { error: eroarePostgrest("57014") });
    await expect(calendarLunii(ORG_ID, "2026-07-01", "2026-07-31")).rejects.toMatchObject({
      code: "57014",
    });
  });
});

describe("angajatiPlanificator", () => {
  it("angajații activi în lună, ordonați după nume cu colația românească", async () => {
    server.raspunde("employees", "select", {
      data: [
        { id: uuid(1), full_name: "Zoe Ionescu", marca: "M1" },
        { id: uuid(2), full_name: "Ștefan Pop", marca: "M2" },
        { id: uuid(3), full_name: null, marca: "A9" },
        { id: uuid(4), full_name: "Sorin Dan", marca: "M4" },
      ],
    });

    const r = await angajatiPlanificator(ORG_ID, "2026-03-01", "2026-03-31");

    expect(r.map((a) => a.full_name ?? a.marca)).toEqual([
      "A9",
      "Sorin Dan",
      "Ștefan Pop",
      "Zoe Ionescu",
    ]);
    const [apel] = server.apeluriPe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "or")).toEqual([
      ["hired_on.is.null,hired_on.lte.2026-03-31"],
      ["terminated_on.is.null,terminated_on.gte.2026-03-01"],
    ]);
    expect(argumente(apel, "order")).toEqual([["id", { ascending: true }]]);
    // Pagina explicită: fără `.limit`, PostgREST taie tăcut la `max_rows`, iar
    // `citesteTot` n-ar mai ști că trebuie să ceară pagina următoare.
    expect(argumente(apel, "limit")).toEqual([[1000]]);
  });

  it("peste 1000 de angajați: citește pagina următoare după ultimul id, nu trunchiază", async () => {
    const pagina1 = Array.from({ length: 1000 }, (_v, i) => ({
      id: uuid(i + 1),
      full_name: `A${String(i).padStart(4, "0")}`,
      marca: "M",
    }));
    server.raspunde("employees", "select", { data: pagina1 });
    server.raspunde("employees", "select", {
      data: [{ id: uuid(1001), full_name: "B", marca: "M" }],
    });

    const r = await angajatiPlanificator(ORG_ID, "2026-03-01", "2026-03-31");

    expect(r).toHaveLength(1001);
    const [, a2] = server.apeluriPe("employees");
    expect(areFiltru(a2, "gt", "id", uuid(1000))).toBe(true);
  });
});

// ── Zilele nelucrătoare ───────────────────────────────────────────────────────

describe("zileNelucratoare", () => {
  it("sărbătorile naționale pe fiecare an din interval și zilele firmei pe interval", async () => {
    server.raspunde("public_holidays", "select", {
      data: [{ data: "2027-01-01", denumire: "Anul Nou" }],
    });
    server.raspunde("organization_holidays", "select", { data: null });

    const r = await zileNelucratoare(ORG_ID, 2026, 2027);

    expect(r).toEqual({
      nationale: [{ data: "2027-01-01", denumire: "Anul Nou" }],
      organizatie: [],
    });
    const [nationale] = server.apeluriPe("public_holidays");
    expect(areFiltru(nationale, "eq", "tara", "RO")).toBe(true);
    expect(areFiltru(nationale, "in", "an", [2026, 2027])).toBe(true);
    expect(areFiltru(nationale, "is", "deleted_at", null)).toBe(true);
    const [firma] = server.apeluriPe("organization_holidays");
    expect(areFiltru(firma, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(firma, "gte", "data", "2026-01-01")).toBe(true);
    expect(areFiltru(firma, "lte", "data", "2027-12-31")).toBe(true);
    // O zi liberă ștearsă nu se mai scade din cereri.
    expect(areFiltru(firma, "is", "deleted_at", null)).toBe(true);
  });

  it("eroare pe sărbătorile naționale: aruncă, nu le tratează ca zile lucrătoare", async () => {
    server.raspunde("public_holidays", "select", { error: eroarePostgrest("57014") });
    server.raspunde("organization_holidays", "select", { data: [] });
    await expect(zileNelucratoare(ORG_ID, 2040, 2040)).rejects.toMatchObject({ code: "57014" });
  });

  it("eroare pe zilele firmei: aruncă", async () => {
    server.raspunde("public_holidays", "select", { data: [] });
    server.raspunde("organization_holidays", "select", { error: eroarePostgrest("57014") });
    await expect(zileNelucratoare(ORG_ID, 2041, 2041)).rejects.toMatchObject({ code: "57014" });
  });
});

// ── Setările ──────────────────────────────────────────────────────────────────

describe("configurareConcedii", () => {
  it("tipuri (și cele inactive), reguli și departamente active, toate pe organizație", async () => {
    server.raspunde("leave_types", "select", { data: [{ id: TIP }] });
    server.raspunde("leave_entitlement_rules", "select", { data: null });
    server.raspunde("departments", "select", { data: [{ id: ID_1, denumire: "IT" }] });

    const r = await configurareConcedii(ORG_ID);

    expect(r).toEqual({
      tipuri: [{ id: TIP }],
      reguli: [],
      departamente: [{ id: ID_1, denumire: "IT" }],
    });
    for (const tabela of ["leave_types", "leave_entitlement_rules", "departments"]) {
      const [apel] = server.apeluriPe(tabela);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    expect(areFiltru(server.apeluriPe("leave_types")[0], "eq", "activ")).toBe(false);
    expect(areFiltru(server.apeluriPe("departments")[0], "eq", "activ", true)).toBe(true);
    expect(argumente(server.apeluriPe("leave_types")[0], "order")).toEqual([["denumire"]]);
    expect(argumente(server.apeluriPe("leave_entitlement_rules")[0], "order")).toEqual([
      ["valabil_de_la", { ascending: false }],
    ]);
    expect(argumente(server.apeluriPe("departments")[0], "order")).toEqual([["denumire"]]);
  });

  it.each(["leave_types", "leave_entitlement_rules", "departments"])(
    "eroare pe `%s`: aruncă, nu întoarce o configurare goală",
    async (tabela) => {
      for (const t of ["leave_types", "leave_entitlement_rules", "departments"]) {
        server.raspunde(
          t,
          "select",
          t === tabela ? { error: eroarePostgrest("57014") } : { data: [] },
        );
      }
      await expect(configurareConcedii(ORG_ID)).rejects.toMatchObject({ code: "57014" });
    },
  );
});

describe("previzualizeazaDrepturi", () => {
  it("RPC-ul de aplicare, în SIMULARE", async () => {
    server.raspundeRpc("aplica_drepturi_concediu", { data: null });
    expect(await previzualizeazaDrepturi(ORG_ID, 2026)).toEqual([]);
    expect(server.apeluriRpc).toEqual([
      {
        nume: "aplica_drepturi_concediu",
        argumente: { p_organization_id: ORG_ID, p_an: 2026, p_simulare: true },
      },
    ]);
  });

  it("eroarea funcției se aruncă, nu devine „nimic de schimbat”", async () => {
    server.raspundeRpc("aplica_drepturi_concediu", { error: eroarePostgrest("P0001") });
    await expect(previzualizeazaDrepturi(ORG_ID, 2026)).rejects.toMatchObject({ code: "P0001" });
  });
});

// ── Nomenclatoare ─────────────────────────────────────────────────────────────

describe("coduriIndemnizatieMedicala", () => {
  it("codurile valabile la data cererii, mapate la forma ecranului", async () => {
    server.raspunde("medical_leave_codes", "select", {
      data: [
        {
          id: ID_1,
          cod: "01",
          denumire: "Boală obișnuită",
          procent: 75,
          zile_angajator: 5,
          platitor: "mixt",
        },
      ],
    });
    const r = await coduriIndemnizatieMedicala("2026-07-06");
    expect(r).toEqual([
      {
        id: ID_1,
        cod: "01",
        denumire: "Boală obișnuită",
        procent: 75,
        zileAngajator: 5,
        platitor: "mixt",
      },
    ]);
    const [apel] = server.apeluriPe("medical_leave_codes");
    expect(areFiltru(apel, "lte", "valabil_de_la", "2026-07-06")).toBe(true);
    expect(argumente(apel, "or")).toEqual([
      ["valabil_pana_la.is.null,valabil_pana_la.gte.2026-07-06"],
    ]);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["cod", { ascending: true }]]);
  });

  it("eroarea se aruncă, nu devine o listă fără coduri", async () => {
    server.raspunde("medical_leave_codes", "select", { error: eroarePostgrest("57014") });
    await expect(coduriIndemnizatieMedicala("2026-07-06")).rejects.toMatchObject({
      code: "57014",
    });
  });
});

describe("varianteConcediu", () => {
  it("doar variantele active și nesterse, ordonate pe tip și apoi pe ordine", async () => {
    server.raspunde("leave_type_variants", "select", { data: null });
    expect(await varianteConcediu()).toEqual([]);
    const [apel] = server.apeluriPe("leave_type_variants");
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([
      ["leave_type_key", { ascending: true }],
      ["ordine", { ascending: true }],
    ]);
  });

  it("eroarea se aruncă, nu devine o listă fără variante", async () => {
    server.raspunde("leave_type_variants", "select", { error: eroarePostgrest("57014") });
    await expect(varianteConcediu()).rejects.toMatchObject({ code: "57014" });
  });
});

describe("cereriCareOcupaZile", () => {
  it("intervalele care se suprapun cu anii ceruți, în aceleași trei stări ca constrângerea", async () => {
    server.raspunde("leave_requests", "select", {
      data: [
        {
          id: "c1",
          employee_id: FISA,
          data_inceput: "2026-07-06",
          data_sfarsit: "2026-07-10",
          status: "aprobata",
          tip: { denumire: "Odihnă" },
        },
        {
          id: "c2",
          employee_id: FISA,
          data_inceput: "2026-12-30",
          data_sfarsit: "2026-12-31",
          status: "trimisa",
          tip: null,
        },
      ],
    });

    const r = await cereriCareOcupaZile(ORG_ID, 2026, 2026);

    expect(r.map((c) => c.denumire)).toEqual(["Odihnă", "Concediu"]);
    expect(r[0]).toEqual({
      id: "c1",
      employee_id: FISA,
      data_inceput: "2026-07-06",
      data_sfarsit: "2026-07-10",
      status: "aprobata",
      denumire: "Odihnă",
    });
    const [apel] = server.apeluriPe("leave_requests");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "status", ["trimisa", "in_aprobare", "aprobata"])).toBe(true);
    expect(areFiltru(apel, "gte", "data_sfarsit", "2026-01-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data_inceput", "2026-12-31")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(argumente(apel, "order")).toEqual([["data_inceput", { ascending: true }]]);
  });

  it("eroarea se aruncă, nu lasă calendarul să arate zile libere", async () => {
    server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
    await expect(cereriCareOcupaZile(ORG_ID, 2026, 2026)).rejects.toMatchObject({
      code: "57014",
    });
  });
});
