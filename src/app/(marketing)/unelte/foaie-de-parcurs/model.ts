import type { Coloana, DocumentTabelar, TabelSuplimentar } from "@/lib/unelte/document-tabelar";

import { construiesteFoaie, normalizeazaAn, normalizeazaLuna } from "../foaie-de-pontaj/foaie";

/**
 * Foaia de parcurs lunară, ca document justificativ pentru deducerea
 * cheltuielilor cu vehiculul.
 *
 * ── CE CER NORMELE, LITERAL ───────────────────────────────────────────────
 * HG 1/2016 (normele Codului fiscal), titlul II pct. 16 alin. (2) și titlul VII
 * pct. 68 alin. (2), forma consolidată la 31.03.2026 descărcată de pe
 * legislatie.just.ro/Public/DetaliiDocument/212504 pe 8 oct 2026: foaia de
 * parcurs „trebuie să cuprindă [la pct. 68: «să conțină»] cel puțin următoarele
 * informații: categoria de vehicul utilizat, scopul și locul deplasării,
 * kilometrii parcurși, norma proprie de consum carburant pe kilometru
 * parcurs”. Până pe 8 oct 2026 foaia
 * nu avea categoria, iar norma era o linie goală în subsol (auditul live).
 *
 * Restul antetului vine din OMFP 2634/2015, anexa 1 pct. 2–3 (orice document
 * justificativ): denumirea entității, numărul și data întocmirii, codul de
 * identificare fiscală.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu decide încadrarea vehiculului (pct. 68 alin. (8): „se realizează de
 * fiecare persoană impozabilă”). Utilizarea se ALEGE de om și se scrie cu
 * temeiul ei; lipsă = rubrică de completat.
 *
 * Zilele vin din `construiesteFoaie`; weekendurile NU se scot, fiindcă o mașină
 * de serviciu poate circula și sâmbăta — se recunosc după coloana „Ziua”.
 */

/** Valorile și etichetele, aliniate la `CATEGORII_VEHICUL` din modulul Flotă. */
export const CATEGORII = [
  "autoturism",
  "autoutilitara",
  "microbuz",
  "camion",
  "autobuz",
  "motocicleta",
  "altele",
] as const;
export type CategorieVehicul = (typeof CATEGORII)[number];

export const ETICHETE_CATEGORIE: Readonly<Record<CategorieVehicul, string>> = {
  autoturism: "Autoturism",
  autoutilitara: "Autoutilitară",
  microbuz: "Microbuz",
  camion: "Camion",
  autobuz: "Autobuz",
  motocicleta: "Motocicletă",
  altele: "Altele",
};

/** Aceleași valori și etichete ca `COMBUSTIBILI` din modulul Flotă. */
export const COMBUSTIBILI = [
  "benzina",
  "motorina",
  "gpl",
  "gnc",
  "electric",
  "hibrid",
  "hibrid_plugin",
  "altul",
] as const;
export type Combustibil = (typeof COMBUSTIBILI)[number];

export const ETICHETE_COMBUSTIBIL: Readonly<Record<Combustibil, string>> = {
  benzina: "Benzină",
  motorina: "Motorină",
  gpl: "GPL",
  gnc: "GNC",
  electric: "Electric",
  hibrid: "Hibrid",
  hibrid_plugin: "Hibrid plug-in",
  altul: "Altul",
};

/**
 * Cum e folosit vehiculul, cu temeiul din Codul fiscal (forma consolidată la
 * 08.08.2026, legislatie.just.ro/Public/DetaliiDocument/171282): art. 25
 * alin. (3) lit. l) pct. 1–5 pentru impozitul pe profit, art. 298 alin. (1) și
 * (3) lit. a)–f) pentru TVA. „mixt” = folosit și personal: deducere 50%, dar
 * doar până la 3.500 kg și 9 locuri cu tot cu al șoferului (art. 298 alin. (2));
 * peste prag limita nu se aplică, de aceea eticheta spune pragul.
 */
export const UTILIZARI = [
  "exclusiv",
  "urgenta",
  "agent",
  "persoane",
  "servicii",
  "marfa",
  "mixt",
] as const;
export type Utilizare = (typeof UTILIZARI)[number];

export const ETICHETE_UTILIZARE: Readonly<Record<Utilizare, string>> = {
  exclusiv: "Exclusiv în scopul activității economice",
  urgenta: "Servicii de urgență, pază și protecție sau curierat",
  agent: "Agent de vânzări sau de achiziții",
  persoane: "Transport de persoane cu plată, inclusiv taxi",
  servicii: "Servicii cu plată, închiriere sau școală de șoferi",
  marfa: "Vehicul folosit ca marfă în scop comercial",
  mixt: "Folosit și în scop personal (50%, dacă are cel mult 3.500 kg și 9 locuri)",
};

export const TEMEI_UTILIZARE: Readonly<Record<Utilizare, string>> = {
  exclusiv: "art. 25 alin. (3) lit. l) și art. 298 alin. (1) Cod fiscal",
  urgenta: "art. 25 alin. (3) lit. l) pct. 1 și art. 298 alin. (3) lit. a) Cod fiscal",
  agent: "art. 25 alin. (3) lit. l) pct. 2 și art. 298 alin. (3) lit. b) Cod fiscal",
  persoane: "art. 25 alin. (3) lit. l) pct. 3 și art. 298 alin. (3) lit. c) Cod fiscal",
  servicii: "art. 25 alin. (3) lit. l) pct. 4 și art. 298 alin. (3) lit. d)–e) Cod fiscal",
  marfa: "art. 25 alin. (3) lit. l) pct. 5 și art. 298 alin. (3) lit. f) Cod fiscal",
  mixt: "art. 25 alin. (3) lit. l) și art. 298 alin. (1) Cod fiscal",
};

/** Unitatea în care se măsoară combustibilul: litri, kWh la electrice, kg la GNC. */
export type Unitate = "l" | "kWh" | "kg";

export function unitatePentru(c: Combustibil | null): Unitate {
  if (c === "electric") return "kWh";
  if (c === "gnc") return "kg";
  return "l";
}

export const MAX_CURSE_PE_ZI = 4;
export const RANDURI_ALIMENTARI = 8;
/** Plafoane de bun-simț, aceleași ca la kilometrajul de bord din modulul Flotă. */
export const MAX_KM = 5_000_000;
export const MAX_NORMA = 99.9;
export const MAX_STOC = 999;

export type ParametriFoaieParcurs = Readonly<{
  an: number;
  luna: number;
  nrAuto: string;
  marca: string;
  sofer: string;
  firma: string;
  cui: string;
  nrFoaie: string;
  categorie: CategorieVehicul | null;
  combustibil: Combustibil | null;
  utilizare: Utilizare | null;
  /** Unități (l, kWh sau kg) la 100 km. */
  norma: number | null;
  /** Kilometrajul de bord la începutul lunii, în km întregi. */
  kmInitial: number | null;
  /** Combustibilul din rezervor la începutul lunii, în aceeași unitate. */
  stocInitial: number | null;
  cursePeZi: number;
}>;

const text = (v: string | null, max = 120) => (v ?? "").trim().slice(0, max);

function alegere<T extends string>(brut: string | null, valori: readonly T[]): T | null {
  const v = (brut ?? "").trim();
  return (valori as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * Un număr pozitiv cu cel mult trei zecimale, cu virgulă sau cu punct („6,5”,
 * „6.5”), cel mult `max`. Orice altceva = `null`, adică rubrică de completat.
 */
export function normalizeazaZecimal(brut: string | null, max: number): number | null {
  const v = (brut ?? "").trim();
  if (!/^\d{1,6}(?:[.,]\d{1,3})?$/u.test(v)) return null;
  const n = Number(v.replace(",", "."));
  return n > 0 && n <= max ? n : null;
}

/**
 * Kilometri întregi, între 0 și 5.000.000. Punctul și spațiul de grupare se
 * acceptă („125.000”, „125 000”), fiindcă așa se scrie kilometrajul în română;
 * o virgulă zecimală nu.
 */
export function normalizeazaKm(brut: string | null): number | null {
  const v = (brut ?? "").trim().replace(/[\s.]/gu, "");
  if (!/^\d{1,7}$/u.test(v)) return null;
  const n = Number(v);
  return n <= MAX_KM ? n : null;
}

export function normalizeazaCurse(brut: string | null): number {
  const v = (brut ?? "").trim();
  if (!/^\d$/u.test(v)) return 1;
  const n = Number(v);
  return n >= 1 && n <= MAX_CURSE_PE_ZI ? n : 1;
}

export function parametriFoaieParcurs(q: URLSearchParams): ParametriFoaieParcurs {
  const acum = new Date();
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    nrAuto: text(q.get("auto")),
    marca: text(q.get("marca")),
    sofer: text(q.get("sofer")),
    firma: text(q.get("firma")),
    cui: text(q.get("cui"), 20),
    nrFoaie: text(q.get("nr"), 20),
    categorie: alegere(q.get("categorie"), CATEGORII),
    combustibil: alegere(q.get("combustibil"), COMBUSTIBILI),
    utilizare: alegere(q.get("utilizare"), UTILIZARI),
    norma: normalizeazaZecimal(q.get("norma"), MAX_NORMA),
    kmInitial: normalizeazaKm(q.get("km")),
    stocInitial: normalizeazaZecimal(q.get("stoc"), MAX_STOC),
    cursePeZi: normalizeazaCurse(q.get("curse")),
  };
}

/** Scurtat la 24 de caractere: o adresă lungă nu se reproduce întreagă pe pagină. */
function citat(brut: string): string {
  const t = brut.trim();
  return t.length > 24 ? `${t.slice(0, 24)}…` : t;
}

/**
 * Ce a lăsat foaia deoparte din adresă, spus în cuvinte: o normă scrisă „6,5 l”
 * nu mai dispare tăcut din document. Anul și luna le spune `avizeParametri`
 * din foaia de pontaj (aceeași normalizare).
 */
export function avizeFoaieParcurs(
  q: URLSearchParams,
  ales: ParametriFoaieParcurs,
): readonly string[] {
  const avize: string[] = [];
  const brut = (cheie: string) => (q.get(cheie) ?? "").trim();
  const u = unitatePentru(ales.combustibil);
  if (brut("norma") !== "" && ales.norma === null) {
    avize.push(
      `Norma de consum „${citat(brut("norma"))}” nu e un număr între 0 și 99,9 ${u}/100 km; am lăsat rubrica de completat.`,
    );
  }
  if (brut("km") !== "" && ales.kmInitial === null) {
    avize.push(
      `Kilometrajul „${citat(brut("km"))}” nu e un număr întreg de km între 0 și 5.000.000; am lăsat rubrica de completat.`,
    );
  }
  if (brut("stoc") !== "" && ales.stocInitial === null) {
    avize.push(
      `Stocul de la începutul lunii „${citat(brut("stoc"))}” nu e un număr între 0 și 999 ${u}; am lăsat rubrica de completat.`,
    );
  }
  if (brut("curse") !== "" && String(ales.cursePeZi) !== brut("curse")) {
    avize.push(
      `Numărul de curse pe zi „${citat(brut("curse"))}” nu e între 1 și ${String(MAX_CURSE_PE_ZI)}; am folosit 1.`,
    );
  }
  return avize;
}

const FORMAT_RO = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 });
const numar = (n: number) => FORMAT_RO.format(n);
/**
 * Norma pe kilometru: norma pe 100 km are cel mult 3 zecimale, deci împărțită
 * la 100 are cel mult 5. Cu 3, „6,25 l/100 km” ar fi devenit „0,063 l/km”,
 * adică exact forma pe care o cer normele, rotunjită greșit.
 */
const FORMAT_PE_KM = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 5 });

/** Duminica e prima, ca la `Date.getUTCDay()`. Două litere: „Ma” și „Mi” nu se confundă. */
const ZILE = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"] as const;

export type RandCursa = Readonly<{
  zi: number;
  /** „01.10.2026” */
  data: string;
  /** „Jo” */
  ziua: string;
  weekend: boolean;
  /** Primul rând al zilei; celelalte sunt curse în plus pe aceeași zi. */
  primaCursa: boolean;
}>;

/** Câte un rând pe cursă: fiecare zi a lunii × `cursePeZi`. */
export function randuriCurse(p: ParametriFoaieParcurs): readonly RandCursa[] {
  const ll = String(p.luna).padStart(2, "0");
  return construiesteFoaie(p.an, p.luna, [""], 8).zile.flatMap((z) => {
    const dow = new Date(Date.UTC(p.an, p.luna - 1, z.zi)).getUTCDay();
    const rand = {
      zi: z.zi,
      data: `${String(z.zi).padStart(2, "0")}.${ll}.${String(p.an)}`,
      ziua: ZILE[dow] ?? "",
      weekend: z.weekend,
    };
    return Array.from({ length: p.cursePeZi }, (_, k) => ({
      ...rand,
      primaCursa: k === 0,
    }));
  });
}

/** Indicii coloanelor tabelului de curse; Excel-ul își pune formulele pe ei. */
export const COLOANA = {
  data: 0,
  ziua: 1,
  oraPlecare: 2,
  oraSosire: 3,
  loc: 4,
  scop: 5,
  kmPlecare: 6,
  kmSosire: 7,
  km: 8,
  consum: 9,
  semnatura: 10,
} as const;

export function coloaneCurse(u: Unitate): readonly Coloana[] {
  // Lățimi măsurate pe DejaVu aldin, 8 pt, pe A4 culcat: „normat (kWh)” cere
  // 63 pt, „conducătorului” 68 pt. Mai înguste, PDF-ul le tăia cu „…”.
  return [
    { eticheta: "Data", latime: 1.6 },
    { eticheta: "Ziua", latime: 0.7 },
    { eticheta: "Ora\nplecării", latime: 1.1 },
    { eticheta: "Ora\nsosirii", latime: 1.1 },
    { eticheta: "Locul deplasării\n(traseul: de la – la)", latime: 4.6 },
    { eticheta: "Scopul deplasării", latime: 3.9 },
    { eticheta: "Km bord\nla plecare", latime: 1.45 },
    { eticheta: "Km bord\nla sosire", latime: 1.45 },
    { eticheta: "Km\nparcurși", latime: 1.2 },
    { eticheta: `Consum\nnormat (${u})`, latime: 1.9 },
    { eticheta: "Semnătura\nconducătorului", latime: 2.1 },
  ];
}

export function coloaneAlimentari(u: Unitate): readonly Coloana[] {
  return [
    { eticheta: "Data", latime: 1.8 },
    { eticheta: "Nr. bon fiscal / factură", latime: 2.6 },
    { eticheta: "Stația (furnizorul)", latime: 4 },
    { eticheta: `Cantitate\n(${u})`, latime: 1.4 },
    { eticheta: "Valoare\n(lei)", latime: 1.4 },
    { eticheta: "Semnătura", latime: 2 },
  ];
}

export const TITLU_ALIMENTARI = "Alimentări cu combustibil";
export const TITLU_REZUMAT = "Rezumatul lunii";

/** Rândurile rezumatului, în ordine; Excel-ul pune pe fiecare formula lui. */
export const CHEI_REZUMAT = [
  "kmInceput",
  "kmSfarsit",
  "kmTotal",
  "norma",
  "consumNormat",
  "stocInceput",
  "alimentat",
  "stocCalculat",
  "stocConstatat",
  "diferenta",
  "valoare",
] as const;
export type CheieRezumat = (typeof CHEI_REZUMAT)[number];

export function eticheteRezumat(u: Unitate): Readonly<Record<CheieRezumat, string>> {
  return {
    kmInceput: "Km la bord la începutul lunii",
    kmSfarsit: "Km la bord la sfârșitul lunii",
    kmTotal: "Total km parcurși în lună",
    norma: `Norma proprie de consum (${u}/100 km)`,
    consumNormat: `Consum după normă (${u})`,
    stocInceput: `Stoc la începutul lunii (${u})`,
    alimentat: `Alimentat în lună (${u})`,
    stocCalculat: `Stoc la sfârșitul lunii, după normă (${u})`,
    stocConstatat: `Stoc la sfârșitul lunii, constatat (${u})`,
    diferenta: `Diferența: constatat − după normă (${u})`,
    valoare: "Valoarea alimentărilor (lei)",
  };
}

export const ETICHETA_NORMA = "Norma proprie de consum";

export function construiesteFoaieParcurs(p: ParametriFoaieParcurs): DocumentTabelar {
  const foaie = construiesteFoaie(p.an, p.luna, [""], 8);
  const ll = String(p.luna).padStart(2, "0");
  const ultima = foaie.zile.length;
  const u = unitatePentru(p.combustibil);
  const randuri = randuriCurse(p);
  const coloane = coloaneCurse(u);
  const etichete = eticheteRezumat(u);
  const valoriRezumat: Readonly<Record<CheieRezumat, string>> = {
    kmInceput: p.kmInitial === null ? "" : numar(p.kmInitial),
    kmSfarsit: "",
    kmTotal: "",
    norma: p.norma === null ? "" : numar(p.norma),
    consumNormat: "",
    stocInceput: p.stocInitial === null ? "" : numar(p.stocInitial),
    alimentat: "",
    stocCalculat: "",
    stocConstatat: "",
    diferenta: "",
    valoare: "",
  };
  const alimentari: TabelSuplimentar = {
    titlu: TITLU_ALIMENTARI,
    coloane: coloaneAlimentari(u),
    randuri: Array.from({ length: RANDURI_ALIMENTARI }, () => ["", "", "", "", "", ""]),
  };
  const rezumat: TabelSuplimentar = {
    titlu: TITLU_REZUMAT,
    coloane: [
      { eticheta: "Indicator", latime: 6 },
      { eticheta: "Valoare", latime: 2 },
    ],
    randuri: CHEI_REZUMAT.map((k) => [etichete[k], valoriRezumat[k]]),
  };

  return {
    titlu: `Foaie de parcurs — ${foaie.eticheta}`,
    subtitlu: null,
    campuri: [
      { eticheta: "Unitatea", valoare: p.firma },
      { eticheta: "CUI", valoare: p.cui },
      { eticheta: "Foaia nr.", valoare: p.nrFoaie },
      {
        eticheta: "Perioada",
        valoare: `01.${ll}.${String(p.an)} – ${String(ultima)}.${ll}.${String(p.an)}`,
      },
      { eticheta: "Nr. de înmatriculare", valoare: p.nrAuto },
      { eticheta: "Marca și modelul", valoare: p.marca },
      {
        eticheta: "Categoria vehiculului",
        valoare: p.categorie === null ? "" : ETICHETE_CATEGORIE[p.categorie],
      },
      {
        eticheta: "Combustibil",
        valoare: p.combustibil === null ? "" : ETICHETE_COMBUSTIBIL[p.combustibil],
      },
      {
        eticheta: ETICHETA_NORMA,
        valoare:
          p.norma === null
            ? ""
            : `${numar(p.norma)} ${u}/100 km (${FORMAT_PE_KM.format(p.norma / 100)} ${u}/km)`,
      },
      {
        eticheta: "Utilizarea vehiculului",
        valoare:
          p.utilizare === null
            ? ""
            : `${ETICHETE_UTILIZARE[p.utilizare]} — ${TEMEI_UTILIZARE[p.utilizare]}`,
      },
      { eticheta: "Conducător auto", valoare: p.sofer },
      { eticheta: "Data întocmirii", valoare: "" },
    ],
    campuriPeDouaColoane: true,
    paragrafe: [],
    coloane,
    randuri: randuri.map((r, i) => {
      const celule = coloane.map(() => "");
      celule[COLOANA.data] = r.data;
      celule[COLOANA.ziua] = r.ziua;
      if (i === 0 && p.kmInitial !== null) celule[COLOANA.kmPlecare] = numar(p.kmInitial);
      return celule;
    }),
    umbrite: [],
    tabeleSuplimentare: [alimentari, rezumat],
    note: [
      `Km parcurși = km la sosire − km la plecare. Consum după normă = km parcurși × norma proprie de consum ÷ 100.`,
      "Foaia cuprinde elementele minime din normele Codului fiscal (HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2)): categoria vehiculului, scopul și locul deplasării, kilometrii parcurși și norma proprie de consum.",
    ],
    semnaturi: ["Conducător auto", "Verificat și aprobat (administrator)"],
    orientare: "peisaj",
    numeFisier:
      p.nrAuto === ""
        ? `foaie-de-parcurs-${String(p.an)}-${ll}`
        : `foaie-de-parcurs-${p.nrAuto}-${String(p.an)}-${ll}`,
  };
}

/**
 * Exemplul completat de pe pagină: o mașină de agent de vânzări, două rânduri
 * pe zi. Stă aici, nu în `page.tsx`: o pagină Next nu exportă altceva decât
 * componenta și metadatele. Testul paginii verifică că exemplul nu dă niciun aviz.
 */
export const EXEMPLU_COMPLETAT =
  "?an=2026&luna=10&auto=B-123-ABC&marca=Dacia%20Logan&sofer=Radu%20Andrei&firma=Construct%20SRL&cui=RO12345678&nr=17&categorie=autoturism&combustibil=motorina&utilizare=agent&norma=6%2C5&km=125000&stoc=20&curse=2#documentul";

export function foaieParcursDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFoaieParcurs(parametriFoaieParcurs(q));
}
