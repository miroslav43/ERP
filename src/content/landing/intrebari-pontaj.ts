import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";
import type { Amenda } from "@/content/legal/tipuri";
import { CODURI_LEGENDA } from "@/lib/unelte/coduri-pontaj";

/**
 * Întrebările și textele de lege de pe paginile foii de pontaj și ale condicii.
 *
 * ── DE UNDE VIN ───────────────────────────────────────────────────────────
 * Codul muncii, forma consolidată de pe legislatie.just.ro
 * (DetaliiDocument/128647, ultima consolidare listată: 27.04.2026), descărcat
 * cu curl și citit ca text pe 8 oct 2026: art. 112 alin. (1); art. 119 alin. (1)
 * și (2); art. 120 alin. (1); art. 122 alin. (1); art. 125 alin. (1); art. 126;
 * art. 134 alin. (1) și (3); art. 137 alin. (1)–(3); art. 142; art. 15¹ lit. d)
 * (cu excepția din art. 105 alin. (1) lit. c)); art. 260 alin. (1) lit. m) și e³).
 *
 * ── DE CE SUMELE NU SE SCRIU AICI ─────────────────────────────────────────
 * Amenzile se citesc din pagina evidenței orelor (`EVIDENTA_ORELOR`), după
 * temei. O corectură se face într-un singur loc; dacă pagina-lege își schimbă
 * temeiul, `amendaEvidenta` aruncă și testul pică — nu se afișează o sumă veche.
 */

export type IntrebareUnealta = Readonly<{
  q: string;
  a: string;
  /** Articolul pe care stă răspunsul, afișat mărunt sub el. */
  temei?: string;
  /** Un drum din răspuns spre unealtă, cu parametrii gata puși. */
  legatura?: Readonly<{ href: string; eticheta: string }>;
}>;

const TEMEI_AMENDA = { m: "lit. m)", e3: "lit. e³)" } as const;

export function amendaEvidenta(cheie: keyof typeof TEMEI_AMENDA): Amenda {
  const temei = TEMEI_AMENDA[cheie];
  const amenda = EVIDENTA_ORELOR.amenzi.find((a) => a.temei.includes(temei));
  if (amenda === undefined) {
    throw new Error(`Amenda cu temeiul „${temei}” lipsește din pagina evidenței orelor.`);
  }
  return amenda;
}

/** „10.000 – 15.000 lei, pentru fiecare persoană, plafon 200.000 lei” */
export function textAmenda(a: Amenda): string {
  return a.aplicare === undefined ? a.suma : `${a.suma}, ${a.aplicare}`;
}

const LIPSA = amendaEvidenta("m");
const PARTIAL = amendaEvidenta("e3");

export const ACOPERIRE_FOAIE =
  "Fișa individuală are ora de început și ora de sfârșit pe fiecare zi, deci acoperă art. 119 alin. (1). Foaia colectivă ține orele pe zi: e documentul pentru salarii și nu înlocuiește, singură, evidența cerută de art. 119.";

export const ACOPERIRE_CONDICA =
  "Condica are, pe fiecare zi și pentru fiecare om, ora sosirii și ora plecării — exact conținutul cerut de art. 119 alin. (1). Codul muncii nu impune un model anume, deci o condică ținută pe hârtie sau în Excel e la fel de valabilă.";

export const INTREBARI_FOAIE_PONTAJ: readonly IntrebareUnealta[] = [
  {
    q: "Ce coduri se trec în foaia de pontaj?",
    a: `În celula zilei se scrie numărul de ore lucrate. Când omul n-a lucrat, se scrie un cod: ${CODURI_LEGENDA.map(
      (c) => `${c.cod} pentru ${c.denumire}`,
    ).join(
      ", ",
    )}. Sunt codurile modulului de pontaj din aplicație, iar fișierul Excel le numără singur, pe fiecare om.`,
  },
  {
    q: "Cum se calculează norma lunară?",
    a: "Zilele lucrătoare ale lunii — de luni până vineri, fără sărbătorile legale — înmulțite cu orele pe zi. La normă întreagă sunt 8 ore pe zi și 40 pe săptămână. Pentru cine lucrează cu timp parțial, scrie norma după nume, cu o bară: „Ilie Maria | 4”; merge și lipit direct din Excel, cu numele și orele pe două coloane. Norma lunii se socotește pe zilele de luni până vineri oricum ar fi împărțit programul, inclusiv în ture.",
    temei: "art. 112 alin. (1) Codul muncii",
  },
  {
    q: "Foaia colectivă ajunge la un control ITM?",
    a: `Nu, singură. Legea cere, pentru fiecare salariat și fiecare zi, ora de începere și ora de sfârșit a programului, iar foaia colectivă are doar orele pe zi. Alege varianta individuală — o fișă pe angajat, cu ora de început, de sfârșit și pauza — sau condica de prezență. Lipsa evidenței se amendează cu ${LIPSA.suma}.`,
    temei: `art. 119 alin. (1); ${LIPSA.temei}`,
    legatura: { href: "?varianta=individuala#documentul", eticheta: "Fă fișele individuale" },
  },
  {
    q: "Ce trec pentru munca de sâmbătă, duminică sau de sărbători?",
    a: "Orele lucrate, ca în orice zi. Alege programul „Luni–sâmbătă” sau „Toate zilele (ture)”, ca zilele acelea să rămână deschise, fără cod de repaus. Repausul săptămânal e de 48 de ore consecutive, de regulă sâmbăta și duminica; când se dă în alte zile, salariații primesc un spor stabilit prin contractul colectiv sau individual. Pentru munca din zilele de sărbătoare legală se dă timp liber în următoarele 30 de zile, iar dacă nu se poate, un spor de cel puțin 100% din salariul de bază.",
    temei: "art. 137 și art. 142 Codul muncii",
    legatura: { href: "?program=ture#documentul", eticheta: "Vezi foaia pe ture" },
  },
  {
    q: "Cum se trec orele suplimentare și cele de noapte?",
    a: "În coloanele lor, separat de orele din program. Munca suplimentară e cea făcută peste durata normală a săptămânii și se compensează cu ore libere plătite în următoarele 90 de zile. Munca de noapte e cea dintre 22:00 și 6:00; pentru zilele cu cel puțin 3 ore de noapte, salariatul primește fie program redus cu o oră, fie un spor de 25% din salariul de bază.",
    temei: "art. 120 alin. (1), art. 122 alin. (1), art. 125 alin. (1) și art. 126 Codul muncii",
  },
  {
    q: "Ce face singur fișierul Excel?",
    a: "Adună orele pe om și pe zi, numără zilele de CO, CM, CFS, AN și D și calculează norma fiecăruia. Codurile se aleg dintr-o listă, iar la tipărire capul de tabel se repetă pe fiecare pagină A4. În fișa individuală, orele lucrate ies din ora de început, cea de sfârșit și pauză, inclusiv pentru tura care trece de miezul nopții. Orele care trec de norma unui angajat cu timp parțial se colorează cu roșu.",
  },
  {
    q: "Ce risc dacă un angajat cu timp parțial lucrează peste normă?",
    a: `Depășirea timpului de muncă din contractul cu timp parțial e muncă nedeclarată, chiar dacă omul are contract, în afara cazurilor de forță majoră sau de lucrări urgente. Amenda e de ${textAmenda(PARTIAL)}. Evidența orelor e chiar proba, de aceea fișierul Excel semnalează depășirea.`,
    temei: PARTIAL.temei,
  },
];

export const INTREBARI_CONDICA: readonly IntrebareUnealta[] = [
  {
    q: "Condica electronică e valabilă la control?",
    a: "Codul muncii nu cere hârtie și nu impune un model. Art. 119 cere conținutul — pentru fiecare salariat, zilnic, ora de începere și ora de sfârșit a programului — și ca evidența să fie la locul de muncă, gata de arătat inspectorului. O evidență ținută pe calculator sau într-o aplicație îndeplinește asta, dacă poate fi deschisă acolo, la control.",
  },
  {
    q: "Trebuie semnată de salariat?",
    a: "Codul muncii nu cere semnătura zilnică a salariatului: art. 119 cere orele, nu o semnătură. Multe firme o cer totuși prin regulamentul intern, ca omul să-și confirme orele; de aceea modelul de aici are coloana de semnătură, pentru cine o folosește.",
  },
  {
    q: "Ce fac dacă lucrăm și sâmbăta sau în ture?",
    a: "Alege programul „Luni–sâmbătă” sau „Toate zilele (ture)”: zilele acelea primesc câte un rând pe fiecare om. În programul de luni până vineri, sâmbetele, duminicile și sărbătorile apar câte un singur rând, marcat cu L sau SL, ca în condică să nu lipsească nicio zi. Legea cere evidența orelor prestate zilnic, deci și în zilele în care se lucrează excepțional.",
    temei: "art. 119 alin. (1) Codul muncii",
    legatura: { href: "?program=ture#documentul", eticheta: "Vezi condica pe ture" },
  },
  {
    q: "Cum se calculează orele lucrate?",
    a: "În Excel, singure: ora plecării minus ora sosirii, minus pauza în minute, inclusiv pentru tura care trece de miezul nopții. A doua filă adună, pe fiecare om, orele și zilele de CO, CM, CFS, AN și D. Pauzele nu intră în programul de lucru dacă regulamentul intern sau contractul colectiv nu prevăd altfel; la peste 6 ore pe zi, salariatul are dreptul la pauză de masă.",
    temei: "art. 134 alin. (1) și (3) Codul muncii",
  },
  {
    q: "Cum arată o condică completată?",
    a: "Ca mai sus, cu numele oamenilor trecute și câte un rând pe fiecare zi, cu ora sosirii, ora plecării, pauza și semnătura. Poți vedea un exemplu gata completat cu trei angajați, apoi îl schimbi cu oamenii tăi.",
    legatura: {
      href: "?an=2026&luna=10&firma=Construct%20SRL&angajati=Popa%20Ion%0AIlie%20Maria%0ARadu%20Andrei#documentul",
      eticheta: "Vezi condica completată",
    },
  },
];
