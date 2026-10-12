import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluareKmIntrare,
  LIMITE_SERVICE,
  scadentaPlan,
  stareaPlanului,
  ultimaEfectiva,
  urmatoareaScadenta,
  type PlanPentruStare,
} from "./service";

describe("urmatoareaScadenta", () => {
  it("ultima dată + luni și ultimii km + interval, ca triggerul din 0203", () => {
    expect(
      urmatoareaScadenta({
        ultimaData: "2026-01-15",
        ultimiiKm: 40000,
        intervalKm: 10000,
        intervalLuni: 12,
      }),
    ).toEqual({ data: "2027-01-15", km: 50000 });
  });

  it("fără interval în luni nu există dată; fără interval în km nu există țintă", () => {
    expect(
      urmatoareaScadenta({
        ultimaData: "2026-01-15",
        ultimiiKm: 40000,
        intervalKm: 10000,
        intervalLuni: null,
      }),
    ).toEqual({ data: null, km: 50000 });
    expect(
      urmatoareaScadenta({
        ultimaData: "2026-01-15",
        ultimiiKm: 40000,
        intervalKm: null,
        intervalLuni: 6,
      }),
    ).toEqual({ data: "2026-07-15", km: null });
  });

  it("31 ianuarie + 1 lună cade pe 28 februarie, cum face Postgres", () => {
    expect(
      urmatoareaScadenta({
        ultimaData: "2026-01-31",
        ultimiiKm: 0,
        intervalKm: null,
        intervalLuni: 1,
      }).data,
    ).toBe("2026-02-28");
    expect(
      urmatoareaScadenta({
        ultimaData: "2024-01-31",
        ultimiiKm: 0,
        intervalKm: null,
        intervalLuni: 1,
      }).data,
    ).toBe("2024-02-29");
  });

  it("trece peste sfârșit de an", () => {
    expect(
      urmatoareaScadenta({
        ultimaData: "2026-11-30",
        ultimiiKm: 0,
        intervalKm: null,
        intervalLuni: 3,
      }).data,
    ).toBe("2027-02-28");
  });
});

const plan = (parti: Partial<PlanPentruStare> = {}): PlanPentruStare => ({
  activ: true,
  urmatoarea_data: null,
  urmatorii_km: null,
  prag_avertizare_km: 1000,
  ...parti,
});

describe("ultimaEfectiva", () => {
  // Planul din bază: baza 15.01 la 40.000 km, dar o intervenție legată din 01.09
  // la 45.000 km a mutat ultima (triggerul `vsp_inainte`).
  const dinIntrare = {
    baza_data: "2026-01-15",
    baza_km: 40000,
    ultima_data: "2026-09-01",
    ultimii_km: 45000,
  } as const;

  it("fără plan existent (creare), ultima e baza introdusă", () => {
    expect(ultimaEfectiva({ data: "2026-03-01", km: 41000 }, null)).toEqual({
      data: "2026-03-01",
      km: 41000,
    });
  });

  it("intervenția legată rămâne în joc cât timp baza nouă e mai veche decât ea", () => {
    expect(ultimaEfectiva({ data: "2026-01-15", km: 40000 }, dinIntrare)).toEqual({
      data: "2026-09-01",
      km: 45000,
    });
    expect(ultimaEfectiva({ data: "2025-06-01", km: 30000 }, dinIntrare)).toEqual({
      data: "2026-09-01",
      km: 45000,
    });
  });

  it("o bază mai nouă decât intervenția o înlocuiește", () => {
    expect(ultimaEfectiva({ data: "2026-10-01", km: 46000 }, dinIntrare)).toEqual({
      data: "2026-10-01",
      km: 46000,
    });
  });

  it("pereche (dată, km): aceeași zi, câștigă kilometrii mai mulți", () => {
    expect(ultimaEfectiva({ data: "2026-09-01", km: 44000 }, dinIntrare)).toEqual({
      data: "2026-09-01",
      km: 45000,
    });
    expect(ultimaEfectiva({ data: "2026-09-01", km: 45500 }, dinIntrare)).toEqual({
      data: "2026-09-01",
      km: 45500,
    });
  });

  it("planul fără nicio intervenție legată (ultima = baza) urmează baza nouă, și în jos", () => {
    const faraIntrari = {
      baza_data: "2026-01-15",
      baza_km: 40000,
      ultima_data: "2026-01-15",
      ultimii_km: 40000,
    } as const;
    expect(ultimaEfectiva({ data: "2025-12-01", km: 38000 }, faraIntrari)).toEqual({
      data: "2025-12-01",
      km: 38000,
    });
  });
});

describe("stareaPlanului", () => {
  const azi = "2026-10-12";

  it("planul oprit nu aprinde nimic", () => {
    expect(
      stareaPlanului(plan({ activ: false, urmatoarea_data: "2020-01-01" }), azi, 99999).stare,
    ).toBe("oprit");
  });

  it("fără dată și fără țintă nu are scadență", () => {
    expect(stareaPlanului(plan(), azi, 1000).stare).toBe("fara_scadenta");
  });

  it("după dată: întârziat, curând (30 de zile), în regulă", () => {
    expect(stareaPlanului(plan({ urmatoarea_data: "2026-10-11" }), azi, 0).stare).toBe("depasit");
    expect(stareaPlanului(plan({ urmatoarea_data: "2026-10-12" }), azi, 0).stare).toBe("curand");
    expect(stareaPlanului(plan({ urmatoarea_data: "2026-11-11" }), azi, 0).stare).toBe("curand");
    expect(stareaPlanului(plan({ urmatoarea_data: "2026-11-12" }), azi, 0).stare).toBe("in_regula");
  });

  it("după km: depășit la țintă, curând în pragul de avertizare, altfel în regulă", () => {
    expect(stareaPlanului(plan({ urmatorii_km: 50000 }), azi, 50000).stare).toBe("depasit");
    expect(stareaPlanului(plan({ urmatorii_km: 50000 }), azi, 49000).stare).toBe("curand");
    expect(stareaPlanului(plan({ urmatorii_km: 50000 }), azi, 48999).stare).toBe("in_regula");
  });

  it("câștigă cea mai gravă dintre dată și km, iar motivul spune care", () => {
    const r = stareaPlanului(
      plan({ urmatoarea_data: "2027-10-12", urmatorii_km: 50000 }),
      azi,
      50500,
    );
    expect(r.stare).toBe("depasit");
    expect(r.motiv).toBe("km");
    const d = stareaPlanului(
      plan({ urmatoarea_data: "2026-10-01", urmatorii_km: 90000 }),
      azi,
      1000,
    );
    expect(d.stare).toBe("depasit");
    expect(d.motiv).toBe("data");
  });

  it("km rămași și zile rămase sunt cifrele afișate", () => {
    const r = stareaPlanului(
      plan({ urmatoarea_data: "2026-10-22", urmatorii_km: 50000 }),
      azi,
      49200,
    );
    expect(r.kmRamasi).toBe(800);
    expect(r.zileRamase).toBe(10);
  });
});

describe("scadentaPlan", () => {
  it("scrie scadența în cuvinte: data și/sau ținta de km", () => {
    expect(scadentaPlan({ urmatoarea_data: "2027-01-15", urmatorii_km: 50000 })).toBe(
      "15.01.2027 sau 50.000 km",
    );
    expect(scadentaPlan({ urmatoarea_data: "2027-01-15", urmatorii_km: null })).toBe("15.01.2027");
    expect(scadentaPlan({ urmatoarea_data: null, urmatorii_km: 50000 })).toBe("50.000 km");
    expect(scadentaPlan({ urmatoarea_data: null, urmatorii_km: null })).toBe("—");
  });
});

describe("evaluareKmIntrare", () => {
  it("în apropierea kilometrajului vehiculului e în regulă", () => {
    expect(evaluareKmIntrare(46500, 46800, 1500)).toBe("ok");
    expect(evaluareKmIntrare(46500, 46500, 1500)).toBe("ok");
  });

  it("sub kilometrajul curent e o intervenție veche: se acceptă, dar se spune", () => {
    expect(evaluareKmIntrare(46500, 30000, 1500)).toBe("veche");
  });

  it("peste prag e salt: probabil o cifră greșită, care ar urca kilometrajul vehiculului", () => {
    expect(evaluareKmIntrare(46500, 46500 + 1501, 1500)).toBe("salt");
    expect(evaluareKmIntrare(46500, 450000, 1500)).toBe("salt");
  });

  it("aceeași regulă ca între foi: verificaContinuitate dă ok sau salt", () => {
    // La exact pragul nu e salt (comparația e strict mai mare, ca în bază).
    expect(evaluareKmIntrare(1000, 2500, 1500)).toBe("ok");
  });
});

describe("limitele lipite de migrarea 0203", () => {
  const migrare = readFileSync(
    join(process.cwd(), "supabase/migrations/0203_flota_service_costuri.sql"),
    "utf8",
  );
  const L = LIMITE_SERVICE;

  it("intervalele, kilometrii și pragul de avertizare", () => {
    expect(migrare).toContain(
      `interval_km is null or interval_km between ${String(L.intervalKmMin)} and ${String(L.intervalKmMax)}`,
    );
    expect(migrare).toContain(
      `interval_luni is null or interval_luni between ${String(L.intervalLuniMin)} and ${String(L.intervalLuniMax)}`,
    );
    expect(migrare).toContain(`baza_km between 0 and ${String(L.kmMax)}`);
    expect(migrare).toContain(`km between 0 and ${String(L.kmMax)}`);
    expect(migrare).toContain(
      `prag_avertizare_km integer not null default ${String(L.pragAvertizareKmImplicit)}`,
    );
    expect(migrare).toContain(`prag_avertizare_km between 0 and ${String(L.pragAvertizareKmMax)}`);
  });

  it("lungimile textelor", () => {
    expect(migrare).toContain(
      `char_length(btrim(denumire)) between ${String(L.denumireMin)} and ${String(L.denumireMax)}`,
    );
    expect(migrare).toContain(
      `char_length(btrim(descriere)) between ${String(L.descriereMin)} and ${String(L.descriereMax)}`,
    );
    expect(migrare).toContain(
      `furnizor is null or char_length(furnizor) <= ${String(L.furnizorMax)}`,
    );
    expect(migrare).toContain(
      `numar_factura is null or char_length(numar_factura) <= ${String(L.facturaMax)}`,
    );
    expect(migrare).toContain(
      `numar_document is null or char_length(numar_document) <= ${String(L.documentMax)}`,
    );
    expect(migrare).toContain(
      `observatii is null or char_length(observatii) <= ${String(L.observatiiMax)}`,
    );
  });

  it("ziua de scadență se calculează cu luni calendaristice, nu cu 30 de zile", () => {
    expect(migrare).toContain("make_interval(months => new.interval_luni::integer)");
  });
});
