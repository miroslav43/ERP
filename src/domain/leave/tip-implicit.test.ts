// src/domain/leave/tip-implicit.test.ts
import { describe, expect, it } from "vitest";

import { tipImplicitConcediu } from "./tip-implicit";

const CRESTERE = { id: "1", key: "crestere_copil", denumire: "Concediu creștere copil" };
const ODIHNA = { id: "2", key: "odihna", denumire: "Concediu de odihnă" };
const MEDICAL = { id: "3", key: "medical", denumire: "Concediu medical" };

describe("tipImplicitConcediu", () => {
  it("alege odihna, oriunde ar cădea ea în ordinea alfabetică", () => {
    // Exact ordinea pe care o întoarce `order(\"denumire\")` din bază.
    expect(tipImplicitConcediu([CRESTERE, ODIHNA, MEDICAL])).toBe(ODIHNA);
  });

  it("cade pe primul din listă când odihna e dezactivată", () => {
    expect(tipImplicitConcediu([CRESTERE, MEDICAL])).toBe(CRESTERE);
  });

  it("întoarce null pe listă goală — organizația fără niciun tip activ", () => {
    expect(tipImplicitConcediu([])).toBeNull();
  });
});
