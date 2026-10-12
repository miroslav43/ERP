// src/schemas/flota-amenzi.test.ts
import { describe, expect, it } from "vitest";

import {
  actualizeazaAmendaSchema,
  actualizeazaIncidentSchema,
  amendaNouaSchema,
  desemneazaSoferSchema,
  incidentNouSchema,
  schimbaStadiulAmenziiSchema,
  schimbaStadiulIncidentuluiSchema,
  trimiteRaspunsSchema,
} from "./flota-amenzi";

const VEHICUL = "6f2f7c9e-1d5b-4a53-9c1a-0b1d2e3f4a5b";
const AMENDA = "7a3a8d0f-2e6c-4b64-8d2b-1c2e3f4a5b6c";
const SOFER = "8b4b9e1a-3f7d-4c75-9e3c-2d3f4a5b6c7d";

const AMENDA_VALIDA = {
  vehicle_id: VEHICUL,
  numar_pv: "PV 12/A",
  data_pv: "2026-10-09",
  constatata_la: "2026-10-09T09:30",
  locul: "DN1, Ploiești",
  fapta: "Depășirea vitezei legale",
  autoritate: "Poliția Rutieră",
  suma: "580",
  primita_la: "2026-10-11",
  termen_raspuns: "2026-10-19",
  observatii: "",
};

describe("amendaNouaSchema", () => {
  it("primește o amendă completă și dă momentul faptei în UTC", () => {
    const r = amendaNouaSchema.safeParse(AMENDA_VALIDA);
    expect(r.success).toBe(true);
    if (!r.success) return;
    // 09:30 ora României (EEST, UTC+3) = 06:30 UTC.
    expect(r.data.constatata_la).toBe("2026-10-09T06:30:00.000Z");
    expect(r.data.suma).toBe(580);
    expect(r.data.observatii).toBeNull();
  });

  it("câmpurile opționale goale devin null, nu 0", () => {
    const r = amendaNouaSchema.safeParse({
      ...AMENDA_VALIDA,
      suma: "",
      data_pv: "",
      termen_raspuns: "",
      locul: "",
      autoritate: "",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.suma).toBeNull();
    expect(r.data.data_pv).toBeNull();
    expect(r.data.termen_raspuns).toBeNull();
    expect(r.data.locul).toBeNull();
  });

  it("numărul procesului-verbal e obligatoriu și are cel mult 60 de caractere", () => {
    const gol = amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, numar_pv: "  " });
    expect(gol.success).toBe(false);
    if (!gol.success) {
      expect(gol.error.issues[0]?.message).toBe(
        "Scrieți numărul procesului-verbal sau al solicitării.",
      );
    }
    expect(amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, numar_pv: "x".repeat(61) }).success).toBe(
      false,
    );
  });

  it("fapta cere cel puțin 3 caractere, cu mesaj în română", () => {
    const r = amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, fapta: "ab" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(
        "Scrieți fapta constatată, în cel puțin 3 caractere.",
      );
    }
  });

  it("suma nu e negativă și nu depășește un milion", () => {
    expect(amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, suma: "-1" }).success).toBe(false);
    expect(amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, suma: "1000001" }).success).toBe(false);
    expect(amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, suma: "0" }).success).toBe(true);
  });

  it("momentul faptei lipsă sau inexistent în calendar e refuzat", () => {
    expect(amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, constatata_la: "" }).success).toBe(false);
    expect(
      amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, constatata_la: "2026-02-30T10:00" }).success,
    ).toBe(false);
  });

  it("termenul de răspuns nu poate fi înaintea datei primirii", () => {
    const r = amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, termen_raspuns: "2026-10-10" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join("."))).toContain("termen_raspuns");
    }
  });

  it("data primirii nu poate fi înaintea datei procesului-verbal", () => {
    const r = amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, primita_la: "2026-10-08" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join("."))).toContain("primita_la");
    }
  });

  it("vehiculul trebuie să fie un UUID", () => {
    expect(amendaNouaSchema.safeParse({ ...AMENDA_VALIDA, vehicle_id: "nu-e-uuid" }).success).toBe(
      false,
    );
  });
});

describe("actualizeazaAmendaSchema", () => {
  it("cere id-ul amenzii și nu mai primește vehiculul", () => {
    const { vehicle_id: _vehicul, ...fara } = AMENDA_VALIDA;
    void _vehicul;
    const r = actualizeazaAmendaSchema.safeParse({ id: AMENDA, ...fara });
    expect(r.success).toBe(true);
    if (r.success) expect("vehicle_id" in r.data).toBe(false);
    expect(actualizeazaAmendaSchema.safeParse({ ...fara }).success).toBe(false);
  });
});

describe("desemneazaSoferSchema și trimiteRaspunsSchema", () => {
  it("desemnarea cere amenda și șoferul", () => {
    expect(desemneazaSoferSchema.safeParse({ id: AMENDA, employee_id: SOFER }).success).toBe(true);
    const r = desemneazaSoferSchema.safeParse({ id: AMENDA, employee_id: "" });
    expect(r.success).toBe(false);
  });

  it("răspunsul cere data trimiterii; numărul de ieșire e opțional", () => {
    const r = trimiteRaspunsSchema.safeParse({
      id: AMENDA,
      raspuns_trimis_la: "2026-10-12",
      raspuns_numar: " IES-9 ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.raspuns_numar).toBe("IES-9");
    expect(trimiteRaspunsSchema.safeParse({ id: AMENDA, raspuns_trimis_la: "" }).success).toBe(
      false,
    );
    const fara = trimiteRaspunsSchema.safeParse({ id: AMENDA, raspuns_trimis_la: "2026-10-12" });
    expect(fara.success && fara.data.raspuns_numar).toBeNull();
  });
});

describe("schimbaStadiulAmenziiSchema", () => {
  it("plătită și contestată nu cer motiv", () => {
    expect(schimbaStadiulAmenziiSchema.safeParse({ id: AMENDA, stadiu: "platita" }).success).toBe(
      true,
    );
    expect(
      schimbaStadiulAmenziiSchema.safeParse({ id: AMENDA, stadiu: "contestata" }).success,
    ).toBe(true);
  });

  it("anularea cere motivul, de cel puțin 3 caractere", () => {
    const fara = schimbaStadiulAmenziiSchema.safeParse({ id: AMENDA, stadiu: "anulata" });
    expect(fara.success).toBe(false);
    if (!fara.success) {
      expect(fara.error.issues[0]?.message).toBe("Scrieți motivul anulării.");
      expect(fara.error.issues[0]?.path).toEqual(["motiv"]);
    }
    expect(
      schimbaStadiulAmenziiSchema.safeParse({ id: AMENDA, stadiu: "anulata", motiv: "ab" }).success,
    ).toBe(false);
    expect(
      schimbaStadiulAmenziiSchema.safeParse({
        id: AMENDA,
        stadiu: "anulata",
        motiv: "Desființată de autoritate",
      }).success,
    ).toBe(true);
  });

  it("nu acceptă stadiile care au acțiune proprie", () => {
    for (const stadiu of ["primita", "sofer_desemnat", "raspuns_trimis"]) {
      expect(schimbaStadiulAmenziiSchema.safeParse({ id: AMENDA, stadiu }).success).toBe(false);
    }
  });
});

const INCIDENT_VALID = {
  vehicle_id: VEHICUL,
  tip: "coliziune",
  produs_la: "2026-10-11T16:00",
  locul: "Parcarea sediului",
  descriere: "Zgâriere aripă dreapta",
  sofer_id: SOFER,
  cost_estimat: "1200",
  observatii: "",
};

describe("incidentNouSchema", () => {
  it("primește un incident complet", () => {
    const r = incidentNouSchema.safeParse(INCIDENT_VALID);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.produs_la).toBe("2026-10-11T13:00:00.000Z");
    expect(r.data.cost_estimat).toBe(1200);
  });

  it("șoferul și costul estimat sunt opționale", () => {
    const r = incidentNouSchema.safeParse({ ...INCIDENT_VALID, sofer_id: "", cost_estimat: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sofer_id).toBeNull();
      expect(r.data.cost_estimat).toBeNull();
    }
  });

  it("tipul trebuie să fie unul cunoscut, iar descrierea are cel puțin 3 caractere", () => {
    expect(incidentNouSchema.safeParse({ ...INCIDENT_VALID, tip: "explozie" }).success).toBe(false);
    const r = incidentNouSchema.safeParse({ ...INCIDENT_VALID, descriere: "x" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Descrieți incidentul, în cel puțin 3 caractere.");
    }
  });
});

describe("actualizeazaIncidentSchema", () => {
  it("poartă detaliile editabile, fără vehicul și fără stadiu", () => {
    const r = actualizeazaIncidentSchema.safeParse({
      id: AMENDA,
      tip: "avarie",
      produs_la: "2026-10-11T16:00",
      locul: "",
      descriere: "Parbriz crăpat",
      sofer_id: "",
      cost_estimat: "300",
      despagubire: "",
      asigurator: "Allianz",
      dosar_numar: "D-77",
      work_accident_id: "",
      observatii: "",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.work_accident_id).toBeNull();
    expect(r.data.despagubire).toBeNull();
    expect("stadiu" in r.data).toBe(false);
    expect("vehicle_id" in r.data).toBe(false);
  });
});

describe("schimbaStadiulIncidentuluiSchema", () => {
  it("la asigurător cere numele asigurătorului, pe câmpul lui", () => {
    const r = schimbaStadiulIncidentuluiSchema.safeParse({ id: AMENDA, stadiu: "la_asigurator" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["asigurator"]);
      expect(r.error.issues[0]?.message).toBe(
        "Scrieți numele asigurătorului la care ați înregistrat dauna.",
      );
    }
    expect(
      schimbaStadiulIncidentuluiSchema.safeParse({
        id: AMENDA,
        stadiu: "la_asigurator",
        asigurator: "Allianz",
        dosar_numar: "D-77",
      }).success,
    ).toBe(true);
  });

  it("închiderea cere costul final; 0 e o valoare validă", () => {
    const fara = schimbaStadiulIncidentuluiSchema.safeParse({ id: AMENDA, stadiu: "inchis" });
    expect(fara.success).toBe(false);
    if (!fara.success) expect(fara.error.issues[0]?.path).toEqual(["cost_final"]);
    const zero = schimbaStadiulIncidentuluiSchema.safeParse({
      id: AMENDA,
      stadiu: "inchis",
      cost_final: "0",
    });
    expect(zero.success).toBe(true);
    if (zero.success) expect(zero.data.cost_final).toBe(0);
  });

  it("constatat și în reparație nu cer nimic în plus", () => {
    for (const stadiu of ["raportat", "constatat", "in_reparatie"]) {
      expect(schimbaStadiulIncidentuluiSchema.safeParse({ id: AMENDA, stadiu }).success).toBe(true);
    }
  });
});
