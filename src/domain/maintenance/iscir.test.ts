// src/domain/maintenance/iscir.test.ts
//
// Semaforul autorizației ISCIR (M7, cazul 38: roșu peste tot, fără blocare),
// lista de tipuri, legătura tip → categorie legală și avertismentul de maxim
// legal (cazul 40), plus alerta RSVTI lipsă (cazul 41).

import { describe, expect, it } from "vitest";

import {
  ETICHETE_TIP_ISCIR,
  TIPURI_ISCIR,
  avertismentMaximLegal,
  categoriePentruTipIscir,
  cereAtentieAutorizatie,
  etichetaTipIscir,
  lipsesteRsvti,
  stareAutorizatie,
  termenAutorizatie,
} from "./iscir";

const AZI = "2026-10-12";

const baza = {
  valabil_pana: "2027-06-01",
  scadenta_verificare_tehnica: null,
  suspendata_la: null,
  inlocuita_de_id: null,
} as const;

describe("TIPURI_ISCIR", () => {
  it("are lista din plan și o etichetă pe fiecare", () => {
    expect([...TIPURI_ISCIR]).toEqual([
      "ascensor",
      "platforma_ridicatoare",
      "stivuitor",
      "macara",
      "pod_rulant",
      "cazan",
      "recipient_sub_presiune",
      "instalatie_gpl",
      "compresor",
      "altele",
    ]);
    for (const t of TIPURI_ISCIR) expect(ETICHETE_TIP_ISCIR[t].length).toBeGreaterThan(2);
  });

  it("un tip liber vechi (rândurile dinainte de 0211) se afișează așa cum e", () => {
    expect(etichetaTipIscir("macara")).toBe(ETICHETE_TIP_ISCIR.macara);
    expect(etichetaTipIscir("Macara capră 5t")).toBe("Macara capră 5t");
  });
});

describe("termenAutorizatie", () => {
  it("cel mai apropiat dintre valabilitate și VTP", () => {
    expect(termenAutorizatie(baza)).toBe("2027-06-01");
    expect(termenAutorizatie({ ...baza, scadenta_verificare_tehnica: "2026-12-01" })).toBe(
      "2026-12-01",
    );
    expect(termenAutorizatie({ ...baza, scadenta_verificare_tehnica: "2028-01-01" })).toBe(
      "2027-06-01",
    );
  });
});

describe("stareAutorizatie", () => {
  it("valabilă, expiră curând, expirată — după termenul cel mai apropiat", () => {
    expect(stareAutorizatie(baza, AZI)).toBe("valabila");
    expect(stareAutorizatie({ ...baza, valabil_pana: "2026-10-20" }, AZI)).toBe("expira_curand");
    expect(stareAutorizatie({ ...baza, valabil_pana: "2026-10-11" }, AZI)).toBe("expirata");
    // Autorizația valabilă, dar VTP-ul depășit: tot expirată (cazul 38).
    expect(stareAutorizatie({ ...baza, scadenta_verificare_tehnica: "2026-09-30" }, AZI)).toBe(
      "expirata",
    );
  });

  it("scadența de azi e încă „expiră curând”, nu expirată", () => {
    expect(stareAutorizatie({ ...baza, valabil_pana: AZI }, AZI)).toBe("expira_curand");
  });

  it("înlocuirea bate suspendarea, suspendarea bate expirarea", () => {
    expect(
      stareAutorizatie(
        { ...baza, valabil_pana: "2020-01-01", suspendata_la: "2026-01-01", inlocuita_de_id: "x" },
        AZI,
      ),
    ).toBe("inlocuita");
    expect(
      stareAutorizatie({ ...baza, valabil_pana: "2020-01-01", suspendata_la: "2026-01-01" }, AZI),
    ).toBe("suspendata");
  });

  it("pragul se poate da explicit", () => {
    expect(stareAutorizatie({ ...baza, valabil_pana: "2026-11-05" }, AZI, 30)).toBe(
      "expira_curand",
    );
    expect(stareAutorizatie({ ...baza, valabil_pana: "2026-11-05" }, AZI, 15)).toBe("valabila");
  });
});

describe("cereAtentieAutorizatie", () => {
  it("doar expirata și expira_curand cer acțiune", () => {
    expect(cereAtentieAutorizatie("expirata")).toBe(true);
    expect(cereAtentieAutorizatie("expira_curand")).toBe(true);
    expect(cereAtentieAutorizatie("valabila")).toBe(false);
    expect(cereAtentieAutorizatie("suspendata")).toBe(false);
    expect(cereAtentieAutorizatie("inlocuita")).toBe(false);
  });
});

describe("categoriePentruTipIscir", () => {
  it("mașinile de ridicat, ascensorul, cazanul și recipientele au categorie", () => {
    expect(categoriePentruTipIscir("macara")?.cod).toBe("vtp_masini_ridicat");
    expect(categoriePentruTipIscir("stivuitor")?.cod).toBe("vtp_masini_ridicat");
    expect(categoriePentruTipIscir("ascensor")?.cod).toBe("vtp_ascensor");
    expect(categoriePentruTipIscir("cazan")?.cod).toBe("vtp_cazan");
    expect(categoriePentruTipIscir("compresor")?.cod).toBe("vtp_recipient");
  });

  it("tipul liber sau „altele” ⇒ fără categorie", () => {
    expect(categoriePentruTipIscir("altele")).toBeNull();
    expect(categoriePentruTipIscir("Macara capră 5t")).toBeNull();
  });
});

describe("avertismentMaximLegal (cazul 40)", () => {
  it("documentul mai scurt decât maximul ⇒ fără avertisment", () => {
    expect(
      avertismentMaximLegal({
        tip: "macara",
        emis_la: "2026-01-10",
        valabil_pana: "2027-01-10",
        scadenta_verificare_tehnica: null,
      }),
    ).toBeNull();
  });

  it("VTP peste maximul de 2 ani ⇒ avertisment cu data maximă, ⚠ de confirmat", () => {
    const mesaj = avertismentMaximLegal({
      tip: "macara",
      emis_la: "2026-01-10",
      valabil_pana: "2027-01-10",
      scadenta_verificare_tehnica: "2028-06-01",
    });
    expect(mesaj).toContain("10.01.2028");
    expect(mesaj).toContain("⚠");
    expect(mesaj?.endsWith(".")).toBe(true);
  });

  it("fără dată de emitere sau fără categorie ⇒ null", () => {
    expect(
      avertismentMaximLegal({
        tip: "macara",
        emis_la: null,
        valabil_pana: "2035-01-01",
        scadenta_verificare_tehnica: null,
      }),
    ).toBeNull();
    expect(
      avertismentMaximLegal({
        tip: "altele",
        emis_la: "2026-01-10",
        valabil_pana: "2035-01-01",
        scadenta_verificare_tehnica: null,
      }),
    ).toBeNull();
  });
});

describe("lipsesteRsvti (cazul 41)", () => {
  it("echipamente ISCIR fără RSVTI activ ⇒ alertă", () => {
    expect(lipsesteRsvti({ echipamenteIscir: 2, rsvtiActiv: false })).toBe(true);
    expect(lipsesteRsvti({ echipamenteIscir: 2, rsvtiActiv: true })).toBe(false);
    expect(lipsesteRsvti({ echipamenteIscir: 0, rsvtiActiv: false })).toBe(false);
  });
});
