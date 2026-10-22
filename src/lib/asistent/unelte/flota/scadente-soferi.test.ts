// src/lib/asistent/unelte/flota/scadente-soferi.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries/flota-asistent", () => ({ permiseCareExpira: vi.fn() }));
vi.mock("@/lib/queries/fleet", () => ({ angajatiDupaId: vi.fn() }));

import { angajatiDupaId } from "@/lib/queries/fleet";
import { permiseCareExpira } from "@/lib/queries/flota-asistent";

import { verificaAcces } from "../poarta";
import { contextFlota, FISA } from "./context-de-test";
import { unealtaScadenteSoferi } from "./scadente-soferi";

const ALT = "b0000000-0000-4000-8000-000000000009";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(permiseCareExpira).mockResolvedValue([
    { id: "p1", employee_id: FISA, categorii: ["B"], expira_la: "2026-11-01" },
    { id: "p2", employee_id: ALT, categorii: ["B", "C"], expira_la: "2026-10-10" },
  ]);
  vi.mocked(angajatiDupaId).mockResolvedValue(
    new Map([
      [FISA, { id: FISA, full_name: "Ana Popescu", marca: "1", deleted_at: null }],
      [ALT, { id: ALT, full_name: "Bogdan Ionescu", marca: "2", deleted_at: null }],
    ]),
  );
});

describe("scadente_soferi — poarta (decizia I-e3)", () => {
  it("toate cele cinci roluri au `driver_licenses:read`, inclusiv hr", () => {
    for (const rol of ["super_admin", "org_admin", "manager", "hr", "employee"] as const) {
      expect(verificaAcces(unealtaScadenteSoferi, contextFlota(rol)).permis, rol).toBe(true);
    }
  });
});

describe("scadente_soferi", () => {
  it("angajatul: doar permisul lui, fără nume și fără numărul permisului", async () => {
    const r = await unealtaScadenteSoferi.executa(contextFlota("employee"), {});
    expect(r.text).toBe("Permisul tău de conducere (B) expiră pe 01.11.2026 (în 10 zile).");
    expect(r.text).not.toContain("Bogdan");
    expect(angajatiDupaId).not.toHaveBeenCalled();
    expect(r.referinte).toEqual(["portal.masina"]);
  });

  it("angajatul fără fișă: refuz cu motiv", async () => {
    const r = await unealtaScadenteSoferi.executa(
      contextFlota("employee", { employeeId: null }),
      {},
    );
    expect(r.text).toContain("nu are fișă de angajat");
    expect(permiseCareExpira).not.toHaveBeenCalled();
  });

  it("hr: toate, cu nume și pastilă spre fișă, cel expirat întâi", async () => {
    const r = await unealtaScadenteSoferi.executa(contextFlota("hr"), {});
    const linii = r.text.split("\n").filter((l) => l.startsWith("- "));
    expect(linii).toEqual([
      `- Bogdan Ionescu: permisul (B, C) a expirat pe 10.10.2026 (acum 12 zile) → fisa.${ALT}`,
      `- Ana Popescu: permisul (B) expiră pe 01.11.2026 (în 10 zile) → fisa.${FISA}`,
    ]);
    expect((r.destinatiiEfemere ?? []).map((d) => d.href)).toEqual([
      `/angajati/${ALT}`,
      `/angajati/${FISA}`,
    ]);
    expect(vi.mocked(permiseCareExpira).mock.calls[0]?.[1]).toBe("2026-11-21");
  });

  it("orizontul cerut, și niciun permis care să expire", async () => {
    vi.mocked(permiseCareExpira).mockResolvedValue([]);
    const r = await unealtaScadenteSoferi.executa(contextFlota("manager"), { zile: 7 });
    expect(r.text).toBe(
      "Niciun permis de conducere dintre cele pe care le poți vedea nu expiră în următoarele 7 zile.",
    );
    expect(vi.mocked(permiseCareExpira).mock.calls[0]?.[1]).toBe("2026-10-29");
  });

  it("un argument nevalid întoarce refuzul", async () => {
    const r = await unealtaScadenteSoferi.executa(contextFlota("hr"), { zile: 1000 });
    expect(r.text).toContain("nu sunt valizi");
  });
});
