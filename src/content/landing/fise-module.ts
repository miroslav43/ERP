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
  /** Titlul paginii, mai lung și mai căutabil decât cel din catalog. */
  titluPagina: string;
  metaDescriere: string;
  /** Proză proprie, care NU repetă textul din catalog. */
  intro: readonly string[];
  actiuni: readonly ActiuneModul[];
  /** Fraza care explică surpriza din tabel. E partea cea mai citată. */
  notaPermisiuni: string;
  legaturi: readonly Readonly<{ catre: FeatureKey; text: string }>[];
  nuFace: readonly string[];
}>;

export const FISE: readonly FisaModul[] = [
  {
    cheie: "attendance",
    titluPagina: "Pontaj: foaia lunară, aprobarea și evidența cerută de lege",
    metaDescriere:
      "Cum se ține pontajul în Administrativo: foaia colectivă lunară, pontarea de pe telefon, aprobarea pe echipă și blocarea lunii. Cine ce poate face, pe roluri.",
    intro: [
      "Pontajul e modulul din care iese aproape tot restul: sporurile, statul de plată și dovada la un control. De aceea are cea mai strictă separare de roluri din toată aplicația.",
      "Luna are o stare. Cât e deschisă, zilele se completează și se corectează; când e închisă, nu se mai poate edita nici din greșeală, iar ce s-a schimbat până atunci rămâne în jurnal, cu cine și când. Închiderea nu e o convenție de echipă, e o tranziție pe care baza o refuză dacă nu vine de la cine trebuie.",
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
        ce: "Pontează o zi",
        cheie: "attendance:create",
        orgAdmin: "all",
        hr: "all",
        manager: null,
        angajat: "own",
      },
      {
        ce: "Corectează o zi pontată",
        cheie: "attendance:update",
        orgAdmin: "all",
        hr: "all",
        manager: null,
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
    notaPermisiuni:
      "Două lucruri din tabelul de mai sus surprind pe toată lumea. Un manager poate aproba pontajul echipei, dar nu poate ponta și nu poate corecta — separarea dintre cine execută și cine confirmă e impusă în baza de date, nu lăsată la disciplina echipei. Iar HR, care poate scrie orice zi din orice lună, nu poate aproba: are refuz explicit pe aprobare. Închiderea lunii rămâne la șeful echipei sau la administrator.",
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
    nuFace: [
      "Nu citește pontaje de la cititoare de cartelă sau de amprentă. Zilele se completează de om, din browser.",
      "Nu urmărește poziția telefonului. Locul de muncă se alege dintr-o listă, nu se deduce din GPS.",
      "Nu calculează singur programul de lucru din ture generate automat. Turele se configurează, apoi zilele se completează pe ele.",
    ],
  },

  {
    cheie: "ssm",
    titluPagina: "SSM și PSI: instruiri, aptitudini și echipament cu scadență",
    metaDescriere:
      "Matrice angajat × tip de instruire, cu semafor pe scadențe și „niciodată făcută” ca stare distinctă de „expirată”. Cine ce poate face, pe roluri.",
    intro: [
      "Modulul de SSM e cel de la care pornesc aproape toate firmele de construcții, dintr-un motiv simplu: are cea mai scurtă distanță până la o problemă reală. O instruire expirată se vede la primul control și nu poate fi reparată retroactiv.",
      "Evidența e o matrice: fiecare angajat pe verticală, fiecare tip de instruire pe orizontală, cu starea în celulă. Distincția care contează e că „niciodată făcută” nu se confundă cu „expirată” — a doua înseamnă că cineva s-a ocupat cândva, prima că omul n-a fost instruit niciodată, iar la un control diferența e între o abatere și o problemă.",
      "Aceeași scadență o poartă aptitudinile medicale și echipamentul individual de protecție dat în primire. Semaforul se aprinde înainte de termen, nu la el.",
    ],
    actiuni: [
      {
        ce: "Vede matricea și scadențele",
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
    notaPermisiuni:
      "SSM e modulul lui HR: scrie tot, la fel ca administratorul. Managerul vede doar echipa lui și nu poate scrie nimic — poate afla că unui om îi expiră instruirea, dar nu poate declara că a făcut-o. Angajatul își vede propriile instruiri și propriul echipament, atât. Merită știut că HR administrează SSM-ul, dar nu are acces la modulul de conformitate, unde stau termenele firmei: sunt două zone separate, cu roluri separate.",
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
    nuFace: [
      "Nu ține locul serviciului extern de prevenire și protecție. Ține evidența, nu întocmește documentația de securitate.",
      "Nu generează fișele de instruire ca documente semnate legal. Reține că instruirea a avut loc, când și de către cine.",
      "Nu evaluează riscurile și nu produce planul de prevenire și protecție.",
    ],
  },

  {
    cheie: "payroll",
    titluPagina: "Salarizare: calcul pas cu pas, cu cotele firmei tale",
    metaDescriere:
      "Calcul salarial cu desfășurător și avertismente, pornit din luna de pontaj închisă. Cotele sunt versionate cu data de la care se aplică. Cine ce poate face, pe roluri.",
    intro: [
      "Calculul nu e o cutie neagră care scoate o cifră. Merge pas cu pas, cu desfășurător pe fiecare linie și cu avertismente unde ceva arată neobișnuit — un spor care sare, o lună cu mai puține zile decât ar trebui, un om fără contract activ.",
      "Cotele sunt ale firmei tale și sunt versionate cu data de la care se aplică. Niciuna nu e scrisă în cod. Când se schimbă o cotă, se adaugă o versiune nouă cu data ei, iar lunile deja calculate rămân cu cotele care erau valabile atunci — recalcularea trecutului nu se întâmplă din greșeală.",
      "Intrarea e luna de pontaj închisă, cu orele suplimentare și cele de noapte deja separate. Nu se retastează nimic din pontaj în salarizare, fiindcă nu sunt două evidențe.",
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
    notaPermisiuni:
      "Managerul are refuz explicit pe fiecare acțiune din salarizare — nu absența unui rând, ci un „nu” scris în baza de date. E o decizie, nu o omisiune: șeful de echipă aprobă pontajul oamenilor lui, dar nu vede ce câștigă. Angajatul își vede și își descarcă propriul fluturaș, și numai pe al lui; CNP-ul și IBAN-ul rămân închise chiar și pentru roluri care văd restul fișei.",
    legaturi: [
      {
        catre: "attendance",
        text: "Luna închisă e intrarea calculului. Fără ea, nu se pornește.",
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
    nuFace: [
      "Nu depune D112 și nu comunică cu ANAF. Produce datele; depunerea rămâne la contabil.",
      "Nu face contabilitate. Nu ține registre contabile, nu emite facturi și nu întocmește bilanțul.",
      "Nu execută plăți. Nu se leagă la bancă și nu generează ordine de plată.",
      "Valorile legale — plafoane, cote implicite — se confirmă de contabil înainte de primul calcul real.",
    ],
  },

  {
    cheie: "fleet",
    titluPagina: "Parc auto: ITP, RCA, rovinietă și foi de parcurs",
    metaDescriere:
      "Termenele fiecărei mașini cu semafor înainte de scadență, foi de parcurs cu kilometraj și alimentări. Cine ce poate face, pe roluri.",
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
    notaPermisiuni:
      "Parcul auto e cel mai închis modul din aplicație: mașinile le vede și le administrează doar administratorul organizației. HR nu are nimic aici, iar angajatul nu are nimic. Managerul face excepție doar pe foile de parcurs — le vede și le aprobă pe ale echipei lui, dar nu le poate întocmi, aceeași separare între execuție și confirmare ca la pontaj.",
    legaturi: [
      {
        catre: "maintenance",
        text: "Reviziile se scadențează pe kilometraj sau pe dată, cu alertă la cea care vine prima.",
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
    nuFace: [
      "Nu urmărește mașinile prin GPS și nu se leagă la niciun sistem de telemetrie.",
      "Nu citește cardurile de tahograf și nu calculează timpii de conducere și odihnă.",
      "Nu plătește rovinieta și nu cumpără asigurări. Reține termenele; plata rămâne în altă parte.",
    ],
  },

  {
    cheie: "per_diem",
    titluPagina: "Diurne și deplasări: ferestre de 24 de ore, pe țări",
    metaDescriere:
      "Ordine de deplasare, etape pe țări și deconturi, cu ferestre de 24 de ore care curg de la plecare. Cine ce poate face, pe roluri.",
    intro: [
      "Diurna externă nu se socotește pe zile calendaristice. Se socotește pe ferestre de 24 de ore care curg de la ora plecării, nu de la miezul nopții, iar o deplasare care traversează mai multe țări are etape cu plafoane diferite. Făcut cu mâna, e locul cu cele mai multe greșeli din toată salarizarea.",
      "Fluxul are trei pași: ordinul de deplasare, etapele efective și decontul. Fiecare pas se poate întoarce la cel dinainte fără să se piardă ce era completat.",
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
        manager: null,
        angajat: "own",
      },
      {
        ce: "Completează etapele și decontul",
        cheie: "per_diem:update",
        orgAdmin: "all",
        hr: null,
        manager: null,
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
        manager: null,
        angajat: "own",
      },
    ],
    notaPermisiuni:
      "Diurnele sunt singurul modul în care omul care pleacă în deplasare își conduce singur dosarul: cere, completează etapele, face decontul și poate șterge cererea cât timp e a lui. Managerul aprobă echipa, dar nu poate completa în locul nimănui. HR nu are nicio permisiune aici — e un flux între angajat, șeful lui și administrator.",
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
    titluPagina: "Concedii: cererea, aprobarea și soldul de zile care se scade singur",
    metaDescriere:
      "Cum se cer și se aprobă concediile în Administrativo: soldul pe fiecare tip, aprobarea pe echipă, trecerea automată pe pontaj. Cine ce poate face, pe roluri.",
    intro: [
      "Concediul e locul unde se văd cel mai repede consecințele unei evidențe ținute în fișiere de calcul: două persoane din aceeași echipă plecate în aceeași săptămână, un sold de zile pe care fiecare îl calculează altfel și o cerere aprobată pe e-mail, care nu ajunge niciodată pe pontaj.",
      "Aici cererea are un drum cu stări. Cât e ciornă, o poți schimba sau șterge. După trimitere trece la cine aprobă, iar decizia — da sau nu — rămâne cu numele și ora ei. Soldul se scade la aprobare, nu la cerere, și se pune la loc dacă cererea se anulează. Nimeni nu ține un al doilea calcul pe hârtie.",
      "Tipurile de concediu se configurează pe firmă: câte zile dă fiecare, dacă cere document justificativ, dacă suspendă contractul. Concediul medical suspendă contractul și se raportează ca atare; odihna nu. Diferența nu e o etichetă, e o regulă pe care baza o aplică.",
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
    notaPermisiuni:
      "Managerul e cazul care surprinde. Vede cererile întregii echipe și le aprobă, dar poate depune și modifica numai pe ale lui: nu poate cere concediu în numele unui subordonat, oricât de bine ar cunoaște situația. Iar HR, care are acces la toate cererile și le poate chiar șterge, are refuz explicit pe aprobare — un „none” scris în tabel, nu o omisiune. Cine ține evidența nu e cine decide, și baza ține minte diferența.",
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
      "Nu dă concedii pe jumătate de zi. Baza refuză orice altceva decât zile întregi, printr-o constrângere, nu printr-o convenție.",
      "Nu decide singură dacă o cerere se suprapune cu alta din echipă. Arată suprapunerea celui care aprobă și îl lasă pe el să hotărască.",
      "Nu trimite concediul medical mai departe la Casa de Sănătate. Îl înregistrează, îl pune pe pontaj și îl pregătește pentru declarație.",
    ],
  },

  {
    cheie: "onboarding",
    titluPagina: "Integrare angajați: lista de pași la angajare, cu dovezi și termene",
    metaDescriere:
      "Cum se face integrarea unui angajat nou în Administrativo: șabloane de pași, dovezi încărcate, confirmare de citire, termene urmărite. Cine ce poate face, pe roluri.",
    intro: [
      "Prima săptămână a unui angajat e locul în care se pierd cele mai multe documente. Fișa postului semnată, instruirea introductivă, predarea laptopului, cititul regulamentului intern — fiecare există undeva, la cineva, și nimeni nu are lista completă în ziua în care vine controlul.",
      "Modulul face din lista aia un obiect cu stare. Se pornește un șablon pe angajatul nou, fiecare pas are un responsabil și un termen, iar pașii care cer o dovadă nu se pot bifa fără ea: documentul se încarcă, rămâne atașat pasului și se vede cine l-a pus și când.",
      "Șabloanele se scriu o dată, pe firmă, și se refolosesc. Se poate porni de la unul de platformă și se poate rescrie cu totul — restabilirea la varianta inițială există, ca să nu rămâi blocat după o editare nefericită.",
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
      "Tabelul descrie un flux cu trei mâini. HR construiește șabloanele și pornește listele; managerul nu poate crea nimic, dar bifează pașii care îi revin lui și declară integrarea încheiată pentru oamenii din echipa lui; angajatul își vede propria listă și își bifează propriii pași — confirmarea că a citit regulamentul e o acțiune a lui, nu una făcută în numele lui. Nimeni nu poate bifa în locul altcuiva, fiindcă domeniul „own” e verificat pe rândul din bază, nu pe ecran.",
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
    titluPagina: "Cursuri: materiale, lecții, teste și dovada că omul chiar a parcurs",
    metaDescriere:
      "Cum se țin cursurile interne în Administrativo: materiale versionate, lecții cu semnătură, teste cu prag, atribuire pe reguli. Cine ce poate face, pe roluri.",
    intro: [
      "Un curs intern se termină aproape întotdeauna cu aceeași întrebare la control: cine l-a făcut și cu ce dovadă. Un fișier trimis pe e-mail nu răspunde. O listă de prezență semnată pe hârtie răspunde pe jumătate, până se pierde.",
      "Aici cursul are lecții, iar lecțiile au materiale versionate: când documentul se schimbă, versiunea veche rămâne, cu tot cu cine a parcurs-o. Progresul se raportează pe măsură ce omul citește, iar la final lecția se semnează. Testul, dacă există, are un prag și un rezultat păstrat.",
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
      "Aici e singurul modul din aplicație în care managerul poate CONSTRUI ceva, nu doar aproba: are drept de creare pe echipa lui, deci își poate face propriile materiale de instruire fără să treacă prin HR. Angajatul are drept de scriere cu domeniul „own” — pare mult, până observi ce înseamnă: singurele lucruri pe care le poate schimba sunt propriul progres și propria semnătură pe lecție. Fără dreptul ăsta, cursul n-ar avea cine să-l parcurgă.",
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
      "Nu găzduiește video propriu și nu transcodează filme. Materialele sunt documente și linkuri.",
      "Nu emite diplome sau certificate cu numărul lor. Rezultatul e o înregistrare, nu un act.",
      "Nu are forum, comentarii sau discuții între cursanți. E o bibliotecă cu evidență, nu o platformă de învățare socială.",
    ],
  },

  {
    cheie: "reges",
    titluPagina: "REGES-Online: transmiterea contractelor la inspecția muncii, cu termenele ei",
    metaDescriere:
      "Cum se transmit contractele la REGES-Online (fostul Revisal) din Administrativo: mesaje pregătite din fișa angajatului, termene legale urmărite, reconciliere. Cine ce poate face, pe roluri.",
    intro: [
      "REGES-Online a înlocuit Revisal, iar odată cu el s-a schimbat și felul în care greșești: nu mai uiți să exporți un fișier, ci ratezi un termen. Fiecare eveniment din viața unui contract — angajare, modificare de salariu, suspendare, încetare — are propriul lui număr de zile până la care trebuie transmis, iar unele se numără în zile lucrătoare.",
      "Modulul ține termenele astea ca date, nu ca text în documentație. Angajarea se transmite cel târziu în ziua anterioară începerii activității; suspendarea pentru absențe nemotivate are trei zile lucrătoare, fiindcă nu se poate anunța dinainte; reluarea se transmite în ziua în care omul se prezintă. Fiecare termen are temeiul lui legal scris lângă el, iar o firmă care vrea altceva își pune propria regulă, fără să aștepte o versiune nouă.",
      "Mesajul se compune din ce e deja în fișa angajatului — nu se retastează nimic. Înainte de trimitere se verifică, iar ce lipsește se spune pe nume: un tip de spor nemapat, un CNP absent, o funcție fără cod COR.",
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
    notaPermisiuni:
      "Tabelul e cel mai închis din toată aplicația: două roluri au acces, celelalte două n-au absolut nimic — nici măcar dreptul de a citi. Nu e o scăpare, e forma corectă. Registrul de evidență a salariaților conține datele de identificare și salariile tuturor, iar un manager care își vede echipa în restul aplicației n-are ce căuta aici. Transmiterea are cheia ei separată de creare: se poate pregăti un mesaj fără dreptul de a-l trimite, ceea ce lasă loc pentru o verificare între cele două.",
    legaturi: [
      {
        catre: "payroll",
        text: "Sporurile transmise în obiectul de salariu sunt aceleași componente pe care le calculează statul de plată.",
      },
      {
        catre: "attendance",
        text: "Suspendarea pentru absențe nemotivate pornește dintr-o decizie luată pe baza pontajului, nu dintr-un text liber.",
      },
      {
        catre: "leave",
        text: "Concediile care suspendă contractul își generează singure evenimentul de transmis, cu termenul lui.",
      },
    ],
    nuFace: [
      "Nu transmite singur, pe fundal, fără ca cineva să apese. Termenele se arată, decizia rămâne a omului.",
      "Nu înlocuiește verificarea contabilului. Spune ce lipsește dintr-un mesaj, nu dacă un contract e corect juridic.",
      "Nu recuperează istoricul dinaintea intrării în aplicație. Contractele vechi se aduc la prima încărcare, apoi evidența curge de aici.",
    ],
  },
  {
    cheie: "evaluations",
    titluPagina: "Evaluări: șabloane de criterii, note pe echipă și istoricul discuției",
    metaDescriere:
      "Cum se fac evaluările de performanță în Administrativo: șabloane duplicabile, evaluare pe echipă, finalizare cu istoric. Cine ce poate face, pe roluri.",
    intro: [
      "Evaluarea anuală ajunge de obicei un formular Word trimis pe e-mail, completat în grabă și salvat pe un desktop. Anul următor nimeni nu mai găsește ce s-a discutat, iar promisiunile făcute atunci n-au unde să fie verificate.",
      "Aici șablonul de evaluare e un obiect al firmei: criterii, ponderi, scală. Se duplică pentru anul următor în loc să fie rescris, iar cel vechi se arhivează fără să dispară — evaluările făcute pe el rămân citibile exact în forma în care au fost completate.",
      "Evaluarea în sine are stări. Cât e deschisă se completează; la finalizare se închide, iar redeschiderea e o acțiune separată, care lasă urmă. Nu e o măsură de neîncredere, e felul în care o discuție de anul trecut poate fi arătată anul acesta fără dubii că a fost modificată între timp.",
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
      "Angajatul apare în tabel o singură dată, cu drept de citire pe propria evaluare — și atât. Nu poate completa nimic, nici măcar o autoevaluare, fiindcă modulul nu are astăzi un pas de autoevaluare separat de restul formularului. E o limită reală, nu o alegere de securitate, și merită spusă ca atare. Managerul, în schimb, are drepturi complete pe echipa lui: creează, completează și finalizează fără să treacă prin HR.",
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
    nuFace: [
      "Nu are evaluare la 360 de grade. Nu se cer păreri de la colegi sau de la subordonați.",
      "Nu calculează singură un bonus din nota finală. Legătura cu salarizarea o face un om.",
      "Nu trimite reamintiri când o evaluare stă nefinalizată. Starea se vede în listă.",
    ],
  },

  {
    cheie: "kpi",
    titluPagina: "KPI-uri: seturi de indicatori, ținte pe om și luna care se închide",
    metaDescriere:
      "Cum se urmăresc indicatorii de performanță în Administrativo: seturi de KPI, ținte individuale, luni deschise și închise. Cine ce poate face, pe roluri.",
    intro: [
      "Un indicator de performanță devine inutil în momentul în care nimeni nu mai știe ce valoare avea ținta când a fost stabilită. Foaia de calcul se rescrie peste, iar la discuția de final de an rămâne doar cifra de acum, nu și cea promisă atunci.",
      "Modulul separă cele trei lucruri care se amestecă de obicei: setul de indicatori — ce se măsoară, cu ce unitate și cu ce sens al creșterii; ținta — pentru cine și cât, cu perioada ei; realizarea — valoarea lunii, completată și apoi finalizată.",
      "Luna e unitatea de lucru și are stare, ca la pontaj. Se deschide, se completează, se finalizează. O lună finalizată nu se mai rescrie tăcut; iar setul de indicatori se arhivează în loc să fie șters, ca lunile trecute să rămână citibile.",
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
      "Un lucru care nu se vede din interfață și pe care preferăm să-l spunem: KPI-urile nu au permisiuni proprii, ci le folosesc pe cele de evaluări. Cine poate evalua poate și seta ținte, iar cine nu poate evalua nu ajunge la indicatori. Consecința practică e că modulele astea două nu se pot despărți pe roluri — dacă vrei ca un manager să vadă KPI-urile fără să poată face evaluări, astăzi nu se poate. E o simplificare asumată, nu o scăpare.",
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
      "Nu culege valorile singur din alte sisteme. Realizările se completează sau se importă, nu se sincronizează.",
      "Nu are grafice de tendință pe mai mulți ani. Unitatea de lucru e luna, iar comparația se face pe ea.",
      "Nu leagă indicatorul de un bonus calculat automat. Consecința rămâne o decizie de om.",
    ],
  },

  {
    cheie: "maintenance",
    titluPagina: "Mentenanță: sesizări de la oricine, planuri pe echipamente și autorizații ISCIR",
    metaDescriere:
      "Cum se ține mentenanța în Administrativo: sesizări deschise de orice angajat, contoare, planuri periodice, autorizații ISCIR cu scadențe. Cine ce poate face, pe roluri.",
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
      "Rândul de mijloc e neobișnuit și e intenționat: la deschiderea unei sesizări, angajatul are domeniul „all”, nu „own”. Poate raporta un defect pe orice echipament din firmă, nu doar pe al lui — altfel utilajul de la care tocmai a trecut ar rămâne nesemnalat. În schimb citirea îi e limitată la ce îl privește. HR nu apare deloc în tabel, pe niciun rând: mentenanța nu e treaba lui, iar absența rândului înseamnă refuz, nu acces implicit.",
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
      "Nu se leagă la senzori sau la sisteme SCADA. Contoarele se citesc și se introduc.",
      "Nu ține stoc de piese de schimb și nu comandă nimic de la furnizori.",
      "Nu calculează costul intervenției pe manoperă și materiale. Notează ce s-a făcut, nu cât a costat.",
    ],
  },

  {
    cheie: "inventory",
    titluPagina: "Inventar: cine are ce obiect al firmei, de când, și cu ce semnătură",
    metaDescriere:
      "Cum se ține inventarul de obiecte în Administrativo: predare cu confirmare, returnare, casare, obiecte pe fiecare angajat. Cine ce poate face, pe roluri.",
    intro: [
      "Laptopul, telefonul, scula, cheia de la depozit — lucrurile firmei aflate la oameni sunt aproape întotdeauna scrise într-un fișier pe care îl ține o singură persoană, și care rămâne în urmă din prima lună. La plecarea unui angajat urmează o discuție incomodă despre ce mai avea la el.",
      "Aici obiectul are un traseu complet: intră în stoc, se predă unei persoane, ea confirmă primirea, se returnează sau se casează. Fiecare pas rămâne cu data lui, iar starea curentă nu e o părere, ci rezultatul pașilor.",
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
      "Tabelul are doar două rânduri, și asta spune ceva despre modul: toate scrierile — adăugarea unui obiect nou, predarea, returnarea, casarea, readucerea în stoc — trec printr-o singură permisiune. Nu există un drept separat de „creare” față de unul de „mutare”, deci cine poate preda un laptop poate și adăuga unul nou în evidență. Managerul nu are nicio scriere aici: vede ce are echipa lui, dar predarea rămâne la HR sau la administrator. Confirmarea primirii, în schimb, o face angajatul din portal, pe rândul lui.",
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
    titluPagina:
      "Ticketing intern: cererile către IT sau administrativ, cu o coadă și un responsabil",
    metaDescriere:
      "Cum funcționează tichetele interne în Administrativo: oricine deschide, coada pe echipă, preluare și rezolvare. Cine ce poate face, pe roluri.",
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
      "Două lucruri ies în evidență. Primul: la deschiderea unui tichet toate cele patru roluri au același domeniu, „own” — inclusiv administratorul. Nimeni nu poate deschide un tichet în numele altcuiva, fiindcă un tichet e o cerere, iar cererea aparține celui care o face. Al doilea: HR apare aici cu „own” peste tot, adică exact ca un angajat obișnuit. E singurul modul din aplicație în care HR nu are acces extins — nu e o omisiune, e recunoașterea că o cerere către IT nu ține de resurse umane.",
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
      "Nu e pentru clienți din afara firmei. Cine deschide un tichet trebuie să fie angajatul organizației.",
    ],
  },
  {
    cheie: "announcements",
    titluPagina: "Anunțuri: comunicarea internă care se poate dovedi că a ajuns",
    metaDescriere:
      "Cum se transmit anunțurile interne în Administrativo: publicare, țintire pe departamente, confirmare de citire. Cine ce poate face, pe roluri.",
    intro: [
      "Anunțul intern trimis pe e-mail sau pe un grup de chat are o problemă pe care nimeni n-o observă până nu e nevoie de ea: nu se poate arăta cine l-a citit. Iar unele lucruri — o schimbare de program, o regulă nouă de acces, o notificare cerută de lege — chiar trebuie să poată fi dovedite.",
      "Aici anunțul are o ciornă și o publicare distinctă. Cât e ciornă se scrie și se reformulează; la publicare pleacă spre oamenii vizați și rămâne cu data lui. Citirea se înregistrează pe fiecare persoană, deci lista celor care încă n-au deschis anunțul e o listă reală, nu o presupunere.",
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
      "E singurul tabel din aplicație în care toate cele patru roluri au „all” pe același rând: anunțurile se citesc de toată lumea, fără excepție și fără domeniu restrâns. Scrisul, în schimb, e închis la două roluri — un manager nu poate publica un anunț pe firmă, oricât de mult l-ar privi echipa lui. Un detaliu care surprinde: marcarea unui anunț drept citit e o scriere, dar e păzită de permisiunea de CITIRE. Altfel n-ar avea logică — cine are voie să vadă anunțul trebuie să poată confirma că l-a văzut.",
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
    titluPagina: "Portal angajat: fiecare om își vede ale lui, de pe telefon, fără cont de Windows",
    metaDescriere:
      "Ce vede un angajat în portalul Administrativo: fluturașul, soldul de concediu, pontajul, cursurile, documentele. Cum e limitat accesul la propriile date.",
    intro: [
      "Cele mai multe întrebări care ajung la HR au același răspuns scris deja undeva: câte zile de concediu mai am, unde e adeverința de venit, ce am semnat luna trecută, cât mi-a intrat pe card. Fiecare dintre ele costă o întrerupere și un e-mail.",
      "Portalul e locul unde omul își vede propriile lucruri, fără să ceară nimănui nimic. Se deschide în browserul telefonului, se poate adăuga pe ecranul principal ca o aplicație, și nu cere cont de domeniu, VPN sau instalare.",
      "Nu e o aplicație separată cu datele ei. E aceeași bază, aceleași rânduri, văzute prin aceleași reguli — doar că restrânse la „ale mele”.",
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
        manager: null,
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
        manager: null,
        angajat: "own",
      },
    ],
    notaPermisiuni:
      "Portalul nu are permisiuni proprii, și asta e partea importantă. Fiecare ecran din el verifică exact cheia modulului din care își ia datele, cu domeniul „own”. Consecința: nu există un drum prin portal care să ocolească o regulă din aplicație, fiindcă e aceeași regulă, verificată în același loc. Coloana „Angajat” din tabelul de mai sus e, de fapt, definiția portalului. Iar restul coloanelor arată de ce nu e nevoie de un al doilea sistem: aceleași chei servesc și ecranele de birou.",
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
    nuFace: [
      "Nu e o aplicație din magazinul de aplicații. Se deschide în browser și se poate pune pe ecranul principal.",
      "Nu arată CNP-ul sau IBAN-ul, nici măcar propriile. Datele sensibile rămân închise în fișa de birou.",
      "Nu permite modificarea datelor personale. Schimbarea adresei sau a contului se cere, nu se face direct.",
    ],
  },

  {
    cheie: "rapoarte",
    titluPagina: "Rapoarte: cifrele lunii scoase din datele care există deja",
    metaDescriere:
      "Ce rapoarte scoate Administrativo: situații pe salarizare și pe lună, din aceleași date care au fost aprobate. Cine ce poate vedea, pe roluri.",
    intro: [
      "Un raport făcut prin copierea datelor în altă foaie de calcul e greșit din momentul în care cineva mai corectează ceva la sursă. Iar corecțiile vin întotdeauna după ce raportul a fost trimis.",
      "Aici raportul se calculează din rândurile care au trecut deja prin aprobare — luna închisă la pontaj, perioada de salarizare aprobată — nu dintr-o copie. Dacă sursa se redeschide și se schimbă, se schimbă și cifra.",
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
      "Trebuie spus limpede, fiindcă nu se vede din interfață: rapoartele nu au permisiuni proprii. Ele sunt păzite de cheile datelor pe care le adună — astăzi cele de salarizare. Consecința e că accesul la rapoarte nu se poate acorda separat: cine vede rapoartele vede salarizarea, iar managerul, care are refuz explicit pe salarizare, nu ajunge la ele deloc. E o limită asumată a formei actuale, nu o regulă de securitate gândită dinainte, și se va schimba când modulul va acoperi și alte zone.",
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
      "Nu are constructor de rapoarte. Situațiile sunt cele definite, nu se compun din interfață.",
      "Nu trimite rapoarte programate pe e-mail. Se deschid când sunt cerute.",
      "Nu acoperă încă toate modulele. Zonele neacoperite se exportă din modulul lor.",
    ],
  },

  {
    cheie: "nucleu",
    titluPagina: "Organizație, roluri și audit: temelia peste care stau celelalte module",
    metaDescriere:
      "Cum se administrează firma în Administrativo: utilizatori, roluri, permisiuni per om, jurnal de audit. Cine ce poate face, pe roluri.",
    intro: [
      "Nucleul nu e un modul care se cumpără, e ce rămâne când le scoți pe toate celelalte: firma, oamenii care intră în aplicație, rolurile lor și urma pe care o lasă fiecare acțiune.",
      "Rolurile sunt cinci, iar permisiunile lor sunt rânduri într-o tabelă, nu cod. Se pot suprascrie pentru un singur om, când realitatea nu încape în rol — un contabil care trebuie să vadă un raport în plus nu cere o versiune nouă a aplicației.",
      "Izolarea între firme nu se face prin filtre scrise în aplicație, ci prin reguli impuse de baza de date pe fiecare tabelă. Diferența contează: un filtru uitat într-o interogare devine o scurgere de date, o regulă de bază uitată nu returnează nimic. Greșeala eșuează în siguranță.",
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
      "Tabelul ăsta e cel mai instructiv din toate. HR — rolul care administrează oameni în toată aplicația — n-are absolut nicio permisiune pe utilizatori: poate ține fișa unui angajat, dar nu poate da pe nimeni în aplicație. Sunt două lucruri diferite, iar aici se vede că sunt tratate ca atare. Jurnalul de audit e închis cu „none” explicit pentru trei roluri din patru, adică refuz scris, nu rând lipsă. Iar managerul are un singur drept, pe roluri, cu domeniul „team”: poate schimba rolul cuiva din echipa lui — mecanismul prin care un șef de departament devine manager fără să treacă pe la administrator.",
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
      "Nu se leagă la Active Directory sau la conturi de Google pentru autentificare unică.",
      "Nu are roluri definite de client. Cele cinci sunt fixe; se ajustează permisiunile din ele, pe om.",
      "Nu șterge date. Ce iese din uz se marchează ca șters și rămâne în jurnal.",
    ],
  },

  {
    cheie: "asistent",
    titluPagina: "Asistent AI: întrebi în română și ajungi direct în ecranul potrivit",
    metaDescriere:
      "Ce face asistentul din Administrativo: răspunde la întrebări despre propriile date și duce în ecranul potrivit, fără să vadă mai mult decât vede utilizatorul.",
    intro: [
      "O aplicație cu douăzeci și două de module are o problemă pe care n-o rezolvă niciun meniu: omul știe ce vrea, dar nu știe unde se face. „Cum cer concediu”, „unde văd cine n-a făcut instruirea”, „de ce nu pot închide luna” — fiecare are un răspuns într-un ecran, iar drumul până la el e cunoscut doar de cine folosește aplicația zilnic.",
      "Asistentul răspunde în română și, când răspunsul e un ecran, duce direct acolo. Nu e un chat separat de aplicație: vede aceleași date, prin aceleași reguli, pentru omul care întreabă.",
      "Partea importantă e ce NU poate. Asistentul nu are permisiuni proprii — niciun rând într-o tabelă de roluri, nicio cheie a lui. Ce poate atinge se calculează din permisiunile celui care întreabă și din modulele pornite pe firmă. Un angajat care întreabă despre salariile colegilor primește același refuz pe care l-ar primi dacă ar deschide ecranul direct, fiindcă e exact același refuz, verificat în același loc. Nu există o cale ocolită prin întrebare.",
      "Modulul se poate opri de tot, pe firmă, dintr-un singur comutator. Cu el stins, nu doar că butonul dispare — cererea către asistent primește „nu există”, deci nici cineva care ar ști adresa nu ajunge la el.",
    ],
    actiuni: [],
    notaPermisiuni:
      "Asistentul nu are un tabel de roluri fiindcă n-are permisiuni proprii: accesul lui e, literal, accesul celui care întreabă.",
    legaturi: [
      {
        catre: "nucleu",
        text: "Permisiunile care limitează asistentul sunt exact cele din rolul omului care întreabă.",
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
      "Nu funcționează fără cheia de acces la furnizorul de model, configurată separat de comutatorul de modul.",
    ],
  },
];

/** Fișa unui modul, dacă are una. Cele fără fișă rămân pe conținutul din catalog. */
export function fisaModulului(cheie: string): FisaModul | undefined {
  return FISE.find((f) => f.cheie === cheie);
}
