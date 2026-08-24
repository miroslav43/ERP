// src/domain/leave/contrast.ts
//
// Contrastul unei culori ALESE DE ADMINISTRATOR.
//
// Culoarea unui tip de concediu vine dintr-un `<input type="color">` fără nicio
// constrângere (`setari/card-tip-adaptabil.tsx`) și ajunge, în calendar, fundal
// sub text. Cerneala era fixă — `text-primary-foreground`, adică cremul
// #faf7f0 — deci raportul depindea în întregime de ce a nimerit administratorul:
// pe navy-ul produsului dă 15,4:1, pe galbenul implicit al oricărui selector de
// culoare (#ffff00) dă 1,00:1, iar numele angajatului dispare pur și simplu de
// pe ecran. Nimic din aplicație nu avertiza.
//
// Nu se estimează: se calculează. Formula e cea din WCAG 2.1 — luminanță
// relativă (§ relative luminance) și raport de contrast (§ contrast ratio) — iar
// pragul ales e 4,5:1, cerința AA pentru text mic (1.4.3).

/** Cerneala crem a produsului, `--color-primary-foreground` din `globals.css`. */
const CREM = { r: 0xfa, g: 0xf7, b: 0xf0 } as const;
/**
 * Cerneala închisă a produsului, `--color-foreground` din `globals.css`.
 *
 * ATENȚIE la orice atingere: valoarea trebuie să fie EXACT tokenul, fiindcă
 * pastila randează clasa `text-foreground` (`grila-calendar.tsx`), nu culoarea
 * de aici. O constantă apropiată, dar diferită, face modulul să calculeze un
 * raport pe care ecranul nu-l are: cu un #1c1b18 (mai închis decât tokenul),
 * calculul ieșea sistematic MAI MARE decât realitatea — pe #0088dd dădea 4,56,
 * adică „trece AA”, în timp ce pe ecran raportul real era 4,23, adică nu trece.
 * Din 4096 de culori încercate, 162 erau declarate lizibile fără să fie.
 */
const CERNEALA = { r: 0x14, g: 0x21, b: 0x3d } as const;

export interface CuloareRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * `#rgb`, `#rrggbb` sau orice altceva → `null`.
 *
 * Coloana `leave_types.culoare` e `text` în bază, nu un tip verificat: poate
 * ajunge acolo un `rgb(…)`, un nume CSS sau un șir gol printr-o migrare de date
 * sau printr-un apel direct. `null` înseamnă „nu pot decide”, iar apelantul
 * alege atunci varianta care nu poate greși.
 */
export function citesteHex(valoare: string): CuloareRgb | null {
  const curat = valoare.trim().toLowerCase();
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/u.test(curat)) return null;

  const cifre = curat.slice(1);
  const dubleaza = (bucata: string): number => Number.parseInt(bucata.repeat(2), 16);
  if (cifre.length === 3) {
    return {
      r: dubleaza(cifre.slice(0, 1)),
      g: dubleaza(cifre.slice(1, 2)),
      b: dubleaza(cifre.slice(2, 3)),
    };
  }
  return {
    r: Number.parseInt(cifre.slice(0, 2), 16),
    g: Number.parseInt(cifre.slice(2, 4), 16),
    b: Number.parseInt(cifre.slice(4, 6), 16),
  };
}

/** Luminanța relativă WCAG 2.1, în [0, 1]. */
export function luminantaRelativa(culoare: CuloareRgb): number {
  const canal = (valoare8biti: number): number => {
    const v = valoare8biti / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(culoare.r) + 0.7152 * canal(culoare.g) + 0.0722 * canal(culoare.b);
}

/** Raportul de contrast WCAG 2.1, în [1, 21]. Simetric în cele două culori. */
export function raportContrast(a: CuloareRgb, b: CuloareRgb): number {
  const la = luminantaRelativa(a);
  const lb = luminantaRelativa(b);
  const maxim = Math.max(la, lb);
  const minim = Math.min(la, lb);
  return (maxim + 0.05) / (minim + 0.05);
}

export type CernealaPeCuloare = "crem" | "cerneala";

/**
 * Ce cerneală ține pe fundalul dat: cremul produsului sau cerneala lui închisă.
 *
 * Se alege cea cu raportul MAI MARE, nu una fixă — pe un galben deschis câștigă
 * cerneala închisă (14,9:1 față de 1,00:1), pe navy câștigă cremul. Pentru o
 * culoare pe care n-o putem citi, răspunsul e `cerneala`: fundalul necunoscut se
 * randează atunci fără umplere, iar cerneala închisă e cea care ține pe cremul
 * paginii.
 */
export function cernealaPentruFundal(culoare: string): CernealaPeCuloare {
  const fundal = citesteHex(culoare);
  if (fundal === null) return "cerneala";
  return raportContrast(fundal, CREM) >= raportContrast(fundal, CERNEALA) ? "crem" : "cerneala";
}

/** Pragul AA pentru text mic (WCAG 1.4.3). */
export const PRAG_TEXT_MIC = 4.5;

/**
 * Cel mai bun raport obtenabil pe fundalul dat, cu una dintre cele două cerneli
 * ale produsului. Sub `PRAG_TEXT_MIC`, culoarea NU are voie să poarte text —
 * nici măcar cu cerneala potrivită.
 *
 * Pentru o culoare necitibilă întoarce 0: „nu știu” se tratează ca „nu ține”.
 */
export function celMaiBunContrast(culoare: string): number {
  const fundal = citesteHex(culoare);
  if (fundal === null) return 0;
  return Math.max(raportContrast(fundal, CREM), raportContrast(fundal, CERNEALA));
}
