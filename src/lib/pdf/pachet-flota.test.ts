// src/lib/pdf/pachet-flota.test.ts
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import type { FoaieDetaliata } from "@/lib/queries/fleet-rapoarte";

import { numeUnic, pachetLunarFlota } from "./pachet-flota";

const V1 = "11111111-1111-4111-8111-111111111111";
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APROBATOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ORGANIZATIE: AntetOrganizatie = {
  denumire: "Transport Exemplu S.R.L.",
  formaJuridica: "S.R.L.",
  cui: "RO12345678",
  regCom: "J12/345/2020",
  adresa: "Str. Fabricii 1, Cluj-Napoca, Cluj",
  capitalSocial: 200,
  capitalVarsat: null,
  sistemDualist: false,
  telefon: null,
  email: null,
  pozitie: "antet",
  sigla: null,
};

const foaie = (id: string, m: Partial<FoaieDetaliata> = {}): FoaieDetaliata => ({
  id,
  vehicle_id: V1,
  employee_id: S1,
  numar: "FP-2026-0001",
  data: "2026-09-02",
  km_plecare: 1000,
  km_sosire: 1100,
  km_parcursi: 100,
  observatii: null,
  trimis_la: "2026-09-02T15:00:00Z",
  aprobat_de: APROBATOR,
  aprobat_la: "2026-09-03T08:00:00Z",
  vehicul_nr: "B100ABC",
  vehicul_categorie: "autoturism",
  vehicul_combustibil: "motorina",
  norma_l_100km: 7,
  alimentari: [
    {
      alimentat_la: "2026-09-02T10:00:00Z",
      litri: 8,
      cost: 56,
      statie: "Petrom",
      numar_bon: "123",
      plin: true,
    },
  ],
  curse: [
    {
      id: "c1",
      ordine: 1,
      plecare_la: "2026-09-02T05:00:00Z",
      sosire_la: "2026-09-02T08:00:00Z",
      de_la_loc: "Sediu",
      pana_la_loc: "Client",
      scop: "Livrare",
      km_plecare: 1000,
      km_sosire: 1100,
      km_parcursi: 100,
    },
  ],
  ...m,
});

const baza = {
  organizatie: ORGANIZATIE,
  vehicule: new Map([
    [
      V1,
      {
        nr_inmatriculare: "B100ABC",
        categorie: "autoturism" as const,
        tip_combustibil: "motorina" as const,
        consum_mediu_declarat: 7,
      },
    ],
  ]),
  soferi: new Map([[S1, "Popescu Ion"]]),
  aprobatori: new Map([[APROBATOR, "Ionescu Maria"]]),
  xlsx: { nume: "raport-flota-2026-09.xlsx", octeti: new Uint8Array([80, 75, 3, 4]) },
  generatLa: "12.10.2026 22:55",
};

describe("numeUnic", () => {
  it("al doilea nume identic primește sufix, fără să se piardă extensia", () => {
    const folosite = new Set<string>();
    expect(numeUnic("foi/foaie.pdf", folosite)).toBe("foi/foaie.pdf");
    expect(numeUnic("foi/foaie.pdf", folosite)).toBe("foi/foaie-2.pdf");
    expect(numeUnic("foi/foaie.pdf", folosite)).toBe("foi/foaie-3.pdf");
  });

  it("numele care diferă doar prin majuscule sunt același fișier pe Windows și macOS", () => {
    const folosite = new Set<string>();
    expect(numeUnic("foi/Foaie.pdf", folosite)).toBe("foi/Foaie.pdf");
    expect(numeUnic("foi/foaie.pdf", folosite)).toBe("foi/foaie-2.pdf");
  });
});

describe("pachetLunarFlota", () => {
  it("un ZIP cu Excelul la rădăcină și câte un PDF valid pe foaie aprobată", async () => {
    const octeti = await pachetLunarFlota({
      ...baza,
      foi: [
        foaie("f1"),
        foaie("f2", { numar: "FP-2026-0002", data: "2026-09-03", vehicul_nr: "B100ABC" }),
      ],
    });
    const zip = await JSZip.loadAsync(octeti);
    const nume = Object.keys(zip.files).filter((n) => !zip.files[n]?.dir);
    expect(nume.sort()).toEqual([
      "foi/foaie-de-parcurs-b100abc-2026-09-02-fp-2026-0001.pdf",
      "foi/foaie-de-parcurs-b100abc-2026-09-03-fp-2026-0002.pdf",
      "raport-flota-2026-09.xlsx",
    ]);

    const xlsx = await zip.file("raport-flota-2026-09.xlsx")?.async("uint8array");
    expect(Array.from(xlsx ?? [])).toEqual([80, 75, 3, 4]);

    for (const n of nume.filter((x) => x.endsWith(".pdf"))) {
      const pdf = await PDFDocument.load((await zip.file(n)?.async("uint8array")) ?? new Uint8Array());
      expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    }
  });

  it("două foi cu același nume nu se suprascriu în arhivă", async () => {
    const octeti = await pachetLunarFlota({
      ...baza,
      foi: [foaie("f1"), foaie("f2")],
    });
    const zip = await JSZip.loadAsync(octeti);
    const pdfuri = Object.keys(zip.files).filter((n) => n.endsWith(".pdf"));
    expect(pdfuri).toHaveLength(2);
  });

  it("fără nicio foaie, pachetul conține doar Excelul", async () => {
    const octeti = await pachetLunarFlota({ ...baza, foi: [] });
    const zip = await JSZip.loadAsync(octeti);
    expect(Object.keys(zip.files).filter((n) => !zip.files[n]?.dir)).toEqual([
      "raport-flota-2026-09.xlsx",
    ]);
  });
});
