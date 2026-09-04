import type { FeatureKey } from "@/config/features";

/**
 * Conținutul celor patru pagini de domeniu.
 *
 * ── DE CE PATRU PAGINI, NU O SECȚIUNE ─────────────────────────────────────
 * Până acum cele patru etichete din subsol — construcții, producție, transport,
 * servicii — duceau toate la aceeași ancoră. Patru texte de vânzare diferite pe
 * un singur URL înseamnă că niciunul nu poate ieși pe căutarea lui, iar patru
 * linkuri către aceeași adresă sunt, pentru un crawler, un singur link.
 *
 * ── DE CE MODULELE SUNT CHEI, NU NUME ─────────────────────────────────────
 * Numele afișat vine din `FEATURES[cheie].denumire`. Scris de mână aici, ar fi
 * rămas în urmă la prima redenumire de modul, iar pagina ar fi promis un „Parc
 * auto" care în aplicație se cheamă altfel. Cu cheia, o denumire greșită nu
 * compilează.
 *
 * ── DE CE NU SUNT CIFRE DE LEGE AICI ──────────────────────────────────────
 * Paginile astea sunt despre cum se lucrează, nu despre ce cere legea. Cuantumuri
 * și termene stau pe `/evidenta-orelor-de-munca` și pe `/reges-online`, într-un
 * singur loc, cu articolul lângă ele. Împrăștiate pe încă patru pagini, ar fi
 * patru locuri de actualizat la fiecare modificare legislativă — adică, în
 * practică, patru locuri rămase în urmă.
 */

export type Durere = Readonly<{ titlu: string; text: string }>;

export type ModulDomeniu = Readonly<{
  cheie: FeatureKey;
  /** De ce contează modulul ăsta AICI, nu în general. */
  deCe: string;
}>;

export type Domeniu = Readonly<{
  /** Segmentul din adresă. ASCII, fără diacritice. */
  slug: string;
  /** Eticheta scurtă, pentru subsol și pentru pagina-hub. */
  eticheta: string;
  /** H1-ul paginii. */
  titlu: string;
  metaTitlu: string;
  metaDescriere: string;
  lead: string;
  dureri: readonly Durere[];
  module: readonly ModulDomeniu[];
  /** Ce se pornește primul și de ce. Proză, 2-3 paragrafe. */
  ordinea: readonly string[];
}>;

export const DOMENII: readonly Domeniu[] = [
  {
    slug: "constructii",
    eticheta: "Construcții și instalații",
    titlu: "Pontaj și SSM pentru firme de construcții",
    metaTitlu: "Program de pontaj și SSM pentru construcții",
    metaDescriere:
      "Echipe pe șantiere și puncte de lucru, instruiri și echipament care expiră, evidența orelor cerută la control. Pontaj de pe telefon, fără instalare.",
    lead: "Oamenii nu sunt într-o clădire, sunt în cinci locuri. Evidența orelor trebuie ținută la fiecare dintre ele, iar controlul nu sună înainte.",
    dureri: [
      {
        titlu: "Pontajul vine de pe cinci șantiere, în cinci feluri",
        text: "Un șef de echipă trimite poze cu o hârtie, altul un mesaj, al treilea sună. Cineva le adună seara într-un fișier, iar la sfârșit de lună nimeni nu mai poate spune din ce a ieșit o cifră anume.",
      },
      {
        titlu: "Instruirile și echipamentul expiră fără să anunțe nimeni",
        text: "Fișa de instruire periodică, aptitudinea medicală, casca și bocancii cu termen — fiecare are scadența lui, pe fiecare om. Se află de obicei la control, adică prea târziu ca să mai poți face ceva.",
      },
      {
        titlu: "Evidența trebuie să fie ACOLO, nu la birou",
        text: "Legea cere ca evidența orelor să stea la locul de muncă, adică la punctul de lucru unde omul chiar lucrează. Un dosar ținut la sediu, oricât de bine, nu acoperă șantierul.",
      },
      {
        titlu: "Oamenii se mută între șantiere în aceeași săptămână",
        text: "Aceeași persoană lucrează luni într-un loc și joi în altul. Pe hârtie asta devine fie două pontaje care se contrazic, fie unul care ascunde unde a fost omul de fapt.",
      },
    ],
    module: [
      {
        cheie: "ssm",
        deCe: "Instruirile, aptitudinile medicale și echipamentul individual, fiecare cu scadență și cu semafor înainte de termen. E modulul de la care pornesc aproape toate firmele de construcții.",
      },
      {
        cheie: "attendance",
        deCe: "Se pontează de pe telefon, din browser, direct de pe șantier. Ziua reține locul de muncă efectiv, nu punctul de lucru din contract.",
      },
      {
        cheie: "per_diem",
        deCe: "Delegări și diurne interne, cu ferestre de 24 de ore și plafon neimpozabil, calculate în loc de estimate.",
      },
      {
        cheie: "fleet",
        deCe: "ITP, RCA și rovinieta pe fiecare mașină, cu termen și alertă. Utilajele care circulă pe drum public intră aici.",
      },
      {
        cheie: "inventory",
        deCe: "Scule și echipament dat în primire, pe persoană, cu semnătură de predare. Se știe la cine e polizorul.",
      },
    ],
    ordinea: [
      "Ordinea care funcționează în practică: SSM întâi, pontaj imediat după. SSM fiindcă are cea mai scurtă distanță până la o problemă reală — o instruire expirată se vede la primul control și n-are cum fi reparată retroactiv.",
      "Pontajul vine al doilea fiindcă are nevoie de câteva zile ca oamenii să se obișnuiască să deschidă linkul dimineața. Merită pornit la început de lună, nu la mijloc: o lună tăiată în două, jumătate pe hârtie și jumătate în aplicație, e mai greu de închis decât oricare dintre ele separat.",
      "Diurnele, parcul auto și inventarul se pornesc când ajungi la ele. Nu sunt condiții pentru primele două și nu au sens activate toate în aceeași săptămână.",
    ],
  },

  {
    slug: "productie",
    eticheta: "Producție și fabrici",
    titlu: "Pontaj pe schimburi pentru producție",
    metaTitlu: "Program de pontaj pe schimburi pentru producție",
    metaDescriere:
      "Ture și schimburi, spor de noapte cu interval propriu, revizii pe scadență și pe contor, autorizații nominale cu termen. Evidența orelor, ținută cum o cere legea.",
    lead: "Schimbul de noapte, sporul care i se cuvine și revizia care trebuie făcută la o mie de ore sunt trei evidențe diferite. De obicei se țin în trei fișiere care nu se cunosc.",
    dureri: [
      {
        titlu: "Sporul de noapte se calculează cu mâna",
        text: "Cineva se uită pe pontaj, numără orele care cad în interval și adună. Când intervalul e altul decât cel implicit, sau când tura trece peste miezul nopții, calculul se face din nou de la zero, în fiecare lună.",
      },
      {
        titlu: "Reviziile se scadențează în două feluri deodată",
        text: "Un echipament se revizuiește la termen calendaristic sau la ore de funcționare, care vin dinainte. Ținute într-un tabel, cele două scadențe se bat cap în cap, iar cea care vine prima e chiar cea care se ratează.",
      },
      {
        titlu: "Autorizațiile sunt pe om, nu pe firmă",
        text: "O autorizație ISCIR e nominală și expiră. Când omul cu autorizația e în concediu, întrebarea „mai avem pe cineva?” trebuie să aibă răspuns înainte de a se opri linia, nu după.",
      },
      {
        titlu: "Ora de început nu se notează nicăieri",
        text: "Pontajul de producție notează de obicei „schimbul 2” sau „8 h”. Legea cere ora de începere și de sfârșit, pentru fiecare om, în fiecare zi — și e prima lipsă care se vede la un control.",
      },
    ],
    module: [
      {
        cheie: "attendance",
        deCe: "Ture și schimburi, cu ora de început și de sfârșit pe fiecare zi. Orele de noapte se separă pe intervalul configurat, nu pe unul presupus.",
      },
      {
        cheie: "maintenance",
        deCe: "Revizii scadențate calendaristic ȘI pe contor, cu alertă la cea care vine prima. Istoricul rămâne pe echipament, nu în mintea cuiva.",
      },
      {
        cheie: "ssm",
        deCe: "Instruiri, aptitudini medicale și autorizări nominale cu termen. Se vede dintr-o privire cine mai e valabil pe ce.",
      },
      {
        cheie: "payroll",
        deCe: "Luna închisă în pontaj intră direct în calcul, cu sporurile deja separate. Nu se mai retastează nimic.",
      },
      {
        cheie: "inventory",
        deCe: "Scule, echipament de protecție și piese de schimb, cu stoc și cu predare pe persoană.",
      },
    ],
    ordinea: [
      "Pontajul se pornește primul, fiindcă din el iese tot restul: sporurile, statul de plată și dovada la control. Merită configurat cu atenție intervalul de noapte și felul turelor înainte de prima lună, nu după.",
      "Mentenanța vine al doilea și e singurul modul care merită pornit cu date istorice: fără ultima revizie a fiecărui echipament, prima scadență calculată e greșită și modulul își pierde credibilitatea din prima săptămână.",
      "Salarizarea la urmă, după cel puțin o lună de pontaj închis. Are nevoie de o lună întreagă ca să poată fi verificată în paralel cu felul în care calculați azi — iar comparația aia e singurul lucru care convinge pe cineva să renunțe la fișierul vechi.",
    ],
  },

  {
    slug: "transport",
    eticheta: "Transport și logistică",
    titlu: "Parc auto și diurne pentru firme de transport",
    metaTitlu: "Program pentru parc auto, diurne și pontaj în transport",
    metaDescriere:
      "ITP, RCA și rovinietă cu termen, foi de parcurs cu kilometraj verificat, diurne externe pe țări cu ferestre de 24 de ore și plafon neimpozabil.",
    lead: "Un termen ratat la o mașină oprește mașina. O diurnă calculată greșit se descoperă la control, cu dobânzi, la un an după ce a fost plătită.",
    dureri: [
      {
        titlu: "Termenele mașinilor sunt în capul unei singure persoane",
        text: "ITP, RCA, rovinietă, tahograf, licență de transport — fiecare cu data lui, pe fiecare mașină. Când persoana care le ține minte e în concediu, evidența e efectiv indisponibilă.",
      },
      {
        titlu: "Diurna externă se socotește pe ferestre, nu pe zile",
        text: "Nu e „câte zile a lipsit”. Sunt ferestre de 24 de ore, pe țări cu plafoane diferite, iar partea neimpozabilă se calculează separat de restul. Făcut cu mâna, e locul cu cele mai multe greșeli din toată salarizarea.",
      },
      {
        titlu: "Foile de parcurs nu se leagă de nimic",
        text: "Kilometrajul de pe foaie și cel de la ultima alimentare spun povești diferite, iar consumul rezultat e o cifră în care nu crede nimeni.",
      },
      {
        titlu: "Șoferul nu e niciodată la birou",
        text: "Orice proces care cere ca omul să vină să semneze ceva se blochează. Cererea de concediu, confirmarea unei diurne, fluturașul — toate trebuie să meargă de pe telefon sau nu merg deloc.",
      },
    ],
    module: [
      {
        cheie: "fleet",
        deCe: "ITP, RCA, rovinietă și celelalte termene pe fiecare mașină, cu semafor înainte. Foi de parcurs cu kilometraj și consum verificat față de alimentări.",
      },
      {
        cheie: "per_diem",
        deCe: "Diurne interne și externe, pe ferestre de 24 de ore și pe țări, cu partea neimpozabilă separată de rest.",
      },
      {
        cheie: "maintenance",
        deCe: "Revizii pe kilometraj sau pe termen, cu alertă la cea care vine prima. Istoricul rămâne pe mașină, inclusiv după schimbarea șoferului.",
      },
      {
        cheie: "attendance",
        deCe: "Evidența orelor pentru personalul care nu e la volan, și zilele de deplasare pentru cei care sunt.",
      },
      {
        cheie: "employee_portal",
        deCe: "Fluturașul, soldul de concediu și cererile, de pe telefon. Pentru un șofer, asta e singura formă în care există.",
      },
    ],
    ordinea: [
      "Parcul auto se pornește primul și cu toate termenele introduse, nu cu jumătate. Un modul de scadențe care arată verde fiindcă datele lipsesc e mai periculos decât niciun modul — se ajunge să fie crezut.",
      "Diurnele vin al doilea. Merită calculată în paralel o lună întreagă, cu felul în care socotiți azi: dacă rezultatele diferă, e mai bine să se afle acum, pe o lună pe care o puteți verifica, decât la un control pe una de acum doi ani.",
      "Portalul angajatului e cel care schimbă cel mai vizibil viața de zi cu zi, dar are sens abia după ce există date în celelalte module. Pornit gol, oamenii îl deschid o dată și nu se mai întorc.",
    ],
  },

  {
    slug: "servicii",
    eticheta: "Servicii, birouri și comerț",
    titlu: "Concedii și dosare de personal pentru birouri",
    metaTitlu: "Program de concedii și dosare de personal pentru birouri",
    metaDescriere:
      "Cereri de concediu cu aprobare pe linie ierarhică, sold recalculat automat, prag de absenți simultani, evaluări periodice și portal în care omul își găsește singur fluturașul.",
    lead: "Aici nu se pierd ore, se pierd zile de concediu și răspunsuri. Problema nu e evidența, e că fiecare cerere trece prin cineva care trebuie să-și amintească.",
    dureri: [
      {
        titlu: "Cererile de concediu trăiesc în chat",
        text: "Se cere pe un canal, se aprobă cu un emoji, se uită. Peste opt luni, soldul de zile se reconstituie din memorie și din capturi de ecran, iar diferența se stinge de obicei în favoarea celui care insistă.",
      },
      {
        titlu: "Nu se știe cine mai poate lipsi în august",
        text: "Fără un prag de absenți simultani, aprobările se dau în ordinea în care s-au cerut, iar constatarea că jumătate de echipă lipsește în aceeași săptămână vine după ce toate au fost aprobate.",
      },
      {
        titlu: "Soldul de zile nu e un număr, e un calcul",
        text: "Dreptul anual depinde de vechime, de condițiile de muncă și de gradul de handicap, iar zilele netransferate au propriile reguli de reportare. Ținut ca o cifră într-un tabel, e greșit din prima zi a anului.",
      },
      {
        titlu: "Fluturașul se cere pe e-mail, unul câte unul",
        text: "În fiecare lună, aceleași cinci întrebări către aceeași persoană. Nu e o problemă de timp, e o problemă de întrerupere.",
      },
    ],
    module: [
      {
        cheie: "leave",
        deCe: "Cerere, aprobare pe linie ierarhică și sold recalculat singur. Dreptul anual iese din vechime, condiții și grad de handicap, nu dintr-o cifră scrisă de mână.",
      },
      {
        cheie: "employee_portal",
        deCe: "Fluturașul, soldul și cererile, găsite de om fără să întrebe pe nimeni. E modulul care taie cele mai multe întreruperi.",
      },
      {
        cheie: "attendance",
        deCe: "Evidența orelor cerută de lege, inclusiv pentru program flexibil. Concediul aprobat devine zi pe foaie o singură dată, nu se mai retastează.",
      },
      {
        cheie: "evaluations",
        deCe: "Evaluări periodice cu obiective și istoric, în locul discuției anuale care se ține din memorie.",
      },
      {
        cheie: "announcements",
        deCe: "Anunțuri interne cu confirmare de citire. Se știe cine a văzut regulamentul nou, nu se presupune.",
      },
    ],
    ordinea: [
      "Concediile se pornesc primele, fiindcă e singurul modul din listă la care oamenii vin singuri: cine vrea liber își face cererea fără să fie convins. Adoptarea nu trebuie împinsă, ceea ce nu se poate spune despre niciun alt modul.",
      "Portalul angajatului vine imediat după, în aceeași lună. Cele două împreună schimbă percepția din „încă un sistem” în „acum îmi văd singur zilele”, iar asta decide dacă restul modulelor mai sunt primite bine.",
      "Pontajul, evaluările și anunțurile se adaugă când e nevoie. Într-un birou cu program fix, pontajul e mai degrabă o obligație legală decât o unealtă zilnică — merită pornit corect, dar nu e cel de la care începi.",
    ],
  },
];

/** Căutare după segmentul din adresă. Întoarce `undefined` pentru un slug necunoscut. */
export function domeniulDupaSlug(slug: string): Domeniu | undefined {
  return DOMENII.find((d) => d.slug === slug);
}
