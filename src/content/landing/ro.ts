import type { ContinutLanding } from "./tipuri";

/**
 * Conținutul românesc al landing-ului.
 *
 * Regula sub care e scris tot ce urmează: nicio propoziție nu promite ceva ce
 * nu se poate arăta într-o demonstrație de cinci minute. Fără cifre de clienți,
 * fără ore economisite, fără procente, fără „conform legislației în vigoare”.
 * Ce nu facem are secțiunea lui, la `#onestitate`, și e argument, nu scuză.
 */
export const RO: ContinutLanding = {
  limba: "ro",
  cealaltaLimba: { eticheta: "EN", href: "/en" },

  meta: {
    /*
     * 56 de caractere. Precedentul avea 75 și se trunchia în rezultatele Google,
     * care taie în jurul a ~60. Numele mărcii a ieșit din față: pe rezultatul
     * propriu apare oricum sub titlu, iar cine caută „administrativo” ne
     * găsește. Locul câștigat s-a dus pe termenii care se tastează efectiv —
     * „program de pontaj” — și pe dimensiunea firmei, care califică vizitatorul
     * înainte de clic.
     */
    titlu: "Program de pontaj și HR pentru firme cu 5–50 de angajați",
    descriere:
      "Evidența zilnică a orelor conform art. 119, concedii, dosare de personal și REGES-ONLINE, într-un singur cont. Pentru firme cu 5–50 de angajați.",
  },

  antet: {
    navigare: [
      { eticheta: "Module", href: "/#module" },
      { eticheta: "Cum se pontează", href: "/#pontaj" },
      { eticheta: "Cine ce vede", href: "/#roluri" },
      { eticheta: "Prețuri", href: "/preturi" },
      { eticheta: "Întrebări", href: "/#intrebari" },
    ],
    autentificare: "Autentificare",
    demo: "Cere o demonstrație",
    meniu: "Meniu",
    sariLaContinut: "Sari la conținutul principal",
  },

  hero: {
    supratitlu: "ERP și HR pentru firme din România",
    titlu: "Firma ta are deja procedurile. Administrativo le ține minte.",
    lead: "Pontaj, concedii, salarizare, SSM, parc auto și inventar într-o singură bază de date. Fiecare coleg vede exact ce ține de rolul lui, iar regula asta e impusă în baza de date, nu în meniu.",
    ctaPrimar: { eticheta: "Cere o demonstrație", href: "/cere-demo" },
    ctaSecundar: { eticheta: "Vezi ce nu facem", href: "/#onestitate" },
  },

  foaie: {
    eticheta: "Foaie colectivă de prezență",
    subtitlu: "Exemplu. Datele sunt fictive, luna e reală.",
    capAngajat: "Angajat",
    capOre: "ORE",
    capSuplimentare: "SUP",
    capNoapte: "NPT",
    randTotal: "TOTAL",
    legendaTitlu: "Legendă",
    notaCodConcediu:
      "0 CO înseamnă zi de concediu de odihnă, zero ore prestate: concediul se plătește din indemnizație, nu din ore. De aceea celula arată și cifra, ca adunarea să iasă.",
    notaSubset:
      "SUP și NPT sunt din care, nu în plus — orele lucrate le includ deja. Aceeași regulă e scrisă ca restricție în baza de date.",
    notaNorma:
      "Douăzeci de zile lucrătoare × opt ore = 160 de ore normă. Vinerea Mare și a doua zi de Paște sunt libere; Paștele ortodox cade duminică în 2026, deci nu adaugă o zi. Datele mobile vin din calculul Paștelui, nu dintr-o listă scrisă de mână.",
    monumentEticheta: "ore lucrate în aprilie 2026",
    monumentNota:
      "Adunate pe cele opt rânduri sau pe cele treizeci de coloane — aceeași cifră. Așa se închide o lună.",
    monumentStatic: "Nu se schimbă. Ai adunat aceleași ore pe alt drum.",
    ferestreEticheta: "Arată",
    descriereTabel:
      "Foaie colectivă de prezență pentru aprilie 2026, opt angajați pe treizeci de zile, cu totaluri pe rând și pe coloană.",
    anuntColoana: "Ziua {zi} aprilie: {ore} h, din {persoane} persoane.",
    anuntRand: "{nume}: {ore} h în aprilie.",
  },

  dovada: {
    randuri: [
      { valoare: "14", eticheta: "module", nota: "Fiecare cu ecrane livrate, nu cu promisiuni." },
      {
        valoare: "5",
        eticheta: "roluri",
        nota: "Cu domeniu propriu, ajustabile fără o nouă livrare.",
      },
      {
        valoare: "17",
        eticheta: "sărbători legale",
        nota: "Calculate, inclusiv Paștele ortodox și zilele care depind de el.",
      },
      {
        valoare: "651",
        eticheta: "clase CAEN Rev. 3",
        nota: "Nomenclatorul complet, cu regulile de compoziție pe formă juridică.",
      },
    ],
  },

  realitatea: {
    supratitlu: "Luni dimineața",
    titlu: "Nu-ți lipsesc procedurile. Îți lipsește locul în care stau.",
    lead: "Firmele de douăzeci până la două sute de oameni au deja reguli. Problema e că regulile trăiesc în trei fișiere, două telefoane și capul unei singure persoane.",
    scene: [
      {
        titlu: "Pontajul e într-un fișier care se numește pontaj_final_v3_ok",
        text: "Cineva îl completează, altcineva îl corectează, iar la sfârșitul lunii nimeni nu mai știe care versiune a plecat la contabilitate. Când totalul pe rânduri nu dă cât totalul pe coloane, se caută greșeala cu ochiul.",
      },
      {
        titlu: "Cererile de concediu sunt pe WhatsApp",
        text: "Aprobarea e un „ok” scris la nouă seara. Peste opt luni, când omul întreabă câte zile mai are, răspunsul se reconstituie din memorie și din mesaje care s-au șters singure.",
      },
      {
        titlu: "Scadențele se descoperă la control",
        text: "Fișa de instruire, medicina muncii, ITP-ul, verificarea stingătorului. Fiecare are un termen, niciunul n-are un loc care să-l anunțe. Se află că a expirat de la inspector.",
      },
    ],
  },

  platforma: {
    supratitlu: "Cum se leagă",
    titlu: "Modulele nu sunt aplicații separate puse una lângă alta.",
    lead: "Ce intră o dată nu se mai retastează. Legăturile de mai jos există în cod, cu numele scrise aici — nu sunt o schemă de prezentare.",
    noduri: [
      { cheie: "angajati", eticheta: "Angajați" },
      { cheie: "concedii", eticheta: "Concedii" },
      { cheie: "pontaj", eticheta: "Pontaj" },
      { cheie: "salarizare", eticheta: "Salarizare" },
      { cheie: "diurna", eticheta: "Diurne" },
      { cheie: "scadente", eticheta: "Scadențe" },
      { cheie: "audit", eticheta: "Jurnal de audit" },
    ],
    legaturi: [
      {
        de: "concedii",
        la: "pontaj",
        eticheta: "sincronizare_concedii",
        text: "Concediul aprobat devine zi de concediu pe foaie. Operația e idempotentă: rulată de zece ori, are același efect ca o dată.",
      },
      {
        de: "pontaj",
        la: "salarizare",
        eticheta: "agregare în SQL",
        text: "Orele lunii închise intră în statul de plată. Agregarea s-a mutat din aplicație în bază după două defecte tăcute care aruncau zilele de weekend și de sărbătoare.",
      },
      {
        de: "angajati",
        la: "scadente",
        eticheta: "expirables",
        text: "Contracte, permise, instruiri, documente de vehicul — toate ajung în același motor de termene, cu alertă înainte.",
      },
      {
        de: "diurna",
        la: "salarizare",
        eticheta: "plafon neimpozabil",
        text: "Plafonul împarte, nu blochează: partea de peste el devine venit asimilat salariului.",
      },
      {
        de: "angajati",
        la: "audit",
        eticheta: "trigger de audit",
        text: "Orice scriere lasă cine, când, de la ce adresă și ce s-a schimbat.",
      },
      {
        de: "scadente",
        la: "audit",
        eticheta: "append-only",
        text: "Jurnalul se adaugă. Nu există nicio politică de ștergere, nicăieri în produs.",
      },
    ],
    nota: "Numele din etichete sunt numele reale ale funcțiilor și tabelelor. Le poți cere la demonstrație.",
  },

  module: {
    supratitlu: "Module",
    titlu: "Cincisprezece module. Pornești doar ce folosești.",
    lead: "Ce nu e activat nu apare în meniu, nu apare în căutare și nu poate fi deschis prin adresă directă. Modulele se comută per firmă.",
    grupuri: [
      {
        cheie: "core",
        titlu: "Nucleu",
        module: [
          {
            cheie: "nucleu",
            titlu: "Organizație, roluri și audit",
            text: "Firma, membrii, invitațiile pe e-mail și urma fiecărei modificări. Un om poate lucra pentru mai multe firme și comută între ele fără să se delogheze.",
            puncte: [
              "Conturile se creează exclusiv prin invitație",
              "Cinci roluri, fiecare cu domeniu propriu",
              "Jurnal care se adaugă, nu se rescrie",
            ],
          },
          {
            cheie: "asistent",
            titlu: "Asistent AI",
            text: "Un asistent care răspunde la „unde se face X?” și îți dă butonul care te duce acolo. Nu-ți poate arăta un ecran la care n-ai acces: lista lui de destinații e filtrată pe permisiunile tale.",
            puncte: [
              "Îți spune drumul de click, apoi ți-l scurtează la un buton",
              "Răspunde și cu cifre reale: sold de concediu, ce ai de aprobat",
              "Nu execută nimic — explică și te duce, apeși tu",
            ],
          },
        ],
      },
      {
        cheie: "hr",
        titlu: "Personal",
        module: [
          {
            cheie: "attendance",
            titlu: "Pontaj",
            text: "Foaia colectivă lunară și planul săptămânii. Luna se blochează când e gata, și atunci nu se mai poate edita nici din greșeală.",
            puncte: [
              "Ore suplimentare și de noapte, ca subseturi ale orelor lucrate",
              "Aprobare pe departament sau pe săptămână",
              "Compensarea sărbătorii: zi liberă sau spor, cu termen",
            ],
          },
          {
            cheie: "leave",
            titlu: "Concedii",
            text: "Cererea trece pe lanțul de aprobare, soldul se recalculează singur, iar jumătățile de zi de la capete se numără corect.",
            puncte: [
              "Unsprezece tipuri, fiecare cu temeiul legal notat",
              "Drept anual pe vechime, condiții de muncă, handicap sau vârstă",
              "Calendar de echipă, cu prag de absenți simultani",
            ],
          },
          {
            cheie: "onboarding",
            titlu: "Integrare angajați",
            text: "Parcurs de integrare la angajare și listă de verificare la plecare, cu pași care cer bifă, document sau semnătură.",
            puncte: ["Șabloane cu pași reordonabili", "Dovadă printabilă a parcurgerii"],
          },
          {
            cheie: "courses",
            titlu: "Cursuri",
            text: "Bibliotecă de materiale PDF și video, parcurse direct în aplicație. Fiecare material își alege singur cât de serioasă e dovada: bifă, procent urmărit sau declarație asumată.",
            puncte: [
              "Filmele și documentele se văd în ERP, fără să plece nicăieri",
              "Recertificare la termen, care reapare singură în lista omului",
            ],
          },
          {
            cheie: "reges",
            titlu: "REGES-Online (fost Revisal)",
            text: "Contractele și salariații pleacă la Inspecția Muncii direct din ERP, prin API-ul REGES. Fără fișier de import purtat cu mâna și fără a doua tastare a acelorași date.",
            puncte: [
              "Termenul legal al fiecărui eveniment, calculat în zile lucrătoare",
              "Răspunsul ITM se întoarce în fișa omului, cu motivul refuzului scris pe înțeles",
            ],
          },
          {
            cheie: "evaluations",
            titlu: "Evaluări",
            text: "Șabloane pe criterii. Evaluarea se deschide din fișa omului și rămâne în dosarul lui.",
            puncte: ["Criterii proprii firmei", "Istoric pe angajat"],
          },
        ],
      },
      {
        cheie: "operations",
        titlu: "Operațiuni",
        module: [
          {
            cheie: "ssm",
            titlu: "SSM și PSI",
            text: "Matrice angajat × tip de instruire, cu semafor pe scadențe. „Niciodată făcută” e o stare distinctă de „expirată” — și e mai gravă.",
            puncte: [
              "Numărătoare inversă pentru comunicarea accidentului la ITM",
              "Stingătoare: verificare, reîncărcare, probă de presiune",
              "Echipament de protecție și fișe de aptitudine, cu durată",
            ],
          },
          {
            cheie: "fleet",
            titlu: "Parc auto",
            text: "Vehicule cu ITP, RCA și rovinietă pe termen, foi de parcurs cu kilometraj și alimentări.",
            puncte: [
              "Kilometraj în regres: fizic imposibil, deci se blochează",
              "Salt peste prag: posibil, dar se semnalează",
            ],
          },
          {
            cheie: "maintenance",
            titlu: "Mentenanță",
            text: "Echipamente, revizii planificate și sesizări de defecțiune, cu triaj pe urgență.",
            puncte: [
              "Scadență pe zile ȘI pe contor — ore, kilometri, cicluri",
              "Starea finală e cea mai gravă dintre cele două",
              "Autorizații ISCIR",
            ],
          },
          {
            cheie: "inventory",
            titlu: "Inventar",
            text: "Obiecte, categorii și alocări. Angajatul își confirmă singur ce a primit în primire.",
            puncte: ["Predare-primire cu dată", "Import din Excel pe loturi"],
          },
          {
            cheie: "ticketing",
            titlu: "Ticketing IT",
            text: "Solicitări către IT: software, hardware, defecțiuni pe obiectele din inventar și bug-uri raportate din aplicație. Tichetul intră într-o coadă, nu într-un chat.",
            puncte: [
              "Legat de obiectul din inventar care s-a stricat",
              "Coadă cu triaj, nu o adresă comună de e-mail",
              "Angajatul își vede propriile tichete",
            ],
          },
        ],
      },
      {
        cheie: "finance",
        titlu: "Financiar",
        module: [
          {
            cheie: "payroll",
            titlu: "Salarizare",
            text: "Calculul merge pas cu pas, cu desfășurător și avertismente. Cotele sunt ale firmei tale, versionate cu data de la care se aplică — niciuna nu e scrisă în cod.",
            puncte: [
              "Sporuri și prime reutilizabile, definite o dată",
              "Rețineri plafonate ca procent din net",
              "Tichetele nu intră niciodată în baza CAS și CASS",
            ],
          },
          {
            cheie: "per_diem",
            titlu: "Diurne și deplasări",
            text: "Ordine de deplasare, etape pe țări și deconturi. Ferestrele de 24 de ore curg de la plecare, nu de la miezul nopții.",
            puncte: [
              "Ziua trecerii de frontieră se plătește o singură dată, unei singure țări",
              "Barem pe țări și curs la data plecării",
              "Decont printabil",
            ],
          },
        ],
      },
      {
        cheie: "communication",
        titlu: "Comunicare",
        module: [
          {
            cheie: "announcements",
            titlu: "Anunțuri",
            text: "Comunicări interne cu confirmare de citire. Vezi cine a citit, raportat la numărul de angajați activi.",
            puncte: ["Notificare în aplicație și pe e-mail"],
          },
        ],
      },
      {
        cheie: "portal",
        titlu: "Portal",
        module: [
          {
            cheie: "employee_portal",
            titlu: "Portal angajat",
            text: "Soldul lui de concediu, cererile lui, pontajul lui, fluturașul lui și documentele lui. Nimic altceva.",
            puncte: ["Din browser, pe telefon", "Fără cont creat fără acordul omului"],
          },
        ],
      },
    ],
  },

  ecrane: {
    supratitlu: "Și mai e",
    titlu: "Ce mai găsești înăuntru",
    lead: "Ecrane care nu sunt module separate, dar fără de care modulele n-ar folosi la nimic.",
    randuri: [
      {
        cod: "ORG",
        titlu: "Organigramă",
        text: "Arborele managerial, vizibil și pentru cine are drept doar pe propria ramură.",
      },
      {
        cod: "XLS",
        titlu: "Import de angajați din Excel",
        text: "Mapare de coloane, validare pe rând, aplicare pe loturi și raport CSV cu rândurile respinse și motivul fiecăruia.",
      },
      {
        cod: "DOC",
        titlu: "Documente din șabloane",
        text: "Contract individual de muncă, fișa postului și trei adeverințe, cu numerotare pe serie, sumă de control și cod de verificare.",
      },
      {
        cod: "CAEN",
        titlu: "Nomenclator CAEN și validare CUI",
        text: "Codul fiscal se verifică cu cifra de control. Codurile secundare respectă limitele formei juridice.",
      },
      {
        cod: "REV",
        titlu: "Registrul de evenimente REVISAL",
        text: "Zece tipuri de eveniment, cu termenul calculat din configurația firmei și starea „în termen / astăzi / întârziat”.",
      },
      {
        cod: "RAP",
        titlu: "Rapoarte anuale",
        text: "Zile de concediu, zile de medical, venit brut și net, tichete și ore suplimentare, per angajat și pe firmă.",
      },
      {
        cod: "PL",
        titlu: "Puncte de lucru și departamente",
        text: "Structura firmei, cu funcții și cod COR pe fiecare post.",
      },
      {
        cod: "AUD",
        titlu: "Jurnal de audit, cu export",
        text: "Cine, când, de la ce adresă, ce s-a schimbat. Exportabil în CSV, cu protecție împotriva injecției de formule.",
      },
    ],
  },

  pontaj: {
    supratitlu: "Cum ajung orele în sistem",
    titlu: "Patru moduri care merg azi. Patru pe care încă nu le avem.",
    lead: "Le desenăm diferit ca să nu le confunzi. Ce e plin există și se poate vedea la demonstrație. Ce e hașurat nu există — nici măcar ca o coloană în bază.",
    livrateTitlu: "Merge azi",
    livrate: [
      {
        titlu: "Foaia colectivă lunară",
        text: "Grila zi × angajat. Se completează ora de intrare și de ieșire, iar orele se calculează ca sugestie editabilă.",
        detaliu: "Un rând pe zi și pe om, cu unicitate impusă în bază",
      },
      {
        titlu: "Planul săptămânii",
        text: "Angajatul își declară programul pentru săptămâna următoare, cu mod de prezență: birou, homeoffice, deplasare, delegație.",
        detaliu: "Trimitere și aprobare individuală, pe săptămână",
      },
      {
        titlu: "Sincronizare din concedii",
        text: "Concediul aprobat devine zi de concediu pe foaie, fără ca cineva să retasteze ceva.",
        detaliu: "Idempotentă: rulată de zece ori are același efect ca o dată",
      },
      {
        titlu: "Import și blocare",
        text: "Perioada se deschide, se completează, se aprobă pe departamente și se blochează. După blocare nu se mai poate scrie.",
        detaliu: "Trei stări: deschisă, în aprobare, blocată",
      },
    ],
    granita:
      "De aici în jos nu mai vorbesc despre ce am. Vorbesc despre ce vreau să construiesc, și îți spun asta înainte să întrebi.",
    viitoareTitlu: "Pe foaia de parcurs",
    viitoare: [
      {
        titlu: "Cod QR rotativ",
        text: "Un cod afișat la punctul de lucru, care se schimbă la câteva zeci de secunde ca să nu poată fi fotografiat și trimis.",
      },
      {
        titlu: "Tag NFC sau cardul de acces",
        text: "Pontare prin apropierea cartelei de un cititor sau de telefonul șefului de echipă.",
      },
      {
        titlu: "Geolocație legată de punctul de lucru",
        text: "Pontarea acceptată doar în raza punctului de lucru declarat, cu toleranță configurabilă.",
      },
      {
        titlu: "Recunoaștere facială la chioșc",
        text: "Verificare la un terminal fix. Descriptorii faciali sunt date biometrice: cer consimțământ explicit, evaluare de impact și criptare.",
      },
    ],
    notaViitoare:
      "Niciuna dintre cele patru nu există azi, în nicio formă. Dacă una ți-ar schimba decizia, spune-ne — construim în ordinea în care ne-o cer firmele care ne folosesc.",
    buton: { eticheta: "Am nevoie de asta", href: "/cere-demo" },
  },

  fluxuri: {
    supratitlu: "Trei drumuri",
    titlu: "Cum arată o lună, de la un capăt la altul",
    lead: "Fiecare pas are un rol care îl face. Dacă rolul n-are dreptul, pasul nu se întâmplă — nici din interfață, nici din altă parte.",
    fluxuri: [
      {
        titlu: "De la ziua lucrată la statul de plată",
        pasi: [
          { actor: "org_admin", text: "Deschide perioada lunii" },
          { actor: "hr", text: "Completează sau importă foaia colectivă" },
          { actor: "manager", text: "Aprobă pontajul echipei lui" },
          { actor: "org_admin", text: "Blochează luna" },
          { actor: "hr", text: "Calculează statul de plată din orele blocate" },
          { actor: "angajat", text: "Își vede fluturașul în portal" },
        ],
      },
      {
        titlu: "De la cererea de concediu la sold",
        pasi: [
          { actor: "angajat", text: "Cere concediu, cu zilele consumate calculate în față" },
          { actor: "sistem", text: "Verifică soldul, suprapunerile și pragul de echipă" },
          { actor: "manager", text: "Aprobă sau respinge, cu motiv" },
          { actor: "sistem", text: "Scade din sold și scrie zilele pe foaia de pontaj" },
        ],
      },
      {
        titlu: "De la angajarea nouă la dosar complet",
        pasi: [
          { actor: "hr", text: "Parcurge asistentul de înrolare, pe șase pași" },
          { actor: "sistem", text: "Generează contractul și fișa postului din șablon" },
          { actor: "sistem", text: "Deschide evenimentul REVISAL, cu termen" },
          { actor: "hr", text: "Pornește lista de verificare a integrării" },
          { actor: "angajat", text: "Confirmă bunurile primite în primire" },
        ],
      },
    ],
  },

  roluri: {
    supratitlu: "Cine ce vede",
    titlu: "Drepturile sunt date, nu cod. Și le poți citi.",
    lead: "Tabelul de mai jos e domeniul de citire al fiecărui rol, exact cum e așezat în baza de date. Un test din integrarea continuă compară fiecare celulă cu sursa: dacă baza se schimbă, pagina cade înainte să mintă.",
    capResursa: "Resursă",
    note: [
      "Angajatul are „—” la fișele de personal. Nu-și vede nici propria fișă în modulul de personal: datele lui le găsește în portal, care e alt drum, cu alte reguli.",
      "Managerul aprobă pontajul echipei, dar nu-l poate crea. Foaia îi este, practic, doar de citit.",
      "Managerul are refuz EXPLICIT pe salarizare, nu absență de rând. Un administrator îi poate acorda dreptul pe firma lui, fără o nouă livrare.",
      "Resursele umane administrează complet SSM-ul, dar nu au drept pe scadențele de conformitate: lista le apare goală, fără nicio eroare. E o limită reală, pe care preferăm s-o știi de aici.",
    ],
    notaPlatforma:
      "Există și un rol de administrator de platformă, al nostru, folosit la înrolarea firmei și la suport. Nu e membru al organizației tale, iar tot ce face lasă urmă în același jurnal pe care îl vezi și tu.",
  },

  izolare: {
    supratitlu: "Bariera",
    titlu: "Datele unei firme nu ajung la alta. Regula stă în Postgres.",
    lead: "Trei dintre straturile de mai jos sunt confort: ajută omul să nu se lovească de uși închise. Doar al patrulea e barieră — și e singurul de care depinde răspunsul la întrebarea „ce se întâmplă dacă cineva greșește codul?”.",
    straturi: [
      {
        nume: "Meniul",
        rol: "confort",
        text: "Ascunde ce nu te privește. Un buton ascuns nu e o măsură de securitate.",
        bariera: false,
      },
      {
        nume: "Pagina",
        rol: "confort",
        text: "Verifică permisiunea înainte să randeze. Dar o pagină nu protejează o acțiune de server: sunt puncte de intrare diferite.",
        bariera: false,
      },
      {
        nume: "Acțiunea",
        rol: "confort",
        text: "Fiecare scriere își declară modulul, permisiunea și domeniul, și le verifică din nou la execuție.",
        bariera: false,
      },
      {
        nume: "Postgres",
        rol: "barieră",
        text: "Politici pe rând, forțate inclusiv pentru proprietarul tabelei. Apartenența la firmă se recalculează la fiecare cerere, din date, nu dintr-un cookie. O firmă suspendată dispare din listă și accesul se stinge pe loc.",
        bariera: true,
      },
    ],
    vinieta: {
      titlu: "Pontaj — cum arată aceeași pagină pentru un manager",
      politica: "attendance_select",
      contor: "{ascunse} din {total} rânduri nu sunt afișate",
      nota: "Rândurile lipsă nu sunt ascunse din interfață. Baza de date nu le-a trimis niciodată. Aceeași pagină, alt om, alte rânduri.",
      randuri: ["Popa I.", "Ilie M.", "Radu A.", "Marin D.", "Vlad C.", "Toma S."],
      ascunse: 4,
    },
  },

  conformitate: {
    supratitlu: "România, nu „localizare”",
    titlu: "Regulile locale sunt în produs, nu într-un fișier de traduceri",
    lead: "Un ERP internațional tradus în română îți cere să te adaptezi tu. Lucrurile de mai jos sunt scrise pentru cum funcționează efectiv o firmă de aici.",
    carduri: [
      {
        titlu: "Sărbătorile legale, calculate",
        text: "Șaptesprezece zile: cele fixe din Codul muncii și cele mobile, derivate din data Paștelui ortodox. Foaia din capul paginii e alimentată chiar din funcția asta.",
        temei: "Codul muncii, art. 139",
      },
      {
        titlu: "CAEN Rev. 3, complet",
        text: "Șase sute cincizeci și una de clase, verificate față de nomenclatorul oficial. Regulile de compoziție diferă pe formă juridică: PFA cel mult patru coduri secundare, întreprinderea individuală nouă, SRL-D cu domenii interzise.",
        temei: "Legea 31/1990, OUG 44/2008",
      },
      {
        titlu: "CUI cu cifră de control",
        text: "Codul fiscal se validează cu ponderile oficiale, nu doar ca lungime. O greșeală de tastare se prinde la introducere, nu la prima declarație.",
        temei: "",
      },
      {
        titlu: "Diurna pe ferestre de 24 de ore",
        text: "Ferestrele curg de la ora plecării, nu de la miezul nopții, iar ziua trecerii de frontieră se plătește o singură dată, unei singure țări. Plafonul neimpozabil împarte suma, nu o blochează.",
        temei: "Structura HG 518/1995, importată ca date",
      },
      {
        titlu: "SSM și PSI, cu temei pe fiecare termen",
        text: "Periodicitatea instruirilor, a medicinei muncii, a verificării stingătoarelor și a autorizațiilor ISCIR — fiecare cu actul normativ notat lângă ea și cu data de la care se aplică.",
        temei: "Legea 319/2006, Legea 307/2006, HG 1425/2006",
      },
      {
        titlu: "Date personale criptate",
        text: "CNP-ul și IBAN-ul se scriu criptat și se citesc doar printr-o cale care lasă rând de audit la fiecare dezvăluire. Cheia se poate roti fără să recriptăm baza.",
        temei: "AES-256-GCM",
      },
    ],
    retentieTitlu: "Retenția datelor",
    retentie: [
      { ce: "Dosarul de personal", regula: "Termen configurat per firmă, cu purjare automată" },
      { ce: "Jurnalul de audit", regula: "Se adaugă, nu se șterge; nicio politică de ștergere" },
      { ce: "Cererile de demonstrație", regula: "Doar pentru a te contacta despre solicitare" },
      { ce: "Datele sensibile", regula: "Criptate, cu urmă la fiecare citire" },
      {
        ce: "Plecarea unui angajat",
        regula: "Ștergere logică, cu păstrarea urmei; nimic nu dispare tăcut",
      },
    ],
    retentieNota:
      "Termenele exacte se stabilesc împreună cu tine și cu juristul tău, și se scriu ca politică per firmă. Nu punem cifre aici, fiindcă nu sunt ale noastre.",
  },

  onestitate: {
    supratitlu: "Ce nu facem",
    titlu: "Lista pe care ceilalți o spun abia la a treia întâlnire",
    lead: "Preferăm să pierdem un client la început decât să-l dezamăgim la implementare.",
    randuri: [
      {
        titlu: "Salarizarea nu e software certificat",
        text: "E un instrument intern de calcul și evidență. Nu înlocuiește statul de plată oficial, declarația 112 sau avizul contabilului tău. Scrie asta și în aplicație, pe fiecare ecran de salarizare.",
      },
      {
        titlu: "Nu avem integrare cu ANAF, e-Factura sau SAF-T",
        text: "Zero linii de cod. Structura de date e pregătită pentru o transmitere viitoare, dar transmiterea nu există.",
      },
      {
        titlu: "Nu generăm fișierul oficial REVISAL",
        text: "Ținem evidența evenimentelor și termenele lor, și exportăm datele complete. Formatul aplicației oficiale se validează cu Inspecția Muncii, nu se presupune.",
      },
      {
        titlu: "Asistentul AI îți arată drumul, nu-ți face treaba",
        text: "Răspunde la „unde se face X?” și te duce acolo. Nu depune cereri, nu aprobă, nu șterge — apeși tu. Nu dă sfaturi juridice sau fiscale. Poate greși într-o explicație, dar nu te poate trimite la un ecran la care n-ai acces. Întrebarea ta pleacă la un furnizor extern de model (OpenRouter) ca să primească răspuns; datele din fișe pleacă doar dacă întrebi ceva despre ele. Modulul se poate stinge cu totul, per firmă.",
      },
      {
        titlu: "Documentele se salvează ca PDF din browser",
        text: "Generăm HTML de tipărit, cu numerotare pe serie și sumă de control. N-avem librărie de PDF în stivă, și n-am pretins că avem.",
      },
      {
        titlu: "Cotele fiscale trebuie confirmate de contabilul tău",
        text: "Nicio cotă, niciun prag și niciun barem nu e scris în cod. Toate sunt configurate pe firma ta, cu data de la care se aplică, și toate sunt marcate „de verificat” până le confirmă cineva care răspunde de ele.",
      },
      {
        titlu: "Nu avem aplicație mobilă în magazinele de aplicații",
        text: "Portalul angajatului merge din browser, pe telefon. Atât.",
      },
    ],
    incheiere:
      "Dacă vreuna dintre astea e un obstacol pentru tine, spune-ne la prima discuție. E mai ieftin pentru amândoi.",
  },

  verticale: {
    supratitlu: "Verticale",
    titlu: "Aceleași module, altă ordine de importanță",
    lead: "Nu vindem patru produse. Vindem același produs, pornit în ordinea în care doare la tine.",
    domenii: [
      {
        titlu: "Construcții și instalații",
        text: "Echipe pe șantiere și puncte de lucru, instruiri și echipament de protecție care expiră, control ITM care vine fără să sune. Salariul minim sectorial e o cotă configurată, nu o excepție de programat.",
        module: ["SSM și PSI", "Pontaj", "Parc auto", "Inventar", "Diurne"],
      },
      {
        titlu: "Producție și fabrici",
        text: "Schimburi și ture, spor de noapte cu interval propriu, revizii pe echipamente cu scadență și pe contor, autorizații ISCIR nominale.",
        module: ["Pontaj", "Mentenanță", "SSM și PSI", "Salarizare", "Inventar"],
      },
      {
        titlu: "Transport și logistică",
        text: "ITP, RCA și rovinietă cu termen, foi de parcurs cu kilometraj verificat, diurne externe pe țări, cu ferestre de 24 de ore și plafon neimpozabil.",
        module: ["Parc auto", "Diurne și deplasări", "Pontaj", "Mentenanță"],
      },
      {
        titlu: "Servicii, birouri și comerț",
        text: "Program flexibil, concedii cu prag de absenți simultani, evaluări periodice, anunțuri interne cu confirmare de citire și un portal în care omul își găsește singur fluturașul.",
        module: ["Concedii", "Pontaj", "Evaluări", "Anunțuri", "Portal angajat"],
      },
    ],
    nota: "Domeniul tău nu e aici? Modulele sunt aceleași. Scrie-ne ce te doare și îți spunem sincer dacă te ajutăm.",
  },

  comparatie: {
    supratitlu: "Diferența",
    titlu: "Cum se lucrează azi și cum se lucrează cu noi",
    lead: "Coloanele astea nu sunt două produse. Sunt aceeași lună, ținută în două feluri.",
    capAzi: "Azi",
    capNoi: "Cu Administrativo",
    perechi: [
      {
        azi: "Pontajul e un fișier care circulă pe e-mail",
        noi: "O singură foaie, cu totaluri care se închid și lună care se blochează",
      },
      {
        azi: "Cererile de concediu sunt în chat",
        noi: "Cerere, aprobare pe linie ierarhică și sold recalculat automat",
      },
      {
        azi: "Soldul de zile se reconstituie din memorie",
        noi: "Drept anual calculat din vechime, condiții și grad de handicap",
      },
      {
        azi: "Contabila primește orele retastate",
        noi: "Luna închisă intră direct în statul de plată",
      },
      {
        azi: "Scadențele SSM se află la control",
        noi: "Semafor cu alertă înainte, pe fiecare termen",
      },
      {
        azi: "Contractele se completează peste un model din 2019",
        noi: "Generate din șablon, numerotate pe serie, cu sumă de control",
      },
      {
        azi: "Cine a modificat? Nimeni nu mai știe",
        noi: "Cine, când, de la ce adresă, ce s-a schimbat",
      },
      {
        azi: "Toată lumea vede tot fișierul",
        noi: "Fiecare rol are domeniul lui, impus în baza de date",
      },
    ],
  },

  preturi: {
    supratitlu: "Prețuri",
    titlu: "Plătești modulele pe care le pornești",
    lead: "Nu publicăm o grilă, fiindcă n-ar fi adevărată: prețul depinde de câți oameni ai și de ce module îți trebuie. Îți facem o ofertă după prima discuție și îți spunem de la început ce nu-ți trebuie.",
    planuri: [
      {
        cheie: "start",
        nume: "Start",
        pentru: "Firme mici, care vor să scoată pontajul din Excel",
        pret: "Preț la cerere",
        module: ["nucleu", "attendance", "leave", "employee_portal"],
      },
      {
        cheie: "profesional",
        nume: "Profesional",
        pentru: "Firme care fac și salarizarea intern",
        pret: "Preț la cerere",
        recomandat: true,
        module: [
          "nucleu",
          "attendance",
          "leave",
          "employee_portal",
          "payroll",
          "onboarding",
          "announcements",
        ],
      },
      {
        cheie: "business",
        nume: "Business",
        pentru: "Firme cu oameni pe teren, mașini și echipamente",
        pret: "Preț la cerere",
        module: [
          "nucleu",
          "attendance",
          "leave",
          "employee_portal",
          "payroll",
          "onboarding",
          "announcements",
          "ssm",
          "fleet",
          "maintenance",
          "inventory",
          "per_diem",
          "ticketing",
        ],
      },
      {
        cheie: "enterprise",
        nume: "Enterprise",
        pentru: "Organizații care au nevoie de reguli proprii",
        pret: "Preț la cerere",
        module: [
          "nucleu",
          "attendance",
          "leave",
          "employee_portal",
          "payroll",
          "onboarding",
          "announcements",
          "ssm",
          "fleet",
          "maintenance",
          "inventory",
          "per_diem",
          "ticketing",
          "evaluations",
        ],
      },
    ],
    capModul: "Modul",
    cta: "Cere ofertă",
    nota: "Toate planurile includ nucleul: roluri, invitații, jurnal de audit și izolarea între firme. Aceea nu e opțiune.",
    legaturaPagina: { eticheta: "Vezi ce include fiecare plan", href: "/preturi" },
  },

  implementare: {
    supratitlu: "Cum începem",
    titlu: "Cinci pași, în ordinea asta",
    lead: "E singura secvență reală de pe pagina asta, de aceea e singurul loc unde numerotăm.",
    pasi: [
      {
        actor: "tu",
        titlu: "O discuție de o jumătate de oră",
        text: "Ne spui cum lucrezi acum. Îți spunem ce te ajută și ce nu. Nu-ți cerem card și nu-ți creăm cont.",
      },
      {
        actor: "noi",
        titlu: "Îți configurăm firma",
        text: "Datele firmei, codurile CAEN, punctele de lucru, departamentele și funcțiile. Pornim exact modulele discutate.",
      },
      {
        actor: "noi",
        titlu: "Aducem angajații",
        text: "Din Excel, cu mapare de coloane și raport pentru rândurile care nu trec validarea. Nimic nu intră pe jumătate.",
      },
      {
        actor: "tu",
        titlu: "Îți inviți colegii",
        text: "Pe e-mail, fiecare cu rolul lui. Intră direct în modulele care îi privesc și nu văd restul.",
      },
      {
        actor: "amândoi",
        titlu: "Prima lună o închidem împreună",
        text: "Primul pontaj și primul stat de plată le trecem cu tine, pas cu pas. După aceea le faci singur.",
      },
    ],
  },

  intrebari: {
    supratitlu: "Întrebări frecvente",
    titlu: "Ce ne întreabă lumea înainte să semneze",
    lead: "Dacă întrebarea ta nu e aici, sună. Răspundem și la cele incomode.",
    intrebari: [
      {
        q: "Ce fac cu fișierul Excel pe care îl am acum?",
        a: "Îl încarci. Alegi ce coloană a ta înseamnă ce câmp la noi, iar validarea se face rând cu rând: cele bune intră, cele stricate îți vin înapoi într-un fișier cu motivul fiecărei respingeri. Nu se importă „pe jumătate” și nu se pierde nimic tăcut.",
      },
      {
        q: "Datele noastre pot ajunge la altă firmă din platformă?",
        a: "Nu, iar mecanismul nu e un filtru din aplicație. Fiecare interogare trece prin politici pe rând, în Postgres, forțate inclusiv pentru proprietarul tabelei. Apartenența ta la firmă se recalculează la fiecare cerere din date reale, nu dintr-un cookie. Verificarea rulează automat la fiecare livrare de cod.",
      },
      {
        q: "Contabila mea vede salariile tuturor. Managerul poate?",
        a: "Nu. Managerul are refuz explicit pe salarizare — nu absență de drept, refuz scris. Dacă vrei să i-l dai, se schimbă o linie de configurare pe firma ta, fără o nouă livrare de cod. Tabelul cu cine ce vede e mai sus pe pagină.",
      },
      {
        q: "Ce se întâmplă când pleacă un angajat?",
        a: "Nimic nu se șterge fizic. Fișa se închide, urma rămâne, iar datele se purjează la termenul din politica de retenție a firmei tale. Nu există nicio politică de ștergere în baza de date, nicăieri.",
      },
      {
        q: "Înlocuiește contabilul?",
        a: "Nu, și n-ar trebui să vrei asta. Calculăm și ținem evidența; declarațiile și răspunderea rămân la contabilul tău. Cotele le confirmă el, iar aplicația marchează asta explicit până o face.",
      },
      {
        q: "Merge pe telefon?",
        a: "Da, din browser. Portalul angajatului e făcut pentru ecran mic: soldul de concediu, cererile, pontajul, fluturașul, documentele. Nu avem aplicație în magazinele de aplicații.",
      },
      {
        q: "Ce arăt la un control ITM?",
        a: "Fișele de instruire cu data și semnătura, evidența medicinei muncii, echipamentul de protecție cu durata lui, foaia de prezență a lunii și jurnalul care arată cine a modificat ce. Toate dintr-un singur loc, cu termenele vizibile înainte să expire.",
      },
      {
        q: "Cine are acces la datele noastre din partea voastră?",
        a: "Un rol de administrator de platformă, folosit la înrolare și la suport. Nu e membru al firmei tale, iar tot ce face lasă urmă în același jurnal pe care îl vezi și tu. CNP-urile și conturile bancare sunt criptate, iar fiecare dezvăluire scrie un rând de audit.",
      },
      {
        q: "Putem schimba drepturile unui rol?",
        a: "Da. Matricea de permisiuni e date, nu cod: rândul firmei tale bate regula globală, inclusiv când vrei să interzici ceva ce e permis implicit. Nu cere o versiune nouă a aplicației.",
      },
      {
        q: "Cât durează până lucrăm efectiv?",
        a: "Depinde de câți oameni ai și de câte module pornim. Partea lungă nu e configurarea, ci curățarea datelor pe care le aduci. Îți spunem o estimare după ce ne uităm la fișierele tale, nu înainte.",
      },
      {
        q: "Ce se întâmplă cu datele dacă renunțăm?",
        a: "Le iei. Exportăm ce ținem despre tine în format deschis, iar ce rămâne la noi se purjează la termenul convenit. Nu ținem date ca argument de negociere.",
      },
      {
        q: "De ce nu scrie prețul pe site?",
        a: "Pentru că ar fi un preț fals. Diferența dintre o firmă de zece oameni cu pontaj și una de o sută cu flotă, SSM și salarizare e prea mare ca o grilă publică să fie onestă. Ceri o ofertă, primești o cifră pe care o putem susține.",
      },
    ],
  },

  clienti: {
    supratitlu: "Clienți",
    titlu: "Aici o să fie recomandările lor",
    text: "Nu punem testimoniale scrise de noi și nu punem logo-uri de firme care nu ne folosesc. Primii clienți sunt în implementare; dacă vrei să vorbești cu unul dintre ei înainte să decizi, îți facem legătura la telefon.",
  },

  contact: {
    supratitlu: "Hai să vorbim",
    titlu: "Spune-ne cum lucrați acum",
    lead: "O discuție de o jumătate de oră, nu o prezentare de vânzări. Îți arătăm exact modulele care te interesează și îți spunem deschis ce nu e gata.",
    telefonEticheta: "Telefon",
    emailEticheta: "E-mail",
    programEticheta: "Program",
    program: "Luni–vineri, 9–18",
    notaReferinte:
      "Primii clienți sunt în implementare. Dacă vrei să vorbești cu unul dintre ei înainte să decizi, îți facem legătura.",
    formularTitlu: "Sau lasă-ne datele tale",
  },

  subsol: {
    descriere:
      "Administrativo — pontaj, concedii, salarizare, SSM, parc auto și inventar pentru firme din România. Fiecare firmă are propriul spațiu de date, propriile roluri și doar modulele de care are nevoie.",
    coloane: [
      {
        titlu: "Produs",
        legaturi: [
          { eticheta: "Module", href: "/#module" },
          { eticheta: "Moduri de pontaj", href: "/#pontaj" },
          { eticheta: "Cine ce vede", href: "/#roluri" },
          { eticheta: "Izolarea datelor", href: "/#izolare" },
          { eticheta: "Prețuri", href: "/preturi" },
        ],
      },
      {
        titlu: "Domenii",
        legaturi: [
          { eticheta: "Construcții și instalații", href: "/#verticale" },
          { eticheta: "Producție și fabrici", href: "/#verticale" },
          { eticheta: "Transport și logistică", href: "/#verticale" },
          { eticheta: "Servicii, birouri și comerț", href: "/#verticale" },
        ],
      },
      {
        titlu: "Înainte să întrebi",
        legaturi: [
          { eticheta: "Ce nu facem", href: "/#onestitate" },
          { eticheta: "Conformitate", href: "/#conformitate" },
          { eticheta: "Întrebări frecvente", href: "/#intrebari" },
          { eticheta: "Cum începem", href: "/#implementare" },
        ],
      },
      {
        titlu: "Legal",
        legaturi: [
          { eticheta: "Termeni și condiții", href: "/legal/termeni" },
          { eticheta: "Politica de confidențialitate", href: "/legal/confidentialitate" },
        ],
      },
    ],
    contactTitlu: "Contact",
    copyright: "Toate drepturile rezervate.",
    notaDiacritice:
      "Scriem ș și ț cu virgulă dedesubt, nu cu sedilă. E felul corect, și e verificat automat la fiecare livrare.",
  },
};
