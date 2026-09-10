// src/domain/attendance/stare-decizie.test.ts
import { describe, expect, it } from "vitest";

import { stareaDeciziei, ziuaSeMaiPoateDecide } from "./stare-decizie";

describe("stareaDeciziei", () => {
  it("ziua nedecisă cere o decizie", () => {
    expect(stareaDeciziei({ aprobat: false, respins: false })).toBe("de_decis");
  });

  it("ziua aprobată e aprobată", () => {
    expect(stareaDeciziei({ aprobat: true, respins: false })).toBe("aprobata");
  });

  it("ziua respinsă e respinsă", () => {
    expect(stareaDeciziei({ aprobat: false, respins: true })).toBe("respinsa");
  });

  it("respinsul bate aprobatul dacă rândul scapă cu amândouă", () => {
    // `attendance_entries_decizie_ck` (0067:63) interzice combinația, dar dacă
    // un rând ajunge totuși aici, starea care cere acțiune trebuie să iasă la
    // suprafață — nu cea liniștită.
    expect(stareaDeciziei({ aprobat: true, respins: true })).toBe("respinsa");
  });
});

describe("ziuaSeMaiPoateDecide", () => {
  it("luna deschisă lasă decizia", () => {
    expect(ziuaSeMaiPoateDecide("deschisa")).toBe(true);
  });

  it("luna în aprobare lasă decizia — acolo se și aprobă", () => {
    expect(ziuaSeMaiPoateDecide("in_aprobare")).toBe(true);
  });

  it("luna blocată o oprește", () => {
    expect(ziuaSeMaiPoateDecide("blocata")).toBe(false);
  });
});
