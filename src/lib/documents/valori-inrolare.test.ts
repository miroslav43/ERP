// src/lib/documents/valori-inrolare.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  rezerva,
  valoriActAditionalTelemunca,
  valoriAnexaPi,
  valoriContractMunca,
  valoriFisaPostului,
  valoriNda,
  type ContextDocumente,
} from "./valori-inrolare";

/**
 * POARTA CARE LEAGĂ HĂRȚILE DE ȘABLOANE.
 *
 * `genereazaDocument` aruncă `businessRule` la prima variabilă fără valoare, iar
 * `randeaza()` tratează o cheie ABSENTĂ exact ca pe una goală. Cu cinci
 * documente și cinci hărți scrise de mână, o singură cheie uitată face să cadă
 * 100% din emiterile acelui document — nu ocazional. Defectul nu se vede în
 * typecheck, nici în lint, nici la randare: apare la prima înrolare reală, sub
 * forma unui avertisment „documentul nu a putut fi generat".
 *
 * Testul citește `{{variabilele}}` direct din SQL-ul migrărilor și le compară cu
 * cheile pe care le produce fiecare hartă. Sursa de adevăr rămâne șablonul.
 */
const MIGRARI = join(process.cwd(), "supabase/migrations");

const CODURI = [
  "contract_munca",
  "fisa_postului",
  "nda",
  "anexa_proprietate_intelectuala",
  "act_aditional_telemunca",
] as const;

/**
 * Variabilele declarate în migrări, per cod de șablon.
 *
 * Fișierele se parcurg în ordine, iar ultima declarație câștigă: 0101
 * suprascrie contractul însămânțat de 0033, exact cum face UPDATE-ul în bază.
 */
function variabileleDinMigrari(): ReadonlyMap<string, readonly string[]> {
  const rezultat = new Map<string, readonly string[]>();

  for (const nume of readdirSync(MIGRARI)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const brutFisier = readFileSync(join(MIGRARI, nume), "utf8");
    if (!brutFisier.includes("hr_document_templates")) continue;
    // Postgres concatenează literalele adiacente despărțite doar de spațiu
    // alb: `'["a",' '"b"]'` e un singur șir. Se lipesc înainte de citire, ca o
    // listă scrisă pe două rânduri să nu treacă drept JSON invalid.
    const sursa = brutFisier.replace(/'\s*\n\s*'/gu, "");

    // Fiecare listă de variabile e un tablou JSON urmat de `::jsonb`.
    const tipar = /'(\[[^\]]*\])'::jsonb/gu;
    let potrivire: RegExpExecArray | null;
    while ((potrivire = tipar.exec(sursa)) !== null) {
      const brut = potrivire[1];
      if (brut === undefined) continue;
      const variabile = JSON.parse(brut) as unknown;
      if (!Array.isArray(variabile) || !variabile.every((v) => typeof v === "string")) continue;

      // Codul e cel mai apropiat literal cunoscut dinaintea listei — ordinea
      // coloanelor în `insert into hr_document_templates (…, cod, …, variabile, …)`.
      const inainte = sursa.slice(0, potrivire.index);
      let codul: string | null = null;
      let pozitie = -1;
      for (const cod of CODURI) {
        const p = inainte.lastIndexOf(`'${cod}'`);
        if (p > pozitie) {
          pozitie = p;
          codul = cod;
        }
      }
      if (codul !== null) rezultat.set(codul, variabile as readonly string[]);
    }
  }
  return rezultat;
}

const DECLARATE = variabileleDinMigrari();

const CONTEXT: ContextDocumente = {
  organizatie: { denumire: "Exemplu S.R.L.", reprezentantLegal: "Maria Ionescu" },
  angajat: {
    nume: "Popescu Ion",
    cnpComplet: "1900101410011",
    adresa: "Str. Exemplu 1, Cluj-Napoca, Cluj",
    serieAct: "CJ",
    numarAct: "123456",
    actEliberatDe: "SPCLEP Cluj-Napoca",
    actEliberatLa: "2020-03-15",
    functie: "Referent",
    departament: "Administrativ",
  },
  contract: {
    numar: "42/2026",
    dataContract: "2026-08-28",
    dataAngajarii: "2026-08-31",
    durata: "nedeterminată",
    normaOreSaptamana: 40,
    normaOreZi: 8,
    modLucru: "La sediu",
    locMunca: "Punct de lucru Cluj",
    locTelemunca: null,
    salariuBrut: 5000,
    zileConcediuAnual: 21,
  },
  azi: "2026-08-28",
};

const HARTI: Readonly<Record<(typeof CODURI)[number], ReadonlyMap<string, string>>> = {
  contract_munca: valoriContractMunca(CONTEXT),
  fisa_postului: valoriFisaPostului(CONTEXT, {
    subordonare: "Directorul de departament",
    atributii: ["Redactează", "Arhivează"],
    competente: ["Atenție la detaliu"],
  }),
  nda: valoriNda(CONTEXT, "doi ani"),
  anexa_proprietate_intelectuala: valoriAnexaPi(CONTEXT),
  act_aditional_telemunca: valoriActAditionalTelemunca(CONTEXT),
};

describe("acoperirea variabilelor de șablon", () => {
  it("găsește declarațiile din migrări", () => {
    // Fără asta, o schimbare de format în SQL ar face testul verde pe zero
    // șabloane — exact felul de poartă care liniștește fără să apere nimic.
    expect([...DECLARATE.keys()].sort()).toEqual([...CODURI].sort());
  });

  it.each(CODURI)("harta lui `%s` acoperă exact șablonul", (cod) => {
    const declarate = [...(DECLARATE.get(cod) ?? [])].sort();
    const produse = [...HARTI[cod].keys()].sort();

    const lipsa = declarate.filter((v) => !produse.includes(v));
    const inPlus = produse.filter((v) => !declarate.includes(v));

    expect(
      lipsa,
      `Șablonul „${cod}” cere variabile pe care harta nu le produce. ` +
        `\`genereazaDocument\` va arunca la FIECARE emitere: ${lipsa.join(", ")}`,
    ).toEqual([]);
    expect(
      inPlus,
      `Harta lui „${cod}” produce variabile pe care șablonul nu le folosește. ` +
        `Nu strică nimic, dar e cod mort — sau semnul că șablonul a rămas în urmă: ${inPlus.join(", ")}`,
    ).toEqual([]);
  });

  it.each(CODURI)("`%s` nu produce nicio valoare goală, nici pe date lipsă", (cod) => {
    // Fișele vechi n-au serie, număr sau emitent de act. Dacă harta ar lăsa
    // șirul gol, `randeaza()` l-ar trata ca pe o cheie absentă și documentul
    // n-ar mai fi emis niciodată pentru ele.
    const gol: ContextDocumente = {
      organizatie: { denumire: "Exemplu S.R.L.", reprezentantLegal: null },
      angajat: {
        nume: "Popescu Ion",
        cnpComplet: "1900101410011",
        adresa: null,
        serieAct: null,
        numarAct: null,
        actEliberatDe: null,
        actEliberatLa: null,
        functie: null,
        departament: null,
      },
      contract: { ...CONTEXT.contract, locMunca: null, locTelemunca: null },
      azi: "2026-08-28",
    };
    const harta: Readonly<Record<(typeof CODURI)[number], ReadonlyMap<string, string>>> = {
      contract_munca: valoriContractMunca(gol),
      fisa_postului: valoriFisaPostului(gol, {
        subordonare: null,
        atributii: [],
        competente: [],
      }),
      nda: valoriNda(gol, "doi ani"),
      anexa_proprietate_intelectuala: valoriAnexaPi(gol),
      act_aditional_telemunca: valoriActAditionalTelemunca(gol),
    };
    const goale = [...harta[cod].entries()]
      .filter(([, valoare]) => valoare.trim() === "")
      .map(([cheie]) => cheie);
    expect(goale, `Valori goale în „${cod}”: ${goale.join(", ")}`).toEqual([]);
  });
});

describe("locul muncii pe hârtie", () => {
  it("la telemuncă tipărește locul real, nu „nespecificat”", () => {
    // `loc_munca` rămâne gol la telemuncă — obligatoriu e `loc_telemunca`, prin
    // CHECK-ul `contracts_telemunca_are_loc`. Contractul ar fi spus
    // „nespecificat" exact în cazul în care legea cere cea mai mare precizie.
    const acasa = valoriContractMunca({
      ...CONTEXT,
      contract: {
        ...CONTEXT.contract,
        locMunca: null,
        locTelemunca: "Str. Salcâmilor 3, Florești",
        modLucru: "Telemuncă",
      },
    });
    expect(acasa.get("loc_munca")).toBe("Str. Salcâmilor 3, Florești");
  });

  it("fără niciun loc, cade pe sediul social — nu pe gol", () => {
    const nicaieri = valoriContractMunca({
      ...CONTEXT,
      contract: { ...CONTEXT.contract, locMunca: null, locTelemunca: null },
    });
    expect(nicaieri.get("loc_munca")).toBe("sediul social al angajatorului");
  });
});

describe("rezerva", () => {
  it("înlocuiește absența, dar nu o valoare reală", () => {
    expect(rezerva(null)).toBe("nespecificat");
    expect(rezerva("")).toBe("nespecificat");
    expect(rezerva("   ")).toBe("nespecificat");
    expect(rezerva("Cluj")).toBe("Cluj");
  });
});
