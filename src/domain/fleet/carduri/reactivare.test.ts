import { describe, expect, it } from "vitest";

import { stareDupaReactivare } from "./reactivare";

const baza = {
  categorie: "combustibil",
  card_id: "card-1",
  vehicle_id: "veh-1",
  trip_sheet_id: "foaie-1",
} as const;

/*
 * „Reactivează” scoate tranzacția din `ignorata` înaintea repotrivirii ei. Dacă
 * repotrivirea cade la mijloc, rândul rămâne în starea asta: una fără legătură
 * (`fctx_stare_ck`), aleasă în ordinea potrivirii, pe care repotrivirea lunii o
 * reia.
 */
describe("stareDupaReactivare", () => {
  it("fără vehicul și fără card: card neînregistrat", () => {
    expect(stareDupaReactivare({ ...baza, card_id: null, vehicle_id: null })).toBe(
      "card_necunoscut",
    );
  });

  it("cu card, fără vehicul: vehicul necunoscut", () => {
    expect(stareDupaReactivare({ ...baza, vehicle_id: null })).toBe("vehicul_necunoscut");
  });

  it("cu vehicul, dar nu combustibil: necombustibil", () => {
    expect(stareDupaReactivare({ ...baza, categorie: "adblue" })).toBe("necombustibil");
  });

  it("combustibil, fără foaie: fără foaie", () => {
    expect(stareDupaReactivare({ ...baza, trip_sheet_id: null })).toBe("fara_foaie");
  });

  it("combustibil, cu foaie: fără alimentare (legătura o reface repotrivirea)", () => {
    expect(stareDupaReactivare(baza)).toBe("fara_alimentare");
  });
});
