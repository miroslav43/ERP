// src/lib/pdf/scrisoare-desemnare.test.ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import { modelScrisoareDesemnare, type IntrareScrisoare } from "@/domain/fleet/amenzi";

import { genereazaScrisoareDesemnare } from "./scrisoare-desemnare";

/**
 * Ce apără fișierul: așezarea scrisorii (0203), nu conținutul ei — conținutul îl
 * fixează `src/domain/fleet/amenzi.test.ts`. O scrisoare cu fapta lungă și cu
 * toate notele trebuie să încapă pe pagină sau să treacă curat pe a doua, nu să
 * iasă tăcut din ea: `pdf-lib` desenează și sub marginea de jos, fără eroare.
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

const INTRARE: IntrareScrisoare = {
  organizatie: "Transport Exemplu S.R.L.",
  autoritate: "Poliția Rutieră Prahova",
  numarPv: "PV 12/A",
  dataPv: "09.10.2026",
  vehiculNr: "PH 12 ABC",
  momentFapta: "09.10.2026, ora 09:30",
  locul: "DN1, Ploiești",
  fapta: "Depășirea vitezei legale",
  sofer: {
    nume: "Popescu Ana",
    cnp: "2900101123456",
    adresa: "Str. Teiului 4, Ploiești, Prahova",
    tipAct: "CI",
    serieAct: "PH",
    numarAct: "123456",
  },
  dataScrisorii: "12.10.2026",
  numarIesire: "IES-9",
};

async function pagini(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("genereazaScrisoareDesemnare", () => {
  it("scrisoarea completă încape pe o pagină A4 în portret", async () => {
    const bytes = await genereazaScrisoareDesemnare({
      organizatie: ORGANIZATIE,
      model: modelScrisoareDesemnare(INTRARE),
      generatLa: "12.10.2026 10:00",
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(height).toBeGreaterThan(width);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("cu date lipsă din fișă iese tot un PDF valid, cu avertismentul sus", async () => {
    const model = modelScrisoareDesemnare({
      ...INTRARE,
      sofer: { ...INTRARE.sofer, cnp: null, adresa: null, serieAct: null, numarAct: null },
    });
    expect(model.lipsuri).toHaveLength(3);
    const bytes = await genereazaScrisoareDesemnare({
      organizatie: ORGANIZATIE,
      model,
      generatLa: "12.10.2026 10:00",
    });
    expect(await pagini(bytes)).toBe(1);
  });

  it("o faptă foarte lungă trece pe a doua pagină, nu iese din prima", async () => {
    const lunga = "Depășirea vitezei legale și nerespectarea semnalizării ".repeat(300);
    const bytes = await genereazaScrisoareDesemnare({
      organizatie: ORGANIZATIE,
      model: modelScrisoareDesemnare({ ...INTRARE, fapta: lunga }),
      generatLa: "12.10.2026 10:00",
    });
    expect(await pagini(bytes)).toBeGreaterThanOrEqual(2);
  });

  it("sedila din date nu strică randarea (fontul are ș și ț)", async () => {
    const bytes = await genereazaScrisoareDesemnare({
      organizatie: ORGANIZATIE,
      model: modelScrisoareDesemnare({
        ...INTRARE,
        sofer: { ...INTRARE.sofer, nume: "Șerban Țugulea", adresa: "Str. Ștefan cel Mare 3, Iași" },
      }),
      generatLa: "12.10.2026 10:00",
    });
    expect(await pagini(bytes)).toBe(1);
  });
});
