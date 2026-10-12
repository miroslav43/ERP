// src/lib/pdf/foaie-parcurs.test.ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import { modelFoaieParcurs, type CursaFoaie } from "@/domain/fleet/foaie";

import { genereazaFoaieParcurs } from "./foaie-parcurs";

/**
 * Ce apără fișierul: așezarea foii de parcurs (0197), nu conținutul ei —
 * conținutul îl fixează `src/domain/fleet/foaie.test.ts`. Pagina e în peisaj
 * (nouă coloane de cursă), iar o zi lungă de curier trece pe pagina a doua în
 * loc să iasă tăcut din pagină: `pdf-lib` desenează și sub marginea de jos, fără
 * nicio eroare.
 */

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

function curse(n: number): CursaFoaie[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i)}`,
    ordine: i + 1,
    plecare_la: new Date(Date.UTC(2026, 9, 5, 5, i * 5)).toISOString(),
    sosire_la: new Date(Date.UTC(2026, 9, 5, 5, i * 5 + 4)).toISOString(),
    de_la_loc: "Șoseaua Fabricii, depozitul de țiglă",
    pana_la_loc: "Câmpina, strada Ștefan cel Mare",
    scop: "Livrare marfă la client, cu încărcare la întoarcere",
    km_plecare: 10000 + i * 10,
    km_sosire: 10000 + i * 10 + 8,
    km_parcursi: 8,
  }));
}

function model(n: number) {
  return modelFoaieParcurs({
    numar: "FP-2026-00012",
    data: "2026-10-05",
    status: "aprobat",
    vehiculNr: "CJ12ABC",
    vehiculCategorie: "Autoutilitară",
    vehiculCombustibil: "Motorină",
    normaL100km: 9.5,
    unitate: "l",
    sofer: "Ștefan Țăranu",
    kmPlecare: 10000,
    kmSosire: 10000 + n * 10,
    observatii: "Drum închis la Bănești, ocol prin Telega.",
    trimisLa: "2026-10-05T16:00:00.000Z",
    aprobatDe: "Mihai Manager",
    aprobatLa: "2026-10-06T07:00:00.000Z",
    curse: curse(n),
    alimentari: [
      {
        alimentat_la: "2026-10-05T08:00:00.000Z",
        litri: 40,
        cost: 300,
        statie: "Petrom",
        numar_bon: "B-1",
        plin: true,
      },
    ],
    ora: (m) => m.slice(11, 16),
    dataSiOra: (m) => m.slice(0, 16).replace("T", " "),
    ziua: (d) => d.split("-").reverse().join("."),
  });
}

describe("genereazaFoaieParcurs", () => {
  it("un PDF în peisaj, cu diacriticele românești", { timeout: 30_000 }, async () => {
    const octeti = await genereazaFoaieParcurs({
      organizatie: ORGANIZATIE,
      model: model(3),
      generatLa: "06.10.2026, 10:00",
    });
    const pdf = await PDFDocument.load(octeti);
    expect(pdf.getPageCount()).toBe(1);
    const pagina = pdf.getPages()[0];
    expect(pagina?.getWidth()).toBeGreaterThan(pagina?.getHeight() ?? Infinity);
    expect(pdf.getTitle()).toBe("FOAIE DE PARCURS Nr. FP-2026-00012 din 05.10.2026");
  });

  it("o zi cu multe curse trece pe pagina următoare", { timeout: 30_000 }, async () => {
    const octeti = await genereazaFoaieParcurs({
      organizatie: ORGANIZATIE,
      model: model(60),
      generatLa: "06.10.2026, 10:00",
    });
    const pdf = await PDFDocument.load(octeti);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
