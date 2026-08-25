// src/domain/cursuri/scadente.test.ts
import { describe, expect, it } from "vitest";

import {
  PRAG_CURSURI_PROCENTE,
  acordNumeric,
  durataCitibila,
  esteFinalizabila,
  pozitieCitibila,
  secundeNecesare,
  textProgres,
  treaptaTermen,
  treaptaValabilitate,
  type Lectie,
} from "./scadente";

const AZI = "2026-08-25";

const lectie = (peste: Partial<Lectie>): Lectie => ({
  titlu: "Regulament intern",
  status: "in_curs",
  treaptaDovada: "bifa",
  procentMinim: null,
  durataSecunde: null,
  secundeVizionate: 0,
  semnaturaNume: null,
  ...peste,
});

describe("treaptaTermen", () => {
  it("un curs finalizat nu mai are termen activ", () => {
    expect(treaptaTermen("2026-01-01", AZI, "finalizat")).toBe("neaplicabil");
    expect(treaptaTermen("2026-01-01", AZI, "anulat")).toBe("neaplicabil");
  });

  it("termenul trecut e expirat", () => {
    expect(treaptaTermen("2026-08-24", AZI, "in_curs")).toBe("expirat");
  });

  it("ultima zi e critică, nu expirată", () => {
    expect(treaptaTermen(AZI, AZI, "in_curs")).toBe("critic");
    expect(treaptaTermen("2026-08-26", AZI, "neinceput")).toBe("critic");
  });

  it("în fereastra de preaviz e „curând”", () => {
    expect(treaptaTermen("2026-08-30", AZI, "in_curs")).toBe("curand");
  });

  it("departe de termen e în regulă", () => {
    expect(treaptaTermen("2026-10-01", AZI, "in_curs")).toBe("in_regula");
  });

  it("fără termen nu e o lipsă, e o alegere", () => {
    expect(treaptaTermen(null, AZI, "in_curs")).toBe("neaplicabil");
  });
});

describe("treaptaValabilitate", () => {
  it("preavizul vine din curs, nu dintr-o constantă", () => {
    expect(treaptaValabilitate("2026-09-10", AZI, 30)).toBe("curand");
    expect(treaptaValabilitate("2026-09-10", AZI, 7)).toBe("in_regula");
  });

  it("fără valabilitate cursul nu expiră niciodată", () => {
    expect(treaptaValabilitate(null, AZI, 30)).toBe("neaplicabil");
  });
});

describe("secundeNecesare", () => {
  it("rotunjește în sus, ca pragul să fie atins, nu aproape atins", () => {
    expect(secundeNecesare(100, 80)).toBe(80);
    expect(secundeNecesare(101, 80)).toBe(81);
    expect(secundeNecesare(3, 50)).toBe(2);
  });
});

describe("esteFinalizabila — oglinda triggerului internal.cursuri_progres", () => {
  it("bifa se poate închide oricând", () => {
    expect(esteFinalizabila(lectie({ treaptaDovada: "bifa" }))).toEqual({ poate: true });
  });

  it("o lecție deja parcursă nu se reînchide", () => {
    const r = esteFinalizabila(lectie({ status: "finalizat" }));
    expect(r.poate).toBe(false);
  });

  it("parcurgerea cere pragul atins, iar motivul spune cât mai e", () => {
    const subPrag = lectie({
      treaptaDovada: "parcurgere",
      durataSecunde: 600,
      procentMinim: 80,
      secundeVizionate: 300,
    });
    const r = esteFinalizabila(subPrag);
    expect(r.poate).toBe(false);
    // 80 % din 600 = 480; mai sunt 180 de secunde = 3 minute.
    expect(r.poate === false && r.motiv).toContain("3 minute");

    expect(esteFinalizabila({ ...subPrag, secundeVizionate: 480 })).toEqual({ poate: true });
  });

  it("parcurgerea fără durată configurată nu se poate măsura, și o spune", () => {
    const r = esteFinalizabila(
      lectie({ treaptaDovada: "parcurgere", durataSecunde: null, procentMinim: 80 }),
    );
    expect(r.poate).toBe(false);
    expect(r.poate === false && r.motiv).toContain("durata");
  });

  it("declarația cere o semnătură reală, nu spații", () => {
    expect(esteFinalizabila(lectie({ treaptaDovada: "declaratie", semnaturaNume: "   " })).poate).toBe(false);
    expect(esteFinalizabila(lectie({ treaptaDovada: "declaratie", semnaturaNume: "Ion Popescu" }))).toEqual({
      poate: true,
    });
  });

  it("testul grilă e refuzat explicit până când ecranele lui există", () => {
    const r = esteFinalizabila(lectie({ treaptaDovada: "test" }));
    expect(r.poate).toBe(false);
    expect(r.poate === false && r.motiv).toContain("nu este încă disponibil");
  });

  it("fiecare motiv e o propoziție care se termină cu punct", () => {
    for (const l of [
      lectie({ status: "finalizat" }),
      lectie({ treaptaDovada: "parcurgere", durataSecunde: 600, procentMinim: 80 }),
      lectie({ treaptaDovada: "declaratie" }),
      lectie({ treaptaDovada: "test" }),
    ]) {
      const r = esteFinalizabila(l);
      expect(r.poate).toBe(false);
      expect(r.poate === false && r.motiv.endsWith(".")).toBe(true);
    }
  });
});

describe("durataCitibila", () => {
  it("acordă corect singularul și pluralul românesc", () => {
    expect(durataCitibila(1)).toBe("1 secundă");
    expect(durataCitibila(45)).toBe("45 de secunde");
    expect(durataCitibila(60)).toBe("1 minut");
    expect(durataCitibila(180)).toBe("3 minute");
    expect(durataCitibila(80)).toBe("1 minut și 20 de secunde");
    expect(durataCitibila(121)).toBe("2 minute și 1 secundă");
  });

  it("nu întoarce niciodată durate negative", () => {
    expect(durataCitibila(-5)).toBe("0 de secunde");
  });
});

describe("acordNumeric", () => {
  it("1 ia singularul", () => {
    expect(acordNumeric(1, "minut", "minute")).toBe("1 minut");
  });

  it("2–19 iau pluralul simplu, fără „de”", () => {
    expect(acordNumeric(3, "minut", "minute")).toBe("3 minute");
    expect(acordNumeric(19, "minut", "minute")).toBe("19 minute");
  });

  it("de la 20 în sus pluralul cere „de”", () => {
    expect(acordNumeric(20, "minut", "minute")).toBe("20 de minute");
    expect(acordNumeric(45, "secundă", "secunde")).toBe("45 de secunde");
  });

  it("regula se uită la ultimele două cifre, nu la număr", () => {
    expect(acordNumeric(101, "minut", "minute")).toBe("101 minute");
    expect(acordNumeric(120, "minut", "minute")).toBe("120 de minute");
    expect(acordNumeric(100, "minut", "minute")).toBe("100 de minute");
  });

  it("zero intră pe ramura cu „de”", () => {
    expect(acordNumeric(0, "secundă", "secunde")).toBe("0 de secunde");
  });
});

describe("pozitieCitibila", () => {
  it("formatează minutar, cu două cifre la secunde", () => {
    expect(pozitieCitibila(754)).toBe("12:34");
    expect(pozitieCitibila(5)).toBe("0:05");
  });
});

describe("textProgres", () => {
  it("sub prag arată numere absolute — pe opt oameni procentul minte", () => {
    expect(textProgres(5, 8, "persoane")).toBe("5 din 8 persoane");
  });

  it("peste prag procentul devine onest", () => {
    expect(textProgres(50, PRAG_CURSURI_PROCENTE + 25, "persoane")).toContain("%");
  });

  it("zero total nu produce împărțire la zero", () => {
    expect(textProgres(0, 0, "lecții")).toBe("Nimic de parcurs.");
  });
});
