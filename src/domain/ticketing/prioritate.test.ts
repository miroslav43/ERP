// src/domain/ticketing/prioritate.test.ts
import { describe, expect, it } from "vitest";
import { calculeazaPrioritatea, prioritateMaiMare } from "./prioritate";

describe("prioritatea derivată", () => {
  it("defecțiunea care blochează activitatea urcă la ridicată", () => {
    expect(calculeazaPrioritatea({ tip: "defectiune", blocheazaActivitatea: true }, false)).toBe(
      "ridicata",
    );
  });

  it("defecțiunea care nu blochează rămâne normală", () => {
    expect(calculeazaPrioritatea({ tip: "defectiune", blocheazaActivitatea: false }, false)).toBe(
      "normala",
    );
  });

  it("cererile de software și hardware pornesc normale", () => {
    expect(calculeazaPrioritatea({ tip: "software" }, false)).toBe("normala");
    expect(calculeazaPrioritatea({ tip: "hardware" }, false)).toBe("normala");
  });

  it("bug-ul urcă odată cu numărul de duplicate", () => {
    expect(calculeazaPrioritatea({ tip: "bug_erp", numarDuplicate: 0 }, false)).toBe("normala");
    expect(calculeazaPrioritatea({ tip: "bug_erp", numarDuplicate: 1 }, false)).toBe("normala");
    expect(calculeazaPrioritatea({ tip: "bug_erp", numarDuplicate: 2 }, false)).toBe("ridicata");
    expect(calculeazaPrioritatea({ tip: "bug_erp", numarDuplicate: 4 }, false)).toBe("ridicata");
    expect(calculeazaPrioritatea({ tip: "bug_erp", numarDuplicate: 5 }, false)).toBe("critica");
    expect(calculeazaPrioritatea({ tip: "bug_erp", numarDuplicate: 50 }, false)).toBe("critica");
  });

  it("bug fără duplicate declarate e tratat ca zero", () => {
    expect(calculeazaPrioritatea({ tip: "bug_erp" }, false)).toBe("normala");
  });

  it("suprascrierea manuală oprește orice recalcul", () => {
    // `null` = „nu atinge prioritatea”. Fără asta, o defecțiune blocantă ar
    // urca la loc la fiecare salvare, peste decizia explicită a IT-ului.
    expect(
      calculeazaPrioritatea({ tip: "defectiune", blocheazaActivitatea: true }, true),
    ).toBeNull();
    expect(calculeazaPrioritatea({ tip: "bug_erp", numarDuplicate: 9 }, true)).toBeNull();
  });
});

describe("prioritateMaiMare", () => {
  it("alege rangul mai mare, indiferent de ordinea argumentelor", () => {
    expect(prioritateMaiMare("normala", "critica")).toBe("critica");
    expect(prioritateMaiMare("critica", "normala")).toBe("critica");
    expect(prioritateMaiMare("scazuta", "normala")).toBe("normala");
  });

  it("la egalitate întoarce valoarea dată", () => {
    expect(prioritateMaiMare("ridicata", "ridicata")).toBe("ridicata");
  });
});
