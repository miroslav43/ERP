// src/app/(app)/flota/rapoarte/adrese.test.ts
import { describe, expect, it } from "vitest";

import { adresaExport, adresaFoileLunii, adresaRaport } from "./adrese";

const V = "11111111-1111-4111-8111-111111111111";

describe("adresele rapoartelor flotei", () => {
  it("raportul pe o lună, cu sau fără vehicul", () => {
    expect(adresaRaport("2026-09", null)).toBe("/flota/rapoarte?luna=2026-09");
    expect(adresaRaport("2026-09", V)).toBe(`/flota/rapoarte?luna=2026-09&vehicul=${V}`);
  });

  it("descărcările poartă luna și vehiculul către rutele de export", () => {
    expect(adresaExport("xlsx", "2026-09", null)).toBe("/api/export/flota?luna=2026-09");
    expect(adresaExport("pachet", "2026-09", V)).toBe(
      `/api/export/flota/pachet?luna=2026-09&vehicul=${V}`,
    );
  });

  it("foile aprobate ale lunii: intervalul de zile exact, de la prima la ultima zi", () => {
    expect(adresaFoileLunii("2026-02", null)).toBe(
      "/flota/foi?status=aprobat&de_la=2026-02-01&pana_la=2026-02-28",
    );
    expect(adresaFoileLunii("2028-02", V)).toBe(
      `/flota/foi?status=aprobat&de_la=2028-02-01&pana_la=2028-02-29&vehicul=${V}`,
    );
  });
});
