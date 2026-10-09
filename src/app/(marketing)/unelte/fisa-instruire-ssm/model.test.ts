import { describe, expect, it } from "vitest";

import type { Sectiune, SectiuneTabel } from "@/lib/unelte/document-tabelar";

import {
  CASETE_ANEXA,
  caseteViza,
  construiesteFisaSsm,
  fisaSsmDinParametri,
  INALT_RAND_FISA,
  INSTRUIRI_SSM,
  parametriFisaSsm,
  RANDURI_ANEXA,
  randuriPeriodice,
  scadentePeriodice,
  type ParametriFisaSsm,
} from "./model";

const GOL: ParametriFisaSsm = parametriFisaSsm(new URLSearchParams());

const COMPLET = parametriFisaSsm(
  new URLSearchParams({
    nume: "Popa Ion",
    marca: "M-117",
    calificare: "Electrician",
    functie: "Electrician întreținere",
    loc: "Atelier întreținere",
    firma: "Exemplu SRL",
    data_ig: "2026-10-05",
    ore_ig: "2",
    instructor_ig: "Ionescu Maria",
    functie_ig: "Lucrător desemnat",
    data_lm: "06.10.2026",
    ore_lm: "4",
    instructor_lm: "Vasile Dan",
    functie_lm: "Șef atelier",
    admis_nume: "Georgescu Ana",
    admis_functie: "Director tehnic",
    periodicitate: "trimestriala",
    ani: "2",
  }),
);

const tabele = (s: readonly Sectiune[] | undefined) =>
  (s ?? []).filter((x): x is SectiuneTabel => x.tip === "tabel");
const tabelul = (titlu: string, p: ParametriFisaSsm = GOL) => {
  const t = tabele(construiesteFisaSsm(p).sectiuni).find((x) => x.titlu === titlu);
  if (t === undefined) throw new Error(`Lipsește tabelul „${titlu}”.`);
  return t;
};
const toataProza = (p: ParametriFisaSsm) =>
  (construiesteFisaSsm(p).sectiuni ?? [])
    .flatMap((s) => (s.tip === "text" ? s.paragrafe : []))
    .join("\n");

describe("fișa individuală de instruire SSM — rubricile anexei 11 (HG 1425/2006)", () => {
  it("are antetul din anexă, cu datele lucrătorului completate", () => {
    const d = construiesteFisaSsm(COMPLET);
    const etichete = d.campuri.map((c) => c.eticheta);
    expect(etichete).toEqual([
      "Numele și prenumele",
      "Legitimația, marca",
      "Grupa sanguină",
      "Domiciliul",
      "Data și locul nașterii",
      "Calificarea",
      "Funcția",
      "Locul de muncă",
      "Autorizații (ISCIR ș.a.)",
      "Traseul de deplasare la/de la serviciu",
    ]);
    expect(d.campuri).toContainEqual({ eticheta: "Legitimația, marca", valoare: "M-117" });
    expect(d.campuri).toContainEqual({ eticheta: "Calificarea", valoare: "Electrician" });
    expect(d.subtitlu).toBe("Întreprinderea/unitatea: Exemplu SRL");
  });

  it("nu cere și nu scrie date despre sănătate, domiciliu sau CNP", () => {
    const d = construiesteFisaSsm(COMPLET);
    for (const e of ["Grupa sanguină", "Domiciliul", "Data și locul nașterii"]) {
      expect(d.campuri.find((c) => c.eticheta === e)?.valoare, e).toBe("");
    }
    expect(JSON.stringify(d)).not.toMatch(/CNP/u);
  });

  it("are toate cele zece părți ale anexei, în ordinea ei", () => {
    // Auditul din 8 oct 2026: lipseau testările, accidentele, sancțiunile și cele
    // două grupuri de casete, iar fișa scria singură că anexa „mai cuprinde” ceva.
    const d = construiesteFisaSsm(GOL);
    const titluri = (d.sectiuni ?? []).map((s) => s.titlu);
    expect(titluri).toEqual([
      "Instruirea la angajare",
      null,
      null,
      "Instruirea periodică",
      "Instruirea periodică suplimentară",
      "Rezultatele testărilor",
      "Accidente de muncă sau îmbolnăviri profesionale suferite",
      "Sancțiuni aplicate pentru nerespectarea reglementărilor de securitate și sănătate în muncă",
      "Control medical periodic",
      "Testarea psihologică periodică",
    ]);
    expect(d.note.join(" ")).not.toMatch(/mai cuprinde/u);
    expect(d.coloane).toEqual([]);
  });

  it("instruirea la angajare: punctele 1)–3), cu trei rubrici de semnătură etichetate", () => {
    const [ig, lm, admis] = construiesteFisaSsm(GOL).sectiuni ?? [];
    const etichete = [
      "Semnătura celui instruit",
      "Semnătura celui care a efectuat instruirea",
      "Semnătura celui care a verificat însușirea cunoștințelor",
    ];
    expect(ig?.tip === "text" && ig.semnaturi).toEqual(etichete);
    expect(lm?.tip === "text" && lm.semnaturi).toEqual(etichete);
    expect(ig?.tip === "text" && ig.paragrafe[0]).toMatch(/^1\) Instruirea introductiv-generală/u);
    expect(lm?.tip === "text" && lm.paragrafe[0]).toMatch(/^2\) Instruirea la locul de muncă/u);
    expect(admis?.tip === "text" && admis.paragrafe[0]).toMatch(/^3\) Admis la lucru/u);
    // Două rânduri întregi pentru conținutul instruirii, ca în anexă.
    expect(ig?.tip === "text" && ig.paragrafe.filter((p) => /^_+ _+ _+$/u.test(p))).toHaveLength(2);
  });

  it("propagă datele cunoscute în punctele 1)–3)", () => {
    const proza = toataProza(COMPLET);
    expect(proza).toContain(
      "la data 05.10.2026, timp de 2 ore, de către Ionescu Maria, având funcția de Lucrător desemnat.",
    );
    expect(proza).toContain(
      "la data 06.10.2026, loc de muncă/post de lucru Atelier întreținere, timp de 4 ore, de către Vasile Dan, având funcția de Șef atelier.",
    );
    expect(proza).toContain(
      "Numele și prenumele Georgescu Ana, funcția (șef secție, atelier, șantier etc.) Director tehnic",
    );
  });

  it("tabelele periodică și suplimentară au coloanele anexei și ocupația precompletată", () => {
    const periodica = tabelul("Instruirea periodică", COMPLET);
    const suplimentara = tabelul("Instruirea periodică suplimentară", COMPLET);
    const fara = (t: SectiuneTabel) => t.coloane.map((c) => c.eticheta.replace(/\n/gu, " "));
    expect(fara(periodica)).toEqual([
      "Data instruirii",
      "Durata (h)",
      "Ocupația",
      "Materialul predat",
      "Semnătura celui instruit",
      "Semnătura celui care a instruit",
      "Semnătura celui care a verificat",
    ]);
    expect(fara(suplimentara)[0]).toBe("Data efectuării");
    expect(periodica.randuri.every((r) => r[2] === "Electrician întreținere")).toBe(true);
    expect(suplimentara.randuri).toHaveLength(RANDURI_ANEXA.suplimentara);
    expect(periodica.inaltimeRand).toBe(INALT_RAND_FISA);
  });

  it("testări, accidente și sancțiuni au coloanele și rândurile anexei", () => {
    const capete = (titlu: string) =>
      tabelul(titlu).coloane.map((c) => c.eticheta.replace(/\n/gu, " "));
    expect(capete("Rezultatele testărilor")).toEqual([
      "Data",
      "Materialul examinat",
      "Calificativ",
      "Examinator",
    ]);
    expect(capete("Accidente de muncă sau îmbolnăviri profesionale suferite")).toEqual([
      "Data producerii evenimentului",
      "Diagnosticul medical",
      "Nr. și data PV de cercetare a evenimentului",
      "Nr. zile ITM",
    ]);
    expect(
      capete(
        "Sancțiuni aplicate pentru nerespectarea reglementărilor de securitate și sănătate în muncă",
      ),
    ).toEqual(["Abaterea săvârșită", "Sancțiunea administrativă", "Nr. și data deciziei"]);
    expect(tabelul("Rezultatele testărilor").randuri).toHaveLength(RANDURI_ANEXA.testari);
  });

  it("casetele de control medical și de testare psihologică au rubricile anexei", () => {
    const casete = (construiesteFisaSsm(GOL).sectiuni ?? []).filter((s) => s.tip === "casete");
    expect(casete).toEqual([
      {
        tip: "casete",
        titlu: "Control medical periodic",
        numar: CASETE_ANEXA,
        rubrica: "Observații de specialitate",
        semnaturi: ["Semnătura și parafa medicului de medicina muncii", "Data vizei"],
        nota: null,
      },
      {
        tip: "casete",
        titlu: "Testarea psihologică periodică",
        numar: CASETE_ANEXA,
        rubrica: "Apt psihologic pentru:*",
        semnaturi: ["Semnătura psihologului", "Data"],
        nota: "* lucru la înălțime, lucru în condiții de izolare, conducători auto etc.",
      },
    ]);
  });

  it("antetul de pagină poartă numele lucrătorului și firma", () => {
    expect(construiesteFisaSsm(COMPLET).antetRulant).toBe(
      "Fișă de instruire individuală SSM — Popa Ion — Exemplu SRL",
    );
    expect(construiesteFisaSsm(GOL).antetRulant).toMatch(/Numele și prenumele: _+$/u);
  });

  it("se tipărește pe A4 portret, ca modelul din anexă", () => {
    expect(construiesteFisaSsm(GOL).orientare).toBe("portret");
  });
});

describe("câte rânduri de instruire periodică", () => {
  it("periodicitatea × anii: implicit semestrial pe 5 ani, adică 10", () => {
    expect(GOL.periodicitate).toBe("semestriala");
    expect(GOL.ani).toBe(5);
    expect(tabelul("Instruirea periodică").randuri).toHaveLength(10);
    expect(randuriPeriodice("lunara", 10)).toBe(120);
    expect(randuriPeriodice("trimestriala", 2)).toBe(8);
    expect(randuriPeriodice("anuala", 3)).toBe(3);
    expect(tabelul("Instruirea periodică", COMPLET).randuri).toHaveLength(8);
  });

  it("valorile din afara listei cad pe implicit, nu pe un număr nemărginit de rânduri", () => {
    const p = parametriFisaSsm(new URLSearchParams({ periodicitate: "zilnica", ani: "1000" }));
    expect(p.periodicitate).toBe("semestriala");
    expect(p.ani).toBe(5);
    const proto = parametriFisaSsm(new URLSearchParams({ periodicitate: "constructor" }));
    expect(proto.periodicitate).toBe("semestriala");
  });

  it("casetele de viză: una pe an, cel puțin șase, număr par", () => {
    expect(caseteViza(1)).toBe(6);
    expect(caseteViza(5)).toBe(6);
    expect(caseteViza(10)).toBe(10);
    expect(caseteViza(7)).toBe(8);
  });
});

describe("intrările formularului", () => {
  it("taie câmpurile de text la 120 de caractere", () => {
    const d = fisaSsmDinParametri(new URLSearchParams({ nume: "x".repeat(300) }));
    expect(d.campuri.find((c) => c.eticheta === "Numele și prenumele")?.valoare).toHaveLength(120);
  });

  it("citește data din calendar sau scrisă românește și respinge zilele inexistente", () => {
    const zi = (v: string) => parametriFisaSsm(new URLSearchParams({ data_ig: v })).dataIg;
    expect(zi("2026-10-05")).toBe("2026-10-05");
    expect(zi("05.10.2026")).toBe("2026-10-05");
    expect(zi("2027-02-29")).toBeNull();
    expect(zi("31.04.2026")).toBeNull();
    expect(zi("ieri")).toBeNull();
    expect(toataProza(parametriFisaSsm(new URLSearchParams({ data_ig: "2027-02-29" })))).toContain(
      "efectuată la data __________,",
    );
  });

  it("orele: întregi între 1 și 40, altfel rămâne linia de completat", () => {
    const h = (v: string) => parametriFisaSsm(new URLSearchParams({ ore_ig: v })).oreIg;
    expect(h("1")).toBe(1);
    expect(h("40")).toBe(40);
    expect(h("0")).toBeNull();
    expect(h("41")).toBeNull();
    expect(h("1,5")).toBeNull();
    expect(h("-2")).toBeNull();
  });
});

describe("scadențele instruirii periodice (doar pe pagină)", () => {
  it("adună intervalul de la ultima instruire și rămâne pe ultima zi a lunii", () => {
    expect(scadentePeriodice("2026-10-06", 6, 3)).toEqual([
      "2027-04-06",
      "2027-10-06",
      "2028-04-06",
    ]);
    expect(scadentePeriodice("2026-08-31", 6, 2)).toEqual(["2027-02-28", "2027-08-31"]);
    expect(scadentePeriodice("2027-08-31", 6, 1)).toEqual(["2028-02-29"]);
    expect(scadentePeriodice("2026-11-30", 3, 2)).toEqual(["2027-02-28", "2027-05-30"]);
  });
});

describe("regulile afișate pe pagină", () => {
  const dupa = (tip: string) => INSTRUIRI_SSM.find((r) => r.tip === tip);

  it("dau minimul de o oră din art. 80¹, nu cele 8 ore abrogate în 2016", () => {
    // Auditul SEO din 7 oct 2026: pagina citea consolidarea din 2011 și dădea
    // „cel puțin 8 ore” pe fază. Art. 87 alin. (2) e abrogat prin HG 767/2016,
    // care a introdus art. 80¹: cel puțin o oră, stabilită prin programul firmei.
    for (const tip of ["Introductiv-generală", "La locul de muncă", "Suplimentară"]) {
      expect(dupa(tip)?.regula, tip).toMatch(/o oră/u);
      expect(dupa(tip)?.temei, tip).toMatch(/80¹/u);
    }
    expect(INSTRUIRI_SSM.some((r) => /8 ore/u.test(r.regula))).toBe(false);
  });

  it("spun că fișa se poate ține și în format electronic (HG 259/2022)", () => {
    expect(dupa("Consemnarea")?.regula).toMatch(/format electronic/u);
    expect(dupa("Formatul electronic")?.regula).toMatch(
      /semnătură electronică, avansată ori calificată/u,
    );
    expect(dupa("Formatul electronic")?.temei).toMatch(/81¹/u);
    expect(INSTRUIRI_SSM.some((r) => /pix|stilou/u.test(r.regula))).toBe(false);
  });

  it("suplimentara acoperă toate cele șapte cazuri din art. 98, inclusiv lit. b)", () => {
    // Auditul din 8 oct 2026: lipsea lit. b), schimbarea prevederilor SSM sau a
    // instrucțiunilor proprii, inclusiv din cauza riscurilor noi.
    const regula = dupa("Suplimentară")?.regula ?? "";
    for (const caz of [
      /30 de zile lucrătoare/u,
      /instrucțiunile proprii/u,
      /riscuri noi/u,
      /accident de muncă/u,
      /lucrări speciale/u,
      /echipament de muncă nou sau modificat/u,
      /tehnologii sau proceduri de lucru modificate ori noi/u,
    ]) {
      expect(regula).toMatch(caz);
    }
    expect(dupa("Suplimentară")?.temei).toMatch(/98 lit\. a\)–g\)/u);
  });

  it("spun cine face fiecare instruire și unde se păstrează fișa", () => {
    expect(dupa("La locul de muncă")?.cine).toMatch(/Conducătorul direct/u);
    expect(dupa("Periodică")?.cine).toMatch(/Conducătorul locului de muncă/u);
    expect(dupa("Consemnarea")?.cine).toMatch(/fișe de aptitudini/u);
    expect(dupa("Consemnarea")?.temei).toMatch(/81 alin\. \(1\)–\(5\)/u);
    for (const r of INSTRUIRI_SSM) expect(r.cine, r.tip).toMatch(/\.$/u);
  });
});
