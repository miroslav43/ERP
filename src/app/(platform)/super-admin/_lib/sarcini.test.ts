import { describe, expect, it } from "vitest";

import { construiesteSarcini, type RandOrganizatiePanou } from "./sarcini";

const firma = (peste: Partial<RandOrganizatiePanou> = {}): RandOrganizatiePanou => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Firma X",
  status: "active",
  moduleActive: 8,
  administratori: 1,
  ...peste,
});

describe("construiesteSarcini", () => {
  it("semnalează o cerere demo nouă, ca sarcină urgentă", () => {
    const sarcini = construiesteSarcini({ cereriDemoNoi: 1, organizatii: [] });
    expect(sarcini).toHaveLength(1);
    expect(sarcini[0]).toMatchObject({ cheie: "cereri-demo", urgent: true });
  });

  it("acordă corect pluralul la mai multe cereri", () => {
    const [sarcina] = construiesteSarcini({ cereriDemoNoi: 3, organizatii: [] });
    expect(sarcina?.titlu).toContain("3");
    expect(sarcina?.titlu).toContain("cereri");
  });

  it("nu semnalează nimic când nu sunt cereri noi", () => {
    expect(construiesteSarcini({ cereriDemoNoi: 0, organizatii: [] })).toEqual([]);
  });

  it("semnalează firma pornită doar cu nucleul", () => {
    const sarcini = construiesteSarcini({
      cereriDemoNoi: 0,
      organizatii: [firma({ name: "Beta Demo SRL", moduleActive: 1 })],
    });
    expect(sarcini).toHaveLength(1);
    expect(sarcini[0]?.cheie).toBe("fara-module");
    expect(sarcini[0]?.titlu).toContain("Beta Demo SRL");
  });

  it("nu semnalează o firmă cu module de lucru pornite", () => {
    expect(
      construiesteSarcini({ cereriDemoNoi: 0, organizatii: [firma({ moduleActive: 5 })] }),
    ).toEqual([]);
  });

  it("semnalează firma rămasă fără administrator", () => {
    const sarcini = construiesteSarcini({
      cereriDemoNoi: 0,
      organizatii: [firma({ name: "Firma Test", administratori: 0 })],
    });
    expect(sarcini.map((s) => s.cheie)).toContain("fara-admin");
  });

  it("ignoră firmele arhivate — nu mai sunt treaba nimănui", () => {
    expect(
      construiesteSarcini({
        cereriDemoNoi: 0,
        organizatii: [firma({ status: "archived", moduleActive: 1, administratori: 0 })],
      }),
    ).toEqual([]);
  });

  it("poate raporta două probleme pentru aceeași firmă", () => {
    const sarcini = construiesteSarcini({
      cereriDemoNoi: 0,
      organizatii: [firma({ moduleActive: 1, administratori: 0 })],
    });
    expect(sarcini.map((s) => s.cheie).sort()).toEqual(["fara-admin", "fara-module"]);
  });
});
