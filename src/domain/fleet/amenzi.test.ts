// src/domain/fleet/amenzi.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ETICHETE_STADIU_AMENDA,
  ETICHETE_STADIU_INCIDENT,
  NOTA_RECUPERARE,
  STADII_AMENDA,
  STADII_INCIDENT,
  TEMEI_ART_39,
  TRANZITII_AMENDA,
  amendaInchisa,
  costNet,
  cerintaStadiuIncident,
  incidentInchis,
  modelScrisoareDesemnare,
  poateTrece,
  raspunsDeTrimis,
  stadiiUrmatoareIncident,
  textSugestie,
  verdictTermen,
  type IntrareScrisoare,
} from "./amenzi";

describe("tranzițiile amenzii", () => {
  it("oglindesc matricea din internal.amenzi_inainte (0203)", () => {
    // Matricea de mai jos e COPIATĂ din corpul triggerului, nu din domeniu: dacă
    // una dintre ele se mișcă singură, testul pică.
    const dinTrigger: Readonly<Record<string, readonly string[]>> = {
      primita: ["sofer_desemnat", "platita", "contestata", "anulata"],
      sofer_desemnat: ["primita", "raspuns_trimis", "platita", "contestata", "anulata"],
      raspuns_trimis: ["platita", "contestata", "anulata"],
      contestata: ["platita", "anulata"],
      platita: [],
      anulata: [],
    };
    for (const din of STADII_AMENDA) {
      expect([...TRANZITII_AMENDA[din]].sort()).toEqual([...(dinTrigger[din] ?? [])].sort());
    }
  });

  it("migrarea 0203 are aceleași tranziții ca domeniul", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/0203_flota_amenzi_daune.sql"),
      "utf8",
    );
    for (const din of STADII_AMENDA) {
      for (const la of TRANZITII_AMENDA[din]) {
        // Fiecare tranziție permisă apare în blocul `old.stadiu = 'din' and new.stadiu in (… 'la' …)`.
        const bloc = new RegExp(
          `old\\.stadiu = '${din}'\\s+and new\\.stadiu in \\(([^)]*)\\)`,
          "u",
        ).exec(sql);
        expect(bloc, `blocul pentru ${din}`).not.toBeNull();
        expect(bloc?.[1]).toContain(`'${la}'`);
      }
    }
  });

  it("poateTrece refuză reflexivitatea, capetele și întoarcerea după răspuns", () => {
    expect(poateTrece("primita", "primita")).toBe(false);
    expect(poateTrece("platita", "primita")).toBe(false);
    expect(poateTrece("anulata", "platita")).toBe(false);
    expect(poateTrece("raspuns_trimis", "primita")).toBe(false);
    expect(poateTrece("raspuns_trimis", "sofer_desemnat")).toBe(false);
    expect(poateTrece("primita", "raspuns_trimis")).toBe(false);
    expect(poateTrece("sofer_desemnat", "primita")).toBe(true);
    expect(poateTrece("sofer_desemnat", "raspuns_trimis")).toBe(true);
  });

  it("amenda plătită sau anulată e închisă; restul nu", () => {
    expect(STADII_AMENDA.filter(amendaInchisa)).toEqual(["platita", "anulata"]);
  });

  it("termenul de răspuns contează doar cât răspunsul n-a plecat", () => {
    expect(STADII_AMENDA.filter(raspunsDeTrimis)).toEqual([
      "primita",
      "sofer_desemnat",
      "contestata",
    ]);
  });

  it("fiecare stadiu are etichetă în română, cu diacritice cu virgulă", () => {
    for (const stadiu of STADII_AMENDA) {
      expect(ETICHETE_STADIU_AMENDA[stadiu]).toMatch(/\S/u);
    }
    expect(Object.values(ETICHETE_STADIU_AMENDA).join(" ")).not.toMatch(/[şţŞŢ]/u);
    expect(ETICHETE_STADIU_AMENDA.sofer_desemnat).toBe("Șofer desemnat");
  });
});

describe("verdictTermen", () => {
  const azi = "2026-10-12";

  it("fără termen în solicitare: nu inventează unul", () => {
    const v = verdictTermen(null, "primita", azi);
    expect(v.stare).toBe("fara_termen");
    expect(v.zile).toBeNull();
  });

  it("termen depășit, cu zilele", () => {
    const v = verdictTermen("2026-10-09", "primita", azi);
    expect(v).toMatchObject({ stare: "depasit", zile: -3, ton: "pericol" });
    expect(v.eticheta).toBe("Depășit cu 3 zile");
  });

  it("o zi depășită se scrie la singular", () => {
    expect(verdictTermen("2026-10-11", "sofer_desemnat", azi).eticheta).toBe("Depășit cu o zi");
  });

  it("astăzi, apoi aproape, apoi în termen", () => {
    expect(verdictTermen("2026-10-12", "primita", azi)).toMatchObject({
      stare: "astazi",
      ton: "pericol",
      eticheta: "Scadent astăzi",
    });
    expect(verdictTermen("2026-10-15", "primita", azi)).toMatchObject({
      stare: "aproape",
      zile: 3,
      ton: "atentie",
      eticheta: "Mai sunt 3 zile",
    });
    expect(verdictTermen("2026-10-13", "primita", azi).eticheta).toBe("Mai e o zi");
    expect(verdictTermen("2026-10-16", "primita", azi)).toMatchObject({
      stare: "in_termen",
      zile: 4,
      ton: "neutru",
    });
  });

  it("după răspuns, plată sau anulare termenul nu se mai judecă", () => {
    for (const stadiu of ["raspuns_trimis", "platita", "anulata"] as const) {
      const v = verdictTermen("2026-01-01", stadiu, azi);
      expect(v.stare).toBe("nu_se_aplica");
      expect(v.zile).toBeNull();
    }
  });

  it("trece corect peste schimbarea orei de vară (zile calendaristice)", () => {
    expect(verdictTermen("2026-10-26", "primita", "2026-10-24").zile).toBe(2);
    expect(verdictTermen("2026-03-30", "primita", "2026-03-27").zile).toBe(3);
  });
});

describe("textSugestie", () => {
  it("spune de unde vine sugestia, ca omul s-o poată judeca", () => {
    expect(textSugestie("foaie", "Ana Șofer")).toBe(
      "Ana Șofer — după foaia de parcurs care acoperă momentul faptei.",
    );
    expect(textSugestie("alocare", "Cornel Coleg")).toBe(
      "Cornel Coleg — după alocarea vehiculului la momentul faptei.",
    );
  });
});

describe("incidentele", () => {
  it("un incident închis nu mai are stadii următoare", () => {
    expect(stadiiUrmatoareIncident("inchis")).toEqual([]);
    expect(incidentInchis("inchis")).toBe(true);
    expect(STADII_INCIDENT.filter(incidentInchis)).toEqual(["inchis"]);
  });

  it("din orice stadiu deschis se poate merge în oricare alt stadiu, inclusiv înapoi", () => {
    expect(stadiiUrmatoareIncident("constatat")).toEqual([
      "raportat",
      "la_asigurator",
      "in_reparatie",
      "inchis",
    ]);
    expect(stadiiUrmatoareIncident("raportat")).not.toContain("raportat");
  });

  it("cerințele stadiilor oglindesc baza", () => {
    expect(cerintaStadiuIncident("la_asigurator", { asigurator: null, cost_final: null })).toMatch(
      /asigurătorului/u,
    );
    expect(
      cerintaStadiuIncident("la_asigurator", { asigurator: "Allianz", cost_final: null }),
    ).toBeNull();
    expect(cerintaStadiuIncident("inchis", { asigurator: null, cost_final: null })).toMatch(
      /costul final/u,
    );
    expect(cerintaStadiuIncident("inchis", { asigurator: null, cost_final: 0 })).toBeNull();
    expect(cerintaStadiuIncident("constatat", { asigurator: null, cost_final: null })).toBeNull();
  });

  it("costul net scade despăgubirea din costul final", () => {
    expect(costNet(1100, 900)).toBe(200);
    expect(costNet(1100, null)).toBe(1100);
    expect(costNet(null, 900)).toBeNull();
    expect(costNet(500, 700)).toBe(-200);
  });

  it("etichetele stadiilor sunt complete", () => {
    for (const stadiu of STADII_INCIDENT) {
      expect(ETICHETE_STADIU_INCIDENT[stadiu]).toMatch(/\S/u);
    }
  });
});

describe("recuperarea de la șofer", () => {
  it("spune pe față că nu e automată și citează articolele verificate", () => {
    expect(NOTA_RECUPERARE).toMatch(/nu este automată/u);
    expect(NOTA_RECUPERARE).toContain("art. 169");
    expect(NOTA_RECUPERARE).toContain("art. 254");
    expect(NOTA_RECUPERARE).toMatch(/hotărâre judecătorească definitivă și irevocabilă/u);
    expect(NOTA_RECUPERARE).not.toMatch(/[şţŞŢ]/u);
  });

  it("temeiul scrisorii citează articolul 39 din OUG 195/2002", () => {
    expect(TEMEI_ART_39).toContain("art. 39");
    expect(TEMEI_ART_39).toContain("195/2002");
  });
});

describe("modelScrisoareDesemnare", () => {
  const intrare: IntrareScrisoare = {
    organizatie: "Transport Exemplu S.R.L.",
    autoritate: "Poliția Rutieră Prahova",
    numarPv: "PV 12/A",
    dataPv: "09.10.2026",
    vehiculNr: "PH 12 ABC",
    momentFapta: "09.10.2026, ora 09:30",
    locul: "DN1, Ploiești",
    fapta: "Depășirea vitezei legale",
    sofer: {
      nume: "Popescu Ana",
      cnp: "2900101123456",
      adresa: "Str. Teiului 4, Ploiești, Prahova",
      tipAct: "CI",
      serieAct: "PH",
      numarAct: "123456",
    },
    dataScrisorii: "12.10.2026",
    numarIesire: "IES-9",
  };

  it("cuprinde tot ce cere art. 39 alin. (2): nume, CNP, domiciliu, act de identitate", () => {
    const m = modelScrisoareDesemnare(intrare);
    const rubrici = new Map(m.rubriciSofer);
    expect(rubrici.get("Nume și prenume")).toBe("Popescu Ana");
    expect(rubrici.get("Cod numeric personal")).toBe("2900101123456");
    expect(rubrici.get("Domiciliul sau reședința")).toBe("Str. Teiului 4, Ploiești, Prahova");
    expect(rubrici.get("Act de identitate")).toBe("CI, seria PH, nr. 123456");
    expect(m.lipsuri).toEqual([]);
  });

  it("numește vehiculul, momentul, procesul-verbal și temeiul legal", () => {
    const m = modelScrisoareDesemnare(intrare);
    const tot = [m.destinatar, m.referinta, ...m.paragrafe, ...m.note].join("\n");
    expect(m.destinatar).toBe("Către: Poliția Rutieră Prahova");
    expect(tot).toContain("PH 12 ABC");
    expect(tot).toContain("09.10.2026, ora 09:30");
    expect(tot).toContain("PV 12/A");
    expect(tot).toContain("art. 39");
    expect(tot).toContain("Transport Exemplu S.R.L.");
    expect(m.subtitlu).toBe("Nr. IES-9 din 12.10.2026");
  });

  it("ce lipsește din fișă se spune pe față, nu se inventează", () => {
    const m = modelScrisoareDesemnare({
      ...intrare,
      sofer: { ...intrare.sofer, cnp: null, adresa: null, serieAct: null, numarAct: null },
    });
    const rubrici = new Map(m.rubriciSofer);
    expect(rubrici.get("Cod numeric personal")).toBe("");
    expect(rubrici.get("Domiciliul sau reședința")).toBe("");
    expect(rubrici.get("Act de identitate")).toBe("");
    expect(m.lipsuri).toEqual([
      "codul numeric personal",
      "domiciliul sau reședința",
      "seria și numărul actului de identitate",
    ]);
    expect(m.note.join(" ")).toContain("Completați de mână");
  });

  it("fără autoritate, destinatarul rămâne de completat", () => {
    const m = modelScrisoareDesemnare({ ...intrare, autoritate: null });
    expect(m.destinatar).toBe("Către: autoritatea care a emis solicitarea");
  });

  it("fără număr de ieșire, subtitlul păstrează doar data", () => {
    expect(modelScrisoareDesemnare({ ...intrare, numarIesire: null }).subtitlu).toBe(
      "din 12.10.2026",
    );
  });

  it("numele fișierului nu poartă separatori de cale", () => {
    const m = modelScrisoareDesemnare({ ...intrare, numarPv: "PV 12/A" });
    expect(m.numeFisier).not.toMatch(/[\\/]/u);
    expect(m.numeFisier).toContain("PH 12 ABC".replace(/\s+/gu, "-"));
  });

  it("textele noi folosesc ș și ț cu virgulă", () => {
    const m = modelScrisoareDesemnare(intrare);
    const tot = [m.titlu, m.destinatar, m.referinta, ...m.paragrafe, ...m.note].join("\n");
    expect(tot).not.toMatch(/[şţŞŢ]/u);
  });
});
