// src/domain/permisiuni/plafon-acordare.test.ts
//
// Cine acordă pe echipă (`roles:update = team`) nu poate da mai mult decât are
// el însuși pe aceeași cheie. Altfel managerul fără `payroll:read` îi dădea
// subordonatului „Salarizare — Citire = Toată firma” dintr-un dropdown.
import { describe, expect, it } from "vitest";

import { incapeInPlafon, plafonulAcordarii } from "./plafon-acordare";

describe("plafonulAcordarii", () => {
  it("`roles:update = all`: fără plafon, orice cheie până la `all`", () => {
    expect(plafonulAcordarii("all", null)).toBe("all");
    expect(plafonulAcordarii("all", "own")).toBe("all");
  });

  it("`roles:update = team`: plafonul e scope-ul acordantului pe aceeași cheie", () => {
    expect(plafonulAcordarii("team", "team")).toBe("team");
    expect(plafonulAcordarii("team", "own")).toBe("own");
    expect(plafonulAcordarii("team", "all")).toBe("all");
  });

  it("`roles:update = team` fără cheia respectivă: nu poate acorda nimic", () => {
    expect(plafonulAcordarii("team", null)).toBe("none");
    expect(plafonulAcordarii("team", undefined)).toBe("none");
    expect(plafonulAcordarii("team", "none")).toBe("none");
  });

  it("sub `team` pe `roles:update`: nimic", () => {
    expect(plafonulAcordarii("own", "all")).toBe("none");
    expect(plafonulAcordarii(null, "all")).toBe("none");
  });
});

describe("incapeInPlafon", () => {
  it("refuzul explicit încape mereu: restrânge, nu crește", () => {
    expect(incapeInPlafon("none", "none")).toBe(true);
  });

  it("până la plafon inclusiv da, peste el nu", () => {
    expect(incapeInPlafon("own", "team")).toBe(true);
    expect(incapeInPlafon("team", "team")).toBe(true);
    expect(incapeInPlafon("all", "team")).toBe(false);
    expect(incapeInPlafon("own", "none")).toBe(false);
  });
});
