import type { FeatureKey } from "@/config/features";

/**
 * Fișele detaliate ale modulelor — conținutul propriu al paginilor
 * `/module/<cheie>`.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Paginile de modul aveau ~39 de cuvinte proprii: titlul, două propoziții și
 * trei puncte, luate din catalogul de pe `/module`. La volumul ăsta, o pagină e
 * găsită și necitită — verdictul obișnuit în Search Console e „crawled, currently
 * not indexed", adică motorul o citește și decide că nu merită.
 *
 * ── DE UNDE VINE CONȚINUTUL ───────────────────────────────────────────────
 * Nu din invenție. Tabela de permisiuni e citită din `public.role_permissions`,
 * unde stau valorile efective — nu din `src/config/permissions.ts`, care ține
 * doar vocabularul. Legăturile dintre module descriu fluxuri care există în cod.
 * Limitele sunt limite reale.
 *
 * E și cel mai bun conținut posibil pentru citare: fapte specifice, verificabile,
 * pe care nu le are nimeni altcineva, fiindcă descriu produsul ăsta.
 *
 * ── DE CE MATRICEA DE ROLURI E PARTEA CARE CONTEAZĂ ───────────────────────
 * Fiecare produs din categorie spune „roluri și permisiuni". Puțini arată
 * tabelul. Iar tabelul nostru conține surprize reale — un manager care poate
 * aproba pontajul echipei fără să poată ponta, un HR care nu poate închide luna
 * — care spun despre produs mai mult decât orice frază de vânzare.
 */

/**
 * Domeniul unei permisiuni, exact ca în bază.
 *
 * `null` = rândul lipsește cu totul; `"none"` = rând prezent, cu refuz explicit.
 * Pentru cititor înseamnă același lucru și se afișează la fel, dar distincția se
 * păstrează în date: `none` e o DECIZIE, iar unde apare merită spus în proză.
 */
export type Domeniu = "all" | "team" | "own" | "none" | null;

export type ActiuneModul = Readonly<{
  /** Ce înseamnă acțiunea, în română, pentru cineva care nu citește cod. */
  ce: string;
  /** Cheia reală, `resursa:acțiune`. Verificată de test față de vocabular. */
  cheie: string;
  orgAdmin: Domeniu;
  hr: Domeniu;
  manager: Domeniu;
  angajat: Domeniu;
}>;

export type FisaModul = Readonly<{
  cheie: FeatureKey;
  /**
   * Data ultimei schimbări de conținut a fișei, ISO. Ajunge în `lastmod` din
   * `sitemap.xml`. Până la 17 sept 2026 toate cele nouăsprezece pagini purtau o
   * singură dată scrisă în `harta.ts`, anterioară ultimei editări a fișelor — un
   * `lastmod` care minte e ignorat de motoare. Se schimbă odată cu textul fișei.
   */
  actualizat: string;
  /** Titlul paginii, mai lung și mai căutabil decât cel din catalog. */
  titluPagina: string;
  /**
   * H1-ul paginii: numește ce se caută, nu doar modulul. Firimitura și meniul
   * folosesc catalogul, ca navigația să rămână scurtă. Obligatoriu din 2 oct
   * 2026 — numele din meniu e un cuvânt („Pontaj", „Anunțuri"), iar auditul de
   * atunci l-a găsit drept H1 pe 18 din 19 pagini.
   */
  titluH1: string;
  metaDescriere: string;
  /** Proză proprie, care NU repetă textul din catalog. */
  intro: readonly string[];
  /**
   * Un caz de folosire concret: ecranul, omul care apasă, ce se întâmplă cu
   * datele după. 120–150 de cuvinte.
   *
   * Paginile de modul aveau 257–361 de cuvinte proprii, sub pragul la care o
   * pagină e citită, nu doar găsită („crawled, currently not indexed"). Câmpul
   * ăsta e singurul loc unde scenariul se poate spune fără să repete intro-ul
   * sau tabelul de roluri — și e numărat de testul de conținut propriu.
   */
  cazDeUtilizare?: string;
  /**
   * Lead-ul benzii de roluri și al benzii de legături, când modulul merită o
   * formulare proprie.
   *
   * Șablonul are câte o frază fixă pentru amândouă, iar ele apăreau identic pe
   * 18–19 pagini din 19. Modulele care țintesc o căutare anume își spun
   * povestea lor; restul cad pe frazele din `page.tsx`.
   */
  leadRoluri?: string;
  leadLegaturi?: string;
  actiuni: readonly ActiuneModul[];
  /** Fraza care explică surpriza din tabel. E partea cea mai citată. */
  notaPermisiuni: string;
  legaturi: readonly Readonly<{ catre: FeatureKey; text: string }>[];
  /**
   * Ghidurile și uneltele despre același subiect. Până la 17 sept 2026 pagina
   * `/module/pontaj` pomenea art. 119 și controlul ITM fără să trimită la
   * paginile care le explică, iar acelea nu trimiteau înapoi la modul — două
   * jumătăți ale aceleiași întrebări, fără drum între ele.
   */
  ghiduri?: readonly Readonly<{ href: string; eticheta: string }>[];
  nuFace: readonly string[];
}>;

export const FISE: readonly FisaModul[] = [
  {
    cheie: "attendance",
    actualizat: "2026-10-07",
    // Fără „foaie lunară" din 2 oct 2026: interogarea „foaie de pontaj" o ține
    // `/unelte/foaie-de-pontaj`; două pagini pe același termen se împart.
    titluPagina: "Program de pontaj pentru angajați, cu aprobare",
    titluH1: "Program de pontaj",
    metaDescriere:
      "Program de pontaj online: foaia colectivă lunară, pontaj de pe telefon, aprobare pe echipă, luna blocată. Managerul aprobă echipa și se pontează doar pe sine.",
    intro: [
      "Pontajul e modulul din care iese aproape tot restul: sporurile, statul de plată și dovada la un control. De aceea are cea mai strictă separare de roluri din toată aplicația.",
      "Luna e fie deschisă, fie închisă. Cât e deschisă, zilele se completează și se corectează; când e închisă, nu se mai poate edita nici din greșeală, iar ce s-a schimbat până atunci rămâne în jurnal, cu cine și când. Închiderea nu ține de o înțelegere în echipă: cine n-are dreptul s-o facă pur și simplu nu poate.",
      "Fiecare zi reține ora de începere și ora de sfârșit, nu doar numărul de ore — forma pe care o cere art. 119 din Codul muncii și pe care majoritatea pontajelor din fișiere de calcul n-o au.",
    ],
    actiuni: [
      {
        ce: "Vede foaia de pontaj",
        cheie: "attendance:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        // Din 0161 (6 oct 2026) managerul are `attendance:create = own`: își pontează
        // propria zi, nu pe a echipei. Corectarea unei zile e aceeași cheie — în
        // aplicație `poateEdita` cere `attendance:create` (pontaj/page.tsx);
        // `attendance:update` păzește doar regulile pontajului, nu ziua.
        ce: "Pontează sau corectează o zi",
        cheie: "attendance:create",
        orgAdmin: "all",
        hr: "all",
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Aprobă și închide luna",
        cheie: "attendance:approve",
        orgAdmin: "all",
        hr: "none",
        manager: "team",
        angajat: null,
      },
    ],
    cazDeUtilizare:
      "E 3 septembrie și luna august trebuie închisă. Persoana de la personal deschide foaia lunii: o grilă cu zilele pe orizontală și oamenii pe verticală, cu weekendurile și sărbătorile deja marcate. Trei zile arată gol pentru un om plecat pe șantier — se completează ora de intrare și cea de ieșire, iar aplicația propune numărul de ore, care se poate corecta. Concediile aprobate în august sunt deja pe foaie, trecute automat, deci nu se retastează. Șeful de echipă intră pe ecranul lui și aprobă zilele oamenilor din echipa lui. Își pontează doar propria zi: nu poate ponta în locul lor și nu le poate corecta ziua. După ce toate departamentele sunt aprobate, luna se blochează. Din clipa aia nimeni nu mai scrie în august, nici din greșeală, iar ce s-a schimbat până atunci rămâne în jurnal, cu nume și oră.",
    leadRoluri:
      "Pontajul are cea mai strictă separare de roluri din aplicație, fiindcă din el ies sporurile, statul de plată și dovada la un control. Regulile de mai jos nu sunt doar butoane ascunse pe ecran: cine n-are dreptul la ceva nu poate face acel lucru, nici din greșeală, nici intenționat.",
    leadLegaturi:
      "Pontajul nu stă singur: salariile se calculează din luna închisă, concediile aprobate ajung pe foaie fără să le retasteze cineva, iar angajatul își vede zilele în portal.",
    notaPermisiuni:
      "Două lucruri din tabelul de mai sus surprind pe toată lumea. Un manager poate aproba pontajul echipei, dar nu-l poate completa: se pontează doar pe sine, iar ziua altcuiva n-o poate ponta și n-o poate corecta. Separarea dintre cine completează și cine confirmă nu e lăsată la disciplina echipei: aplicația nu permite altfel. Iar HR, care poate completa orice zi din orice lună, nu poate aproba, și asta e voit, nu o scăpare. Închiderea lunii rămâne la șeful echipei sau la administrator.",
    legaturi: [
      {
        catre: "leave",
        text: "Concediul aprobat devine zi de concediu pe foaie, o singură dată. Nu se retastează și nu se poate uita.",
      },
      {
        catre: "payroll",
        text: "Luna închisă intră direct în calculul salarial, cu orele suplimentare și cele de noapte deja separate.",
      },
      {
        catre: "employee_portal",
        text: "Angajatul își vede propriile zile și își pontează ziua de pe telefon, fără să instaleze nimic.",
      },
    ],
    ghiduri: [
      { href: "/evidenta-orelor-de-munca", eticheta: "Ce cere art. 119 la evidența orelor" },
      { href: "/unelte/foaie-de-pontaj", eticheta: "Foaie de pontaj lunar, gratuită" },
      { href: "/pontaj-pe-telefon", eticheta: "Cum se pontează de pe telefon" },
      { href: "/unelte/condica-de-prezenta", eticheta: "Condica de prezență: model gratuit" },
      { href: "/ghid/ore-suplimentare", eticheta: "Ore suplimentare: limita și plata" },
      { href: "/ghid/spor-de-noapte", eticheta: "Sporul de noapte: 25% și cele 3 ore" },
    ],
    nuFace: [
      "Nu citește pontaje de la cititoare de cartelă sau de amprentă. Zilele se completează de om, din browser.",
      "Nu urmărește poziția telefonului. Locul de muncă se alege dintr-o listă, nu se deduce din GPS.",
      "Nu face singur graficul de ture. Turele le stabiliți voi, apoi zilele se completează pe ele.",
    ],
  },

  {
    cheie: "ssm",
    actualizat: "2026-10-07",
    titluPagina: "Program SSM: instruiri, aptitudini, echipament",
    titluH1: "Evidența SSM și PSI",
    metaDescriere:
      "Toți angajații și toate instruirile SSM într-un tabel, cu semafor pe scadențe și „niciodată făcută” separat de „expirată”. Pentru HR și responsabilul SSM.",
    intro: [
      "Pentru o firmă de construcții recomandăm să înceapă cu SSM, dintr-un motiv simplu: acolo o scăpare devine cel mai repede o problemă reală. O instruire expirată se vede la primul control și nu poate fi reparată retroactiv.",
      "Evidența e un tabel: fiecare angajat pe verticală, fiecare tip de instruire pe orizontală, iar în fiecare căsuță, situația la zi. Distincția care contează e că „niciodată făcută” nu se confundă cu „expirată” — a doua înseamnă că cineva s-a ocupat cândva, prima că omul n-a fost instruit niciodată, iar la un control diferența e între o abatere și o problemă.",
      "Tot cu scadență se urmăresc aptitudinile medicale și echipamentul individual de protecție dat în primire. Semaforul se aprinde înainte de termen, nu la el.",
    ],
    actiuni: [
      {
        ce: "Vede tabelul și scadențele",
        cheie: "ssm:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Adaugă o instruire sau un echipament",
        cheie: "ssm:create",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Modifică o înregistrare",
        cheie: "ssm:update",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
    ],
    cazDeUtilizare:
      "Vine un control și se cer fișele de instruire. Responsabilul SSM deschide tabelul: oamenii pe verticală, tipurile de instruire pe orizontală, iar în fiecare căsuță o culoare. Verde înseamnă făcută și în termen, galben că se apropie scadența, roșu că a expirat — iar „niciodată făcută” e o stare separată de „expirată”, fiindcă la un control înseamnă două lucruri diferite. Același tabel ține aptitudinile medicale și echipamentul de protecție dat în primire, cu durata lui. Semaforul se aprinde înainte de termen, nu la el, deci instruirea se reprogramează până nu e prea târziu. Șeful de echipă vede oamenii lui și află că unuia îi expiră instruirea, dar nu poate bifa nimic ca făcut: asta rămâne treaba lui HR.",
    notaPermisiuni:
      "SSM e modulul lui HR: completează și modifică tot, la fel ca administratorul. Managerul vede doar echipa lui și nu poate modifica nimic — poate afla că unui om îi expiră instruirea, dar nu poate declara că a făcut-o. Angajatul își vede propriile instruiri și propriul echipament, atât. Merită știut că HR administrează SSM-ul, dar nu are acces la modulul de conformitate, unde stau termenele firmei: sunt două zone separate, cu roluri separate.",
    legaturi: [
      {
        catre: "onboarding",
        text: "Instruirea la angajare e un pas din integrare, nu o sarcină pe care și-o amintește cineva după prima săptămână.",
      },
      {
        catre: "inventory",
        text: "Echipamentul individual de protecție e dat în primire pe persoană, cu semnătură, din inventar.",
      },
      {
        catre: "announcements",
        text: "Regulamentele și instrucțiunile se trimit cu confirmare de citire, deci se știe cine a văzut, nu se presupune.",
      },
    ],
    ghiduri: [
      { href: "/ghid/control-itm", eticheta: "Ce se cere la un control ITM" },
      { href: "/unelte/fisa-instruire-ssm", eticheta: "Fișa de instruire SSM: model" },
    ],
    nuFace: [
      "Nu ține locul serviciului extern de prevenire și protecție. Ține evidența, nu întocmește documentația de securitate.",
      "Nu generează fișele de instruire ca documente semnate legal. Reține că instruirea a avut loc, când și de către cine.",
      "Nu evaluează riscurile și nu produce planul de prevenire și protecție.",
    ],
  },

  {
    cheie: "payroll",
    actualizat: "2026-10-07",
    // Search Console, 4–29 sept 2026: „program salarizare" (40 de afișări) și
    // „program salarii" (20) erau cele mai căutate interogări ale sitului, dar
    // Google le trimitea pe pagina de start, pe pozițiile 58–67. Pagina asta,
    // deși indexată, nu apărea deloc — H1-ul spunea doar „Salarizare".
    titluPagina: "Program de salarizare: calculul salariilor",
    titluH1: "Program de salarizare",
    metaDescriere:
      "Program de salarizare pornit din pontajul închis: calculul salariilor pas cu pas, cu desfășurător și avertismente. Managerul nu vede salariile.",
    intro: [
      "Programul de salarizare calculează salariile direct din pontaj, concedii și diurne, care sunt deja în aplicație — fără import lunar dintr-un alt program de salarii și fără un fișier trimis între HR și contabil.",
      "Calculul nu e o cutie neagră care scoate o cifră. Merge pas cu pas, cu desfășurător pe fiecare linie și cu avertismente unde ceva arată neobișnuit — un spor care sare, o lună cu mai puține zile decât ar trebui, un om fără contract activ.",
      "Cotele sunt ale firmei tale și le schimbi din setările salarizării, fără să aștepți ceva de la noi. Când se schimbă o cotă, treci valoarea nouă cu data de la care se aplică, iar lunile deja calculate rămân cu cotele valabile atunci — trecutul nu se recalculează din greșeală.",
      "Calculul pornește de la luna de pontaj închisă, cu orele suplimentare și cele de noapte deja separate. Nu se retastează nimic din pontaj în salarizare, fiindcă nu sunt două evidențe.",
      // Pagina nu pomenea niciunul dintre fișierele lunii (auditul din 7 oct
      // 2026); faptele sunt cele de pe /pentru-contabili, „Ce pleacă spre tine”.
      "Din fiecare lună aprobată ies cinci lucruri: statul de plată în PDF, gata de semnat; fluturașii, pe care fiecare om și-i vede în portal; declarația 112 în XML, pe care contabilul o validează și o depune ca până acum; fișierul pentru bancă, în format SEPA, cu restul de plată al fiecăruia, pe care îl încarci tu în internet banking; și nota contabilă în CSV, generată doar dacă debitul egalează creditul.",
    ],
    actiuni: [
      {
        ce: "Vede statul de plată",
        cheie: "payroll:read",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: "own",
      },
      {
        ce: "Pornește un calcul",
        cheie: "payroll:create",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: null,
      },
      {
        ce: "Modifică o linie",
        cheie: "payroll:update",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: null,
      },
      {
        ce: "Aprobă statul",
        cheie: "payroll:approve",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: null,
      },
      {
        ce: "Exportă / descarcă fluturașul",
        cheie: "payroll:export",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: "own",
      },
    ],
    cazDeUtilizare:
      "Luna de pontaj s-a închis, deci salarizarea poate porni — nu înainte. Contabila deschide calculul și vede fiecare om pe un rând, cu desfășurătorul pe linii: orele normale, cele suplimentare și cele de noapte, deja separate de pontaj, nu retastate. Unde ceva arată neobișnuit — un spor care sare față de luna trecută, o reținere nouă — apare un avertisment lângă cifră, nu în subsol. Cotele folosite sunt cele ale firmei, cu data de la care se aplică: dacă una s-a schimbat la mijlocul anului, luna dinainte rămâne calculată cu cota veche, iar asta se vede. Managerul echipei nu deschide ecranul ăsta deloc: fiecare pas din salarizare îi e închis anume, nu din întâmplare.",
    leadRoluri:
      "În salarizare, managerul nu are acces la nimic: nu vede salariile oamenilor lui, iar asta e o decizie luată anume, nu o scăpare.",
    leadLegaturi:
      "Salarizarea nu cere date tastate din nou, le primește gata: luna de pontaj închisă, cu orele suplimentare și cele de noapte deja separate, și partea neimpozabilă din diurnă, calculată separat.",
    notaPermisiuni:
      "Managerul nu poate face nimic în salarizare: nici să vadă, nici să calculeze, nici să aprobe, nici să descarce. E o decizie, nu o omisiune: șeful de echipă aprobă pontajul oamenilor lui, dar nu vede ce câștigă. Angajatul își vede și își descarcă propriul fluturaș, și numai pe al lui; CNP-ul și IBAN-ul rămân închise chiar și pentru roluri care văd restul fișei.",
    legaturi: [
      {
        catre: "attendance",
        text: "Calculul își ia orele din luna închisă. Fără ea, nu pornește.",
      },
      {
        catre: "per_diem",
        text: "Diurnele aprobate intră în calcul cu partea neimpozabilă separată de rest.",
      },
      {
        catre: "employee_portal",
        text: "Fluturașul ajunge la om în portal, fără să-l ceară pe e-mail în fiecare lună.",
      },
    ],
    ghiduri: [
      { href: "/unelte/calculator-salariu", eticheta: "Calculator salariu net și brut" },
      { href: "/ghid/salariu-minim-pe-economie", eticheta: "Salariul minim pe economie în 2026" },
      {
        href: "/pentru-contabili",
        eticheta: "Ce primește contabilul: stat de plată, D112, fișier bancar",
      },
      { href: "/ghid/diurna", eticheta: "Diurna neimpozabilă: plafoane și calcul" },
      { href: "/evidenta-orelor-de-munca", eticheta: "Evidența orelor de muncă (art. 119)" },
    ],
    nuFace: [
      "Nu depune D112 și nu comunică cu ANAF. Produce datele; depunerea rămâne la contabil.",
      "Nu face contabilitate. Nu ține registre contabile, nu emite facturi și nu întocmește bilanțul.",
      "Nu execută plăți și nu se leagă la bancă: generează fișierul SEPA cu plățile, pe care îl încarci tu în internet banking.",
      "Valorile legale — plafoane, cote implicite — se confirmă de contabil înainte de primul calcul real.",
    ],
  },

  {
    cheie: "fleet",
    actualizat: "2026-10-07",
    titluPagina: "Program de parc auto: ITP, RCA, rovinietă",
    titluH1: "Program de parc auto",
    metaDescriere:
      "Program de parc auto: ITP, RCA și rovinieta fiecărei mașini, cu semafor înainte de scadență, plus foi de parcurs cu kilometraj și alimentări.",
    intro: [
      "Un termen ratat la o mașină oprește mașina. ITP, RCA, rovinieta, tahograful și licența de transport au fiecare data lui, pe fiecare vehicul, iar ținute în capul unei singure persoane devin indisponibile exact când acea persoană e în concediu.",
      "Fiecare vehicul poartă termenele lui, cu semafor care se aprinde înainte de scadență, nu la ea. Foile de parcurs rețin kilometrajul și alimentările, iar consumul rezultat se poate compara cu ce arată bonurile — nu e o cifră introdusă de mână care iese mereu bine.",
      "Istoricul rămâne pe mașină, nu pe șofer. Când se schimbă șoferul, evidența vehiculului nu se rupe, iar întrebarea „când s-a schimbat ultima dată distribuția la mașina asta” are răspuns și peste doi ani.",
      "Modulul se pornește cu toate termenele introduse, nu cu jumătate. Un semafor care arată verde fiindcă datele lipsesc e mai periculos decât niciun semafor — ajunge să fie crezut, iar prima scadență ratată e cea despre care nimeni nu știa că există.",
    ],
    actiuni: [
      {
        ce: "Vede mașinile și termenele",
        cheie: "vehicles:read",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
      {
        ce: "Adaugă o mașină",
        cheie: "vehicles:create",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
      {
        ce: "Modifică o mașină",
        cheie: "vehicles:update",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
      {
        ce: "Vede foile de parcurs",
        cheie: "trip_sheets:read",
        orgAdmin: "all",
        hr: null,
        manager: "team",
        angajat: null,
      },
      {
        ce: "Întocmește o foaie de parcurs",
        cheie: "trip_sheets:create",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
      {
        ce: "Aprobă o foaie de parcurs",
        cheie: "trip_sheets:approve",
        orgAdmin: "all",
        hr: null,
        manager: "team",
        angajat: null,
      },
      {
        ce: "Completează o foaie de parcurs",
        cheie: "trip_sheets:update",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
    ],
    cazDeUtilizare:
      "Administratorul deschide lista de vehicule și vede semaforul pe fiecare: ITP-ul unei dube se aprinde galben cu trei săptămâni înainte de scadență, nu în ziua în care expiră. Programează revizia, iar data nouă rămâne pe mașină, nu pe șoferul care o conduce luna asta. Șoferii predau foile de parcurs cu kilometrajul și alimentările, iar consumul se vede pe vehicul, nu pe hârtii adunate într-un biblioraft. Șeful de echipă aprobă foile oamenilor lui și atât — mașinile, termenele și documentele lor le administrează doar administratorul organizației; HR n-are nimic aici. Când se schimbă șoferul, istoricul vehiculului nu se rupe, iar întrebarea „când s-a schimbat ultima dată distribuția” are un răspuns.",
    notaPermisiuni:
      "Parcul auto e cel mai închis modul din aplicație: mașinile le vede și le administrează doar administratorul organizației. HR nu are nimic aici, iar angajatul nu are nimic. Managerul face excepție doar pe foile de parcurs — le vede și le aprobă pe ale echipei lui, dar nu le poate întocmi. E aceeași separare ca la pontaj, între cine completează și cine confirmă.",
    legaturi: [
      {
        catre: "maintenance",
        text: "Reviziile au scadență pe kilometraj sau pe dată, cu alertă la cea care vine prima.",
      },
      {
        catre: "per_diem",
        text: "Deplasările cu mașina firmei se leagă de ordinul de deplasare și de decont.",
      },
      {
        catre: "inventory",
        text: "Ce e dat în primire cu mașina — trusă, lanțuri, aparat — se urmărește din inventar.",
      },
    ],
    ghiduri: [{ href: "/unelte/foaie-de-parcurs", eticheta: "Foaie de parcurs: model gratuit" }],
    nuFace: [
      "Nu urmărește mașinile prin GPS și nu se leagă la niciun sistem de monitorizare a flotei.",
      "Nu citește cardurile de tahograf și nu calculează timpii de conducere și odihnă.",
      "Nu plătește rovinieta și nu cumpără asigurări. Reține termenele; plata rămâne în altă parte.",
    ],
  },

  {
    cheie: "per_diem",
    actualizat: "2026-10-07",
    // „calculul pe țări" e intenția unui calculator; pagina e un program (2 oct 2026).
    titluPagina: "Program de diurne: deplasări, etape și decont",
    titluH1: "Deplasări și diurne, până la decont",
    metaDescriere:
      "Program de diurne: ordinul de deplasare, etapele pe țări și decontul, cu ferestre de 24 de ore de la plecare. Partea neimpozabilă intră separat în salarii.",
    intro: [
      "Diurna externă nu se socotește pe zile calendaristice. Se socotește pe ferestre de 24 de ore care curg de la ora plecării, nu de la miezul nopții, iar o deplasare care traversează mai multe țări are etape cu plafoane diferite. Făcut cu mâna, e locul cu cele mai multe greșeli din toată salarizarea.",
      "Fluxul are trei pași: ordinul de deplasare, etapele efective și decontul. De la fiecare pas te poți întoarce la cel dinainte fără să pierzi ce era completat.",
      "Partea neimpozabilă se calculează separat de rest și intră ca atare în salarizare, în loc să fie o sumă rotundă adăugată la final. Distincția contează la un control: o diurnă socotită greșit nu se descoperă la plată, se descoperă peste un an, cu accesorii.",
      "Merită calculată în paralel o lună întreagă, cu felul în care socotiți azi. Dacă rezultatele diferă, e mai bine să se afle pe o lună pe care o puteți verifica pas cu pas decât pe una de acum doi ani, reconstituită din memorie.",
    ],
    actiuni: [
      {
        ce: "Vede deplasările și deconturile",
        cheie: "per_diem:read",
        orgAdmin: "all",
        hr: null,
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Cere o deplasare",
        cheie: "per_diem:create",
        orgAdmin: "all",
        hr: null,
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Completează etapele și decontul",
        cheie: "per_diem:update",
        orgAdmin: "all",
        hr: null,
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Aprobă",
        cheie: "per_diem:approve",
        orgAdmin: "all",
        hr: null,
        manager: "team",
        angajat: null,
      },
      {
        ce: "Șterge o cerere",
        cheie: "per_diem:delete",
        orgAdmin: "all",
        hr: null,
        manager: "own",
        angajat: "own",
      },
    ],
    cazDeUtilizare:
      "Un șofer pleacă marți la 16:00 spre Germania și se întoarce vineri seara. Își deschide singur ordinul de deplasare, fiindcă diurnele sunt modulul în care omul își conduce propriul dosar. Zilele de deplasare se socotesc câte 24 de ore de la ora plecării, nu de la miezul nopții, așa că ziua de marți nu se rotunjește: aplicația numără de la 16:00, iar etapele se completează pe țări, cu ora trecerii. La întoarcere face decontul, iar dacă ceva lipsește se poate întoarce la pasul dinainte fără să piardă ce era completat. Partea neimpozabilă se calculează separat și intră ca atare în salarizare, nu ca o sumă rotundă adăugată la final. Șeful lui aprobă, dar nu poate modifica cifrele: una e să aprobi, alta e să completezi.",
    notaPermisiuni:
      "Diurnele sunt singurul modul în care omul care pleacă în deplasare își conduce singur dosarul: cere, completează etapele, face decontul și poate șterge cererea cât timp e a lui. Managerul aprobă echipa, dar nu poate completa în locul nimănui. HR nu are niciun drept aici — deplasarea rămâne între angajat, șeful lui și administrator.",
    ghiduri: [
      { href: "/ghid/diurna", eticheta: "Plafoanele neimpozabile și durata delegării" },
      { href: "/ghid/diurna-externa", eticheta: "Diurna externă pe țări" },
      { href: "/ghid/diurna-externa#germania", eticheta: "Diurna externă în Germania" },
    ],
    legaturi: [
      {
        catre: "payroll",
        text: "Diurna aprobată intră în calcul cu partea neimpozabilă deja separată.",
      },
      {
        catre: "fleet",
        text: "Deplasarea cu mașina firmei se leagă de foaia de parcurs a vehiculului.",
      },
      {
        catre: "attendance",
        text: "Zilele de deplasare apar pe foaia de pontaj, ca tip de zi distinct.",
      },
    ],
    nuFace: [
      "Nu rezervă bilete, cazare sau transport, și nu se leagă la nicio agenție.",
      "Nu convertește valuta automat după un curs luat de pe internet. Cursul se introduce.",
      "Nu decontează cheltuieli din poze de bonuri. Sumele se completează, chitanțele se atașează.",
    ],
  },
  {
    cheie: "leave",
    actualizat: "2026-10-07",
    titluPagina: "Program de concedii: cerere, aprobare și sold",
    titluH1: "Program de concedii",
    metaDescriere:
      "Program de concedii: cererea depusă de pe telefon, aprobarea pe echipă, soldul pe fiecare tip calculat automat și zilele trecute singure pe pontaj.",
    intro: [
      "Concediul e locul unde se văd cel mai repede consecințele unei evidențe ținute în fișiere de calcul: două persoane din aceeași echipă plecate în aceeași săptămână, un sold de zile pe care fiecare îl calculează altfel și o cerere aprobată pe e-mail, care nu ajunge niciodată pe pontaj.",
      "Aici cererea urmează un drum clar. Cât e ciornă, o poți schimba sau șterge. După trimitere trece la cine aprobă, iar decizia — da sau nu — rămâne cu numele și ora ei. Soldul se scade la aprobare, nu la cerere, și se pune la loc dacă cererea se anulează. Nimeni nu ține un al doilea calcul pe hârtie.",
      "Tipurile de concediu se configurează pe firmă: câte zile dă fiecare, dacă cere document justificativ, dacă suspendă contractul. Concediul medical suspendă contractul și se raportează ca atare; odihna nu. Diferența nu e o etichetă: e o regulă pe care aplicația o respectă singură, de fiecare dată.",
    ],
    actiuni: [
      {
        ce: "Vede cererile de concediu",
        cheie: "leave:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Depune o cerere",
        cheie: "leave:create",
        orgAdmin: "all",
        hr: "all",
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Modifică o cerere",
        cheie: "leave:update",
        orgAdmin: "all",
        hr: "all",
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Aprobă sau respinge",
        cheie: "leave:approve",
        orgAdmin: "all",
        hr: "none",
        manager: "team",
        angajat: null,
      },
      {
        ce: "Șterge o cerere",
        cheie: "leave:delete",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: "own",
      },
    ],
    cazDeUtilizare:
      "Un om cere trei zile la sfârșitul lui august. Deschide portalul de pe telefon, vede soldul lui pe fiecare tip de concediu și depune cererea; cât e ciornă, o poate schimba sau șterge. După trimitere ajunge la șeful lui, care vede pe același ecran că un coleg din echipă e deja plecat în aceleași zile — aplicația arată suprapunerea, dar nu decide în locul lui. Șeful aprobă, iar decizia rămâne cu numele și ora ei. Din clipa aia soldul scade automat și cele trei zile apar pe foaia de pontaj a lunii, fără ca cineva să le retasteze. Dacă ar fi fost concediu medical, ar fi suspendat contractul și ar fi pregătit evenimentul pentru REGES, cu termenul lui legal calculat în zile lucrătoare.",
    leadRoluri:
      "Concediul e locul unde separarea rolurilor se simte cel mai des: cine cere, cine aprobă și cine vede soldul altcuiva sunt trei drepturi diferite. Nu e vorba de un buton ascuns: cine n-are dreptul nu poate face pasul pe nicio cale.",
    leadLegaturi:
      "O cerere aprobată se vede imediat în altă parte: pe pontaj, unde ziua apare singură, în salarizare, care o plătește, și în REGES, când tipul de concediu suspendă contractul.",
    ghiduri: [
      {
        href: "/ghid/concediu-de-odihna",
        eticheta: "Ce cere Codul muncii: zile, programare, report",
      },
      // Legături spre SECȚIUNI, cu textul exact al subîntrebării: până la 7 oct
      // 2026 nicio legătură din sit nu ducea mai jos de capul unei pagini.
      {
        href: "/ghid/concediu-de-odihna#zile-pe-an",
        eticheta: "Câte zile de concediu ai pe an și pe lună",
      },
      {
        href: "/ghid/concediu-de-odihna#neefectuat",
        eticheta: "Concediul de odihnă neefectuat la plecare",
      },
      {
        href: "/unelte/cerere-concediu-de-odihna",
        eticheta: "Cerere de concediu cu zilele calculate",
      },
    ],
    notaPermisiuni:
      "Managerul e cazul care surprinde. Vede cererile întregii echipe și le aprobă, dar poate depune și modifica numai pe ale lui: nu poate cere concediu în numele unui subordonat, oricât de bine ar cunoaște situația. Iar HR, care are acces la toate cererile și le poate chiar șterge, nu le poate aproba. Nu e o scăpare, e o alegere făcută dinadins: cine ține evidența nu e cine decide, iar aplicația nu amestecă cele două roluri.",
    legaturi: [
      {
        catre: "attendance",
        text: "Cererea aprobată devine automat zi de concediu pe foaia de pontaj, o singură dată și fără retastare.",
      },
      {
        catre: "payroll",
        text: "Zilele de concediu intră în calculul salarial cu media pe ultimele trei luni, separat de zilele lucrate.",
      },
      {
        catre: "employee_portal",
        text: "Angajatul își vede soldul rămas și depune cererea de pe telefon, fără să întrebe pe cineva câte zile mai are.",
      },
    ],
    nuFace: [
      "Nu dă concedii pe jumătate de zi. Aplicația acceptă doar zile întregi: e o regulă fixă, nu o simplă convenție.",
      "Nu decide singură dacă o cerere se suprapune cu alta din echipă. Arată suprapunerea celui care aprobă și îl lasă pe el să hotărască.",
      "Nu trimite concediul medical mai departe la Casa de Sănătate. Îl înregistrează, îl pune pe pontaj și îl pregătește pentru declarație.",
    ],
  },

  {
    cheie: "onboarding",
    actualizat: "2026-10-07",
    titluPagina: "Integrare angajați: pașii de la angajare",
    titluH1: "Integrarea angajaților noi",
    metaDescriere:
      "Cum se face integrarea unui angajat nou în Administrativo: șabloane de pași, dovezi încărcate, confirmare de citire, termene urmărite.",
    intro: [
      "Prima săptămână a unui angajat e locul în care se pierd cele mai multe documente. Fișa postului semnată, instruirea introductivă, predarea laptopului, cititul regulamentului intern — fiecare există undeva, la cineva, și nimeni nu are lista completă în ziua în care vine controlul.",
      "Modulul face din lista aia una care arată oricând ce e gata și ce nu. Se pornește un șablon pe angajatul nou, fiecare pas are un responsabil și un termen, iar pașii care cer o dovadă nu se pot bifa fără ea: documentul se încarcă, rămâne atașat pasului și se vede cine l-a pus și când.",
      "Șabloanele se scriu o dată, pe firmă, și se refolosesc. Se poate porni de la unul gata făcut, din aplicație, și se poate rescrie cu totul. Dacă o modificare iese prost, te întorci oricând la varianta inițială.",
    ],
    actiuni: [
      {
        ce: "Vede listele de integrare",
        cheie: "checklists:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Creează șabloane și pornește liste",
        cheie: "checklists:create",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Bifează un pas și încarcă dovada",
        cheie: "checklists:update",
        orgAdmin: "all",
        hr: "all",
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Finalizează integrarea",
        cheie: "checklists:approve",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: null,
      },
    ],
    notaPermisiuni:
      "Tabelul descrie un flux cu trei mâini. HR construiește șabloanele și pornește listele; managerul nu poate crea nimic, dar bifează pașii care îi revin lui și declară integrarea încheiată pentru oamenii din echipa lui; angajatul își vede propria listă și își bifează propriii pași — confirmarea că a citit regulamentul e o acțiune a lui, nu una făcută în numele lui. Nimeni nu poate bifa în locul altcuiva: la fiecare bifă, aplicația verifică dacă pasul e chiar al celui care apasă.",
    legaturi: [
      {
        catre: "courses",
        text: "Un pas de integrare poate cere un curs parcurs, iar bifa vine din progresul real, nu dintr-o declarație.",
      },
      {
        catre: "ssm",
        text: "Instruirea introductivă de securitatea muncii se leagă de fișa SSM a omului, cu semnătura și data ei.",
      },
      {
        catre: "employee_portal",
        text: "Angajatul nou își vede lista de pași în portal din prima zi și încarcă singur ce i se cere.",
      },
    ],
    nuFace: [
      "Nu trimite singur e-mailuri de reamintire către responsabilii pașilor restanți. Termenele se văd în listă.",
      "Nu generează contractul de muncă din pașii bifați. Contractul se face în fișa angajatului, separat.",
      "Nu are pași condiționați unii de alții. Lista e o listă, nu un arbore de decizii.",
    ],
  },

  {
    cheie: "courses",
    actualizat: "2026-10-07",
    titluPagina: "Cursuri interne: lecții, teste și dovezi",
    titluH1: "Cursuri interne pentru angajați",
    metaDescriere:
      "Cum se țin cursurile interne în Administrativo: materiale cu versiunile vechi păstrate, lecții cu semnătură, teste cu prag, atribuire pe reguli.",
    intro: [
      "Un curs intern se termină aproape întotdeauna cu aceeași întrebare la control: cine l-a făcut și cu ce dovadă. Un fișier trimis pe e-mail nu răspunde. O listă de prezență semnată pe hârtie răspunde pe jumătate, până se pierde.",
      "Aici cursul are lecții, iar fiecare material își păstrează versiunile: când documentul se schimbă, versiunea veche rămâne, cu tot cu cine a parcurs-o. Progresul se salvează pe măsură ce omul citește, iar la final lecția se semnează. Testul, dacă există, are un prag și un rezultat păstrat.",
      "Atribuirea nu se face de mână, om cu om. Se scriu reguli — după departament, după funcție — și cursul ajunge singur la cine trebuie, inclusiv la angajații care vin peste șase luni.",
    ],
    actiuni: [
      {
        ce: "Vede cursurile și materialele",
        cheie: "courses:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Creează cursuri și lecții",
        cheie: "courses:create",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: null,
      },
      {
        ce: "Raportează progres, semnează, dă testul",
        cheie: "courses:update",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
    ],
    notaPermisiuni:
      "Aici e singurul modul din aplicație în care managerul poate CONSTRUI ceva, nu doar aproba: creează cursuri pentru echipa lui, deci își face singur materialele de instruire, fără să treacă prin HR. Angajatul are și el dreptul să modifice, dar numai ce e al lui — pare mult, până observi ce înseamnă: singurele lucruri pe care le poate schimba sunt propriul progres și propria semnătură pe lecție. Fără dreptul ăsta, cursul n-ar avea cine să-l parcurgă.",
    legaturi: [
      {
        catre: "onboarding",
        text: "Un pas din lista de integrare poate cere un curs, iar bifa se pune din progresul real.",
      },
      {
        catre: "ssm",
        text: "Instruirile periodice de securitatea muncii se pot ține ca materiale de curs, cu semnătura fiecăruia.",
      },
      {
        catre: "employee_portal",
        text: "Angajatul își parcurge cursurile din portal, de pe telefon, și își vede ce mai are de făcut.",
      },
    ],
    nuFace: [
      "Nu găzduiește filme proprii și nu le convertește în alt format. Materialele sunt documente și linkuri.",
      "Nu emite diplome sau certificate cu numărul lor. Rezultatul e o înregistrare, nu un act.",
      "Nu are forum, comentarii sau discuții între cursanți. E o bibliotecă cu evidență, nu o platformă de învățare socială.",
    ],
  },

  {
    cheie: "reges",
    actualizat: "2026-10-07",
    // „REGES-Online: …" e începutul titlului de pe `/reges-online` (ghidul de
    // termene); modulul ține intenția comercială (2 oct 2026).
    titluPagina: "Program REGES-Online (ex-Revisal), direct la ITM",
    titluH1: "Transmitere în REGES-Online",
    metaDescriere:
      "Cum se transmit contractele la REGES-Online (fostul Revisal) din Administrativo: mesaje pregătite din fișa angajatului, termene legale și răspunsuri urmărite.",
    intro: [
      "REGES-Online a înlocuit Revisal, iar odată cu el s-a schimbat și felul în care greșești: nu mai uiți să exporți un fișier, ci ratezi un termen. Fiecare eveniment din viața unui contract — angajare, modificare de salariu, suspendare, încetare — are propriul lui număr de zile până la care trebuie transmis, iar unele se numără în zile lucrătoare.",
      "Modulul nu doar descrie termenele astea: le calculează singur, pentru fiecare eveniment. Angajarea se transmite cel târziu în ziua anterioară începerii activității; suspendarea pentru absențe nemotivate are trei zile lucrătoare, fiindcă nu se poate anunța dinainte; reluarea se transmite în ziua în care omul se prezintă. Fiecare termen are temeiul lui legal scris lângă el, iar o firmă care vrea altceva își pune propria regulă, fără să aștepte o versiune nouă.",
      "Mesajul se compune din ce e deja în fișa angajatului — nu se retastează nimic. Înainte de trimitere se verifică, iar ce lipsește se spune pe nume: un spor care nu e încă legat de lista din REGES, un CNP absent, o funcție fără cod COR.",
    ],
    actiuni: [
      {
        ce: "Vede contractele și starea lor",
        cheie: "reges:read",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Pregătește un mesaj de transmis",
        cheie: "reges:create",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Corectează un mesaj înainte de trimitere",
        cheie: "reges:update",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Transmite efectiv la REGES",
        cheie: "reges:transmit",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Configurează accesul și nomenclatoarele",
        cheie: "reges:configure",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Exportă registrul",
        cheie: "reges:export",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
    ],
    cazDeUtilizare:
      "Se angajează cineva luni, iar contractul trebuie transmis cel târziu duminică — în ziua anterioară începerii activității. Persoana de la personal completează fișa omului, iar modulul construiește singur mesajul din ce e deja acolo: date de identificare, funcția cu codul COR, durata, salariul, sporurile. Înainte de trimitere verifică, iar ce lipsește se spune pe nume — un spor care nu e încă legat de lista din REGES, un CNP absent, o funcție fără cod. Mesajul care conține CNP-ul omului așteaptă până îl trimite cineva cu drept de transmitere. Răspunsul Inspecției Muncii se întoarce lângă mesaj, cu motivul unei respingeri scris pe înțeles, nu ca un cod. Termenul fiecărui eveniment îl calculează aplicația, nu un om din memorie, și se numără în zile lucrătoare acolo unde legea o cere.",
    leadRoluri:
      "REGES e modulul cel mai închis din aplicație: două roluri au acces, două n-au absolut nimic, nici măcar dreptul de a citi. Iar asta nu ține de un meniu ascuns: cine n-are acces nu ajunge la registru pe nicio cale.",
    leadLegaturi:
      "Registrul nu se completează de mână: contractul vine din fișa omului, suspendarea pentru absențe pornește din pontaj, iar concediile care suspendă contractul își generează singure evenimentul.",
    notaPermisiuni:
      "E cel mai închis modul din toată aplicația: două roluri au acces, celelalte două n-au absolut nimic — nici măcar dreptul de a citi. Nu e o scăpare, e forma corectă. Registrul de evidență a salariaților conține datele de identificare și salariile tuturor, iar un manager care își vede echipa în restul aplicației n-are ce căuta aici. Trimiterea e un drept separat de pregătire: cineva poate pregăti un mesaj fără să aibă voie să-l trimită, iar între cele două rămâne loc pentru o verificare.",
    legaturi: [
      {
        catre: "payroll",
        text: "Sporurile trimise în REGES odată cu salariul sunt aceleași pe care le calculează statul de plată.",
      },
      {
        catre: "attendance",
        text: "Suspendarea pentru absențe nemotivate pornește dintr-o decizie luată pe baza pontajului, nu dintr-o simplă notă.",
      },
      {
        catre: "leave",
        text: "Concediile care suspendă contractul își generează singure evenimentul de transmis, cu termenul lui.",
      },
    ],
    ghiduri: [
      { href: "/reges-online", eticheta: "REGES-ONLINE: termene și amenzi" },
      { href: "/ghid/control-itm", eticheta: "Ce se cere la un control ITM" },
    ],
    nuFace: [
      "Nu trimite singur datele cu CNP: mesajele cu datele salariatului se compun din fișa angajatului și așteaptă până le trimite cineva cu drept de transmitere. Mesajele de contract, fără date personale, pot pleca și automat, odată cu trimiterile periodice ale aplicației.",
      "Nu înlocuiește verificarea contabilului. Spune ce lipsește dintr-un mesaj, nu dacă un contract e corect juridic.",
      "Nu recuperează istoricul dinaintea intrării în aplicație. Contractele vechi se aduc la prima încărcare, apoi evidența curge de aici.",
    ],
  },
  {
    cheie: "evaluations",
    actualizat: "2026-10-07",
    titluPagina: "Evaluarea angajaților: criterii și istoric",
    titluH1: "Evaluarea angajaților",
    metaDescriere:
      "Cum se fac evaluările de performanță în Administrativo: șabloane refolosite, evaluare pe echipă, finalizare cu istoric. Evaluarea rămâne în dosarul omului.",
    intro: [
      "Evaluarea anuală ajunge de obicei un formular Word trimis pe e-mail, completat în grabă și salvat pe un desktop. Anul următor nimeni nu mai găsește ce s-a discutat, iar promisiunile făcute atunci n-au unde să fie verificate.",
      "Aici fiecare firmă își face șablonul de evaluare: criterii, ponderi, scală. Se copiază pentru anul următor în loc să fie rescris, iar cel vechi se arhivează fără să dispară — evaluările făcute pe el rămân citibile exact în forma în care au fost completate.",
      "Evaluarea în sine trece prin etape. Cât e deschisă se completează; la finalizare se închide, iar redeschiderea e o acțiune separată, care lasă urmă. Nu e o măsură de neîncredere, e felul în care o discuție de anul trecut poate fi arătată anul acesta fără dubii că a fost modificată între timp.",
    ],
    actiuni: [
      {
        ce: "Vede evaluările",
        cheie: "evaluations:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Creează șabloane și evaluări",
        cheie: "evaluations:create",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: null,
      },
      {
        ce: "Completează, finalizează, redeschide",
        cheie: "evaluations:update",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: null,
      },
    ],
    notaPermisiuni:
      "Angajatul apare în tabel o singură dată: își poate citi propria evaluare — și atât. Nu poate completa nimic, nici măcar o autoevaluare, fiindcă modulul nu are astăzi un pas de autoevaluare separat de restul formularului. E o limită reală, nu o alegere de securitate, și merită spusă ca atare. Managerul, în schimb, are drepturi complete pe echipa lui: creează, completează și finalizează fără să treacă prin HR.",
    legaturi: [
      {
        catre: "kpi",
        text: "Indicatorii lunari dau partea măsurabilă a discuției, ca să nu rămână doar pe impresii.",
      },
      {
        catre: "employee_portal",
        text: "Angajatul își citește evaluarea finalizată în portal, fără să o ceară de la nimeni.",
      },
      {
        catre: "courses",
        text: "Ce iese ca nevoie de instruire dintr-o evaluare se poate transforma într-un curs atribuit.",
      },
    ],
    ghiduri: [{ href: "/unelte/fisa-evaluare", eticheta: "Fișa de evaluare: model" }],
    nuFace: [
      "Nu are evaluare la 360 de grade. Nu se cer păreri de la colegi sau de la subordonați.",
      "Nu calculează singură un bonus din nota finală. Legătura cu salarizarea o face un om.",
      "Nu trimite reamintiri când o evaluare stă nefinalizată. Starea se vede în listă.",
    ],
  },

  {
    cheie: "kpi",
    actualizat: "2026-10-07",
    titluPagina: "KPI-uri: indicatori și ținte pe angajat",
    titluH1: "KPI-uri pe angajat",
    metaDescriere:
      "Cum se urmăresc indicatorii de performanță în Administrativo: seturi de KPI, ținte individuale, luni deschise și închise.",
    intro: [
      "Un indicator de performanță devine inutil în momentul în care nimeni nu mai știe ce valoare avea ținta când a fost stabilită. Foaia de calcul se rescrie peste, iar la discuția de final de an rămâne doar cifra de acum, nu și cea promisă atunci.",
      "Modulul separă cele trei lucruri care se amestecă de obicei: setul de indicatori — ce se măsoară, în ce unitate și dacă e mai bine să crească sau să scadă; ținta — pentru cine și cât, cu perioada ei; realizarea — valoarea lunii, completată și apoi finalizată.",
      "Totul se ține pe luni, iar fiecare lună trece prin pași, ca la pontaj: se deschide, se completează, se finalizează. O lună finalizată nu mai poate fi rescrisă pe ascuns; iar setul de indicatori se arhivează în loc să fie șters, ca lunile trecute să rămână citibile.",
    ],
    actiuni: [
      {
        ce: "Vede seturile, țintele și lunile",
        cheie: "evaluations:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Creează seturi de indicatori și ținte",
        cheie: "evaluations:create",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: null,
      },
      {
        ce: "Completează și finalizează luna",
        cheie: "evaluations:update",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: null,
      },
    ],
    notaPermisiuni:
      "Un lucru pe care nu-l observi folosind aplicația și pe care preferăm să-l spunem: KPI-urile nu au drepturi proprii, ci le folosesc pe cele de la evaluări. Cine poate evalua poate și seta ținte, iar cine nu poate evalua nu ajunge la indicatori. Consecința practică e că modulele astea două nu se pot despărți pe roluri — dacă vrei ca un manager să vadă KPI-urile fără să poată face evaluări, astăzi nu se poate. E o simplificare asumată, nu o scăpare.",
    legaturi: [
      {
        catre: "evaluations",
        text: "Indicatorii lunii intră în discuția de evaluare ca partea măsurabilă a ei.",
      },
      {
        catre: "rapoarte",
        text: "Valorile finalizate pe lună sunt cele care ajung mai departe în rapoarte.",
      },
      {
        catre: "employee_portal",
        text: "Omul își vede propriile ținte și cum stă față de ele, fără să întrebe.",
      },
    ],
    nuFace: [
      "Nu culege singur valorile din alte programe. Realizările se completează sau se importă, nu vin automat.",
      "Nu are grafice de tendință pe mai mulți ani. Se lucrează pe luni, iar comparația se face lună cu lună.",
      "Nu leagă indicatorul de un bonus calculat automat. Consecința rămâne o decizie de om.",
    ],
  },

  {
    cheie: "maintenance",
    actualizat: "2026-10-07",
    titluPagina: "Mentenanță: sesizări, planuri și ISCIR",
    titluH1: "Mentenanță și sesizări",
    metaDescriere:
      "Cum se ține mentenanța în Administrativo: sesizări deschise de orice angajat, contoare, planuri periodice, autorizații ISCIR cu scadențe.",
    intro: [
      "Defectul se vede primul de către omul care lucrează pe utilaj, nu de către cel care răspunde de el. Dacă sesizarea trebuie să treacă prin șeful de tură și printr-un telefon, jumătate din defecte nu ajung niciodată să fie scrise nicăieri.",
      "De aceea aici oricine poate deschide o sesizare, pe orice echipament. Ea se triază, primește un responsabil, iar rezolvarea rămâne cu intervenția ei: ce s-a făcut, când și de către cine. Istoricul echipamentului nu mai e memoria cuiva.",
      "Peste sesizări stau planurile: revizii la interval de timp sau la contor. Contorul se citește și se înregistrează, iar planul spune singur ce e scadent. Autorizațiile ISCIR își au scadențele lor, urmărite la fel — o autorizație expirată e o problemă legală, nu doar una de întreținere.",
    ],
    actiuni: [
      {
        ce: "Vede echipamentele și sesizările",
        cheie: "maintenance:read",
        orgAdmin: "all",
        hr: null,
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Deschide o sesizare",
        cheie: "maintenance:create",
        orgAdmin: "all",
        hr: null,
        manager: "all",
        angajat: "all",
      },
      {
        ce: "Triază, rezolvă, administrează planuri",
        cheie: "maintenance:update",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
    ],
    notaPermisiuni:
      "Rândul din mijloc e neobișnuit, dar e făcut dinadins: la deschiderea unei sesizări, în dreptul angajatului scrie „tot”, nu „ale lui”. Poate raporta un defect pe orice echipament din firmă, nu doar pe al lui — altfel utilajul pe lângă care tocmai a trecut ar rămâne nesemnalat. În schimb, vede doar echipamentele și sesizările care îl privesc. Coloana HR e goală de sus până jos: mentenanța nu e treaba lui. Iar un rol nu primește nimic din oficiu — ce nu i s-a dat, nu poate face.",
    legaturi: [
      {
        catre: "inventory",
        text: "Ce se predă unui om ca obiect de inventar și ce se întreține ca echipament sunt evidențe separate, dinadins.",
      },
      {
        catre: "fleet",
        text: "Mașinile au propriul lor modul, cu foi de parcurs și documente; aici stau utilajele și echipamentele fixe.",
      },
      {
        catre: "ssm",
        text: "Un echipament cu autorizație expirată apare și în evidența de conformitate, nu doar în listele de mentenanță.",
      },
    ],
    nuFace: [
      "Nu se leagă la senzori sau la automatizările utilajelor (SCADA). Contoarele se citesc de pe aparat și se trec de mână.",
      "Nu ține stoc de piese de schimb și nu comandă nimic de la furnizori.",
      "Nu calculează costul intervenției pe manoperă și materiale. Notează ce s-a făcut, nu cât a costat.",
    ],
  },

  {
    cheie: "inventory",
    actualizat: "2026-10-07",
    titluPagina: "Inventar: obiectele firmei, pe angajat",
    titluH1: "Inventarul firmei, pe angajat",
    metaDescriere:
      "Cum se ține inventarul de obiecte în Administrativo: predare cu confirmare, returnare, casare, obiecte pe fiecare angajat. Angajatul confirmă ce primește.",
    intro: [
      "Laptopul, telefonul, scula, cheia de la depozit — lucrurile firmei aflate la oameni sunt aproape întotdeauna scrise într-un fișier pe care îl ține o singură persoană, și care rămâne în urmă din prima lună. La plecarea unui angajat urmează o discuție incomodă despre ce mai avea la el.",
      "Aici obiectul are un traseu complet: intră în stoc, se predă unei persoane, ea confirmă primirea, se returnează sau se casează. Fiecare pas rămâne cu data lui, iar unde se află obiectul acum nu e o părere: reiese din pașii înregistrați.",
      "Confirmarea primirii e a angajatului, nu a celui care predă. Diferența pare mică, dar exact ea transformă o listă într-o dovadă: cine a primit a spus el că a primit.",
    ],
    actiuni: [
      {
        ce: "Vede obiectele și cine le are",
        cheie: "inventory:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Adaugă, predă, returnează, casează",
        cheie: "inventory:update",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
    ],
    notaPermisiuni:
      "Tabelul are doar două rânduri, și asta spune ceva despre modul: tot ce schimbă evidența — adăugarea unui obiect nou, predarea, returnarea, casarea, readucerea în stoc — ține de un singur drept. Nu se dă separat dreptul de a adăuga și cel de a muta un obiect, deci cine poate preda un laptop poate și adăuga unul nou în evidență. Managerul nu poate modifica nimic aici: vede ce are echipa lui, dar predarea rămâne la HR sau la administrator. Confirmarea primirii, în schimb, o face angajatul din portal, pentru obiectele primite de el.",
    legaturi: [
      {
        catre: "employee_portal",
        text: "Angajatul își vede obiectele primite și confirmă primirea de pe telefon, cu data ei.",
      },
      {
        catre: "onboarding",
        text: "Predarea echipamentului la angajare poate fi un pas din lista de integrare, cu dovadă.",
      },
      {
        catre: "ssm",
        text: "Echipamentul individual de protecție se predă separat, în evidența SSM, cu regulile lui de înlocuire.",
      },
    ],
    nuFace: [
      "Nu ține gestiune contabilă, nu amortizează și nu are valoare de inventar în bilanț.",
      "Nu citește coduri de bare sau etichete RFID. Obiectele se caută după nume și după serie.",
      "Nu gestionează stocuri de consumabile pe cantități. Un obiect e o bucată, cu un traseu al ei.",
    ],
  },

  {
    cheie: "ticketing",
    actualizat: "2026-10-07",
    titluPagina: "Ticketing intern pentru IT și administrativ",
    titluH1: "Ticketing intern",
    metaDescriere:
      "Cum funcționează tichetele interne în Administrativo: oricine deschide, coada pe echipă, preluare și rezolvare.",
    intro: [
      "Cererile interne — „nu merge imprimanta”, „am nevoie de acces la dosarul X”, „îmi trebuie un monitor” — circulă de obicei pe chat și pe hol. Se rezolvă, uneori, dar nimeni nu poate spune la sfârșitul lunii câte au fost și cât au durat.",
      "Un tichet aici are cine l-a deschis, pe cine cade, în ce stare e și ce s-a răspuns. Coada se vede pe echipă, nu pe persoană, deci un coleg poate prelua când altul lipsește, fără ca cererea să se piardă între doi oameni care presupun fiecare că se ocupă celălalt.",
      "Modulul e deliberat mic. Nu încearcă să fie un sistem de ticketing pentru clienți externi; e locul unde cererile dintre colegi capătă un număr și un răspuns.",
    ],
    actiuni: [
      {
        ce: "Vede tichetele",
        cheie: "tickets:read",
        orgAdmin: "all",
        hr: "own",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Deschide un tichet",
        cheie: "tickets:create",
        orgAdmin: "own",
        hr: "own",
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Răspunde și schimbă starea",
        cheie: "tickets:update",
        orgAdmin: "all",
        hr: "own",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Închide tichetul",
        cheie: "tickets:approve",
        orgAdmin: "all",
        hr: null,
        manager: "team",
        angajat: null,
      },
    ],
    notaPermisiuni:
      "Două lucruri ies în evidență. Primul: la deschiderea unui tichet, în dreptul tuturor celor patru roluri scrie „ale lui” — inclusiv la administrator. Nimeni nu poate deschide un tichet în numele altcuiva, fiindcă un tichet e o cerere, iar cererea aparține celui care o face. Al doilea: HR are aici exact drepturile unui angajat obișnuit, doar pe tichetele lui. E singurul modul din aplicație în care HR nu are acces extins — nu e o omisiune, e recunoașterea că o cerere către IT nu ține de resurse umane.",
    legaturi: [
      {
        catre: "employee_portal",
        text: "Omul își deschide tichetul și își urmărește răspunsul din portal, de pe telefon.",
      },
      {
        catre: "maintenance",
        text: "Un defect la un utilaj se raportează ca sesizare de mentenanță, nu ca tichet; sunt evidențe separate.",
      },
      {
        catre: "inventory",
        text: "O cerere de echipament se poate termina cu o predare înregistrată în inventar, pe numele omului.",
      },
    ],
    nuFace: [
      "Nu are timpi de răspuns garantați, nici alarme când un tichet stă prea mult.",
      "Nu primește tichete pe e-mail și nu răspunde pe e-mail. Totul stă în aplicație.",
      "Nu e pentru clienți din afara firmei. Cine deschide un tichet trebuie să fie angajat al firmei.",
    ],
  },
  {
    cheie: "announcements",
    actualizat: "2026-10-07",
    titluPagina: "Anunțuri interne cu dovadă că au ajuns",
    titluH1: "Anunțuri interne cu confirmare",
    metaDescriere:
      "Cum se transmit anunțurile interne în Administrativo: ciornă, publicare către toată firma și confirmare de citire pe fiecare om.",
    intro: [
      "Anunțul intern trimis pe e-mail sau pe un grup de chat are o problemă pe care nimeni n-o observă până nu e nevoie de ea: nu se poate arăta cine l-a citit. Iar unele lucruri — o schimbare de program, o regulă nouă de acces, o notificare cerută de lege — chiar trebuie să poată fi dovedite.",
      "Aici anunțul are o ciornă și o publicare distinctă. Cât e ciornă se scrie și se reformulează; la publicare pleacă spre toată firma și rămâne cu data lui. Citirea se înregistrează pe fiecare persoană, deci lista celor care încă n-au deschis anunțul e o listă reală, nu o presupunere.",
      "Anunțurile ajung și în aplicație, și în portalul angajatului, și ca notificare pe telefon dacă omul a pornit-o. Același conținut, un singur loc de scris.",
    ],
    actiuni: [
      {
        ce: "Citește anunțurile și confirmă citirea",
        cheie: "announcements:read",
        orgAdmin: "all",
        hr: "all",
        manager: "all",
        angajat: "all",
      },
      {
        ce: "Scrie un anunț nou",
        cheie: "announcements:create",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
      {
        ce: "Modifică și publică",
        cheie: "announcements:update",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: null,
      },
    ],
    notaPermisiuni:
      "E singurul modul din aplicație în care toate cele patru roluri au „tot” pe același rând: anunțurile le citește toată lumea, pe toate, fără excepție. Scrisul, în schimb, e închis la două roluri — un manager nu poate publica un anunț pe firmă, oricât de mult l-ar privi echipa lui. Un detaliu care surprinde: când omul confirmă că a citit, înregistrează ceva în aplicație, dar pentru asta îi ajunge dreptul de CITIRE. Altfel n-ar avea logică — cine are voie să vadă anunțul trebuie să poată confirma că l-a văzut.",
    legaturi: [
      {
        catre: "employee_portal",
        text: "Anunțul apare în portal și ca notificare pe telefon, dacă omul și-a pornit notificările.",
      },
      {
        catre: "onboarding",
        text: "Regulamentul intern se dă la angajare ca pas cu confirmare, nu ca anunț către toți.",
      },
      {
        catre: "nucleu",
        text: "Cine a citit și când rămâne în jurnalul de audit, alături de restul acțiunilor.",
      },
    ],
    nuFace: [
      "Nu are răspunsuri, comentarii sau reacții. E un canal într-un singur sens.",
      "Nu programează publicarea la o dată viitoare. Anunțul pleacă atunci când e publicat.",
      "Nu trimite pe e-mail. Ajunge în aplicație, în portal și ca notificare pe telefon.",
    ],
  },

  {
    cheie: "employee_portal",
    actualizat: "2026-10-07",
    titluPagina: "Portalul angajatului, de pe telefon",
    titluH1: "Portalul angajatului",
    metaDescriere:
      "Ce vede un angajat în portalul Administrativo: fluturașul, soldul de concediu, pontajul, cursurile, documentele. Cum e limitat accesul la propriile date.",
    intro: [
      "Cele mai multe întrebări care ajung la HR au același răspuns scris deja undeva: câte zile de concediu mai am, unde e adeverința de venit, ce am semnat luna trecută, cât mi-a intrat pe card. Fiecare dintre ele costă o întrerupere și un e-mail.",
      "Portalul e locul unde omul își vede propriile lucruri, fără să ceară nimănui nimic. Se deschide în browserul telefonului, se poate adăuga pe ecranul principal ca o aplicație, și nu cere instalare, VPN sau vreun cont special în rețeaua firmei.",
      "Nu e o aplicație separată, cu datele ei. Sunt aceleași date cu care lucrează biroul, după aceleași reguli — doar că omul le vede numai pe ale lui.",
    ],
    actiuni: [
      {
        ce: "Își vede propria fișă",
        cheie: "employees:read",
        orgAdmin: "all",
        hr: "all",
        manager: "team",
        angajat: "own",
      },
      {
        ce: "Își pontează ziua",
        cheie: "attendance:create",
        orgAdmin: "all",
        hr: "all",
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Își depune cererea de concediu",
        cheie: "leave:create",
        orgAdmin: "all",
        hr: "all",
        manager: "own",
        angajat: "own",
      },
      {
        ce: "Își vede fluturașul",
        cheie: "payroll:read",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: "own",
      },
      {
        ce: "Își face decontul de deplasare",
        cheie: "per_diem:create",
        orgAdmin: "all",
        hr: null,
        manager: "own",
        angajat: "own",
      },
    ],
    cazDeUtilizare:
      "Un om vrea să știe câte zile de concediu i-au rămas, la 9 seara. În loc să scrie pe grupul de WhatsApp și să aștepte până a doua zi, deschide portalul de pe telefon — adresa e pe ecranul principal, adăugată o singură dată, fără instalare din magazin. Vede soldul pe fiecare tip de concediu, luna lui de pontaj, fluturașul, cursurile pe care le are de parcurs și documentele primite. De acolo depune direct cererea, iar ea ajunge la același aprobator ca oricare alta, cu același sold în spate. Ce nu e al lui nu apare deloc: portalul nu are reguli proprii, ci fiecare ecran le urmează pe ale modulului din care vin datele.",
    notaPermisiuni:
      "Portalul nu are reguli proprii, și asta e partea importantă. Fiecare ecran din el cere exact dreptul din modulul de unde vin datele, limitat la „ale lui”. Consecința: nu există un drum prin portal care să ocolească o regulă din aplicație, fiindcă e aceeași regulă, verificată în același loc. Coloana „Angajat” din tabelul de mai sus spune, de fapt, tot ce face portalul. Iar restul coloanelor arată de ce nu e nevoie de un al doilea sistem: aceleași drepturi se aplică și pe ecranele de birou.",
    legaturi: [
      {
        catre: "attendance",
        text: "Pontarea de pe telefon intră direct pe foaia lunară, ca orice altă zi.",
      },
      {
        catre: "payroll",
        text: "Fluturașul e cel generat de calculul lunii, nu o copie trimisă separat.",
      },
      {
        catre: "leave",
        text: "Cererea depusă din portal ajunge la același aprobator, cu același sold.",
      },
    ],
    ghiduri: [{ href: "/pontaj-pe-telefon", eticheta: "Cum se pontează de pe telefon" }],
    nuFace: [
      "Nu e o aplicație din magazinul de aplicații. Se deschide în browser și se poate pune pe ecranul principal.",
      "Nu arată CNP-ul sau IBAN-ul, nici măcar propriile. Datele sensibile rămân închise în fișa de birou.",
      "Nu permite modificarea datelor personale. Schimbarea adresei sau a contului se cere, nu se face direct.",
    ],
  },

  {
    cheie: "rapoarte",
    actualizat: "2026-10-07",
    titluPagina: "Rapoarte HR din datele care există deja",
    titluH1: "Rapoarte HR",
    metaDescriere:
      "Ce rapoarte scoate Administrativo: situații pe salarizare și pe lună, din aceleași date care au fost aprobate. Cine ce poate vedea, pe roluri.",
    intro: [
      "Un raport făcut prin copierea datelor în altă foaie de calcul e greșit din momentul în care cineva mai corectează ceva la sursă. Iar corecțiile vin întotdeauna după ce raportul a fost trimis.",
      "Aici raportul se calculează din datele care au trecut deja prin aprobare — luna închisă la pontaj, perioada de salarizare aprobată — nu dintr-o copie. Dacă luna sau perioada se redeschide și se corectează ceva, se schimbă și cifra din raport.",
      "Modulul e deliberat îngust astăzi: acoperă zona de salarizare și situațiile lunare care se cer cel mai des. Restul datelor se exportă din modulele lor, unde contextul e complet.",
    ],
    actiuni: [
      {
        ce: "Vede situațiile pe lună",
        cheie: "payroll:read",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: "own",
      },
      {
        ce: "Recalculează o perioadă",
        cheie: "payroll:create",
        orgAdmin: "all",
        hr: "all",
        manager: "none",
        angajat: null,
      },
    ],
    notaPermisiuni:
      "Trebuie spus limpede, fiindcă din aplicație nu se vede: rapoartele nu au drepturi separate. Cine le vede se decide după datele pe care le adună — astăzi, cele de salarizare. Consecința e că accesul la rapoarte nu se poate da separat: cine vede rapoartele vede și salarizarea, iar managerul, căruia salarizarea îi e închisă dinadins, nu ajunge deloc la ele. E o limită asumată a formei de acum, nu o regulă de securitate gândită dinainte, și se va schimba când modulul va acoperi și alte zone.",
    legaturi: [
      {
        catre: "payroll",
        text: "Sursa cifrelor e perioada de salarizare aprobată, cu componentele ei deja calculate.",
      },
      {
        catre: "attendance",
        text: "Orele care intră în raport sunt cele din lunile închise, nu din zilele în lucru.",
      },
      {
        catre: "kpi",
        text: "Indicatorii finalizați pe lună sunt o sursă separată, cu propria ei evidență.",
      },
    ],
    nuFace: [
      "Nu are un editor de rapoarte: situațiile sunt cele pregătite deja, nu se pot compune altele noi.",
      "Nu trimite rapoarte programate pe e-mail. Se deschid când sunt cerute.",
      "Nu acoperă încă toate modulele. Zonele neacoperite se exportă din modulul lor.",
    ],
  },

  {
    cheie: "nucleu",
    actualizat: "2026-10-07",
    titluPagina: "Evidența angajaților: fișe, roluri și audit",
    titluH1: "Evidența angajaților, roluri și audit",
    metaDescriere:
      "Evidența angajaților în Administrativo: fișa fiecărui om, import din Excel, roluri și drepturi pe om, jurnal de audit. Ce decide firma bate setarea implicită.",
    intro: [
      "Nucleul nu e un modul care se cumpără, e ce rămâne când le scoți pe toate celelalte: firma, oamenii care intră în aplicație, rolurile lor și urma pe care o lasă fiecare acțiune.",
      "Sunt cinci roluri, iar ce poate face fiecare om se ajustează din aplicație, fără să ne ceri nouă. Când realitatea nu încape în rol, unui singur om i se poate da sau lua un drept anume — un contabil care trebuie să vadă un raport în plus nu are nevoie de o versiune nouă a aplicației.",
      "Datele unei firme nu se văd din contul alteia, nici din greșeală. Separarea nu depinde de un filtru pe care cineva l-ar putea uita: dacă undeva lipsește o regulă, omul vede o listă goală, nu datele altei firme. Pentru omul de IT: izolarea e impusă de baza de date, pe fiecare tabelă, nu de filtre scrise în aplicație.",
    ],
    actiuni: [
      {
        ce: "Vede utilizatorii",
        cheie: "users:read",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: "own",
      },
      {
        ce: "Invită un utilizator",
        cheie: "users:create",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
      {
        ce: "Schimbă starea unui utilizator",
        cheie: "users:update",
        orgAdmin: "all",
        hr: null,
        manager: null,
        angajat: null,
      },
      {
        ce: "Schimbă rolul cuiva",
        cheie: "roles:update",
        orgAdmin: "all",
        hr: null,
        manager: "team",
        angajat: null,
      },
      {
        ce: "Citește jurnalul de audit",
        cheie: "audit:read",
        orgAdmin: "all",
        hr: "none",
        manager: "none",
        angajat: "none",
      },
    ],
    notaPermisiuni:
      "Tabelul ăsta e cel mai instructiv din toate. HR — rolul care se ocupă de oameni în toată aplicația — n-are niciun drept asupra conturilor de acces: poate ține fișa unui angajat, dar nu poate da nimănui acces în aplicație. Sunt două lucruri diferite, iar aici se vede că sunt tratate ca atare. Jurnalul de audit e închis dinadins pentru trei roluri din patru: nu e o scăpare, e o decizie. Iar managerul poate face un singur lucru aici, și doar în echipa lui: poate schimba rolul cuiva — așa devine manager un șef de departament, fără să treacă pe la administrator.",
    legaturi: [
      {
        catre: "employee_portal",
        text: "Invitația trimisă unui angajat îi deschide portalul, cu propriile lui date și nimic în plus.",
      },
      {
        catre: "onboarding",
        text: "Crearea contului e de obicei un pas din lista de integrare, cu responsabil și termen.",
      },
      {
        catre: "asistent",
        text: "Asistentul nu are drepturi proprii: ajunge exact unde ajunge omul care întreabă.",
      },
    ],
    nuFace: [
      "Nu permite intrarea în aplicație cu contul de Google sau cu cel din rețeaua firmei (Active Directory).",
      "Firma nu își poate crea roluri noi. Cele cinci sunt fixe; se ajustează doar drepturile din ele, pe om.",
      "Nu șterge date. Ce iese din uz se marchează ca șters și rămâne în jurnal.",
    ],
  },

  {
    cheie: "asistent",
    actualizat: "2026-10-07",
    titluPagina: "Asistent AI în română pentru aplicația HR",
    titluH1: "Asistent AI pentru HR",
    metaDescriere:
      "Ce face asistentul din Administrativo: răspunde la întrebări despre propriile date și duce în ecranul potrivit, fără să vadă mai mult decât vede utilizatorul.",
    intro: [
      "O aplicație cu nouăsprezece module are o problemă pe care n-o rezolvă niciun meniu: omul știe ce vrea, dar nu știe unde se face. „Cum cer concediu”, „unde văd cine n-a făcut instruirea”, „de ce nu pot închide luna” — fiecare are un răspuns într-un ecran, iar drumul până la el e cunoscut doar de cine folosește aplicația zilnic.",
      "Asistentul răspunde în română și, când răspunsul e un ecran, duce direct acolo. Nu e un chat separat de aplicație: vede aceleași date, prin aceleași reguli, pentru omul care întreabă.",
      "Partea importantă e ce NU poate. Asistentul nu are drepturi proprii — nici un rol al lui, nici vreun acces separat. Ce poate atinge se stabilește din drepturile celui care întreabă și din modulele pornite pe firmă. Un angajat care întreabă despre salariile colegilor primește același refuz pe care l-ar primi dacă ar deschide ecranul direct, fiindcă e exact același refuz, verificat în același loc. Nu există o cale ocolită prin întrebare.",
      "Modulul se poate opri de tot, pe firmă, dintr-un singur comutator. Cu el stins, nu dispare doar butonul: asistentul nu mai poate fi folosit deloc, nici de cineva care i-ar ști adresa.",
    ],
    actiuni: [],
    notaPermisiuni:
      "Asistentul nu are un tabel de roluri fiindcă n-are permisiuni proprii: accesul lui e, literal, accesul celui care întreabă.",
    legaturi: [
      {
        catre: "nucleu",
        text: "Asistentul are exact drepturile omului care întreabă, nimic în plus.",
      },
      {
        catre: "employee_portal",
        text: "Din portal, întrebările unui angajat ajung tot la propriile lui date, niciodată la ale altcuiva.",
      },
      {
        catre: "attendance",
        text: "Cele mai multe întrebări duc în pontaj: cum se închide luna, de ce o zi nu se poate corecta.",
      },
    ],
    nuFace: [
      "Nu completează formulare și nu apasă butoane în locul omului. Duce în ecran, restul se face de mână.",
      "Nu învață din datele firmei și nu antrenează nimic pe ele.",
      "Nu funcționează fără legătura cu furnizorul de inteligență artificială, care se configurează separat de comutatorul modulului.",
    ],
  },
];

/** Fișa unui modul, dacă are una. Cele fără fișă rămân pe conținutul din catalog. */
export function fisaModulului(cheie: string): FisaModul | undefined {
  return FISE.find((f) => f.cheie === cheie);
}
