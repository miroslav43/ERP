import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FEATURE_KEYS, isFeatureKey } from "@/config/features";

import {
  MODULE_NUCLEU,
  moduleleDin,
  PACHETE,
  PRAG_ANGAJATI,
  PRETURI_MODULE,
  sumaSeparat,
} from "./preturi";
import { ADRESA_FIRMA, CONTACT, FIRMA } from "./contact";
import { EN } from "./en";
import { RO } from "./ro";
import type { ContinutLanding } from "./tipuri";

const LIMBI: readonly (readonly [string, ContinutLanding])[] = [
  ["ro", RO],
  ["en", EN],
];

function fisiere(radacina: string, extensii: readonly string[]): string[] {
  const gasite: string[] = [];
  const mergi = (cale: string) => {
    for (const intrare of readdirSync(cale)) {
      const plin = join(cale, intrare);
      if (statSync(plin).isDirectory()) mergi(plin);
      // `join` dă `\` pe Windows, iar potrivirile de mai jos sunt scrise cu `/`:
      // fără normalizare, setul de rute iese gol și testul cade doar pe Windows.
      else if (extensii.some((ext) => plin.endsWith(ext))) gasite.push(plin.replaceAll("\\", "/"));
    }
  };
  mergi(radacina);
  return gasite;
}

const SURSE_MARKETING = [
  ...fisiere("src/content/landing", [".ts", ".tsx"]),
  ...fisiere("src/app/(marketing)", [".ts", ".tsx"]),
];

describe("landing-ul nu poate minți despre module", () => {
  it("fiecare modul numit pe pagină e o cheie reală din features.ts", () => {
    for (const [limba, text] of LIMBI) {
      for (const grup of text.module.grupuri) {
        for (const modul of grup.module) {
          expect(isFeatureKey(modul.cheie), `${limba}: ${modul.cheie}`).toBe(true);
        }
      }
    }
  });

  it("toate modulele din catalog apar pe pagină — niciunul uitat", () => {
    for (const [limba, text] of LIMBI) {
      const pePagina = text.module.grupuri.flatMap((g) => g.module.map((m) => m.cheie));
      expect(new Set(pePagina).size, `${limba}: duplicate`).toBe(pePagina.length);
      expect([...pePagina].sort(), limba).toEqual([...FEATURE_KEYS].sort());
    }
  });

  it("cifra afișată în banda de dovadă e chiar numărul de module din catalog", () => {
    /*
     * Trei cifre au coexistat pe aceeași pagină pentru același lucru: banda de
     * dovadă spunea 14, titlul secțiunii de module spunea „cincisprezece”, iar
     * catalogul de dedesubt randa șaptesprezece rânduri. Niciuna nu era greșită
     * când a fost scrisă — au rămas în urmă pe rând, la fiecare modul adăugat,
     * fiindcă nimic nu le lega de sursă.
     *
     * Testele de mai sus verificau deja CATALOGUL. Cifra din vitrină nu era
     * verificată de nimic, deci era singura care putea minți fără să cadă nimic.
     */
    for (const [limba, text] of LIMBI) {
      const rand = text.dovada.randuri.find((r) => /^(module|modules)$/i.test(r.eticheta));
      expect(rand, `${limba}: banda de dovadă n-are rândul de module`).toBeDefined();
      expect(rand?.valoare, limba).toBe(String(FEATURE_KEYS.length));
    }
  });

  it("pachetele conțin doar module reale, iar nucleul e în toate", () => {
    for (const pachet of PACHETE) {
      for (const cheie of moduleleDin(pachet)) {
        expect(isFeatureKey(cheie), `${pachet.cheie}: ${cheie}`).toBe(true);
      }
      // Nucleul nu e opțiune: vine cu orice pachet.
      expect(moduleleDin(pachet), pachet.cheie).toContain("nucleu");
      // Și nu se repetă: `optionale` conține doar ce se adaugă PESTE nucleu.
      for (const cheie of pachet.optionale) {
        expect(MODULE_NUCLEU, `${pachet.cheie}: ${cheie} e deja în nucleu`).not.toContain(cheie);
      }
    }
  });

  it("pachetul complet conține fiecare modul din catalog", () => {
    /*
     * Testul de dinainte verifica o SCARĂ: fiecare plan îl conține pe cel de
     * dinainte. Invarianta aceea a încetat să descrie oferta — `hr_extins`,
     * `operational` și `financiar` sunt trei axe paralele peste același nucleu,
     * nu trepte. Ce a rămas adevărat, și e mai util, e că „toată aplicația”
     * chiar înseamnă toată aplicația: un modul nou adăugat în catalog și uitat
     * din pachetul complet ar fi vândut ca inclus fără să fie.
     */
    const tot = PACHETE.find((p) => p.cheie === "tot");
    expect(tot, "pachetul `tot` lipsește").toBeDefined();
    if (tot === undefined) return;
    expect([...moduleleDin(tot)].sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it("fiecare modul din catalog are ori preț, ori loc în nucleu", () => {
    // Un modul fără niciunul dintre cele două n-ar apărea pe `/preturi` decât ca
    // rând gol — și nu s-ar putea cumpăra.
    for (const cheie of FEATURE_KEYS) {
      const arePret = PRETURI_MODULE[cheie] !== undefined;
      const eInNucleu = (MODULE_NUCLEU as readonly string[]).includes(cheie);
      expect(arePret !== eInNucleu, `${cheie}: nici preț, nici nucleu (sau amândouă)`).toBe(true);
    }
  });

  it("înregistrarea self-serve pornește exact modulele pachetului de bază", () => {
    /*
     * Două locuri trebuie să spună același lucru: `MODULE_NUCLEU` de aici, care
     * decide ce SE VINDE la 149 lei, și lista din `0121_inregistrare_publica.sql`,
     * care decide ce SE PORNEȘTE la crearea contului.
     *
     * Despărțite, nu cade nimic — firma primește pur și simplu altceva decât a
     * citit pe pagină. Iar prima variantă a migrării chiar era despărțită:
     * activa doar `is_core`, adică singurul `nucleu`, deci un cont nou n-avea
     * nici pontaj, nici concedii, nici portal. Exact ce promite eroul.
     */
    const sql = readFileSync("supabase/migrations/0121_inregistrare_publica.sql", "utf8");
    const bloc = sql.slice(sql.indexOf("insert into public.organization_features"));
    const inLista = [...bloc.slice(0, 600).matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? "");

    for (const cheie of MODULE_NUCLEU) {
      // `nucleu` intră prin `is_core = true`, nu prin lista literală.
      if (cheie === "nucleu") continue;
      expect(inLista, `0121 nu pornește ${cheie}, deși e vândut în Nucleu HR`).toContain(cheie);
    }
  });

  it("reducerea afișată e reală: pachetul costă mai puțin decât suma modulelor", () => {
    for (const pachet of PACHETE) {
      const separat = sumaSeparat(pachet);
      expect(
        pachet.pret <= separat,
        `${pachet.cheie}: ${pachet.pret} > ${separat} — „reducerea” e o majorare`,
      ).toBe(true);
    }
  });
});

describe("engleza nu e o traducere pe jumătate", () => {
  it("are aceeași structură ca româna", () => {
    expect(EN.module.grupuri).toHaveLength(RO.module.grupuri.length);
    expect(EN.dovada.randuri).toHaveLength(RO.dovada.randuri.length);
    expect(EN.ecrane.randuri).toHaveLength(RO.ecrane.randuri.length);
    expect(EN.pontaj.livrate).toHaveLength(RO.pontaj.livrate.length);
    expect(EN.pontaj.viitoare).toHaveLength(RO.pontaj.viitoare.length);
    expect(EN.onestitate.randuri).toHaveLength(RO.onestitate.randuri.length);
    expect(EN.verticale.domenii).toHaveLength(RO.verticale.domenii.length);
    expect(EN.comparatie.perechi).toHaveLength(RO.comparatie.perechi.length);
    expect(EN.intrebari.intrebari).toHaveLength(RO.intrebari.intrebari.length);
    expect(EN.roluri.note).toHaveLength(RO.roluri.note.length);
    expect(EN.izolare.straturi).toHaveLength(RO.izolare.straturi.length);
    expect(EN.implementare.pasi).toHaveLength(RO.implementare.pasi.length);
    expect(EN.conformitate.carduri).toHaveLength(RO.conformitate.carduri.length);
  });

  it("niciun text nu a rămas netradus, identic cu româna", () => {
    // Numele proprii și cheile tehnice au voie să coincidă; frazele lungi, nu.
    const identice = RO.intrebari.intrebari.filter((intrebare, index) => {
      const pereche = EN.intrebari.intrebari[index];
      return pereche !== undefined && pereche.q === intrebare.q;
    });
    expect(identice).toHaveLength(0);
  });
});

describe("regulile de scriere ale paginii", () => {
  it("nicio sedilă turcească în tot stratul de marketing", () => {
    const cuSedila = SURSE_MARKETING.filter((f) =>
      /[\u015E\u015F\u0162\u0163]/.test(readFileSync(f, "utf8")),
    );
    expect(cuSedila).toEqual([]);
  });

  it("orice sumă scrisă în copy vine din tabelul canonic", () => {
    /*
     * ── DE CE S-A INVERSAT GARDA ────────────────────────────────────────────
     * Testul ăsta interzicea ORICE cifră urmată de „lei”, „RON” sau „EUR” în
     * conținut, iar planurile trebuiau să spună „preț la cerere”. Regula avea un
     * motiv bun cât timp nu exista ofertă publicată.
     *
     * Acum există, iar interdicția ar fi devenit o piedică. Ce rămâne de apărat
     * e altceva: ca o sumă scrisă în text să nu se despartă tăcut de sumele din
     * `preturi.ts`. O ofertă actualizată acolo și uitată în copy nu cade nicăieri
     * — pagina afișează în continuare tariful de anul trecut, cu aceeași
     * încredere.
     *
     * Se acceptă doar sumele care EXISTĂ în tabel: prețurile pachetelor,
     * prețurile modulelor, sumele calculate „în loc de”, și pragul de angajați.
     */
    const permise = new Set<number>([
      PRAG_ANGAJATI,
      ...PACHETE.map((p) => p.pret),
      ...PACHETE.map(sumaSeparat),
      ...Object.values(PRETURI_MODULE),
    ]);

    for (const [limba, text] of LIMBI) {
      const sume = [...JSON.stringify(text).matchAll(/(\d[\d.]*)\s*(lei|LEI|RON|EUR|€)\b/g)].map(
        (m) => Number((m[1] ?? "").replace(/\./g, "")),
      );
      for (const suma of sume) {
        expect(permise.has(suma), `${limba}: suma ${suma} nu există în preturi.ts`).toBe(true);
      }
    }
  });

  it("identitatea juridică e completă și e pe adresa proprie", () => {
    /*
     * Legea 365/2002 art. 5 cere denumirea, sediul, codul de înregistrare și
     * datele de contact „în formă clară, vizibil și permanent, în interiorul
     * paginii de web", pentru orice furnizor de servicii ale societății
     * informaționale — inclusiv B2B pur. Sancțiunea, art. 22: 1.000–100.000 lei.
     *
     * Testul nu apără doar litera legii. Un ERP care cere acces la datele de
     * personal ale unei firme, promovat de pe o adresă de Gmail, pierde la
     * întrebarea „e firmă reală?" înainte de a apuca să răspundă la ea.
     */
    expect(FIRMA.denumire).toMatch(/S\.?R\.?L\.?/i);
    expect(FIRMA.cui).toMatch(/^\d{2,10}$/);
    expect(FIRMA.regCom, "numărul din registrul comerțului").toMatch(/^J\d{2}\/\d+\/\d{4}$/);
    expect(ADRESA_FIRMA).toContain(FIRMA.oras);
    expect(CONTACT.email, "adresa trebuie să fie pe domeniul propriu").toMatch(
      /@administrativo\.ro$/,
    );
  });

  it("mențiunea de TVA însoțește prețurile, în ambele limbi", () => {
    // Sumele sunt FINALE — firma nu e înregistrată în scopuri de TVA. Fără
    // mențiune, cititorul presupune că se mai adaugă 21%, exact ca la concurență,
    // și ne citește cu o cincime mai scump decât suntem.
    for (const [limba, text] of LIMBI) {
      expect(text.preturi.mentiuneTva, limba).toMatch(/TVA|VAT/);
    }
  });

  it("nu promite nimic din lista interzisă", () => {
    /*
     * `asistent (AI|cu inteligen)` A FOST pe lista asta, și pe drept: pagina
     * declara în secțiunea de onestitate că nu există un asemenea asistent, iar
     * tiparul împiedica restul copy-ului să-l promită totuși.
     *
     * A fost scos pe 2026-08-31, când asistentul a fost livrat ca modul
     * `asistent`, cu comutator per firmă. Regula pe care o apăra testul —
     * „nu promitem ce nu avem" — rămâne; s-a schimbat doar ce avem. Secțiunea
     * de onestitate spune acum ce face și ce nu, exact cum promitea vechiul ei
     * text („când o să avem, o să scrie aici ce face și ce nu").
     */
    const interzise = [
      /conform legisla[țt]iei [îi]n vigoare/i,
      /ISO\s?27001/i,
      /facturare [șs]i [îi]ncas[ăa]ri/i,
      /[îi]ncearc[ăa] gratuit/i,
      /software (de salarizare )?certificat(?!\.)/i,
    ];
    // Se caută în TEXTUL LIVRAT, nu în fișier: comentariul care explică de ce o
    // formulare e interzisă conține chiar formularea, și n-are ce căuta pe ecran.
    //
    // Secțiunea de onestitate e SCOASĂ din scanare, fiindcă exact acolo numim
    // lucrurile pe care nu le avem: „Nu avem asistent cu inteligență
    // artificială" trebuie să rămână scris, nu interzis.
    for (const [limba, text] of LIMBI) {
      const { onestitate: _onestitate, ...restul } = text;
      const livrat = JSON.stringify(restul);
      for (const tipar of interzise) {
        expect(tipar.test(livrat), `${limba}: ${String(tipar)}`).toBe(false);
      }
    }
  });
});

describe("legăturile interne duc undeva", () => {
  const RUTE = new Set(
    fisiere("src/app", ["page.tsx"]).map((f) => {
      const cale = f
        .replace(/^src\/app/, "")
        .replace(/\/page\.tsx$/, "")
        .replace(/\/\([^)]+\)/g, "");
      return cale === "" ? "/" : cale;
    }),
  );

  const PUBLICE = readFileSync("src/proxy.ts", "utf8");

  it("fiecare link intern din conținut are o pagină reală", () => {
    for (const [limba, text] of LIMBI) {
      const linkuri = [...JSON.stringify(text).matchAll(/"(\/[^"#]*)(?:#[^"]*)?"/g)]
        .map((m) => m[1] ?? "")
        .filter((href) => href !== "" && !href.startsWith("//"));
      for (const href of new Set(linkuri)) {
        const cale = href === "/" ? "/" : href.replace(/\/$/, "");
        expect(RUTE.has(cale), `${limba}: ${href} nu are page.tsx`).toBe(true);
      }
    }
  });

  /**
   * Lista albă din `proxy.ts`, citită din sursă.
   *
   * Se citește ca text, nu se importă: `proxy.ts` trage după el clientul
   * Supabase și `next/server`, iar testul ăsta n-are nevoie de niciunul.
   */
  const RUTE_PUBLICE = [
    // Ancorat pe `=`, nu pe prima paranteză dreaptă: adnotarea de tip e
    // `readonly string[]`, deci un `[^[]*` se oprește la paranteza DIN TIP și
    // captează un literal gol. Lista goală ar face testul să treacă pentru
    // linkuri și să cadă pentru sitemap — adică exact invers decât pare.
    ...(PUBLICE.match(/const RUTE_PUBLICE[^=]*=\s*\[([\s\S]*?)\n\]/)?.[1] ?? "").matchAll(
      /"(\/[^"]*)"/g,
    ),
  ].map((m) => m[1] ?? "");

  /** Aceeași regulă ca `estePublica()` din proxy: egalitate sau prefix cu bară. */
  const estePublica = (cale: string): boolean =>
    cale === "/" || RUTE_PUBLICE.some((r) => cale === r || cale.startsWith(`${r}/`));

  it("fiecare link intern din conținut duce către o rută PUBLICĂ", () => {
    /*
     * Testul de dinainte verifica doar că lista albă conține patru rute scrise
     * de mână. Nu prindea cazul real: o pagină publică nouă, linkuită din subsol,
     * uitată din `RUTE_PUBLICE`.
     *
     * Simptomul e cel mai neplăcut cu putință, fiindcă nu e o eroare. Proxy-ul
     * întoarce 307 către autentificare: vizitatorul venit dintr-o căutare
     * primește un formular de login în locul paginii pe care o căuta, iar
     * robotul primește același lucru și indexează ecranul de autentificare în
     * locul conținutului. Nimic nu cade, nimic nu se logează.
     */
    expect(RUTE_PUBLICE.length, "nu s-a putut citi RUTE_PUBLICE din proxy.ts").toBeGreaterThan(5);
    for (const [limba, text] of LIMBI) {
      const linkuri = [...JSON.stringify(text).matchAll(/"(\/[^"#]*)(?:#[^"]*)?"/g)]
        .map((m) => m[1] ?? "")
        .filter((href) => href !== "" && !href.startsWith("//"));
      for (const href of new Set(linkuri)) {
        const cale = href === "/" ? "/" : href.replace(/\/$/, "");
        expect(estePublica(cale), `${limba}: ${href} cere sesiune — 307 spre autentificare`).toBe(
          true,
        );
      }
    }
  });

  it("llms.txt și sitemap-ul arată aceleași pagini", async () => {
    /*
     * Două hărți ale aceluiași sit, scrise în două locuri. Fără verificarea
     * asta, o pagină nouă ajunge în `sitemap.ts` — fiindcă acolo se uită
     * oricine adaugă o rută — și lipsește din `llms.txt`, care e mai ușor de
     * uitat. Rezultatul nu e o eroare, e o hartă incompletă dată exact
     * sistemelor care nu pot verifica singure ce lipsește.
     *
     * Excepțiile sunt DECLARATE, nu tăcute: `/en*` lipsește din llms.txt
     * fiindcă rezumatul e în română și o dublură în engleză n-ar adăuga nimic.
     */
    const { default: sitemap } = await import("@/app/sitemap");
    const { ADRESA_SITE } = await import("./contact");
    const sursa = readFileSync("src/app/llms.txt/route.ts", "utf8");

    /*
     * Se citește DOAR blocul `PAGINI`, iar căile se extrag fără să depindă de
     * formatare: prettier rupe o intrare lungă pe trei rânduri, iar un tipar
     * legat de `["` la început de pereche rata exact intrările lungi — adică
     * pe cele cu descrieri bogate, cele care contează.
     */
    const bloc = sursa.slice(sursa.indexOf("const PAGINI"), sursa.indexOf("function construieste"));
    const inLlms = new Set([...bloc.matchAll(/"(\/[^"]*)"/g)].map((m) => m[1] ?? ""));
    const inSitemap = sitemap()
      .map((i) => i.url.replace(ADRESA_SITE, "") || "/")
      .filter((c) => !c.startsWith("/en"));

    for (const cale of inSitemap) {
      expect(inLlms.has(cale), `${cale} e în sitemap dar lipsește din llms.txt`).toBe(true);
    }
    for (const cale of inLlms) {
      expect(RUTE.has(cale), `${cale} e în llms.txt dar n-are page.tsx`).toBe(true);
    }
  });

  it("fiecare pagină din sitemap e publică și există", async () => {
    // Un URL în sitemap care întoarce redirect e un raport de eroare în Search
    // Console și buget de crawl aruncat. Se verifică amândouă condițiile: să
    // aibă `page.tsx` și să treacă de proxy.
    const { ADRESA_SITE } = await import("./contact");
    const { default: sitemap } = await import("@/app/sitemap");
    const cai = sitemap().map((intrare) => intrare.url.replace(ADRESA_SITE, "") || "/");

    expect(cai.length, "sitemap gol").toBeGreaterThan(0);
    for (const cale of cai) {
      expect(RUTE.has(cale), `${cale} e în sitemap dar n-are page.tsx`).toBe(true);
      expect(estePublica(cale), `${cale} e în sitemap dar cere sesiune`).toBe(true);
    }
  });

  it("rutele de metadate sunt accesibile fără sesiune", () => {
    /*
     * Invarianta: robotul de previzualizare al oricărei aplicații de mesagerie —
     * WhatsApp, LinkedIn, Slack — nu are sesiune și nu va avea niciodată. Dacă
     * primește un redirect către autentificare în loc de imagine, linkul apare
     * gol oriunde e distribuit.
     *
     * Testul verifica până acum IMPLEMENTAREA: o listă `PREFIXE_METADATE` și un
     * `startsWith(prefix)` în corpul proxy-ului. Implementarea s-a schimbat —
     * rutele sunt excluse acum direct din `matcher`, deci nici nu mai ajung la
     * proxy, ceea ce e mai bine — iar testul a căzut fără ca invarianta să fie
     * încălcată. Un test legat de forma codului, nu de comportamentul lui.
     *
     * Acum verifică ce contează: numele rutelor apar undeva în lanțul care le
     * scutește de sesiune, oricare ar fi el.
     */
    for (const ruta of ["opengraph-image", "twitter-image", "icon", "apple-icon"]) {
      expect(PUBLICE, `${ruta} n-ar ajunge la robotul de previzualizare`).toContain(ruta);
    }
  });
});
