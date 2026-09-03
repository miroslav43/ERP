import { ADRESA_SITE, CONTACT, FIRMA } from "@/content/landing/contact";

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

/**
 * Serializare sigură pentru interiorul unui `<script>`.
 *
 * Fără înlocuirea lui `<`, un șir de date care ar conține `</script>` ar închide
 * eticheta mai devreme și restul JSON-ului ar ajunge text vizibil în pagină — sau,
 * mai rău, marcaj executabil. `<` e echivalent în JSON și inert în HTML.
 */
function serializeaza(date: unknown): string {
  return JSON.stringify(date).replace(/</g, "\\u003c");
}

const ORGANIZATIE = {
  "@type": "Organization",
  "@id": `${ADRESA_SITE}/#organizatie`,
  name: "Administrativo",
  legalName: FIRMA.denumire,
  url: ADRESA_SITE,
  // `public/marca.svg` era singurul fișier din `public/` și nu-l folosea nimeni:
  // declarația `icons` din layout-ul rădăcină care îl numea era suprascrisă de
  // `icon.tsx`. Aici e o cale stabilă, servită, care nu depinde de hash-ul pus
  // de Next pe rutele de metadate generate.
  logo: `${ADRESA_SITE}/marca.svg`,
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
} as const;

const SITE = {
  "@type": "WebSite",
  "@id": `${ADRESA_SITE}/#site`,
  url: ADRESA_SITE,
  name: "Administrativo",
  inLanguage: "ro-RO",
  publisher: { "@id": ORGANIZATIE["@id"] },
} as const;

const APLICATIE = {
  "@type": "SoftwareApplication",
  "@id": `${ADRESA_SITE}/#aplicatie`,
  name: "Administrativo",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Human Resources",
  operatingSystem: "Web, Android, iOS",
  url: ADRESA_SITE,
  inLanguage: ["ro-RO", "en-GB"],
  publisher: { "@id": ORGANIZATIE["@id"] },
  // `offers` se adaugă odată cu prețurile publice, din tabelul canonic — nu
  // scris de mână aici. Un preț în două locuri e un preț care ajunge greșit
  // într-unul din ele.
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
