import { SALARIU_MINIM_BRUT_2026_IULIE } from "@/content/legal/salarizare-publica";
import { parseAmount } from "@/lib/format/money";
import { dinBrut, dinNet, type RezultatSalariu } from "@/lib/unelte/salariu";

/**
 * Intrările calculatorului din adresă, normalizate, și calculul lor.
 *
 * Formular GET, ca restul uneltelor: starea stă în adresă, pagina merge fără
 * JavaScript, iar un link de forma `?suma=5000` se poate trimite cuiva.
 */

export type ParametriCalculator = Readonly<{
  suma: number;
  din: "brut" | "net";
  /** 0–4; 4 înseamnă „4 și peste”, ca în tabelul art. 77 alin. (4). */
  persoane: number;
  functieDeBaza: boolean;
}>;

const SUMA_MAX = 500_000;

export function parametriCalculator(q: URLSearchParams): ParametriCalculator {
  const brut = parseAmount((q.get("suma") ?? "").slice(0, 20));
  const suma =
    brut === null || !Number.isFinite(brut) || brut <= 0
      ? SALARIU_MINIM_BRUT_2026_IULIE
      : Math.min(SUMA_MAX, Math.round(brut * 100) / 100);
  const persoane = Number.parseInt(q.get("persoane") ?? "", 10);
  return {
    suma,
    din: q.get("din") === "net" ? "net" : "brut",
    persoane: Number.isFinite(persoane) ? Math.min(4, Math.max(0, persoane)) : 0,
    functieDeBaza: q.get("baza") !== "nu",
  };
}

export type CalculCalculator = Readonly<{
  parametri: ParametriCalculator;
  rezultat: RezultatSalariu;
  /** Brut sub salariul minim: calculul cu normă întreagă nu se aplică (vezi pagina). */
  subMinim: boolean;
}>;

export function calculeazaDinParametri(q: URLSearchParams): CalculCalculator {
  const p = parametriCalculator(q);
  const rezultat =
    p.din === "net"
      ? dinNet(p.suma, p.persoane, p.functieDeBaza)
      : dinBrut(p.suma, p.persoane, p.functieDeBaza);
  return { parametri: p, rezultat, subMinim: rezultat.brut < SALARIU_MINIM_BRUT_2026_IULIE };
}
