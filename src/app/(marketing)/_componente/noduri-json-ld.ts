import { ADRESA_SITE } from "@/content/landing/contact";
import { PACHETE, PRAG_ANGAJATI } from "@/content/landing/preturi";
import type { ContinutLanding } from "@/content/landing/tipuri";
import type { PaginaLege } from "@/content/legal/tipuri";

/**
 * Nodurile JSON-LD, ca funcții pure.
 *
 * ── DE CE SEPARAT DE COMPONENTE ───────────────────────────────────────────
 * Componentele doar serializează. Construcția stă aici ca testele să poată
 * verifica nodurile fără să randeze React: prețurile din catalog = `PACHETE`,
 * `dateModified` = `actualizatIso`, adresele din firimituri = rute care există.
 * Un nod construit în JSX s-ar fi putut verifica doar pe un build rulat.
 *
 * ── CUM SE LEAGĂ ÎNTRE ELE ────────────────────────────────────────────────
 * Organizația, situl și aplicația stau pe layout, în `date-structurate.tsx`, cu
 * `@id`-urile de mai jos. Nodurile unei pagini — catalogul de prețuri, articolul,
 * firimiturile — se referă la ele prin `@id`, nu le repetă.
 */

export const ID_ORGANIZATIE = `${ADRESA_SITE}/#organizatie`;
export const ID_SITE = `${ADRESA_SITE}/#site`;
export const ID_APLICATIE = `${ADRESA_SITE}/#aplicatie`;

/** Codul ISO 4217. `MONEDA` din `preturi.ts` e „lei”, pentru afișare. */
const MONEDA_ISO = "RON";

/**
 * Serializare sigură pentru interiorul unui `<script>`.
 *
 * Fără înlocuirea lui `<`, un șir de date care ar conține `</script>` ar închide
 * eticheta mai devreme și restul JSON-ului ar ajunge text vizibil în pagină — sau,
 * mai rău, marcaj executabil. `<` e echivalent în JSON și inert în HTML.
 */
export function serializeaza(date: unknown): string {
  return JSON.stringify(date).replace(/</g, "\\u003c");
}

/**
 * Oferta agregată a aplicației: intervalul pachetelor.
 *
 * `offers` pe `SoftwareApplication` cere `Offer` sau `AggregateOffer`, nu un
 * catalog. Pachetele individuale stau în catalogul de pe /preturi.
 */
export function ofertaAgregata() {
  const preturi = PACHETE.map((p) => p.pret);
  return {
    "@type": "AggregateOffer",
    priceCurrency: MONEDA_ISO,
    lowPrice: Math.min(...preturi),
    highPrice: Math.max(...preturi),
    offerCount: PACHETE.length,
    url: `${ADRESA_SITE}/preturi`,
  } as const;
}

/**
 * Catalogul pachetelor, pentru /preturi și /en/preturi.
 *
 * Numele vin din fișierul de limbă, sumele din `PACHETE`. Fără
 * `valueAddedTaxIncluded`: firma nu e plătitoare de TVA, deci nici „inclus”, nici
 * „exclus” nu descrie corect suma — e finală.
 */
export function nodCatalogPreturi(text: ContinutLanding) {
  const roman = text.limba === "ro";
  const url = `${ADRESA_SITE}${roman ? "/preturi" : "/en/preturi"}`;
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${url}#pachete`,
    name: roman ? "Pachetele Administrativo" : "Administrativo packages",
    url,
    itemListElement: PACHETE.map((pachet) => ({
      "@type": "Offer",
      name: text.preturi.planuri.find((p) => p.cheie === pachet.cheie)?.nume ?? pachet.cheie,
      price: pachet.pret,
      priceCurrency: MONEDA_ISO,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: pachet.pret,
        priceCurrency: MONEDA_ISO,
        // UN/CEFACT: „MON” = lună.
        unitCode: "MON",
      },
      eligibleQuantity: {
        "@type": "QuantitativeValue",
        maxValue: PRAG_ANGAJATI,
        unitText: roman ? "angajați" : "employees",
      },
      itemOffered: { "@id": ID_APLICATIE },
      seller: { "@id": ID_ORGANIZATIE },
    })),
  };
}

export type Firimitura = Readonly<{ eticheta: string; href: string }>;

/** Traseul vizibil din antet, ca `BreadcrumbList`. Ultimul element e pagina însăși. */
export function nodFirimituri(lista: readonly Firimitura[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: lista.map((f, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: f.eticheta,
      item: `${ADRESA_SITE}${f.href}`,
    })),
  };
}

/**
 * O pagină care explică o obligație legală, ca `Article`.
 *
 * Autorul e organizația, nu o persoană: textele nu au un autor numit, iar un nume
 * inventat ar fi o afirmație falsă despre expertiză. `datePublished` lipsește
 * deliberat — conținutul are doar data ultimei verificări, iar o dată de publicare
 * egală cu ea ar fi scrisă, nu știută.
 */
export function nodArticol(pagina: PaginaLege) {
  const url = `${ADRESA_SITE}${pagina.cale}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#articol`,
    headline: pagina.antet.titlu,
    description: pagina.antet.lead,
    dateModified: pagina.actualizatIso,
    inLanguage: "ro-RO",
    url,
    mainEntityOfPage: url,
    author: { "@id": ID_ORGANIZATIE },
    publisher: { "@id": ID_ORGANIZATIE },
    isPartOf: { "@id": ID_SITE },
  };
}
