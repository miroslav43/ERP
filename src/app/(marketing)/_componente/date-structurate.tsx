import { ADRESA_SITE, CONTACT, FIRMA, PROFILURI_PUBLICE } from "@/content/landing/contact";

import {
  ID_APLICATIE,
  ID_ORGANIZATIE,
  ID_SITE,
  ofertaAgregata,
  serializeaza,
} from "./noduri-json-ld";

/**
 * Datele structurate ale sitului public (JSON-LD).
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Comentariul din `content/landing/contact.ts` promitea de la început că datele
 * de contact „apar în trei locuri pe pagină — banda de contact, subsolul și
 * datele structurate pentru motoarele de căutare”. Al treilea loc n-a fost scris
 * niciodată; asta e el.
 *
 * ── CE AȘTEPTĂRI SUNT REZONABILE ──────────────────────────────────────────
 * NU citări mai multe în răspunsurile generative: testul controlat Ahrefs pe
 * 1.885 de pagini n-a găsit câștig, iar sistemele verificate nu citeau JSON-LD
 * la fetch direct. Câștigul real e dezambiguizarea de ENTITATE — „administrativo”
 * e cuvânt comun în italiană, spaniolă și portugheză, iar un motor care nu știe
 * că e o firmă din Timișoara nu are cum să lege pagina de marcă.
 *
 * ── CE NU SE PUNE AICI, DELIBERAT ─────────────────────────────────────────
 * `FAQPage` — rezultatele îmbogățite s-au retras la 7 mai 2026. `HowTo` — retras
 * din 2023. Ambele ar fi cod care pretinde că face ceva ce nu mai face nimic.
 * Se pun înapoi doar dacă Google le reintroduce, nu fiindcă apar într-un ghid.
 *
 * ── DE CE `<script>` ȘI NU `next/script` ──────────────────────────────────
 * `next/script` orchestrează ÎNCĂRCAREA de cod executabil — strategii, ordine,
 * `onLoad`. Aici nu se execută nimic: e un bloc de date pe care îl citește
 * parserul. Randat direct dintr-un Server Component, ajunge în HTML-ul livrat de
 * server, deci îl văd și crawlerele care nu execută JavaScript — GPTBot,
 * ClaudeBot, PerplexityBot, CCBot.
 */

// `serializeaza` și `@id`-urile stau în `noduri-json-ld.ts`: le folosesc și
// nodurile paginilor (catalogul de prețuri, articolele, firimiturile).

const ORGANIZATIE = {
  "@type": "Organization",
  "@id": ID_ORGANIZATIE,
  name: "Administrativo",
  legalName: FIRMA.denumire,
  // Cine e firma, într-o frază: fără ea, un motor care descrie entitatea
  // compune singur descrierea din fragmente (auditul din 7 oct 2026).
  description: `Administrativo e aplicația de administrare a personalului făcută de ${FIRMA.denumire}, din ${FIRMA.oras}, pentru firmele din România cu 5–50 de angajați: pontaj, concedii, dosare de personal, salarizare și REGES-ONLINE.`,
  url: ADRESA_SITE,
  // Raster, nu SVG: Google cere pentru `Organization.logo` o imagine PNG, JPG
  // sau WebP de cel puțin 112×112 (auditul SEO din 6 oct 2026, #14). Până atunci
  // aici stătea `/marca.svg`. `/apple-icon` e PNG de 180×180, răspunde 200 fără
  // sesiune (testul rutelor de metadate din `continut.test.ts`) și nu cere
  // hash-ul pe care Next îl pune doar în eticheta `<link>`.
  logo: `${ADRESA_SITE}/apple-icon`,
  // Codul de înregistrare fiscală, ca identificator verificabil. `vatID` NU se
  // declară: firma nu e înregistrată în scopuri de TVA, iar un `vatID` fals ar fi
  // o afirmație greșită despre o entitate juridică reală.
  taxID: FIRMA.cui,
  // Numărul din registrul comerțului, ca identificator secundar. `identifier` cu
  // `PropertyValue` e forma pe care schema.org o dă pentru coduri de registru
  // care nu au proprietate proprie.
  identifier: {
    "@type": "PropertyValue",
    name: "Registrul Comerțului",
    value: FIRMA.regCom,
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: FIRMA.strada,
    addressLocality: FIRMA.oras,
    addressRegion: FIRMA.judet,
    postalCode: FIRMA.codPostal,
    addressCountry: FIRMA.codTara,
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    telephone: CONTACT.telefonLegatura.replace("tel:", ""),
    email: CONTACT.email,
    availableLanguage: ["ro", "en"],
    areaServed: FIRMA.codTara,
  },
  ...(PROFILURI_PUBLICE.length > 0 ? { sameAs: [...PROFILURI_PUBLICE] } : {}),
} as const;

const SITE = {
  "@type": "WebSite",
  "@id": ID_SITE,
  url: ADRESA_SITE,
  name: "Administrativo",
  // SITUL are pagini în română și în engleză (`/en`); APLICAȚIA, doar în română.
  // Până la 7 oct 2026 cele două erau inversate.
  inLanguage: ["ro-RO", "en-GB"],
  publisher: { "@id": ORGANIZATIE["@id"] },
} as const;

const APLICATIE = {
  "@type": "SoftwareApplication",
  "@id": ID_APLICATIE,
  name: "Administrativo",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Human Resources",
  // A fost „Web, Android, iOS”. Nu există aplicație în magazine (secțiunea de
  // onestitate o spune), iar Android e un APK instalat manual; pe iOS nu există
  // nimic. Ce se folosește efectiv e aplicația web, instalabilă pe ecranul de start.
  operatingSystem: "Web",
  url: ADRESA_SITE,
  // Interfața aplicației e doar în română; engleza e numai pe sit.
  inLanguage: "ro-RO",
  publisher: { "@id": ORGANIZATIE["@id"] },
  // Intervalul pachetelor, calculat din tabelul canonic — nu scris de mână. Un
  // preț în două locuri e un preț care ajunge greșit într-unul din ele.
  offers: ofertaAgregata(),
} as const;

/** Un singur `@graph`, ca nodurile să se poată referi între ele prin `@id`. */
export function DateStructurate() {
  const graf = {
    "@context": "https://schema.org",
    "@graph": [ORGANIZATIE, SITE, APLICATIE],
  };

  return (
    <script
      type="application/ld+json"
      /*
       * `dangerouslySetInnerHTML` e singura cale prin care React scrie text brut
       * într-un `<script>` — altfel ar escapa conținutul și JSON-ul ar deveni
       * ilizibil pentru parser. Nu e periculos aici, și motivul e verificabil:
       * `graf` se construiește exclusiv din constante de modul, nu atinge nicio
       * intrare de utilizator și nicio valoare din baza de date, iar `<` e deja
       * escapat de `serializeaza`. Dacă vreodată ajunge aici o valoare care vine
       * din afară, regula se schimbă și afirmația asta trebuie rescrisă.
       */
      dangerouslySetInnerHTML={{ __html: serializeaza(graf) }}
    />
  );
}
