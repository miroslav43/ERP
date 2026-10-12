// src/domain/fleet/foaie.test.ts
import { describe, expect, it } from "vitest";

import {
  cursaDinSablon,
  modelFoaieParcurs,
  ordoneazaCurse,
  propunereCursaNoua,
  totaluriCurse,
  type CursaFoaie,
  type IntrareFoaieParcurs,
} from "./foaie";

const cursa = (m: Partial<CursaFoaie> & Pick<CursaFoaie, "id">): CursaFoaie => ({
  ordine: 1,
  plecare_la: "2026-10-05T05:00:00.000Z",
  sosire_la: "2026-10-05T06:00:00.000Z",
  de_la_loc: "Sediu",
  pana_la_loc: "Depozit",
  scop: "Aprovizionare",
  km_plecare: 10000,
  km_sosire: 10040,
  km_parcursi: 40,
  ...m,
});

const prima = cursa({ id: "c1" });
const aDoua = cursa({
  id: "c2",
  ordine: 2,
  plecare_la: "2026-10-05T07:00:00.000Z",
  sosire_la: "2026-10-05T08:30:00.000Z",
  de_la_loc: "Depozit",
  pana_la_loc: "Client Câmpina",
  scop: "Livrare",
  km_plecare: 10060,
  km_sosire: 10100,
  km_parcursi: 40,
});

describe("ordoneazaCurse", () => {
  it("ordinea zilei vine din oră, nu din ordinea citirii", () => {
    expect(ordoneazaCurse([aDoua, prima]).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("totaluriCurse", () => {
  it("bordul zilei = ultima sosire − prima plecare; golul dintre curse e drum fără cursă", () => {
    expect(totaluriCurse([aDoua, prima])).toEqual({
      kmCurse: 80,
      kmBord: 100,
      kmFaraCursa: 20,
      deschise: 0,
    });
  });

  it("o cursă pe drum: bordul nu se poate încă spune, iar cursa se numără deschisă", () => {
    const peDrum = cursa({ id: "c3", sosire_la: null, km_sosire: null, km_parcursi: null });
    expect(totaluriCurse([prima, peDrum])).toMatchObject({
      kmBord: null,
      deschise: 1,
      kmCurse: 40,
    });
  });

  it("fără curse: zero, nu NaN", () => {
    expect(totaluriCurse([])).toEqual({ kmCurse: 0, kmBord: null, kmFaraCursa: 0, deschise: 0 });
  });
});

describe("propunereCursaNoua", () => {
  it("foaia goală pornește de la kilometrajul foii, fără loc propus", () => {
    expect(propunereCursaNoua([], 9800)).toEqual({
      kmPlecare: 9800,
      dupa: null,
      deLaLoc: null,
      blocata: false,
    });
  });

  it("după o cursă încheiată: km și locul sosirii ei — exact ce acceptă baza", () => {
    expect(propunereCursaNoua([aDoua, prima], 9800)).toEqual({
      kmPlecare: 10100,
      dupa: "2026-10-05T08:30:00.000Z",
      deLaLoc: "Client Câmpina",
      blocata: false,
    });
  });

  it("ultima cursă e pe drum: cursa nouă e blocată (doar ultima poate rămâne deschisă)", () => {
    const peDrum = cursa({ id: "c3", sosire_la: null, km_sosire: null, km_parcursi: null });
    expect(propunereCursaNoua([peDrum], 0).blocata).toBe(true);
  });
});

describe("cursaDinSablon", () => {
  it("locurile și scopul din șablon, km de la propunere, sosirea estimată", () => {
    const sablon = {
      id: "s1",
      denumire: "Sediu — Depozit",
      de_la_loc: "Sediu",
      pana_la_loc: "Depozit",
      scop: "Aprovizionare",
      km_estimat: 18,
    };
    expect(cursaDinSablon(sablon, propunereCursaNoua([prima], 0))).toEqual({
      de_la_loc: "Sediu",
      pana_la_loc: "Depozit",
      scop: "Aprovizionare",
      km_plecare: 10040,
      km_sosire: 10058,
    });
    expect(
      cursaDinSablon({ ...sablon, km_estimat: null }, propunereCursaNoua([], 5)).km_sosire,
    ).toBeNull();
  });
});

describe("modelFoaieParcurs — elementele documentului justificativ", () => {
  const baza: IntrareFoaieParcurs = {
    numar: "FP-2026-00007",
    data: "2026-10-05",
    status: "aprobat",
    vehiculNr: "B123ABC",
    vehiculCategorie: "Autoturism",
    vehiculCombustibil: "Motorină",
    normaL100km: 6.5,
    unitate: "l",
    sofer: "Ana Șofer",
    kmPlecare: 10000,
    kmSosire: 10100,
    observatii: null,
    trimisLa: "2026-10-05T15:00:00.000Z",
    aprobatDe: "Mihai Manager",
    aprobatLa: "2026-10-06T07:00:00.000Z",
    curse: [aDoua, prima],
    alimentari: [
      {
        alimentat_la: "2026-10-05T06:30:00.000Z",
        litri: 20,
        cost: 150,
        statie: "Petrom",
        numar_bon: "123",
        plin: true,
      },
    ],
    ora: (m) => m.slice(11, 16),
    dataSiOra: (m) => `${m.slice(0, 10)} ${m.slice(11, 16)}`,
    ziua: (d) => d.split("-").reverse().join("."),
  };

  it("HG 1/2016 pct. 16 alin. (2): categoria, scopul și locul, km parcurși, norma", () => {
    const m = modelFoaieParcurs(baza);
    const rubrici = Object.fromEntries(m.rubrici);
    expect(rubrici["Categoria vehiculului"]).toBe("Autoturism");
    expect(rubrici["Norma proprie de consum"]).toBe("6,50 l/100 km");
    expect(m.curse.map((c) => [c.nr, c.deLa, c.panaLa, c.scop, c.km])).toEqual([
      ["1", "Sediu", "Depozit", "Aprovizionare", "40"],
      ["2", "Depozit", "Client Câmpina", "Livrare", "40"],
    ]);
    const totaluri = Object.fromEntries(m.totaluri);
    expect(totaluri["Km parcurși (bord)"]).toBe("100");
    expect(totaluri["Km pe curse"]).toBe("80");
    expect(totaluri["Km fără cursă scrisă"]).toBe("20");
    expect(totaluri["Consum după normă"]).toBe("6,50 l");
  });

  it("OMFP 2634/2015: numărul și data în titlu; aprobarea din audit, cu cine și când", () => {
    const m = modelFoaieParcurs(baza);
    expect(m.titlu).toBe("FOAIE DE PARCURS");
    expect(m.subtitlu).toBe("Nr. FP-2026-00007 din 05.10.2026");
    expect(m.aprobare).toBe("Aprobată de Mihai Manager la 2026-10-06 07:00.");
    expect(m.avertismente).toEqual([]);
    expect(m.note.join(" ")).toContain("HG 1/2016");
    expect(m.numeFisier).toBe("foaie-de-parcurs-B123ABC-2026-10-05-FP-2026-00007");
  });

  it("documentul incomplet o spune pe față: neaprobat, fără număr, fără normă, fără loc", () => {
    const m = modelFoaieParcurs({
      ...baza,
      status: "draft",
      numar: null,
      normaL100km: null,
      aprobatLa: null,
      curse: [cursa({ id: "c9", de_la_loc: null })],
    });
    expect(m.avertismente).toEqual([
      "Document neaprobat: Ciornă — netrimisă spre aprobare.",
      "Foaia nu are număr: îl primește la trimiterea spre aprobare.",
      "Norma proprie de consum nu e completată pe vehicul (HG 1/2016 pct. 16 alin. (2)).",
      "O cursă nu are locul sau scopul completat.",
    ]);
    expect(m.aprobare).toBe("Neaprobată.");
    expect(Object.fromEntries(m.rubrici)["Norma proprie de consum"]).toBe("");
  });

  it("alimentările apar în ordinea orei, oricum le-ar fi adus citirea (embed fără ORDER BY)", () => {
    const dimineata = {
      alimentat_la: "2026-10-05T06:30:00.000Z",
      litri: 20,
      cost: 150,
      statie: "Petrom",
      numar_bon: "123",
      plin: true,
    };
    const seara = {
      alimentat_la: "2026-10-05T16:45:00.000Z",
      litri: 10,
      cost: 80,
      statie: "OMV",
      numar_bon: "456",
      plin: false,
    };
    // Pachetul lunar citește alimentările printr-un embed, iar ruta foii singure le
    // ordonează în interogare: documentul trebuie să iasă la fel din ambele căi.
    const m = modelFoaieParcurs({ ...baza, alimentari: [seara, dimineata] });
    expect(m.alimentari.map((a) => a[0])).toEqual(["2026-10-05 06:30", "2026-10-05 16:45"]);
    expect(m.alimentari.map((a) => a[1])).toEqual(["Petrom · bon 123 · plin", "OMV · bon 456"]);
    // Ordonarea nu schimbă totalurile.
    expect(Object.fromEntries(m.totaluri)["Alimentat pe foaie"]).toBe("30,00 l");
  });

  it("electricul se măsoară în kWh, nu în litri", () => {
    const m = modelFoaieParcurs({ ...baza, unitate: "kWh", normaL100km: 18 });
    expect(Object.fromEntries(m.rubrici)["Norma proprie de consum"]).toBe("18,00 kWh/100 km");
  });

  it("o foaie veche, fără curse: km din antet, cu avertismentul că n-are curse", () => {
    const m = modelFoaieParcurs({ ...baza, curse: [] });
    expect(Object.fromEntries(m.totaluri)["Km parcurși (bord)"]).toBe("100");
    expect(m.avertismente).toContain("Foaia nu are nicio cursă.");
  });
});
