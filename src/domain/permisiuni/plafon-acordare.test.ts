// src/domain/permisiuni/plafon-acordare.test.ts
//
// Cine acordă pe echipă (`roles:update = team`) nu poate da mai mult decât are
// el însuși pe aceeași cheie. Altfel managerul fără `payroll:read` îi dădea
// subordonatului „Salarizare — Citire = Toată firma” dintr-un dropdown.
import { describe, expect, it } from "vitest";

import {
  implicitulRolului,
  incapeInPlafon,
  plafonulAcordarii,
  poateReveniLaRol,
} from "./plafon-acordare";

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

describe("implicitulRolului", () => {
  const ORG = "00000000-0000-4000-8000-000000000001";

  it("fără niciun rând: `null` (rolul nu dă nimic)", () => {
    expect(implicitulRolului([])).toBeNull();
  });

  it("doar implicitul global: el", () => {
    expect(implicitulRolului([{ organization_id: null, scope: "all" }])).toBe("all");
  });

  it("rândul organizației bate implicitul global, indiferent de ordine", () => {
    expect(
      implicitulRolului([
        { organization_id: null, scope: "all" },
        { organization_id: ORG, scope: "none" },
      ]),
    ).toBe("none");
    expect(
      implicitulRolului([
        { organization_id: ORG, scope: "own" },
        { organization_id: null, scope: "all" },
      ]),
    ).toBe("own");
  });
});

// Ștergerea unei suprascrieri NU e neutră: dreptul cade pe implicitul rolului.
// Un refuz explicit pus de administrator (`payroll:read = none` pe un `hr`,
// al cărui rol dă `all`) retras de manager i-ar redeschide subordonatului toate
// salariile — mai mult decât are managerul.
describe("poateReveniLaRol", () => {
  it("rolul dă mai mult decât plafonul: nu", () => {
    expect(poateReveniLaRol("all", "none")).toBe(false);
    expect(poateReveniLaRol("all", "team")).toBe(false);
  });

  it("rolul dă cel mult plafonul: da", () => {
    expect(poateReveniLaRol("team", "team")).toBe(true);
    expect(poateReveniLaRol("own", "team")).toBe(true);
  });

  it("rolul nu dă nimic (`null` sau `none`): da, chiar fără plafon", () => {
    expect(poateReveniLaRol(null, "none")).toBe(true);
    expect(poateReveniLaRol("none", "none")).toBe(true);
  });

  it("administratorul (`all`) n-are plafon", () => {
    expect(poateReveniLaRol("all", "all")).toBe(true);
  });
});
