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
];

/** Fișa unui modul, dacă are una. Cele fără fișă rămân pe conținutul din catalog. */
export function fisaModulului(cheie: string): FisaModul | undefined {
  return FISE.find((f) => f.cheie === cheie);
}
