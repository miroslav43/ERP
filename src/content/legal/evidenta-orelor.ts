import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/evidenta-orelor-de-munca`.
 *
 * ── CE FACE PAGINA ASTA DIFERIT ───────────────────────────────────────────
 * Aproape tot ce se găsește pe subiectul ăsta repetă „angajatorul ține evidența
 * orelor" și trece mai departe. Partea care contează practic — că art. 119 cere
 * ORA DE ÎNCEPERE ȘI DE SFÂRȘIT, nu numărul de ore — lipsește din majoritatea
 * textelor, deși e chiar diferența dintre o evidență conformă și una care nu e.
 *
 * A doua parte care lipsește peste tot: nu există niciun termen legal de
 * păstrare a evidenței orelor. Cei „5 ani" pe care îi scrie toată lumea vin din
 * Legea contabilității, aplicați prin analogie. Pagina o spune, fiindcă e
 * adevărat și fiindcă cine caută răspunsul ăsta merită să știe pe ce stă.
 *
 * ── DE UNDE VIN CIFRELE ───────────────────────────────────────────────────
 * Textele au fost citite în forma consolidată de pe Portalul Legislativ
 * (legislatie.just.ro), nu din rezumate. Actele modificatoare verificate direct:
 * Legea 88/2018 (art. 119 alin. 1 în forma actuală), OUG 37/2021 (alin. 2),
 * OUG 117/2021 (munca nedeclarată și subdeclarată), Legea 239/2025.
 */

export const EVIDENTA_ORELOR: PaginaLege = {
  antet: {
    supratitlu: "Obligație legală",
    titlu: "Evidența orelor de muncă: ce cere art. 119 din Codul muncii",
    lead: "Regula e mai strictă decât o știe multă lume: nu ajunge numărul de ore pe zi. Legea cere ora de începere și ora de sfârșit, zilnic, pentru fiecare salariat, ținute la locul de muncă.",
  },

  raspunsScurt: [
    "Art. 119 alin. (1) din Codul muncii cere angajatorului să țină, la locul de muncă, evidența orelor prestate zilnic de fiecare salariat, cu evidențierea orelor de începere și de sfârșit ale programului, și s-o prezinte inspectorilor de muncă ori de câte ori se solicită.",
    "Nerespectarea obligației se sancționează cu amendă de la 1.500 la 3.000 de lei — art. 260 alin. (1) lit. m). Nu e pe persoană și nu are plafon cumulat.",
    "Pentru salariații mobili, cei care lucrează la domiciliu și cei din microîntreprinderi, evidența se ține în condițiile stabilite prin acord scris cu salariatul — art. 119 alin. (2). Fără acordul scris, excepția nu se poate invoca.",
  ],

  titluReguli: "Ce cere textul, punct cu punct",

  reguli: [
    {
      situatie: "Ce se înregistrează",
      cerinta:
        "Orele prestate, cu ora de începere și ora de sfârșit ale programului de lucru. Un pontaj care notează doar „8 h” sau „P” nu îndeplinește cerința, oricât de îngrijit ar fi ținut.",
      temei: "art. 119 alin. (1) Codul muncii",
    },
    {
      situatie: "Cât de des",
      cerinta: "Zilnic, pentru fiecare salariat. Nu lunar, nu la sfârșit de perioadă.",
      temei: "art. 119 alin. (1) Codul muncii",
    },
    {
      situatie: "Unde stă",
      cerinta:
        "La locul de muncă — locul în care salariatul își desfășoară efectiv activitatea, în perimetrul asigurat de angajator: sediu, sucursală, agenție sau punct de lucru. Nu la contabilitate și nu la sediul social, dacă oamenii lucrează în altă parte.",
      temei: "art. 119 alin. (1) coroborat cu art. 16¹ Codul muncii",
    },
    {
      situatie: "Cui se arată",
      cerinta:
        "Inspectorilor de muncă, ori de câte ori o cer. Refuzul nejustificat de a prezenta documentele, după a doua solicitare, depășește contravenționalul.",
      temei: "art. 119 alin. (1); art. 264 alin. (2) Codul muncii",
    },
    {
      situatie: "Salariați mobili, la domiciliu, microîntreprinderi",
      cerinta:
        "Evidența se ține în condițiile stabilite cu salariații prin acord scris, potrivit activității specifice. Microîntreprinderea e cea definită de art. 4 alin. (1) lit. a) din Legea 346/2004.",
      temei: "art. 119 alin. (2) Codul muncii",
    },
    {
      situatie: "Copia contractului, la locul de muncă",
      cerinta:
        "Separat de evidența orelor, la locul de muncă trebuie să existe și o copie a contractului individual de muncă. E o obligație distinctă, cu amendă proprie de 10.000 de lei.",
      temei: "art. 16 alin. (4); art. 260 alin. (1) lit. q) Codul muncii",
    },
  ],

  amenzi: [
    {
      fapta:
        "Neținerea evidenței orelor de muncă, sau ținerea ei fără orele de începere și de sfârșit",
      suma: "1.500 – 3.000 lei",
      temei: "art. 260 alin. (1) lit. m) Codul muncii",
      nuConfunda:
        "E o amendă pe faptă, nu pe salariat, și nu are plafon cumulat. E și cea mai mică dintre cele de pe pagina asta — problema reală nu e ea, ci ce se descoperă pornind de la o evidență care lipsește.",
    },
    {
      fapta:
        "Depășirea duratei timpului de muncă stabilite în contractul cu timp parțial, în afara cazurilor de forță majoră sau de lucrări urgente",
      suma: "10.000 – 15.000 lei",
      aplicare: "pentru fiecare persoană, plafon 200.000 lei",
      temei: "art. 15¹ lit. d) și art. 260 alin. (1) lit. e³) Codul muncii",
      nuConfunda:
        "Legea numește fapta asta „muncă nedeclarată”, deși omul are contract. La un part-time, evidența orelor e chiar proba: dacă arată ore peste normă, fapta trece din amenda de 1.500 lei în asta.",
    },
    {
      fapta:
        "Acordarea unui salariu net mai mare decât cel din statele de plată și din declarația fiscală",
      suma: "8.000 – 10.000 lei",
      aplicare: "pentru fiecare salariat, plafon 100.000 lei",
      temei: "art. 15² și art. 260 alin. (1) lit. e⁵) Codul muncii",
      nuConfunda:
        "„Muncă subdeclarată”. Se descoperă tocmai din neconcordanța dintre evidența orelor, foaia colectivă de prezență și statul de plată.",
    },
    {
      fapta: "Lipsa unei copii a contractului individual de muncă la locul de muncă",
      suma: "10.000 lei",
      temei: "art. 260 alin. (1) lit. q) Codul muncii",
    },
  ],

  sectiuni: [
    {
      titlu: "Potrivirea în trei",
      paragrafe: [
        "La un control, evidența orelor nu se citește singură. Se compară cu foaia colectivă de prezență și cu statul de plată, iar cele trei trebuie să spună același lucru.",
        "Aici se pierd majoritatea firmelor care cred că sunt în regulă: evidența există, dar e reconstituită la sfârșit de lună din memorie, ca să iasă cu statul. Un pontaj care se potrivește perfect cu salariul în fiecare lună, fără nicio abatere, ridică exact întrebarea pe care n-o vrei.",
        "Neconcordanța nu e în sine o contravenție. Dar deschide drumul spre celelalte: ore peste norma de part-time, salariu net care nu se regăsește în state, oameni la lucru în perioadă de suspendare a contractului.",
      ],
    },
    {
      titlu: "Ce cere ITM la un control de fond",
      paragrafe: [
        "Lista de documente publicată de inspectoratele teritoriale cuprinde, pe zona de timp de muncă: documentele privind evidența orelor prestate de fiecare salariat, foile colective de prezență, statele de plată, actele adiționale care au modificat timpul de muncă și de odihnă, programarea concediilor, informarea privind munca de noapte, regulamentul intern și dosarele de personal.",
        "Din decembrie 2025, inspectorii pot fixa foto, audio și video activitățile de la locul de muncă controlat, fără consimțământul persoanelor vizate; înregistrările se păstrează șase luni. Temeiul e art. 19¹ din Legea 108/1999, introdus prin Legea 239/2025.",
        "Împiedicarea accesului inspectorilor și refuzul nejustificat de a prezenta documentele cerute, în cel mult 15 zile de la a doua solicitare, sunt infracțiuni, nu contravenții — art. 264 alin. (2) și (3) din Codul muncii.",
      ],
    },
    {
      titlu: "Ce nu rezolvă un fișier",
      paragrafe: [
        "Un tabel ținut corect satisface litera legii. Problema apare la partea a doua a obligației: „să supună controlului această evidență, ori de câte ori se solicită”.",
        "Ce se cere atunci nu e foaia, ci încrederea în ea. Un fișier de calcul păstrează ultima stare, nu drumul până la ea — nu poate arăta cine a schimbat o oră, când, și ce scria înainte. Într-un control care merge înapoi șase luni, asta e diferența dintre o evidență și o afirmație.",
        "În Administrativo, fiecare zi de pontaj reține ora de început și ora de sfârșit, iar fiecare modificare lasă cine și când. Foaia lunii se tipărește ca o foaie colectivă de prezență obișnuită și se exportă în format de calcul pentru contabil.",
      ],
    },
  ],

  nesigur: [
    {
      intrebare: "Cât timp trebuie păstrată evidența orelor de muncă?",
      raspuns:
        "Nu există termen legal. Codul muncii nu prevede unul nici la art. 119, nici altundeva, și nu îl prevede nici HG 295/2025. Termenul de 5 ani pe care îl scrie multă lume vine din art. 25 al Legii contabilității nr. 82/1991 — care se referă la documentele justificative și la statele de salarii, socotiți de la 1 iulie a anului următor exercițiului financiar — aplicat prin analogie pontajului. Analogia e rezonabilă și e ce facem și noi în practică, dar nu e un text de lege despre evidența orelor, iar pagina asta n-o să pretindă că este.",
    },
    {
      intrebare: "Ce formă trebuie să aibă evidența?",
      raspuns:
        "Legea nu impune un format. Nu există un model oficial de condică sau de foaie, nu se cere hârtie și nu se cere semnătură zilnică a salariatului. Ce se cere e conținutul — zilnic, pe fiecare salariat, cu ora de început și de sfârșit — și disponibilitatea la locul de muncă. Orice text care îți prezintă un „model obligatoriu” descrie o practică, nu o obligație.",
    },
  ],

  actualizat: "septembrie 2026",
  actualizatIso: "2026-09-03",
};
