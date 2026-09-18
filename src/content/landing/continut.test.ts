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

/**
 * Sursa proxy-ului, ca text.
 *
 * Se citește, nu se importă: `proxy.ts` trage după el clientul Supabase și
 * `next/server`, iar verificările de aici n-au nevoie de niciunul.
 */
const PUBLICE = readFileSync("src/proxy.ts", "utf8");

/**
 * Lista albă din `proxy.ts`, PARSATĂ, nu căutată ca subșir.
 *
 * Ancorat pe `=`, nu pe prima paranteză dreaptă: adnotarea de tip e
 * `readonly string[]`, deci un `[^[]*` s-ar opri la paranteza DIN TIP și ar
 * captura un literal gol. Lista goală ar face testul de linkuri să treacă și
 * pe cel de sitemap să cadă — adică exact invers decât pare.
 *
 * Parserul stă la nivel de modul fiindcă e folosit din două `describe`-uri.
 * Cel de-al doilea (vitrina) se mulțumea cu o potrivire de subșir pe toată
 * sursa: `"/vitrina"` rămas într-un COMENTARIU, după o reorganizare a listei,
 * ar fi ținut testul verde în timp ce `estePublica` nu mai potrivea nimic —
 * proxy-ul ar fi dat 307, iar chenarul de pe pagina de vânzare ar fi afișat
 * formularul de autentificare.
 */
const RUTE_PUBLICE = [
  ...(PUBLICE.match(/const RUTE_PUBLICE[^=]*=\s*\[([\s\S]*?)\n\]/)?.[1] ?? "").matchAll(
    /"(\/[^"]*)"/g,
  ),
].map((m) => m[1] ?? "");

/** Aceeași regulă ca `estePublica()` din proxy: egalitate sau prefix cu bară. */
const estePublica = (cale: string): boolean =>
  cale === "/" || RUTE_PUBLICE.some((r) => cale === r || cale.startsWith(`${r}/`));

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

describe("fișele de modul nu promit ce nu există", () => {
  /**
   * Codul aplicației, fără stratul de conținut.
   *
   * Excluderea lui `src/content` e esențială: fișele însele conțin cheile, iar
   * fără excludere testul s-ar potrivi cu propria sursă și ar trece întotdeauna.
   */
  const COD_APLICATIE = [...fisiere("src/app", [".ts", ".tsx"]), ...fisiere("src/lib", [".ts"])]
    .filter((f) => !f.startsWith("src/content/"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it("fiecare permisiune din tabel e verificată undeva în aplicație", async () => {
    /*
     * Tabelele de roluri au fost scrise din `role_permissions`, unde stau
     * valorile efective. Dar baza acordă mai mult decât verifică aplicația: opt
     * chei — `attendance:export`, `attendance:delete`, `ssm:approve`,
     * `ssm:export`, `ssm:delete`, `payroll:delete`, `vehicles:export`,
     * `per_diem:export` — sunt acordate unor roluri și nu sunt cerute de niciun
     * fișier din `src/`.
     *
     * Publicate ca rânduri de tabel, ar fi promis funcții care nu există: un
     * export de pontaj și o ștergere de pontaj pe care nimeni nu le poate
     * apăsa. Prima variantă a fișelor chiar le conținea.
     *
     * Testul ăsta e singurul lucru care leagă ce SCRIEM pe pagină de ce FACE
     * aplicația. Un grant nou în bază nu-l trece; îl trece doar o funcție reală.
     */
    const { FISE } = await import("./fise-module");
    expect(FISE.length, "nicio fișă").toBeGreaterThan(0);

    for (const fisa of FISE) {
      for (const actiune of fisa.actiuni) {
        expect(
          COD_APLICATIE.includes(`"${actiune.cheie}"`),
          `${fisa.cheie}: „${actiune.ce}" promite ${actiune.cheie}, dar nicio pagină și nicio acțiune n-o verifică`,
        ).toBe(true);
      }
    }
  });

  it("modulele și legăturile lor sunt chei reale din catalog", async () => {
    const { FISE } = await import("./fise-module");
    for (const fisa of FISE) {
      expect(isFeatureKey(fisa.cheie), `fișă pentru un modul inexistent: ${fisa.cheie}`).toBe(true);
      for (const legatura of fisa.legaturi) {
        expect(
          isFeatureKey(legatura.catre),
          `${fisa.cheie} trimite către modulul inexistent ${legatura.catre}`,
        ).toBe(true);
        expect(legatura.catre, `${fisa.cheie} se leagă de el însuși`).not.toBe(fisa.cheie);
      }
    }
  });

  it("fiecare fișă are destul conținut propriu ca să merite indexată", () => {
    /*
     * Pragul nu e o cifră magică: paginile au pornit de la ~39 de cuvinte
     * proprii, iar la volumul ăla verdictul obișnuit în Search Console e
     * „crawled, currently not indexed". 250 e pragul sub care o fișă nouă,
     * scrisă în grabă, ar readuce exact problema pentru care există fișele.
     */
    return import("./fise-module").then(({ FISE }) => {
      for (const fisa of FISE) {
        const cuvinte = [
          ...fisa.intro,
          fisa.cazDeUtilizare ?? "",
          fisa.leadRoluri ?? "",
          fisa.leadLegaturi ?? "",
          fisa.notaPermisiuni,
          ...fisa.legaturi.map((l) => l.text),
          ...fisa.nuFace,
        ]
          .join(" ")
          .split(/\s+/)
          .filter(Boolean).length;
        expect(cuvinte, `${fisa.cheie}: doar ${cuvinte} cuvinte proprii`).toBeGreaterThan(250);
      }
    });
  });

  it("pasajele care merită citate sunt destul de lungi ca să stea singure", async () => {
    /*
     * ── DE CE ────────────────────────────────────────────────────────────────
     * Un asistent citează un pasaj, nu o pagină. Auditul de azi a măsurat
     * răspunsurile din /intrebari la 24–66 de cuvinte și pașii de pe
     * /pontaj-pe-telefon la 35–95, niciunul în banda de 134–167 pe care o citează
     * de obicei motoarele generative — și, mai rău, niciunul nu-și spunea
     * subiectul: „Merge pe telefon?" răspundea fără cuvântul „pontaj" în prima
     * frază, deci lipit într-un răspuns nu spunea despre ce produs e vorba.
     *
     * Nu se umflă tot: vocea sitului e scurtă, iar o pagină de răspunsuri lungi
     * se citește mai greu. Se apără doar pasajele care decid o vânzare.
     */
    const { CUM_PONTEAZA } = await import("./pontaj-telefon");
    const cuvinte = (s: string) => s.split(/\s+/).filter(Boolean).length;

    const lungi = RO.intrebari.intrebari.filter((i) => cuvinte(i.a) >= 110);
    expect(
      lungi.length,
      `doar ${lungi.length} răspunsuri trec de 110 cuvinte — cele care decid o vânzare trebuie să stea singure`,
    ).toBeGreaterThanOrEqual(6);

    for (const pas of CUM_PONTEAZA.pasi) {
      expect(cuvinte(pas.text), `pasul „${pas.titlu}”`).toBeGreaterThanOrEqual(80);
    }

    /*
     * Aceeași bandă pentru pagina contabilului, cu o excepție declarată:
     * secțiunea de limite. Acolo scurtimea E mesajul — „nu depune nimic
     * nicăieri" nu câștigă nimic din încă șaptezeci de cuvinte, iar o limită
     * explicată pe larg începe să sune a scuză. Se apără doar cele două
     * secțiuni care decid o vânzare.
     */
    const { CONTUL_TAU, CE_PRIMESTI } = await import("./pentru-contabili");
    for (const sectiune of [CONTUL_TAU, CE_PRIMESTI]) {
      const lungimi = sectiune.pasi.map((p) => cuvinte(p.text));
      const subPrag = lungimi.filter((n) => n < 80).length;
      expect(
        subPrag,
        `„${sectiune.titlu}”: ${subPrag} pași sub 80 de cuvinte (${lungimi.join(", ")})`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("frazele fixe din șablon nu se întind peste tot situl", async () => {
    /*
     * ── DE CE ────────────────────────────────────────────────────────────────
     * Auditul din 17 sept 2026 a măsurat 34–40% n-grame comune între paginile de
     * modul din același grup. Vinovatul n-a fost conținutul propriu, ci șablonul:
     * banda „Din același grup" retipărea descrierea de catalog a fiecărui frate
     * (137–145 de cuvinte pe pagină), iar două lead-uri scrise în `page.tsx`
     * apăreau identic pe 18–19 pagini din 19.
     *
     * Textul fraților a fost scos; lead-urile au devenit câmpuri de fișă, cu
     * rezervă în șablon. Testul ține rezerva mică: dacă mai mult de cinci module
     * cad pe aceeași frază, ea a redevenit text sitewide și trebuie scrisă per
     * modul.
     */
    const { FISE } = await import("./fise-module");
    const sursa = readFileSync("src/app/(marketing)/module/[modul]/page.tsx", "utf8");

    expect(
      sursa.includes("text={vecin.text}"),
      "banda „Din același grup” retipărește iar descrierea fraților",
    ).toBe(false);

    const fara = (camp: "leadRoluri" | "leadLegaturi") =>
      FISE.filter((f) => f[camp] === undefined).length;
    for (const camp of ["leadRoluri", "leadLegaturi"] as const) {
      expect(
        fara(camp),
        `${camp}: ${fara(camp)} module cad pe fraza din șablon — scrie-le pe cele cu trafic țintit`,
      ).toBeLessThanOrEqual(15);
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

  /**
   * Potrivirea unei căi cu rutele găsite pe disc.
   *
   * O rută dinamică nu se poate compara ca șir: pe disc există un singur
   * director, `/domenii/[domeniu]`, iar în conținut apar patru adrese concrete.
   * Un segment între paranteze drepte se potrivește cu exact un segment, ca la
   * Next.
   *
   * Tiparul e mai permisiv decât realitatea — `dynamicParams = false` face ca
   * doar valorile din `generateStaticParams` să răspundă cu 200, nu orice
   * segment. De aceea potrivirea de aici răspunde doar la întrebarea „există
   * ruta?", iar faptul că slug-urile din hărți sunt EXACT cele generate se
   * verifică separat, mai jos.
   */
  const TIPARE_RUTE = [...RUTE].map(
    (ruta) => new RegExp(`^${ruta.replace(/\[[^\]]+\]/g, "[^/]+")}$`),
  );
  const existaRuta = (cale: string): boolean => TIPARE_RUTE.some((t) => t.test(cale));

  it("fiecare link intern din conținut are o pagină reală", () => {
    for (const [limba, text] of LIMBI) {
      const linkuri = [...JSON.stringify(text).matchAll(/"(\/[^"#]*)(?:#[^"]*)?"/g)]
        .map((m) => m[1] ?? "")
        .filter((href) => href !== "" && !href.startsWith("//"));
      for (const href of new Set(linkuri)) {
        const cale = href === "/" ? "/" : href.replace(/\/$/, "");
        expect(existaRuta(cale), `${limba}: ${href} nu are page.tsx`).toBe(true);
      }
    }
  });

  it("legăturile din fișe și din paginile-lege duc spre pagini din sitemap", async () => {
    /*
     * Testele de lângă scanează doar `RO` și `EN`. Legăturile din fișele de modul
     * (`ghiduri`) și din paginile-lege (`legaturaSecundara`, `legaturiConexe`)
     * stau în alte fișiere. Se compară cu sitemap-ul, nu cu tiparele de rută:
     * tiparul `/module/[modul]` ar accepta și `/module/attendance`, adresa veche
     * care acum e redirect.
     */
    const { ADRESA_SITE } = await import("./contact");
    const { intrariSitemap } = await import("./harta");
    const { FISE } = await import("./fise-module");
    const dinSitemap = new Set(intrariSitemap().map((i) => i.url.replace(ADRESA_SITE, "") || "/"));
    const pagini = [
      (await import("@/content/legal/reges")).REGES,
      (await import("@/content/legal/evidenta-orelor")).EVIDENTA_ORELOR,
      (await import("@/content/legal/control-itm")).CONTROL_ITM,
      (await import("@/content/legal/concediu-odihna")).CONCEDIU_ODIHNA,
      (await import("@/content/legal/diurna")).DIURNA,
    ];
    const linkuri = [
      ...FISE.flatMap((f) => (f.ghiduri ?? []).map((g) => [`fișa ${f.cheie}`, g.href] as const)),
      ...pagini.flatMap((p) =>
        [p.legaturaSecundara, ...(p.legaturiConexe ?? [])].map((l) => [p.cale, l.href] as const),
      ),
    ];
    expect(linkuri.length, "n-am găsit nicio legătură").toBeGreaterThan(5);
    for (const [sursa, href] of linkuri) {
      expect(dinSitemap.has(href), `${sursa}: ${href} nu e în sitemap`).toBe(true);
    }
  });

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
    const { intrariSitemap: sitemap } = await import("./harta");
    const { ADRESA_SITE } = await import("./contact");

    /*
     * Lista se IMPORTĂ, nu se mai citește ca text.
     *
     * Regexul peste sursă a funcționat cât timp fiecare intrare era un literal
     * scris de mână. Fișele celor nouăsprezece module se generează acum din
     * catalog, iar o cale construită prin interpolare nu apare nicăieri în
     * sursă ca șir — regexul le-ar fi ratat pe toate și ar fi raportat că
     * lipsesc din llms.txt, deși sunt acolo.
     */
    const { PAGINI: LLMS } = await import("@/app/llms.txt/route");
    const inLlms = new Set(LLMS.map(([cale]) => cale));
    const inSitemap = sitemap()
      .map((i) => i.url.replace(ADRESA_SITE, "") || "/")
      .filter((c) => !c.startsWith("/en"));

    for (const cale of inSitemap) {
      expect(inLlms.has(cale), `${cale} e în sitemap dar lipsește din llms.txt`).toBe(true);
    }
    for (const cale of inLlms) {
      expect(existaRuta(cale), `${cale} e în llms.txt dar n-are page.tsx`).toBe(true);
    }
  });

  it("fiecare pagină din sitemap e publică și există", async () => {
    // Un URL în sitemap care întoarce redirect e un raport de eroare în Search
    // Console și buget de crawl aruncat. Se verifică amândouă condițiile: să
    // aibă `page.tsx` și să treacă de proxy.
    const { ADRESA_SITE } = await import("./contact");
    const { intrariSitemap: sitemap } = await import("./harta");
    const cai = sitemap().map((intrare) => intrare.url.replace(ADRESA_SITE, "") || "/");

    expect(cai.length, "sitemap gol").toBeGreaterThan(0);
    for (const cale of cai) {
      expect(existaRuta(cale), `${cale} e în sitemap dar n-are page.tsx`).toBe(true);
      expect(estePublica(cale), `${cale} e în sitemap dar cere sesiune`).toBe(true);
    }
  });

  it("rândurile din sitemap vin grupate pe secțiuni, fără întreruperi", async () => {
    /*
     * Foaia de stil `sitemap.xsl` deduce eticheta grupei din prefixul adresei și
     * scrie un cap de grupă ori de câte ori eticheta rândului curent diferă de a
     * celui dinainte. Tiparul ăsta presupune că rândurile aceleiași secțiuni sunt
     * ADIACENTE.
     *
     * Dacă cineva adaugă o pagină de domeniu la coada listei, nu cade nimic și nu
     * se strică niciun XML: pagina randată capătă pur și simplu un al doilea cap
     * „Domenii" mai jos, ca și cum ar fi altă secțiune. Un defect pur vizual, pe
     * care nu-l vede nimeni până nu deschide fișierul în browser — adică rar.
     *
     * `sectiune` din `harta.ts` e sursa ordinii; testul verifică doar că ordinea
     * chiar e respectată.
     */
    const { intrariSitemap } = await import("./harta");
    const vazute = new Set<string>();
    let anterioara: string | null = null;

    for (const intrare of intrariSitemap()) {
      if (intrare.sectiune === anterioara) continue;
      expect(
        vazute.has(intrare.sectiune),
        `secțiunea „${intrare.sectiune}" reapare după ce s-a trecut la alta — ${intrare.url}`,
      ).toBe(false);
      vazute.add(intrare.sectiune);
      anterioara = intrare.sectiune;
    }
    expect(vazute.size, "nicio secțiune").toBeGreaterThan(1);
  });

  it("paginile de domeniu din hărți sunt exact cele generate", async () => {
    /*
     * Garanția pe care potrivirea cu tipar n-o poate da.
     *
     * `/domenii/[domeniu]` are `dynamicParams = false`, deci răspund cu 200
     * exact slug-urile din `generateStaticParams`, adică din `DOMENII`. Tiparul
     * `[^/]+` folosit mai sus ar accepta și `/domenii/orice`, iar o intrare
     * greșită în sitemap ar trece neobservată — un 404 trimis chiar de noi
     * motoarelor de căutare.
     *
     * Verificarea merge în ambele sensuri: nicio adresă inventată în hărți, și
     * niciun domeniu adăugat în conținut și uitat din ele.
     */
    const { DOMENII } = await import("./domenii");
    const { ADRESA_SITE } = await import("./contact");
    const { intrariSitemap: sitemap } = await import("./harta");

    const asteptate = new Set(DOMENII.map((d) => `/domenii/${d.slug}`));
    const dinSitemap = new Set(
      sitemap()
        .map((i) => i.url.replace(ADRESA_SITE, ""))
        .filter((c) => c.startsWith("/domenii/")),
    );
    const { PAGINI: LLMS } = await import("@/app/llms.txt/route");
    const dinLlms = new Set(LLMS.map(([cale]) => cale).filter((c) => c.startsWith("/domenii/")));

    expect(asteptate.size, "niciun domeniu definit").toBeGreaterThan(0);
    expect([...dinSitemap].sort()).toEqual([...asteptate].sort());
    expect([...dinLlms].sort()).toEqual([...asteptate].sort());
  });

  it("paginile de modul din hărți sunt exact cele din catalog", async () => {
    // Aceeași garanție ca la domenii, pe partea de module: `/module/[modul]`
    // prerandează slug-urile cheilor din catalog, iar hărțile trebuie să le
    // arate pe toate și numai pe ele.
    const { ADRESA_SITE } = await import("./contact");
    const { intrariSitemap: sitemap } = await import("./harta");
    const { PAGINI: LLMS } = await import("@/app/llms.txt/route");
    const { slugModul } = await import("./slug-module");

    const asteptate = new Set(
      RO.module.grupuri.flatMap((g) => g.module).map((m) => `/module/${slugModul(m.cheie)}`),
    );
    const dinSitemap = sitemap()
      .map((i) => i.url.replace(ADRESA_SITE, ""))
      .filter((c) => c.startsWith("/module/"));
    const dinLlms = LLMS.map(([cale]) => cale).filter((c) => c.startsWith("/module/"));

    expect(asteptate.size, "niciun modul în catalog").toBeGreaterThan(0);
    expect([...new Set(dinSitemap)].sort()).toEqual([...asteptate].sort());
    // llms.txt își generează lista de module din catalog, cu ancore; se compară
    // doar dacă listează pagini de modul ca rânduri proprii.
    if (dinLlms.length > 0) expect([...new Set(dinLlms)].sort()).toEqual([...asteptate].sort());
  });

  it("harta slug-urilor acoperă exact catalogul, cu adrese unice și ASCII", async () => {
    /*
     * `slug-module.ts` nu poate importa `FeatureKey` (îl citește `next.config.ts`,
     * fără alias și fără `lucide-react`), deci tipul nu mai păzește lista. O
     * face testul: un modul nou fără slug ar primi adresa cheii engleze, iar un
     * slug duplicat ar face două module să ceară aceeași pagină.
     */
    const { SLUG_MODUL, cheieDinSlug } = await import("./slug-module");
    expect(Object.keys(SLUG_MODUL).sort()).toEqual([...FEATURE_KEYS].sort());

    const sluguri = Object.values(SLUG_MODUL);
    expect(new Set(sluguri).size, "slug duplicat").toBe(sluguri.length);
    for (const [cheie, slug] of Object.entries(SLUG_MODUL)) {
      expect(slug, cheie).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(cheieDinSlug(slug), slug).toBe(cheie);
    }
  });

  it("titlurile randate încap în rezultatul de căutare, cu marca o singură dată", async () => {
    /*
     * ── DE CE ──────────────────────────────────────────────────────────────
     * Șablonul `"%s · Administrativo"` adaugă 17 caractere. Auditul din 17 sept
     * 2026 a găsit 15 din 19 titluri de modul între 83 și 100 de caractere
     * randate — motorul le taie pe la 60 — și patru pagini cu marca de două ori
     * („Ce nu face Administrativo · Administrativo”).
     */
    const SUFIX = " · Administrativo";
    const { FISE } = await import("./fise-module");
    const { DOMENII } = await import("./domenii");
    const statice = fisiere("src/app/(marketing)", ["page.tsx"]).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/\btitle: "([^"]+)"/g)].map(
        (m) => [f, m[1] ?? ""] as const,
      ),
    );
    const titluri = [
      ...FISE.map((f) => [`fișa ${f.cheie}`, f.titluPagina] as const),
      ...DOMENII.map((d) => [`domeniul ${d.slug}`, d.metaTitlu] as const),
      ...statice,
    ];
    expect(titluri.length).toBeGreaterThan(30);
    for (const [sursa, titlu] of titluri) {
      expect(`${titlu}${SUFIX}`.length, `${sursa}: „${titlu}”`).toBeLessThanOrEqual(65);
      expect(titlu, `${sursa}: marca e adăugată de șablon`).not.toMatch(/Administrativo/);
    }
  });

  it("descrierile fișelor nu se termină toate în aceeași propoziție", async () => {
    // 16 din 19 descrieri se terminau în „Cine ce poate face, pe roluri.” — o
    // propoziție care nu deosebea nicio pagină de alta în rezultatul de căutare.
    const { FISE } = await import("./fise-module");
    const finaluri = new Map<string, number>();
    for (const f of FISE) {
      const ultima = propozitii(f.metaDescriere).at(-1) ?? "";
      finaluri.set(ultima, (finaluri.get(ultima) ?? 0) + 1);
      expect(f.metaDescriere.length, f.cheie).toBeLessThanOrEqual(170);
    }
    for (const [propozitie, ori] of finaluri) {
      expect(ori, `„${propozitie}” încheie ${ori} descrieri`).toBeLessThanOrEqual(2);
    }
  });

  it("fiecare modul are fișă, cu data ultimei schimbări", async () => {
    // Data ajunge în `lastmod`. Fără fișă, modulul ar lua data de rezervă din
    // `harta.ts`, adică exact greșeala pe care câmpul a venit s-o repare.
    const { fisaModulului } = await import("./fise-module");
    for (const { cheie } of RO.module.grupuri.flatMap((g) => g.module)) {
      expect(fisaModulului(cheie)?.actualizat, cheie).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("fiecare pagină statică de marketing apare în sitemap", async () => {
    /*
     * ── DE CE ──────────────────────────────────────────────────────────────
     * Modulele și domeniile sunt păzite de testele de mai sus. Paginile scrise
     * o singură dată — `/pontaj-pe-telefon`, `/incredere` — nu erau: una nouă
     * putea fi publicată, legată și trecută prin proxy, dar absentă tăcut din
     * `sitemap.xml` și din `llms.txt`, cu `pnpm verify` verde. Rutele dinamice
     * (`[param]`) sunt acoperite de verificările de egalitate exactă.
     */
    const { ADRESA_SITE } = await import("./contact");
    const { intrariSitemap: sitemap } = await import("./harta");
    const dinSitemap = new Set(sitemap().map((i) => i.url.replace(ADRESA_SITE, "") || "/"));

    const statice = fisiere("src/app/(marketing)", ["page.tsx"])
      .map((f) => f.replace(/^src\/app\/\(marketing\)/, "").replace(/\/page\.tsx$/, "") || "/")
      .filter((cale) => !cale.includes("["));

    expect(statice.length, "n-am găsit paginile de marketing").toBeGreaterThan(10);
    for (const cale of statice) {
      expect(dinSitemap.has(cale), `${cale} are page.tsx dar lipsește din sitemap`).toBe(true);
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

describe("promisiuni contrazise de bază", () => {
  /**
   * `0112_concediu_doar_zi_intreaga.sql` interzice prin `check` orice altceva
   * decât `zi_intreaga`. Un text de vânzare care promite jumătăți de zi e o
   * minciună publicată, nu o inexactitate.
   */
  it("nu promite jumătăți de zi la concedii", () => {
    const modulRo = RO.module.grupuri.flatMap((g) => g.module).find((m) => m.cheie === "leave");
    const modulEn = EN.module.grupuri.flatMap((g) => g.module).find((m) => m.cheie === "leave");

    expect(modulRo).toBeDefined();
    expect(modulEn).toBeDefined();
    expect(`${modulRo?.text} ${modulRo?.puncte.join(" ")}`).not.toMatch(/jumăt/i);
    expect(`${modulEn?.text} ${modulEn?.puncte.join(" ")}`).not.toMatch(/half[- ]day/i);
  });
});

/**
 * Tot textul care ajunge la cititor sau la un motor: conținutul RO și EN (cu
 * secțiunea de onestitate inclusă), fișele de modul, titlurile și descrierile din
 * `metadata` ale paginilor de marketing și corpul generat al lui `/llms.txt`.
 *
 * ── DE CE TEXT LIVRAT, NU FIȘIERE ─────────────────────────────────────────
 * O scanare a surselor lovește comentariile — inclusiv cele care explică de ce o
 * formulare e interzisă — și chiar acest fișier de test. Descrierile construite
 * din constante (`${PRAG_ANGAJATI}`) se rezolvă înainte de verificare, altfel
 * regula pragului ar cădea pe o descriere corectă.
 */
function valoriText(nod: unknown, colectate: string[] = []): string[] {
  if (typeof nod === "string") colectate.push(nod);
  else if (Array.isArray(nod)) for (const x of nod) valoriText(x, colectate);
  else if (nod !== null && typeof nod === "object")
    for (const x of Object.values(nod)) valoriText(x, colectate);
  return colectate;
}

async function textLivrat(): Promise<readonly (readonly [sursa: string, text: string])[]> {
  const { FISE } = await import("./fise-module");
  const { GET: llms } = await import("@/app/llms.txt/route");

  const metadate = fisiere("src/app/(marketing)", ["page.tsx"]).flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/(?:title|description):\s*(?:"([^"]*)"|`([^`]*)`)/g)].map(
      (m) =>
        [
          f,
          (m[1] ?? m[2] ?? "")
            .replaceAll("${PRAG_ANGAJATI}", String(PRAG_ANGAJATI))
            .replace(/\$\{[^}]*\}/g, "X"),
        ] as const,
    ),
  );

  return [
    ...valoriText(RO).map((t) => ["ro.ts", t] as const),
    ...valoriText(EN).map((t) => ["en.ts", t] as const),
    ...valoriText(FISE).map((t) => ["fise-module.ts", t] as const),
    ...metadate,
    ["llms.txt", await llms().text()] as const,
  ];
}

/** Propozițiile unui text; suficient de fin pentru regulile de mai jos. */
const propozitii = (text: string): string[] =>
  text.split(/(?<=[.!?])\s+|\n+/).filter((p) => p.trim() !== "");

describe("un singur adevăr pe tot site-ul", () => {
  /*
   * ── DE CE ────────────────────────────────────────────────────────────────
   * Auditul SEO din 17 sept 2026 a găsit prețul publicat și negat în același
   * timp: H1-ul de pe /preturi spunea „149 de lei pe lună”, descrierea aceleiași
   * pagini — fragmentul afișat în Google — „Prețul se dă la cerere”, iar
   * /intrebari răspundea „De ce nu scrie prețul pe site? — ar fi un preț fals”.
   * Trei texte scrise în momente diferite, fiecare adevărat când a fost scris.
   * Un motor generativ le citește pe toate deodată și nu are cum să aleagă.
   */
  it("prețul nu e negat nicăieri", async () => {
    const negari = [
      /pre[țt] fals/i,
      /nu scrie pre[țt]ul/i,
      /false price/i,
      /no price on the site/i,
    ];
    for (const [sursa, text] of await textLivrat()) {
      for (const tipar of negari) {
        expect(tipar.test(text), `${sursa}: ${String(tipar)} în „${text.slice(0, 120)}”`).toBe(
          false,
        );
      }
    }
  });

  it("„la cerere” / „ofertă” la preț apare doar lângă pragul de angajați", async () => {
    // Oferta la cerere e legitimă PESTE prag; sub prag, prețul e publicat.
    const laCerere =
      /(pre[țt]|price|pricing)[^.]{0,80}(la cerere|ofert|on request|quote)|(la cerere|ofert|on request|quote)[^.]{0,80}(pre[țt]|price|pricing)/i;
    for (const [sursa, text] of await textLivrat()) {
      for (const propozitie of propozitii(text)) {
        if (!laCerere.test(propozitie)) continue;
        expect(
          new RegExp(`\\b${PRAG_ANGAJATI}\\b`).test(propozitie),
          `${sursa}: „${propozitie}” pune prețul la cerere fără pragul de ${PRAG_ANGAJATI}`,
        ).toBe(true);
      }
    }
  });

  /*
   * ── DE CE ────────────────────────────────────────────────────────────────
   * Transmiterea prin API-ul REGES merge în producție (confirmat 17 sept 2026).
   * Până atunci, pagina de modul spunea „direct din ERP, prin API-ul REGES”, iar
   * ghidul /reges-online, scris înainte ca integrarea să existe, spunea că
   * transmiterea „rămâne în platforma Inspecției Muncii” și că orice promisiune de
   * transmitere automată e „tot un export care se încarcă manual” — adică ne
   * acuza pe noi de ce afirmam două pagini mai încolo.
   *
   * Secțiunea de onestitate NU e scoasă din scanare, spre deosebire de lista
   * interzisă de mai sus: exact acolo stătea „Nu generăm fișierul oficial REVISAL”.
   */
  it("REGES: o singură afirmație despre transmitere", async () => {
    const livrat = await textLivrat();
    const afirma = livrat.some(([, text]) => /API-ul REGES|REGES API|prin API/i.test(text));
    expect(afirma, "afirmația despre transmiterea prin API a dispărut").toBe(true);

    const contrazic = [
      /r[ăa]m[âa]ne [îi]n platforma Inspec[țt]iei Muncii/i,
      /tot un export care se [îi]ncarc[ăa]/i,
      /fi[șs]ierul oficial REVISAL/i,
      /official REVISAL file/i,
    ];
    for (const [sursa, text] of livrat) {
      for (const tipar of contrazic) {
        expect(tipar.test(text), `${sursa}: ${String(tipar)}`).toBe(false);
      }
    }
  });

  it("publicul e același peste tot: firme cu 5–50 de angajați", async () => {
    // Titlul, meta, eroul și llms.txt spuneau 5–50; lead-ul paginii de start
    // spunea „douăzeci până la două sute de oameni”.
    const altPublic = /dou[ăa] sute de oameni|two hundred people/i;
    for (const [sursa, text] of await textLivrat()) {
      expect(altPublic.test(text), `${sursa}: „${text.slice(0, 120)}”`).toBe(false);
    }
  });

  it("numărul de module scris în litere e cel din catalog", async () => {
    /*
     * Catalogul are FEATURE_KEYS.length module. Meta paginii /module spunea
     * „șaptesprezece”, H1-ul de pe aceeași pagină „Nouăsprezece”, iar intro-ul
     * asistentului „douăzeci și două”. Se acceptă doar totalul, nucleul și
     * diferența dintre ele — singurele trei numere care descriu oferta.
     */
    const permise = new Set([
      FEATURE_KEYS.length,
      MODULE_NUCLEU.length,
      FEATURE_KEYS.length - MODULE_NUCLEU.length,
    ]);
    const unitatiRo: Readonly<Record<string, number>> = {
      unu: 1,
      doi: 2,
      două: 2,
      trei: 3,
      patru: 4,
      cinci: 5,
      șase: 6,
      șapte: 7,
      opt: 8,
      nouă: 9,
    };
    const numeraleRo: Readonly<Record<string, number>> = {
      ...unitatiRo,
      zece: 10,
      unsprezece: 11,
      doisprezece: 12,
      douăsprezece: 12,
      treisprezece: 13,
      paisprezece: 14,
      cincisprezece: 15,
      șaisprezece: 16,
      șaptesprezece: 17,
      optsprezece: 18,
      nouăsprezece: 19,
      douăzeci: 20,
    };
    const unitatiEn: Readonly<Record<string, number>> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
    };
    const numeraleEn: Readonly<Record<string, number>> = {
      ...unitatiEn,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      sixteen: 16,
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
      twenty: 20,
    };
    const alt = (o: Readonly<Record<string, number>>) => Object.keys(o).join("|");
    // `\b` e ASCII în JavaScript: nu vede granița după „ă” din „două”.
    const tiparRo = new RegExp(
      `(?<!\\p{L})(${alt(numeraleRo)})(?:\\s+și\\s+(${alt(unitatiRo)}))?\\s+(?:de\\s+)?module(?!\\p{L})`,
      "giu",
    );
    const tiparEn = new RegExp(
      `(?<!\\p{L})(${alt(numeraleEn)})(?:-(${alt(unitatiEn)}))?\\s+modules(?!\\p{L})`,
      "giu",
    );
    const tiparCifre = /(?<!\d)(\d+)\s+(?:de\s+)?modules?(?!\p{L})/giu;

    for (const [sursa, text] of await textLivrat()) {
      const gasite = [
        ...[...text.matchAll(tiparRo)].map(
          (m) => (numeraleRo[(m[1] ?? "").toLowerCase()] ?? 0) + (unitatiRo[m[2] ?? ""] ?? 0),
        ),
        ...[...text.matchAll(tiparEn)].map(
          (m) => (numeraleEn[(m[1] ?? "").toLowerCase()] ?? 0) + (unitatiEn[m[2] ?? ""] ?? 0),
        ),
        ...[...text.matchAll(tiparCifre)].map((m) => Number(m[1])),
      ];
      for (const numar of gasite) {
        expect(permise.has(numar), `${sursa}: „${numar} module” nu e în catalog`).toBe(true);
      }
    }
  });

  it("titlul paginii (H1) nu e repetat de banda de sub el (H2)", () => {
    // Două titluri identice pe aceeași pagină risipesc singurul H2 care putea
    // acoperi o altă formulare a întrebării.
    for (const [limba, text] of LIMBI) {
      expect(text.pagini.intrebari.titlu, `${limba}: /intrebari`).not.toBe(text.intrebari.titlu);
      expect(text.pagini.incredere.titlu, `${limba}: /incredere`).not.toBe(text.izolare.titlu);
      expect(text.pagini.domenii.titlu, `${limba}: /domenii`).not.toBe(text.verticale.titlu);
    }
  });
});

describe("proxy-ul știe ce e aplicație și ce e public", () => {
  /*
   * ── DE CE ────────────────────────────────────────────────────────────────
   * Proxy-ul trimite la autentificare doar vizitatorul nelogat care cere un
   * segment din `SEGMENTE_APLICATIE`; orice altă cale primește răspunsul real al
   * paginii, inclusiv 404. Un modul nou din `(app)`, uitat în listă, ar da 404
   * celui nelogat în loc de login — și ar pierde `?redirect=`. Testul citește
   * folderele de pe disc: fiecare segment de nivel unu e fie public, fie al
   * aplicației, fie o rută tehnică, și niciodată două deodată.
   */
  it("fiecare segment de nivel unu are exact o clasă", async () => {
    const { SEGMENTE_APLICATIE } = await import("@/config/routes");
    const aplicatie = new Set<string>(SEGMENTE_APLICATIE);
    const publice = new Set(RUTE_PUBLICE.map((r) => r.split("/")[1] ?? ""));
    const tehnice = new Set(["api", "healthz", "readyz", "llms.txt", "sitemap.xml", "sitemap.xsl"]);

    const foldere = (cale: string) =>
      readdirSync(cale, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
        .map((d) => d.name);
    const segmente = foldere("src/app").flatMap((nume) =>
      nume.startsWith("(") ? foldere(join("src/app", nume)) : [nume],
    );
    expect(segmente.length, "n-am găsit niciun segment — s-a mutat src/app?").toBeGreaterThan(20);

    for (const segment of segmente) {
      const clase = [aplicatie.has(segment), publice.has(segment), tehnice.has(segment)].filter(
        Boolean,
      ).length;
      expect(clase, `/${segment}: în ${clase} clase (aplicație / public / tehnic)`).toBe(1);
    }
  });
});

describe("datele structurate spun ce spune pagina", () => {
  /*
   * ── DE CE ────────────────────────────────────────────────────────────────
   * Până la 17 sept 2026 site-ul avea un singur bloc JSON-LD, identic pe toate
   * paginile: `SoftwareApplication` fără `offers` și cu `operatingSystem: "Web,
   * Android, iOS"`, deși nu există aplicație în magazine. Nodurile pe pagină se
   * construiesc acum în `noduri-json-ld.ts`, din aceleași constante ca textul
   * vizibil; testele de mai jos leagă fiecare nod de sursa lui.
   */
  it("catalogul de prețuri are exact pachetele din tabelul canonic, în ambele limbi", async () => {
    const { nodCatalogPreturi } = await import("@/app/(marketing)/_componente/noduri-json-ld");
    const iduri = new Set<string>();
    for (const [limba, text] of LIMBI) {
      const catalog = nodCatalogPreturi(text);
      iduri.add(catalog["@id"]);
      expect(
        catalog.itemListElement.map((o) => o.price),
        limba,
      ).toEqual(PACHETE.map((p) => p.pret));
      for (const oferta of catalog.itemListElement) {
        expect(oferta.priceCurrency, limba).toBe("RON");
        expect(oferta.name, `${limba}: nume de plan lipsă`).not.toMatch(
          /^(nucleu|hr_extins|operational|financiar|tot)$/,
        );
        expect(oferta.eligibleQuantity.maxValue, limba).toBe(PRAG_ANGAJATI);
      }
    }
    expect(iduri.size, "RO și EN au nevoie de @id diferit").toBe(LIMBI.length);
  });

  it("oferta agregată a aplicației e intervalul real al pachetelor", async () => {
    const { ofertaAgregata } = await import("@/app/(marketing)/_componente/noduri-json-ld");
    const oferta = ofertaAgregata();
    expect(oferta.lowPrice).toBe(Math.min(...PACHETE.map((p) => p.pret)));
    expect(oferta.highPrice).toBe(Math.max(...PACHETE.map((p) => p.pret)));
    expect(oferta.offerCount).toBe(PACHETE.length);
  });

  it("articolele legale poartă data verificării și adresa unei pagini din sitemap", async () => {
    const { nodArticol } = await import("@/app/(marketing)/_componente/noduri-json-ld");
    const { ADRESA_SITE } = await import("./contact");
    const { intrariSitemap } = await import("./harta");
    const dinSitemap = new Set(intrariSitemap().map((i) => i.url));
    const pagini = [
      (await import("@/content/legal/reges")).REGES,
      (await import("@/content/legal/evidenta-orelor")).EVIDENTA_ORELOR,
      (await import("@/content/legal/control-itm")).CONTROL_ITM,
      (await import("@/content/legal/concediu-odihna")).CONCEDIU_ODIHNA,
      (await import("@/content/legal/diurna")).DIURNA,
    ];
    for (const pagina of pagini) {
      const articol = nodArticol(pagina);
      expect(articol.datePublished, pagina.cale).toBe(pagina.publicatIso);
      for (const data of [articol.datePublished, articol.dateModified]) {
        expect(data, pagina.cale).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      /*
       * Un articol nu poate fi modificat ÎNAINTE de a fi publicat.
       *
       * Nu e o ipoteză: `/evidenta-orelor-de-munca` are textele verificate pe
       * 3 septembrie și fișierul intrat în depozit pe 4. Copiate ca atare, cele
       * două date produceau exact imposibilitatea asta. `nodArticol` emite cea
       * mai târzie dintre ele ca `dateModified`, fără să falsifice niciuna.
       */
      expect(
        articol.dateModified >= articol.datePublished,
        `${pagina.cale}: modificat (${articol.dateModified}) înainte de publicat (${articol.datePublished})`,
      ).toBe(true);
      // Când verificarea e ulterioară publicării, ea e cea care se emite.
      if (pagina.actualizatIso >= pagina.publicatIso) {
        expect(articol.dateModified, pagina.cale).toBe(pagina.actualizatIso);
      }
      expect(dinSitemap.has(articol.url), `${articol.url} nu e în sitemap`).toBe(true);
      expect(articol.url.startsWith(ADRESA_SITE)).toBe(true);
      // Google trunchiază `headline` peste 110 caractere.
      expect(articol.headline.length, pagina.cale).toBeLessThanOrEqual(110);
    }
  });

  it("firimiturile duc doar spre pagini care există", async () => {
    const { nodFirimituri } = await import("@/app/(marketing)/_componente/noduri-json-ld");
    const { ADRESA_SITE } = await import("./contact");
    const { intrariSitemap } = await import("./harta");
    const dinSitemap = new Set(intrariSitemap().map((i) => i.url.replace(ADRESA_SITE, "") || "/"));
    // Traseele folosite de paginile care trimit firimituri.
    const sursa = [
      readFileSync("src/app/(marketing)/module/[modul]/page.tsx", "utf8"),
      readFileSync("src/app/(marketing)/domenii/[domeniu]/page.tsx", "utf8"),
    ].join("\n");
    const fixe = [...sursa.matchAll(/href: "(\/[^"]*)"/g)].map((m) => m[1] ?? "");
    expect(fixe.length, "n-am găsit traseele fixe").toBeGreaterThan(0);
    for (const cale of fixe) {
      expect(dinSitemap.has(cale), `firimitură spre ${cale}, absentă din sitemap`).toBe(true);
    }

    const nod = nodFirimituri([
      { eticheta: "Acasă", href: "/" },
      { eticheta: "Module", href: "/module" },
    ]);
    expect(nod.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(nod.itemListElement[1]?.item).toBe(`${ADRESA_SITE}/module`);
  });

  it("serializarea nu poate închide eticheta <script> și nodurile n-au text de umplutură", async () => {
    const noduri = await import("@/app/(marketing)/_componente/noduri-json-ld");
    expect(noduri.serializeaza({ x: "</script><b>" })).not.toContain("<");

    const toate = JSON.stringify([
      noduri.ofertaAgregata(),
      ...LIMBI.map(([, text]) => noduri.nodCatalogPreturi(text)),
    ]);
    expect(toate).not.toMatch(
      /\[(Business Name|City|Phone|Address|URL|Email)\]|REPLACE|TODO|DE COMPLETAT/,
    );
  });
});

describe("furnizorii externi sunt numiți în documentele legale", () => {
  /*
   * ── DE CE ────────────────────────────────────────────────────────────────
   * Anexa de prelucrare din termeni afirma „Nu există un transfer în afara
   * Spațiului Economic European” și numea doar Supabase și Resend — în timp ce
   * asistentul trimitea întrebările la OpenRouter, iar notificările plecau prin
   * Expo. Nimeni n-a mințit: lista a fost corectă la redactare, iar codul a
   * crescut după. Testul leagă lista de cod: orice host extern apelat dintr-un
   * literal din `src/` e ori numit în documentul potrivit, ori scutit aici, cu
   * motivul scris. Un furnizor nou face testul roșu până cineva decide unde se
   * declară.
   *
   * „anexa” = atinge datele Clientului (subîmputernicit, `termeni.ts` A5);
   * „politica” = doar vizitatori sau furnizori aleși de Client
   * (`confidentialitate.ts`).
   */
  const FURNIZORI: Readonly<Record<string, readonly [nume: string, unde: "anexa" | "politica"]>> = {
    "openrouter.ai": ["OpenRouter", "anexa"],
    "exp.host": ["Expo", "anexa"],
    "api.resend.com": ["Resend", "anexa"],
    "www.googletagmanager.com": ["Google Analytics", "politica"],
    "www.youtube.com": ["YouTube", "politica"],
    "www.youtube-nocookie.com": ["YouTube", "politica"],
    "vimeo.com": ["Vimeo", "politica"],
    "player.vimeo.com": ["Vimeo", "politica"],
    "www.loom.com": ["Loom", "politica"],
    "webservicesp.anaf.ro": ["ANAF", "politica"],
    "api.inspectiamuncii.ro": ["Inspecția Muncii", "politica"],
    "sso.inspectiamuncii.ro": ["Inspecția Muncii", "politica"],
    // Portalul public, legat din ghidul /reges-online.
    "reges.inspectiamuncii.ro": ["Inspecția Muncii", "politica"],
    "api.dev.inspectiamuncii.org": ["Inspecția Muncii", "politica"],
    "sso.dev.inspectiamuncii.org": ["Inspecția Muncii", "politica"],
  };
  const SCUTITE: Readonly<Record<string, string>> = {
    "administrativo.ro": "domeniul propriu",
    "schema.org": "identificatorul vocabularului JSON-LD, nu o cerere de rețea",
    "fonts.googleapis.com":
      "fontul imaginii Open Graph, descărcat de server la generare; nu trimite date de vizitator",
    "legislatie.just.ro":
      "legătură în afară către textul de lege, pe care o apasă cititorul; nu primește date de la noi",
  };

  it("fiecare host extern apelat din cod e numit sau scutit cu motiv", async () => {
    const { SECTIUNI_ANEXA } = await import("@/content/legal/termeni");
    const { SECTIUNI_CONFIDENTIALITATE } = await import("@/content/legal/confidentialitate");
    const documente = {
      anexa: JSON.stringify(SECTIUNI_ANEXA),
      politica: JSON.stringify(SECTIUNI_CONFIDENTIALITATE),
    };

    // Doar literalii de șir: un URL dintr-un comentariu nu e o cerere.
    const hosturi = new Set(
      fisiere("src", [".ts", ".tsx"])
        .filter((f) => !/\.test\.tsx?$/.test(f))
        .flatMap((f) => [
          ...readFileSync(f, "utf8").matchAll(/["'`]https:\/\/([a-z0-9.-]+\.[a-z]{2,})/g),
        ])
        .map((m) => m[1] ?? ""),
    );
    expect(hosturi.size, "scanarea n-a găsit niciun host — s-a rupt tiparul").toBeGreaterThan(5);

    for (const host of hosturi) {
      if (host in SCUTITE) continue;
      const furnizor = FURNIZORI[host];
      expect(
        furnizor,
        `${host}: furnizor nou — numește-l în anexa termenilor sau în politica de confidențialitate și adaugă-l aici`,
      ).toBeDefined();
      if (furnizor === undefined) continue;
      const [nume, unde] = furnizor;
      expect(documente[unde].includes(nume), `${host}: „${nume}” lipsește din ${unde}`).toBe(true);
    }
  });

  it("politica de confidențialitate nu mai are marcaje de schelet", async () => {
    const { AVERTISMENT_CONFIDENTIALITATE, SECTIUNI_CONFIDENTIALITATE } =
      await import("@/content/legal/confidentialitate");
    const text = JSON.stringify([AVERTISMENT_CONFIDENTIALITATE, SECTIUNI_CONFIDENTIALITATE]);
    expect(text).not.toMatch(/DE COMPLETAT|DE CONFIRMAT|DE REDACTAT/);
  });
});

describe("vitrina", () => {
  /**
   * O rută publică ABSENTĂ din `RUTE_PUBLICE` nu dă 404 și nu dă eroare: dă un
   * 307 către autentificare, pentru vizitator ȘI pentru robotul de indexare.
   * Pe `/module/leave`, chenarul „Ecran real" ar fi afișat atunci formularul de
   * autentificare — al aplicației, în mijlocul paginii de vânzare.
   *
   * ── DE CE NU O POTRIVIRE DE SUBȘIR ────────────────────────────────────────
   * Testul căuta până acum `/"\/vitrina"/` în TOT textul proxy-ului. Un
   * `"/vitrina"` rămas într-un comentariu după o reorganizare a listei l-ar fi
   * ținut verde exact în cazul pe care trebuie să-l prindă. Se refolosește
   * parserul de la nivelul modulului — cel ancorat pe `=` — și, mai important,
   * se pune întrebarea reală: ce răspunde `estePublica` pentru adresa pe care o
   * cere efectiv iframe-ul.
   */
  it("este înregistrată ca rută publică în proxy", () => {
    expect(RUTE_PUBLICE.length, "nu s-a putut citi RUTE_PUBLICE din proxy.ts").toBeGreaterThan(5);
    expect(RUTE_PUBLICE).toContain("/vitrina");
    // Adresa cerută de `<iframe src>` nu e prefixul, ci ruta concretă.
    expect(estePublica("/vitrina/leave"), "chenarul ar afișa ecranul de autentificare").toBe(true);
  });
});
