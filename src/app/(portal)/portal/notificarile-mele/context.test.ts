// src/app/(portal)/portal/notificarile-mele/context.test.ts
//
// `contexteDestinatar` pe clientul fals: cine DEȚINE entitatea din spatele
// unei legături. Aici doar foaia de parcurs (0198); restul felurilor sunt
// probate prin apelanți (`src/lib/push/coada.test.ts`).

import { describe, expect, it, vi } from "vitest";

import { areFiltru, clientFals } from "@/lib/teste/supabase-fals";

import { contexteDestinatar } from "./context";
import { caleaDePortal } from "./legaturi";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOAIE = "3f8c1d2e-1111-4222-8333-444455556666";
const FISA_SOFER = "9a7b6c5d-2222-4333-8444-555566667777";
const USER_SOFER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_MANAGER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("contexteDestinatar — foaia de parcurs (0198)", () => {
  it("foaia îi aparține ȘOFERULUI ei; managerul care a primit aceeași legătură nu o deține", async () => {
    const db = clientFals();
    db.raspunde("trip_sheets", "select", { data: [{ id: FOAIE, employee_id: FISA_SOFER }] });
    db.raspunde("employees", "select", { data: [{ id: FISA_SOFER, user_id: USER_SOFER }] });

    const contexte = await contexteDestinatar(
      db.client,
      [ORG],
      [`/flota/foi/${FOAIE}`, `/flota/foi/${FOAIE}`],
    );

    // Filtrul explicit pe firmă: apelantul din coada de push ocolește RLS.
    const [citire] = db.apeluriPe("trip_sheets", "select");
    expect(areFiltru(citire, "in", "organization_id", [ORG])).toBe(true);
    expect(areFiltru(citire, "in", "id", [FOAIE])).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const alSoferului = contexte.get(USER_SOFER);
    expect(alSoferului?.foiProprii?.has(FOAIE)).toBe(true);
    expect(caleaDePortal(`/flota/foi/${FOAIE}`, alSoferului)).toBe(
      `/portal/masina-mea/foi/${FOAIE}`,
    );
    expect(contexte.get(USER_MANAGER)).toBeUndefined();
  });

  it("citirea picată degradează la cutia poștală, nu oprește randarea", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = clientFals();
    db.raspunde("trip_sheets", "select", {
      error: { code: "42501", message: "refuz", details: null, hint: null },
    });
    const contexte = await contexteDestinatar(db.client, [ORG], [`/flota/foi/${FOAIE}`]);
    expect(contexte.size).toBe(0);
    vi.restoreAllMocks();
  });

  it("fără legături de foaie nu se citește `trip_sheets` deloc", async () => {
    const db = clientFals();
    await contexteDestinatar(db.client, [ORG], ["/pontaj"]);
    expect(db.apeluriPe("trip_sheets", "select")).toHaveLength(0);
  });
});
