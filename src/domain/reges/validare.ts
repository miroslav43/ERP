// src/domain/reges/validare.ts
//
// Verifică LOCAL ce ar respinge REGES, înainte să plece mesajul.
//
// DE CE NU LĂSĂM SERVERUL SĂ SPUNĂ
// Fiindcă nu spune la timp. Un mesaj care nu respectă schema XSD primește 400 pe
// loc, dar unul care respectă schema și are conținut greșit primește recipisă și
// e refuzat abia ASINCRON, în coadă, minute sau ore mai târziu. Între timp
// operatorul a închis ecranul, iar termenul legal curge. Cu cât un refuz e prins
// mai devreme, cu atât costă mai puțin — iar câmpurile de mai jos sunt exact
// cele pe care schema le declară obligatorii, deci verificabile fără să ghicim
// regulile de fond ale Inspecției Muncii.
//
// Verificarea NU pretinde că un mesaj valid aici va fi acceptat. Pretinde doar
// că unul invalid aici va fi sigur respins.

import { esteZi } from "./formate";
import type { ContractIntern, SalariatIntern } from "./mapare";
import { TIPURI_ACT_IDENTITATE } from "./operatii";

export type Problema = Readonly<{
  camp: string;
  mesaj: string;
}>;

const TIPAR_COD_COR = /^[0-9]{6}$/;
const TIPAR_CNP = /^[1-8][0-9]{12}$/;
const TIPAR_MONEDA = /^[A-Z]{3}$/;

/** Câmpurile pe care `InfoSalariat` le declară obligatorii în XSD. */
export function verificaSalariat(s: SalariatIntern): readonly Problema[] {
  const probleme: Problema[] = [];
  const cere = (valoare: string | null, camp: string, mesaj: string) => {
    if (valoare === null || valoare.trim() === "") probleme.push({ camp, mesaj });
  };

  cere(s.nume, "nume", "Numele de familie lipsește.");
  cere(s.prenume, "prenume", "Prenumele lipsește.");
  cere(s.adresa, "adresa", "Adresa de domiciliu lipsește. REGES o cere pentru orice salariat.");
  cere(
    s.taraDomiciliu,
    "taraDomiciliu",
    "Țara de domiciliu lipsește. Se transmite prin NUMELE din nomenclator, nu prin codul ISO.",
  );

  if (s.cnp.trim() === "") {
    probleme.push({ camp: "cnp", mesaj: "CNP-ul lipsește din fișa de personal." });
  } else if (!TIPAR_CNP.test(s.cnp.trim())) {
    probleme.push({
      camp: "cnp",
      mesaj: "CNP-ul nu are forma cerută (13 cifre, prima între 1 și 8).",
    });
  }

  if (!(TIPURI_ACT_IDENTITATE as readonly string[]).includes(s.tipActIdentitate)) {
    probleme.push({
      camp: "tipActIdentitate",
      mesaj: "Tipul actului de identitate nu e o valoare cunoscută de REGES. Alegeți-l din listă.",
    });
  }

  if (s.dataNasterii !== null && !esteZi(s.dataNasterii)) {
    probleme.push({ camp: "dataNasterii", mesaj: "Data nașterii nu e o zi validă." });
  }

  return probleme;
}

/** Câmpurile pe care `ContinutContract` le declară obligatorii în XSD. */
export function verificaContract(c: ContractIntern): readonly Problema[] {
  const probleme: Problema[] = [];

  if (c.numar.trim() === "") {
    probleme.push({ camp: "numar", mesaj: "Numărul contractului lipsește." });
  }
  if (!esteZi(c.dataContract)) {
    probleme.push({ camp: "dataContract", mesaj: "Data contractului nu e o zi validă." });
  }
  if (!esteZi(c.valabilDeLa)) {
    probleme.push({
      camp: "valabilDeLa",
      mesaj: "Data de început a contractului nu e o zi validă.",
    });
  }

  // Contradicția asta e respinsă de server, dar mesajul lui nu spune care dintre
  // cele două câmpuri e de vină.
  if (c.durataDeterminata && c.valabilPana === null) {
    probleme.push({
      camp: "valabilPana",
      mesaj: "Contractul pe durată determinată are nevoie de o dată de sfârșit.",
    });
  }
  if (!c.durataDeterminata && c.valabilPana !== null) {
    probleme.push({
      camp: "valabilPana",
      mesaj: "Contractul pe durată nedeterminată nu poate avea dată de sfârșit.",
    });
  }
  if (
    c.valabilPana !== null &&
    esteZi(c.valabilPana) &&
    esteZi(c.valabilDeLa) &&
    c.valabilPana < c.valabilDeLa
  ) {
    probleme.push({
      camp: "valabilPana",
      mesaj: "Data de sfârșit e înaintea celei de început.",
    });
  }

  if (!TIPAR_COD_COR.test(c.codCor.trim())) {
    probleme.push({
      camp: "codCor",
      mesaj: "Codul COR lipsește sau nu are șase cifre. Se ia din funcția atașată contractului.",
    });
  }
  if (!(c.salariuBaza > 0)) {
    probleme.push({
      camp: "salariuBaza",
      mesaj: "Salariul de bază trebuie să fie mai mare decât zero.",
    });
  }
  if (!TIPAR_MONEDA.test(c.moneda.trim().toUpperCase())) {
    probleme.push({ camp: "moneda", mesaj: "Moneda trebuie să aibă trei litere (ex. RON)." });
  }

  return probleme;
}

export function verificaIncetare(input: {
  readonly data: string;
  readonly temeiLegal: string | null;
}): readonly Problema[] {
  const probleme: Problema[] = [];
  if (!esteZi(input.data)) {
    probleme.push({ camp: "dataIncetare", mesaj: "Data încetării nu e o zi validă." });
  }
  if (input.temeiLegal === null || input.temeiLegal.trim() === "") {
    probleme.push({
      camp: "temeiIncetare",
      mesaj: "Temeiul legal al încetării lipsește. Se alege din nomenclatorul TemeiIncetare.",
    });
  }
  return probleme;
}

export function verificaSuspendare(input: {
  readonly dataInceput: string;
  readonly dataSfarsit: string | null;
  readonly temeiLegal: string | null;
}): readonly Problema[] {
  const probleme: Problema[] = [];
  if (!esteZi(input.dataInceput)) {
    probleme.push({
      camp: "dataInceput",
      mesaj: "Data de început a suspendării nu e o zi validă.",
    });
  }
  if (input.dataSfarsit !== null && !esteZi(input.dataSfarsit)) {
    probleme.push({
      camp: "dataSfarsit",
      mesaj: "Data de sfârșit a suspendării nu e o zi validă.",
    });
  }
  if (
    input.dataSfarsit !== null &&
    esteZi(input.dataSfarsit) &&
    esteZi(input.dataInceput) &&
    input.dataSfarsit < input.dataInceput
  ) {
    probleme.push({ camp: "dataSfarsit", mesaj: "Suspendarea se termină înainte să înceapă." });
  }
  if (input.temeiLegal === null || input.temeiLegal.trim() === "") {
    probleme.push({
      camp: "temeiLegal",
      mesaj: "Temeiul legal al suspendării lipsește. Se alege din nomenclatorul TemeiSuspendare.",
    });
  }
  return probleme;
}
