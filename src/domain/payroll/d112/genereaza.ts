// src/domain/payroll/d112/genereaza.ts
// Serializarea D112 în XML, funcție pură.
//
// Validările reproduse aici sunt cele din specificația ANAF marcate `ERR` —
// adică exact acelea la care fișierul e RESPINS, nu doar semnalat. Le rulăm
// înainte, ca omul să afle de la noi, cu un mesaj în română, nu de la
// DUKIntegrator, cu un cod.
//
// Sumele: „Toate valorile sunt numere întregi pozitive", spune specificația, cu
// regula de rotunjire „aritmetic dacă partea zecimală >= 0.5, se adaugă 1 la
// partea întreagă. Excepție fac valorile subunitare ale contribuției, care se
// întregesc la 1 leu."
import { validateazaCnp } from "@/domain/hr/cnp";

import type {
  AsiguratD112,
  CreantaD112,
  IntrareD112,
  ProblemaD112,
  RezultatD112,
} from "./structura";

/**
 * Rotunjirea D112, literal din specificație.
 *
 * `Math.round` din JS rotunjește 0.5 în sus, ceea ce coincide — dar regula de
 * la contribuții subunitare NU coincide: 0.4 lei devine 1 leu, nu 0. Fără ea,
 * o contribuție de câțiva bani ar fi declarată zero, iar suma pe cod nu s-ar
 * mai potrivi cu totalul.
 */
export function rotunjesteD112(valoare: number, esteContributie = false): number {
  if (!Number.isFinite(valoare)) return 0;
  if (valoare <= 0) return 0;
  if (esteContributie && valoare < 1) return 1;
  return Math.round(valoare);
}

/**
 * Escaparea XML.
 *
 * Denumirile de firme conțin ghilimele („S.C. «Ceva» S.R.L."), iar adresele
 * conțin `&`. Un `&` neescapat face fișierul nevalid ca XML, deci respins
 * înainte de orice validare de conținut.
 */
function esc(valoare: string): string {
  return valoare
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function atribut(nume: string, valoare: string | number | null): string {
  if (valoare === null) return "";
  const text = typeof valoare === "number" ? String(valoare) : valoare;
  if (text.length === 0) return "";
  return ` ${nume}="${esc(text)}"`;
}

const RE_REG_COM = /^[A-Z]?\d{1,3}\/\d{1,5}\/\d{4}$/u;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

function verificaAngajator(intrare: IntrareD112): readonly ProblemaD112[] {
  const probleme: ProblemaD112[] = [];
  const a = intrare.angajator;

  if (!/^\d{1,13}$/u.test(a.cif)) {
    probleme.push({
      camp: "cif",
      mesaj: "Codul de identificare fiscală lipsește sau conține altceva decât cifre.",
      blocant: true,
    });
  }
  if (a.denumire.trim().length === 0) {
    probleme.push({ camp: "den", mesaj: "Denumirea firmei nu este completată.", blocant: true });
  }
  if (a.caen === null || !/^\d{4}$/u.test(a.caen)) {
    probleme.push({
      camp: "caen",
      mesaj: "Codul CAEN lipsește sau nu are patru cifre. Completați-l în datele firmei.",
      blocant: true,
    });
  }
  if (a.adresaSediu === null || a.adresaSediu.trim().length === 0) {
    probleme.push({
      camp: "adrSoc",
      mesaj: "Adresa sediului social nu este completată.",
      blocant: true,
    });
  }
  if (a.casaSanatate === null || a.casaSanatate.trim().length === 0) {
    probleme.push({
      camp: "casaAng",
      mesaj:
        "Casa de asigurări de sănătate a angajatorului nu e configurată. Ea trebuie să coincidă cu județul sediului social.",
      blocant: true,
    });
  }
  if (a.registruComert !== null && !RE_REG_COM.test(a.registruComert)) {
    probleme.push({
      camp: "rgCom",
      mesaj: "Numărul de la Registrul Comerțului nu respectă formatul xxx/xxxxx/xxxx.",
      blocant: false,
    });
  }
  return probleme;
}

function verificaAsigurat(asigurat: AsiguratD112, index: number): readonly ProblemaD112[] {
  const probleme: ProblemaD112[] = [];
  const eticheta = `${asigurat.nume} ${asigurat.prenume}`.trim();
  const prefix = eticheta.length > 0 ? eticheta : `asiguratul ${String(index + 1)}`;

  // `validateazaCnp` din `domain/hr` e sursa unică: verifică cifra de control,
  // data reală de naștere ȘI codul de județ. Un al doilea validator aici ar fi
  // însemnat două ecrane care acceptă lucruri diferite.
  const verificare = validateazaCnp(asigurat.cnp);
  if (!verificare.valid) {
    probleme.push({
      camp: "cnpAsig",
      mesaj: `CNP incorect pentru ${prefix}: ${verificare.motiv}`,
      blocant: true,
    });
  }
  if (asigurat.nume.trim().length === 0 || asigurat.prenume.trim().length === 0) {
    probleme.push({
      camp: "numeAsig",
      mesaj: `Numele sau prenumele lipsesc pentru ${prefix}.`,
      blocant: true,
    });
  }
  if (!RE_DATA.test(asigurat.dataAngajarii)) {
    probleme.push({
      camp: "dataAng",
      mesaj: `Data angajării lipsește pentru ${prefix}.`,
      blocant: true,
    });
  }
  if (asigurat.dataIncetarii !== null && asigurat.dataIncetarii < asigurat.dataAngajarii) {
    probleme.push({
      camp: "dataSf",
      mesaj: `Data încetării e înaintea datei de angajare pentru ${prefix}.`,
      blocant: true,
    });
  }
  // Validarea ANAF e literalmente `A_4 = 6, 7 sau 8`. O normă de 4 ore, deși
  // legală ca timp de muncă, se declară drept contract cu timp parțial: `A_3`
  // devine `P4`, iar `A_4` rămâne norma zilnică a postului.
  if (![6, 7, 8].includes(asigurat.oreNormaZilnica)) {
    probleme.push({
      camp: "A_4",
      mesaj: `Norma zilnică a lui ${prefix} este ${String(asigurat.oreNormaZilnica)} ore; D112 acceptă doar 6, 7 sau 8. Timpul parțial se declară prin tipul de contract (A_3), nu prin normă.`,
      blocant: true,
    });
  }
  if (!/^(N|P[1-7])$/u.test(asigurat.tipContract)) {
    probleme.push({
      camp: "A_3",
      mesaj: `Tipul de contract al lui ${prefix} nu e recunoscut: se acceptă N sau P1…P7.`,
      blocant: true,
    });
  }
  return probleme;
}

function serializeazaCreanta(creanta: CreantaD112): string {
  return (
    `  <angajatorA${atribut("A_codOblig", creanta.codObligatie)}` +
    `${atribut("A_codBugetar", creanta.codBugetar)}` +
    `${atribut("A_datorat", rotunjesteD112(creanta.suma, true))} />`
  );
}

function serializeazaAsigurat(asigurat: AsiguratD112, idAsig: number): string {
  const antet =
    `  <asigurat${atribut("cnpAsig", asigurat.cnp)}${atribut("idAsig", idAsig)}` +
    `${atribut("numeAsig", asigurat.nume)}${atribut("prenAsig", asigurat.prenume)}` +
    `${atribut("dataAng", asigurat.dataAngajarii)}${atribut("dataSf", asigurat.dataIncetarii)}>`;
  const sectiuneA =
    `    <asiguratA${atribut("A_1", asigurat.tipAsigurat)}` +
    `${atribut("A_2", asigurat.pensionar ? 1 : 0)}` +
    `${atribut("A_3", asigurat.tipContract)}` +
    `${atribut("A_4", asigurat.oreNormaZilnica)}` +
    `${atribut("A_5", rotunjesteD112(asigurat.bazaCam))}` +
    `${atribut("A_6", asigurat.oreLucrate)}` +
    `${atribut("A_7", asigurat.oreSuspendate)} />`;
  return [antet, sectiuneA, "  </asigurat>"].join("\n");
}

export function genereazaD112(intrare: IntrareD112): RezultatD112 {
  const probleme: ProblemaD112[] = [...verificaAngajator(intrare)];
  intrare.asigurati.forEach((asigurat, index) => {
    probleme.push(...verificaAsigurat(asigurat, index));
  });

  if (intrare.luna < 1 || intrare.luna > 12) {
    probleme.push({ camp: "luna_r", mesaj: "Luna de raportare nu e validă.", blocant: true });
  }
  if (intrare.an <= 2010) {
    probleme.push({
      camp: "an_r",
      mesaj: "Anul de raportare trebuie să fie ulterior lui 2010.",
      blocant: true,
    });
  }
  if (intrare.creante.length === 0) {
    probleme.push({
      camp: "angajatorA",
      mesaj:
        "Declarația nu are nicio obligație de plată. Verificați codurile de obligație din setări.",
      blocant: true,
    });
  }
  if (intrare.creante.length > 41) {
    probleme.push({
      camp: "angajatorA",
      mesaj: "D112 acceptă cel mult 41 de creanțe fiscale.",
      blocant: true,
    });
  }
  // CNP duplicat: specificația spune explicit „CNP-ul trebuie să fie unic".
  const cnpuri = new Set<string>();
  for (const asigurat of intrare.asigurati) {
    if (cnpuri.has(asigurat.cnp)) {
      probleme.push({
        camp: "cnpAsig",
        mesaj: `CNP-ul ${asigurat.cnp} apare de mai multe ori — fiecare asigurat se declară o singură dată.`,
        blocant: true,
      });
    }
    cnpuri.add(asigurat.cnp);
  }

  const a = intrare.angajator;
  const linii: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<declaratieUnica${atribut("luna_r", intrare.luna)}${atribut("an_r", intrare.an)}` +
      `${atribut("d_rec", intrare.rectificativa ? 1 : 0)}` +
      `${atribut("nume_declar", intrare.declarantNume)}` +
      `${atribut("prenume_declar", intrare.declarantPrenume)}` +
      `${atribut("functie_declar", intrare.declarantFunctie)}>`,
    `  <angajator${atribut("cif", a.cif)}${atribut("rgCom", a.registruComert)}` +
      `${atribut("caen", a.caen)}${atribut("den", a.denumire)}` +
      `${atribut("adrSoc", a.adresaSediu)}${atribut("casaAng", a.casaSanatate)}` +
      `${atribut("datCAM", a.datoreazaCam ? 1 : 0)} />`,
  ];

  for (const creanta of intrare.creante) linii.push(serializeazaCreanta(creanta));
  intrare.asigurati.forEach((asigurat, index) => {
    linii.push(serializeazaAsigurat(asigurat, index + 1));
  });
  linii.push("</declaratieUnica>");

  const totalDatorat = intrare.creante.reduce(
    (suma, creanta) => suma + rotunjesteD112(creanta.suma, true),
    0,
  );

  return {
    xml: `${linii.join("\n")}\n`,
    probleme,
    nrAsigurati: intrare.asigurati.length,
    totalDatorat,
  };
}
