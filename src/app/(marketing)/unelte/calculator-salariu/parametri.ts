import { SALARIU_MINIM_BRUT_2026_IULIE } from "@/content/legal/salarizare-publica";
import { parseAmount } from "@/lib/format/money";
import { dinBrut, dinNet, type RezultatSalariu } from "@/lib/unelte/salariu";

/**
 * Intrările calculatorului din adresă, normalizate, și calculul lor.
 *
 * Formular GET, ca restul uneltelor: starea stă în adresă, pagina merge fără
 * JavaScript, iar un link de forma `?suma=5000` se poate trimite cuiva.
 *
 * O sumă care nu se poate citi NU se înlocuiește cu salariul minim: până pe
 * 8 oct 2026, „5000 lei” și „abc” afișau calculul pentru 4.325 de lei, fără
 * niciun mesaj. Acum pagina spune ce n-a înțeles și nu arată alt calcul.
 */

/** Plafonul calculatorului, pe lună. */
export const SUMA_MAX = 500_000;

export type CitireSuma =
  | Readonly<{ ok: true; valoare: number; rotunjita: boolean }>
  | Readonly<{ ok: false; eroare: string }>;

// „5.000”, „12.500”, „1.250.000”: punctul desparte miile, așa scrie orice român
// și așa afișează pagina însăși. `parseAmount` e partajat cu restul aplicației
// și citește un punct singur ca zecimal; regula de aici e doar a calculatorului,
// unde o sumă de salariu cu trei zecimale nu există.
const MII_CU_PUNCT = /^\d{1,3}(?:\.\d{3})+$/u;
// „5,000”, de pe o tastatură englezească: tot mii, din același motiv.
const MII_CU_VIRGULA = /^\d{1,3}(?:,\d{3})+$/u;
// Spațiile (și cel neîntrerupt, din Excel) plus caracterele invizibile din copy-paste.
const SPATII = /[\s  ​⁠﻿]/gu;
const MONEDA = /(?:lei|ron)$/iu;

export function citesteSuma(text: string): CitireSuma {
  const curat = text.replace(SPATII, "").replace(MONEDA, "");
  const fara = MII_CU_PUNCT.test(curat)
    ? curat.replace(/\./gu, "")
    : MII_CU_VIRGULA.test(curat)
      ? curat.replace(/,/gu, "")
      : curat;
  const n = fara === "" ? null : parseAmount(fara);
  if (n === null) {
    return {
      ok: false,
      eroare: `Nu am înțeles suma „${text.trim().slice(0, 20)}”. Scrie-o ca 5000 sau 5.000.`,
    };
  }
  // Calculatorul lucrează în lei întregi: impozitul și contribuțiile se
  // rotunjesc la leu (OUG 59/2005), iar desfășurătorul trebuie să se închidă.
  const valoare = Math.round(n);
  if (valoare < 1) return { ok: false, eroare: "Suma trebuie să fie de cel puțin 1 leu." };
  if (valoare > SUMA_MAX) {
    return { ok: false, eroare: "Calculatorul merge până la 500.000 de lei pe lună." };
  }
  return { ok: true, valoare, rotunjita: valoare !== n };
}

export type ParametriCalculator = Readonly<{
  /** Textul din câmp, întors în formular așa cum l-a scris omul — și când n-a putut fi citit. */
  text: string;
  /** Suma citită, la leu; `null` când textul n-a putut fi citit. */
  suma: number | null;
  eroare: string | null;
  /** Suma avea bani și a fost rotunjită la leu. */
  rotunjita: boolean;
  din: "brut" | "net";
  /** 0–4; 4 înseamnă „4 și peste”, ca în tabelul art. 77 alin. (4). */
  persoane: number;
  functieDeBaza: boolean;
}>;

export function parametriCalculator(q: URLSearchParams): ParametriCalculator {
  const text = (q.get("suma") ?? "").slice(0, 20);
  const gol = text.trim() === "";
  const citire: CitireSuma = gol
    ? { ok: true, valoare: SALARIU_MINIM_BRUT_2026_IULIE, rotunjita: false }
    : citesteSuma(text);
  const persoane = Number.parseInt(q.get("persoane") ?? "", 10);
  return {
    text: gol ? String(SALARIU_MINIM_BRUT_2026_IULIE) : text,
    suma: citire.ok ? citire.valoare : null,
    eroare: citire.ok ? null : citire.eroare,
    rotunjita: citire.ok && citire.rotunjita,
    din: q.get("din") === "net" ? "net" : "brut",
    persoane: Number.isFinite(persoane) ? Math.min(4, Math.max(0, persoane)) : 0,
    functieDeBaza: q.get("baza") !== "nu",
  };
}

export type CalculCalculator = Readonly<{
  parametri: ParametriCalculator;
  /** `null` când nu există un calcul pentru cifra cerută; motivul e în `eroare`. */
  rezultat: RezultatSalariu | null;
  eroare: string | null;
  /** Brut sub salariul minim: calculul cu normă întreagă nu se aplică (vezi pagina). */
  subMinim: boolean;
}>;

export function calculeazaDinParametri(q: URLSearchParams): CalculCalculator {
  const p = parametriCalculator(q);
  if (p.suma === null) return { parametri: p, rezultat: null, eroare: p.eroare, subMinim: false };
  const rezultat =
    p.din === "net"
      ? dinNet(p.suma, p.persoane, p.functieDeBaza)
      : dinBrut(p.suma, p.persoane, p.functieDeBaza);
  return {
    parametri: p,
    rezultat,
    eroare: null,
    subMinim: rezultat.brut < SALARIU_MINIM_BRUT_2026_IULIE,
  };
}
