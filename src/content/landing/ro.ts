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
    /*
     * 6 oct 2026: descrierea spune acum oferta — prețul și prima lună gratuită.
     * E singurul text pe care îl vede cineva în Google înainte de clic, iar
     * concurența afișează prețuri pe angajat, plus TVA, pe altă pagină.
     */
    descriere:
      "Pontaj de pe telefon, concedii și dosare de personal: 149 lei pe lună până la 20 de angajați, prima lună gratuită. REGES-ONLINE, încă 39 lei pe lună.",
  },

  antet: {
    navigare: [
      { eticheta: "Module", href: "/module" },
      { eticheta: "Pontaj pe telefon", href: "/pontaj-pe-telefon" },
      { eticheta: "Prețuri", href: "/preturi" },
      // Contabilul extern ține zece firme și decide pentru toate zece. Până pe
      // 23 sept 2026 pagina lui era legată doar din subsol.
      { eticheta: "Pentru contabili", href: "/pentru-contabili" },
      // 6 oct 2026: în locul „Întrebărilor”, care au acum bandă pe pagina de
      // start și legătură în subsol. Uneltele au de o sută de ori mai multe
      // căutări decât numele programului (Keyword Planner, oct 2026).
      { eticheta: "Unelte gratuite", href: "/unelte" },
    ],
    autentificare: "Autentificare",
    demo: "Creează cont",
    meniu: "Meniu",
    sariLaContinut: "Sari la conținutul principal",
  },

  hero: {
    /*
     * 6 oct 2026. Titlul de dinainte — „Pontaj, concedii și dosare de personal,
     * într-un singur cont" — era o listă de funcții: spunea CE e produsul, nu
     * ce se schimbă pentru cine îl cumpără. Cel de acum pune cele două capete
     * ale lunii, cu cei doi oameni care le țin: angajatul care apasă un buton și
     * patronul care nu mai adună ore în Excel. Ambele se arată în cinci minute
     * de demonstrație — regula de deasupra fișierului rămâne.
     *
     * Cuvintele căutate („program de pontaj", „HR") au trecut în supratitlu și
     * stau oricum în `<title>` și în descriere.
     *
     * A doua acțiune duce la un om, nu la preț: prețul e în banda de imediat
     * dedesubt, iar o firmă fără clienți de arătat câștigă mai mult dintr-o
     * discuție decât dintr-un clic în plus pe aceeași pagină.
     */
    supratitlu: "Program de pontaj și HR · pentru firme cu 5–50 de angajați",
    // `\u00a0` ține „Tu” lângă verbul lui: fără el, „Tu” rămânea singur la capăt de rând.
    titlu: "Angajații se pontează de pe telefon. Tu\u00a0închizi luna fără Excel.",
    lead: "Ora de intrare și de ieșire ajunge singură în foaia colectivă, concediul aprobat se scade din sold, iar contractele pleacă în REGES-ONLINE direct din aplicație. Evidența cerută de art. 119 din Codul muncii, ținută la zi, într-un singur cont.",
    ctaPrimar: { eticheta: "Creează cont · prima lună gratuită", href: "/inregistrare" },
    ctaSecundar: { eticheta: "Programează o demonstrație", href: "/cere-demo" },
    asigurari: ["Fără card la înscriere", "Fără cost de pornire", "Nimic de instalat"],
    suna: "Răspunde un om la",
    video: { opreste: "Oprește videoclipul", porneste: "Pornește videoclipul" },
    punteFoaie:
      "Așa arată luna la final: ce au pontat oamenii pe telefon, adunat în foaia colectivă de prezență. Concediile și sărbătorile legale sunt deja trecute, iar totalurile se închid și pe rânduri, și pe coloane.",
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
    /*
     * Banda asta enumera inventarul — module, roluri, sărbători, clase CAEN.
     * Descria produsul, nu ce primește cumpărătorul, și stătea imediat sub erou,
     * adică exact acolo unde se decide dacă merită derulat mai departe.
     *
     * Acum poartă riscul asumat de noi: prima lună, prețul, costul de pornire.
     * Rândul de module rămâne — e singura cifră din pagină legată de sursă
     * (`FEATURE_KEYS`) printr-un test.
     */
    randuri: [
      {
        valoare: "1",
        eticheta: "lună gratuită",
        nota: "Pentru orice configurație. Fără card cerut la înscriere.",
      },
      {
        valoare: "149",
        eticheta: "lei pe lună",
        // Nu „pe angajat": concurența românească vinde pe om, în euro, plus TVA.
        nota: "Nucleul, pentru toată firma până la 20 de angajați — nu pe om. Preț final, fără TVA.",
      },
      {
        valoare: "0",
        eticheta: "lei de pornire",
        nota: "Fără cost de implementare și fără instruire facturată separat.",
      },
      {
        valoare: "19",
        eticheta: "module",
        nota: "Pornești doar ce folosești. Restul nu apare nici în meniu, nici pe factură.",
      },
    ],
  },

  realitatea: {
    supratitlu: "Luni dimineața",
    titlu: "Nu-ți lipsesc procedurile. Îți lipsește locul în care stau.",
    lead: "Firmele de cinci până la cincizeci de oameni au deja reguli. Problema e că regulile trăiesc în trei fișiere, două telefoane și capul unei singure persoane.",
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
    titlu: "Pontajul, concediile și salarizarea nu sunt aplicații separate.",
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
        text: "Jurnalul se adaugă, nu se rescrie: în aplicație nu există nicio cale de a șterge un rând din el.",
      },
    ],
    nota: "Numele din etichete sunt numele reale ale funcțiilor și tabelelor. Le poți cere la demonstrație.",
  },

  module: {
    supratitlu: "Module",
    titlu: "Nouăsprezece module. Pornești doar ce folosești.",
    lead: "Ce nu e activat nu apare în meniu, nu apare în căutare și nu poate fi deschis prin adresă directă. Modulele se comută per firmă.",
    grupuri: [
      {
        cheie: "core",
        titlu: "Platformă",
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
            text: "Cererea trece pe lanțul de aprobare, soldul se recalculează singur, iar zilele nelucrătoare și sărbătorile legale se scot automat din numărătoare.",
            puncte: [
              "Treisprezece tipuri de concediu, configurabile pe firmă",
              "Drept anual pe vechime, condiții de muncă, handicap sau vârstă",
              // Până pe 6 oct 2026: „cu prag de absenți simultani". Pragul există
              // doar ca funcție pură, `conflictDeEchipa` din
              // `src/domain/leave/verificari.ts`: nicio acțiune n-o cheamă și nicio
              // setare a firmei nu-l configurează. Când se leagă, revine aici.
              "Calendar de echipă: cine lipsește și când",
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
          {
            cheie: "kpi",
            titlu: "KPI-uri",
            text: "Indicatori de performanță pe angajat și pe echipă, cu ținte lunare. Aceeași cifră o vede și omul, nu doar șeful.",
            puncte: [
              "Seturi de indicatori refolosibile, definite o dată pe firmă",
              "Luna se închide, iar valorile nu se mai rescriu",
              "Angajatul își vede indicatorul în portal, cu ținta lângă rezultat",
            ],
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
            // „Import din Excel pe loturi" a stat aici până pe 6 oct 2026: schema
            // are tabela de loturi, dar nicio acțiune și niciun ecran n-o folosesc.
            puncte: ["Predare-primire cu dată", "Confirmarea de primire o dă chiar angajatul"],
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
              "Tichetele de masă nu intră în baza CAS; în CASS, după setarea confirmată de contabil",
            ],
          },
          {
            cheie: "per_diem",
            titlu: "Deplasări și diurne",
            text: "Ordine de deplasare, etape pe țări și deconturi. Ferestrele de 24 de ore curg de la plecare, nu de la miezul nopții.",
            puncte: [
              "Ziua trecerii de frontieră se plătește o singură dată, unei singure țări",
              "Barem pe țări și curs la data plecării",
              "Decont printabil",
            ],
          },
          {
            cheie: "rapoarte",
            titlu: "Rapoarte",
            text: "Venituri, concedii și tichete, agregate pe toată organizația. Agregarea se face în SQL, nu în aplicație — aceeași decizie ca la pontaj.",
            puncte: [
              "Prag de proprietar, nu de manager: cere drept „toate”, nu „echipa”",
              "Export în Excel, cu aceleași cifre ca pe ecran",
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
            // Fără „și pe e-mail": `src/lib/email/templates/` n-are șablon de anunț,
            // iar fișa modulului spune chiar „Nu trimite pe e-mail" (6 oct 2026).
            puncte: ["Notificare în aplicație și în portalul angajatului"],
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
    titlu: "Șase moduri care merg azi. Patru pe care încă nu le avem.",
    lead: "Le desenăm diferit ca să nu le confunzi. Ce e plin există și se poate vedea la demonstrație. Ce e hașurat nu există — nici măcar ca o coloană în bază.",
    livrateTitlu: "Merge azi",
    livrate: [
      {
        titlu: "Pontare dintr-o atingere, de pe telefon",
        text: "Din portalul angajatului, în browser: un buton care confirmă ziua obișnuită sau două — „Am intrat” și „Am ieșit”. Ora scrisă e a serverului, nu a telefonului.",
        detaliu: "Firma alege modul: confirmare, ceas sau amândouă",
      },
      {
        titlu: "Afișul cu cod QR la punctul de lucru",
        text: "Fiecare punct de lucru are un afiș tipărit din aplicație. Omul scanează codul cu camera telefonului și pontează pe punctul acela; firma poate cere scanarea înainte de pontare.",
        detaliu: "Codul rămâne același până îl schimbă administratorul",
      },
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
      "Niciuna dintre cele patru nu există azi. Afișul QR de mai sus are un cod fix, schimbat de administrator; codul care se schimbă singur, la câteva zeci de secunde, e cel de aici. Dacă una ți-ar schimba decizia, spune-ne — construim în ordinea în care ne-o cer firmele care ne scriu.",
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
          { actor: "administrator", text: "Deschide perioada lunii" },
          { actor: "hr", text: "Completează sau importă foaia colectivă" },
          { actor: "manager", text: "Aprobă pontajul echipei lui" },
          { actor: "administrator", text: "Blochează luna" },
          { actor: "hr", text: "Calculează statul de plată din orele blocate" },
          { actor: "angajat", text: "Își vede fluturașul în portal" },
        ],
      },
      {
        titlu: "De la cererea de concediu la sold",
        pasi: [
          { actor: "angajat", text: "Cere concediu, cu zilele consumate calculate în față" },
          { actor: "automat", text: "Verifică soldul și suprapunerea cu alte cereri" },
          { actor: "manager", text: "Aprobă sau respinge, cu motiv" },
          { actor: "automat", text: "Scade din sold și scrie zilele pe foaia de pontaj" },
        ],
      },
      {
        titlu: "De la angajarea nouă la dosar complet",
        pasi: [
          { actor: "hr", text: "Parcurge asistentul de înrolare, pe șase pași" },
          { actor: "automat", text: "Generează contractul și fișa postului din șablon" },
          { actor: "automat", text: "Deschide evenimentul REVISAL, cu termen" },
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
      "Angajatul își vede propria fișă de personal și numai pe ea. CNP-ul și IBAN-ul rămân închise și pentru el: cer drept de citire pe toată firma, nu pe propriul rând.",
      "Managerul aprobă pontajul echipei și se pontează pe sine, dar nu scrie ziua altcuiva. Foaia echipei îi rămâne de citit.",
      "Managerul are refuz EXPLICIT pe salarizare, nu absență de rând. Un administrator îi poate acorda dreptul pe firma lui, fără o nouă livrare.",
      "Resursele umane administrează complet SSM-ul, dar nu au drept pe scadențele de conformitate: lista le apare goală, fără nicio eroare. E o limită reală, pe care preferăm s-o știi de aici.",
    ],
    notaPlatforma:
      "Există și un rol de administrator de platformă, al nostru, folosit la înrolarea firmei și la suport. Nu e membru al organizației tale, iar tot ce face lasă urmă în același jurnal pe care îl vezi și tu.",
  },

  izolare: {
    supratitlu: "Bariera",
    titlu: "Cum e construită bariera, strat cu strat",
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
    legaturaPagina: { eticheta: "Cum ținem datele separate", href: "/incredere" },
  },

  conformitate: {
    supratitlu: "România, nu „localizare”",
    titlu: "Regulile locale sunt în produs, nu într-un fișier de traduceri",
    lead: "Un ERP internațional tradus în română îți cere să te adaptezi tu. Lucrurile de mai jos sunt scrise pentru cum funcționează efectiv o firmă de aici.",
    carduri: [
      {
        titlu: "Sărbătorile legale, calculate",
        text: "Șaptesprezece zile: cele fixe din Codul muncii și cele mobile, derivate din data Paștelui ortodox. Foaia de pontaj de pe pagina de start e alimentată chiar din funcția asta.",
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
      {
        ce: "Dosarul de personal",
        regula:
          "Pe durata contractului; după încetare, 30 de zile de recuperare, apoi ștergere definitivă",
      },
      {
        ce: "Jurnalul de audit",
        regula: "Se adaugă, nu se rescrie; se păstrează cât cere legea, ca probă",
      },
      { ce: "Cererile de demonstrație", regula: "Doar pentru a te contacta despre solicitare" },
      { ce: "Datele sensibile", regula: "Criptate, cu urmă la fiecare citire" },
      {
        ce: "Plecarea unui angajat",
        regula: "Ștergere logică, cu păstrarea urmei; nimic nu dispare tăcut",
      },
    ],
    retentieNota:
      "Termenele vin din Termeni și din Politica de confidențialitate. Dacă firma ta are nevoie de altele, le stabilim în contract, împreună cu juristul tău.",
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
        titlu: "Datele cu CNP nu pleacă la REGES fără un om",
        text: "Transmiterea în REGES-ONLINE se face prin API, din aplicație, cu accesul obținut de firma ta din portalul Inspecției Muncii. Mesajele se pregătesc singure din fișa angajatului. Cele care poartă CNP-ul unui salariat stau în coadă până le trimite cineva cu drept de transmitere, iar fiecare citire a CNP-ului lasă urmă în jurnal; mesajele de contract, fără date personale, pot pleca și din ciclul automat de transmitere. Fișier REVISAL nu generăm: REGES-ONLINE l-a înlocuit.",
      },
      {
        titlu: "Asistentul AI îți arată drumul, nu-ți face treaba",
        text: "Răspunde la „unde se face X?” și te duce acolo. Nu depune cereri, nu aprobă, nu șterge — apeși tu. Nu dă sfaturi juridice sau fiscale. Poate greși într-o explicație, dar nu te poate trimite la un ecran la care n-ai acces. Întrebarea ta pleacă la un furnizor extern de model (OpenRouter) ca să primească răspuns; datele din fișe pleacă doar dacă întrebi ceva despre ele. Modulul se poate stinge cu totul, per firmă.",
      },
      {
        titlu: "PDF-ul e o randare a documentului emis, nu un al doilea document",
        text: "Documentul de referință e rândul din bază: el poartă numărul alocat pe serie, amprenta SHA-256 și codul de verificare. PDF-ul se compune din el, pe server. Un PDF făcut separat, din aceleași date, ar fi un al doilea izvor de adevăr — două hârtii cu același număr, a căror potrivire n-o garantează nimeni.",
      },
      {
        titlu: "Cotele fiscale trebuie confirmate de contabilul tău",
        text: "Nicio cotă, niciun prag și niciun barem nu e scris în cod. Toate sunt configurate pe firma ta, cu data de la care se aplică, și toate sunt marcate „de verificat” până le confirmă cineva care răspunde de ele.",
      },
      {
        titlu: "Nu avem aplicație mobilă în magazinele de aplicații",
        text: "Portalul angajatului merge din browser, pe telefon. O aplicație Android există, în testare internă, dar nu e publicată în Google Play; pentru iPhone nu avem una.",
      },
    ],
    incheiere:
      "Dacă vreuna dintre astea e un obstacol pentru tine, spune-ne la prima discuție. E mai ieftin pentru amândoi.",
  },

  verticale: {
    supratitlu: "Verticale",
    titlu: "Ce contează primul, pe fiecare domeniu",
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
        module: ["Parc auto", "Deplasări și diurne", "Pontaj", "Mentenanță"],
      },
      {
        titlu: "Servicii, birouri și comerț",
        text: "Program flexibil, concedii aprobate pe linie ierarhică și văzute în calendarul echipei, evaluări periodice, anunțuri interne cu confirmare de citire și un portal în care omul își găsește singur fluturașul.",
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

  /*
   * ── BENZILE NOI ALE PAGINII DE START (6 oct 2026) ────────────────────────
   * Au înlocuit „Primii pași”, „Cum începem” și „Bariera”. Motivele, cu cifrele
   * și concurența: `docs/comercial/refacere-site-2026-10-06.md`. Fiecare
   * afirmație de mai jos are acoperire în cod sau în altă pagină a sitului; ce
   * NU se poate afirma e listat în `vestventures/_surse/fapte.md` §10.
   */
  produs: {
    supratitlu: "Ce face",
    titlu: "Cinci lucruri pe care nu le mai faci de mână",
    lead: "Capturile sunt din aplicația reală, pe o firmă inventată. Ce vezi aici vezi și la demonstrație, mișcându-se.",
    randuri: [
      {
        captura: "telefon",
        descriereCaptura:
          "Portalul angajatului pe telefon: salariul lunii, butonul „Am intrat” și lista de lucruri de făcut.",
        eticheta: "Pontaj · art. 119 din Codul muncii",
        titlu: "Pontajul se face de pe telefon, fără aplicație de instalat",
        text: "Omul deschide o adresă în browser și apasă „Am intrat” și „Am ieșit”. Ora scrisă e a serverului, nu a telefonului. La fiecare punct de lucru poți lipi un afiș cu cod QR, tipărit din aplicație, iar firma poate cere scanarea lui înainte de pontare.",
        puncte: [
          "Foaia colectivă a lunii se completează din pontări",
          "Ore suplimentare și de noapte, numărate separat",
          "Managerul aprobă, apoi luna se blochează",
        ],
        legatura: { eticheta: "Cum se pontează pe telefon", href: "/pontaj-pe-telefon" },
      },
      {
        captura: "leave",
        descriereCaptura: "Calendarul de concedii al unei echipe, pe o lună, în Administrativo.",
        eticheta: "Concedii",
        titlu: "Cererea de concediu se aprobă dintr-un clic, iar soldul se calculează singur",
        text: "Angajatul cere concediul din telefon și vede din prima câte zile lucrătoare consumă. Managerul aprobă sau respinge cu motiv, sărbătorile legale se scad singure, iar zilele aprobate apar pe foaia de pontaj fără să le treacă nimeni de mână.",
        puncte: [
          "Treisprezece tipuri de concediu, configurabile pe firmă",
          "Dreptul anual, calculat din vechime și din condițiile de muncă",
          "Calendarul echipei: cine lipsește și când",
        ],
        legatura: { eticheta: "Modulul de concedii", href: "/module/concedii" },
        demo: { eticheta: "Încearcă ecranul, fără cont", href: "/vitrina/leave" },
      },
      {
        captura: null,
        descriereCaptura: "",
        eticheta: "REGES-ONLINE · fost Revisal",
        titlu: "Contractele pleacă în REGES-ONLINE direct din aplicație",
        text: "Din 2026, registrul salariaților se ține doar în REGES-ONLINE. Administrativo pregătește mesajele din fișa angajatului și le transmite prin API-ul REGES, cu termenul legal al fiecărui eveniment calculat în zile lucrătoare. Răspunsul Inspecției Muncii se întoarce în fișa omului.",
        puncte: [
          "Fără fișier de import purtat cu mâna",
          "Datele cu CNP pleacă doar când le trimite un om cu drept de transmitere",
          "Refuzul ITM, explicat pe înțeles",
        ],
        legatura: { eticheta: "Termenele REGES-ONLINE, pe scurt", href: "/reges-online" },
        /*
         * Termenele sunt cele din `src/content/legal/reges.ts`, verificate pe
         * textul HG 295/2025 — aici doar scurtate. Când se schimbă acolo, se
         * schimbă și aici.
         */
        panou: {
          titlu: "Câteva termene din REGES-ONLINE",
          randuri: [
            { ce: "Contract nou", termen: "cel târziu în ziua dinaintea începerii activității" },
            { ce: "Încetarea contractului", termen: "cel târziu la data încetării" },
            { ce: "Transfer", termen: "5 zile lucrătoare" },
            { ce: "Modificarea salariului", termen: "20 de zile lucrătoare" },
          ],
          sursa:
            "HG 295/2025, art. 5. Toate termenele, cu amenzile, sunt pe pagina despre REGES-ONLINE.",
        },
      },
      {
        captura: "payroll",
        descriereCaptura:
          "O perioadă de salarizare aprobată, cu documentele ei, în Administrativo.",
        eticheta: "Salarii",
        titlu: "Luna închisă intră direct în calculul salariilor",
        text: "Orele blocate în pontaj ajung în calculul lunii fără să le retasteze nimeni. Fiecare om își vede fluturașul în portal, iar contabilul primește calculul, nu un tabel de ore. Declarațiile și răspunderea rămân la el.",
        puncte: [
          "Desfășurătorul calculului, pas cu pas, pentru fiecare om",
          "Sporuri și rețineri definite o dată, folosite în fiecare lună",
          "Cotele fiscale le confirmă contabilul înainte de primul calcul real",
        ],
        legatura: { eticheta: "Programul de salarizare", href: "/module/salarizare" },
      },
      {
        captura: "ssm",
        descriereCaptura:
          "Matricea instruirilor SSM pe angajați, cu starea fiecărei instruiri, în Administrativo.",
        eticheta: "Termene · SSM, medicina muncii, ITP",
        titlu: "Ce expiră se vede înainte, nu la control",
        text: "Instruirile SSM, fișele de aptitudine de la medicina muncii, echipamentul de protecție, ITP-ul și RCA-ul mașinilor, verificarea stingătoarelor: toate ajung în aceeași listă de termene, cu alertă înainte să expire.",
        puncte: [
          "„Niciodată făcută” e o stare separată de „expirată”",
          "Fișa individuală de instruire, după anexa 11 la HG 1425/2006",
          "Parc auto: ITP, RCA, rovinietă și foi de parcurs",
        ],
        legatura: { eticheta: "SSM și PSI", href: "/module/ssm" },
      },
    ],
    restTitlu: "Toate cele nouăsprezece module, fiecare cu pagina lui",
    legaturaModule: { eticheta: "Toate modulele, pe o singură pagină", href: "/module" },
    notaCaptura: "Captură din aplicația reală. Firma și oamenii din ea sunt inventați.",
    mareste: "apasă pentru a mări",
    inchide: "Închide",
  },

  pentruCine: {
    supratitlu: "Pentru cine",
    titlu: "Un singur cont pentru toată firma. Fiecare vede doar ce-l privește.",
    lead: "Cinci roluri, fiecare cu drepturile lui. Managerul vede echipa lui, angajatul vede doar ce e al lui, iar regula stă în baza de date, nu într-un meniu ascuns.",
    roluri: [
      {
        cine: "Patronul",
        text: "Vezi dintr-o privire cine e la lucru, cine e în concediu și ce termene expiră luna asta. Aprobi cererile dintr-un clic și știi oricând ce ar găsi un inspector la control.",
        legatura: { eticheta: "Cum arată pe domeniul tău", href: "/domenii" },
      },
      {
        cine: "Omul de resurse umane",
        text: "Dosarele, contractele, concediile, instruirile și REGES-ONLINE, într-un singur loc. Angajații vin din Excel o singură dată, iar contractul și fișa postului se generează din datele lor.",
        legatura: { eticheta: "Ce cere legea, pe scurt", href: "/ghid" },
      },
      {
        cine: "Contabilul extern",
        text: "Toate firmele pe care le ții, într-un singur cont, cu un meniu din care comuți între ele. Primești luna închisă, nu orele retastate pe e-mail.",
        legatura: { eticheta: "Pentru contabili", href: "/pentru-contabili" },
      },
      {
        cine: "Angajatul",
        text: "Se pontează, cere concediu și își vede soldul, fluturașul și documentele de pe telefon, fără să mai întrebe pe nimeni.",
        legatura: { eticheta: "Portalul angajatului", href: "/module/portal-angajat" },
      },
    ],
  },

  unelteGratuite: {
    supratitlu: "Gratuit, fără cont",
    titlu: "Unelte și modele pe care le folosești chiar acum",
    lead: "Calculatorul de salariu și modelele cerute la control, gata de completat și de descărcat. Fără cont și fără adresă de e-mail lăsată în schimb.",
    unelte: [
      {
        titlu: "Calculator salariu net și brut",
        text: "Scrii brutul și afli netul, sau invers, cu valorile din iulie 2026: salariul minim, deducerea personală, CAS, CASS, impozitul și costul total pentru firmă.",
        formate: "Online",
        href: "/unelte/calculator-salariu",
      },
      {
        titlu: "Foaie de pontaj lunar",
        text: "Alegi luna și scrii numele; weekendurile și sărbătorile legale se marchează singure.",
        formate: "PDF · Word · Excel",
        href: "/unelte/foaie-de-pontaj",
      },
      {
        titlu: "Condica de prezență",
        text: "Fiecare zi lucrătoare, cu ora sosirii, ora plecării și semnătura.",
        formate: "PDF · Word · Excel",
        href: "/unelte/condica-de-prezenta",
      },
      {
        titlu: "Cerere de concediu de odihnă",
        text: "Cu zilele lucrătoare calculate, plus variantele fără plată și pentru evenimente familiale.",
        formate: "PDF · Word",
        href: "/unelte/cerere-concediu-de-odihna",
      },
      {
        titlu: "Foaie de parcurs",
        text: "Mașina, șoferul și luna: traseul, scopul deplasării și kilometrii.",
        formate: "PDF · Word · Excel",
        href: "/unelte/foaie-de-parcurs",
      },
      {
        titlu: "Fișa de instruire SSM",
        text: "Fișa individuală după anexa 11 la HG 1425/2006, cu datele lucrătorului completate.",
        formate: "PDF · Word",
        href: "/unelte/fisa-instruire-ssm",
      },
      {
        titlu: "Fișa de evaluare a angajaților",
        text: "Criteriile firmei, cu pondere și notă pe fiecare, plus semnăturile.",
        formate: "PDF · Word · Excel",
        href: "/unelte/fisa-evaluare",
      },
    ],
    ghiduriTitlu: "Ghiduri, cu articolul de lege lângă fiecare afirmație",
    ghiduri: [
      { eticheta: "Salariul minim pe economie", href: "/ghid/salariu-minim-pe-economie" },
      { eticheta: "Evidența orelor de muncă", href: "/evidenta-orelor-de-munca" },
      { eticheta: "REGES-ONLINE: termene și amenzi", href: "/reges-online" },
      { eticheta: "Ore suplimentare", href: "/ghid/ore-suplimentare" },
      { eticheta: "Spor de noapte", href: "/ghid/spor-de-noapte" },
      { eticheta: "Concediul de odihnă", href: "/ghid/concediu-de-odihna" },
      { eticheta: "Diurna externă, pe țări", href: "/ghid/diurna-externa" },
      { eticheta: "Diurna în țară", href: "/ghid/diurna" },
      { eticheta: "Controlul ITM", href: "/ghid/control-itm" },
    ],
    legaturaToate: { eticheta: "Toate uneltele gratuite", href: "/unelte" },
  },

  promisiuni: {
    supratitlu: "Suntem la început",
    titlu: "N-avem încă recomandări. Avem promisiuni.",
    lead: "Nu punem testimoniale scrise de noi și nici sigle de firme care nu ne folosesc. Iată, în schimb, ce ne asumăm față de fiecare firmă care începe acum — fiecare se poate verifica de la primul telefon.",
    puncte: [
      {
        titlu: "Vorbești cu oamenii care fac aplicația",
        text: "La telefon nu răspunde un centru de apeluri. Ce ne ceri ajunge direct la cei care o construiesc.",
      },
      {
        titlu: "Datele rămân ale tale",
        text: "Dacă renunți, îți exportăm tot ce ținem despre firma ta, în format deschis. Nu ținem date ca argument de negociere.",
      },
      {
        titlu: "Limitele le afli înainte, nu după",
        text: "Ce nu face aplicația e scris pe site, pe pagina „Ce nu facem”, nu descoperit după ce ai semnat.",
      },
      {
        titlu: "Construim în ordinea în care ne cereți",
        text: "Funcțiile noi vin în ordinea în care ni le cer firmele. Dacă îți lipsește ceva, spune-ne la prima discuție.",
      },
    ],
  },

  preturi: {
    supratitlu: "Prețuri",
    titlu: "149 de lei pe lună, până la 20 de angajați",
    lead: "Un nucleu care vine mereu și module care se aprind separat. Prima lună e gratuită, nu se facturează pornirea, iar sumele de mai jos sunt cele finale — nu se mai adaugă TVA.",
    planuri: [
      {
        cheie: "nucleu",
        nume: "Nucleu HR",
        pentru: "Punctul de plecare: pontaj, concedii, dosare și portalul angajatului",
      },
      {
        cheie: "hr_extins",
        nume: "HR extins",
        pentru: "Peste nucleu: REGES-ONLINE, integrare, cursuri, SSM, evaluări și KPI-uri",
      },
      {
        cheie: "operational",
        nume: "Operațional",
        pentru: "Peste nucleu: parc auto, mentenanță, inventar, anunțuri și tichete",
      },
      {
        cheie: "financiar",
        nume: "Financiar",
        pentru: "Peste nucleu: salarizare, deplasări și diurne, rapoarte",
      },
      {
        cheie: "tot",
        nume: "Toată aplicația",
        pentru: "Tot ce există azi, plus asistentul. Modulele noi intră automat.",
      },
    ],
    capModul: "Modul",
    inLocDe: "în loc de",
    pesteNucleu: "Tot ce e în Nucleu HR, plus:",
    mentiuneTva:
      "Preț final. Nu suntem înregistrați în scopuri de TVA, deci nu se mai adaugă nimic.",
    pestePrag: {
      text: "Peste 20 de angajați prețul crește în trepte.",
      legatura: { eticheta: "Cere o ofertă pentru câți oameni ai", href: "/cere-demo" },
    },
    primaLuna:
      "Prima lună e gratuită, pentru orice configurație. Fără cost de pornire și fără implementare facturată separat.",
    nota: "Cele trei pachete din mijloc sunt axe paralele peste același nucleu, nu trepte: pornești doar axa de care ai nevoie. Suma tăiată e cât ar costa aceleași module cumpărate unul câte unul.",
    legaturaPagina: { eticheta: "Vezi prețul fiecărui modul", href: "/preturi" },
  },

  siguranta: {
    supratitlu: "Datele oamenilor tăi",
    titlu: "CNP-uri, salarii, concedii medicale. Le tratăm ca atare.",
    lead: "Într-un program de HR stau cele mai sensibile date ale unei firme. Pe scurt, cum le ținem — iar varianta lungă, cu tot mecanismul, e pe pagina despre izolarea datelor.",
    puncte: [
      {
        titlu: "Separate pe firmă, în baza de date",
        text: "Nu printr-un filtru din aplicație: baza de date nu întoarce nimic dintr-o altă firmă, nici măcar unei cereri scrise greșit de noi.",
      },
      {
        titlu: "CNP și IBAN criptate",
        text: "Se scriu criptat și se citesc doar printr-o cale care lasă urmă: cine le-a văzut și când.",
      },
      {
        titlu: "Fiecare modificare, cu nume și oră",
        text: "Cine a schimbat, când și ce anume. Jurnalul se adaugă, nu se rescrie — nici de noi.",
      },
      {
        titlu: "În Uniunea Europeană",
        text: "Baza de date și fișierele stau în Irlanda, iar serverul aplicației în Germania.",
      },
    ],
    legatura: { eticheta: "Cum ținem datele separate", href: "/incredere" },
  },

  incepe: {
    supratitlu: "Cum începi",
    titlu: "Primul pontaj, în aceeași zi",
    lead: "Nu se instalează nimic și nu se migrează nimic. Îți faci contul, urci lista de angajați dintr-un fișier Excel și pontezi luna în curs.",
    pasi: [
      {
        titlu: "Îți faci contul",
        text: "Câteva minute, fără card și fără cost de pornire. Prima lună e gratuită.",
      },
      {
        titlu: "Aduci angajații din Excel",
        text: "Coloanele se potrivesc singure după antet. Rândurile bune intră, cele greșite îți vin înapoi cu motivul.",
      },
      {
        titlu: "Îți inviți oamenii",
        text: "Pe e-mail, fiecare cu rolul lui. Se pontează din browserul telefonului, fără nimic de instalat.",
      },
      {
        titlu: "Închidem prima lună împreună",
        text: "Primul pontaj și primul calcul de salarii le trecem cu tine, la telefon. După aceea le faci singur.",
      },
    ],
    alternativa: {
      text: "Preferi să vezi întâi cum arată? O discuție de o jumătate de oră, pe modulele care te interesează — nu o prezentare de vânzări.",
      legatura: { eticheta: "Programează o demonstrație", href: "/cere-demo" },
    },
  },
  intrebari: {
    supratitlu: "Întrebări frecvente",
    titlu: "Răspunsurile, pe scurt",
    lead: "Dacă întrebarea ta nu e aici, sună. Răspundem și la cele incomode.",
    intrebari: [
      {
        q: "Ce fac cu fișierul Excel pe care îl am acum?",
        a: "Fișierul de calcul cu angajații se încarcă în Administrativo, nu se retastează. Coloanele se potrivesc singure după antet, oricum ar fi scris: „Data nașterii”, „DATA NASTERII” și „data-nasterii” ajung la același câmp, fără diacritice și fără punctuație. Dacă lipsește o coloană obligatorie, importul îți spune care, pe nume, înainte să scrie ceva. Validarea se face apoi rând cu rând: rândurile bune intră, cele stricate îți vin înapoi într-un fișier cu motivul fiecărei respingeri, scris pe înțeles. Nu se importă „pe jumătate” și nu se pierde nimic tăcut — dacă zece rânduri din o sută au CNP greșit, intră nouăzeci și primești zece înapoi, nu un mesaj de eroare pe tot fișierul.",
      },
      {
        q: "Datele noastre pot ajunge la altă firmă din platformă?",
        a: "Datele unei firme nu ajung la alta, iar mecanismul care o garantează nu e un filtru scris în aplicație. Fiecare interogare trece prin politici la nivel de rând, în Postgres, activate obligatoriu pe fiecare tabelă și forțate inclusiv pentru proprietarul ei. O interogare care ar depăși granița firmei nu întoarce rânduri — nu întoarce o eroare pe care cineva ar putea s-o prindă și s-o ignore, ci pur și simplu nimic. Apartenența ta la firmă se recalculează la fiecare cerere, din datele reale, nu dintr-un cookie sau dintr-un identificator trimis de browser. Verificarea rulează automat la fiecare livrare de cod: dacă o politică lipsește de pe o tabelă nouă, livrarea se oprește înainte să ajungă la voi.",
      },
      {
        q: "Contabila mea vede salariile tuturor. Managerul poate?",
        a: "Nu, managerul de echipă nu vede salariile oamenilor lui. Diferența față de alte aplicații e că nu e vorba de absența unui drept, ci de un refuz scris: pe fiecare acțiune din salarizare, rolul de manager are un „nu” trecut explicit în baza de date. Un drept lipsă se poate acorda din greșeală la o configurare viitoare; un refuz scris trebuie șters de cineva care știe ce face. Contabila, în schimb, vede tot ce ține de salarizare, fiindcă asta e treaba ei. Dacă vrei totuși ca un anumit manager să vadă salariile echipei lui, se schimbă o linie de configurare pe firma ta, fără o versiune nouă a aplicației. Tabelul complet cu cine ce vede, pe fiecare modul, e pe pagina de module.",
      },
      {
        q: "Ce se întâmplă când pleacă un angajat?",
        a: "Când pleacă un angajat, fișa lui se închide, dar nimic nu se șterge fizic din baza de date. Documentele, pontajul, concediile și instruirile rămân, fiindcă exact ele se cer la un control pentru perioada în care omul a lucrat la tine. În aplicație, contul lui nu mai intră, iar în REGES-ONLINE încetarea contractului are termenul ei, urmărită ca orice alt eveniment. În aplicație, nimeni nu poate șterge un rând — nici administratorul firmei, nici al nostru: rândul se marchează ca închis și rămâne în istoric. Garanția stă în baza de date, nu într-un buton ascuns: pe datele firmelor nu există nicio politică de ștergere, deci o comandă de ștergere venită din aplicație nu atinge niciun rând. Ștergerea definitivă o facem noi, doar după încetarea contractului cu firma ta, în termenele scrise în Termeni.",
      },
      {
        q: "Înlocuiește contabilul?",
        a: "Nu, și n-ar trebui să vrei asta. Calculăm și ținem evidența; declarațiile și răspunderea rămân la contabilul tău. Cotele le confirmă el, iar aplicația marchează asta explicit până o face.",
      },
      {
        q: "Merge pe telefon?",
        a: "Da, Administrativo merge pe telefon din browser, fără instalare din magazin. Portalul angajatului e făcut pentru ecran mic: soldul de concediu, cererile depuse, luna lui de pontaj, fluturașul și documentele primite. Adresa se adaugă pe ecranul principal — pe iPhone din Safari, pe Android din Chrome — și de atunci pornește pe tot ecranul, ca o aplicație, fără să ocupe spațiu ca una și fără actualizări de instalat. De acolo omul își poate și ponta ziua, dacă firma a pornit butoanele de pontare rapidă, iar la punctele de lucru se poate cere scanarea codului QR de pe afiș înainte. Ce nu merge: fără internet nu se scrie nimic, fiindcă portalul nu ține date offline. În magazinele de aplicații nu suntem.",
      },
      {
        q: "Ce arăt la un control ITM?",
        a: "La un control ITM se cer documentele de personal, iar Administrativo le are pe toate într-un singur loc: fișele de instruire cu data și semnătura, evidența medicinei muncii, echipamentul de protecție dat în primire cu durata lui, foaia de prezență a lunii cerute și jurnalul care arată cine a modificat ce și când. Evidența SSM e o matrice cu oamenii pe verticală și tipurile de instruire pe orizontală, în care „niciodată făcută” e o stare separată de „expirată” — la un control înseamnă două lucruri diferite. Termenele se văd înainte să expire, nu în ziua în care expiră, deci instruirea se poate reprograma. Ce se cere exact și în ce ordine se verifică e scris pe pagina noastră despre controlul ITM, cu articolul de lege lângă fiecare afirmație.",
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
        a: "Le iei. Exportăm ce ținem despre tine în format deschis. După încetarea contractului, datele rămân accesibile treizeci de zile, apoi se șterg definitiv în cel mult încă treizeci, inclusiv din copiile de siguranță. Nu ținem date ca argument de negociere.",
      },
      {
        q: "Cât costă?",
        a: "Nucleul — pontaj, concedii, dosare și portalul angajatului — costă 149 de lei pe lună, până la 20 de angajați, iar prima lună e gratuită. Modulele în plus au fiecare prețul lui, afișat pe pagina de prețuri, și sunt sume finale: nu se mai adaugă TVA. Peste 20 de angajați prețul crește în trepte — cere o ofertă și îți spunem cifra pentru câți oameni ai.",
      },
    ],
  },

  intrebariScurte: {
    supratitlu: "Întrebări",
    titlu: "Ce se întreabă înainte de primul clic",
    intrebari: [
      {
        q: "Cât costă?",
        a: "Nucleul — pontaj, concedii, dosare și portalul angajatului — costă 149 de lei pe lună pentru toată firma, până la 20 de angajați. Modulele în plus au fiecare prețul lui. Prima lună e gratuită, iar sumele sunt finale: nu se mai adaugă TVA.",
        legatura: { eticheta: "Prețul fiecărui modul", href: "/preturi" },
      },
      {
        q: "Trebuie instalat ceva?",
        a: "Nu. Administrativo merge din browser, pe calculator și pe telefon. Angajații adaugă adresa pe ecranul de start al telefonului și o deschid ca pe o aplicație, fără magazin de aplicații și fără actualizări de instalat.",
      },
      {
        q: "Ce arăt la un control ITM?",
        a: "Evidența orelor cu ora de început și de sfârșit a fiecărei zile, cerută de art. 119 din Codul muncii, fișele de instruire SSM, evidența medicinei muncii și jurnalul modificărilor — scoase din aplicație, nu căutate prin dosare.",
        legatura: { eticheta: "Ce verifică inspectorul, pe rând", href: "/ghid/control-itm" },
      },
      {
        q: "Lucrează cu contabilul meu?",
        a: "Da. Contabilul primește acces în contul firmei, cu rolul lui, iar dacă ține mai multe firme le vede pe toate dintr-un singur cont. Declarațiile și răspunderea rămân la el.",
        legatura: { eticheta: "Pagina pentru contabili", href: "/pentru-contabili" },
      },
      {
        q: "Ce fac cu Excelul de acum?",
        a: "Îl încarci. Coloanele se potrivesc după antet, oricum ar fi scrise, rândurile bune intră, iar cele greșite îți vin înapoi într-un fișier, cu motivul fiecăruia. Nu se importă nimic pe jumătate.",
      },
      {
        q: "Ce nu face Administrativo?",
        a: "Nu depune declarații la ANAF, nu emite e-Factura și nu ține contabilitatea. Nu e nici în magazinele de aplicații: portalul angajatului merge din browser. Lista completă e scrisă pe față.",
        legatura: { eticheta: "Ce nu facem, pe larg", href: "/de-ce-nu" },
      },
    ],
    legatura: { eticheta: "Toate întrebările, cu răspunsurile lungi", href: "/intrebari" },
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
    cine: "Administrativo e făcut de {firma}, în {oras}. La telefon răspunde un om din echipa care construiește aplicația.",
    formularTitlu: "Sau lasă-ne datele tale",
  },

  subsol: {
    descriere:
      "Administrativo — pontaj, concedii, salarizare, SSM, parc auto și inventar pentru firme din România. Fiecare firmă are propriul spațiu de date, propriile roluri și doar modulele de care are nevoie.",
    /*
     * 6 oct 2026: uneltele și ghidurile au coloane proprii. Auditul din 6 oct a
     * găsit că subsolul omitea exact paginile cel mai slab legate — sporul de
     * noapte, fișa SSM, foaia de parcurs, diurna în țară — iar el e singurul
     * bloc de legături prezent pe toate cele cincizeci și ceva de pagini.
     */
    coloane: [
      {
        titlu: "Produs",
        legaturi: [
          { eticheta: "Toate modulele", href: "/module" },
          { eticheta: "Pontaj de pe telefon", href: "/pontaj-pe-telefon" },
          // Al doilea cititor al sitului, după administratorul firmei. Până pe
          // 18 sept 2026 nu-i vorbea nicio pagină, deși e cel care alege
          // programul în bună parte din cazuri.
          { eticheta: "Pentru contabili", href: "/pentru-contabili" },
          { eticheta: "Prețuri", href: "/preturi" },
          { eticheta: "Izolarea datelor", href: "/incredere" },
          { eticheta: "Excel sau aplicație", href: "/comparatie/excel" },
          // Hub-urile aveau o singură cale de acces: firimitura din pagina-copil.
          // Un vizitator care nu deschide copilul nu află niciodată că există.
          { eticheta: "Toate comparațiile", href: "/comparatie" },
          { eticheta: "Ce nu facem", href: "/de-ce-nu" },
          { eticheta: "Întrebări frecvente", href: "/intrebari" },
          // Singura legătură spre cererea de demonstrație era butonul de pe
          // /pontaj-pe-telefon; restul site-ului trimite la înregistrarea directă.
          { eticheta: "Cere o demonstrație", href: "/cere-demo" },
        ],
      },
      {
        titlu: "Unelte gratuite",
        legaturi: [
          // 5 oct 2026: calculatorul — cea mai căutată unealtă — avea două legături
          // interne, iar Google nu găsise încă fișa de evaluare.
          { eticheta: "Calculator salariu net", href: "/unelte/calculator-salariu" },
          { eticheta: "Foaie de pontaj", href: "/unelte/foaie-de-pontaj" },
          { eticheta: "Condica de prezență", href: "/unelte/condica-de-prezenta" },
          { eticheta: "Cerere de concediu", href: "/unelte/cerere-concediu-de-odihna" },
          { eticheta: "Foaie de parcurs", href: "/unelte/foaie-de-parcurs" },
          { eticheta: "Fișă de instruire SSM", href: "/unelte/fisa-instruire-ssm" },
          { eticheta: "Fișă de evaluare", href: "/unelte/fisa-evaluare" },
          { eticheta: "Toate uneltele", href: "/unelte" },
        ],
      },
      {
        titlu: "Ghiduri",
        legaturi: [
          { eticheta: "Salariul minim pe economie", href: "/ghid/salariu-minim-pe-economie" },
          { eticheta: "Evidența orelor (art. 119)", href: "/evidenta-orelor-de-munca" },
          { eticheta: "REGES-ONLINE: termene", href: "/reges-online" },
          // Necunoscut lui Google pe 5 oct 2026.
          { eticheta: "Ore suplimentare", href: "/ghid/ore-suplimentare" },
          { eticheta: "Spor de noapte", href: "/ghid/spor-de-noapte" },
          { eticheta: "Concediul de odihnă", href: "/ghid/concediu-de-odihna" },
          { eticheta: "Diurna externă pe țări", href: "/ghid/diurna-externa" },
          { eticheta: "Diurna în țară", href: "/ghid/diurna" },
          { eticheta: "Control ITM: ce se cere", href: "/ghid/control-itm" },
          { eticheta: "Toate ghidurile", href: "/ghid" },
        ],
      },
      {
        titlu: "Domenii",
        legaturi: [
          // Patru etichete, patru destinații. Au dus toate la aceeași ancoră
          // până la împărțirea în pagini proprii — patru linkuri către o
          // singură adresă sunt, pentru un crawler, un singur link.
          { eticheta: "Construcții și instalații", href: "/domenii/constructii" },
          { eticheta: "Producție și fabrici", href: "/domenii/productie" },
          { eticheta: "Transport și logistică", href: "/domenii/transport" },
          { eticheta: "Servicii, birouri și comerț", href: "/domenii/servicii" },
          // Hub-ul n-avea nicio legătură care să ducă la el până la 17 sept 2026
          // — exista doar în sitemap și în llms.txt.
          { eticheta: "Toate domeniile", href: "/domenii" },
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
    creditVideo:
      "Videoclipul de pe pagina de start: „Office Stock Footage”, de pe canalul de YouTube Free Stock Footage 4K, licență Creative Commons Attribution.",
  },

  /*
   * Antetele paginilor secundare.
   *
   * Sunt scrise pentru cineva care a ajuns acolo DIRECT dintr-o căutare, nu
   * derulând pagina de start. De aceea fiecare își spune singură despre ce e,
   * fără să presupună că vizitatorul a citit ceva înainte.
   */
  pagini: {
    module: {
      supratitlu: "Ce e înăuntru",
      titlu: "Nouăsprezece module, pornite câte unul",
      lead: "Patru module vin în nucleu, iar cincisprezece se aprind și se sting separat. Plătești ce ai pornit, iar ce nu folosești nu apare nici în meniu, nici pe factură.",
    },
    incredere: {
      supratitlu: "Unde stă bariera",
      titlu: "Datele unei firme nu ajung la alta. Regula stă în Postgres.",
      lead: "Nu în meniu, nu într-un filtru de aplicație. Mai jos e unde anume stă bariera, ce se întâmplă când o scriere o încalcă, și cât timp ținem fiecare fel de dată.",
    },
    deCeNu: {
      supratitlu: "Înainte să întrebi",
      titlu: "Ce nu facem, scris înainte de a treia întâlnire",
      lead: "Lista limitelor pe care alți furnizori le spun după ce ai semnat. E aici fiindcă e mai ieftin pentru amândoi să afli acum, plus o comparație onestă cu felul în care lucrezi azi.",
    },
    intrebari: {
      supratitlu: "Întrebări",
      titlu: "Ce ne întreabă lumea înainte să semneze",
      lead: "Răspunsurile pe care le dăm oricum la telefon, scrise o dată. Dacă întrebarea ta nu e aici, sună — numărul e în subsol și răspunde un om.",
    },
    domenii: {
      supratitlu: "Pe domenii",
      // H1-ul spune și domeniile: „altă ordine de importanță" singur nu conținea
      // niciun cuvânt pe care l-ar căuta cineva (auditul din 7 oct 2026).
      titlu: "Aceleași module, altă ordine: construcții, producție, transport, servicii",
      lead: "Nu vindem versiuni diferite pe industrii. Se schimbă doar ce pornești întâi și ce ajunge pe primul ecran, iar mai jos scrie exact ce anume, pentru patru feluri de firmă.",
    },
    pentruContabili: {
      supratitlu: "Pentru contabili",
      titlu: "Un cont, toate firmele pe care le ții",
      lead: "Contabilul nu e un utilizator în plus al unei firme, ci aceeași persoană în zece firme deodată. Aplicația e construită pe apartenențe, nu pe conturi separate: intri o dată și comuți între clienți dintr-un meniu.",
    },
    pontajTelefon: {
      supratitlu: "Aplicație de pontaj pentru angajați",
      titlu: "Aplicația de pontaj pe telefon, fără instalare din magazin",
      lead: "Omul de pe șantier deschide aplicația de pontaj din browserul telefonului, o adaugă pe ecranul de start și pontează online. Fără cont în App Store sau Google Play, fără actualizări de instalat, fără un telefon care nu mai are loc.",
    },
    ghid: {
      supratitlu: "Ghiduri",
      titlu: "Ce cere legea, cu articolul lângă fiecare afirmație",
      lead: "Evidența orelor, REGES-ONLINE, concediul de odihnă, diurna și controlul ITM, scrise pentru cine răspunde de ele într-o firmă mică. Fiecare pagină spune și ce nu se poate afirma cu certitudine.",
    },
    unelte: {
      supratitlu: "Unelte",
      titlu: "Unelte gratuite, fără cont",
      lead: "Lucruri care se folosesc pe loc: fără cont, fără adresă de e-mail lăsată în schimb și fără o probă care expiră.",
    },
    comparatie: {
      supratitlu: "Comparații",
      titlu: "Când merită schimbarea și când nu",
      lead: "Comparații cu felul în care se lucrează azi, inclusiv situațiile în care răspunsul corect e să rămâi la ce ai.",
    },
  },
};
