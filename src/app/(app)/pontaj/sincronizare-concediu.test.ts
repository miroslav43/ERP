// src/app/(app)/pontaj/sincronizare-concediu.test.ts
//
// Nucleul concediu → pontaj, chemat și din `decideCerere` (concedii), și din
// `sincronizeazaConcediile`. Clientul se PRIMEȘTE ca argument, deci falsul se
// dă direct, fără niciun `vi.mock`.

import { describe, expect, it } from "vitest";

import { ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  sincronizeazaZileleDeConcediu,
  type ZiConcediuDeSincronizat,
} from "./sincronizare-concediu";

const ALT_ANGAJAT = "88888888-8888-4888-8888-888888888888";

const zi = (
  data: string,
  extra: Partial<ZiConcediuDeSincronizat> = {},
): ZiConcediuDeSincronizat => ({
  employee_id: ID_3,
  data,
  leave_request_id: ID_1,
  tip_zi: "concediu",
  ...extra,
});

describe("sincronizeazaZileleDeConcediu", () => {
  it("lista goală nu atinge baza", async () => {
    const fals = clientFals();
    expect(await sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [])).toEqual({
      create: 0,
      actualizate: 0,
      inlocuite: 0,
      pastrate: 0,
    });
    expect(fals.apeluri).toHaveLength(0);
  });

  it("citește existentele O SINGURĂ dată, pe reuniunea angajaților și pe intervalul min–max", async () => {
    const fals = clientFals();
    fals.raspunde("attendance_entries", "select", { data: [] });
    fals.raspunde("attendance_entries", "insert", {});
    fals.raspunde("attendance_entries", "insert", {});
    fals.raspunde("attendance_entries", "insert", {});

    await sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [
      zi("2026-07-20"),
      zi("2026-07-06", { employee_id: ALT_ANGAJAT }),
      zi("2026-07-14"),
    ]);

    const citiri = fals.apeluriPe("attendance_entries", "select");
    expect(citiri).toHaveLength(1);
    const [citire] = citiri;
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "in", "employee_id", [ID_3, ALT_ANGAJAT])).toBe(true);
    expect(areFiltru(citire, "gte", "data", "2026-07-06")).toBe(true);
    expect(areFiltru(citire, "lte", "data", "2026-07-20")).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
  });

  it("zi nouă ⇒ INSERT cu zero ore, sursa sincronizării și tipul din concediu", async () => {
    const fals = clientFals();
    fals.raspunde("attendance_entries", "select", { data: [] });
    fals.raspunde("attendance_entries", "insert", {});

    const r = await sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [
      zi("2026-07-14", { tip_zi: "medical", leave_request_id: ID_2 }),
    ]);

    expect(r).toEqual({ create: 1, actualizate: 0, inlocuite: 0, pastrate: 0 });
    const [insert] = fals.apeluriPe("attendance_entries", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_3,
      data: "2026-07-14",
      ore_lucrate: 0,
      ore_suplimentare: 0,
      ore_noapte: 0,
      tip_zi: "medical",
      sursa: "sincronizare_concedii",
      leave_request_id: ID_2,
    });
    expect(typeof (insert?.payload as { period_id: unknown }).period_id).toBe("string");
  });

  it("zi scrisă de o sincronizare anterioară ⇒ UPDATE pe id + organizație", async () => {
    const fals = clientFals();
    fals.raspunde("attendance_entries", "select", {
      data: [{ id: "z1", employee_id: ID_3, data: "2026-07-14", sursa: "sincronizare_concedii" }],
    });
    // Rândul chiar scris: o zi refuzată tăcut nu se numără (testul de mai jos).
    fals.raspunde("attendance_entries", "update", { data: { id: "z1" } });

    const r = await sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [
      zi("2026-07-14", { tip_zi: "medical" }),
    ]);

    expect(r).toEqual({ create: 0, actualizate: 1, inlocuite: 0, pastrate: 0 });
    const [update] = fals.apeluriPe("attendance_entries", "update");
    expect(update?.payload).toEqual({
      tip_zi: "medical",
      ore_lucrate: 0,
      ore_suplimentare: 0,
      ore_noapte: 0,
      leave_request_id: ID_1,
    });
    expect(areFiltru(update, "eq", "id", "z1")).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it.each(["manuala", "pontare_rapida", "import", "saptamana"])(
    "zi cu sursa `%s` ⇒ concediul aprobat o ÎNLOCUIEȘTE, pe același rând",
    async (sursa) => {
      // Concediul de urgență: ziua era deja pontată (sau completată din plan),
      // iar omul n-a mai venit. Concediul aprobat e ultima decizie despre zi;
      // valorile vechi rămân în `audit_logs`, prin `audit_attendance_entries`.
      const fals = clientFals();
      fals.raspunde("attendance_entries", "select", {
        data: [{ id: "z1", employee_id: ID_3, data: "2026-07-14", sursa }],
      });
      fals.raspunde("attendance_entries", "update", { data: { id: "z1" } });

      const r = await sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [zi("2026-07-14")]);

      expect(r).toEqual({ create: 0, actualizate: 0, inlocuite: 1, pastrate: 0 });
      expect(fals.apeluriPe("attendance_entries", "insert")).toHaveLength(0);
      const [update] = fals.apeluriPe("attendance_entries", "update");
      expect(update?.payload).toEqual({
        tip_zi: "concediu",
        ore_lucrate: 0,
        ore_suplimentare: 0,
        ore_noapte: 0,
        leave_request_id: ID_1,
        sursa: "sincronizare_concedii",
        ora_inceput: null,
        ora_sfarsit: null,
        tip_prezenta: null,
        punct_lucru_id: null,
        punct_lucru_declarat_id: null,
        approved_at: null,
        approved_by: null,
        batch_id: null,
        respins_la: null,
        respins_de: null,
        motiv_respingere: null,
      });
      expect(areFiltru(update, "eq", "id", "z1")).toBe(true);
      expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(update?.selectDupaScriere).toBeDefined();
    },
  );

  it("zi pontată pe care UPDATE-ul n-o atinge (zero rânduri) ⇒ PĂSTRATĂ, nu înlocuită", async () => {
    const fals = clientFals();
    fals.raspunde("attendance_entries", "select", {
      data: [{ id: "z1", employee_id: ID_3, data: "2026-07-14", sursa: "manuala" }],
    });
    fals.raspunde("attendance_entries", "update", { data: null });
    const r = await sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [zi("2026-07-14")]);
    expect(r).toEqual({ create: 0, actualizate: 0, inlocuite: 0, pastrate: 1 });
  });

  it("ziua altui angajat în aceeași dată nu e confundată cu a acestuia", async () => {
    const fals = clientFals();
    fals.raspunde("attendance_entries", "select", {
      data: [{ id: "z1", employee_id: ALT_ANGAJAT, data: "2026-07-14", sursa: "manuala" }],
    });
    fals.raspunde("attendance_entries", "insert", {});
    const r = await sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [zi("2026-07-14")]);
    expect(r).toEqual({ create: 1, actualizate: 0, inlocuite: 0, pastrate: 0 });
  });

  it("P0001 la INSERT (lună blocată) ⇒ se aruncă CONFLICT cu mesajul triggerului", async () => {
    const fals = clientFals();
    const mesaj = "Perioada de pontaj 07.2026 este blocată.";
    fals.raspunde("attendance_entries", "select", { data: [] });
    fals.raspunde("attendance_entries", "insert", { error: eroarePostgrest("P0001", mesaj) });
    await expect(
      sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [zi("2026-07-14")]),
    ).rejects.toMatchObject({ code: "CONFLICT", message: mesaj });
  });

  it("eroarea citirii existentelor se propagă neschimbată", async () => {
    const fals = clientFals();
    const eroare = eroarePostgrest("42501");
    fals.raspunde("attendance_entries", "select", { error: eroare });
    await expect(
      sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [zi("2026-07-14")]),
    ).rejects.toBe(eroare);
  });

  // UPDATE-ul nu are `.select()`: o zi aprobată între timp, refuzată tăcut de
  // `USING` (zero rânduri, fără eroare), se numără totuși „actualizată”, iar
  // ecranul raportează o sincronizare care nu s-a produs (capcana 17).
  it("o zi refuzată tăcut de USING (zero rânduri) nu se numără actualizată", async () => {
    const fals = clientFals();
    fals.raspunde("attendance_entries", "select", {
      data: [{ id: "z1", employee_id: ID_3, data: "2026-07-14", sursa: "sincronizare_concedii" }],
    });
    fals.raspunde("attendance_entries", "update", { data: null });
    // Forma cerută după reparație: sincronizarea se încheie normal și NU
    // numără ziua refuzată. O reparație care aruncă pe zero rânduri ar opri
    // tot lotul pentru o singură zi aprobată — nu e cea așteptată aici.
    await expect(
      sincronizeazaZileleDeConcediu(fals.client, ORG_ID, [zi("2026-07-14")]),
    ).resolves.toMatchObject({ actualizate: 0 });
    const [update] = fals.apeluriPe("attendance_entries", "update");
    expect(update?.selectDupaScriere).toBeDefined();
  });
});
