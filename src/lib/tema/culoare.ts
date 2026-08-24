// src/lib/tema/culoare.ts

/**
 * Aritmetica de culoare a temei per organizație. Funcții pure, fără I/O și
 * fără React — de aceea sunt singurele din stratul de interfață care se pot
 * testa cu adevărat, într-un proiect fără niciun test de randare.
 *
 * Toate rapoartele de contrast se calculează după WCAG 2.1: luminanță
 * relativă din sRGB liniarizat. Nu se estimează niciodată. Documentul
 * `docs/design/stari-de-interactiune.md` conține valorile de referință pentru
 * paleta implicită, iar testele le folosesc ca ancoră: dacă aritmetica de aici
 * s-ar strica, ele n-ar mai ieși.
 */

export type Rgb = Readonly<{ r: number; g: number; b: number }>;

const HEX = /^#?([0-9a-f]{6})$/i;

/** Acceptă „#0F1E3D” și „0f1e3d”. Întoarce `null` pentru orice altceva. */
export function citesteHex(text: string): Rgb | null {
  const potrivire = HEX.exec(text.trim());
  if (potrivire === null) return null;
  const n = Number.parseInt(potrivire[1] ?? "", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function scrieHex({ r, g, b }: Rgb): string {
  const parte = (v: number): string =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${parte(r)}${parte(g)}${parte(b)}`;
}

/**
 * Luminanța relativă WCAG. Canalul se liniarizează întâi — pragul 0,03928 și
 * exponentul 2,4 sunt din specificație, nu aproximări.
 */
export function luminanta({ r, g, b }: Rgb): number {
  const canal = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Raportul de contrast dintre două culori opace, între 1 și 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminanta(a);
  const lb = luminanta(b);
  const [sus, jos] = la > lb ? [la, lb] : [lb, la];
  return (sus + 0.05) / (jos + 0.05);
}

export type Hsl = Readonly<{ h: number; s: number; l: number }>;

export function spreHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s, l };
}

export function dinHsl({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1]: readonly [number, number, number] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/**
 * Deschide o culoare cu un pas de luminozitate, păstrând nuanța și saturația.
 *
 * De ce HSL și nu un amestec cu alb: amestecul cu alb desaturează, iar un navy
 * amestecat cu crem devine cenușiu-albăstrui înainte să devină vizibil mai
 * deschis. Pasul pe L păstrează culoarea și schimbă doar cât de aprinsă e —
 * exact ce cere o stare de hover care trebuie să se simtă, nu să se remarce.
 */
export function deschide(culoare: Rgb, pas: number): Rgb {
  const hsl = spreHsl(culoare);
  return dinHsl({ ...hsl, l: Math.min(1, Math.max(0, hsl.l + pas)) });
}
