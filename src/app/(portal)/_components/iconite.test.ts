// src/app/(portal)/_components/iconite.test.ts
import { describe, expect, it } from "vitest";

import { PORTAL_NAV_ITEMS } from "@/config/navigation";

import { ICONITE } from "./iconite";

/**
 * O intrare de meniu fără iconiță nu pică nimic: railul și bara cad pe
 * `IconitaImplicita` (casa). Așa au ajuns patru intrări — Cursurile mele,
 * KPI-ul meu, Evaluările mele, Echipa mea — cu aceeași casă ca „Acasă”
 * (UX-044, ANG-002), văzute doar în QA. Testul mută descoperirea în `pnpm test`.
 */
describe("ICONITE — harta iconițelor portalului", () => {
  it("are câte o iconiță pentru fiecare intrare din PORTAL_NAV_ITEMS", () => {
    for (const intrare of PORTAL_NAV_ITEMS) {
      expect(ICONITE, intrare.id).toHaveProperty(intrare.id);
    }
  });

  it("folosește aceeași iconiță pe care o declară meniul", () => {
    for (const intrare of PORTAL_NAV_ITEMS) {
      expect(ICONITE[intrare.id], intrare.id).toBe(intrare.icon);
    }
  });
});
