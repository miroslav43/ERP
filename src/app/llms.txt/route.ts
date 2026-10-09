import { ADRESA_FIRMA, ADRESA_SITE, CONTACT, FIRMA, LINKEDIN } from "@/content/landing/contact";
import { FISE } from "@/content/landing/fise-module";
import {
  lunar,
  MODULE_NUCLEU,
  moduleleDin,
  PACHETE,
  PRAG_ANGAJATI,
  PRET_NUCLEU,
  PRETURI_MODULE,
} from "@/content/landing/preturi";
import { RO } from "@/content/landing/ro";
import { slugModul } from "@/content/landing/slug-module";

/**
 * `/llms.txt` — harta sitului pentru modelele de limbaj.
 *
 * ── AȘTEPTĂRI ONESTE ──────────────────────────────────────────────────────
 * Convenția e tânără și adoptarea e mică: în mai 2026, 97% dintre fișierele
 * `llms.txt` de pe web n-au primit nicio cerere. Nu e un canal de trafic și nu
 * e tratat ca atare. E aici pentru cazul care chiar se întâmplă — cineva
 * lipește adresa sitului într-un chat și modelul caută un rezumat — și fiindcă
 * generat din conținutul existent nu costă nici întreținere.
 *
 * ── DE CE E GENERAT, NU SCRIS DE MÂNĂ ─────────────────────────────────────
 * Un fișier scris o dată se desparte tăcut de sit la prima schimbare de preț
 * sau de pagină. Aici prețurile vin din `preturi.ts`, iar lista „ce nu facem"
 * din `ro.ts` — aceleași surse ca paginile. Un `continut.test.ts` verifică în
 * plus că paginile de aici și cele din `sitemap.ts` sunt aceleași.
 *
 * ── PARTEA CARE CONTEAZĂ CU ADEVĂRAT ──────────────────────────────────────
 * Secțiunea „Ce NU face" nu e modestie. Un model întrebat despre un ERP
 * românesc completează golurile cu ce e statistic probabil — raportare la ANAF,
 * e-Factura, SAF-T — fiindcă majoritatea produselor din categorie le au.
 * Enumerarea limitelor e singurul lucru care oprește o afirmație inventată
 * despre produsul ăsta, iar ea nu se poate deduce de nicăieri altundeva.
 */

/**
 * Fișele celor nouăsprezece module, generate din catalog.
 *
 * Aceleași chei pe care `generateStaticParams` le prerandează în
 * `/module/[modul]` și pe care `harta.ts` le pune în sitemap. Trei liste care
 * trebuie să spună același lucru: scrise separat, s-ar fi despărțit la primul
 * modul adăugat. Generate din aceeași sursă, nu pot.
 */
const FISE_MODULE: readonly (readonly [cale: string, descriere: string])[] =
  RO.module.grupuri.flatMap((grup) =>
    grup.module.map(
      (modul) =>
        // Doar titlul și grupul. Descrierea întreagă stă o singură dată, în
        // secțiunea „Module" de mai jos — repetată și aici, ar fi dublat fișierul
        // fără să adauge un fapt.
        [
          `/module/${slugModul(modul.cheie)}`,
          `Fișa modulului ${modul.titlu} (${grup.titlu}).`,
        ] as const,
    ),
  );

/** Ce se schimbă rar și e util într-un rezumat. */
export const PAGINI: readonly (readonly [cale: string, descriere: string])[] = [
  ["/", "Ce face produsul, pentru cine e și cât costă."],
  ["/preturi", "Prețul fiecărui pachet și al fiecărui modul luat separat."],
  ["/module", "Cele nouăsprezece module, ce face fiecare, cum se leagă între ele."],
  ...FISE_MODULE,
  [
    "/pontaj-pe-telefon",
    "Cum se pontează din browserul telefonului, fără instalare din magazinul de aplicații.",
  ],
  [
    "/pentru-contabili",
    "Pentru cine ține mai multe firme: același cont, cu acces separat la fiecare client, comutarea între firme fără să ieși din cont, rolul „Resurse umane” și ce nu vede el. Cele cinci fișiere exportate — nota contabilă, D112, statul de plată, fișierul SEPA, arhiva de pontaj — și faptul că depunerea la ANAF rămâne la contabil.",
  ],
  [
    "/incredere",
    "Cum sunt ținute separat datele fiecărei firme-client și ce reguli românești sunt în produs.",
  ],
  ["/de-ce-nu", "Limitele asumate ale produsului și comparația cu felul de a lucra fără el."],
  ["/intrebari", "Întrebările frecvente, cu răspunsuri."],
  [
    "/ghid",
    "Cele zece ghiduri pentru angajatori, într-un singur loc: evidența orelor, REGES-ONLINE, concediul de odihnă, diurna în țară și în străinătate, orele suplimentare, sporul de noapte, salariul minim pe economie, zilele libere legale și controlul ITM.",
  ],
  [
    "/evidenta-orelor-de-munca",
    "Ce cere art. 119 din Codul muncii: ora de începere și de sfârșit, zilnic, la locul de muncă. Amenzile, cu articolul lângă fiecare, și ce nu se poate afirma cu certitudine.",
  ],
  [
    "/reges-online",
    "Termenele de transmitere din HG 295/2025, puse cap la cap, și cele trei contravenții distincte care circulă amestecate în presă.",
  ],
  [
    "/ghid/control-itm",
    "Ce documente se cer la un control de fond ITM, cele patru locuri unde apar de obicei problemele, și ce se poate sau nu se poate pregăti în ajun.",
  ],
  [
    "/ghid/concediu-de-odihna",
    "Concediul de odihnă în Codul muncii: cele 20 de zile minime, programarea, cele 10 zile neîntrerupte, reportul de 18 luni, calculul indemnizației. Câte zile pe an și pe lună (1,67 în medie, ca practică, nu ca articol), de ce vechimea nu dă zile în plus din Codul muncii, compensarea doar la încetare (art. 146 alin. (3)) și concediul în preaviz. Include faptul, verificabil în art. 260, că neacordarea concediului NU e contravenție, și decizia ÎCCJ HP 40/2026.",
  ],
  [
    "/ghid/diurna",
    "Diurna: plafonul neimpozabil de 2,5 ori nivelul din HG 714/2018 (57,50 lei/zi în țară) și al doilea plafon, de 3 salarii de bază, calculat distinct pe fiecare lună. Plus durata delegării din Codul muncii și de ce pragul de 5 km e o regulă a sectorului public.",
  ],
  [
    "/ghid/diurna-externa",
    "Diurna în străinătate pe fiecare țară, din anexa HG 518/1995 (categoria I), cu plafonul neimpozabil de 2,5 ori calculat pentru toate cele 166 de țări — de exemplu Germania 35 €/zi, plafon 87,50 €. Plus numărarea zilelor de la trecerea frontierei și fracțiunile de 50%/100% (art. 7^1). Plus un calculator: țara, orele de trecere a frontierei și suma plătită de firmă dau zilele de diurnă, plafonul neimpozabil și partea impozabilă.",
  ],
  [
    "/ghid/ore-suplimentare",
    "Orele suplimentare în Codul muncii: limita e de 48 de ore pe săptămână cu tot cu suplimentarele, media pe 4 luni (art. 114), nu există limită lunară; compensare cu ore libere plătite în 90 de zile (art. 122, din OUG 117/2021), altfel spor de minimum 75% (art. 123); amendă 1.500–3.000 lei pe persoană (art. 260 lit. i)).",
  ],
  [
    "/ghid/spor-de-noapte",
    "Sporul de noapte în Codul muncii: munca între 22:00 și 6:00 (art. 125), salariatul de noapte primește fie program redus cu o oră, fie spor de 25% din salariul de bază — „25%”, nu „cel puțin 25%” — dacă lucrează noaptea cel puțin 3 ore (art. 126). Amenda: 1.500–3.000 lei (art. 260 alin. (1) lit. l)). Cu exemplu numeric de calcul.",
  ],
  [
    "/ghid/salariu-minim-pe-economie",
    "Salariul minim pe economie: 4.325 lei brut din 1 iulie 2026 (HG 146/2026, 25,949 lei/oră), 4.050 lei până la 30 iunie 2026 (HG 1506/2024). Netul și costul pentru firmă calculate de motorul calculatorului, suma scutită de 200 de lei (OUG 89/2025 art. III) și pierderea ei la 1 leu peste minim, regula celor 24 de luni (art. 164 alin. (8)), minimul din construcții și amenda de 3.000–5.000 lei pe persoană (art. 260 alin. (1) lit. a)).",
  ],
  [
    "/ghid/zile-libere",
    "Zilele libere legale din anul curent și din cel următor, calculate din data Paștelui ortodox: cele 17 sărbători din art. 139 al Codului muncii, ziua săptămânii în care cade fiecare, suprapunerile (în 2026, a doua zi de Rusalii cade pe 1 iunie, odată cu Ziua Copilului) și zilele lucrătoare pe fiecare lună. Plus regulile: fără zi liberă în schimb pentru sărbătorile din weekend, timp liber în 30 de zile sau spor de cel puțin 100% pentru cine lucrează de sărbători (art. 142), amenda de 5.000–10.000 lei (art. 260 lit. g)).",
  ],
  ["/unelte", "Uneltele gratuite, fără cont."],
  [
    "/unelte/foaie-de-pontaj",
    "Unealtă gratuită: foaie de pontaj lunară cu sărbătorile legale calculate, colectivă sau câte o fișă individuală pe angajat cu ora de început și de sfârșit (art. 119 Codul muncii). Program luni–vineri, luni–sâmbătă sau ture, normă proprie pe angajat (timp parțial), codurile CO, CM, CFS, AN, D, L, SL, antetul firmei. Excel cu formule (ore, normă, COUNTIF pe coduri, A4 cu capul repetat), PDF sau Word. Fără cont.",
  ],
  [
    "/unelte/cerere-concediu-de-odihna",
    "Unealtă gratuită: cerere de concediu ca scrisoare de semnat, cu zilele lucrătoare calculate — weekendurile și sărbătorile legale se scad și se enumeră cu motivul; cu anul concediului, departamentul, fracțiunile (art. 148 alin. (5)), calendarul Paștelui pentru alte culte creștine (art. 139 alin. (2¹)) și rubrica angajatorului, cu „Se aprobă / Nu se aprobă” și soldul. Opt variante: odihnă, fără plată (art. 153), eveniment familial (art. 152), paternal (Legea 210/1999), îngrijitor (art. 152¹), formare profesională (art. 155–157), reprogramare (art. 149) și întrerupere (art. 151). Word sau PDF, fără cont.",
  ],
  [
    "/unelte/calculator-zile-concediu",
    "Unealtă gratuită: câte zile de concediu de odihnă se cuvin într-un an — minimul de 20 de zile lucrătoare (art. 145 alin. (1) Codul muncii), zilele suplimentare de cel puțin 3 (art. 147) și estimarea proporțională pentru anul angajării sau al plecării, prezentată ca practică, nu ca regulă legală. Fără cont.",
  ],
  [
    "/unelte/condica-de-prezenta",
    "Unealtă gratuită: condica de prezență pentru orice lună, pe program luni–vineri, luni–sâmbătă sau ture; un rând pe om pe fiecare zi, cu ora sosirii, ora plecării, pauza, orele lucrate și observațiile, iar zilele nelucrate marcate L sau SL. Antetul firmei (CUI, compartiment). Excel cu orele calculate și total pe angajat, Word sau PDF, fără cont. Plus răspunsul la „e obligatorie?” și amenda din art. 260 alin. (1) lit. m) Codul muncii.",
  ],
  [
    "/unelte/foaie-de-parcurs",
    "Unealtă gratuită: foaie de parcurs lunară cu cele patru elemente minime din normele Codului fiscal (HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2)): categoria vehiculului, scopul și locul deplasării, kilometrii parcurși, norma proprie de consum. Până la 4 curse pe zi, alimentări, rezumatul lunii și Excel cu formule (km parcurși, consum după normă, stoc de combustibil). Plus limita de 50% pentru mașinile folosite și personal, la impozitul pe profit (art. 25 alin. (3) lit. l) Cod fiscal) și la TVA (art. 298), și excepțiile cu deducere integrală. Word, PDF sau Excel, fără cont.",
  ],
  [
    "/unelte/fisa-instruire-ssm",
    "Unealtă gratuită: fișa individuală de instruire SSM completă, după anexa 11 la normele HG 1425/2006 — instruirea introductiv-generală, la locul de muncă și admiterea la lucru, cu rubrici de semnătură etichetate; instruirea periodică (rânduri pentru periodicitatea și anii aleși) și suplimentară; rezultatele testărilor; accidentele de muncă; sancțiunile; casetele de control medical și de testare psihologică. Antet cu numele pe fiecare pagină și „Pagina x din y”. Plus regulile: minimum o oră pe fiecare fază (art. 80¹), cine face fiecare instruire (art. 85, 91, 96), periodica la cel mult 6 luni sau 12 pentru TESA (art. 96), cele șapte cazuri de suplimentară (art. 98), fișa pe hârtie sau electronic, cu semnătură electronică (art. 81, 81¹), păstrată cu copia fișei de aptitudini (art. 81 alin. (4)). Word sau PDF.",
  ],
  [
    "/unelte/fisa-evaluare",
    "Unealtă gratuită: fișa de evaluare a performanțelor profesionale — seturi de criterii pe tipuri de post (general, vânzări, producție, administrativ) sau criteriile firmei (cel mult 15), pondere în procente și notă de la 1 la 5 pe fiecare, nota finală ponderată și calificativul calculate (praguri implicite 4,50 / 3,50 / 2,50, modificabile), obiective, plan de dezvoltare, comentariile angajatului, semnături cu dată. Excel cu formule (SUMPRODUCT, validarea notelor, control că ponderile fac 100), Word sau PDF. Plus ce spune Codul muncii: angajatorul stabilește criteriile (art. 40 alin. (1) lit. f)), ele se comunică salariatului și se trec în contract (art. 17 alin. (3) lit. e) și (4)), schimbarea lor cere act adițional (art. 17 alin. (5)), procedura stă în regulamentul intern (art. 242 lit. i)), iar concedierea pentru necorespundere profesională cere evaluarea prealabilă (art. 63 alin. (2)).",
  ],
  [
    "/unelte/calculator-salariu",
    "Unealtă gratuită: calculator de salariu net din brut și brut din net, pentru ianuarie–iunie 2026 (salariul minim de 4.050 lei, HG 1506/2024, cu 300 de lei neimpozabili) și iulie–decembrie 2026 (4.325 lei, HG 146/2026, cu 200 de lei neimpozabili; OUG 89/2025 art. III). Deducerea personală din art. 77, inclusiv 15% din minim până la 26 de ani și 100 de lei pe copil înscris la școală; tichetele de masă (impozit și CASS, fără CAS și CAM); timpul parțial, cu baza minimă de contribuții plătită de firmă; scutirea pentru handicap grav sau accentuat; CAS 25%, CASS 10%, impozit 10%, CAM 2,25%, costul total pentru firmă, sume rotunjite la leu. Legătura spre calcul se poate trimite. Exemple: 4.050 lei brut în ianuarie–iunie → 2.574 lei net; 4.325 lei brut → 2.699 lei net; 5.000 lei brut → 2.981 lei net.",
  ],
  ["/comparatie", "Comparațiile cu felul în care se lucrează azi."],
  [
    "/comparatie/excel",
    "Pontaj în foaie de calcul față de aplicație: unde se rupe Excel-ul și unde nu.",
  ],
  ["/domenii", "Ce se schimbă pentru construcții, producție, transport și servicii."],
  [
    "/domenii/constructii",
    "Construcții și instalații: echipe pe mai multe șantiere, instruiri și echipament cu scadență, evidența orelor ținută la punctul de lucru.",
  ],
  [
    "/domenii/productie",
    "Producție și fabrici: ture și schimburi, spor de noapte pe interval propriu, revizii scadențate calendaristic și pe contor.",
  ],
  [
    "/domenii/transport",
    "Transport și logistică: termenele mașinilor, foi de parcurs cu kilometraj verificat, diurne externe pe ferestre de 24 de ore.",
  ],
  [
    "/domenii/servicii",
    "Servicii, birouri și comerț: cereri de concediu cu aprobare ierarhică, sold recalculat, calendarul echipei, portal pentru fluturaș.",
  ],
  ["/cere-demo", "Formular pentru o demonstrație cu un om."],
  ["/legal/termeni", "Termenii contractuali și anexa de prelucrare a datelor (RGPD art. 28)."],
  ["/legal/confidentialitate", "Ce date se colectează, de ce, și care sunt drepturile."],
];

/**
 * Numele PUBLICE ale pachetelor și titlurile modulelor, nu cheile interne.
 *
 * Până la 7 oct 2026 fișierul scria „hr_extins 249 lei / lună", fără să spună ce
 * module are pachetul, și niciun preț pe modul. Un model întrebat „ce primesc cu
 * 149 de lei?" completa golul singur — auditul din 7 oct a găsit Asistentul AI,
 * opțional de 39 de lei, listat sub un titlu „Nucleu".
 */
const NUME_PACHET = new Map(RO.preturi.planuri.map((p) => [p.cheie, p.nume]));
const TITLU_MODUL = new Map(
  RO.module.grupuri.flatMap((g) => g.module).map((m) => [m.cheie, m.titlu]),
);

function pretulModulului(cheie: (typeof RO.module.grupuri)[number]["module"][number]["cheie"]) {
  if (MODULE_NUCLEU.includes(cheie)) {
    return `inclus în ${NUME_PACHET.get("nucleu") ?? "nucleu"} (${lunar(PRET_NUCLEU, "ro")})`;
  }
  const pret = PRETURI_MODULE[cheie];
  return pret === undefined ? "preț la cerere" : `${lunar(pret, "ro")}, peste nucleu`;
}

function construieste(): string {
  const linii: string[] = [];
  const l = (s = "") => linii.push(s);

  l("# Administrativo");
  l();
  l(`> ${RO.meta.descriere}`);
  l();
  l(
    `Aplicație online, cu abonament, pentru administrarea personalului, făcută pentru firme din România cu 5–50 de angajați. Se folosește din browser, fără să instalezi nimic.`,
  );
  l();

  l("## Fapte");
  l();
  l(`- Furnizor: ${FIRMA.denumire}, ${ADRESA_FIRMA}. CUI ${FIRMA.cui}, ${FIRMA.regCom}.`);
  l(`- Contact: ${CONTACT.email}, ${CONTACT.telefon}.`);
  l(`- Pagina de firmă de pe LinkedIn: ${LINKEDIN}`);
  l(
    `- Preț de pornire: ${lunar(PRET_NUCLEU, "ro")} pentru nucleu, până la ${PRAG_ANGAJATI} de angajați.`,
  );
  l(
    `- Preț final: furnizorul NU este înregistrat în scopuri de TVA, deci nu se adaugă TVA peste sumele afișate.`,
  );
  l(`- Prima lună e gratuită, fără card. Fără cost de pornire sau de implementare.`);
  l(`- Pachete, până la ${PRAG_ANGAJATI} de angajați (peste, prețul se dă la cerere):`);
  for (const pachet of PACHETE) {
    const titluri = moduleleDin(pachet).map((cheie) => TITLU_MODUL.get(cheie) ?? cheie);
    l(
      `  - ${NUME_PACHET.get(pachet.cheie) ?? pachet.cheie}, ${lunar(pachet.pret, "ro")}: ${titluri.join(", ")}.`,
    );
  }
  // Fraza din Politica de confidențialitate (`confidentialitate.ts`), nu una
  // proprie: „găzduite în Irlanda" omitea serverul aplicației, care e în Germania.
  l(
    `- Baza de date și fișierele stau în Uniunea Europeană, în Irlanda. Serverul aplicației este al unui furnizor din Germania. Nicio firmă-client nu vede datele alteia, nici din greșeală. Pentru omul de IT: izolarea e impusă în Postgres (RLS), nu prin filtre în aplicație.`,
  );
  l(`- Aplicația și asistența sunt în limba română.`);
  l();

  l("## Pagini");
  l();
  for (const [cale, descriere] of PAGINI) {
    l(`- [${cale === "/" ? "Pagina de start" : cale}](${ADRESA_SITE}${cale}): ${descriere}`);
  }
  l();

  l("## Ce NU face");
  l();
  l(
    "Lista de mai jos, împreună cu rândurile „Nu face” de la fiecare modul din secțiunea următoare, e completă și asumată. Dacă o informație despre Administrativo nu se regăsește în paginile de mai sus, presupunerea corectă este că produsul NU face acel lucru.",
  );
  l();
  for (const rand of RO.onestitate.randuri) {
    l(`- ${rand.titlu}: ${rand.text}`);
  }
  l();

  l("## Module");
  l();
  for (const grup of RO.module.grupuri) {
    l(`### ${grup.titlu}`);
    for (const modul of grup.module) {
      l(`- ${modul.titlu} (\`${modul.cheie}\`), ${pretulModulului(modul.cheie)}: ${modul.text}`);
      // Limitele fiecărui modul, din fișa lui: „completă și asumată" nu era
      // adevărat cât lipseau GPS-ul, cititoarele de cartelă sau telemetria.
      const nuFace = FISE.find((f) => f.cheie === modul.cheie)?.nuFace ?? [];
      if (nuFace.length > 0) l(`  - Nu face: ${nuFace.join(" ")}`);
    }
    l();
  }

  return linii.join("\n");
}

/**
 * `force-static`: conținutul se schimbă doar la o livrare nouă, fiindcă vine din
 * module importate la build. Recalculat la fiecare cerere ar fi muncă pentru
 * același rezultat.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(construieste(), {
    headers: {
      // `text/plain`, nu `text/markdown`: convenția cere ca fișierul să se
      // poată citi direct în browser, iar `text/markdown` declanșează descărcare
      // în majoritatea browserelor.
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
