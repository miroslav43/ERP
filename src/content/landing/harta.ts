import { ADRESA_SITE } from "./contact";

/**
 * Harta paginilor publice — sursa unică pentru `sitemap.xml`.
 *
 * ── DE CE NU MAI E `src/app/sitemap.ts` ───────────────────────────────────
 * Generatorul din Next produce XML-ul singur și nu lasă loc pentru instrucțiunea
 * de procesare `<?xml-stylesheet?>`. Fără ea, fișierul ajunge în browser ca un
 * perete de text: spațiul de nume `xhtml`, pe care îl folosim pentru hreflang,
 * dezactivează vizualizatorul XML implicit din Chrome — verificat cu reproducere
 * minimă, aceleași două fișiere, unul cu `xmlns:xhtml` și unul fără.
 *
 * Soluția nu e scoaterea hreflang-ului, care e informație reală pentru motoare,
 * ci foaia noastră de stil. Ea cere controlul asupra XML-ului emis, deci datele
 * stau aici, iar `src/app/sitemap.xml/route.ts` le randează.
 *
 * ── DE CE `actualizat` SE SCRIE DE MÂNĂ ───────────────────────────────────
 * Nu e `new Date()`. O dată de build pusă automat ar pretinde că toate paginile
 * s-au schimbat la fiecare livrare, iar un `lastmod` în care nu se poate avea
 * încredere e ignorat de motoare.
 *
 * ── DE CE PERECHEA DE TRADUCERE SE DECLARĂ ────────────────────────────────
 * Generatorul anterior prefixa orb `/en` la fiecare cale și emitea hreflang
 * către rute inexistente. Hreflang cere reciprocitate: o trimitere către o
 * pagină care nu trimite înapoi invalidează întreaga grupă, nu doar rândul
 * greșit.
 */
export type Pagina = Readonly<{
  cale: string;
  prioritate: number;
  limba: "ro" | "en";
  /** Calea variantei în cealaltă limbă, sau `null` când pagina n-are pereche. */
  traducere: string | null;
  actualizat: string;
  /**
   * Grupa sub care apare rândul în foaia de stil.
   *
   * Nu ajunge în XML — motoarele n-au ce face cu ea. Servește exclusiv omului
   * care deschide `sitemap.xml` în browser: douăzeci și două de adrese într-o
   * listă plată se citesc greu, aceleași grupate se citesc dintr-o privire.
   */
  sectiune: string;
}>;

export const PAGINI: readonly Pagina[] = [
  {
    cale: "/",
    prioritate: 1,
    limba: "ro",
    traducere: "/en",
    actualizat: "2026-08-31",
    sectiune: "Principale",
  },
  {
    cale: "/en",
    prioritate: 0.9,
    limba: "en",
    traducere: "/",
    actualizat: "2026-08-31",
    sectiune: "Principale",
  },
  {
    cale: "/preturi",
    prioritate: 0.8,
    limba: "ro",
    traducere: "/en/preturi",
    actualizat: "2026-08-22",
    sectiune: "Principale",
  },
  {
    cale: "/en/preturi",
    prioritate: 0.7,
    limba: "en",
    traducere: "/preturi",
    actualizat: "2026-08-22",
    sectiune: "Principale",
  },
  {
    cale: "/module",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Principale",
  },
  {
    cale: "/pontaj-pe-telefon",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Principale",
  },
  {
    cale: "/cere-demo",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-08-22",
    sectiune: "Principale",
  },

  // Prioritate mare, deliberat: sunt singurele pagini care pot câștiga o căutare
  // pe un domeniu fără vechime, fiindcă răspund la o întrebare precisă, cu
  // articolul de lege lângă fiecare afirmație.
  {
    cale: "/evidenta-orelor-de-munca",
    prioritate: 0.9,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Obligații legale",
  },
  {
    cale: "/reges-online",
    prioritate: 0.9,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Obligații legale",
  },
  {
    cale: "/ghid/control-itm",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-04",
    sectiune: "Obligații legale",
  },

  {
    cale: "/domenii",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-04",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/constructii",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-04",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/productie",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-04",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/transport",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-04",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/servicii",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-04",
    sectiune: "Domenii",
  },

  {
    cale: "/unelte/foaie-de-pontaj",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/comparatie/excel",
    prioritate: 0.6,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Unelte și comparații",
  },

  {
    cale: "/incredere",
    prioritate: 0.6,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Înainte să întrebi",
  },
  {
    cale: "/intrebari",
    prioritate: 0.6,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Înainte să întrebi",
  },
  {
    cale: "/de-ce-nu",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
    sectiune: "Înainte să întrebi",
  },

  {
    cale: "/legal/termeni",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    actualizat: "2026-08-22",
    sectiune: "Legal",
  },
  {
    cale: "/legal/confidentialitate",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    actualizat: "2026-08-22",
    sectiune: "Legal",
  },
];

export type IntrareSitemap = Readonly<{
  url: string;
  lastModified: string;
  priority: number;
  sectiune: string;
  /** Perechile hreflang, gata de emis. Gol când pagina n-are traducere. */
  alternative: readonly Readonly<{ limba: string; url: string }>[];
}>;

/**
 * Intrările gata de randat.
 *
 * Rămâne o funcție, nu o constantă, fiindcă `continut.test.ts` o apelează ca să
 * compare harta cu `llms.txt` și cu rutele de pe disc.
 */
export function intrariSitemap(): readonly IntrareSitemap[] {
  return PAGINI.map((pagina) => {
    const de_baza = {
      url: `${ADRESA_SITE}${pagina.cale}`,
      lastModified: pagina.actualizat,
      priority: pagina.prioritate,
      sectiune: pagina.sectiune,
    };

    if (pagina.traducere === null) return { ...de_baza, alternative: [] };

    const ro = pagina.limba === "ro" ? pagina.cale : pagina.traducere;
    const en = pagina.limba === "en" ? pagina.cale : pagina.traducere;

    return {
      ...de_baza,
      alternative: [
        { limba: "ro", url: `${ADRESA_SITE}${ro}` },
        { limba: "en", url: `${ADRESA_SITE}${en}` },
        // Româna e limba implicită: publicul e din România, iar engleza există
        // pentru excepții. Fără `x-default`, motoarele aleg singure pentru
        // vizitatorii care nu se potrivesc cu nicio limbă declarată.
        { limba: "x-default", url: `${ADRESA_SITE}${ro}` },
      ],
    };
  });
}
