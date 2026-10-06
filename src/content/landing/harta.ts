import { CONCEDIU_ODIHNA } from "@/content/legal/concediu-odihna";
import { CONTROL_ITM } from "@/content/legal/control-itm";
import { DIURNA } from "@/content/legal/diurna";
import { DIURNA_EXTERNA } from "@/content/legal/diurna-externa";
import { SPOR_DE_NOAPTE } from "@/content/legal/spor-de-noapte";
import { ORE_SUPLIMENTARE } from "@/content/legal/ore-suplimentare";
import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";
import { REGES } from "@/content/legal/reges";

import { ADRESA_SITE } from "./contact";
import { fisaModulului } from "./fise-module";
import { RO } from "./ro";
import { slugModul } from "./slug-module";

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
 * Unde conținutul are deja o dată a lui, ea se citește de acolo, nu se copiază:
 * fișele de modul (`FisaModul.actualizat`) și paginile-lege (`actualizatIso`).
 * Copiată, data rămânea în urmă la prima corectură — cele nouăsprezece module au
 * purtat până la 17 sept 2026 o singură dată, mai veche decât ultima editare.
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

/**
 * Paginile celor nouăsprezece module, generate din catalog.
 *
 * ── DE CE GENERATE, NU SCRISE ─────────────────────────────────────────────
 * Sunt exact aceleași chei pe care `generateStaticParams` le prerandează în
 * `/module/[modul]`. Scrise de mână, cele două liste s-ar fi despărțit la primul
 * modul adăugat: harta ar fi trimis motoarele către o adresă care dă 404, sau ar
 * fi lăsat un modul nou nedescoperit. Cu sursa comună, despărțirea nu e posibilă.
 *
 * Ordinea din catalog e păstrată, deci rândurile ies grupate, ca restul hărții.
 */
const MODULE: readonly Pagina[] = RO.module.grupuri.flatMap((grup) =>
  grup.module.map((modul) => ({
    cale: `/module/${slugModul(modul.cheie)}`,
    // Sub paginile principale, peste cele legale: sunt destinații reale, dar
    // pentru cineva care caută „program de pontaj", pagina de intrare e
    // `/module`, nu fișa unui modul anume.
    prioritate: 0.6,
    limba: "ro" as const,
    traducere: null,
    // Fiecare modul are fișă (test în `continut.test.ts`); rezerva e data
    // catalogului, pentru un modul adăugat înaintea fișei lui.
    actualizat: fisaModulului(modul.cheie)?.actualizat ?? "2026-09-04",
    sectiune: "Module",
  })),
);

export const PAGINI: readonly Pagina[] = [
  {
    cale: "/",
    prioritate: 1,
    limba: "ro",
    traducere: "/en",
    // 23 sept: H2-ul benzii „Cum se leagă" spune acum salarizarea pe nume (ro.ts);
    // poarta lastmod nu vede textele din ro.ts, deci data se ridică de mână.
    // 2 oct: nota benzii „Primii pași" trimite acum la fiecare modul pe nume;
    // banda de prețuri duce spre ofertă peste 20 de angajați (auditul SEO).
    // 6 oct: pagina de start refăcută — produsul pe ecrane reale, unelte, promisiuni (ro.ts).
    actualizat: "2026-10-06",
    sectiune: "Principale",
  },
  {
    cale: "/en",
    prioritate: 0.9,
    limba: "en",
    traducere: "/",
    // 2 oct: banda de prețuri duce spre ofertă (en.ts — poarta nu vede textele).
    // 6 oct: aceeași refacere, în en.ts.
    actualizat: "2026-10-06",
    sectiune: "Principale",
  },
  {
    cale: "/preturi",
    prioritate: 0.8,
    limba: "ro",
    traducere: "/en/preturi",
    // 6 oct: numele modulelor duc la pagina lor, fără slug afișat (pagina-preturi.tsx).
    actualizat: "2026-10-06",
    sectiune: "Principale",
  },
  {
    cale: "/en/preturi",
    prioritate: 0.7,
    limba: "en",
    traducere: "/preturi",
    // 2 oct: legătura spre ofertă și slug-urile din tabel (en.ts, pagina-preturi.tsx).
    // 6 oct: aceeași schimbare în tabel (pagina-preturi.tsx).
    actualizat: "2026-10-06",
    sectiune: "Principale",
  },
  {
    cale: "/module",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    // 6 oct: trei puncte fără acoperire în cod, scoase; actorii fără chei interne (ro.ts).
    actualizat: "2026-10-06",
    sectiune: "Principale",
  },
  {
    cale: "/pontaj-pe-telefon",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-02",
    sectiune: "Principale",
  },
  {
    cale: "/pentru-contabili",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    // 6 oct: pilotul numește modulele, nu „nucleul” (pentru-contabili.ts).
    actualizat: "2026-10-06",
    sectiune: "Principale",
  },
  {
    cale: "/cere-demo",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-18",
    sectiune: "Principale",
  },

  ...MODULE,

  // Prioritate mare, deliberat: sunt singurele pagini care pot câștiga o căutare
  // pe un domeniu fără vechime, fiindcă răspund la o întrebare precisă, cu
  // articolul de lege lângă fiecare afirmație.
  {
    // Hub-ul, primul din secțiune ca rândurile ei să rămână adiacente.
    cale: "/ghid",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-02",
    sectiune: "Obligații legale",
  },
  {
    cale: "/evidenta-orelor-de-munca",
    prioritate: 0.9,
    limba: "ro",
    traducere: null,
    actualizat: EVIDENTA_ORELOR.actualizatIso,
    sectiune: "Obligații legale",
  },
  {
    cale: "/reges-online",
    prioritate: 0.9,
    limba: "ro",
    traducere: null,
    actualizat: REGES.actualizatIso,
    sectiune: "Obligații legale",
  },
  {
    cale: "/ghid/control-itm",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: CONTROL_ITM.actualizatIso,
    sectiune: "Obligații legale",
  },
  {
    cale: "/ghid/concediu-de-odihna",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: CONCEDIU_ODIHNA.actualizatIso,
    sectiune: "Obligații legale",
  },
  {
    cale: "/ghid/diurna",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: DIURNA.actualizatIso,
    sectiune: "Obligații legale",
  },
  {
    cale: "/ghid/diurna-externa",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: DIURNA_EXTERNA.actualizatIso,
    sectiune: "Obligații legale",
  },
  {
    cale: "/ghid/ore-suplimentare",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: ORE_SUPLIMENTARE.actualizatIso,
    sectiune: "Obligații legale",
  },
  {
    cale: "/ghid/spor-de-noapte",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: SPOR_DE_NOAPTE.actualizatIso,
    sectiune: "Obligații legale",
  },

  {
    cale: "/domenii",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-17",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/constructii",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    // 2 oct: „Pe același subiect" din `legaturi.ts` — poarta compară domeniile cu
    // `domenii.ts`, deci nu vede schimbarea; data se ridică de mână, pe toate patru.
    actualizat: "2026-10-02",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/productie",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-02",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/transport",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-02",
    sectiune: "Domenii",
  },
  {
    cale: "/domenii/servicii",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    // 6 oct: calendarul echipei în locul pragului de absenți (domenii.ts).
    actualizat: "2026-10-06",
    sectiune: "Domenii",
  },

  {
    cale: "/unelte",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    // 6 oct: titlul și descrierea numesc toate cele șapte unelte.
    actualizat: "2026-10-06",
    sectiune: "Unelte și comparații",
  },
  // 5 oct 2026: toate uneltele primesc nodul `WebApplication`, a cărui
  // `dateModified` e chiar data de aici (`dataPaginii`); calculatorul, și nota
  // „informativ". Data se mută în același commit cu schimbarea paginii.
  {
    cale: "/unelte/foaie-de-pontaj",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-05",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/unelte/cerere-concediu-de-odihna",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-05",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/unelte/condica-de-prezenta",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-05",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/unelte/foaie-de-parcurs",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-05",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/unelte/fisa-instruire-ssm",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-05",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/unelte/fisa-evaluare",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-05",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/unelte/calculator-salariu",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-05",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/comparatie",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-18",
    sectiune: "Unelte și comparații",
  },
  {
    cale: "/comparatie/excel",
    prioritate: 0.6,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-02",
    sectiune: "Unelte și comparații",
  },

  {
    cale: "/incredere",
    prioritate: 0.6,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-17",
    sectiune: "Înainte să întrebi",
  },
  {
    cale: "/intrebari",
    prioritate: 0.6,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-02",
    sectiune: "Înainte să întrebi",
  },
  {
    cale: "/de-ce-nu",
    prioritate: 0.5,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-17",
    sectiune: "Înainte să întrebi",
  },

  {
    cale: "/legal/termeni",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-17",
    sectiune: "Legal",
  },
  {
    cale: "/legal/confidentialitate",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-17",
    sectiune: "Legal",
  },
];

/** Data `lastmod` a unei pagini din sitemap — aceeași cifră și în datele structurate. */
export function dataPaginii(cale: string): string {
  const pagina = PAGINI.find((p) => p.cale === cale);
  if (pagina === undefined) throw new Error(`Pagina ${cale} nu e în sitemap.`);
  return pagina.actualizat;
}

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
