// src/lib/tema/paleta.ts
import { citesteHex, contrast, deschide, scrieHex, type Rgb } from "./culoare";

/**
 * Culoarea primară per organizație — de la promisiune la funcție.
 *
 * `globals.css` scrie de la început că „fiecare organizație își poate suprascrie
 * culoarea primară, iar layout-ul organizației va reinjecta variabilele de mai
 * jos direct în `<html>`, din server". Coloana există în bază
 * (`organization_branding.primary_color`), eticheta există în jurnalul de audit
 * — și nimic nu a fost construit vreodată: `grep -rn '--color-primary' src
 * --include=*.tsx` întorcea UN rezultat, într-o vinietă de marketing.
 *
 * ── DE CE E O POARTĂ, NU DOAR O CONVERSIE ─────────────────────────────────
 * Primarul poartă textul crem `--color-primary-foreground` (#faf7f0) pe el:
 * railul, antetul, butonul principal. O culoare deschisă aleasă de un
 * administrator ar face butonul „Salvează" ilizibil în toată aplicația lui,
 * fără niciun avertisment. De aceea funcția ÎNTOARCE un refuz cu motiv scris,
 * iar Server Action-ul care salvează îl arată ca eroare de câmp.
 *
 * Pragul e 4,5:1 — AA pentru text normal. Nu 3:1: butonul principal poartă
 * text de 14px, nu titluri.
 *
 * ── DE CE IMPLICITUL NU TRECE PE AICI ─────────────────────────────────────
 * Cele trei valori implicite (#0f1e3d, #1b2a4e, #2a3d66) rămân scrise în
 * `globals.css`, nedervate. Derivarea rulează NUMAI când o organizație
 * suprascrie — altfel o rotunjire în aritmetica de aici ar schimba tăcut
 * aspectul tuturor firmelor care n-au cerut nimic.
 */

/** Cremul pe care se scrie peste primar. Egal cu `--color-primary-foreground`. */
const CERNEALA_PE_PRIMAR: Rgb = { r: 250, g: 247, b: 240 };

/** Pragul WCAG AA pentru text normal. */
export const PRAG_CONTRAST = 4.5;

/**
 * Pașii de luminozitate care duc de la primar la hover și apăsat, măsurați pe
 * paleta implicită: L trece de la 0,149 la 0,206 la 0,282.
 */
const PAS_HOVER = 0.057;
const PAS_APASAT = 0.133;

export type PaletaOrganizatie = Readonly<{
  primary: string;
  primaryHover: string;
  primaryActive: string;
}>;

export type RezultatPaleta =
  Readonly<{ ok: true; paleta: PaletaOrganizatie }> | Readonly<{ ok: false; motiv: string }>;

/**
 * Derivă paleta unei organizații dintr-o singură culoare primară, sau refuză
 * culoarea cu un motiv scris pentru om.
 */
export function paletaDinPrimara(hex: string): RezultatPaleta {
  const primar = citesteHex(hex);
  if (primar === null) {
    return {
      ok: false,
      motiv: "Culoarea trebuie scrisă în format hexazecimal, de exemplu #0F1E3D.",
    };
  }

  const raport = contrast(primar, CERNEALA_PE_PRIMAR);
  if (raport < PRAG_CONTRAST) {
    return {
      ok: false,
      motiv:
        `Culoarea e prea deschisă: textul de pe butoane și din meniu ar avea un contrast de ` +
        `${raport.toFixed(2).replace(".", ",")}:1, sub minimul de ${PRAG_CONTRAST} cerut de ` +
        `accesibilitate. Alegeți o nuanță mai închisă.`,
    };
  }

  const hover = starePeste(primar, PAS_HOVER);
  const apasat = starePeste(primar, PAS_APASAT);

  return {
    ok: true,
    paleta: {
      primary: scrieHex(primar),
      primaryHover: scrieHex(hover),
      primaryActive: scrieHex(apasat),
    },
  };
}

/**
 * Starea de hover sau de apăsat, la un pas dat de culoarea de bază.
 *
 * Regula: **starea se depărtează de culoarea textului.** Pe navy-ul implicit,
 * asta înseamnă mai deschis — exact ce fac cele trei valori scrise de mână în
 * `globals.css`. Pe o culoare primară aleasă aproape de pragul de contrast,
 * deschiderea ar coborî sub el, deci starea merge în sens invers, spre închis:
 * întunecarea crește întotdeauna contrastul cu cremul de deasupra.
 *
 * Prima variantă a acestei funcții scurta pasul până când contrastul revenea
 * peste prag. Testul „un primar aproape de prag" a arătat că bucla putea ieși
 * cu o valoare tot sub prag și, la pași mici, chiar cu una mai închisă decât
 * cerea — adică exact rezultatul greșit, obținut din întâmplare. Inversarea
 * explicită e și mai simplă, și corectă prin construcție: ambele direcții au
 * garanția scrisă, nu sperată.
 */
function starePeste(culoare: Rgb, pas: number): Rgb {
  const maiDeschis = deschide(culoare, pas);
  if (contrast(maiDeschis, CERNEALA_PE_PRIMAR) >= PRAG_CONTRAST) return maiDeschis;
  return deschide(culoare, -pas);
}

/**
 * Variabilele care se pun pe `<html>` din server, ca `style`.
 *
 * Din server, nu dintr-un efect de client: altfel prima pictare ar folosi navy-ul
 * implicit și ar sări la culoarea firmei după hidratare — exact „flash-ul de temă
 * greșită" pe care comentariul din `globals.css` promitea că-l evită.
 *
 * Întoarce un obiect gol când organizația n-a ales nimic, iar `<html>` rămâne
 * fără atribut `style`.
 */
export function variabileTema(hex: string | null): Readonly<Record<string, string>> {
  if (hex === null) return {};
  const rezultat = paletaDinPrimara(hex);
  if (!rezultat.ok) return {};
  return {
    "--color-primary": rezultat.paleta.primary,
    "--color-primary-hover": rezultat.paleta.primaryHover,
    "--color-primary-active": rezultat.paleta.primaryActive,
  };
}
