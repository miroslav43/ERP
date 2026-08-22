// src/domain/fleet/kilometraj.test.ts
import { describe, expect, it } from "vitest";
import { verificaContinuitate, PRAG_SALT_KM_IMPLICIT } from "./kilometraj";

describe("verificaContinuitate", () => {
  it("este ok când kilometrajul creşte firesc, sub prag", () => {
    expect(verificaContinuitate(10000, 10050, 10200)).toBe("ok");
  });

  it("este ok la egalitate perfectă între ultimul km şi plecare", () => {
    expect(verificaContinuitate(10000, 10000, 10100)).toBe("ok");
  });

  it("semnalează regres când plecarea e sub ultimul kilometraj cunoscut", () => {
    expect(verificaContinuitate(10000, 9900, 10100)).toBe("regres");
  });

  it("semnalează regres când sosirea e sub plecare, chiar dacă plecarea e validă", () => {
    expect(verificaContinuitate(10000, 10050, 10000)).toBe("regres");
  });

  it("tratează regresul cu prioritate faţă de salt", () => {
    expect(verificaContinuitate(10000, 5000, 5100, 100)).toBe("regres");
  });

  it("semnalează salt când diferenţa depăşeşte pragul", () => {
    expect(verificaContinuitate(10000, 12000, 12100, 1500)).toBe("salt");
  });

  it("nu semnalează salt exact la limita pragului", () => {
    expect(verificaContinuitate(10000, 11500, 11600, 1500)).toBe("ok");
  });

  it("foloseşte pragul implicit de 1500 km când nu se specifică altul", () => {
    expect(verificaContinuitate(10000, 12000, 12100)).toBe("salt");
    expect(PRAG_SALT_KM_IMPLICIT).toBe(1500);
  });

  it("acceptă sosire lipsă (foaie neîncheiată încă)", () => {
    expect(verificaContinuitate(10000, 10500, null)).toBe("ok");
    expect(verificaContinuitate(10000, 10500, undefined)).toBe("ok");
  });

  it("respinge un prag de salt invalid", () => {
    expect(() => verificaContinuitate(10000, 10500, null, 0)).toThrow();
  });

  it("respinge un kilometraj negativ", () => {
    expect(() => verificaContinuitate(-1, 100, 200)).toThrow();
  });
});
