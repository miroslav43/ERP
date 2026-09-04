import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/control-itm`.
 *
 * ── DE CE E SCRISĂ CA LISTĂ DE DOCUMENTE ──────────────────────────────────
 * Cine caută asta caută de obicei într-o dimineață în care are un inspector la
 * ușă, sau în seara dinainte. Nu vrea contextul legislativ, vrea să știe ce se
 * pune pe masă. Ordinea urmează lista oficială de control de fond, nu logica
 * unui articol de blog.
 *
 * ── AVERTISMENTUL CARE FACE PAGINA ONESTĂ ─────────────────────────────────
 * Lista de documente e publicată de inspectoratele teritoriale, dar paginile lor
 * sunt neactualizate — trimit încă la Revisal și la HG 905/2017, abrogate. Am
 * păstrat structura listei și am înlocuit trimiterile depășite, iar secțiunea
 * finală spune limpede că partea de „ce urmăresc concret" e o coroborare, nu un
 * document oficial. E o distincție pe care nicio pagină concurentă n-o face, și
 * e exact ce desparte un ghid util de unul care sună sigur pe el.
 */

export const CONTROL_ITM: PaginaLege = {
  antet: {
    supratitlu: "Ghid",
    titlu: "Control ITM: ce se cere și ce se verifică de fapt",
    lead: "Lista documentelor cerute la un control de fond în relații de muncă, și cele patru locuri în care se descoperă majoritatea problemelor — toate în zona timpului de muncă.",
  },

  raspunsScurt: [
    "La un control de fond, inspectorul cere dosarele de personal, contractele cu actele adiționale, evidența orelor prestate zilnic de fiecare salariat, foile colective de prezență, statele de plată, registrul unic de control și regulamentul intern.",
    "Nu se citesc separat. Se compară între ele, iar problemele apar din neconcordanțe: ore care nu se regăsesc în state, salarii nete peste cele declarate, oameni la lucru în perioadă de suspendare.",
    "Refuzul nejustificat de a prezenta documentele, în cel mult 15 zile de la a doua solicitare, și împiedicarea accesului inspectorilor nu sunt contravenții, sunt infracțiuni — art. 264 alin. (2) și (3) din Codul muncii.",
  ],

  titluReguli: "Ce se pune pe masă",

  reguli: [
    {
      situatie: "Registrul unic de control",
      cerinta:
        "Se prezintă la începutul controlului. În el se consemnează controlul, iar absența lui e ea însăși o problemă, separată de orice s-ar găsi mai departe.",
      temei: "Legea 252/2003",
    },
    {
      situatie: "Dosarele de personal",
      cerinta:
        "Câte unul pentru fiecare salariat, păstrat la sediu sau la sediul secundar căruia i s-a delegat încadrarea. Conține actele de angajare, contractul, actele adiționale, actele de studii și orice document care justifică ce s-a completat în registru.",
      temei: "art. 8 alin. (1) și (3) HG 295/2025",
    },
    {
      situatie: "Contractele și actele adiționale",
      cerinta:
        "Contractele individuale, plus actele care au modificat durata, locul muncii, felul muncii, condițiile, salariul, timpul de muncă și timpul de odihnă. La locul de muncă trebuie să existe și o copie a contractului fiecărui om care lucrează acolo.",
      temei: "art. 17 alin. (5) și art. 16 alin. (4) Codul muncii",
    },
    {
      situatie: "Evidența orelor de muncă",
      cerinta:
        "Orele prestate zilnic de fiecare salariat, cu ora de începere și de sfârșit, ținute la locul de muncă. E documentul din care pornesc cele mai multe constatări, fiindcă e singurul care poate contrazice toate celelalte.",
      temei: "art. 119 alin. (1) Codul muncii",
    },
    {
      situatie: "Foile colective de prezență și statele de plată",
      cerinta:
        "Se cer împreună cu evidența orelor, tocmai ca să poată fi comparate. Statele de salarii intră sub termenul de păstrare din legea contabilității.",
      temei: "art. 25 Legea 82/1991",
    },
    {
      situatie: "Registrul general de evidență a salariaților",
      cerinta:
        "Extrasul din REGES-ONLINE, plus contractul cu prestatorul și împuternicirea persoanei desemnate, dacă transmiterea e delegată.",
      temei: "HG 295/2025; art. 3 alin. (8)–(10)",
    },
    {
      situatie: "Regulamentul intern și contractul colectiv",
      cerinta:
        "Regulamentul intern, cu dovada că a fost adus la cunoștința salariaților, și contractul colectiv de muncă, dacă există.",
      temei: "art. 243 Codul muncii",
    },
    {
      situatie: "Documentele de sănătate și securitate",
      cerinta:
        "Fișele de aptitudini, fișele de instruire, programarea concediilor de odihnă, organigrama și informarea privind munca de noapte.",
      temei: "Legea 319/2006; art. 125 alin. (3) Codul muncii",
    },
  ],

  amenzi: [
    {
      fapta: "Neținerea evidenței orelor de muncă",
      suma: "1.500 – 3.000 lei",
      temei: "art. 260 alin. (1) lit. m) Codul muncii",
      nuConfunda:
        "Cea mai mică de pe listă, și rareori singura. Când evidența lipsește, restul constatărilor se fac din statele de plată și din declarații — adică din documente care nu vă mai apără.",
    },
    {
      fapta: "Ore peste norma dintr-un contract cu timp parțial",
      suma: "10.000 – 15.000 lei",
      aplicare: "pentru fiecare persoană, plafon 200.000 lei",
      temei: "art. 15¹ lit. d) și art. 260 alin. (1) lit. e³) Codul muncii",
    },
    {
      fapta: "Salariu net peste cel din statele de plată și din declarație",
      suma: "8.000 – 10.000 lei",
      aplicare: "pentru fiecare salariat, plafon 100.000 lei",
      temei: "art. 15² și art. 260 alin. (1) lit. e⁵) Codul muncii",
    },
    {
      fapta: "Salariat găsit la lucru în perioada în care contractul e suspendat",
      suma: "20.000 lei",
      aplicare: "pentru fiecare persoană, plafon 200.000 lei",
      temei: "art. 260 alin. (1) lit. e²) Codul muncii",
    },
    {
      fapta: "Primirea la muncă fără contract individual de muncă",
      suma: "40.000 lei",
      aplicare: "pentru fiecare persoană, plafon 1.000.000 lei",
      temei: "art. 260 alin. (1) lit. e) Codul muncii, forma dată de Legea 239/2025",
      nuConfunda:
        "Atrage și sistarea activității locului de muncă. Reluarea se poate face doar după achitarea amenzii și remedierea deficienței; reluarea fără ele e infracțiune — art. 260 alin. (4)–(6).",
    },
  ],

  sectiuni: [
    {
      titlu: "Cele patru locuri unde apar problemele",
      paragrafe: [
        "Primul: evidența orelor nu e la locul de muncă, ci la contabilitate sau la sediul social. Legea cere să fie acolo unde omul lucrează efectiv, iar la o firmă cu puncte de lucru asta înseamnă în fiecare dintre ele.",
        "Al doilea: evidența notează numărul de ore, nu ora de începere și de sfârșit. E cea mai frecventă neconformitate și cea mai ușor de reparat înainte, fiindcă nu ține de disciplină, ci de forma foii.",
        "Al treilea: cele trei documente nu se potrivesc între ele. Evidența orelor, foaia colectivă și statul de plată trebuie să spună același lucru; un pontaj care iese perfect în fiecare lună, fără nicio abatere, ridică chiar întrebarea pe care n-o vrei.",
        "Al patrulea: contractele cu timp parțial. Dacă evidența arată ore peste norma din contract, fapta nu mai e o neconformitate de evidență, ci muncă nedeclarată — de la o amendă de o mie cinci sute de lei la una de zece mii pe persoană.",
      ],
    },
    {
      titlu: "Ce s-a schimbat din decembrie 2025",
      paragrafe: [
        "Inspectorii pot fixa foto, audio și video activitățile de la locul de muncă controlat, fără consimțământul persoanelor vizate. Înregistrările se păstrează șase luni. Temeiul e art. 19¹ din Legea 108/1999, introdus prin Legea 239/2025.",
        "Tot atunci s-a dublat amenda pentru primirea la muncă fără contract, de la 20.000 la 40.000 de lei pentru fiecare persoană, cu plafonul cumulat urcat la un milion.",
        "Amenda pentru netransmiterea în registru înainte de începerea activității a rămas la 20.000 de lei de persoană. Sunt două fapte diferite, iar cifrele circulă amestecat — despărțite pe pagina despre REGES-ONLINE.",
      ],
    },
    {
      titlu: "Ce se poate pregăti în seara dinainte și ce nu",
      paragrafe: [
        "Se poate pregăti ordinea: dosarele scoase, registrul unic găsit, copiile contractelor duse la punctele de lucru unde lipsesc. Sunt lucruri care se rezolvă într-o seară și care schimbă tonul controlului.",
        "Nu se poate pregăti evidența orelor. O foaie completată în ajun pentru șase luni în urmă se recunoaște — scrisul e același, cerneala e aceeași, iar cifrele ies prea rotund. Reconstituirea retroactivă e, în practică, mai riscantă decât lipsa.",
        "Nici istoricul modificărilor nu se poate produce ulterior. Întrebarea „cine a schimbat ora asta și când” are răspuns doar dacă sistemul îl păstra deja. E chiar diferența dintre o evidență și o afirmație despre trecut.",
      ],
    },
  ],

  nesigur: [
    {
      intrebare: "Lista de documente e oficială?",
      raspuns:
        "Structura vine dintr-o listă de control de fond publicată de un inspectorat teritorial de muncă. E oficială, dar pagina de proveniență e neactualizată: trimite încă la Revisal și la HG 905/2017, abrogate la 31 decembrie 2025. Am păstrat lista și am înlocuit trimiterile cu echivalentele în vigoare. Nu am găsit o listă echivalentă publicată de Inspecția Muncii la nivel central, deci ordinea și formularea pot diferi de la un inspectorat la altul.",
    },
    {
      intrebare: "„Cele patru locuri unde apar problemele” e din vreun document?",
      raspuns:
        "Nu. Obligațiile și cuantumurile sunt din texte de lege, verificate. Ordonarea lor după cât de des devin constatări e concluzia noastră, din coroborarea listei de documente cu faptele sancționate. E judecată, nu sursă — o spunem ca s-o puteți cântări ca atare.",
    },
    {
      intrebare: "Cât timp trebuie păstrate documentele?",
      raspuns:
        "Depinde de document și, pentru evidența orelor, nu există termen legal. Statele de salarii intră sub art. 25 din Legea contabilității nr. 82/1991 — cinci ani de la 1 iulie a anului următor exercițiului financiar. Termenul se aplică pontajului doar prin analogie, ca document justificativ, nu printr-un text care să-l numească.",
    },
  ],

  legaturaSecundara: {
    eticheta: "Ce cere art. 119 la evidența orelor",
    href: "/evidenta-orelor-de-munca",
  },

  actualizat: "septembrie 2026",
  actualizatIso: "2026-09-04",
};
