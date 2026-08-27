// src/domain/payroll/erori.ts
//
// Catalogul problemelor de CALCUL ale salarizării. Modul PUR — fără import din
// `next`, `lib/supabase` sau ceasul de sistem — ca să fie folosibil deopotrivă
// în motorul de calcul, în Server Actions, în ecranul de perioadă și în
// componenta de fluturaș montată în portal.
//
// Distincția față de `src/app/(app)/salarizare/erori.ts`: acela traduce coduri
// POSTGRES (o scriere respinsă de bază). Acesta descrie situații pe care baza
// le acceptă fără să clipească, dar care fac cifra greșită sau incompletă —
// clasa de defecte care a scăpat repetat în acest proiect fiindcă nu produce
// nicio eroare.
//
// Textul fix (mesaj, cauză, reparare) trăiește în catalog, o singură dată.
// CIFRELE vin per instanță, în `detalii` — ele se pot afla doar din date.
//
// Catalogul crește pe faze: aici sunt codurile care au deja un emitent real.
// Un cod fără emitent e cod mort și nu se poate testa, deci nu se declară în
// avans; se adaugă în faza care îl ridică.

export type SeveritateProblema = "blocant" | "avertisment" | "informativ";

export const CODURI_PROBLEMA = [
  "SAL_TRUNCHIERE_CITIRE",
  "SAL_CONTRACT_LIPSA",
  "SAL_NORMA_INVALIDA",
  "SAL_ZILE_PESTE_LUNA",
  "SAL_CONTRACT_SCHIMBAT_IN_LUNA",
  "SAL_SPOR_SARBATOARE_NECONFIGURAT",
  "SAL_SPOR_NOAPTE_SUB_PRAG",
  "SAL_SPOR_REPAUS_NECONFIGURAT",
  "SAL_ORE_IN_MOD_NEDECLARAT",
  "SAL_TICHETE_REGIM_NECONFIRMAT",
  "SAL_CAS_LA_MINIM",
  "SAL_AVANTAJ_NATURA_PESTE_NET",
  "SAL_CM_NECALCULAT",
  "SAL_CO_BAZA_SIMPLIFICATA",
  "SAL_SCUTIRE_FARA_PROCENT",
  "SAL_SCUTIRI_MULTIPLE",
  "SAL_RETINERE_PLAFONATA",
  "SAL_CO_MEDIE_INCOMPLETA",
  "SAL_CO_FARA_ISTORIC",
  "SAL_CO_MEDIA_MAI_MICA",
  "SAL_CM_ISTORIC_INCOMPLET",
  "SAL_CM_BAZA_PLAFONATA",
  "SAL_CM_ZILE_ANGAJATOR_EPUIZATE",
  "SAL_ORE_SUPL_NECOMPENSATE",
  "SAL_ORE_SUPL_EXPIRATE",
  "SAL_ZI_LIBERA_SARBATOARE_NEACORDATA",
  "SAL_SPOR_SARBATOARE_FARA_PROCENT",
  "SAL_CM_FARA_ISTORIC",
  "SAL_DIURNA_PESTE_PLAFON_ZILNIC",
  "SAL_DIURNA_PESTE_PLAFON_LUNAR",
  "SAL_DIURNA_FARA_SALARIU_BAZA",
  "SAL_POPRIRI_CONCURENTE_PLAFON",
  "SAL_POPRIRE_STINSA",
  "SAL_RETINERI_PESTE_NET",
  "SAL_SEPA_IBAN_INVALID",
  "SAL_SEPA_SUMA_INVALIDA",
  "SAL_SEPA_TEXT_TRUNCHIAT",
  "SAL_SEPA_MONEDA_INVALIDA",
  "SAL_SEPA_FARA_PLATI",
  "SAL_NOTA_DEZECHILIBRATA",
  "SAL_NOTA_VALOARE_NEGATIVA",
  "SAL_NOTA_CONT_LIPSA",
  "SAL_ETAPA_COD_NECUNOSCUT",
] as const;

export type CodProblema = (typeof CODURI_PROBLEMA)[number];

export interface ProblemaSalarizare {
  readonly cod: CodProblema;
  readonly severitate: SeveritateProblema;
  /** Ce s-a întâmplat. Propoziție completă, în română, terminată cu punct. */
  readonly mesaj: string;
  /** Cifrele cazului: sume, zile, luni, nume. `null` când problema nu are cifre. */
  readonly detalii: string | null;
  /** De ce s-a întâmplat — cauza, nu simptomul. */
  readonly cauza: string;
  /** Pasul concret de reparare. */
  readonly cumSeRepara: string;
  /** Ruta ecranului care repară, sau `null` dacă reparația e în afara aplicației. */
  readonly unde: string | null;
  /** Angajatul vizat, când problema e nominală. */
  readonly employeeId: string | null;
}

type IntrareCatalog = Omit<ProblemaSalarizare, "cod" | "detalii" | "employeeId">;

const CATALOG: Readonly<Record<CodProblema, IntrareCatalog>> = {
  SAL_TRUNCHIERE_CITIRE: {
    severitate: "blocant",
    mesaj: "Datele citite din baza de date au fost trunchiate, deci calculul ar fi incomplet.",
    cauza:
      "Interfața de date întoarce cel mult 1000 de rânduri pe cerere și taie restul fără să semnaleze nimic. O citire care se oprește exact la limită înseamnă că sigur au mai fost rânduri.",
    cumSeRepara:
      "Nu aprobați perioada. Semnalați problema — citirea trebuie paginată; până atunci, cifrele calculate nu sunt de încredere.",
    unde: null,
  },
  SAL_CONTRACT_LIPSA: {
    severitate: "blocant",
    mesaj: "Angajatul este activ, dar nu are niciun contract de muncă activ în luna calculată.",
    cauza:
      "Salariul de bază se citește din contract. Fără contract activ nu există nicio sumă de la care să pornească calculul.",
    cumSeRepara:
      "Adăugați contractul de muncă pe fișa angajatului, sau schimbați-i starea dacă nu mai lucrează în firmă.",
    unde: "/angajati",
  },
  SAL_NORMA_INVALIDA: {
    severitate: "blocant",
    mesaj: "Norma de lucru a angajatului nu este validă pentru calcul.",
    cauza:
      "Tariful orar se obține împărțind salariul la zile lucrătoare × ore pe zi. O normă zero sau negativă face împărțirea imposibilă.",
    cumSeRepara: "Corectați norma zilnică din contractul de muncă al angajatului.",
    unde: "/angajati",
  },
  SAL_ZILE_PESTE_LUNA: {
    severitate: "blocant",
    mesaj:
      "Zilele plătite depășesc zilele lucrătoare ale lunii, deci pontajul și concediile se suprapun.",
    cauza:
      "Aceeași zi apare și ca zi lucrată, și ca zi de concediu — de regulă după o cerere de concediu aprobată peste un pontaj deja completat manual.",
    cumSeRepara:
      "Deschideți pontajul lunii, rulați sincronizarea cu concediile și verificați zilele în conflict.",
    unde: "/pontaj",
  },
  SAL_CONTRACT_SCHIMBAT_IN_LUNA: {
    severitate: "avertisment",
    mesaj:
      "Termenii contractului s-au schimbat pe parcursul lunii, iar luna nu a fost împărțită pe intervale.",
    cauza:
      "Un act adițional a intrat în vigoare la mijlocul lunii. Calculul folosește termenii valabili în ultima zi, deci îi aplică întregii luni.",
    cumSeRepara:
      "Verificați cu contabilul dacă diferența trebuie corectată manual pentru zilele dinaintea actului adițional.",
    unde: "/angajati",
  },
  SAL_SPOR_SARBATOARE_NECONFIGURAT: {
    severitate: "avertisment",
    mesaj:
      "S-a lucrat în zile de sărbătoare legală, dar nu există un procent de spor configurat separat pentru ele.",
    cauza:
      "Perioada a fost calculată cu setări anterioare migrării 0066, care nu aveau un procent distinct pentru sărbătoarea legală. Motorul a căzut pe sporul de repaus.",
    cumSeRepara:
      "Orele au fost plătite cu sporul de repaus, ca să nu rămână neplătite. Verificați cu contabilul dacă procentul aplicat e cel corect pentru sărbători.",
    unde: "/salarizare/setari",
  },
  SAL_SPOR_NOAPTE_SUB_PRAG: {
    severitate: "informativ",
    mesaj:
      "S-au lucrat ore de noapte, dar sub pragul de la care se acordă sporul — sporul de noapte nu a fost plătit.",
    cauza:
      "Codul Muncii art. 126 leagă sporul de noapte de un minim de ore lucrate în intervalul de noapte (implicit 3). Totalul lunii a rămas sub pragul configurat în setările de pontaj.",
    cumSeRepara:
      "Dacă orele de noapte au fost pontate greșit, corectați-le în foaia colectivă. Dacă firma acordă sporul fără prag, puneți pragul pe 0 în setările de pontaj.",
    unde: "/pontaj/setari",
  },
  SAL_ORE_IN_MOD_NEDECLARAT: {
    severitate: "avertisment",
    mesaj:
      "S-au înregistrat ore într-un fel de muncă pe care firma l-a declarat inexistent în setările de pontaj.",
    cauza:
      "Setările de pontaj declară ce feluri de muncă are firma (tură de noapte, repaus săptămânal, sărbători, ore suplimentare). Luna asta conține ore într-unul dintre felurile debifate. Ori pontajul e greșit, ori declarația a rămas în urmă față de realitate.",
    cumSeRepara:
      "Verificați orele în foaia colectivă. Dacă sunt corecte, bifați felul de muncă respectiv în setările de pontaj și configurați-i sporul — dreptul la spor nu se stinge fiindcă o căsuță e debifată.",
    unde: "/pontaj/setari",
  },
  SAL_SPOR_REPAUS_NECONFIGURAT: {
    severitate: "avertisment",
    mesaj:
      "S-a lucrat în zile de repaus sau de sărbătoare, dar sporul configurat pentru ele este zero.",
    cauza:
      "Procentul de spor din setările de salarizare a rămas pe valoarea implicită. Orele au fost plătite la tariful orar simplu, fără niciun spor.",
    cumSeRepara:
      "Configurați procentul de spor pentru zilele de repaus în setările de salarizare, apoi recalculați perioada.",
    unde: "/salarizare/setari",
  },
  SAL_TICHETE_REGIM_NECONFIRMAT: {
    severitate: "informativ",
    mesaj: "Regimul fiscal al tichetelor de masă nu a fost confirmat de contabil.",
    cauza:
      "Tichetele nu intră în baza de pensie, dar pot intra în cea de sănătate — regula s-a schimbat de mai multe ori în ultimii ani. Motorul aplică setarea curentă, oricare ar fi ea.",
    cumSeRepara:
      "Confirmați cu contabilul dacă tichetele se supun CASS, potriviți comutatorul din setările de salarizare și bifați setările ca verificate.",
    unde: "/salarizare/setari",
  },
  SAL_CAS_LA_MINIM: {
    severitate: "informativ",
    mesaj: "Baza de contribuții a fost ridicată la salariul minim.",
    cauza:
      "Venitul brut al lunii e sub salariul minim, iar contribuțiile se calculează cel puțin la acesta.",
    cumSeRepara:
      "Verificați dacă angajatul se încadrează într-o excepție legală (elev sau student sub 26 de ani, pensionar, persoană cu handicap, cumul de contracte). Excepțiile nu sunt încă înregistrate în aplicație, deci motorul nu le poate aplica singur.",
    unde: "/angajati",
  },
  SAL_AVANTAJ_NATURA_PESTE_NET: {
    severitate: "avertisment",
    mesaj: "Avantajele primite în natură depășesc netul rămas de virat.",
    cauza:
      "Valoarea avantajelor intră în brut și se impozitează, apoi se scade din suma virată. Când depășește netul, nu mai rămâne nimic de plătit și diferența nu poate fi reținută dintr-o sumă inexistentă.",
    cumSeRepara:
      "Verificați evaluarea avantajelor pe fișa angajatului. Diferența trebuie recuperată separat, nu prin restul de plată.",
    unde: "/angajati",
  },
  SAL_CO_MEDIE_INCOMPLETA: {
    severitate: "avertisment",
    mesaj:
      "Media pentru indemnizația de concediu de odihnă s-a calculat pe mai puține luni decât cere legea.",
    cauza:
      "Istoricul de venit nu acoperă toată perioada de referință — de regulă la un angajat nou sau la o organizație intrată recent în aplicație.",
    cumSeRepara:
      "Introduceți veniturile lunilor lipsă în Salarizare → Istoric venituri, apoi recalculați perioada.",
    unde: "/salarizare/istoric-venituri",
  },
  SAL_CO_FARA_ISTORIC: {
    severitate: "avertisment",
    mesaj:
      "Nu există nicio lună cu zile lucrate în istoric, deci indemnizația de concediu s-a plătit la salariul de bază.",
    cauza:
      "Media pe ultimele luni are nevoie de cel puțin o lună cu zile lucrate. Fără ea rămâne aplicabil doar salariul curent.",
    cumSeRepara:
      "Pentru un angajat nou e normal. Altfel, introduceți istoricul de venit și recalculați.",
    unde: "/salarizare/istoric-venituri",
  },
  SAL_CO_MEDIA_MAI_MICA: {
    severitate: "informativ",
    mesaj:
      "Media perioadei de referință e sub salariul de bază, deci s-a aplicat salariul de bază.",
    cauza:
      "Legea cere varianta mai avantajoasă pentru angajat, iar aici aceea e rata zilnică a salariului curent.",
    cumSeRepara: "Nu e nimic de reparat — calculul a ales corect.",
    unde: null,
  },
  SAL_CM_ISTORIC_INCOMPLET: {
    severitate: "avertisment",
    mesaj:
      "Baza de calcul a concediului medical s-a format pe mai puține luni decât cere codul de indemnizație.",
    cauza:
      "Codul cere media pe un număr de luni; istoricul de venit nu le acoperă pe toate. Indemnizația poate ieși mai mică decât cea legală.",
    cumSeRepara:
      "Introduceți veniturile lunilor lipsă în Salarizare → Istoric venituri, sau confirmați cu contabilul că baza parțială e acceptabilă.",
    unde: "/salarizare/istoric-venituri",
  },
  SAL_CM_BAZA_PLAFONATA: {
    severitate: "informativ",
    mesaj: "Baza zilnică a concediului medical a fost redusă la plafonul legal.",
    cauza:
      "Codul de indemnizație are un plafon exprimat în salarii minime, iar media veniturilor l-a depășit.",
    cumSeRepara:
      "Nu e nimic de reparat, dar verificați că salariul minim configurat e cel în vigoare.",
    unde: "/salarizare/setari",
  },
  SAL_CM_ZILE_ANGAJATOR_EPUIZATE: {
    severitate: "informativ",
    mesaj:
      "Zilele de concediu medical suportate de firmă erau deja consumate în acest episod de boală.",
    cauza:
      "Primele zile calendaristice ale unui concediu medical le suportă angajatorul, iar un certificat de continuare nu le resetează. Restul se recuperează de la fondul de sănătate.",
    cumSeRepara:
      "Verificați că certificatele au fost înregistrate în ordine și că un episod nou nu a fost marcat din greșeală drept continuare.",
    unde: "/concedii",
  },
  SAL_ORE_SUPL_NECOMPENSATE: {
    severitate: "avertisment",
    mesaj: "Termenul de compensare a unor ore suplimentare se apropie de expirare.",
    cauza:
      "Orele suplimentare se compensează cu timp liber într-un termen legal. După expirare trebuie plătite cu spor, oricât ar costa.",
    cumSeRepara:
      "Programați zilele libere înainte de termen, sau acceptați plata cu spor. Avertismentul apare ÎNAINTE de expirare tocmai ca să existe alegerea.",
    unde: "/pontaj",
  },
  SAL_ORE_SUPL_EXPIRATE: {
    severitate: "informativ",
    mesaj: "Ore suplimentare cu termenul de compensare depășit se plătesc obligatoriu cu spor.",
    cauza: "Termenul legal de compensare cu timp liber a trecut fără ca zilele să fie acordate.",
    cumSeRepara: "Nu se mai poate compensa. Suma apare pe fluturaș ca ore suplimentare plătite.",
    unde: null,
  },
  SAL_ZI_LIBERA_SARBATOARE_NEACORDATA: {
    severitate: "avertisment",
    mesaj: "O zi liberă cuvenită pentru muncă în sărbătoare legală nu a fost acordată în termen.",
    cauza:
      "Munca într-o sărbătoare legală se compensează cu zi liberă în termen, altfel cu spor. Termenul a trecut.",
    cumSeRepara:
      "Sporul se plătește acum. Verificați dacă zilele libere sunt urmărite în modulul de pontaj.",
    unde: "/pontaj",
  },
  SAL_SPOR_SARBATOARE_FARA_PROCENT: {
    severitate: "avertisment",
    mesaj: "S-a ales plata cu spor pentru o sărbătoare legală, dar procentul nu e configurat.",
    cauza:
      "Compensarea prin spor are nevoie de un procent; fără el orele s-ar plăti la tarif simplu.",
    cumSeRepara: "Completați procentul de spor de sărbătoare în setările de pontaj.",
    unde: "/pontaj",
  },
  SAL_CM_FARA_ISTORIC: {
    severitate: "blocant",
    mesaj: "Nu există nicio lună cu venit din care să se formeze baza concediului medical.",
    cauza:
      "Indemnizația se calculează pe media veniturilor din lunile anterioare. Fără nicio lună cu zile lucrate, baza e zero și indemnizația ar ieși zero.",
    cumSeRepara:
      "Introduceți veniturile anterioare în Salarizare → Istoric venituri. Pentru un angajat nou fără nicio lună lucrată, indemnizația se stabilește separat, cu contabilul.",
    unde: "/salarizare/istoric-venituri",
  },
  SAL_DIURNA_PESTE_PLAFON_ZILNIC: {
    severitate: "avertisment",
    mesaj: "Diurna acordată depășește plafonul zilnic neimpozabil.",
    cauza:
      "Plafonul zilnic e un multiplu al baremului legal pentru țara deplasării. Ce trece peste el devine venit asimilat salariului.",
    cumSeRepara:
      "Partea peste plafon a fost impozitată automat. Verificați baremul configurat pentru țara respectivă dacă suma pare greșită.",
    unde: "/diurna",
  },
  SAL_DIURNA_PESTE_PLAFON_LUNAR: {
    severitate: "avertisment",
    mesaj: "Totalul diurnelor lunii depășește plafonul raportat la salariul de bază.",
    cauza:
      "Plafonul lunar se verifică pe CUMULUL lunii, nu pe fiecare deplasare. Două deplasări care separat se încadrează pot împreună să depășească.",
    cumSeRepara:
      "Diferența a fost impozitată automat. Nu e nimic de corectat dacă deplasările sunt reale.",
    unde: "/diurna",
  },
  SAL_DIURNA_FARA_SALARIU_BAZA: {
    severitate: "blocant",
    mesaj: "Salariul de bază e zero, deci plafonul lunar al diurnei e și el zero.",
    cauza:
      "Plafonul lunar e o fracțiune din salariul de bază brut. Fără salariu, întreaga diurnă ar deveni impozabilă.",
    cumSeRepara:
      "Verificați contractul angajatului — un salariu de bază zero e aproape sigur o eroare de date.",
    unde: "/angajati",
  },
  SAL_POPRIRI_CONCURENTE_PLAFON: {
    severitate: "informativ",
    mesaj:
      "S-a aplicat plafonul pentru popriri concurente, mai permisiv decât cel pentru una singură.",
    cauza:
      "Angajatul are mai multe popriri active. Legea permite atunci un cumul mai mare, dar tot plafonat.",
    cumSeRepara: "Nu e nimic de reparat. Creanțele de întreținere s-au satisfăcut primele.",
    unde: "/salarizare/popriri",
  },
  SAL_POPRIRE_STINSA: {
    severitate: "informativ",
    mesaj: "O poprire și-a atins soldul zero și nu se mai reține nimic pentru ea.",
    cauza: "Datoria a fost recuperată integral, iar reținerea se oprește automat.",
    cumSeRepara:
      "Închideți dosarul, ca să nu mai apară în listă. Netul angajatului crește începând cu luna aceasta — e explicația pe care o va cere.",
    unde: "/salarizare/popriri",
  },
  SAL_RETINERI_PESTE_NET: {
    severitate: "avertisment",
    mesaj: "Reținerile cerute depășesc netul disponibil.",
    cauza:
      "Nu se poate reține dintr-o sumă care nu există. Ce nu a încăput rămâne de recuperat în lunile următoare.",
    cumSeRepara:
      "Verificați dacă diferența e urmărită. Un avans prea mare acordat la mijlocul lunii e cauza obișnuită.",
    unde: "/salarizare",
  },
  SAL_SEPA_IBAN_INVALID: {
    severitate: "blocant",
    mesaj: "Un IBAN nu trece verificarea și plata a fost exclusă din fișierul bancar.",
    cauza:
      "Cifra de control a IBAN-ului nu corespunde. Banca ar respinge fișierul întreg, nu doar linia greșită.",
    cumSeRepara: "Corectați IBAN-ul pe fișa angajatului și regenerați fișierul.",
    unde: "/angajati",
  },
  SAL_SEPA_SUMA_INVALIDA: {
    severitate: "blocant",
    mesaj: "O plată cu sumă zero sau negativă a fost exclusă din fișierul bancar.",
    cauza: "Un ordin de plată fără sumă pozitivă nu are ce transfera.",
    cumSeRepara:
      "Verificați rândul de salariu al angajatului: un rest de plată zero înseamnă că reținerile au acoperit tot netul.",
    unde: "/salarizare",
  },
  SAL_SEPA_TEXT_TRUNCHIAT: {
    severitate: "informativ",
    mesaj: "Un nume sau o explicație a fost scurtată la limita permisă de standardul bancar.",
    cauza: "Formatul ISO 20022 limitează numele la 70 de caractere și explicația la 140.",
    cumSeRepara:
      "Nu afectează plata. Verificați dacă textul scurtat rămâne recognoscibil pe extras.",
    unde: null,
  },
  SAL_SEPA_MONEDA_INVALIDA: {
    severitate: "blocant",
    mesaj: "Moneda fișierului bancar nu are un cod valid de trei litere.",
    cauza: "Standardul cere un cod ISO 4217, de forma RON sau EUR.",
    cumSeRepara: "Corectați moneda în setările de plată ale organizației.",
    unde: "/setari",
  },
  SAL_SEPA_FARA_PLATI: {
    severitate: "blocant",
    mesaj: "Nu a rămas nicio plată validă, deci fișierul bancar ar fi gol.",
    cauza:
      "Toate plățile au fost excluse — IBAN-uri invalide, sume nepozitive, sau nu există rânduri de salariu aprobate.",
    cumSeRepara: "Rezolvați problemele semnalate mai sus, apoi regenerați fișierul.",
    unde: "/salarizare",
  },
  SAL_NOTA_DEZECHILIBRATA: {
    severitate: "blocant",
    mesaj: "Nota contabilă nu închide: debitul nu egalează creditul.",
    cauza:
      "O notă dezechilibrată nu poate fi înregistrată în contabilitate. Diferența arată că o sumă lipsește sau e numărată de două ori.",
    cumSeRepara:
      "Nu trimiteți nota. Semnalați problema — diferența din detalii arată de unde pornește căutarea.",
    unde: "/salarizare",
  },
  SAL_NOTA_VALOARE_NEGATIVA: {
    severitate: "blocant",
    mesaj: "Un total de intrare în nota contabilă e negativ.",
    cauza:
      "Sumele dintr-o notă de salarii sunt prin natura lor nenegative; una negativă e o eroare de calcul.",
    cumSeRepara: "Recalculați perioada și verificați rândul de salariu care produce valoarea.",
    unde: "/salarizare",
  },
  SAL_NOTA_CONT_LIPSA: {
    severitate: "blocant",
    mesaj: "Un cont contabil nu e configurat.",
    cauza: "Maparea conturilor diferă de la firmă la firmă, deci niciun cod nu e presupus.",
    cumSeRepara: "Completați planul de conturi al organizației în setările de salarizare.",
    unde: "/salarizare/setari",
  },
  SAL_ETAPA_COD_NECUNOSCUT: {
    severitate: "avertisment",
    mesaj: "O etapă de calcul a raportat o problemă pe care aplicația nu o recunoaște.",
    cauza:
      "Codul întors de etapă nu e înregistrat în catalog. E o scăpare de dezvoltare, nu o situație a angajatului.",
    cumSeRepara:
      "Semnalați problema. Până atunci, detaliile de mai sus descriu situația reală și pot fi folosite ca atare.",
    unde: null,
  },
  SAL_CM_NECALCULAT: {
    severitate: "avertisment",
    mesaj: "Zilele de concediu medical nu sunt incluse în acest calcul.",
    cauza:
      "Indemnizația de concediu medical are bază de calcul proprie (media pe mai multe luni) și un plătitor care se împarte între firmă și fondul de sănătate. Motorul nu o calculează încă.",
    cumSeRepara:
      "Zilele medicale au fost scoase din zilele plătite. Indemnizația se calculează separat, prin contabil, până când modulul o acoperă.",
    unde: "/concedii",
  },
  SAL_CO_BAZA_SIMPLIFICATA: {
    severitate: "avertisment",
    mesaj:
      "Indemnizația de concediu de odihnă a fost plătită la rata zilnică a salariului de bază.",
    cauza:
      "Legea cere media zilnică a drepturilor salariale din ultimele trei luni, comparată cu salariul curent, în varianta mai avantajoasă pentru angajat. Motorul aplică deocamdată doar salariul curent.",
    cumSeRepara:
      "Dacă angajatul a avut sporuri permanente în ultimele trei luni, verificați manual cu contabilul dacă suma i se cuvine mai mare.",
    unde: null,
  },
  SAL_SCUTIRE_FARA_PROCENT: {
    severitate: "avertisment",
    mesaj: "Angajatul are o scutire fiscală activă fără procent configurat.",
    cauza:
      "Procentul scutirii este opțional pe fișa angajatului. Lipsa lui nu se interpretează ca scutire totală — ar fi o presupunere costisitoare.",
    cumSeRepara: "Completați procentul scutirii pe fișa angajatului, apoi recalculați perioada.",
    unde: "/angajati",
  },
  SAL_SCUTIRI_MULTIPLE: {
    severitate: "avertisment",
    mesaj: "Angajatul are mai multe scutiri fiscale active în aceeași lună.",
    cauza:
      "Scutirile au fost însumate. Nu toate facilitățile fiscale se pot cumula legal, iar regula diferă de la una la alta.",
    cumSeRepara:
      "Verificați cu contabilul dacă scutirile se pot cumula; dacă nu, închideți-o pe cea care nu se aplică.",
    unde: "/angajati",
  },
  SAL_RETINERE_PLAFONATA: {
    severitate: "avertisment",
    mesaj: "O reținere a fost plafonată și nu s-a aplicat integral.",
    cauza:
      "Reținerile nu pot depăși partea din salariul net permisă de lege, iar ce rămâne din net trebuie să acopere reținerea.",
    cumSeRepara:
      "Diferența rămâne de reținut în lunile următoare. Verificați dacă suma reportată e urmărită corect.",
    unde: "/salarizare",
  },
};

const ORDINE: Readonly<Record<SeveritateProblema, number>> = {
  blocant: 0,
  avertisment: 1,
  informativ: 2,
};

/**
 * Construiește o problemă din catalog, adăugându-i cifrele cazului.
 *
 * `detalii` e singura parte care nu poate fi scrisă în avans: „3 din 6 luni",
 * „1.240,00 lei plafonați la 980,00 lei", numele angajatului.
 */
export function problema(
  cod: CodProblema,
  optiuni: Readonly<{ detalii?: string | null; employeeId?: string | null }> = {},
): ProblemaSalarizare {
  const intrare = CATALOG[cod];
  return {
    cod,
    severitate: intrare.severitate,
    mesaj: intrare.mesaj,
    detalii: optiuni.detalii ?? null,
    cauza: intrare.cauza,
    cumSeRepara: intrare.cumSeRepara,
    unde: intrare.unde,
    employeeId: optiuni.employeeId ?? null,
  };
}

export function esteBlocanta(p: ProblemaSalarizare): boolean {
  return p.severitate === "blocant";
}

export function areBlocante(probleme: readonly ProblemaSalarizare[]): boolean {
  return probleme.some(esteBlocanta);
}

/** Blocantele primele, apoi avertismentele, apoi informativele. Stabilă în rest. */
export function sorteazaProbleme(
  probleme: readonly ProblemaSalarizare[],
): readonly ProblemaSalarizare[] {
  return [...probleme].sort((a, b) => ORDINE[a.severitate] - ORDINE[b.severitate]);
}

/**
 * Textul complet, așa cum îl citește utilizatorul: ce s-a întâmplat, cu ce
 * cifre, din ce cauză și ce are de făcut. Un singur loc care decide ordinea,
 * ca toate ecranele să spună la fel.
 */
export function descriereCompleta(p: ProblemaSalarizare): string {
  const parti = [p.mesaj, p.detalii, p.cauza, p.cumSeRepara];
  return parti.filter((parte): parte is string => parte !== null && parte.length > 0).join(" ");
}

/**
 * Traduce un cod venit dintr-o etapă de calcul în problema completă din catalog.
 *
 * Etapele sunt module pure care nu cunosc catalogul — întorc un cod ca ȘIR și
 * cifrele cazului. Aici se adaugă severitatea, cauza și modul de reparare.
 *
 * Un cod necunoscut NU se aruncă și nu se înghite: devine o problemă generică,
 * marcată ca atare. O etapă care emite un cod neînregistrat e un defect de
 * dezvoltare, iar mesajul îl face vizibil în loc să-l ascundă.
 */
export function problemaDinEtapa(
  cod: string,
  detalii: string,
  employeeId: string | null = null,
): ProblemaSalarizare {
  if (esteCodProblema(cod)) return problema(cod, { detalii, employeeId });
  return problema("SAL_ETAPA_COD_NECUNOSCUT", {
    detalii: `Cod „${cod}": ${detalii}`,
    employeeId,
  });
}

function esteCodProblema(valoare: string): valoare is CodProblema {
  return (CODURI_PROBLEMA as readonly string[]).includes(valoare);
}
