import { describe, expect, it } from "vitest";

import type { PermissionScope } from "@/config/permissions";

import { hrefAvertisment, rutaConcreta } from "./legaturi-avertismente";

const FLUTURAS = {
  periodId: "p-1",
  employeeId: "e-1",
  an: 2026,
  luna: 2,
} as const;

function context(permisiuni: Readonly<Record<string, PermissionScope>>, module: readonly string[]) {
  return { features: new Set(module), permissions: new Map(Object.entries(permisiuni)) };
}

describe("rutaConcreta", () => {
  it("ruta generică din catalog devine ecranul omului și al lunii", () => {
    expect(rutaConcreta("/angajati", FLUTURAS)).toBe("/angajati/e-1");
    expect(rutaConcreta("/pontaj", FLUTURAS)).toBe("/pontaj?an=2026&luna=2&angajat=e-1");
    expect(rutaConcreta("/salarizare", FLUTURAS)).toBe("/salarizare/p-1");
    expect(rutaConcreta("/diurna", FLUTURAS)).toBe("/diurna?angajat=e-1");
    expect(rutaConcreta("/salarizare/istoric-venituri", FLUTURAS)).toBe(
      "/salarizare/istoric-venituri?angajat=e-1",
    );
  });

  it("„/concedii” duce la cererile angajatului din luna fluturașului, nu la redirectul spre calendar", () => {
    expect(rutaConcreta("/concedii", FLUTURAS)).toBe(
      "/concedii/echipa?employee_id=e-1&de_la=2026-02-01&pana_la=2026-02-28",
    );
  });

  it("„/setari” n-are pagină: devine profilul firmei; `null` rămâne `null`; restul trec neschimbate", () => {
    expect(rutaConcreta("/setari", FLUTURAS)).toBe("/setari/organizatie");
    expect(rutaConcreta(null, FLUTURAS)).toBeNull();
    expect(rutaConcreta("/salarizare/popriri", FLUTURAS)).toBe("/salarizare/popriri");
  });
});

describe("hrefAvertisment", () => {
  const hr = context(
    {
      "payroll:read": "all",
      "employees:read": "all",
      "attendance:read": "all",
      "leave:read": "all",
    },
    ["payroll", "attendance", "leave", "per_diem"],
  );

  it("codul din catalog duce la ecranul de reparat, prin poarta țintei", () => {
    expect(hrefAvertisment("SAL_CM_NECALCULAT", FLUTURAS, hr)).toBe(
      "/concedii/echipa?employee_id=e-1&de_la=2026-02-01&pana_la=2026-02-28",
    );
  });

  it("fără dreptul paginii-țintă rămâne text: hr n-are per_diem:read", () => {
    expect(hrefAvertisment("SAL_DIURNA_PESTE_PLAFON_ZILNIC", FLUTURAS, hr)).toBeNull();
  });

  it("modulul oprit închide linkul chiar cu drept", () => {
    const faraPontaj = context({ "payroll:read": "all", "attendance:read": "all" }, ["payroll"]);
    expect(hrefAvertisment("SAL_ZILE_PESTE_LUNA", FLUTURAS, faraPontaj)).toBeNull();
  });

  it("un cod necunoscut (fluturaș vechi) nu aruncă și nu leagă nimic", () => {
    expect(hrefAvertisment("COD_INEXISTENT", FLUTURAS, hr)).toBeNull();
  });
});
