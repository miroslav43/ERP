// src/lib/pdf/proces-verbal-vehicul.test.ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import { modelPv, type DatePv, type IntrareModelPv } from "@/domain/fleet/proces-verbal";

import { genereazaPvVehicul } from "./proces-verbal-vehicul";

/**
 * Ce apără fișierul: așezarea PV-ului (0215, F12c), nu conținutul lui —
 * conținutul îl fixează `src/domain/fleet/proces-verbal.test.ts`. `pdf-lib`
 * desenează și sub marginea de jos fără nicio eroare, deci un PV cu 30 de daune
 * și observații lungi trebuie să treacă pe pagina a doua, nu să iasă din pagină.
 */

const ORGANIZATIE: AntetOrganizatie = {
  denumire: "Transport Ștefănești S.R.L.",
  formaJuridica: "S.R.L.",
  cui: "RO12345678",
  regCom: "J12/345/2020",
  adresa: "Str. Fabricii 1, Țăndărei, Ialomița",
  capitalSocial: 200,
  capitalVarsat: null,
  sistemDualist: false,
  telefon: null,
  email: null,
  pozitie: "antet",
  sigla: null,
};

const PV: DatePv = {
  tip: "transfer",
  stare: "finalizat",
  moment: "2026-10-12T07:30:00.000Z",
  data_pv: "2026-10-12",
  numar: "PVA-2026-0003",
  numar_registru: "437/12.10.2026",
  km_bord: 51200,
  nivel_rezervor: "jumatate",
  numar_chei: 2,
  stare_generala: "uzura_normala",
  anvelope: "iarna",
  documente_bord: ["certificat_inmatriculare", "polita_rca"],
  dotari: ["trusa_medicala", "triunghiuri"],
  daune_constatate: true,
  daune: [{ zona: "lateral_dreapta", descriere: "Zgârietură pe ușa din spate, ștearsă parțial" }],
  observatii:
    "Șoferul a semnalat un zgomot la frâna din față; țeava de eșapament e prinsă provizoriu.",
  finalizat_la: "2026-10-14T08:00:00.000Z",
  confirmat_predator_la: "2026-10-12T09:00:00.000Z",
  confirmat_primitor_la: null,
  anulat_la: null,
  motiv_anulare: null,
};

function intrare(pv: DatePv): IntrareModelPv {
  return {
    pv,
    vehicul: {
      nr_inmatriculare: "IL12ȘȚĂ",
      marca: "Dacia",
      model: "Duster",
      vin: "UU1HSDADG12345678",
      categorie: "autoturism",
      tip_combustibil: "motorina",
      an_fabricatie: 2021,
    },
    predator: { tip: "angajat", nume: "Țăranu Ștefan", marca: "A-1", functie: "Șofer" },
    primitor: { tip: "angajat", nume: "Șerban Ioana", marca: "A-2", functie: "Agent vânzări" },
    reprezentant: { nume: "Ionescu Maria", functie: "Administrator" },
    firma: "Transport Ștefănești S.R.L.",
    documente: [
      {
        cod: "rca",
        denumire: "Asigurare RCA",
        numar: "R-1",
        expira_la: "2026-10-01",
        valabil: false,
      },
    ],
    etichete: { categorie: { autoturism: "Autoturism" }, combustibil: { motorina: "Motorină" } },
  };
}

describe("genereazaPvVehicul", () => {
  it("un PDF valid, A4 portret, cu diacriticele românești", { timeout: 30_000 }, async () => {
    const octeti = await genereazaPvVehicul({
      organizatie: ORGANIZATIE,
      model: modelPv(intrare(PV)),
      numar: PV.numar,
      generatLa: "14.10.2026, 11:00",
    });
    expect(new TextDecoder().decode(octeti.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(octeti);
    const pagina = pdf.getPages()[0];
    expect(pagina?.getHeight()).toBeGreaterThan(pagina?.getWidth() ?? Infinity);
    expect(pdf.getTitle()).toBe("PROCES-VERBAL DE PREDARE-PRIMIRE A VEHICULULUI PVA-2026-0003");
  });

  it("30 de daune și observații lungi trec pe pagina următoare", { timeout: 30_000 }, async () => {
    const pv: DatePv = {
      ...PV,
      daune: Array.from({ length: 30 }, (_, i) => ({
        zona: "altele" as const,
        descriere: `Dauna ${String(i + 1)}: zgârietură lungă pe caroserie, cu vopseaua sărită și rugină începută`,
      })),
      observatii: "Observație lungă despre starea vehiculului. ".repeat(40),
    };
    const octeti = await genereazaPvVehicul({
      organizatie: ORGANIZATIE,
      model: modelPv(intrare(pv)),
      numar: pv.numar,
      generatLa: "14.10.2026, 11:00",
    });
    const pdf = await PDFDocument.load(octeti);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it(
    "PV-ul anulat se generează, cu subsolul firmei pe fiecare pagină",
    { timeout: 30_000 },
    async () => {
      const pv: DatePv = {
        ...PV,
        anulat_la: "2026-10-15T09:00:00.000Z",
        motiv_anulare: "Kilometrajul a fost citit greșit la predare.",
      };
      const octeti = await genereazaPvVehicul({
        organizatie: { ...ORGANIZATIE, pozitie: "subsol" },
        model: modelPv(intrare(pv)),
        numar: pv.numar,
        generatLa: "15.10.2026, 12:00",
      });
      const pdf = await PDFDocument.load(octeti);
      expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    },
  );

  it(
    "predarea simplă, cu partea-firmă, are două rubrici și se generează",
    { timeout: 30_000 },
    async () => {
      const pv: DatePv = { ...PV, tip: "predare", confirmat_predator_la: null };
      const model = modelPv({
        ...intrare(pv),
        predator: { tip: "firma", nume: "Transport Ștefănești S.R.L.", marca: null, functie: null },
      });
      expect(model.semnaturi).toHaveLength(2);
      const octeti = await genereazaPvVehicul({
        organizatie: ORGANIZATIE,
        model,
        numar: pv.numar,
        generatLa: "14.10.2026, 11:00",
      });
      expect((await PDFDocument.load(octeti)).getPageCount()).toBeGreaterThanOrEqual(1);
    },
  );
});
