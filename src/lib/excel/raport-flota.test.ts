// src/lib/excel/raport-flota.test.ts
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  consumPeVehicul,
  costPeVehicul,
  kmPeSofer,
  registruFoi,
  totaluriCost,
  totaluriLuna,
  type FoaieRaport,
  type RaportLunar,
} from "@/domain/fleet/rapoarte";
import { curataDocument } from "@/lib/unelte/document-tabelar";
import { randeazaXlsx } from "@/lib/unelte/xlsx";

import { documentRaportFlota } from "./raport-flota";

const V1 = "11111111-1111-4111-8111-111111111111";
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const foaie = (id: string, m: Partial<FoaieRaport> = {}): FoaieRaport => ({
  id,
  vehicle_id: V1,
  employee_id: S1,
  numar: "FP-2026-0001",
  data: "2026-09-02",
  km_parcursi: 400,
  vehicul_nr: "B100ABC",
  vehicul_combustibil: "motorina",
  norma_l_100km: 7,
  alimentari: [{ litri: 36, cost: 252.5 }],
  ...m,
});

function raport(foi: readonly FoaieRaport[], m: Partial<RaportLunar> = {}): RaportLunar {
  const vehicule = new Map([[V1, "B100ABC"]]);
  const soferi = new Map([[S1, "Popescu Ion"]]);
  const costuri = costPeVehicul(
    {
      foi,
      servicii: foi.length === 0 ? [] : [{ vehicle_id: V1, cost_total: 750 }],
      cheltuieli: [],
      documente: [],
    },
    vehicule,
  );
  return {
    luna: "2026-09",
    interval: { deLa: "2026-09-01", panaLa: "2026-09-30" },
    vehicul: null,
    totaluri: totaluriLuna(foi),
    foiNeaprobate: { ciorne: 0, trimise: 0, respinse: 0 },
    consum: consumPeVehicul(foi, vehicule),
    soferi: kmPeSofer(foi, soferi),
    costuri,
    totalCost: totaluriCost(costuri),
    registru: registruFoi(foi, vehicule, soferi),
    ...m,
  };
}

const intrare = (r: RaportLunar, vehicul: string | null = null) =>
  documentRaportFlota({
    organizatie: "Firma Test SRL",
    raport: r,
    vehicul,
    generatLa: "12.10.2026 22:50",
  });

describe("documentRaportFlota", () => {
  it("titlul spune luna, subtitlul firma; pe un singur vehicul, și vehiculul", () => {
    const d = intrare(raport([foaie("f1")]));
    expect(d.titlu).toBe("Raport flotă — septembrie 2026");
    expect(d.subtitlu).toBe("Firma Test SRL");
    expect(intrare(raport([foaie("f1")]), "B100ABC").subtitlu).toBe(
      "Firma Test SRL · vehiculul B100ABC",
    );
    expect(d.numeFisier).toBe("raport-flota-2026-09");
    expect(intrare(raport([foaie("f1")]), "B100ABC").numeFisier).toBe(
      "raport-flota-2026-09-B100ABC",
    );
    expect(d.orientare).toBe("peisaj");
  });

  it("primul tabel e costul pe vehicul, cu rând de total și lei/km în format românesc", () => {
    const d = intrare(raport([foaie("f1")]));
    expect(d.coloane.map((c) => c.eticheta)).toEqual([
      "Vehicul",
      "Foi",
      "Service",
      "Cheltuieli",
      "Documente",
      "Combustibil (foi)",
      "Total",
      "Km",
      "Lei/km",
    ]);
    // 750 service + 252,50 combustibil = 1.002,50 lei la 400 km → 2,51 lei/km
    expect(d.randuri[0]).toEqual([
      "B100ABC",
      "1",
      "750,00",
      "0,00",
      "0,00",
      "252,50",
      "1.002,50",
      "400",
      "2,51",
    ]);
    expect(d.randuri.at(-1)).toEqual([
      "Total flotă",
      "1",
      "750,00",
      "0,00",
      "0,00",
      "252,50",
      "1.002,50",
      "400",
      "2,51",
    ]);
  });

  it("consumul real față de normă, cu unitatea pe rând și abaterea cu semn", () => {
    const d = intrare(raport([foaie("f1")]));
    const consum = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Consum"));
    expect(consum?.coloane.map((c) => c.eticheta)).toEqual([
      "Vehicul",
      "Foi",
      "Km",
      "Alimentat",
      "Consum real",
      "Norma",
      "Abatere",
      "Foi fără normă",
    ]);
    // 36 l la 400 km = 9,00 l/100 km față de norma 7,00 → +28,6%
    expect(consum?.randuri[0]).toEqual([
      "B100ABC",
      "1",
      "400",
      "36,00 l",
      "9,00 l/100",
      "7,00 l/100",
      "+28,6%",
      "0",
    ]);
  });

  it("fără normă pe foaie, norma și abaterea sunt „—”, nu zero", () => {
    const d = intrare(raport([foaie("f1", { norma_l_100km: null })]));
    const consum = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Consum"));
    expect(consum?.randuri[0]?.slice(5)).toEqual(["—", "—", "1"]);
  });

  it("vehiculul electric se arată în kWh", () => {
    const d = intrare(raport([foaie("f1", { vehicul_combustibil: "electric" })]));
    const consum = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Consum"));
    expect(consum?.randuri[0]?.[3]).toBe("36,00 kWh");
    expect(consum?.randuri[0]?.[4]).toBe("9,00 kWh/100");
  });

  it("kilometrii pe șofer și registrul foilor, cu data românească și „—” la foaia fără număr", () => {
    const d = intrare(
      raport([
        // F12f (0217): același cod pe două curse apare o singură dată în registru.
        foaie("f1", {
          uituri: [
            { uit: "4C0U0C0J0W3DDQ92" },
            { uit: "3V0P0L0P0T3JUW46" },
            { uit: "4C0U0C0J0W3DDQ92" },
          ],
        }),
        foaie("f2", { numar: null, data: "2026-09-03", km_parcursi: null }),
      ]),
    );
    const soferi = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Kilometri"));
    expect(soferi?.coloane.map((c) => c.eticheta)).toEqual([
      "Șofer",
      "Foi",
      "Zile",
      "Vehicule",
      "Km",
    ]);
    expect(soferi?.randuri[0]).toEqual(["Popescu Ion", "2", "2", "1", "400"]);

    const registru = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Foile"));
    expect(registru?.coloane.map((c) => c.eticheta)).toEqual([
      "Nr. foaie",
      "Data",
      "Vehicul",
      "Șofer",
      "Km",
      "Alimentat",
      "Cost combustibil",
      "Consum real",
      "Norma",
      "UIT",
    ]);
    expect(registru?.randuri[0]?.slice(0, 5)).toEqual([
      "FP-2026-0001",
      "02.09.2026",
      "B100ABC",
      "Popescu Ion",
      "400",
    ]);
    expect(registru?.randuri[0]?.[9]).toBe("3V0P0L0P0T3JUW46, 4C0U0C0J0W3DDQ92");
    expect(registru?.randuri[1]?.[0]).toBe("—");
    expect(registru?.randuri[1]?.[9]).toBe("");
  });

  it("foile neaprobate se spun în antet, ca un total mic să nu fie luat drept consum mic", () => {
    const fara = intrare(raport([foaie("f1")]));
    expect(fara.campuri.find((c) => c.eticheta.startsWith("Foi neaprobate"))?.valoare).toBe(
      "nicio foaie",
    );
    const cu = intrare(
      raport([foaie("f1")], { foiNeaprobate: { ciorne: 1, trimise: 2, respinse: 1 } }),
    );
    expect(cu.campuri.find((c) => c.eticheta.startsWith("Foi neaprobate"))?.valoare).toBe(
      "1 ciornă, 2 trimise spre aprobare, 1 respinsă",
    );
  });

  it("o lună fără foi: documentul există, cu rânduri goale, fără cifre inventate", () => {
    const d = intrare(raport([]));
    expect(d.randuri.at(-1)?.slice(-2)).toEqual(["0", "—"]);
    const registru = d.tabeleSuplimentare?.find((t) => t.titlu.startsWith("Foile"));
    expect(registru?.randuri).toEqual([]);
  });

  it("notele spun ce intră în cifre și că sumele sunt text formatat", () => {
    const note = intrare(raport([foaie("f1")])).note.join("\n");
    expect(note).toContain("foile APROBATE");
    expect(note).toContain("text");
  });

  it("se randează în Excel: fișier valid, cu luna și vehiculul în conținut", async () => {
    const d = curataDocument(intrare(raport([foaie("f1")])));
    const octeti = await randeazaXlsx(d);
    const zip = await JSZip.loadAsync(octeti);
    const texte = await zip.file("xl/sharedStrings.xml")?.async("string");
    expect(texte).toContain("Raport flotă — septembrie 2026");
    expect(texte).toContain("B100ABC");
    expect(texte).toContain("FP-2026-0001");
  });
});
