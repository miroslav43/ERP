/**
 * Conținutul propriu al paginii `/pentru-contabili`.
 *
 * ── DE CE EXISTĂ PAGINA ───────────────────────────────────────────────────
 * Auditul SEO din 18 sept 2026 a măsurat persona „contabil” la 41/100: tot
 * situl vorbește cu administratorul firmei, deși contabilul e cel care decide
 * ce program folosește clientul în jumătate din cazuri. Nu e o pagină de
 * marketing pentru un public nou, e pagina care spune ce se întâmplă cu un
 * utilizator care are ZECE firme, nu una.
 *
 * ── FIECARE AFIRMAȚIE ARE CORESPONDENT ÎN COD ─────────────────────────────
 *   · apartenențe multiple: `organization_members`, plus
 *     `listUserOrganizations()` din `src/lib/queries/organizations.ts`;
 *   · comutarea fără delogare: `comutaOrganizatiaDirect` din
 *     `(app)/actions.ts`, meniul din `components/layout/meniu-cont.tsx:121`
 *     (apare doar la mai mult de o firmă) și paleta de comenzi;
 *   · rolul `hr`: `0002_authz.sql:1195-1204` — `employees:read = all`,
 *     `payroll = all` cu `export`, `audit = none`, niciun `users:*`;
 *   · livrabilele: rutele din `src/app/api/export/salarizare/`, cu porțile
 *     scrise în antetul fiecăreia;
 *   · nota contabilă se refuză dezechilibrată: `nota/route.ts`, comentariul de
 *     sus și răspunsul 409;
 *   · D112 nu se depune din aplicație: `d112/route.ts`, același antet;
 *   · prețul pe firmă: `preturi.ts`, `PACHETE` — cinci pachete, niciun tarif de
 *     cabinet. Dacă apare unul, rândul din `CE_NU_FACE` trebuie schimbat.
 */

export type SectiuneContabili = Readonly<{
  supratitlu: string;
  titlu: string;
  lead?: string;
  pasi: readonly Readonly<{ titlu: string; text: string }>[];
}>;

export const CONTUL_TAU: SectiuneContabili = {
  supratitlu: "Cum arată contul",
  titlu: "Un singur cont, cu o apartenență în fiecare firmă",
  lead: "Nu e un cont pe client, cu zece parole de ținut minte. E același cont, cu o apartenență distinctă în fiecare firmă — iar rolul poate fi diferit de la una la alta.",
  pasi: [
    {
      titlu: "Accesul ți-l dă administratorul fiecărei firme",
      text: "Nu te poți adăuga singur nicăieri, și nici clientul nu te poate muta dintr-o firmă în alta: fiecare acces e o invitație separată, dată de administratorul firmei respective, cu un rol ales de el. Când un client pleacă, îți scoate accesul la firma lui și atât — restul firmelor tale nu se schimbă. Asta înseamnă și că un cabinet nu are un buton prin care să-și adauge un client nou; drumul trece prin firmă, deliberat, fiindcă datele sunt ale ei.",
    },
    {
      titlu: "Comuți dintr-un meniu, fără să te deloghezi",
      text: "Meniul de comutare apare în bara de sus abia când ai mai mult de o firmă — pentru un utilizator obișnuit nici nu există. Aceeași listă e și în paleta de comenzi, la Ctrl+K, dacă preferi tastatura. Comutarea e o singură apăsare: nu se reîncarcă sesiunea, nu ți se cere parola din nou, nu pierzi pagina pe care erai. Aplicația ține minte firma pe care ai lăsat-o ultima dată și te duce direct acolo; lista întreagă îți apare la prima intrare și atunci când firma reținută nu mai e disponibilă — ți s-a scos accesul, de pildă —, ca să nu ajungi pe un ecran gol fără să înțelegi de ce.",
    },
    {
      titlu: "Rolul obișnuit pentru un contabil e „Resurse umane”",
      text: "El vede tot ce ține de oameni și de bani — fișele de personal complete, inclusiv datele sensibile de care are nevoie declarația, pontajul pe toată firma, concediile, salarizarea — și are drept de export pe fiecare dintre ele. Ce nu are e orice drept asupra utilizatorilor: nu poate invita pe cineva, nu poate schimba rolul nimănui, nu poate scoate pe nimeni. Separarea e voită, iar motivul se vede cel mai bine dintr-un cabinet: cine ține evidența nu e cine decide cine are acces la ea. Administratorul firmei rămâne singurul care distribuie chei, inclusiv cheia ta. Rolul se alege oricum per firmă, nu o dată pentru totdeauna — poți fi „Resurse umane” la nouă clienți și administrator la al zecelea, dacă acela ți-a dat firma pe mână cu totul.",
    },
    {
      titlu: "Ce NU vede rolul acesta",
      text: "Două lucruri, ca să nu le descoperi la al treilea client. Jurnalul de audit e închis pentru „Resurse umane”: cine a modificat ce și când se vede doar din contul de administrator. Iar ecranul de conformitate — documentele care expiră, pe toată firma — îi întoarce zero rânduri, fără mesaj de eroare, fiindcă permisiunea lipsește. Dacă ai nevoie de oricare dintre ele, cere-i administratorului rolul de administrator în firma lui; nu e o limitare tehnică, e o alegere care se poate schimba per firmă.",
    },
    {
      titlu: "Firmele nu se amestecă, iar asta n-o garantează aplicația",
      text: "Separarea între firmele-client e făcută în baza de date, prin politici care filtrează fiecare interogare după firma din sesiune, nu prin condiții scrise în codul aplicației. Diferența contează exact în cazul care te-ar costa: dacă o pagină ar uita un filtru, baza tot n-ar întoarce rândurile altei firme, fiindcă filtrul nu e al paginii. Aceleași politici se aplică și exporturilor, și rapoartelor, și căutării globale — nu există o cale ocolită prin care un client să apară în lista altuia. Practic, asta înseamnă că fișierul pe care îl descarci poartă întotdeauna firma pe care o ai deschisă în acel moment: nu poți genera din greșeală declarația clientului A cât timp ești comutat pe B, fiindcă datele lui A pur și simplu nu există pentru sesiunea aceea.",
    },
  ],
};

export const CE_PRIMESTI: SectiuneContabili = {
  supratitlu: "Ce pleacă spre tine",
  titlu: "Cinci fișiere, generate din aceleași date",
  lead: "Primele patru pornesc dintr-o perioadă de salarizare aprobată sau închisă; dintr-o ciornă nu se generează nimic, fiindcă cifrele se mai schimbă până la aprobare. Toate cinci primesc un număr de registru înainte să ajungă la tine — iar dacă registrul nu-l poate aloca, cade și exportul: un document oficial ieșit din firmă fără număr e exact ce interzice Ordinul 217/1996.",
  pasi: [
    {
      titlu: "Nota contabilă, în CSV",
      text: "Se generează doar dacă debitul egalează creditul. Dacă nu, aplicația îți întoarce cifrele și refuză fișierul, în loc să-ți dea o notă dezechilibrată pe care ai descoperi-o peste o săptămână, la înregistrare — când deja nu mai știi din ce lună venea diferența. Conturile nu sunt scrise în codul aplicației: codurile generale sunt aceleași pentru orice firmă, dar analiticele nu se pot presupune, așa că se iau din setările firmei. Prima lună cere deci o trecere prin ele împreună cu clientul, o singură dată; de la a doua, fișierul iese direct. Maparea e una singură pe firmă, nu una pe perioadă: dacă schimbi un analitic în iunie și regenerezi nota lui martie, ea iese cu conturile de azi, nu cu cele de atunci. Fișierul deja descărcat și înregistrat rămâne cum a fost — dar merită știut înainte de a regenera ceva vechi.",
    },
    {
      titlu: "Declarația 112, în XML",
      text: "Se generează pentru portalul ANAF, dar NU se depune din aplicație și nu există nicio legătură cu ANAF. Tu o validezi cu DUKIntegrator, o semnezi electronic și o încarci pe e-Guvernare, exact ca până acum. Ce se scutește e tastarea a câteva sute de cifre, nu validarea oficială. Când o validare blocantă găsește ceva, aplicația îți întoarce lista problemelor, nu un XML incomplet — un fișier respins după depunere costă mai mult decât unul care nu s-a generat. Fiind evidența nominală a asiguraților, generarea scoate în clar CNP-ul fiecărui angajat, deci cere drepturi mai mari decât celelalte exporturi și lasă un rând de audit la fiecare apel. E a doua operațiune din aplicație care face asta; prima e fișierul bancar.",
    },
    {
      titlu: "Statul de plată, în PDF",
      text: "Documentul central al lunii, în forma în care se semnează și se arhivează: per salariat, zilele lucrate, brutul, contribuțiile, impozitul, netul și restul de plată, cu totaluri pe firmă la final. Nu e o listă de control pe care s-o reformatezi tu, e livrabilul. Spre deosebire de fișierul bancar și de declarație, statul nu scoate în clar niciun IBAN și niciun CNP, deci nu cere drepturile suplimentare pe date sensibile — cere doar dreptul de export pe salarizare și o perioadă care a ieșit din ciornă. Un stat de plată generat dintr-o ciornă ar fi un document oficial peste cifre care se mai pot schimba.",
    },
    {
      titlu: "Fișierul bancar, în format SEPA",
      text: "Plătește restul de plată, nu netul: scade avantajele primite în natură și adaugă sumele neimpozabile, adică exact diferența pe care o descoperi altfel când banca refuză un ordin sau când un angajat întreabă de ce a primit mai puțin decât scrie pe fluturaș. Generarea lui decriptează IBAN-ul fiecărui angajat și lasă câte un rând de audit pentru fiecare apel — o operațiune care se vede în jurnal, nu una tăcută. Fișierul se încarcă manual în internet banking, de cine are dreptul să plătească; aplicația nu se leagă la nicio bancă.",
    },
    {
      titlu: "Foaia colectivă de prezență, în XLSX",
      text: "Luna de pontaj, o dată arhivată, se descarcă întreagă ca fișier de calcul. E ce ceri când clientul te sună că are control și nu găsește foile, și e și ce te scutește pe tine să reconstitui orele dintr-un e-mail cu o poză. Descărcarea cere dreptul de export pe pontaj la nivel de firmă — îl au administratorul și rolul „Resurse umane”, deci și tu, dacă ai primit rolul obișnuit. Aceeași cheie o cere și politica din baza de date, nu doar ecranul: verificarea din aplicație o dublează ca să primești un refuz explicit, nu o pagină goală.",
    },
  ],
};

/**
 * Ultima secțiune, adăugată pe 18 sept 2026 după măsurătoarea de experiență a
 * căutării.
 *
 * ── DE CE ────────────────────────────────────────────────────────────────
 * Pagina a urcat persona „contabil” de la 41 la 64 din 100, dar rămâne
 * plafonată de o singură celulă: încrederea, 10 din 25 — cea mai mică din tot
 * tabelul, pe toate cele patru persoane. Motivul e vizibil și onest: produsul
 * n-are încă clienți de arătat.
 *
 * Fraza care rezolvă exact obiecția asta EXISTĂ deja, dar numai pe pagina de
 * start. Contabilul care citește aici e cel care riscă cel mai mult — își pune
 * numele în fața clientului — și tocmai el n-o vedea. Nu e conținut nou, e
 * același fapt, pus unde e nevoie de el.
 */
export const INAINTE_SA_RECOMANZI: SectiuneContabili = {
  supratitlu: "Înainte să recomanzi",
  titlu: "Ce riști tu când ne recomanzi unui client",
  pasi: [
    {
      titlu: "Suntem la început, și o spunem aici, nu la a treia discuție",
      text: "Nu punem testimoniale scrise de noi și nu punem logo-uri de firme care nu ne folosesc. Primii clienți sunt în implementare. Dacă vrei să vorbești cu unul dintre ei înainte să pui o vorbă bună, îți facem legătura la telefon — nu un caz de studiu scris de noi, ci un om care ține aceleași evidențe ca tine. Pentru un contabil asta contează mai mult decât pentru oricine altcineva: clientul îți reproșează ție alegerea, nu nouă, iar noi știm asta.",
    },
    {
      titlu: "Ce se întâmplă cu datele dacă renunță clientul",
      text: "Contractul se încetează cu un preaviz de treizeci de zile, fără penalități, iar o suspendare pentru o factură neachitată nu șterge datele — scrie în termeni, nu doar aici. Cele cinci fișiere de mai sus se descarcă oricând, nu la ieșire, deci evidența pe care ai lucrat o ai deja la tine lună de lună. Partea pe care o spunem pe față: un buton de export complet al contului, pe care să-l apeși singur, NU există încă; la încetare exportul îl facem noi, în format deschis. Dacă vrei să vezi exact ce iese, cere o demonstrație și descarcă-le înainte să decizi.",
    },
  ],
};

export const CE_NU_FACE: SectiuneContabili = {
  supratitlu: "Limitele",
  titlu: "Ce nu face aplicația, ca să nu afli la al doilea client",
  lead: "Sunt lucrurile pe care le-ar presupune oricine venind dinspre un program de contabilitate. Niciunul nu e pe foaia de parcurs pentru anul acesta.",
  pasi: [
    {
      titlu: "Nu depune nimic nicăieri",
      text: "Nu comunică cu ANAF, nu semnează, nu încarcă. Produce fișierele; depunerea rămâne integral la tine.",
    },
    {
      titlu: "Nu ține contabilitate",
      text: "Fără registre contabile, fără facturi, fără bilanț. Se oprește la nota contabilă de salarii, pe care o importi în programul tău.",
    },
    {
      titlu: "Nu execută plăți",
      text: "Nu se leagă la bancă. Fișierul SEPA se încarcă manual, în internet banking, de cine are dreptul să plătească.",
    },
    {
      titlu: "Valorile legale se confirmă de tine",
      text: "Plafoanele și cotele implicite sunt un punct de pornire, nu o sursă de adevăr. Se trec o dată prin mâna contabilului, înainte de primul calcul real — și se versionează cu data de la care se aplică, deci lunile deja calculate nu se recalculează din greșeală.",
    },
    {
      titlu: "Prețul rămâne pe firmă",
      text: "Nu există un tarif de cabinet și nici o reducere pentru mai multe firme. Abonamentul se plătește per firmă-client, de firmă, ca oricare altul. Dacă ții multe firme mici și cifra nu-ți iese, spune-ne — dar nu găsești un preț ascuns pe undeva.",
    },
  ],
};
