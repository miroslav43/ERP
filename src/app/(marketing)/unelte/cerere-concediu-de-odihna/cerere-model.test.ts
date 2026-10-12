import { describe, expect, it } from "vitest";

import { EroareIntrare } from "@/lib/unelte/document-tabelar";

import {
  adresaVariantei,
  cerereDinParametri,
  citesteCererea,
  PAGINA_CERERE,
  scrisoareaCererii,
} from "./cerere-model";
import { TIPURI_CERERE, VARIANTE, type TipCerere } from "./variante";

/**
 * Ce apără: documentul pe care omul îl semnează. Fiecare test pornește de la
 * parametrii din adresă, exact ca pagina și ruta de descărcare. Ziua de azi e
 * fixată prin al doilea argument, ca rezultatul să nu depindă de ceas.
 *
 * Zilele săptămânii folosite sunt verificate, nu deduse: 06.07, 03.08, 09.11,
 * 16.11.2026 și 02.03, 07.09.2026 sunt zile de luni; 12.11.2026 e joi.
 */
const AZI = "2026-10-02";
const BAZA = {
  salariat: "Ilie Maria",
  functie: "contabil",
  angajator: "Exemplu SRL",
  departament: "Contabilitate",
  localitate: "Cluj-Napoca",
};

const cere = (parametri: Record<string, string>, azi = AZI) =>
  citesteCererea(new URLSearchParams(parametri), azi);
const text = (parametri: Record<string, string>, azi = AZI) =>
  scrisoareaCererii(cere(parametri, azi)).paragrafe.join(" ");

describe("cererea de odihnă", () => {
  it("are anul, departamentul, zilele calculate și rubrica de sold", () => {
    const c = cere({ ...BAZA, de_la: "2026-12-21", pana_la: "2026-12-31" });
    expect(c.probleme).toEqual([]);
    expect(c.avertismente).toEqual([]);
    const s = scrisoareaCererii(c);
    const corp = s.paragrafe.join(" ");
    expect(corp).toContain("aferent anului 2026");
    expect(corp).toContain("contabil, departamentul Contabilitate, vă rog");
    expect(corp).toContain("reprezentând 8 zile lucrătoare");
    expect(corp).toContain("25.12.2026 (Crăciunul)");
    expect(s.catre).toBe("Către: Exemplu SRL");
    expect(s.titlu).toBe("CERERE");
    expect(s.subtitlu).toBe("de concediu de odihnă");
    expect(s.locSiData).toBe("Cluj-Napoca, 02.10.2026");
    expect(s.rubrica?.randuri).toContain(
      "Zile de concediu de odihnă cuvenite pentru anul 2026: ________",
    );
    expect(s.sursa).toBe(PAGINA_CERERE);
    expect(s.numeFisier).toBe("cerere-odihna-2026-12-21");
  });

  it("fără date în adresă: luni–vineri, la cel puțin 60 de zile", () => {
    const corp = text({}, "2026-10-08");
    expect(corp).toContain("07.12.2026 – 11.12.2026 inclusiv");
    expect(corp).toContain("reprezentând 5 zile lucrătoare");
  });

  it("doar cu data de început: o singură zi", () => {
    expect(text({ de_la: "2026-11-16" })).toContain("reprezentând 1 zi lucrătoare");
  });

  it("anul anterior apare ca report, după art. 146 alin. (2)", () => {
    expect(
      text({ de_la: "2026-03-02", pana_la: "2026-03-06", an: "2025", data: "2026-01-02" }),
    ).toContain("aferent anului 2025, neefectuat și reportat potrivit art. 146 alin. (2)");
    expect(
      cere({ de_la: "2026-03-02", pana_la: "2026-03-06", an: "2023" }).probleme.join(" "),
    ).toMatch(/art\. 146 alin\. \(2\)/u);
    expect(
      cere({
        de_la: "2026-09-07",
        pana_la: "2026-09-11",
        an: "2024",
        data: "2026-06-01",
      }).avertismente.join(" "),
    ).toMatch(/nr\. 40\/2026/u);
  });

  it("termenul de 60 de zile și data cererii de după început sunt avertismente, nu blocaje", () => {
    const devreme = cere({ de_la: "2026-10-19", pana_la: "2026-10-23", data: "2026-10-02" });
    expect(devreme.probleme).toEqual([]);
    expect(devreme.avertismente.join(" ")).toMatch(/cu 17 zile înainte\. Art\. 148 alin\. \(4\)/u);
    const tarziu = cere({ de_la: "2026-09-14", pana_la: "2026-09-18", data: "2026-10-02" });
    expect(tarziu.probleme).toEqual([]);
    expect(tarziu.avertismente.join(" ")).toMatch(/după începutul perioadei/u);
  });
});

describe("intrările greșite se refuză, nu se înlocuiesc (auditul din 8 oct 2026)", () => {
  it("un an din afara intervalului oprește documentul, cu motivul", () => {
    const c = cere({ de_la: "2036-01-05", pana_la: "2036-01-09" });
    expect(c.probleme.join(" ")).toMatch(/2036/u);
    expect(() => cerereDinParametri(new URLSearchParams({ de_la: "2036-01-05" }), AZI)).toThrow(
      EroareIntrare,
    );
  });

  it("31 februarie e „nu e o dată reală”, nu „sfârșitul e înaintea începutului”", () => {
    const c = cere({ de_la: "2026-02-30", pana_la: "2026-03-06" });
    expect(c.probleme.join(" ")).toMatch(/nu e o dată reală/u);
    expect(c.probleme.join(" ")).not.toMatch(/înaintea/u);
  });

  it("un weekend singur, un interval inversat, un tip sau un calendar necunoscut", () => {
    expect(cere({ de_la: "2026-11-14", pana_la: "2026-11-15" }).probleme.join(" ")).toMatch(
      /nicio zi lucrătoare/u,
    );
    expect(cere({ de_la: "2026-12-20", pana_la: "2026-12-10" }).probleme.join(" ")).toMatch(
      /înaintea/u,
    );
    expect(cere({ tip: "orice" }).probleme.join(" ")).toMatch(/Tipul cererii/u);
    expect(cere({ cult: "xyz" }).probleme.join(" ")).toMatch(/ortodox sau gregorian/u);
  });
});

describe("concediul împărțit în fracțiuni — art. 148 alin. (5)", () => {
  const FRACTIUNI = { ...BAZA, data: "2026-04-01", de_la: "2026-07-06", pana_la: "2026-07-10" };

  it("enumeră fracțiunile, cu zilele fiecăreia și totalul", () => {
    const c = cere({ ...FRACTIUNI, de_la_2: "2026-08-03", pana_la_2: "2026-08-14" });
    expect(c.probleme).toEqual([]);
    expect(c.avertismente).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("fracționat");
    expect(corp).toContain("1) 06.07.2026 – 10.07.2026 inclusiv — 5 zile lucrătoare");
    expect(corp).toContain("2) 03.08.2026 – 14.08.2026 inclusiv — 10 zile lucrătoare");
    expect(corp).toContain("în total, 15 zile lucrătoare");
    expect(corp).toContain("perioadele solicitate");
  });

  it("avertizează când nicio fracțiune nu are 10 zile lucrătoare", () => {
    const c = cere({ ...FRACTIUNI, de_la_2: "2026-08-03", pana_la_2: "2026-08-07" });
    expect(c.probleme).toEqual([]);
    expect(c.avertismente.join(" ")).toMatch(/Art\. 148 alin\. \(5\)/u);
  });

  it("refuză fracțiunile suprapuse și pe cele cu o singură dată", () => {
    expect(
      cere({ ...FRACTIUNI, de_la_2: "2026-07-08", pana_la_2: "2026-07-15" }).probleme.join(" "),
    ).toMatch(/se suprapun/u);
    expect(cere({ ...FRACTIUNI, de_la_2: "2026-08-03" }).probleme.join(" ")).toMatch(
      /doar una dintre date/u,
    );
  });

  it("la celelalte variante, fracțiunile din adresă se ignoră", () => {
    const c = cere({ ...FRACTIUNI, tip: "fara-plata", de_la_2: "2026-08-03" });
    expect(c.probleme).toEqual([]);
    expect(scrisoareaCererii(c).paragrafe.join(" ")).not.toContain("fracționat");
  });
});

describe("salariatul de alt cult creștin — art. 139 alin. (2¹)", () => {
  it("numără după Paștele gregorian și spune asta în cerere", () => {
    const corp = text({
      de_la: "2026-03-30",
      pana_la: "2026-04-10",
      cult: "gregorian",
      data: "2026-01-15",
    });
    expect(corp).toContain("reprezentând 8 zile lucrătoare");
    expect(corp).toContain("art. 139 alin. (2¹)");
    expect(text({ de_la: "2026-03-30", pana_la: "2026-04-10", data: "2026-01-15" })).toContain(
      "reprezentând 9 zile lucrătoare",
    );
  });
});

describe("celelalte variante", () => {
  it("paternal: 10 zile, data nașterii, actele; avertismente la depășire", () => {
    const de = { ...BAZA, tip: "paternal", nastere: "2026-11-02", de_la: "2026-11-09" };
    const zece = cere({ ...de, pana_la: "2026-11-20" });
    expect(zece.probleme).toEqual([]);
    expect(zece.avertismente).toEqual([]);
    const corp = scrisoareaCererii(zece).paragrafe.join(" ");
    expect(corp).toContain("născut la data de 02.11.2026");
    expect(corp).toContain("Legii nr. 210/1999");
    expect(corp).toContain("certificatului de naștere");

    expect(cere({ ...de, pana_la: "2026-11-27" }).avertismente.join(" ")).toMatch(
      /dă 10 zile lucrătoare/u,
    );
    expect(cere({ ...de, pana_la: "2026-11-27", puericultura: "da" }).avertismente).toEqual([]);
    expect(cere({ ...de, de_la: "2026-10-26", pana_la: "2026-10-30" }).probleme.join(" ")).toMatch(
      /înainte de nașterea/u,
    );
    expect(
      cere({
        ...de,
        nastere: "2026-09-01",
        de_la: "2026-10-26",
        pana_la: "2026-10-30",
      }).avertismente.join(" "),
    ).toMatch(/8 săptămâni/u);
  });

  it("îngrijitor: persoana îngrijită în cerere; peste 5 zile, avertisment", () => {
    const c = cere({
      ...BAZA,
      tip: "ingrijitor",
      persoana: "mamei mele, Ilie Ana",
      de_la: "2026-11-16",
      pana_la: "2026-11-23",
    });
    expect(c.probleme).toEqual([]);
    expect(scrisoareaCererii(c).paragrafe.join(" ")).toContain(
      "sprijin personal mamei mele, Ilie Ana",
    );
    expect(c.avertismente.join(" ")).toMatch(/152¹/u);
  });

  it("formare: cu plată după art. 157, cu instituția și domeniul; termenul de o lună", () => {
    const c = cere({
      ...BAZA,
      tip: "formare",
      plata: "da",
      domeniu: "contabilitate",
      institutie: "Universitatea X",
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
      data: "2026-11-01",
    });
    expect(c.probleme).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("art. 157");
    expect(corp).toContain("organizat de Universitatea X");
    expect(c.avertismente.join(" ")).toMatch(/o lună înainte/u);
  });

  it("reprogramare: cere perioada programată și o pune în cerere", () => {
    const nou = {
      ...BAZA,
      tip: "reprogramare",
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
      motiv: "internare",
    };
    expect(cere(nou).probleme.join(" ")).toMatch(/concediului programat/u);
    const c = cere({ ...nou, prog_de_la: "2026-08-03", prog_pana_la: "2026-08-14" });
    expect(c.probleme).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("programat în perioada 03.08.2026 – 14.08.2026 inclusiv");
    expect(corp).toContain("motive obiective: internare");
  });

  it("întrerupere: zilele rămase se numără de la data întreruperii", () => {
    const de = {
      ...BAZA,
      tip: "intrerupere",
      prog_de_la: "2026-08-03",
      prog_pana_la: "2026-08-14",
    };
    const c = cere({ ...de, de_la: "2026-08-10", pana_la: "2036-99-99" });
    expect(c.probleme).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("începând cu data de 10.08.2026");
    expect(corp).toContain("celor 5 zile lucrătoare rămase neefectuate");
    expect(cere({ ...de, de_la: "2026-08-03" }).probleme.join(" ")).toMatch(/Data întreruperii/u);
    expect(cere({ ...de, de_la: "2026-08-20" }).probleme.join(" ")).toMatch(/Data întreruperii/u);
  });

  it("eveniment: evenimentul ales, zilele din contract, actul; adresele vechi merg", () => {
    const corp = text({
      ...BAZA,
      tip: "eveniment",
      eveniment: "casatorie-salariat",
      zile_ccm: "5",
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
    });
    expect(corp).toContain("cuvenite pentru căsătoria mea");
    expect(corp).toContain("adică 5 zile libere plătite");
    expect(corp).toContain("Anexez, în copie, certificatul de căsătorie.");
    // Adresa de dinainte de 8 oct 2026: `motiv`, fără `eveniment`.
    expect(text({ tip: "eveniment", motiv: "căsătoria mea", de_la: "2026-11-16" })).toContain(
      "cuvenite pentru căsătoria mea",
    );
    expect(cere({ tip: "eveniment", zile_ccm: "0" }).probleme.join(" ")).toMatch(/între 1 și 30/u);
  });
});

describe("fiecare variantă e o cerere completă de semnat", () => {
  const MINIM: Readonly<Record<TipCerere, Record<string, string>>> = {
    odihna: {},
    "fara-plata": {},
    eveniment: {},
    paternal: {},
    ingrijitor: {},
    formare: {},
    reprogramare: { prog_de_la: "2026-08-03", prog_pana_la: "2026-08-07" },
    intrerupere: { prog_de_la: "2026-11-12", prog_pana_la: "2026-11-25" },
  };

  it.each(TIPURI_CERERE)("%s: semnătura salariatului, decizia și cele trei aprobări", (tip) => {
    const c = cere({
      ...BAZA,
      tip,
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
      data: "2026-09-01",
      ...MINIM[tip],
    });
    expect(c.probleme).toEqual([]);
    const s = scrisoareaCererii(c);
    expect(s.semnatura).toBe("Semnătura salariatului");
    expect(s.rubrica?.randuri[0]).toBe("☐ Se aprobă / ☐ Nu se aprobă");
    expect(s.rubrica?.semnaturi).toEqual([
      "Șef ierarhic",
      "Resurse umane",
      "Conducătorul unității",
    ]);
    expect(s.rubrica?.randuri).toHaveLength(VARIANTE[tip].cuSold ? 5 : 1);
    expect(s.titluDocument).toBe(VARIANTE[tip].titlu);
    expect(s.note).toEqual([VARIANTE[tip].temei]);
  });
});

describe("bara de variante", () => {
  it("păstrează oamenii și perioada, nu și câmpurile variantei vechi", () => {
    const q = new URLSearchParams({
      salariat: "Popa",
      de_la: "2026-11-16",
      tip: "eveniment",
      zile_ccm: "5",
      de_la_2: "2026-12-01",
    });
    expect(adresaVariantei(q, "paternal")).toBe(
      `${PAGINA_CERERE}?salariat=Popa&de_la=2026-11-16&tip=paternal#documentul`,
    );
    expect(adresaVariantei(new URLSearchParams(), "odihna")).toBe(`${PAGINA_CERERE}#documentul`);
  });
});
