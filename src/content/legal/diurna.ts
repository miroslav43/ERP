import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/diurna`.
 *
 * ── CE FACE PAGINA ASTA DIFERIT ───────────────────────────────────────────
 * Trei lucruri, toate citite în textul legii, toate greșite des în afară:
 *
 *  1. **Cei 5 km nu sunt o regulă a firmelor private.** Pragul apare în
 *     HG 714/2018, care se aplică „personalului autorităților și instituțiilor
 *     publice". Codul muncii, art. 43-44, definește delegarea fără NICIO
 *     condiție de distanță. Firma privată o poate pune în regulamentul propriu;
 *     nu o primește din lege.
 *  2. **Al doilea plafon nu e „3 salarii pe delegare”.** Art. 76 alin. (2)
 *     lit. k) spune, literal, că se calculează DISTINCT pe fiecare lună:
 *     3 salarii împărțite la zilele lucrătoare ale lunii, înmulțite cu zilele
 *     de delegare din luna aceea. O delegare care trece peste 1 ale lunii are
 *     două plafoane, nu unul.
 *  3. **Depășirea nu e o amendă.** Nu există contravenție în Codul muncii
 *     pentru diurna greșit calculată — art. 260 a fost citit literă cu literă.
 *     Diferența se reîncadrează fiscal ca venit din salarii, cu impozit ȘI
 *     contribuții, fiindcă art. 139 repetă aceeași plafonare pentru baza de
 *     calcul a contribuțiilor.
 *
 * ── DE UNDE VIN CIFRELE ───────────────────────────────────────────────────
 * Codul muncii art. 43-47 (documentul 128647). Codul fiscal art. 76 alin. (2)
 * lit. k) și art. 139, forma consolidată la 8 august 2026 (documentul 171282) —
 * litera k) e în forma dată de OUG 115/2023, în vigoare din 15 decembrie 2023.
 * HG 714/2018, forma consolidată la 1 aprilie 2023 (documentul 205001), de unde
 * vine cuantumul de 23 lei/zi.
 *
 * Cei 57,50 lei sunt o ÎNMULȚIRE făcută de noi (2,5 × 23), nu o cifră scrisă
 * într-un act. Pagina o spune pe față: în ziua în care hotărârea de guvern
 * schimbă cei 23 de lei, plafonul se mută singur, iar orice pagină care a scris
 * doar rezultatul devine falsă fără să se atingă nimeni de ea.
 */

export const DIURNA: PaginaLege = {
  cale: "/ghid/diurna",
  antet: {
    supratitlu: "Obligație legală",
    titlu: "Diurna în 2026: cele două plafoane și ce se impozitează",
    lead: "Plafonul neimpozabil nu e o sumă fixă, ci o înmulțire cu un nivel stabilit prin hotărâre de guvern — și mai are un al doilea plafon, calculat lunar, pe care aproape nimeni nu-l aplică corect.",
  },

  raspunsScurt: [
    "Pentru deplasările în țară, indemnizația de delegare e neimpozabilă până la 2,5 ori nivelul stabilit prin hotărâre de guvern pentru personalul instituțiilor publice. Nivelul acela e azi de 23 lei/zi, deci plafonul e de 57,50 lei/zi — art. 76 alin. (2) lit. k) pct. (i) din Codul fiscal.",
    "Peste el se aplică un al doilea plafon, independent: 3 salarii de bază corespunzătoare locului de muncă ocupat, calculate distinct pentru fiecare lună. Partea care depășește oricare dintre cele două e venit din salarii, cu impozit și cu contribuții — art. 139 repetă plafonarea pentru baza contributivă.",
    "Decontarea transportului și a cazării nu intră în niciunul dintre plafoane: textul le exclude expres. Iar Codul muncii nu condiționează delegarea de nicio distanță — pragul de 5 km circulă din hotărârea care se aplică sectorului public.",
  ],

  titluReguli: "Regulile, cu articolul lângă fiecare",

  reguli: [
    {
      situatie: "Ce este delegarea",
      cerinta:
        "Exercitarea temporară, din dispoziția angajatorului, a unor lucrări sau sarcini corespunzătoare atribuțiilor de serviciu în afara locului de muncă. Fără condiție de distanță, fără prag de kilometri.",
      temei: "art. 43 Codul muncii",
    },
    {
      situatie: "Cât poate ține",
      cerinta:
        "Cel mult 60 de zile calendaristice în 12 luni. Se prelungește pe perioade succesive de maximum 60 de zile, dar NUMAI cu acordul salariatului, iar refuzul prelungirii nu poate fi motiv de sancțiune disciplinară.",
      temei: "art. 44 alin. (1) Codul muncii",
    },
    {
      situatie: "Ce i se cuvine salariatului delegat",
      cerinta:
        "Plata cheltuielilor de transport și cazare, PLUS o indemnizație de delegare. Sunt trei lucruri distincte, nu unul: indemnizația nu acoperă transportul și cazarea, iar decontarea lor nu ține loc de indemnizație.",
      temei: "art. 44 alin. (2) Codul muncii",
    },
    {
      situatie: "Detașarea, care e altceva",
      cerinta:
        "Schimbarea temporară a locului de muncă la un ALT angajator, pe cel mult un an, prelungibilă din 6 în 6 luni pentru motive obiective. Salariatul o poate refuza doar în mod excepțional și pentru motive personale temeinice. Drepturile i le acordă angajatorul la care a fost detașat.",
      temei: "art. 45-47 Codul muncii",
    },
    {
      situatie: "Plafonul neimpozabil, în țară",
      cerinta:
        "2,5 ori nivelul legal stabilit prin hotărâre a Guvernului pentru personalul autorităților și instituțiilor publice. Formularea e o înmulțire cu o valoare externă, nu o sumă: când hotărârea se schimbă, plafonul se mută fără să se modifice Codul fiscal.",
      temei: "art. 76 alin. (2) lit. k) pct. (i) Codul fiscal",
    },
    {
      situatie: "Valoarea de referință, azi",
      cerinta:
        "23 lei/zi — indemnizația de delegare pentru personalul instituțiilor publice. Cuantumul nu e scris în hotărâre, ci actualizat prin ordin de ministru: cel în vigoare e Ordinul 1.235/2023, aplicabil din 1 aprilie 2023. Înmulțit cu 2,5, dă plafonul neimpozabil de 57,50 lei/zi pentru deplasările interne.",
      temei: "art. 1 alin. (1) și alin. (2) lit. a) din Anexa la HG 714/2018",
    },
    {
      situatie: "Plafonul neimpozabil, în străinătate",
      cerinta:
        "Tot 2,5 ori, dar aplicat diurnei stabilite prin hotărâre de guvern pentru personalul român trimis în străinătate în misiuni temporare. Valorile sunt pe țări și se schimbă independent — nu le reproducem aici, tocmai ca să nu îmbătrânească în tăcere.",
      temei: "art. 76 alin. (2) lit. k) pct. (ii) Codul fiscal",
    },
    {
      situatie: "Al doilea plafon: 3 salarii de bază",
      cerinta:
        "Se calculează DISTINCT pentru fiecare lună: cele 3 salarii se împart la numărul de zile lucrătoare din luna respectivă, iar rezultatul se înmulțește cu numărul de zile de delegare din acea lună. O deplasare care traversează începutul lunii se împarte în două calcule.",
      temei: "art. 76 alin. (2) lit. k), teza finală, Codul fiscal",
    },
    {
      situatie: "Ce se întâmplă cu partea care depășește",
      cerinta:
        "Devine venit din salarii: intră în baza impozitului pe venit și, prin art. 139, în baza contribuțiilor sociale. Nu e o penalizare, e o reîncadrare — iar cele două plafoane se aplică cumulativ, deci se ia cel mai mic dintre ele.",
      temei: "art. 76 alin. (2) lit. k) și art. 139 Codul fiscal",
    },
    {
      situatie: "Ce NU intră în plafon",
      cerinta:
        "Sumele acordate pentru acoperirea cheltuielilor de transport și cazare. Textul le exclude expres din sfera plafonării, deci o cazare decontată integral nu consumă nimic din cei 57,50 lei pe zi.",
      temei: "art. 76 alin. (2) lit. k) Codul fiscal",
    },
  ],

  amenzi: [
    {
      fapta: "Neacordarea indemnizației de delegare sau calcularea ei greșită",
      suma: "nicio contravenție",
      aplicare:
        "Art. 260 alin. (1) din Codul muncii, citit de la lit. a) la lit. u), nu conține nicio faptă legată de diurnă. Dreptul salariatului rămâne și se poate valorifica în instanță, dar inspectorul nu are ce amendă să scrie pe fapta asta.",
      temei: "art. 260 alin. (1) Codul muncii, citit integral",
    },
    {
      fapta: "Tratarea ca neimpozabilă a părții care depășește plafonul",
      suma: "reîncadrare fiscală",
      aplicare:
        "Diferența devine venit din salarii, cu impozit și contribuții aferente, plus accesoriile prevăzute de Codul de procedură fiscală. E o chestiune de declarații rectificative, nu de proces-verbal de contravenție la relații de muncă.",
      temei: "art. 76 alin. (2) lit. k) și art. 139 Codul fiscal",
      nuConfunda:
        "Controlul care descoperă asta e unul fiscal, al ANAF, nu unul de relații de muncă. Inspectorul de muncă nu recalculează diurne.",
    },
    {
      fapta: "Neîndeplinirea măsurii dispuse de inspectorul de muncă",
      suma: "5.000 – 10.000 lei",
      aplicare:
        "Dacă din control iese o măsură — de exemplu plata indemnizațiilor restante până la o dată — neîndeplinirea ei e contravenție de sine stătătoare. Se poate achita jumătate din minim în 48 de ore.",
      temei: "art. 23 alin. (1) lit. b) din Legea 108/1999",
    },
  ],

  sectiuni: [
    {
      titlu: "De ce cei 5 km nu sunt ai firmei tale",
      paragrafe: [
        "Pragul de 5 km — și cel de 50 km, care îl însoțește — vine din HG 714/2018, o hotărâre al cărei obiect e, chiar din titlu, personalul autorităților și instituțiilor publice. Acolo distanța decide ce fel de drepturi se acordă: sub 5 km nimic, între 5 și 50 km indemnizație fără cazare, peste 50 km indemnizație plus alocație de cazare.",
        "Codul muncii, care guvernează delegarea la un angajator privat, nu conține niciun kilometru. Art. 43 vorbește despre „exercitarea temporară […] în afara locului său de muncă”, iar art. 44 alin. (2) dă dreptul la transport, cazare și indemnizație „în condițiile prevăzute de lege sau de contractul colectiv de muncă aplicabil”. Condiția de distanță poate exista, dar ea vine din contractul colectiv sau din politica internă a firmei — nu din lege.",
        "Confuzia are un cost practic: o firmă care refuză indemnizația pentru o deplasare de 4 km crede că aplică legea, când de fapt aplică o regulă a sectorului public la un raport de muncă privat. Invers, o firmă care plătește diurnă pentru deplasări în aceeași localitate nu încalcă nimic — dar plafonul fiscal se aplică oricum.",
      ],
    },
    {
      titlu: "Al doilea plafon, cel care surprinde",
      paragrafe: [
        "Primul plafon e ușor: 57,50 lei pe zi, cât timp nivelul din hotărâre rămâne 23 de lei. Al doilea e cel care se aplică greșit aproape peste tot, fiindcă e formulat ca o limită anuală și funcționează ca una lunară.",
        "Textul: „Plafonul aferent valorii a 3 salarii de bază corespunzătoare locului de muncă ocupat se calculează distinct pentru fiecare lună în parte, prin raportarea celor 3 salarii la numărul de zile lucrătoare din luna respectivă, iar rezultatul se multiplică cu numărul de zile corespunzător fiecărei luni din perioada de delegare”.",
        "Pe un salariu de bază de 6.000 de lei și o lună cu 21 de zile lucrătoare, plafonul e (3 × 6.000) ÷ 21 = 857,14 lei pe zi de delegare. Mult peste cei 57,50, deci în cazul obișnuit nu se simte. Devine limitativ exact acolo unde diurna e generoasă și salariul de bază e mic — o combinație des întâlnită în transport și în construcții, unde diurna a fost folosită ani la rând ca parte din remunerație.",
        "Consecința de calendar: o delegare de 28 martie – 4 aprilie nu are un plafon, ci două, fiindcă fiecare lună își are propriile zile lucrătoare și propriile zile de delegare.",
      ],
    },
    {
      titlu: "Cele 60 de zile și acordul care nu e formalitate",
      paragrafe: [
        "Delegarea poate fi dispusă unilateral pentru cel mult 60 de zile calendaristice în 12 luni. După ele, prelungirea e posibilă doar cu acordul salariatului — iar art. 44 alin. (1) adaugă o propoziție pe care puține regulamente interne o reproduc: refuzul prelungirii nu poate constitui motiv pentru sancționarea disciplinară.",
        "Cele 60 de zile se numără calendaristic, nu în zile lucrătoare, și pe o fereastră de 12 luni, nu pe an calendaristic. Pentru o firmă care trimite aceiași oameni în deplasare des, fereastra mobilă e partea greu de ținut minte — și singurul motiv bun pentru care perioadele de deplasare trebuie să stea într-o evidență, nu în e-mailuri.",
        "Detașarea are alt regim și altă durată: cel mult un an, prelungibilă din 6 în 6 luni, cu refuz posibil numai în mod excepțional și pentru motive personale temeinice. Diferența practică e că la detașare se schimbă angajatorul care acordă drepturile, nu doar locul unde se lucrează.",
      ],
    },
  ],

  nesigur: [
    {
      intrebare: "Cei 23 de lei sunt încă valoarea de azi?",
      raspuns:
        "Sunt valoarea din anexa la HG 714/2018, pusă acolo de Ordinul 1.235/2023, în vigoare din 1 aprilie 2023 — ultima consolidare pe care portalul o listează la data verificării acestei pagini. Mecanismul de actualizare e scris chiar în hotărâre, la art. 2: când indicele prețurilor de consum se modifică cu peste 10%, Ministerul Finanțelor POATE actualiza cuantumurile, prin ordin. Deci se schimbă prin ordin de ministru, nu prin modificarea hotărârii, nu la date previzibile și nu obligatoriu — iar plafonul de 57,50 lei se mută odată cu el, fără nicio atingere a Codului fiscal. Verificați valoarea înainte de a o folosi într-un calcul real.",
    },
    {
      intrebare: "Cât e diurna externă pentru o anumită țară?",
      raspuns:
        "Valorile sunt stabilite pe țări prin hotărâre de guvern și se modifică independent de Codul fiscal. Nu le reproducem: o listă de peste o sută de sume, copiată o dată, e garantat greșită peste un an, iar cine o citește n-are cum să-și dea seama când a îmbătrânit.",
    },
    {
      intrebare: "Cum se tratează „diurna” șoferilor?",
      raspuns:
        "Art. 76 alin. (2) lit. k) menționează expres prestațiile suplimentare ale lucrătorilor mobili din HG 38/2008, deci acelea intră în aceeași regulă de plafonare. Ce se întâmplă când transportatorul plătește sume pe alt temei contractual, sub alt nume, e o discuție de încadrare pe care n-o putem tranșa într-o pagină generală.",
    },
    {
      intrebare: "Detașarea transnațională intră aici?",
      raspuns:
        "Nu. Indemnizația specifică detașării transnaționale e menționată în aceeași literă din Codul fiscal, dar regimul ei de muncă e dat de Legea 16/2017, cu reguli proprii despre salariul minim aplicabil în statul gazdă. Pagina asta nu-l acoperă.",
    },
  ],

  legaturaSecundara: { eticheta: "Ce se cere la un control ITM", href: "/ghid/control-itm" },

  legaturiConexe: [
    { eticheta: "Modulul Deplasări și diurne", href: "/module/diurna" },
    { eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },
    { eticheta: "Evidența orelor de muncă: art. 119", href: "/evidenta-orelor-de-munca" },
  ],

  surse: [
    {
      eticheta: "Codul muncii, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/128647",
    },
    {
      eticheta: "Codul fiscal, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/171282",
    },
    {
      eticheta: "HG 714/2018, forma consolidată",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/205001",
    },
  ],

  actualizat: "septembrie 2026",
  actualizatIso: "2026-09-18",
  publicatIso: "2026-09-18",
};
