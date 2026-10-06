// src/app/(app)/pontaj/saptamana/scrie-pontajul-varianta.test.ts
//
// Săptămâna devine pontaj — drumul întreg, pe clientul fals: citirea
// submisiei, setările de la data săptămânii, luna blocată, rescrierea din
// varianta săptămânală (0165) și aprobarea purtată pe rânduri.
//
// Clientul fals NU aplică RLS și nici triggerele; ce prinde aici e forma
// interogărilor — filtrul pe organizație, zilele atinse, valorile scrise.
// Triggerul din 0165 are proba lui: `tests/rls/proba-pontaj-saptamanal.sql`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

const colaboratori = vi.hoisted(() => ({ zileNelucratoare: vi.fn() }));
vi.mock("@/lib/queries/leave", () => ({ zileNelucratoare: colaboratori.zileNelucratoare }));

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { scrieSaptamanaInPontaj } from "./scrie-pontajul";

/** Luni 28 septembrie 2026: săptămâna trece din septembrie în octombrie. */
const LUNI = "2026-09-28";
const ZILE_OCTOMBRIE = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

function setari() {
  return {
    ore_pe_zi: 8,
    noapte_start: "22:00:00",
    noapte_sfarsit: "06:00:00",
    pauza_masa_minute: 0,
    pauza_masa_inclusa_in_program: true,
    pauza_obligatorie_peste_ore: 0,
  };
}

/**
 * Drumul obișnuit: submisia, setările, perioadele, zilele submisiei, rândurile
 * existente. `blocata` = luna lui `LUNI` e blocată.
 */
function pregateste(
  server: ClientFals,
  admin: ClientFals,
  { blocata = false, rescrie = false }: { blocata?: boolean; rescrie?: boolean } = {},
) {
  admin.raspunde("attendance_week_submissions", "select", {
    data: { employee_id: ID_3, saptamana_start: LUNI },
  });
  server.raspunde("attendance_settings", "select", { data: setari() });
  admin.raspunde("attendance_week_submissions", "select", { data: { saptamana_start: LUNI } });
  admin.raspunde("attendance_periods", "select", {
    data: blocata ? [{ an: 2026, luna: 9, status: "blocata" }] : [],
  });
  if (rescrie) admin.raspunde("attendance_entries", "update", { data: null });
  admin.raspunde("attendance_week_submission_days", "select", {
    data: [
      {
        data: "2026-10-01",
        ora_inceput: "09:00:00",
        ora_sfarsit: "17:00:00",
        tip_prezenta: "birou",
        observatii: null,
      },
    ],
  });
  admin.raspunde("attendance_entries", "select", { data: [] });
  admin.raspunde("attendance_entries", "insert", { data: null });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  colaboratori.zileNelucratoare.mockReset().mockResolvedValue({ nationale: [], organizatie: [] });
});

describe("scrieSaptamanaInPontaj", () => {
  it("submisia negăsită nu scrie nimic", async () => {
    const { admin } = configureazaActiunea();
    admin.raspunde("attendance_week_submissions", "select", { data: null });

    const r = await scrieSaptamanaInPontaj(admin.client, ORG_ID, ID_1, {
      aprobare: null,
      rescrie: true,
      requestId: "r",
    });

    expect(r).toEqual({ scrise: 0, pastrate: 0 });
    expect(admin.apeluriPe("attendance_entries")).toHaveLength(0);
  });

  it("aprobarea: zilele sosesc aprobate, fără să se rescrie ce exista", async () => {
    const { server, admin } = configureazaActiunea();
    pregateste(server, admin);

    const r = await scrieSaptamanaInPontaj(admin.client, ORG_ID, ID_1, {
      aprobare: { de: USER_ID, la: "2026-10-05T10:00:00.000Z" },
      rescrie: false,
      requestId: "r",
    });

    expect(r).toEqual({ scrise: 1, pastrate: 0 });
    expect(admin.apeluriPe("attendance_entries", "update")).toHaveLength(0);
    const [insert] = admin.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        employee_id: ID_3,
        data: "2026-10-01",
        ore_lucrate: 8,
        sursa: "saptamana",
        approved_at: "2026-10-05T10:00:00.000Z",
        approved_by: USER_ID,
      }),
    ]);
  });

  /*
    Varianta săptămânală, fără aprobare: retrimiterea trebuie să CORECTEZE
    pontajul — rândurile `saptamana` ale săptămânii se șterg logic întâi, doar
    pe organizație, angajat și sursă; zilele scrise apar neaprobate.
  */
  it("rescrierea șterge logic doar rândurile `saptamana` ale săptămânii, apoi scrie neaprobat", async () => {
    const { server, admin } = configureazaActiunea();
    pregateste(server, admin, { rescrie: true });

    const r = await scrieSaptamanaInPontaj(admin.client, ORG_ID, ID_1, {
      aprobare: null,
      rescrie: true,
      requestId: "r",
    });

    expect(r).toEqual({ scrise: 1, pastrate: 0 });
    const [stergere] = admin.apeluriPe("attendance_entries", "update");
    expect(stergere?.payload).toMatchObject({ deleted_at: expect.any(String) });
    expect(areFiltru(stergere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(stergere, "eq", "employee_id", ID_3)).toBe(true);
    expect(areFiltru(stergere, "eq", "sursa", "saptamana")).toBe(true);
    expect(areFiltru(stergere, "is", "deleted_at", null)).toBe(true);
    const [insert] = admin.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toEqual([
      expect.objectContaining({ approved_at: null, approved_by: null }),
    ]);
  });

  /*
    Clientul admin ocolește triggerul lunii blocate (0132:146). Fără garda din
    `scrie-pontajul.ts`, o retrimitere ar fi rescris o lună deja închisă pentru
    salarizare.
  */
  /*
    Ștergerea și inserarea nu sunt o tranzacție. Dacă inserarea cade, rândurile
    șterse se pun la loc — altfel retrimiterea ar fi golit tăcut pontajul
    săptămânii, cu eroarea oprită în jurnal. Găsit de revizia adversarială.
  */
  it("inserarea căzută după rescriere pune la loc rândurile șterse", async () => {
    const { server, admin } = configureazaActiunea();
    admin.raspunde("attendance_week_submissions", "select", {
      data: { employee_id: ID_3, saptamana_start: LUNI },
    });
    server.raspunde("attendance_settings", "select", { data: setari() });
    admin.raspunde("attendance_week_submissions", "select", { data: { saptamana_start: LUNI } });
    admin.raspunde("attendance_periods", "select", { data: [] });
    admin.raspunde("attendance_entries", "update", { data: [{ id: ID_2 }] });
    admin.raspunde("attendance_week_submission_days", "select", {
      data: [
        {
          data: "2026-10-01",
          ora_inceput: "09:00:00",
          ora_sfarsit: "17:00:00",
          tip_prezenta: "birou",
          observatii: null,
        },
      ],
    });
    admin.raspunde("attendance_entries", "select", { data: [] });
    admin.raspunde("attendance_entries", "insert", { error: eroarePostgrest("23505") });
    admin.raspunde("attendance_entries", "update", { data: null });

    const r = await scrieSaptamanaInPontaj(admin.client, ORG_ID, ID_1, {
      aprobare: null,
      rescrie: true,
      requestId: "r",
    });

    expect(r).toEqual({ scrise: 0, pastrate: 0 });
    const [, restaurare] = admin.apeluriPe("attendance_entries", "update");
    expect(restaurare?.payload).toEqual({ deleted_at: null });
    expect(areFiltru(restaurare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(restaurare, "in", "id", [ID_2])).toBe(true);
  });

  it("zilele din luna blocată nu se ating — nici la ștergere, nici la scriere", async () => {
    const { server, admin } = configureazaActiunea();
    pregateste(server, admin, { blocata: true, rescrie: true });

    await scrieSaptamanaInPontaj(admin.client, ORG_ID, ID_1, {
      aprobare: null,
      rescrie: true,
      requestId: "r",
    });

    const [stergere] = admin.apeluriPe("attendance_entries", "update");
    expect(areFiltru(stergere, "in", "data", ZILE_OCTOMBRIE)).toBe(true);
    const [zile] = admin.apeluriPe("attendance_week_submission_days", "select");
    expect(areFiltru(zile, "in", "data", ZILE_OCTOMBRIE)).toBe(true);
  });

  it("săptămâna întreagă în luna blocată nu atinge deloc pontajul", async () => {
    const { server, admin } = configureazaActiunea();
    admin.raspunde("attendance_week_submissions", "select", {
      data: { employee_id: ID_3, saptamana_start: "2026-09-07" },
    });
    server.raspunde("attendance_settings", "select", { data: setari() });
    admin.raspunde("attendance_week_submissions", "select", {
      data: { saptamana_start: "2026-09-07" },
    });
    admin.raspunde("attendance_periods", "select", {
      data: [{ an: 2026, luna: 9, status: "blocata" }],
    });

    const r = await scrieSaptamanaInPontaj(admin.client, ORG_ID, ID_1, {
      aprobare: null,
      rescrie: true,
      requestId: "r",
    });

    expect(r).toEqual({ scrise: 0, pastrate: 0 });
    expect(admin.apeluriPe("attendance_entries")).toHaveLength(0);
  });
});
