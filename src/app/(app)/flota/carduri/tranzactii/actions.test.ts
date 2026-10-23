// src/app/(app)/flota/carduri/tranzactii/actions.test.ts
//
// Reconcilierea tranzacțiilor de card (0214, F12b), pe clientul fals:
// ignorarea cere notă, legarea manuală cere foaia aceluiași vehicul și zi,
// repotrivirea scrie doar rândurile care își schimbă starea și nu atinge o
// legătură vie. „Adaugă pe foaie” ([DECIZIA-2c]) nu există: nu se testează.

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
  asteaptaDupa,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  ignoraTranzactie,
  leagaTranzactie,
  reactiveazaTranzactie,
  repotrivesteTranzactii,
} from "./actions";

const PERMISIUNI = {
  "vehicles:update": "all",
  "vehicles:read": "all",
} as const;
const VEHICUL = ID_2;
const FOAIE = ID_3;
const ALIMENTARE = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ignoraTranzactie", () => {
  it("fără notă: VALIDARE, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    expect(await ignoraTranzactie({ id: ID_1, nota: " " })).toMatchObject({
      ok: false,
      error: { code: "VALIDARE" },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("cu notă: desface legătura, firma în filtru, `.select()`; nota NU intră în audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "update", { data: { id: ID_1 } });
    const r = await ignoraTranzactie({
      id: ID_1,
      nota: "Suspiciune: alimentare pentru alt vehicul.",
    });
    await asteaptaDupa();
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_card_transactions", "update");
    expect(scriere?.payload).toEqual({
      stare_potrivire: "ignorata",
      fuel_entry_id: null,
      nota: "Suspiciune: alimentare pentru alt vehicul.",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
    expect(JSON.stringify(server.audituri())).not.toContain("Suspiciune");
  });

  it("zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "update", { data: null });
    expect(await ignoraTranzactie({ id: ID_1, nota: "Card de test." })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });
});

/*
 * F12b: lipsea „Reactivează” — o tranzacție ignorată din greșeală rămânea
 * ignorată pentru totdeauna (repotrivirea le sare pe ignorate).
 */
describe("reactiveazaTranzactie", () => {
  const ignorata = {
    id: ID_1,
    categorie: "combustibil",
    card_id: "card-1",
    vehicle_id: VEHICUL,
    trip_sheet_id: FOAIE,
    data_ro: "2026-10-05",
    stare_potrivire: "ignorata",
    fuel_entry_id: null,
  };
  const randLuna = {
    emitent: "omv_petrom",
    card_id: "card-1",
    card_ultimele_cifre: "1234",
    nr_inmatriculare_extras: null,
    efectuat_la: "2026-10-05T11:02:00.000Z",
    data_ro: "2026-10-05",
    are_ora: true,
    categorie: "combustibil",
    tip_combustibil: "motorina",
    cantitate: 52.3,
    valoare_bruta: 380.15,
    moneda: "RON",
    km_declarat: null,
    numar_bon: null,
    vehicle_id: VEHICUL,
    trip_sheet_id: FOAIE,
    fuel_entry_id: null,
    motiv: null,
  };

  function contextLuna(server: ReturnType<typeof configureazaActiunea>["server"]): void {
    server.raspunde("fuel_cards", "select", {
      data: [
        {
          id: "card-1",
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: VEHICUL,
          employee_id: null,
        },
      ],
      count: 1,
    });
    server.raspunde("vehicles", "select", {
      data: [
        { id: VEHICUL, nr_inmatriculare: "B100XYZ", tip_combustibil: "motorina", deleted_at: null },
      ],
      count: 1,
    });
    server.raspunde("vehicle_assignments", "select", { data: [], count: 0 });
    server.raspunde("trip_sheets", "select", {
      data: [
        {
          id: FOAIE,
          vehicle_id: VEHICUL,
          employee_id: ID_3,
          data: "2026-10-05",
          status: "aprobat",
          km_plecare: 1,
          km_sosire: 2,
        },
      ],
      count: 1,
    });
    server.raspunde("fuel_entries", "select", {
      data: [
        {
          id: ALIMENTARE,
          trip_sheet_id: FOAIE,
          litri: 52.3,
          cost: 380,
          alimentat_la: "2026-10-05T11:00:00.000Z",
          numar_bon: null,
        },
      ],
      count: 1,
    });
    server.raspunde("fuel_card_transactions", "select", { data: [] });
  }

  it("iese din `ignorata` fără notă, apoi se repotrivește DOAR ea: se leagă de alimentare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: ignorata });
    server.raspunde("fuel_card_transactions", "update", { data: { id: ID_1 } });
    // Luna, după prima scriere: rândul reactivat și un altul, nepotrivit, pe
    // care reactivarea NU are voie să-l atingă.
    server.raspunde("fuel_card_transactions", "select", {
      data: [
        { ...randLuna, id: ID_1, stare_potrivire: "fara_alimentare" },
        {
          ...randLuna,
          id: "tx-alta",
          card_id: null,
          vehicle_id: null,
          trip_sheet_id: null,
          stare_potrivire: "card_necunoscut",
        },
      ],
      count: 2,
    });
    contextLuna(server);
    server.raspunde("fuel_card_transactions", "update", { data: { id: ID_1 } });
    server.raspunde("fuel_card_transactions", "select", {
      data: { ...ignorata, fuel_entry_id: ALIMENTARE, stare_potrivire: "potrivita" },
    });

    const r = await reactiveazaTranzactie({ id: ID_1 });
    await asteaptaDupa();

    expect(r).toEqual({ ok: true, data: { id: ID_1, stare: "potrivita" } });
    const scrieri = server.apeluriPe("fuel_card_transactions", "update");
    expect(scrieri).toHaveLength(2);
    expect(scrieri[0]?.payload).toEqual({
      stare_potrivire: "fara_alimentare",
      nota: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(scrieri[0], "eq", "stare_potrivire", "ignorata")).toBe(true);
    expect(areFiltru(scrieri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scrieri[0]?.selectDupaScriere).toBe("id");
    expect(scrieri.every((s) => areFiltru(s, "eq", "id", ID_1))).toBe(true);
    expect(scrieri[1]?.payload).toMatchObject({
      fuel_entry_id: ALIMENTARE,
      stare_potrivire: "potrivita",
    });
  });

  it("o tranzacție care nu e ignorată: CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", {
      data: { ...ignorata, stare_potrivire: "fara_foaie" },
    });
    expect(await reactiveazaTranzactie({ id: ID_1 })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
    expect(server.apeluriPe("fuel_card_transactions", "update")).toHaveLength(0);
  });

  it("zero rânduri la scriere (reactivată între timp): CONFLICT, fără repotrivire", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: ignorata });
    server.raspunde("fuel_card_transactions", "update", { data: null });
    expect(await reactiveazaTranzactie({ id: ID_1 })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
    expect(server.apeluriPe("fuel_cards")).toHaveLength(0);
  });

  it("fără `vehicles:update = all`: refuz, fără drum la bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "vehicles:update": "team" } });
    expect(await reactiveazaTranzactie({ id: ID_1 })).toMatchObject({ ok: false });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("leagaTranzactie", () => {
  const tx = {
    id: ID_1,
    categorie: "combustibil",
    vehicle_id: VEHICUL,
    data_ro: "2026-10-05",
    stare_potrivire: "fara_alimentare",
    fuel_entry_id: null,
  };

  it("leagă de alimentarea de pe foaia aceluiași vehicul, din aceeași zi", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: tx });
    server.raspunde("fuel_entries", "select", {
      data: {
        id: ALIMENTARE,
        trip_sheet_id: FOAIE,
        foaie: { id: FOAIE, vehicle_id: VEHICUL, data: "2026-10-05" },
      },
    });
    server.raspunde("fuel_card_transactions", "update", { data: { id: ID_1 } });

    const r = await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [scriere] = server.apeluriPe("fuel_card_transactions", "update");
    expect(scriere?.payload).toEqual({
      fuel_entry_id: ALIMENTARE,
      stare_potrivire: "potrivita",
      motiv: "Legată manual.",
      updated_by: USER_ID,
    });
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBe("id");
  });

  it("alimentarea din altă zi: VALIDARE pe câmp, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: tx });
    server.raspunde("fuel_entries", "select", {
      data: {
        id: ALIMENTARE,
        trip_sheet_id: FOAIE,
        foaie: { id: FOAIE, vehicle_id: VEHICUL, data: "2026-10-06" },
      },
    });
    const r = await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: { fuel_entry_id: expect.any(Array) },
      },
    });
    expect(server.apeluriPe("fuel_card_transactions", "update")).toHaveLength(0);
  });

  it("AdBlue nu se leagă de o alimentare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", {
      data: { ...tx, categorie: "adblue" },
    });
    server.raspunde("fuel_entries", "select", { data: null });
    expect(await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE })).toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("23505 pe `fctx_alimentare_uq`: alimentarea e deja legată", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", { data: tx });
    server.raspunde("fuel_entries", "select", {
      data: {
        id: ALIMENTARE,
        trip_sheet_id: FOAIE,
        foaie: { id: FOAIE, vehicle_id: VEHICUL, data: "2026-10-05" },
      },
    });
    server.raspunde("fuel_card_transactions", "update", {
      error: eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "fctx_alimentare_uq"',
      ),
    });
    expect(await leagaTranzactie({ id: ID_1, fuel_entry_id: ALIMENTARE })).toMatchObject({
      ok: false,
      error: {
        code: "VALIDARE",
        fieldErrors: {
          fuel_entry_id: ["Alimentarea e deja legată de altă tranzacție."],
        },
      },
    });
  });
});

describe("repotrivesteTranzactii", () => {
  const baza = {
    emitent: "omv_petrom",
    card_id: null,
    card_ultimele_cifre: "1234",
    nr_inmatriculare_extras: null,
    efectuat_la: "2026-10-05T11:02:00.000Z",
    data_ro: "2026-10-05",
    are_ora: true,
    categorie: "combustibil",
    tip_combustibil: "motorina",
    cantitate: 52.3,
    valoare_bruta: 380.15,
    moneda: "RON",
    km_declarat: null,
    numar_bon: null,
    vehicle_id: null,
    trip_sheet_id: null,
    fuel_entry_id: null,
    motiv: null,
  };

  it("cardul înregistrat între timp: rândul `card_necunoscut` se potrivește; legătura vie rămâne", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    server.raspunde("fuel_card_transactions", "select", {
      data: [
        { ...baza, id: "tx-nou", stare_potrivire: "card_necunoscut" },
        {
          ...baza,
          id: "tx-legat",
          card_id: "card-1",
          vehicle_id: VEHICUL,
          trip_sheet_id: FOAIE,
          fuel_entry_id: ALIMENTARE,
          stare_potrivire: "potrivita",
          motiv: "Legată manual.",
        },
      ],
      count: 2,
    });
    server.raspunde("fuel_cards", "select", {
      data: [
        {
          id: "card-1",
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: VEHICUL,
          employee_id: null,
        },
      ],
      count: 1,
    });
    server.raspunde("vehicles", "select", {
      data: [
        {
          id: VEHICUL,
          nr_inmatriculare: "B100XYZ",
          tip_combustibil: "motorina",
          deleted_at: null,
        },
      ],
      count: 1,
    });
    server.raspunde("vehicle_assignments", "select", { data: [], count: 0 });
    server.raspunde("trip_sheets", "select", {
      data: [
        {
          id: FOAIE,
          vehicle_id: VEHICUL,
          employee_id: ID_3,
          data: "2026-10-05",
          status: "aprobat",
          km_plecare: 1,
          km_sosire: 2,
        },
      ],
      count: 1,
    });
    server.raspunde("fuel_entries", "select", {
      data: [
        {
          id: ALIMENTARE,
          trip_sheet_id: FOAIE,
          litri: 52.3,
          cost: 380,
          alimentat_la: "2026-10-05T11:00:00.000Z",
          numar_bon: null,
        },
      ],
      count: 1,
    });
    server.raspunde("fuel_card_transactions", "select", {
      data: [{ id: "tx-legat", fuel_entry_id: ALIMENTARE }],
    });
    server.raspunde("fuel_card_transactions", "update", {
      data: { id: "tx-nou" },
    });

    const r = await repotrivesteTranzactii({ luna: "2026-10" });

    expect(r).toEqual({ ok: true, data: { verificate: 1, schimbate: 1 } });
    const scrieri = server.apeluriPe("fuel_card_transactions", "update");
    expect(scrieri).toHaveLength(1);
    expect(areFiltru(scrieri[0], "eq", "id", "tx-nou")).toBe(true);
    // Alimentarea e ținută de legătura manuală: rândul nou ajunge „fără alimentare”.
    expect(scrieri[0]?.payload).toMatchObject({
      card_id: "card-1",
      vehicle_id: VEHICUL,
      trip_sheet_id: FOAIE,
      fuel_entry_id: null,
      stare_potrivire: "fara_alimentare",
    });
  });

  /*
   * `fctx_alimentare_uq` e un index unic (nu o restricție amânabilă): fiecare
   * UPDATE e judecat pe loc. Clientul fals nu știe de el, așa că testul reface
   * indexul peste șirul de scrieri trimise, în ordinea lor, pornind de la
   * legăturile din bază. Prima scriere care ar lua o alimentare ținută încă de
   * alt rând e exact 23505-ul pe care l-ar întoarce Postgres.
   */
  function primulConflict(
    scrieri: ReturnType<ReturnType<typeof configureazaActiunea>["server"]["apeluriPe"]>,
    legaturiInitiale: Readonly<Record<string, string>>,
  ): string | null {
    const detinator = new Map(Object.entries(legaturiInitiale));
    for (const s of scrieri) {
      const id = s.filtre.find((f) => f.metoda === "eq" && f.argumente[0] === "id")
        ?.argumente[1] as string;
      const payload = s.payload as { fuel_entry_id?: string | null };
      if (!("fuel_entry_id" in payload)) continue;
      for (const [alimentare, tx] of detinator) if (tx === id) detinator.delete(alimentare);
      const noua = payload.fuel_entry_id ?? null;
      if (noua === null) continue;
      const alt = detinator.get(noua);
      if (alt !== undefined && alt !== id) return `${id} ia ${noua}, ținută încă de ${alt}`;
      detinator.set(noua, id);
    }
    return null;
  }

  const ALIMENTARE_2 = "88888888-8888-4888-8888-888888888888";

  function contextUnei(
    server: ReturnType<typeof configureazaActiunea>["server"],
    alimentari: readonly Readonly<{
      id: string;
      litri: number;
      cost: number;
      ora: string;
      bon: string | null;
    }>[],
    legaturi: readonly Readonly<{ id: string; fuel_entry_id: string }>[],
  ) {
    server.raspunde("fuel_cards", "select", {
      data: [
        {
          id: "card-1",
          emitent: "omv_petrom",
          ultimele_cifre: "1234",
          amprenta_numar: null,
          vehicle_id: VEHICUL,
          employee_id: null,
        },
      ],
      count: 1,
    });
    server.raspunde("vehicles", "select", {
      data: [
        {
          id: VEHICUL,
          nr_inmatriculare: "B100XYZ",
          tip_combustibil: "motorina",
          deleted_at: null,
          data_iesire: null,
        },
      ],
      count: 1,
    });
    server.raspunde("vehicle_assignments", "select", { data: [], count: 0 });
    server.raspunde("trip_sheets", "select", {
      data: [
        {
          id: FOAIE,
          vehicle_id: VEHICUL,
          employee_id: ID_3,
          data: "2026-10-05",
          status: "aprobat",
          km_plecare: 1,
          km_sosire: 2,
        },
      ],
      count: 1,
    });
    server.raspunde("fuel_entries", "select", {
      data: alimentari.map((a) => ({
        id: a.id,
        trip_sheet_id: FOAIE,
        litri: a.litri,
        cost: a.cost,
        alimentat_la: a.ora,
        numar_bon: a.bon,
      })),
      count: alimentari.length,
    });
    server.raspunde("fuel_card_transactions", "select", { data: legaturi });
  }

  it("alimentarea trece de la un rând refăcut la altul: întâi se eliberează, apoi se ia (fără 23505)", async () => {
    // Importul, în ordinea fișierului (A înaintea lui B), i-a dat alimentarea
    // lui A, pe litri, cu valoarea în afara toleranței: `diferenta`. Repotrivirea
    // merge după oră (B, 09:50, înaintea lui A, 10:30), iar B, cu bonul egal, o
    // câștigă. Scrisă înaintea eliberării lui A, legarea lui B cade pe
    // `fctx_alimentare_uq` la fiecare reîncercare.
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    const comun = { ...baza, card_id: "card-1", vehicle_id: VEHICUL, cantitate: 40 };
    server.raspunde("fuel_card_transactions", "select", {
      data: [
        {
          ...comun,
          id: "tx-b",
          efectuat_la: "2026-10-05T06:50:00.000Z",
          cantitate: 40.2,
          valoare_bruta: 281,
          numar_bon: "123",
          trip_sheet_id: FOAIE,
          stare_potrivire: "fara_alimentare",
        },
        {
          ...comun,
          id: "tx-a",
          efectuat_la: "2026-10-05T07:30:00.000Z",
          valoare_bruta: 300,
          trip_sheet_id: FOAIE,
          fuel_entry_id: ALIMENTARE,
          stare_potrivire: "diferenta",
          motiv: "Diferență față de alimentarea declarată (valoare: card 300 lei, foaie 280 lei).",
        },
      ],
      count: 2,
    });
    contextUnei(
      server,
      [{ id: ALIMENTARE, litri: 40, cost: 280, ora: "2026-10-05T07:00:00.000Z", bon: "123" }],
      [{ id: "tx-a", fuel_entry_id: ALIMENTARE }],
    );
    server.raspunde("fuel_card_transactions", "update", { data: { id: "x" } });
    server.raspunde("fuel_card_transactions", "update", { data: { id: "x" } });
    server.raspunde("fuel_card_transactions", "update", { data: { id: "x" } });

    const r = await repotrivesteTranzactii({ luna: "2026-10" });

    expect(r).toEqual({ ok: true, data: { verificate: 2, schimbate: 2 } });
    const scrieri = server.apeluriPe("fuel_card_transactions", "update");
    expect(primulConflict(scrieri, { [ALIMENTARE]: "tx-a" })).toBeNull();
    // A pierde alimentarea fără să primească alta: o singură scriere, direct finală.
    expect(scrieri).toHaveLength(2);
    const ultima = (id: string) =>
      scrieri.filter((s) => areFiltru(s, "eq", "id", id)).at(-1)?.payload;
    expect(ultima("tx-b")).toMatchObject({
      fuel_entry_id: ALIMENTARE,
      stare_potrivire: "potrivita",
    });
    expect(ultima("tx-a")).toMatchObject({
      fuel_entry_id: null,
      stare_potrivire: "fara_alimentare",
    });
  });

  it("două rânduri refăcute își schimbă alimentările între ele: niciun 23505", async () => {
    // Bonurile au fost corectate pe foaie după import: A ținea X și trebuie să
    // ia Y, B ținea Y și trebuie să ia X. Oricare ar scrie primul, ar lua o
    // alimentare ținută încă de celălalt; doar eliberarea întâi rupe cercul.
    const { server } = configureazaActiunea({ permisiuni: PERMISIUNI });
    const comun = {
      ...baza,
      card_id: "card-1",
      vehicle_id: VEHICUL,
      trip_sheet_id: FOAIE,
      stare_potrivire: "diferenta",
      motiv: "Diferență față de alimentarea declarată (litri: card 40, foaie 30).",
    };
    server.raspunde("fuel_card_transactions", "select", {
      data: [
        {
          ...comun,
          id: "tx-b",
          efectuat_la: "2026-10-05T06:00:00.000Z",
          cantitate: 40,
          valoare_bruta: 300,
          numar_bon: "111",
          fuel_entry_id: ALIMENTARE_2,
        },
        {
          ...comun,
          id: "tx-a",
          efectuat_la: "2026-10-05T10:00:00.000Z",
          cantitate: 30,
          valoare_bruta: 225,
          numar_bon: "222",
          fuel_entry_id: ALIMENTARE,
        },
      ],
      count: 2,
    });
    contextUnei(
      server,
      [
        { id: ALIMENTARE, litri: 40, cost: 300, ora: "2026-10-05T06:00:00.000Z", bon: "111" },
        { id: ALIMENTARE_2, litri: 30, cost: 225, ora: "2026-10-05T10:00:00.000Z", bon: "222" },
      ],
      [
        { id: "tx-a", fuel_entry_id: ALIMENTARE },
        { id: "tx-b", fuel_entry_id: ALIMENTARE_2 },
      ],
    );
    for (let i = 0; i < 4; i += 1) {
      server.raspunde("fuel_card_transactions", "update", { data: { id: "x" } });
    }

    const r = await repotrivesteTranzactii({ luna: "2026-10" });

    expect(r).toEqual({ ok: true, data: { verificate: 2, schimbate: 2 } });
    const scrieri = server.apeluriPe("fuel_card_transactions", "update");
    expect(primulConflict(scrieri, { [ALIMENTARE]: "tx-a", [ALIMENTARE_2]: "tx-b" })).toBeNull();
    const ultima = (id: string) =>
      scrieri.filter((s) => areFiltru(s, "eq", "id", id)).at(-1)?.payload;
    expect(ultima("tx-b")).toMatchObject({
      fuel_entry_id: ALIMENTARE,
      stare_potrivire: "potrivita",
    });
    expect(ultima("tx-a")).toMatchObject({
      fuel_entry_id: ALIMENTARE_2,
      stare_potrivire: "potrivita",
    });
  });

  it("luna invalidă: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: PERMISIUNI });
    expect(await repotrivesteTranzactii({ luna: "2026-13" })).toMatchObject({
      ok: false,
      error: { code: "VALIDARE" },
    });
  });
});
