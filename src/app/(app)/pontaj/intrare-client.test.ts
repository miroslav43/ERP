import { describe, expect, it } from "vitest";

import type { IntrarePontaj } from "@/lib/queries/attendance";
import { salveazaZiPontajSchema } from "@/schemas/attendance";

import { intrareaClient, intrarilePeZi } from "./intrare-client";

/** Un rând așa cum îl întoarce PostgREST: `time` cu secunde, restul completat. */
function randBaza(peste: Partial<IntrarePontaj> = {}): IntrarePontaj {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    employee_id: "22222222-2222-4222-8222-222222222222",
    data: "2026-08-31",
    ora_inceput: "08:30:00",
    ora_sfarsit: "17:00:00",
    ore_lucrate: 8,
    ore_suplimentare: 0,
    ore_noapte: 0,
    tip_zi: "lucratoare",
    tip_prezenta: null,
    sursa: "manuala",
    leave_request_id: null,
    observatii: null,
    approved_at: null,
    respins_la: null,
    motiv_respingere: null,
    batch_id: null,
    ...peste,
  };
}

describe("intrareaClient", () => {
  it("taie secundele cu care o coloană `time` iese din Postgres", () => {
    const intrare = intrareaClient(randBaza());
    expect(intrare.oraInceput).toBe("08:30");
    expect(intrare.oraSfarsit).toBe("17:00");
  });

  it("ora normalizată e ACCEPTATĂ de schema de salvare, cea brută nu", () => {
    /*
      Testul care justifică modulul. Fără normalizare, cine deschidea o zi cu
      interval, schimba doar observația și apăsa „Salvează" primea o eroare de
      validare pe un câmp neatins: starea dialogului pornește din exact valoarea
      de aici, iar `oraOptionala` cere `HH:MM`, fără secunde.
    */
    const rand = randBaza();
    const brut = salveazaZiPontajSchema.safeParse({
      data: rand.data,
      ora_inceput: rand.ora_inceput,
      ora_sfarsit: rand.ora_sfarsit,
      ore_lucrate: rand.ore_lucrate,
    });
    expect(brut.success).toBe(false);

    const intrare = intrareaClient(rand);
    const normalizat = salveazaZiPontajSchema.safeParse({
      data: rand.data,
      ora_inceput: intrare.oraInceput,
      ora_sfarsit: intrare.oraSfarsit,
      ore_lucrate: intrare.oreLucrate,
    });
    expect(normalizat.success).toBe(true);
  });

  it("ziua fără interval rămâne fără interval", () => {
    const intrare = intrareaClient(randBaza({ ora_inceput: null, ora_sfarsit: null }));
    expect(intrare.oraInceput).toBeNull();
    expect(intrare.oraSfarsit).toBeNull();
  });

  it("ziua deschisă cu ceasul păstrează începutul și n-are sfârșit", () => {
    const intrare = intrareaClient(randBaza({ ora_sfarsit: null, ore_lucrate: 0 }));
    expect(intrare.oraInceput).toBe("08:30");
    expect(intrare.oraSfarsit).toBeNull();
  });

  it("traduce în booleeni cele trei stări purtate de coloane nullable", () => {
    expect(intrareaClient(randBaza()).aprobat).toBe(false);
    expect(intrareaClient(randBaza({ approved_at: "2026-09-01T10:00:00Z" })).aprobat).toBe(true);
    expect(intrareaClient(randBaza({ respins_la: "2026-09-01T10:00:00Z" })).respins).toBe(true);
    expect(
      intrareaClient(randBaza({ leave_request_id: "33333333-3333-4333-8333-333333333333" }))
        .esteDinConcediu,
    ).toBe(true);
  });
});

describe("intrarilePeZi", () => {
  it("indexează pe ziua ISO, cheia care trece granița server/client", () => {
    const peZi = intrarilePeZi([
      randBaza({ data: "2026-08-31" }),
      randBaza({ data: "2026-09-01", ora_inceput: "09:00:00" }),
    ]);
    expect(Object.keys(peZi)).toEqual(["2026-08-31", "2026-09-01"]);
    expect(peZi["2026-09-01"]?.oraInceput).toBe("09:00");
  });
});
