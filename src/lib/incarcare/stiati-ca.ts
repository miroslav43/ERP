// src/lib/incarcare/stiati-ca.ts

/**
 * Ce citește omul cât așteaptă.
 *
 * Regula care contează, și singura greu de respectat: FIECARE mesaj de aici e
 * adevărat despre ACEASTĂ aplicație, iar comentariul de după fiecare spune în ce
 * fișier se verifică. Un mesaj inventat despre propriul produs e mai rău decât
 * un ecran gol — omul îl citește, îl crede, caută funcția și n-o găsește.
 *
 * Când ștergeți sau schimbați funcția din dreptul unui mesaj, ștergeți mesajul.
 *
 * Constrângeri, apărate de `stiati-ca.test.ts`:
 *   · maximum 120 de caractere — peste atât nu se citește într-o așteptare;
 *   · ș și ț cu VIRGULĂ dedesubt (U+0219/U+021B), niciodată cu sedilă;
 *   · fără semne de exclamare — e o aplicație de resurse umane, nu o reclamă;
 *   · fără duplicate.
 *
 * Modulul e încărcat DINAMIC de `panou-incarcare.tsx`, abia când voalul ajunge
 * la faza de mesaj. Pe paginile de marketing nu se descarcă niciodată.
 */

export type MesajIncarcare = Readonly<{
  readonly text: string;
  readonly categorie: string;
}>;

export const MESAJE: readonly MesajIncarcare[] = [
  // ── Navigare și scurtături ────────────────────────────────────────────
  // src/components/layout/command-palette.tsx:128
  {
    text: "Ctrl+K (sau Cmd+K) deschide paleta de comenzi și caută în tot meniul la care aveți acces.",
    categorie: "Navigare și scurtături",
  },
  // src/components/layout/command-palette.tsx:183-193
  {
    text: "În paletă, săgețile aleg rândul, Enter deschide, iar Escape închide fereastra.",
    categorie: "Navigare și scurtături",
  },
  // src/lib/text/diacritice.ts
  {
    text: "Căutarea ignoră diacriticele: „stanescu” găsește „Stănescu”, iar numele scrise cu sedilă se potrivesc la fel.",
    categorie: "Navigare și scurtături",
  },
  // src/components/layout/command-palette.tsx:60-70
  {
    text: "Dacă lucrați în mai multe firme, paleta de comenzi le listează și comută direct între ele.",
    categorie: "Navigare și scurtături",
  },
  // src/components/layout/meniu-cont.tsx:110-135
  {
    text: "Comutarea firmei stă în meniul de cont din dreapta sus, unde e o alegere rară, nu în bara principală.",
    categorie: "Navigare și scurtături",
  },
  // src/components/layout/sidebar.tsx (COOKIE_SIDEBAR)
  {
    text: "Bara laterală se poate strânge, iar starea se ține într-un cookie și supraviețuiește reîncărcării.",
    categorie: "Navigare și scurtături",
  },
  // src/components/layout/sidebar.tsx:44-55
  {
    text: "Pe telefon, tasta Escape închide sertarul de meniu al aplicației mari.",
    categorie: "Navigare și scurtături",
  },
  // src/config/navigation.ts (antet)
  {
    text: "Meniul ascunde ce nu vă e permis, dar ascunderea nu e o barieră: pagina și acțiunea refuză separat.",
    categorie: "Navigare și scurtături",
  },
  // src/components/ui/tabel.tsx
  {
    text: "Sortarea unui tabel e un link, nu un buton: ordinea intră în adresă și poate fi trimisă mai departe.",
    categorie: "Navigare și scurtături",
  },
  // src/components/ui/bara-filtre.tsx
  {
    text: "Filtrele active apar ca pastile, fiecare cu ștergerea lui, ca o listă filtrată să nu pară una goală.",
    categorie: "Navigare și scurtături",
  },
  // src/lib/queries/cursor.ts, src/components/ui/paginare.tsx
  {
    text: "Paginarea e keyset, nu offset: niciun rând nu se repetă și niciunul nu se sare între pagini.",
    categorie: "Navigare și scurtături",
  },

  // ── Angajați și date de personal ──────────────────────────────────────
  // src/domain/employee/cnp.ts
  {
    text: "CNP-ul e verificat cu cifra de control și cu ponderile oficiale înainte de salvare.",
    categorie: "Angajați și date de personal",
  },
  // src/domain/employee/iban.ts
  {
    text: "IBAN-ul trece prin regula mod-97 din ISO 13616, nu doar printr-o verificare de lungime.",
    categorie: "Angajați și date de personal",
  },
  // src/domain/import/mapare.ts
  {
    text: "Importul din Excel recunoaște antetul scris oricum: „Data nașterii”, „DATA NASTERII” sau „data-nasterii”.",
    categorie: "Angajați și date de personal",
  },
  // src/app/(app)/angajati/import/page.tsx
  {
    text: "La import, un rând greșit nu blochează restul: se aplică rândurile corecte, iar respinsele se descarcă.",
    categorie: "Angajați și date de personal",
  },
  // src/domain/import/validare.ts
  {
    text: "Validarea de import adună toate erorile unui rând, nu se oprește la prima dintre ele.",
    categorie: "Angajați și date de personal",
  },
  // src/domain/import/mapare.ts (camp „marca”)
  {
    text: "Marca poate lipsi din fișierul de import: dacă nu o trimiteți, o atribuie contorul firmei.",
    categorie: "Angajați și date de personal",
  },
  // src/domain/hr/cor-nomenclator.ts
  {
    text: "Codul COR se alege dintr-un nomenclator de peste 4400 de ocupații, nu se tastează liber.",
    categorie: "Angajați și date de personal",
  },
  // src/app/(app)/organigrama/page.tsx, src/config/navigation.ts (id: organigrama)
  {
    text: "Organigrama e vizibilă și cu drepturi de nivel „own”: fiecare își vede propria ramură.",
    categorie: "Angajați și date de personal",
  },

  // ── Concedii ──────────────────────────────────────────────────────────
  // docs/project-overview.md §3
  {
    text: "Sunt unsprezece tipuri statutare de concediu, cu sold ținut pe fiecare angajat și pe fiecare an.",
    categorie: "Concedii",
  },
  // src/domain/calendar/paste-ortodox.ts
  {
    text: "Sărbătorile mobile se calculează din Paștele ortodox, nu din cel catolic.",
    categorie: "Concedii",
  },
  // src/domain/calendar/sarbatori.ts
  {
    text: "Vinerea Mare, Paștele, a doua zi de Paște și Rusaliile sunt derivate automat, an de an.",
    categorie: "Concedii",
  },
  // src/domain/leave/zile-cerere.ts
  {
    text: "O cerere poate începe sau se poate încheia cu jumătate de zi, iar soldul scade cu 0,5.",
    categorie: "Concedii",
  },
  // src/domain/leave/zile-cerere.ts
  {
    text: "Zilele de recuperare declarate de firmă sunt lucrătoare chiar și când cad sâmbăta.",
    categorie: "Concedii",
  },
  // src/domain/leave/zile-cerere.ts
  {
    text: "Numărul de zile consumate se vede în formular, înainte de trimitere, fără drum la server.",
    categorie: "Concedii",
  },
  // src/domain/leave/sold.ts
  {
    text: "Rotunjirea acumulării proporționale e configurabilă: legea fixează minimul anual, nu rotunjirea.",
    categorie: "Concedii",
  },
  // src/domain/leave/contrast.ts
  {
    text: "Culoarea unui tip de concediu e verificată la contrast 4,5:1 înainte să ajungă fundal în calendar.",
    categorie: "Concedii",
  },
  // src/app/(app)/concedii/echipa/page.tsx
  {
    text: "„Echipa” arată cererile subalternilor fără ale dumneavoastră; „Cereri” rămâne lista proprie.",
    categorie: "Concedii",
  },

  // ── Pontaj ────────────────────────────────────────────────────────────
  // src/domain/attendance/calcul-ore.ts
  {
    text: "Orele lucrate se deduc din intervalul orar introdus, ca sugestie editabilă, nu ca valoare finală.",
    categorie: "Pontaj",
  },
  // src/domain/attendance/calcul-ore.ts
  {
    text: "Orele de noapte se calculează din intervalul nocturn al firmei, care poate trece peste miezul nopții.",
    categorie: "Pontaj",
  },
  // src/domain/attendance/calcul-ore.ts
  {
    text: "Un tur peste miezul nopții nu încape într-un singur rând de zi, deci se completează manual.",
    categorie: "Pontaj",
  },
  // src/domain/attendance/saptamana.ts (lunieaUrmatoare)
  {
    text: "Planul de prezență se declară în avans: ecranul deschide implicit lunea săptămânii următoare.",
    categorie: "Pontaj",
  },
  // src/domain/payroll/calc.ts
  {
    text: "Sporurile se iau pe axa cea mai mare — zi, repaus săptămânal sau sărbătoare — nu prin însumare.",
    categorie: "Pontaj",
  },
  // docs/project-overview.md §4
  {
    text: "Pontajul săptămânal folosește același motor de aprobare ca cererile de concediu.",
    categorie: "Pontaj",
  },
  // src/app/(app)/pontaj/perioade/page.tsx
  {
    text: "Perioadele de pontaj se închid pe lună, iar starea fiecăreia se vede în listă.",
    categorie: "Pontaj",
  },

  // ── Salarizare ────────────────────────────────────────────────────────
  // src/domain/payroll/calc.ts, NOTES.md §3
  {
    text: "Nicio cotă nu e scrisă în cod: toate vin din setările de salarizare, cu istoric și dată de aplicare.",
    categorie: "Salarizare",
  },
  // src/domain/payroll/calc.ts
  {
    text: "Norma folosită la calcul e cea din contractul angajatului, nu cea a firmei, deci part-time-ul contează.",
    categorie: "Salarizare",
  },
  // src/app/api/export/salarizare/bancar/route.ts
  {
    text: "Se plătește restul de plată, nu netul: el scade avantajele în natură și adaugă sumele neimpozabile.",
    categorie: "Salarizare",
  },
  // src/domain/payroll/etape/retineri-popriri.ts
  {
    text: "O poprire singură nu poate lua peste o treime din net, iar mai multe, cumulat, peste jumătate.",
    categorie: "Salarizare",
  },
  // src/domain/payroll/etape/retineri-popriri.ts
  {
    text: "Creanțele de întreținere se satisfac înaintea celorlalte popriri.",
    categorie: "Salarizare",
  },
  // src/domain/payroll/etape/retineri-popriri.ts
  {
    text: "Plafonul popririi se calculează pe netul inițial, nu pe cât rămâne după avans.",
    categorie: "Salarizare",
  },
  // src/domain/payroll/etape/retineri-popriri.ts
  {
    text: "Un dosar de poprire cu soldul stins nu mai produce rețineri, oricât ar cere popritorul.",
    categorie: "Salarizare",
  },
  // src/domain/payroll/etape/compensare-ore.ts
  {
    text: "Orele suplimentare deja compensate cu timp liber nu se mai plătesc a doua oară cu spor.",
    categorie: "Salarizare",
  },
  // src/app/api/export/salarizare/nota/route.ts
  {
    text: "Nota contabilă se generează doar dacă debitul egalează creditul; altfel primiți diferența, nu fișierul.",
    categorie: "Salarizare",
  },
  // src/app/api/export/salarizare/stat/route.ts, .../d112/route.ts, .../bancar/route.ts
  {
    text: "Statul, fluturașul, D112 și fișierul bancar se produc doar dintr-o perioadă aprobată sau închisă.",
    categorie: "Salarizare",
  },

  // ── Diurne și deplasări ───────────────────────────────────────────────
  // src/domain/per-diem/ferestre.ts
  {
    text: "Sub pragul minim de ore al politicii, o deplasare nu generează nicio zi de diurnă.",
    categorie: "Diurne și deplasări",
  },
  // src/domain/per-diem/ferestre.test.ts
  {
    text: "O deplasare de 64 de ore dă 1 + 1 + 0,5 zile, nu trei: fereastra incompletă se plătește fracționat.",
    categorie: "Diurne și deplasări",
  },
  // src/domain/per-diem/ferestre.ts (REGULI_TRECERE_FRONTIERA)
  {
    text: "Ziua trecerii frontierei se atribuie după regula aleasă în politică, nu după o convenție fixă.",
    categorie: "Diurne și deplasări",
  },
  // src/app/(app)/diurna/politica/page.tsx, NOTES.md §3
  {
    text: "Baremul pe țări se administrează ca date, în politica firmei, nu scris în cod.",
    categorie: "Diurne și deplasări",
  },
  // src/app/(app)/diurna/[id]/decont/page.tsx, src/app/globals.css:784
  {
    text: "Decontul de deplasare e o pagină tipăribilă: meniul și antetul se ascund automat la tipărire.",
    categorie: "Diurne și deplasări",
  },

  // ── SSM și PSI ────────────────────────────────────────────────────────
  // src/domain/ssm/scadente.ts
  {
    text: "„Niciodată efectuat” e o stare distinctă de „expirat” și mai gravă: nu există nici măcar un istoric.",
    categorie: "SSM și PSI",
  },
  // src/domain/ssm/scadente.ts (PRAG_SSM_AVERTIZARE_ZILE, PRAG_SSM_CRITIC_ZILE)
  {
    text: "Preavizul implicit al scadențelor SSM e de 30 de zile, iar sub 7 zile starea devine critică.",
    categorie: "SSM și PSI",
  },
  // src/domain/ssm/termen-itm.ts
  {
    text: "Termenul de comunicare a unui accident la ITM curge de la producere, nu de la înregistrare.",
    categorie: "SSM și PSI",
  },
  // src/domain/ssm/termen-itm.ts
  {
    text: "Numărătoarea inversă a termenului ITM ține cont de ora de vară sau de iarnă.",
    categorie: "SSM și PSI",
  },
  // NOTES.md §3 (SSM / PSI / ISCIR)
  {
    text: "Instruirea PSI e o obligație separată de cea SSM, cu periodicitatea ei proprie.",
    categorie: "SSM și PSI",
  },
  // NOTES.md §3, src/app/(app)/ssm/stingatoare/page.tsx
  {
    text: "Stingătoarele au scadențe distincte pentru verificare, reîncărcare și proba de presiune.",
    categorie: "SSM și PSI",
  },
  // src/app/(app)/ssm/eip/page.tsx (ConfirmarePrimireEip)
  {
    text: "Primirea echipamentului individual de protecție se confirmă de angajat, din ecranul EIP.",
    categorie: "SSM și PSI",
  },

  // ── Parc auto și mentenanță ───────────────────────────────────────────
  // src/domain/fleet/kilometraj.ts
  {
    text: "Un kilometraj de plecare mai mic decât ultimul cunoscut se blochează: fizic nu se poate.",
    categorie: "Parc auto și mentenanță",
  },
  // src/domain/fleet/kilometraj.ts (PRAG_SALT_KM_IMPLICIT)
  {
    text: "Un salt de peste 1500 km față de ultima foaie nu blochează, ci se semnalează ca posibilă foaie lipsă.",
    categorie: "Parc auto și mentenanță",
  },
  // src/app/(app)/flota/anomalii/page.tsx
  {
    text: "Anomaliile de kilometraj au ecran propriu, iar lista goală înseamnă că totul e continuu.",
    categorie: "Parc auto și mentenanță",
  },
  // src/domain/fleet/consum.ts
  {
    text: "Consumul la 100 km nu se afișează pentru o cursă deschisă sau fără alimentare: gol nu e zero.",
    categorie: "Parc auto și mentenanță",
  },
  // src/domain/fleet/consum.ts
  {
    text: "Consumul se evidențiază abia peste 15% abatere: sub prag, variația sezonieră e normală.",
    categorie: "Parc auto și mentenanță",
  },
  // src/app/(app)/mentenanta/sesizari/noua/page.tsx
  {
    text: "Codul QR lipit pe utilaj deschide direct sesizarea, cu echipamentul deja completat.",
    categorie: "Parc auto și mentenanță",
  },
  // src/app/(app)/mentenanta/sesizari/noua/formular-sesizare.tsx:139
  {
    text: "Dacă autocolantul QR e deteriorat, formularul o spune și vă lasă să căutați echipamentul după cod.",
    categorie: "Parc auto și mentenanță",
  },

  // ── Inventar ──────────────────────────────────────────────────────────
  // src/app/(app)/inventar/in-primire/page.tsx
  {
    text: "„Ce am în primire” e ecranul din care angajatul își confirmă bunurile primite.",
    categorie: "Inventar",
  },
  // src/app/(app)/inventar/[id]/pv/[alocare]/page.tsx
  {
    text: "Procesul-verbal de predare-primire se generează din alocare, ca pagină tipăribilă.",
    categorie: "Inventar",
  },
  // src/app/(app)/inventar/[id]/pv/[alocare]/page.tsx
  {
    text: "Procesul-verbal nu se arhivează ca fișier: se regenerează din date, ca să nu rămână în urma corecturilor.",
    categorie: "Inventar",
  },
  // src/app/(app)/inventar/[id]/pv/[alocare]/page.tsx
  {
    text: "Câmpul de document al alocării rămâne rezervat scanului semnat, nu exemplarului nesemnat.",
    categorie: "Inventar",
  },

  // ── Cursuri ───────────────────────────────────────────────────────────
  // src/app/api/materiale/[versiuneId]/route.ts
  {
    text: "Materialele de curs se livrează prin aplicație, nu prin linkuri semnate care pot fi partajate.",
    categorie: "Cursuri",
  },
  // src/app/api/materiale/[versiuneId]/route.ts
  {
    text: "Filmele de curs se pot derula: livrarea acceptă cereri parțiale și nu expiră la mijlocul redării.",
    categorie: "Cursuri",
  },
  // src/domain/cursuri/scadente.ts (esteFinalizabila)
  {
    text: "Butonul de finalizare apare doar când condiția e îndeplinită, iar când nu e, ecranul spune motivul.",
    categorie: "Cursuri",
  },
  // src/app/(portal)/portal/cursurile-mele/[id]/adeverinta/route.ts
  {
    text: "Adeverința de curs se scrie la finalizare și rămâne neschimbată dacă materialul se modifică ulterior.",
    categorie: "Cursuri",
  },
  // src/config/navigation.ts (children: cursuri-biblioteca, cursuri-conformitate)
  {
    text: "Biblioteca de materiale și ecranul de conformitate au intrări proprii în meniu, sub „Cursuri”.",
    categorie: "Cursuri",
  },
  // src/app/(app)/cursuri/conformitate/page.tsx, src/domain/cursuri/scadente.ts
  {
    text: "Sub 25 de angajați, conformitatea se arată în cifre absolute: un procent pe opt oameni induce în eroare.",
    categorie: "Cursuri",
  },

  // ── Integrare angajați și evaluări ────────────────────────────────────
  // src/app/(app)/onboarding/[id]/dovada/page.tsx
  {
    text: "Parcurgerea unui checklist de integrare produce o dovadă tipăribilă, cu pașii și momentul fiecăruia.",
    categorie: "Integrare angajați și evaluări",
  },
  // src/config/permissions.ts (checklists:update / checklists:approve)
  {
    text: "Bifarea pașilor și închiderea parcursului sunt drepturi diferite: unul e „update”, celălalt „approve”.",
    categorie: "Integrare angajați și evaluări",
  },
  // src/domain/evaluations/scor.ts
  {
    text: "Un criteriu de evaluare nenotat rămâne gol, nu devine zero, și iese din numitorul procentului.",
    categorie: "Integrare angajați și evaluări",
  },
  // src/domain/evaluations/scor.ts
  {
    text: "Cu ponderi sau fără, procentul unei evaluări se citește la fel: punctaj raportat la maximul posibil.",
    categorie: "Integrare angajați și evaluări",
  },
  // src/config/permissions.ts (evaluations:create)
  {
    text: "Evaluările pot fi create de managerul direct, nu doar de administrator, prin chei proprii de permisiune.",
    categorie: "Integrare angajați și evaluări",
  },

  // ── REGES-Online ──────────────────────────────────────────────────────
  // docs/reges-online.md
  {
    text: "De la 1 ianuarie 2026, REGES-Online a înlocuit Revisal, iar transmiterea se face prin API.",
    categorie: "REGES-Online",
  },
  // docs/reges-online.md §1
  {
    text: "Fiecare firmă are propriile chei REGES; nu există o cheie comună a aplicației.",
    categorie: "REGES-Online",
  },
  // docs/reges-online.md §2
  {
    text: "Transmiterea nu pornește dacă testul de conexiune a eșuat: o coadă spre chei greșite se umple de erori.",
    categorie: "REGES-Online",
  },
  // docs/reges-online.md §3
  {
    text: "Fișele de salariat se transmit cu buton, manual: conțin CNP, iar decriptarea se auditează pe operator.",
    categorie: "REGES-Online",
  },
  // docs/reges-online.md §3
  {
    text: "O angajare nouă produce două mesaje: întâi salariatul, apoi contractul, care așteaptă identificatorul.",
    categorie: "REGES-Online",
  },
  // docs/reges-online.md §5, src/app/(app)/reges/propuneri/page.tsx
  {
    text: "O detașare nu se transmite direct: se propune, iar angajatorul destinație acceptă sau respinge.",
    categorie: "REGES-Online",
  },

  // ── Documente, exporturi și tipărire ──────────────────────────────────
  // src/lib/documents/generator.ts, docs/project-overview.md §4
  {
    text: "Documentele generate primesc număr pe serie, checksum SHA-256 și cod de verificare.",
    categorie: "Documente, exporturi și tipărire",
  },
  // src/lib/documents/generator.ts
  {
    text: "Valorile puse în șabloane se escapează automat: un text cu marcaj rămâne text, nu devine cod.",
    categorie: "Documente, exporturi și tipărire",
  },
  // src/app/api/export/audit/route.ts, src/app/api/export/salarizare/nota/route.ts
  {
    text: "Exporturile CSV prefixează celulele care încep cu „=”, „+”, „-” sau „@”, ca Excel să nu le ia drept formule.",
    categorie: "Documente, exporturi și tipărire",
  },
  // src/app/api/export/salarizare/d112/route.ts
  {
    text: "D112 se generează ca XML pentru ANAF, dar se validează și se semnează în DUKIntegrator, nu aici.",
    categorie: "Documente, exporturi și tipărire",
  },
  // src/app/api/export/salarizare/d112/route.ts
  {
    text: "Când validările blocante găsesc ceva, D112 nu se produce parțial: primiți lista problemelor.",
    categorie: "Documente, exporturi și tipărire",
  },

  // ── Securitate și confidențialitate ───────────────────────────────────
  // docs/project-overview.md §4, NOTES.md §2
  {
    text: "Separarea între firme se face în baza de date, prin politici RLS forțate, nu prin filtre de aplicație.",
    categorie: "Securitate și confidențialitate",
  },
  // NOTES.md §2
  {
    text: "Cookie-ul firmei active e doar un indiciu: falsificat, produce zero rânduri, nu acces.",
    categorie: "Securitate și confidențialitate",
  },
  // docs/project-overview.md §4, src/app/api/export/salarizare/bancar/route.ts
  {
    text: "CNP-ul și IBAN-ul se citesc doar printr-o funcție dedicată, care scrie audit la fiecare apel.",
    categorie: "Securitate și confidențialitate",
  },
  // src/app/api/export/salarizare/bancar/route.ts, .../d112/route.ts
  {
    text: "Fișierul bancar și D112 cer trei drepturi separate, fiindcă decriptează datele tuturor deodată.",
    categorie: "Securitate și confidențialitate",
  },
  // docs/reges-online.md §5
  {
    text: "Salariatul dintr-o propunere de detașare primită apare doar cu ultimele patru cifre de CNP.",
    categorie: "Securitate și confidențialitate",
  },
  // docs/reges-online.md §6
  {
    text: "Jurnalul apelurilor REGES păstrează metoda, statusul și durata, niciodată corpurile cererilor.",
    categorie: "Securitate și confidențialitate",
  },

  // ── Portalul angajatului ──────────────────────────────────────────────
  // src/config/navigation.ts (PORTAL_NAV_ITEMS), src/app/(portal)/_components/bara-portal.tsx
  {
    text: "Portalul are meniu propriu, scris la persoana întâi, și o bară fixă jos, la îndemâna degetului mare.",
    categorie: "Portalul angajatului",
  },
  // src/app/api/export/salarizare/fluturas/route.ts
  {
    text: "Angajatul își descarcă propriul fluturaș din portal, fără să aibă dreptul de a exporta salarii.",
    categorie: "Portalul angajatului",
  },
  // src/config/navigation.ts (prioritateBara)
  {
    text: "Cele patru locuri din bara portalului se umplu după prioritate, ca să nu rămână goale la module stinse.",
    categorie: "Portalul angajatului",
  },
  // src/components/layout/raporteaza-problema.tsx
  {
    text: "O problemă se raportează din subsolul oricărui ecran, cu modulul curent completat automat.",
    categorie: "Portalul angajatului",
  },
];

/**
 * Un mesaj la întâmplare, altul decât cel dinainte.
 *
 * `exclus` există fiindcă rotația la 6,5 s poate pica de două ori pe același
 * mesaj, iar utilizatorul citește asta ca „s-a blocat", nu ca noroc.
 */
export function mesajAleator(exclus?: string): MesajIncarcare {
  const candidati = exclus === undefined ? MESAJE : MESAJE.filter((m) => m.text !== exclus);
  const lista = candidati.length > 0 ? candidati : MESAJE;
  return lista[Math.floor(Math.random() * lista.length)] as MesajIncarcare;
}
