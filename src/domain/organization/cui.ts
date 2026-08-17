// src/domain/organization/cui.ts
// Validarea CUI românesc — funcție pură, fără dependențe, folosită identic pe client și pe server.
// Algoritm oficial: cifra de control se obține din ponderile 7,5,3,2,1,7,5,3,2 aplicate
// pe CUI-ul fără ultima cifră, aliniat la dreapta pe 9 poziții.

export const CUI_PONDERI = [7, 5, 3, 2, 1, 7, 5, 3, 2] as const;
export const CUI_LUNGIME_MIN = 2;
export const CUI_LUNGIME_MAX = 10;

export type MotivCuiInvalid = "gol" | "caractere" | "lungime" | "cifra_control";

export type RezultatCui =
  | Readonly<{ valid: true; normalizat: string }>
  | Readonly<{ valid: false; motiv: MotivCuiInvalid; mesaj: string }>;

/** Elimină prefixul RO, spațiile, punctele și cratimele. Rezultatul conține doar cifre. */
export function normalizeazaCui(brut: string): string {
  return brut.trim().replace(/^ro/i, "").replace(/\D+/g, "");
}

/** Calculează cifra de control pentru partea de CUI rămasă după eliminarea ultimei cifre. */
export function calculeazaCifraControl(fataraControl: string): number {
  const aliniat = fataraControl.padStart(CUI_PONDERI.length, "0");
  let suma = 0;
  for (let i = 0; i < CUI_PONDERI.length; i += 1) {
    const cifra = Number(aliniat[i] ?? "0");
    const pondere = CUI_PONDERI[i] ?? 0;
    suma += cifra * pondere;
  }
  const rest = (suma * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** Verifică doar cifra de control, pe un șir care conține exclusiv cifre. */
export function areCifraControlValida(cifre: string): boolean {
  if (cifre.length < CUI_LUNGIME_MIN) return false;
  const control = Number(cifre.slice(-1));
  return control === calculeazaCifraControl(cifre.slice(0, -1));
}

export function validateazaCui(brut: string): RezultatCui {
  const curatat = brut
    .trim()
    .replace(/^ro/i, "")
    .replace(/[\s.\-]/g, "");
  if (curatat.length === 0) {
    return { valid: false, motiv: "gol", mesaj: "Introduceți codul unic de înregistrare (CUI)." };
  }
  if (!/^\d+$/.test(curatat)) {
    return {
      valid: false,
      motiv: "caractere",
      mesaj: "CUI-ul poate conține doar cifre, opțional prefixul RO (ex. RO 14 399 840).",
    };
  }
  if (curatat.length < CUI_LUNGIME_MIN || curatat.length > CUI_LUNGIME_MAX) {
    return {
      valid: false,
      motiv: "lungime",
      mesaj: `CUI-ul trebuie să aibă între ${CUI_LUNGIME_MIN} și ${CUI_LUNGIME_MAX} cifre.`,
    };
  }
  if (!areCifraControlValida(curatat)) {
    return {
      valid: false,
      motiv: "cifra_control",
      mesaj:
        "CUI-ul nu este valid: cifra de control nu corespunde. Verificați numărul de pe certificat.",
    };
  }
  return { valid: true, normalizat: curatat };
}

/** Formatare pentru afișare: „RO 14399840” pentru plătitorii de TVA, altfel „14399840”. */
export function formateazaCui(normalizat: string, platitorTva: boolean): string {
  return platitorTva ? `RO ${normalizat}` : normalizat;
}
