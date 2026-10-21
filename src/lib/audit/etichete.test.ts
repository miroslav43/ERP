import { describe, expect, it } from "vitest";

import { OPTIUNI_ENTITATI, etichetaCamp, etichetaEntitate, etichetaValoare } from "./etichete";

describe("etichetele jurnalului de audit (FLX-006)", () => {
  it("tabelele scrise de triggeri au etichetă românească", () => {
    expect(etichetaEntitate("approval_tasks")).toBe("Sarcină de aprobare");
    expect(etichetaEntitate("employee_sensitive_data")).toBe("Date sensibile ale angajatului");
  });

  it("filtrul „Tip de entitate” le conține", () => {
    const valori = OPTIUNI_ENTITATI.map((o) => o.valoare);
    expect(valori).toContain("approval_tasks");
    expect(valori).toContain("employee_sensitive_data");
  });

  it("cheile camelCase din `redactPayload` au etichetă sau se despart", () => {
    expect(etichetaCamp(["motivRespingere"])).toBe("Motivul respingerii");
    expect(etichetaCamp(["motiv_respingere"])).toBe("Motivul respingerii");
    expect(etichetaCamp(["unVenitNecunoscut"])).toBe("Un venit necunoscut");
  });

  it("valorile de enum se traduc, textul liber rămâne neatins", () => {
    expect(etichetaValoare(["status"], "aprobata")).toBe("Aprobată");
    expect(etichetaValoare(["status"], "in_lucru")).toBe("În lucru");
    expect(etichetaValoare(["titlu"], "text liber")).toBe("text liber");
    expect(etichetaValoare(["status"], 7)).toBe(7);
  });
});
