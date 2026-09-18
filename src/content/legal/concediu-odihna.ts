import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/concediu-de-odihna`.
 *
 * ── CE FACE PAGINA ASTA DIFERIT ───────────────────────────────────────────
 * Două lucruri, ambele verificate în textul legii, ambele contrazise de
 * majoritatea articolelor de pe subiect:
 *
 *  1. **Nu există amendă pentru neacordarea concediului de odihnă.** Art. 260
 *     alin. (1) din Codul muncii a fost citit literă cu literă, de la a) la u):
 *     singura contravenție care conține cuvântul „concediu” e cea de la lit. t),
 *     pentru concediul de ÎNGRIJITOR. Sancțiunea reală vine pe alt drum — o
 *     măsură dispusă de inspector, neîndeplinită — și e în altă lege.
 *  2. **Codul muncii nu conține nicio regulă de proporționalizare** a zilelor
 *     pentru un an lucrat parțial. Formula „20 ÷ 12 × lunile lucrate” pe care o
 *     scrie toată lumea nu are articol în spate; ea vine din contractele
 *     colective și din practică.
 *
 * ── CE E NOU ȘI APROAPE NIMENI N-A SCRIS ÎNCĂ ─────────────────────────────
 * Decizia ÎCCJ **HP nr. 40/2026**, publicată în Monitorul Oficial nr. 665 din
 * 11 august 2026 — cu o lună înainte de scrierea paginii. Schimbă răspunsul la
 * cea mai frecventă întrebare practică de aici: ce se întâmplă cu zilele
 * rămase după termenul de report de 18 luni. Textul deciziei e citat în
 * secțiunea de proză, nu parafrazat.
 *
 * ── DE UNDE VIN CIFRELE ───────────────────────────────────────────────────
 * Codul muncii, forma consolidată de pe Portalul Legislativ (documentul
 * 128647), articolele 144-152, citite integral. Legea 108/1999, forma
 * consolidată de la 18 decembrie 2025 (documentul 304537) — NU cea servită
 * implicit de portal la `DetaliiDocumentAfis/137525`, care e mai veche și n-are
 * art. 19¹. Capcana asta e chiar motivul pentru care paginile astea citează
 * documentul, nu „legea”.
 */

export const CONCEDIU_ODIHNA: PaginaLege = {
  cale: "/ghid/concediu-de-odihna",
  antet: {
    supratitlu: "Obligație legală",
    titlu: "Concediul de odihnă: zile, programare, report, bani",
    lead: "Douăzeci de zile lucrătoare e minimul, nu norma. Restul regulilor — programarea până la sfârșitul anului, cele 10 zile neîntrerupte, plata cu 5 zile înainte, reportul de 18 luni — sunt la fel de obligatorii și mult mai des încălcate.",
  },

  raspunsScurt: [
    "Durata minimă a concediului de odihnă anual e de 20 de zile lucrătoare — art. 145 alin. (1) din Codul muncii. Durata efectivă se scrie în contractul individual de muncă și poate fi mai mare, niciodată mai mică.",
    "Sărbătorile legale și zilele libere plătite din contractul colectiv nu intră în cele 20 de zile, iar dreptul la concediu nu poate fi cedat, limitat sau renunțat — art. 145 alin. (3) și art. 144 alin. (2).",
    "Concediul se efectuează în natură, în anul pentru care se cuvine. Compensarea în bani e permisă NUMAI la încetarea contractului — art. 146 alin. (3). Zilele neefectuate din motive justificate se acordă într-un termen de 18 luni începând cu anul următor.",
  ],

  titluReguli: "Regulile, cu articolul lângă fiecare",

  reguli: [
    {
      situatie: "Câte zile, ca minim",
      cerinta:
        "20 de zile lucrătoare pe an. E un plafon de jos: contractul individual poate prevedea mai multe, contractul colectiv aplicabil la fel, dar nimic nu poate coborî sub el.",
      temei: "art. 145 alin. (1) și (2) Codul muncii",
    },
    {
      situatie: "Ce NU se numără în ele",
      cerinta:
        "Sărbătorile legale în care nu se lucrează și zilele libere plătite stabilite prin contractul colectiv. Un concediu de două săptămâni care cuprinde 1 Decembrie consumă tot 10 zile de concediu, nu 11.",
      temei: "art. 145 alin. (3) Codul muncii",
    },
    {
      situatie: "Perioade care se socotesc ca muncă prestată",
      cerinta:
        "Incapacitatea temporară de muncă, concediul de maternitate, cel paternal, cel de risc maternal, cel pentru îngrijirea copilului bolnav, concediul de îngrijitor și absența pentru forță majoră din art. 152². Zilele de concediu nu se taie pentru niciuna dintre ele.",
      temei: "art. 145 alin. (4) Codul muncii",
    },
    {
      situatie: "Boala în timpul concediului",
      cerinta:
        "Concediul se ÎNTRERUPE de drept. Salariatul efectuează restul zilelor după ce situația încetează, iar dacă nu e posibil, zilele rămase se reprogramează. Nu se pierd și nu se consumă.",
      temei: "art. 145 alin. (5) Codul muncii",
    },
    {
      situatie: "Programarea",
      cerinta:
        "Colectivă sau individuală, stabilită de angajator cu consultarea sindicatului ori a reprezentanților salariaților — sau a salariatului însuși, pentru cele individuale. Se face până la sfârșitul anului calendaristic, pentru anul următor.",
      temei: "art. 148 alin. (1) Codul muncii",
    },
    {
      situatie: "Cât de mare poate fi fereastra programată",
      cerinta:
        "Programările colective stabilesc perioade de cel puțin 3 luni pe categorii de personal sau locuri de muncă; cele individuale, o dată sau o perioadă de cel mult 3 luni. În interiorul ferestrei, salariatul poate cere efectuarea cu cel puțin 60 de zile înainte.",
      temei: "art. 148 alin. (2)-(4) Codul muncii",
    },
    {
      situatie: "Fracționarea",
      cerinta:
        "Dacă se fracționează, angajatorul e obligat să programeze astfel încât fiecare salariat să efectueze într-un an calendaristic cel puțin 10 zile lucrătoare de concediu NEÎNTRERUPT. Cea mai des încălcată regulă din pagina asta.",
      temei: "art. 148 alin. (5) Codul muncii",
    },
    {
      situatie: "Reportul",
      cerinta:
        "Când salariatul nu poate efectua concediul din motive justificate, angajatorul e obligat — cu acordul salariatului — să-l acorde într-o perioadă de 18 luni începând cu anul URMĂTOR celui în care s-a născut dreptul.",
      temei: "art. 146 alin. (2) Codul muncii",
    },
    {
      situatie: "Banii în loc de zile",
      cerinta:
        "Permis numai la încetarea contractului individual de muncă. În timpul contractului, o înțelegere prin care salariatul primește bani ca să nu plece în concediu e lovită de nulitate: dreptul nu poate forma obiectul unei renunțări.",
      temei: "art. 146 alin. (3) coroborat cu art. 144 alin. (2) Codul muncii",
    },
    {
      situatie: "Cât se plătește",
      cerinta:
        "Indemnizația nu poate fi mai mică decât salariul de bază, indemnizațiile și sporurile cu caracter permanent cuvenite pentru perioada respectivă. Se calculează ca medie zilnică a acestor drepturi din ultimele 3 luni anterioare celei în care se efectuează concediul, înmulțită cu numărul de zile.",
      temei: "art. 150 alin. (1) și (2) Codul muncii",
    },
    {
      situatie: "Când se plătește",
      cerinta:
        "Cu cel puțin 5 zile lucrătoare ÎNAINTE de plecarea în concediu. Nu odată cu salariul lunii următoare, cum se practică des.",
      temei: "art. 150 alin. (3) Codul muncii",
    },
    {
      situatie: "Zile suplimentare",
      cerinta:
        "Cel puțin 3 zile lucrătoare în plus pentru cei care lucrează în condiții grele, periculoase sau vătămătoare, pentru nevăzători, pentru alte persoane cu handicap și pentru tinerii sub 18 ani. Numărul exact se stabilește prin contractul colectiv aplicabil.",
      temei: "art. 147 Codul muncii",
    },
    {
      situatie: "Rechemarea din concediu",
      cerinta:
        "Numai în caz de forță majoră sau pentru interese urgente care impun prezența salariatului. Angajatorul suportă TOATE cheltuielile salariatului ȘI ale familiei sale pentru revenire, plus eventualele prejudicii suferite din întreruperea concediului.",
      temei: "art. 151 alin. (2) Codul muncii",
    },
  ],

  amenzi: [
    {
      fapta: "Neacordarea concediului de odihnă anual — direct, ca faptă de sine stătătoare",
      suma: "nicio contravenție",
      aplicare:
        "Art. 260 alin. (1) din Codul muncii enumeră contravențiile de la lit. a) la lit. u). Niciuna nu sancționează neacordarea concediului de odihnă. Sancțiunea vine indirect, pe rândul următor.",
      temei: "art. 260 alin. (1) Codul muncii, citit integral",
      nuConfunda:
        "Nu înseamnă că fapta e permisă: dreptul salariatului rămâne, iar el îl poate valorifica în instanță. Înseamnă doar că inspectorul nu poate scrie amenda direct pe fapta asta.",
    },
    {
      fapta:
        "Neîndeplinirea măsurii dispuse de inspectorul de muncă — de exemplu „acordați concediul restant până la data X”",
      suma: "5.000 – 10.000 lei",
      aplicare:
        "Pe măsură neîndeplinită, nu pe salariat. Contravenientul poate achita pe loc sau în 48 de ore jumătate din minim, adică 2.500 lei (art. 24 din aceeași lege).",
      temei: "art. 23 alin. (1) lit. b) din Legea 108/1999, forma din 18 decembrie 2025",
    },
    {
      fapta: "Neacordarea concediului de îngrijitor (5 zile lucrătoare pe an)",
      suma: "4.000 – 8.000 lei",
      temei: "art. 260 alin. (1) lit. t) Codul muncii",
      nuConfunda:
        "E alt concediu, cu alt regim: se acordă pentru îngrijirea unei rude sau a unei persoane din aceeași gospodărie cu o problemă medicală gravă, și NU se include în durata concediului de odihnă (art. 152¹).",
    },
  ],

  sectiuni: [
    {
      titlu: "Cele 18 luni, și ce s-a schimbat în august 2026",
      paragrafe: [
        "Termenul de report e cel mai prost înțeles lucru de pe pagina asta. Art. 146 alin. (2) nu spune că zilele „expiră” după 18 luni; spune că angajatorul e OBLIGAT să le acorde în acest interval, calculat de la 1 ianuarie al anului următor celui în care s-a născut dreptul. Pentru zilele cuvenite pe 2026, termenul curge deci până la 30 iunie 2028.",
        "Ce se întâmplă cu zilele rămase și după acest termen era, până de curând, o întrebare fără răspuns unitar. Înalta Curte de Casație și Justiție a dat unul prin decizia HP nr. 40/2026, publicată în Monitorul Oficial nr. 665 din 11 august 2026, iar el împarte situațiile în două după un singur criteriu: dacă angajatorul a oferit sau nu efectiv posibilitatea de a lua concediul.",
        "Textul deciziei: „dreptul de a obține compensarea în bani a zilelor de concediu de odihnă subzistă atunci când angajatorul nu a oferit în mod efectiv angajatului posibilitatea de a exercita acest drept și, respectiv, nu există atunci când angajatul s-a abținut să își efectueze concediul anual plătit, deși i s-a oferit această posibilitate”. Tot acolo se stabilește că termenul de prescripție de 3 ani pentru pretențiile bănești curge de la momentul încetării raportului de muncă, nu de la data la care s-au născut zilele.",
        "Consecința practică pentru un angajator e simplă și nu e despre evidență, ci despre dovadă: programarea scrisă până la sfârșitul anului precedent și invitațiile la concediu nu mai sunt formalități administrative, ci singura probă că posibilitatea a fost oferită efectiv.",
      ],
    },
    {
      titlu: "De ce indemnizația nu e „salariul pe zilele alea”",
      paragrafe: [
        "Art. 150 alin. (2) cere media zilnică a drepturilor salariale din ultimele 3 luni anterioare celei în care se efectuează concediul, înmulțită cu numărul de zile de concediu. Nu salariul lunii curente împărțit la zile lucrătoare, și nu salariul de bază singur.",
        "Diferența se vede la oamenii cu sporuri permanente și la cei cărora li s-a schimbat salariul recent. Dacă cineva a primit o mărire în luna în care pleacă în concediu, media pe ultimele 3 luni e mai mică decât salariul nou — iar art. 150 alin. (1) pune și un prag de jos: indemnizația nu poate fi mai mică decât salariul de bază, indemnizațiile și sporurile permanente cuvenite pentru perioada respectivă. Cele două alineate se aplică împreună, nu unul în locul celuilalt.",
        "Termenul de plată — cel puțin 5 zile lucrătoare înainte de plecare — e formulat ca obligație a angajatorului, fără condiție de cerere din partea salariatului. În practică e ratat aproape peste tot, fiindcă plata se face din același stat de salarii ca restul lunii.",
      ],
    },
    {
      titlu: "Programarea, pasul pe care îl sare toată lumea",
      paragrafe: [
        "Art. 148 alin. (1) cere ca programarea să fie făcută până la sfârșitul anului calendaristic, pentru anul următor. Nu „când își ia omul liber”, nu „când se poate”. E un document care trebuie să existe în decembrie pentru anul care vine, iar absența lui e primul lucru care se vede la un control pe relații de muncă.",
        "Programarea nu e o listă de date fixe. Poate stabili perioade — cel puțin 3 luni pentru cele colective, cel mult 3 luni pentru cele individuale — în interiorul cărora salariatul cere concediul cu 60 de zile înainte. Forma asta e mai ușor de ținut decât un calendar exact și rezistă mai bine la schimbările de plan.",
        "Singura constrângere greu de ocolit e alin. (5): oricât s-ar fracționa, fiecare salariat trebuie să apuce într-un an cel puțin 10 zile lucrătoare neîntrerupt. O firmă care dă concediul numai în bucăți de câte 2-3 zile, ca să nu rămână descoperită, e în neregulă chiar dacă la finalul anului suma zilelor iese corectă.",
      ],
    },
  ],

  nesigur: [
    {
      intrebare: "Câte zile i se cuvin cuiva angajat în iulie?",
      raspuns:
        "Codul muncii nu prevede nicio regulă de proporționalizare pentru un an lucrat parțial. Formula „20 ÷ 12 × lunile lucrate” e larg folosită și larg scrisă, dar ea vine din contractele colective de muncă și din practica administrativă, nu dintr-un articol. Verificați contractul colectiv aplicabil și regulamentul intern înainte de a o aplica ca pe o regulă legală.",
    },
    {
      intrebare: "Câte zile suplimentare, concret, pentru condiții vătămătoare?",
      raspuns:
        "Art. 147 spune „cel puțin 3 zile lucrătoare” și trimite numărul exact la contractul colectiv aplicabil. Nu există o cifră unică pe economie, iar un răspuns care dă una fără să numească contractul colectiv din care o citește e o presupunere.",
    },
    {
      intrebare: "Se pot pierde zilele de concediu neefectuate?",
      raspuns:
        "După HP nr. 40/2026, răspunsul depinde de conduita angajatorului, nu de calendar: dreptul la compensare subzistă dacă posibilitatea de a lua concediul nu a fost oferită efectiv. Cum se dovedește „efectiv” în fața unei instanțe rămâne de văzut în hotărârile care vor aplica decizia — e prea devreme pentru un răspuns cu practică în spate.",
    },
    {
      intrebare: "Poate angajatorul obliga salariatul să-și ia concediul într-o anumită perioadă?",
      raspuns:
        "Programarea o stabilește angajatorul, cu consultarea prevăzută de art. 148 alin. (1), iar art. 149 obligă salariatul să efectueze concediul în natură în perioada programată. Dar „consultare” nu e definită procedural în Cod, iar limita dintre o programare legitimă și un abuz se trasează de la caz la caz. Nu dăm un răspuns general.",
    },
  ],

  legaturaSecundara: { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },

  legaturiConexe: [
    {
      eticheta: "Unealtă: cerere de concediu cu zilele calculate",
      href: "/unelte/cerere-concediu-de-odihna",
    },
    { eticheta: "Modulul Concedii: solduri, aprobări, calendar", href: "/module/concedii" },
    { eticheta: "Evidența orelor de muncă: art. 119", href: "/evidenta-orelor-de-munca" },
    {
      eticheta: "Portalul angajatului: cererile depuse de pe telefon",
      href: "/module/portal-angajat",
    },
  ],

  surse: [
    {
      eticheta: "Codul muncii, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/128647",
    },
    {
      eticheta: "Legea 108/1999, forma consolidată din 18 decembrie 2025",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/304537",
    },
  ],

  actualizat: "septembrie 2026",
  actualizatIso: "2026-09-18",
};
