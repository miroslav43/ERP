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
      "SUP și NPT sunt din care, nu în plus — orele lucrate le includ deja. Aplicația nici nu primește o zi cu mai multe ore SUP sau NPT decât ore lucrate.",
    notaNorma:
      "Douăzeci de zile lucrătoare × opt ore = 160 de ore normă. Vinerea Mare și a doua zi de Paște sunt libere; Paștele ortodox cade duminică în 2026, deci nu adaugă o zi. Sărbătorile cu dată variabilă se calculează din data Paștelui, nu se iau dintr-o listă scrisă de mână.",
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
        nota: "Indiferent de pachet și de module. Fără card cerut la înscriere.",
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
    lead: "Ce intră o dată nu se mai retastează. Legăturile de mai jos funcționează azi în aplicație, exact cum sunt descrise — nu sunt o schemă de prezentare.",
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
        eticheta: "la aprobare",
        text: "Concediul aprobat devine zi de concediu pe foaie. Făcută de zece ori, trecerea dă același rezultat ca o dată: nicio zi nu se dublează.",
      },
      {
        de: "pontaj",
        la: "salarizare",
        eticheta: "la închiderea lunii",
        text: "Orele lunii închise intră în statul de plată, inclusiv cele lucrate în weekend și de sărbători. Calculul a fost refăcut după două greșeli care le pierdeau fără niciun avertisment.",
      },
      {
        de: "angajati",
        la: "scadente",
        eticheta: "termene",
        text: "Contracte, permise, instruiri, documente de vehicul — termenele tuturor stau într-o singură listă și primești alertă înainte să expire.",
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
        eticheta: "automat",
        text: "Orice modificare rămâne consemnată: cine, când, de la ce adresă și ce s-a schimbat.",
      },
      {
        de: "scadente",
        la: "audit",
        eticheta: "fără ștergere",
        text: "Jurnalul doar se completează, nu se rescrie: în aplicație nu există nicio cale de a șterge ceva din el.",
      },
    ],
    nota: "Oricare dintre legăturile de mai sus ți-o arătăm funcționând la demonstrație, dacă o ceri.",
  },

  module: {
    supratitlu: "Module",
    titlu: "Nouăsprezece module. Pornești doar ce folosești.",
    lead: "Ce nu e pornit nu apare în meniu, nici în căutare, și nu se deschide nici dacă cineva tastează adresa paginii. Modulele se pornesc și se opresc separat, pentru fiecare firmă.",
    grupuri: [
      {
        cheie: "core",
        titlu: "Platformă",
        module: [
          {
            cheie: "nucleu",
            titlu: "Organizație, roluri și audit",
            text: "Firma, membrii, invitațiile pe e-mail și urma fiecărei modificări. Un om poate lucra pentru mai multe firme și trece de la una la alta fără să iasă din cont.",
            puncte: [
              "Conturile se creează exclusiv prin invitație",
              "Cinci roluri, fiecare cu drepturile lui",
              "Jurnal care doar se completează, nu se rescrie",
            ],
          },
          {
            cheie: "asistent",
            titlu: "Asistent AI",
            text: "Un asistent care răspunde la „unde se face X?” și îți dă butonul care te duce acolo. Nu-ți poate arăta un ecran la care n-ai acces: te trimite doar unde ai deja voie să intri.",
            puncte: [
              "Îți spune pe unde să apeși, apoi îți scurtează drumul la un singur buton",
              "Răspunde și cu cifre reale: sold de concediu, ce ai de aprobat",
              "Nu face nimic în locul tău — explică și te duce, apeși tu",
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
              "Ore suplimentare și de noapte, cuprinse în orele lucrate, nu adunate peste ele",
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
            puncte: ["Șabloane cu pași în ordinea dorită", "Dovada parcurgerii, gata de tipărit"],
          },
          {
            cheie: "courses",
            titlu: "Cursuri",
            text: "Bibliotecă de materiale PDF și video, parcurse direct în aplicație. Pentru fiecare material alegi cât de serioasă e dovada: o bifă, cât la sută trebuie parcurs sau o declarație asumată.",
            puncte: [
              "Filmele și documentele se văd în aplicație, fără să plece nicăieri",
              "Recertificare la termen, care reapare singură în lista omului",
            ],
          },
          {
            cheie: "reges",
            titlu: "REGES-Online (fost Revisal)",
            text: "Contractele și salariații pleacă la Inspecția Muncii din aplicație, prin legătura directă cu REGES-ONLINE. Fără fișier de import purtat cu mâna și fără a doua tastare a acelorași date.",
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
            text: "Un tabel cu fiecare angajat și fiecare tip de instruire, cu semafor pe scadențe. „Niciodată făcută” e o stare distinctă de „expirată” — și e mai gravă.",
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
              "Kilometraj care scade: imposibil, deci nu se acceptă",
              "Salt peste prag: posibil, dar se semnalează",
            ],
          },
          {
            cheie: "maintenance",
            titlu: "Mentenanță",
            text: "Echipamente, revizii planificate și sesizări de defecțiune, cu triaj pe urgență.",
            puncte: [
              "Scadență pe zile ȘI pe contor — ore, kilometri, cicluri",
              "Contează cel mai urgent dintre cele două termene",
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
            text: "Solicitări către IT: software, hardware, defecțiuni pe obiectele din inventar și erori semnalate din aplicație. Tichetul intră într-o coadă, nu într-un chat.",
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
            text: "Calculul merge pas cu pas, cu desfășurător și avertismente. Cotele sunt ale firmei tale, fiecare cu data de la care se aplică. Când se schimbă legea, se schimbă o setare, nu programul.",
            puncte: [
              "Sporuri și prime reutilizabile, definite o dată",
              "Rețineri plafonate ca procent din net",
              "Tichetele de masă nu intră în baza CAS; în CASS, după setarea confirmată de contabil",
            ],
          },
          {
            cheie: "per_diem",
            titlu: "Deplasări și diurne",
            text: "Ordine de deplasare, etape pe țări și deconturi. Zilele de diurnă se numără din 24 în 24 de ore de la plecare, nu de la miezul nopții.",
            puncte: [
              "Ziua trecerii de frontieră se plătește o singură dată, unei singure țări",
              "Barem pe țări și curs la data plecării",
              "Decont gata de tipărit",
            ],
          },
          {
            cheie: "rapoarte",
            titlu: "Rapoarte",
            text: "Venituri, concedii și tichete, adunate pe toată firma. Cifrele vin direct din salariile calculate, deci raportul spune exact ce scrie pe statele de plată.",
            puncte: [
              "Le vede doar cine are acces la toată firma, nu managerul de echipă",
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
        text: "Cine răspunde de cine. O vede și managerul care are acces doar la ramura lui.",
      },
      {
        cod: "XLS",
        titlu: "Import de angajați din Excel",
        text: "Arăți ce conține fiecare coloană, fiecare rând e verificat, angajații intră pe loturi, iar rândurile respinse vin într-un raport CSV, cu motivul fiecăruia.",
      },
      {
        cod: "DOC",
        titlu: "Documente din șabloane",
        text: "Contract individual de muncă, fișa postului și trei adeverințe, numerotate pe serie și cu cod de verificare. Dacă textul e schimbat după emitere, se poate dovedi.",
      },
      {
        cod: "CAEN",
        titlu: "Nomenclator CAEN și validare CUI",
        text: "Codul fiscal se verifică cu cifra de control. Codurile secundare respectă limitele formei juridice.",
      },
      {
        cod: "REV",
        titlu: "Registrul de evenimente REVISAL",
        text: "Zece tipuri de eveniment, cu termenul calculat din setările firmei și starea „în termen / astăzi / întârziat”.",
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
        text: "Cine, când, de la ce adresă, ce s-a schimbat. Se descarcă în CSV și se deschide în Excel fără formule strecurate în celule.",
      },
    ],
  },

  pontaj: {
    supratitlu: "Cum ajung orele în sistem",
    titlu: "Șase moduri care merg azi. Patru pe care încă nu le avem.",
    lead: "Le desenăm diferit ca să nu le confunzi. Ce e plin există și se poate vedea la demonstrație. Ce e hașurat nu există — nu e construit nici măcar pe jumătate.",
    livrateTitlu: "Merge azi",
    livrate: [
      {
        titlu: "Pontare dintr-o atingere, de pe telefon",
        text: "Din portalul angajatului, în browser: un buton care confirmă ziua obișnuită sau două — „Am intrat” și „Am ieșit”. Ora pontajului e cea oficială, nu cea de pe telefonul omului.",
        detaliu: "Firma alege modul: confirmare, ceas sau amândouă",
      },
      {
        titlu: "Afișul cu cod QR la punctul de lucru",
        text: "Fiecare punct de lucru are un afiș tipărit din aplicație. Omul scanează codul cu camera telefonului și pontează pe punctul acela; firma poate cere scanarea înainte de pontare.",
        detaliu: "Codul rămâne același până îl schimbă administratorul",
      },
      {
        titlu: "Foaia colectivă lunară",
        text: "Grila zi × angajat. Se completează ora de intrare și de ieșire, iar orele se calculează singure și se pot corecta.",
        detaliu: "Un rând pe zi și pe om: aceeași zi nu se trece de două ori",
      },
      {
        titlu: "Planul săptămânii",
        text: "Angajatul își declară programul pentru săptămâna următoare, cu mod de prezență: birou, homeoffice, deplasare, delegație.",
        detaliu: "Trimitere și aprobare individuală, pe săptămână",
      },
      {
        titlu: "Sincronizare din concedii",
        text: "Concediul aprobat devine zi de concediu pe foaie, fără ca cineva să retasteze ceva.",
        detaliu: "Pornită de zece ori, are același efect ca o dată: nimic nu se dublează",
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
        text: "Pontarea acceptată doar în raza punctului de lucru declarat, cu o marjă de distanță aleasă de firmă.",
      },
      {
        titlu: "Recunoaștere facială la chioșc",
        text: "Verificare la un terminal fix. Măsurătorile feței sunt date biometrice: cer consimțământ explicit, evaluare de impact și criptare.",
      },
    ],
    notaViitoare:
      "Niciuna dintre cele patru nu există azi. Afișul QR de mai sus are un cod fix, schimbat de administrator; codul care se schimbă singur, la câteva zeci de secunde, e cel de aici. Dacă una ți-ar schimba decizia, spune-ne — construim în ordinea în care ne-o cer firmele care ne scriu.",
    buton: { eticheta: "Am nevoie de asta", href: "/cere-demo" },
  },

  fluxuri: {
    supratitlu: "Trei drumuri",
    titlu: "Cum arată o lună, de la un capăt la altul",
    lead: "Fiecare pas îl face cineva anume. Dacă omul n-are dreptul, pasul nu se întâmplă — nici din aplicație, nici pe altă cale.",
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
          { actor: "angajat", text: "Cere concediu și vede pe loc câte zile consumă" },
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
          { actor: "angajat", text: "Confirmă bunurile luate în primire" },
        ],
      },
    ],
  },

  roluri: {
    supratitlu: "Cine ce vede",
    titlu: "Drepturile le reglezi tu. Și le poți citi aici.",
    lead: "Tabelul de mai jos arată ce vede fiecare rol, exact cum vine reglat în aplicație. Îl verificăm automat, celulă cu celulă: dacă regulile din aplicație se schimbă, verificarea ne oprește înainte ca pagina să spună altceva.",
    capResursa: "Datele",
    note: [
      "Angajatul își vede propria fișă de personal și numai pe ea. CNP-ul și IBAN-ul rămân închise și pentru el: le vede doar cine are acces la datele întregii firme.",
      "Managerul aprobă pontajul echipei și se pontează pe sine, dar nu completează ziua altcuiva. Foaia echipei o poate doar citi.",
      "Managerul nu are acces la salarizare: e o decizie, nu o scăpare. Administratorul firmei îi poate da acces din aplicație, fără să aștepte după noi.",
      "Resursele umane administrează complet SSM-ul, dar nu au acces la scadențele de conformitate: lista le apare goală, fără niciun avertisment. E o limită reală, pe care preferăm s-o știi de aici.",
    ],
    notaPlatforma:
      "Există și un rol de administrator de platformă, al nostru, folosit la înrolarea firmei și la suport. Nu e membru al organizației tale, iar tot ce face lasă urmă în același jurnal pe care îl vezi și tu.",
  },

  izolare: {
    supratitlu: "Bariera",
    titlu: "Cum e construită bariera, strat cu strat",
    lead: "Trei dintre straturile de mai jos sunt de confort: ajută omul să nu se lovească de uși închise. Doar al patrulea e barieră — și e singurul de care depinde răspunsul la întrebarea „ce se întâmplă dacă greșim noi ceva în aplicație?”.",
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
        text: "Verifică dreptul omului înainte să-i arate ceva. Dar pagina nu păzește și modificările: acelea pot veni pe altă cale și se verifică separat.",
        bariera: false,
      },
      {
        nume: "Modificarea",
        rol: "confort",
        text: "Fiecare salvare sau aprobare verifică din nou, pe loc, dacă modulul e pornit, dacă omul are dreptul și asupra cui.",
        bariera: false,
      },
      {
        nume: "Datele înseși",
        rol: "barieră",
        text: "Chiar dacă greșim ceva mai sus, nimeni nu primește date pe care n-are voie să le vadă. La fiecare clic se verifică din nou din ce firmă face parte omul, nu se ia de bun ce a rămas în browser. O firmă suspendată dispare din listă și accesul se stinge pe loc. Pentru omul de IT: politici RLS în Postgres, forțate și pentru proprietarul tabelei.",
        bariera: true,
      },
    ],
    vinieta: {
      titlu: "Pontaj — cum arată aceeași pagină pentru un manager",
      contor: "{ascunse} din {total} rânduri nu sunt afișate",
      nota: "Rândurile lipsă nu sunt doar ascunse de pe ecran: nici nu ajung la manager. Aceeași pagină, alt om, alte rânduri.",
      randuri: ["Popa I.", "Ilie M.", "Radu A.", "Marin D.", "Vlad C.", "Toma S."],
      ascunse: 4,
    },
    legaturaPagina: { eticheta: "Cum ținem datele separate", href: "/incredere" },
  },

  conformitate: {
    supratitlu: "Făcut pentru România",
    titlu: "Regulile românești sunt construite în produs, nu doar traduse",
    lead: "Un program străin, tradus în română, îți cere să te adaptezi tu. Lucrurile de mai jos sunt scrise pentru cum funcționează efectiv o firmă de aici.",
    carduri: [
      {
        titlu: "Sărbătorile legale, calculate",
        text: "Șaptesprezece zile: cele fixe din Codul muncii și cele mobile, derivate din data Paștelui ortodox. Foaia de pontaj de pe pagina de start folosește chiar acest calcul.",
        temei: "Codul muncii, art. 139",
      },
      {
        titlu: "CAEN Rev. 3, complet",
        text: "Șase sute cincizeci și una de clase, verificate față de nomenclatorul oficial. Regulile diferă după forma juridică: PFA are cel mult patru coduri secundare, întreprinderea individuală cel mult nouă, iar SRL-D are domenii interzise.",
        temei: "Legea 31/1990, OUG 44/2008",
      },
      {
        titlu: "CUI cu cifră de control",
        text: "Codul fiscal se verifică după calculul oficial al cifrei de control, nu doar după lungime. O greșeală de tastare se prinde la introducere, nu la prima declarație.",
        temei: "",
      },
      {
        titlu: "Diurna pe ferestre de 24 de ore",
        text: "Cele 24 de ore se numără de la ora plecării, nu de la miezul nopții, iar ziua în care se trece granița se plătește o singură dată, pentru o singură țară. Ce trece de plafonul neimpozabil nu e refuzat: se impozitează doar partea de peste.",
        temei: "Structura HG 518/1995, preluată în aplicație",
      },
      {
        titlu: "SSM și PSI, cu temei pe fiecare termen",
        text: "Periodicitatea instruirilor, a medicinei muncii, a verificării stingătoarelor și a autorizațiilor ISCIR — fiecare cu actul normativ notat lângă ea și cu data de la care se aplică.",
        temei: "Legea 319/2006, Legea 307/2006, HG 1425/2006",
      },
      {
        titlu: "Date personale criptate",
        text: "CNP-ul și IBAN-ul se păstrează criptate, iar de fiecare dată când cineva le deschide rămâne o urmă în jurnal. Cheia de criptare se poate schimba, ca o parolă, fără să criptăm din nou toate datele.",
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
        regula: "Fișa iese din liste, dar urma rămâne; nimic nu dispare pe tăcute",
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
        legatura: { eticheta: "Ce primește contabilul tău", href: "/pentru-contabili" },
      },
      {
        titlu: "Nu avem integrare cu ANAF, e-Factura sau SAF-T",
        text: "N-am construit nimic pentru asta. Datele sunt ținute astfel încât transmiterea să poată fi adăugată mai târziu, dar azi ea nu există.",
      },
      {
        titlu: "Datele cu CNP nu pleacă la REGES fără un om",
        text: "Aplicația trimite direct în REGES-ONLINE, cu accesul pe care firma ta îl obține din portalul Inspecției Muncii. Mesajele se pregătesc singure din fișa angajatului. Cele care poartă CNP-ul unui salariat stau în coadă până le trimite cineva cu drept de transmitere, iar fiecare citire a CNP-ului lasă urmă în jurnal; mesajele de contract, fără date personale, pot pleca și singure, la următoarea trimitere automată. Fișier REVISAL nu generăm: REGES-ONLINE l-a înlocuit.",
      },
      {
        titlu: "Asistentul AI îți arată drumul, nu-ți face treaba",
        text: "Răspunde la „unde se face X?” și te duce acolo. Nu depune cereri, nu aprobă, nu șterge — apeși tu. Nu dă sfaturi juridice sau fiscale. Poate greși într-o explicație, dar nu te poate trimite la un ecran la care n-ai acces. Întrebarea ta pleacă la un furnizor extern de inteligență artificială (OpenRouter) ca să primească răspuns; datele din fișe pleacă doar dacă întrebi ceva despre ele. Modulul se poate opri cu totul, pentru fiecare firmă în parte.",
      },
      {
        titlu: "PDF-ul arată documentul emis, nu e un al doilea document",
        text: "Documentul de referință e cel înregistrat în aplicație: el poartă numărul alocat pe serie, codul de verificare și dovada că textul n-a fost atins de la emitere. PDF-ul se generează din el, în aplicație. Un PDF făcut separat, din aceleași date, ar fi un al doilea original — două hârtii cu același număr, a căror potrivire n-o garantează nimeni.",
      },
      {
        titlu: "Cotele fiscale trebuie confirmate de contabilul tău",
        text: "Nicio cotă, niciun prag și niciun barem nu e bătut în cuie în program. Toate sunt configurate pe firma ta, cu data de la care se aplică, și toate sunt marcate „de verificat” până le confirmă cineva care răspunde de ele.",
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
        text: "Echipe pe șantiere și puncte de lucru, instruiri și echipament de protecție care expiră, control ITM care vine fără să sune. Salariul minim sectorial e o valoare pe care o setezi tu, nu ceva ce trebuie să ne ceri nouă.",
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
        noi: "Generate din șablon, numerotate pe serie, cu dovada că n-au fost modificate",
      },
      {
        azi: "Cine a modificat? Nimeni nu mai știe",
        noi: "Cine, când, de la ce adresă, ce s-a schimbat",
      },
      {
        azi: "Toată lumea vede tot fișierul",
        noi: "Fiecare vede doar partea lui, iar regula nu se poate ocoli",
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
        text: "Omul deschide o adresă în browser și apasă „Am intrat” și „Am ieșit”. Ora pontajului e cea oficială, nu cea de pe telefonul omului. La fiecare punct de lucru poți lipi un afiș cu cod QR, tipărit din aplicație, iar firma poate cere scanarea lui înainte de pontare.",
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
        text: "Din 2026, registrul salariaților se ține doar în REGES-ONLINE. Administrativo pregătește mesajele din fișa angajatului și le trimite direct în registru, cu termenul legal al fiecărui eveniment calculat în zile lucrătoare. Răspunsul Inspecției Muncii se întoarce în fișa omului.",
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
    lead: "Cinci roluri, fiecare cu drepturile lui. Managerul își vede echipa, angajatul doar ce e al lui. Nu depinde de o setare pe care cineva o poate uita.",
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
        titlu: "Calculator de zile lucrătoare",
        text: "Câte zile lucrătoare sunt între două date, sau ce dată e peste un număr de zile lucrătoare.",
        formate: "Online",
        href: "/unelte/calculator-zile-lucratoare",
      },
      {
        titlu: "Cerere de concediu de odihnă",
        text: "Cu zilele lucrătoare calculate și rubrica angajatorului, plus fără plată, paternal, îngrijitor, eveniment, formare și reprogramare.",
        formate: "PDF · Word",
        href: "/unelte/cerere-concediu-de-odihna",
      },
      {
        titlu: "Cerere de demisie",
        text: "Cu ultima zi de preaviz calculată în zile lucrătoare, plus variantele fără preaviz și prin acordul părților.",
        formate: "PDF · Word",
        href: "/unelte/cerere-demisie",
      },
      {
        titlu: "Calculator de zile de concediu",
        text: "Câte zile de concediu ți se cuvin pe an și cât din ele în anul angajării sau al plecării.",
        formate: "Online",
        href: "/unelte/calculator-zile-concediu",
      },
      {
        titlu: "Programarea concediilor de odihnă",
        text: "Un rând pe om, o coloană pe lună, cu zilele lucrătoare ale fiecărei luni și sărbătorile anului.",
        formate: "PDF · Word · Excel",
        href: "/unelte/programare-concedii",
      },
      {
        titlu: "Foaie de parcurs",
        text: "Cele 4 elemente cerute de normele fiscale, mai multe curse pe zi, alimentări.",
        formate: "PDF · Word · Excel",
        href: "/unelte/foaie-de-parcurs",
      },
      {
        titlu: "Fișa de instruire SSM",
        text: "Fișa individuală completă după anexa 11 la HG 1425/2006, cu datele lucrătorului completate.",
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
    lead: "Un nucleu care vine mereu și module pe care le adaugi separat. Prima lună e gratuită, nu se facturează pornirea, iar sumele de mai jos sunt cele finale — nu se mai adaugă TVA.",
    planuri: [
      {
        cheie: "nucleu",
        nume: "Nucleu HR",
        pentru: "Punctul de plecare: pontaj, concedii, dosare și portalul angajatului",
      },
      {
        cheie: "hr_extins",
        nume: "HR extins",
        pentru: "Peste nucleu: REGES-ONLINE, integrare angajați, cursuri, SSM, evaluări și KPI-uri",
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
      "Prima lună e gratuită, oricare ar fi modulele alese. Fără cost de pornire și fără implementare facturată separat.",
    nota: "Cele trei pachete din mijloc nu sunt trepte: fiecare acoperă altă parte a firmei, peste același nucleu, și pornești doar pachetul de care ai nevoie. Suma tăiată e cât ar costa aceleași module cumpărate unul câte unul.",
    legaturaPagina: { eticheta: "Vezi prețul fiecărui modul", href: "/preturi#module" },
  },

  siguranta: {
    supratitlu: "Datele oamenilor tăi",
    titlu: "CNP-uri, salarii, concedii medicale. Le tratăm ca atare.",
    lead: "Într-un program de HR stau cele mai sensibile date ale unei firme. Pe scurt, cum le ținem — iar varianta lungă, cu toate detaliile, e pe pagina despre siguranța datelor.",
    puncte: [
      {
        titlu: "Separate pe firmă, nu doar ascunse",
        text: "Nimeni din altă firmă nu-ți poate vedea datele, nici măcar dacă noi am greși ceva în aplicație.",
      },
      {
        titlu: "CNP și IBAN criptate",
        text: "Stau criptate, iar oricine le deschide lasă urmă: se știe cine le-a văzut și când.",
      },
      {
        titlu: "Fiecare modificare, cu nume și oră",
        text: "Cine a schimbat, când și ce anume. Jurnalul doar se completează și nu poate fi rescris — nici de noi.",
      },
      {
        titlu: "În Uniunea Europeană",
        text: "Datele și fișierele stau în Irlanda, iar aplicația e găzduită în Germania.",
      },
    ],
    legatura: { eticheta: "Cum ținem datele separate", href: "/incredere" },
  },

  incepe: {
    supratitlu: "Cum începi",
    titlu: "Primul pontaj, în aceeași zi",
    lead: "Nu se instalează nimic și nu e nevoie de o mutare complicată a datelor. Îți faci contul, urci lista de angajați dintr-un fișier Excel și pontezi luna în curs.",
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
        a: "Fișierul de calcul cu angajații se încarcă în Administrativo, nu se retastează. Coloanele se potrivesc singure după antet, oricum ar fi scris: „Data nașterii”, „DATA NASTERII” și „data-nasterii” sunt recunoscute ca aceeași coloană, fiindcă diacriticele și punctuația nu contează. Dacă lipsește o coloană obligatorie, importul îți spune care, pe nume, înainte să încarce ceva. Apoi fiecare rând e verificat separat: rândurile bune intră, cele greșite îți vin înapoi într-un fișier, cu motivul scris pe înțeles lângă fiecare. Nu rămâne nimic importat „pe jumătate” și nu se pierde nimic fără să afli — dacă zece rânduri din o sută au CNP greșit, intră nouăzeci și primești zece înapoi, nu un mesaj de eroare pe tot fișierul.",
        legatura: { eticheta: "Pontaj în Excel sau în aplicație", href: "/comparatie/excel" },
      },
      {
        q: "Datele noastre pot ajunge la altă firmă din platformă?",
        a: "Nu. Datele unei firme nu ajung la alta, și asta nu depinde de un filtru pe care cineva l-ar putea uita într-un ecran. Orice informație ceri trece prin aceeași regulă, pusă pe fiecare fel de dată din aplicație. O căutare care ar depăși granița firmei nu primește o eroare pe care cineva ar putea s-o treacă cu vederea, ci pur și simplu nimic. Aplicația verifică de fiecare dată, din datele reale, din ce firmă faci parte — nu se bazează pe ce îi spune browserul, deci nu poate fi păcălită de acolo. Orice versiune nouă a aplicației e verificată automat înainte să ajungă la voi: dacă o parte nouă n-ar fi protejată la fel, versiunea se oprește. Pentru omul de IT: politici la nivel de rând în Postgres, activate și forțate pe fiecare tabelă, inclusiv pentru proprietarul ei.",
        legatura: { eticheta: "Cum ținem datele firmelor separate", href: "/incredere" },
      },
      {
        q: "Contabila mea vede salariile tuturor. Managerul poate?",
        a: "Nu, managerul de echipă nu vede salariile oamenilor lui. Diferența față de alte aplicații e că dreptul ăsta nu doar îi lipsește: managerului i s-a interzis anume, pe tot ce ține de salarizare. Un drept care doar lipsește se poate da din greșeală, la o schimbare de setări făcută mai târziu; o interdicție pusă anume trebuie scoasă de cineva care știe ce face. Contabila, în schimb, vede tot ce ține de salarizare, fiindcă asta e treaba ei. Dacă vrei totuși ca un anumit manager să vadă salariile echipei lui, se schimbă o setare doar pentru firma ta, fără să aștepți o versiune nouă a aplicației. Tabelul complet cu cine ce vede, pe fiecare modul, e pe pagina de module.",
        legatura: { eticheta: "Programul de salarizare, cine ce vede", href: "/module/salarizare" },
      },
      {
        q: "Ce se întâmplă când pleacă un angajat?",
        a: "Când pleacă un angajat, fișa lui se închide, dar nimic nu se șterge de tot. Documentele, pontajul, concediile și instruirile rămân, fiindcă exact ele se cer la un control pentru perioada în care omul a lucrat la tine. În aplicație, contul lui nu mai intră, iar în REGES-ONLINE încetarea contractului are termenul ei, urmărită ca orice alt eveniment. În aplicație, nimeni nu poate șterge definitiv o înregistrare — nici administratorul firmei, nici al nostru: ea se marchează ca închisă și rămâne în istoric. Și nu e vorba de un buton ascuns: ștergerea pur și simplu nu e permisă pe datele firmelor, deci o comandă de ștergere venită din aplicație nu face să dispară nimic. Ștergerea definitivă o facem noi, doar după încetarea contractului cu firma ta, în termenele scrise în Termeni.",
        legatura: { eticheta: "Evidența angajaților, cu istoric", href: "/module/nucleu" },
      },
      {
        q: "Înlocuiește contabilul?",
        a: "Nu, și n-ar trebui să vrei asta. Calculăm și ținem evidența; declarațiile și răspunderea rămân la contabilul tău. Cotele le confirmă el, iar până atunci aplicația le arată clar ca neconfirmate.",
        legatura: { eticheta: "Ce primește contabilul", href: "/pentru-contabili" },
      },
      {
        q: "Merge pe telefon?",
        a: "Da, Administrativo merge pe telefon din browser, fără instalare din magazin. Portalul angajatului e făcut pentru ecran mic: soldul de concediu, cererile depuse, luna lui de pontaj, fluturașul și documentele primite. Adresa se adaugă pe ecranul principal — pe iPhone din Safari, pe Android din Chrome — și de atunci pornește pe tot ecranul, ca o aplicație, fără să ocupe spațiu ca una și fără actualizări de instalat. De acolo omul își poate și ponta ziua, dacă firma a pornit butoanele de pontare rapidă, iar la punctele de lucru se poate cere scanarea codului QR de pe afiș înainte. Ce nu merge: fără internet nu se înregistrează nimic, fiindcă portalul nu păstrează date pe telefon. În magazinele de aplicații nu suntem.",
        legatura: { eticheta: "Aplicația de pontaj pe telefon", href: "/pontaj-pe-telefon" },
      },
      {
        q: "Ce arăt la un control ITM?",
        a: "La un control ITM se cer documentele de personal, iar Administrativo le are pe toate într-un singur loc: fișele de instruire cu data și semnătura, evidența medicinei muncii, echipamentul de protecție dat în primire cu durata lui, foaia de prezență a lunii cerute și jurnalul care arată cine a modificat ce și când. Evidența SSM e un tabel cu oamenii pe rânduri și tipurile de instruire pe coloane, în care „niciodată făcută” apare separat de „expirată” — la un control înseamnă două lucruri diferite. Termenele se văd înainte să expire, nu în ziua în care expiră, deci instruirea se poate reprograma. Ce se cere exact și în ce ordine se verifică e scris pe pagina noastră despre controlul ITM, cu articolul de lege lângă fiecare afirmație.",
        legatura: { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },
      },
      {
        q: "Cine are acces la datele noastre din partea voastră?",
        a: "Un rol de administrator de platformă, al nostru, folosit la pornirea contului firmei și la suport. Nu e membru al firmei tale, iar tot ce face lasă urmă în același jurnal pe care îl vezi și tu. CNP-urile și conturile bancare sunt criptate, iar fiecare afișare a lor rămâne scrisă în jurnal.",
        legatura: {
          eticheta: "Cine are acces, în politica de confidențialitate",
          href: "/legal/confidentialitate#sectiunea-4",
        },
      },
      {
        q: "Putem schimba drepturile unui rol?",
        a: "Da. Drepturile unui rol se pot schimba doar pentru firma ta, fără o versiune nouă a aplicației. Setarea firmei tale bate regula obișnuită, chiar și când vrei să interzici ceva permis în mod normal.",
        legatura: { eticheta: "Rolurile și drepturile lor", href: "/module/nucleu" },
      },
      {
        q: "Cât durează până lucrăm efectiv?",
        a: "Depinde de câți oameni ai și de câte module pornim. Partea lungă nu e configurarea, ci curățarea datelor pe care le aduci. Îți spunem o estimare după ce ne uităm la fișierele tale, nu înainte.",
        legatura: { eticheta: "Prima lună gratuită și prețurile", href: "/preturi" },
      },
      {
        q: "Ce se întâmplă cu datele dacă renunțăm?",
        a: "Le iei. Exportăm ce ținem despre tine în format deschis. După încetarea contractului, datele rămân accesibile treizeci de zile, apoi se șterg definitiv în cel mult încă treizeci, inclusiv din copiile de siguranță. Nu ținem date ca argument de negociere.",
        legatura: { eticheta: "Exportul datelor, în termeni", href: "/legal/termeni#sectiunea-10" },
      },
      {
        q: "Cât costă?",
        a: "Nucleul — pontaj, concedii, dosare și portalul angajatului — costă 149 de lei pe lună, până la 20 de angajați, iar prima lună e gratuită. Modulele în plus au fiecare prețul lui, afișat pe pagina de prețuri, și sunt sume finale: nu se mai adaugă TVA. Peste 20 de angajați prețul crește în trepte — cere o ofertă și îți spunem cifra pentru câți oameni ai.",
        legatura: { eticheta: "Prețul fiecărui modul", href: "/preturi#module" },
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
        legatura: { eticheta: "Prețul fiecărui modul", href: "/preturi#module" },
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
      "Administrativo — pontaj, concedii, salarizare, SSM, parc auto și inventar pentru firme din România. Fiecare firmă are datele ei, separate de ale altora, rolurile ei și doar modulele de care are nevoie.",
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
      "Scriem ș și ț cu virgulă dedesubt, nu cu sedilă. E felul corect, și îl verificăm automat la fiecare actualizare a sitului.",
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
      lead: "Patru module vin în nucleu, iar celelalte cincisprezece le pornești sau le oprești separat. Plătești ce ai pornit, iar ce nu folosești nu apare nici în meniu, nici pe factură.",
    },
    incredere: {
      supratitlu: "Unde stă bariera",
      titlu: "Datele unei firme nu ajung la alta. Nici din greșeală.",
      lead: "Nu e vorba de butoane ascunse și nici de o setare care se poate uita. Mai jos: ce ține datele separate, ce se întâmplă când cineva încearcă să scrie unde n-are voie și cât păstrăm fiecare fel de dată.",
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
      lead: "Contabilul nu e un utilizator în plus al unei firme, ci aceeași persoană în zece firme deodată. De aceea nu ai câte un cont pentru fiecare firmă: intri o dată și treci de la un client la altul dintr-un meniu.",
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
