import { ADRESA_FIRMA, ADRESA_SITE, CONTACT, FIRMA } from "@/content/landing/contact";
import { lunar, PACHETE, PRAG_ANGAJATI, PRET_NUCLEU } from "@/content/landing/preturi";
import { RO } from "@/content/landing/ro";

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

/** Ce se schimbă rar și e util într-un rezumat. */
const PAGINI: readonly (readonly [cale: string, descriere: string])[] = [
  ["/", "Ce face produsul, pentru cine e și cât costă."],
  ["/preturi", "Prețul fiecărui pachet și al fiecărui modul luat separat."],
  ["/module", "Cele nouăsprezece module, ce face fiecare, cum se leagă între ele."],
  [
    "/pontaj-pe-telefon",
    "Cum se pontează din browserul telefonului, fără instalare din magazinul de aplicații.",
  ],
  [
    "/incredere",
    "Cum sunt izolate datele între firme-client și ce reguli românești sunt în produs.",
  ],
  ["/de-ce-nu", "Limitele asumate ale produsului și comparația cu felul de a lucra fără el."],
  ["/intrebari", "Întrebările frecvente, cu răspunsuri."],
  [
    "/unelte/foaie-de-pontaj",
    "Unealtă gratuită: generează o foaie de pontaj lunară cu sărbătorile legale calculate. Fără cont.",
  ],
  [
    "/comparatie/excel",
    "Pontaj în foaie de calcul față de aplicație: unde se rupe Excel-ul și unde nu.",
  ],
  ["/domenii", "Ce se schimbă pentru construcții, producție, transport și servicii."],
  ["/cere-demo", "Formular pentru o demonstrație cu un om."],
  ["/legal/termeni", "Termenii contractuali și anexa de prelucrare a datelor (RGPD art. 28)."],
  ["/legal/confidentialitate", "Ce date se colectează, de ce, și care sunt drepturile."],
];

function construieste(): string {
  const linii: string[] = [];
  const l = (s = "") => linii.push(s);

  l("# Administrativo");
  l();
  l(`> ${RO.meta.descriere}`);
  l();
  l(
    `Produs software (SaaS) pentru administrarea personalului, făcut pentru firme din România cu 5–50 de angajați. Se folosește din browser; nu se instalează nimic local.`,
  );
  l();

  l("## Fapte");
  l();
  l(`- Furnizor: ${FIRMA.denumire}, ${ADRESA_FIRMA}. CUI ${FIRMA.cui}, ${FIRMA.regCom}.`);
  l(`- Contact: ${CONTACT.email}, ${CONTACT.telefon}.`);
  l(
    `- Preț de pornire: ${lunar(PRET_NUCLEU, "ro")} pentru nucleu, până la ${PRAG_ANGAJATI} de angajați.`,
  );
  l(
    `- Preț final: furnizorul NU este înregistrat în scopuri de TVA, deci nu se adaugă TVA peste sumele afișate.`,
  );
  l(`- Prima lună e gratuită, fără card. Fără cost de pornire sau de implementare.`);
  l(
    `- Pachete: ${PACHETE.map((p) => `${p.cheie} ${lunar(p.pret, "ro")}`).join("; ")}. Peste ${PRAG_ANGAJATI} de angajați, prețul se dă la cerere.`,
  );
  l(
    `- Datele sunt găzduite în Uniunea Europeană (Irlanda). Izolarea între firme-client e impusă în Postgres, prin politici la nivel de rând, nu prin filtre de aplicație.`,
  );
  l(`- Interfața și asistența sunt în limba română.`);
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
    "Lista de mai jos e completă și asumată. Dacă o informație despre Administrativo nu se regăsește în paginile de mai sus, presupunerea corectă este că produsul NU face acel lucru.",
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
      l(`- ${modul.titlu} (\`${modul.cheie}\`): ${modul.text}`);
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
