import { ADRESA_FIRMA, CONTACT, FIRMA } from "@/content/landing/contact";

/**
 * Termenii și condițiile.
 *
 * ── CE E DOCUMENTUL ĂSTA, ȘI CE NU E ──────────────────────────────────────
 * E o REDACTARE COMPLETĂ, nu un schelet: fiecare secțiune spune ce se întâmplă
 * de fapt, verificat în cod și în infrastructură. Ce nu e: un text validat de
 * un jurist. Diferența e scrisă pe pagină, deasupra, nu ascunsă într-o notă de
 * subsol — vezi `AVERTISMENT`.
 *
 * ── DE CE NU E COPIAT DE LA CONCURENȚĂ ────────────────────────────────────
 * Structura urmează tiparul obișnuit al unui contract SaaS românesc (părți,
 * obiect, preț, durată, răspundere, anexă GDPR). Ce NU se copiază sunt trei
 * obiceiuri comune care fac documentul mai slab:
 *
 *   1. CIFRA DE DISPONIBILITATE INVENTATĂ. Un „99,8%" scris fără monitorizare
 *      e o promisiune pe care nimeni n-o poate verifica, nici clientul, nici
 *      noi. Secțiunea 7 spune ce facem în locul ei, și de ce.
 *   2. EXONERAREA TOTALĂ DE RĂSPUNDERE. Codul civil, art. 1355, interzice
 *      înlăturarea răspunderii pentru faptă intenționată sau culpă gravă. O
 *      clauză care exclude „orice pagubă, în orice situație" e parțial nulă,
 *      deci dă o siguranță falsă. Secțiunea 12 pune un PLAFON, care e valid.
 *   3. TĂCEREA DESPRE ROL. La date de personal, cine e operator și cine e
 *      persoană împuternicită e întrebarea centrală, nu un detaliu de anexă.
 *      E în secțiunea 9 și dezvoltată în anexă.
 *
 * ── REGULA SUB CARE E SCRIS ───────────────────────────────────────────────
 * Aceeași ca la landing: nicio propoziție nu promite ceva ce nu se poate arăta.
 * Furnizorii sunt numiți, regiunea e cea reală (`aws-1-eu-west-1`, Irlanda),
 * criptarea e algoritmul din `src/lib/crypto/aes-gcm.ts`, iar unde ceva nu
 * există încă — export automat de cont, monitorizare de disponibilitate — scrie
 * că nu există.
 */

export const VERSIUNE_TERMENI = "1.0";
export const DATA_TERMENI = "3 septembrie 2026";

export const AVERTISMENT =
  "Documentul de mai jos e complet și descrie exact cum funcționează serviciul, dar nu a fost încă verificat de un jurist. Până la verificare, îl publicăm ca angajament comercial asumat, nu ca text cu forță contractuală deplină. Preferăm să spunem asta decât să lăsăm impresia contrară.";

export type SectiuneLegala = Readonly<{
  titlu: string;
  paragrafe: readonly string[];
}>;

export const SECTIUNI_TERMENI: readonly SectiuneLegala[] = [
  {
    titlu: "1. Părțile",
    paragrafe: [
      `Furnizorul este ${FIRMA.denumire}, cu sediul în ${ADRESA_FIRMA}, cod unic de înregistrare ${FIRMA.cui}, înregistrată la registrul comerțului sub numărul ${FIRMA.regCom}. Furnizorul nu este înregistrat în scopuri de TVA, deci sumele facturate sunt finale.`,
      `Contact: ${CONTACT.email}, telefon ${CONTACT.telefon}.`,
      "Clientul este persoana juridică ce își creează un cont și în numele căreia se folosește serviciul. Persoana fizică ce completează formularul declară că are dreptul să angajeze societatea pe care o reprezintă.",
      "Serviciul se adresează exclusiv profesioniștilor. Nu se încheie contracte cu consumatori, iar regulile privind vânzarea la distanță către consumatori — inclusiv dreptul de retragere în paisprezece zile — nu se aplică. Din același motiv nu apar pictogramele de soluționare alternativă a litigiilor: acelea privesc raporturile cu consumatorii.",
    ],
  },
  {
    titlu: "2. Obiectul contractului",
    paragrafe: [
      "Furnizorul pune la dispoziția Clientului aplicația Administrativo, accesibilă prin internet, pentru administrarea personalului: pontaj, concedii, dosare de personal, salarizare, securitatea muncii, parc auto, inventar și celelalte module active în contul Clientului.",
      "Serviciul se oferă ca acces, nu ca licență de copiere. Clientul nu primește o copie a programului și nu îl poate instala pe propriile servere.",
      "Modulele se activează și se dezactivează separat. Prețul urmează exact modulele active, iar un modul inactiv nu apare nici în meniu, nici pe factură.",
    ],
  },
  {
    titlu: "3. Încheierea contractului",
    paragrafe: [
      "Contractul se încheie când Clientul creează contul, bifează acceptarea prezentelor condiții și primește confirmarea pe adresa de e-mail indicată. Bifa are valoarea unei acceptări în formă electronică.",
      "Furnizorul confirmă primirea fără întârziere nejustificată, prin mijloace electronice, așa cum cere legea comerțului electronic.",
      "Clientul poate corecta datele introduse înainte de trimitere, iar după creare le poate modifica din interfața aplicației.",
    ],
  },
  {
    titlu: "4. Prima lună",
    paragrafe: [
      "Prima lună de utilizare este gratuită, pentru orice configurație de module, fără a fi nevoie de un card bancar.",
      "La sfârșitul ei, contul nu se transformă automat într-unul plătit: Furnizorul întreabă dacă se continuă. Fără răspuns, contul devine inactiv și rămâne așa treizeci de zile, timp în care datele pot fi recuperate integral.",
      "Nu se percepe cost de pornire, de configurare sau de instruire.",
    ],
  },
  {
    titlu: "5. Prețul și facturarea",
    paragrafe: [
      "Prețul se compune din nucleu plus modulele opționale active, conform grilei publicate pe pagina de prețuri. Sumele afișate sunt finale: Furnizorul nu este înregistrat în scopuri de TVA.",
      "Prețul de bază acoperă un număr de angajați declarat pe pagina de prețuri. Peste acest prag, prețul se stabilește prin ofertă, comunicată în scris înainte de a fi aplicată.",
      "Facturarea este lunară, în avans. Termenul de plată este de cincisprezece zile calendaristice de la emiterea facturii.",
      "Furnizorul poate modifica prețurile cu un preaviz de treizeci de zile, transmis pe e-mail. Clientul care nu acceptă noul preț poate înceta contractul până la data intrării lui în vigoare, fără penalități.",
    ],
  },
  {
    titlu: "6. Durata și încetarea",
    paragrafe: [
      "Contractul se încheie pe durată nedeterminată și începe la crearea contului.",
      "Oricare dintre părți poate înceta contractul printr-o notificare scrisă, cu un preaviz de treizeci de zile. Nu se datorează penalități pentru încetare.",
      "Furnizorul poate suspenda accesul dacă o factură rămâne neachitată mai mult de treizeci de zile de la scadență, după o notificare prealabilă. Suspendarea nu șterge datele.",
      "Furnizorul poate înceta contractul de îndată dacă serviciul este folosit pentru fapte ilegale sau într-un mod care pune în pericol securitatea celorlalți clienți.",
    ],
  },
  {
    titlu: "7. Disponibilitatea serviciului",
    paragrafe: [
      "Furnizorul nu publică un procent garantat de disponibilitate. Motivul este simplu: nu există încă o monitorizare independentă care să îl măsoare, iar o cifră pe care nu o poate verifica nimeni nu este o garanție, ci o formulare.",
      "Ce se angajează Furnizorul, în schimb, se poate verifica: lucrările de mentenanță planificate se anunță pe e-mail cu cel puțin patruzeci și opt de ore înainte; întreruperile neplanificate se comunică imediat ce sunt cunoscute; iar o întrerupere imputabilă Furnizorului care depășește opt ore consecutive într-o lună dă dreptul la reducerea proporțională a abonamentului lunii respective, la cererea Clientului.",
      "Când monitorizarea va exista, cifra va apărea aici, împreună cu locul unde poate fi verificată.",
    ],
  },
  {
    titlu: "8. Obligațiile Clientului",
    paragrafe: [
      "Clientul răspunde de exactitatea datelor introduse și de păstrarea confidențialității credențialelor. Orice acțiune făcută dintr-un cont este considerată a-i aparține, până la anunțarea unei folosiri neautorizate.",
      "Clientul se asigură că are un temei legal pentru prelucrarea datelor angajaților săi și că i-a informat, așa cum cere legislația privind protecția datelor.",
      "Clientul nu poate folosi serviciul pentru a stoca date fără legătură cu administrarea propriului personal, nici pentru a încerca accesul la datele altor clienți.",
    ],
  },
  {
    titlu: "9. Datele Clientului",
    paragrafe: [
      "Datele introduse rămân ale Clientului. Furnizorul nu le vinde, nu le pune la dispoziția terților în scopuri proprii și nu le folosește pentru antrenarea de modele de inteligență artificială.",
      "În raport cu datele angajaților, Clientul este operator, iar Furnizorul este persoană împuternicită. Condițiile prelucrării sunt în anexa de la finalul documentului, care are valoarea acordului cerut de articolul 28 din Regulamentul general privind protecția datelor.",
      "Izolarea între firmele-client este impusă în baza de date, prin politici de securitate la nivel de rând, nu prin filtre din aplicație. Datele sensibile — cod numeric personal, IBAN — sunt criptate cu AES-256-GCM, iar fiecare citire a lor lasă urmă în jurnalul de audit.",
    ],
  },
  {
    titlu: "10. Exportul datelor și ce se întâmplă la plecare",
    paragrafe: [
      "Nu există încă un buton care să exporte întregul cont dintr-o singură apăsare. Până când va exista, Furnizorul livrează exportul complet la cerere, în formatele pe care aplicația le produce — foi de calcul și documente PDF — în cel mult zece zile lucrătoare de la solicitare, fără cost.",
      "După încetarea contractului, datele rămân accesibile treizeci de zile, ca să poată fi recuperate. După acest termen se șterg definitiv, în cel mult încă treizeci de zile, inclusiv din copiile de siguranță aflate în rotație.",
      "Jurnalul de audit face excepție și se păstrează atât cât cere legislația aplicabilă Clientului, fiindcă este proba a ceea ce s-a întâmplat cu datele, nu conținutul lor.",
    ],
  },
  {
    titlu: "11. Proprietate intelectuală",
    paragrafe: [
      "Aplicația, codul, interfața și documentația rămân proprietatea Furnizorului. Contractul dă drept de utilizare, nu de proprietate.",
      "Clientul nu poate decompila aplicația, nu poate încerca extragerea codului sursă și nu poate revinde accesul altor societăți.",
      "Datele introduse de Client, inclusiv documentele încărcate, rămân proprietatea Clientului.",
    ],
  },
  {
    titlu: "12. Răspunderea",
    paragrafe: [
      "Fiecare parte răspunde pentru prejudiciul cauzat celeilalte prin neîndeplinirea obligațiilor asumate.",
      "Răspunderea Furnizorului pentru daune este limitată la suma facturată Clientului în ultimele douăsprezece luni dinaintea faptei care a produs prejudiciul. Limitarea NU se aplică — și nu poate fi aplicată — în cazul faptei intenționate sau al culpei grave, ale căror consecințe nu pot fi înlăturate prin contract, potrivit Codului civil.",
      "Furnizorul nu răspunde pentru corectitudinea calculelor de salarizare bazate pe valori pe care Clientul le configurează singur, nici pentru consecințele unor date introduse greșit de utilizatorii Clientului.",
      "Clientul răspunde pentru legalitatea prelucrării datelor propriilor angajați.",
    ],
  },
  {
    titlu: "13. Confidențialitatea",
    paragrafe: [
      "Fiecare parte păstrează confidențialitatea informațiilor aflate despre cealaltă cu ocazia executării contractului și nu le dezvăluie terților fără acord scris.",
      "Obligația nu privește informațiile publice, cele cunoscute anterior fără obligație de păstrare a secretului, ori cele a căror dezvăluire este cerută de o autoritate competentă.",
      "Obligația rămâne în vigoare trei ani după încetarea contractului.",
    ],
  },
  {
    titlu: "14. Forța majoră",
    paragrafe: [
      "Niciuna dintre părți nu răspunde pentru neexecutarea cauzată de un eveniment de forță majoră, în înțelesul Codului civil.",
      "Partea afectată anunță cealaltă parte în cel mult zece zile de la producerea evenimentului. Dacă situația durează mai mult de trei luni, oricare parte poate înceta contractul, fără despăgubiri.",
    ],
  },
  {
    titlu: "15. Modificarea termenilor",
    paragrafe: [
      "Furnizorul poate modifica prezentele condiții. Modificările se comunică pe e-mail cu cel puțin treizeci de zile înainte de intrarea lor în vigoare.",
      "Clientul care nu acceptă modificările poate înceta contractul până la data intrării lor în vigoare. Continuarea folosirii serviciului după această dată înseamnă acceptare.",
      "Fiecare versiune poartă un număr și o dată, afișate în capul paginii.",
    ],
  },
  {
    titlu: "16. Legea aplicabilă și litigiile",
    paragrafe: [
      "Contractul este guvernat de legea română.",
      "Părțile încearcă mai întâi soluționarea amiabilă. Dacă nu reușesc, competența revine instanțelor de la sediul Furnizorului.",
    ],
  },
];

/**
 * Anexa de prelucrare a datelor — acordul cerut de articolul 28 din RGPD.
 *
 * Stă în același document, nu într-un fișier separat, fiindcă la un produs de
 * HR e partea pe care o citește un cumpărător atent înaintea prețului.
 * Subîmputerniciții sunt cei reali, verificați în configurația de producție:
 * Supabase pe AWS `aws-1-eu-west-1` (Irlanda), Resend pentru e-mail. Analiza de
 * trafic NU apare aici fiindcă nu atinge datele Clientului — rulează exclusiv pe
 * paginile publice de prezentare.
 */
export const SECTIUNI_ANEXA: readonly SectiuneLegala[] = [
  {
    titlu: "A1. Rolurile",
    paragrafe: [
      "Clientul este operator. El decide de ce și cum se prelucrează datele angajaților săi.",
      "Furnizorul este persoană împuternicită. Prelucrează datele numai pe baza instrucțiunilor Clientului, transmise fie prin folosirea aplicației, fie în scris.",
      "Dacă Furnizorul consideră că o instrucțiune încalcă legislația privind protecția datelor, informează Clientul și poate suspenda executarea ei.",
    ],
  },
  {
    titlu: "A2. Obiectul, durata și scopul",
    paragrafe: [
      "Obiectul: administrarea personalului Clientului prin aplicația Administrativo.",
      "Durata: pe toată durata contractului, plus termenele de ștergere din secțiunea 10.",
      "Scopul: exclusiv furnizarea serviciului. Furnizorul nu prelucrează datele în scopuri proprii.",
    ],
  },
  {
    titlu: "A3. Categorii de date și de persoane vizate",
    paragrafe: [
      "Persoane vizate: angajații Clientului, colaboratorii lui și persoanele de contact din firmă.",
      "Categorii de date: date de identificare, date de contact, date privind contractul de muncă și timpul lucrat, concediile, datele necesare salarizării, documentele încărcate de Client.",
      "Date sensibile prin natura lor, precum codul numeric personal și IBAN-ul, sunt criptate în baza de date și accesibile doar rolurilor cărora Clientul le-a acordat expres acest drept.",
    ],
  },
  {
    titlu: "A4. Măsuri de securitate",
    paragrafe: [
      "Izolarea între firme este impusă la nivelul bazei de date, prin politici de securitate la nivel de rând activate obligatoriu pe fiecare tabelă. O interogare care ar depăși granița firmei nu întoarce rânduri, indiferent de ce cere aplicația.",
      "Datele sensibile sunt criptate cu AES-256-GCM, cu chei versionate. Cheile nu se află în codul sursă.",
      "Transmisia se face exclusiv criptat. Fiecare scriere lasă o urmă în jurnalul de audit: cine, când, de la ce adresă și ce s-a schimbat.",
      "Accesul intern al Furnizorului la datele unui Client se face doar la cererea acestuia, pentru asistență, și lasă aceeași urmă.",
    ],
  },
  {
    titlu: "A5. Subîmputerniciți",
    paragrafe: [
      "Furnizorul folosește următorii subîmputerniciți: Supabase, pentru găzduirea bazei de date și a fișierelor, pe infrastructura Amazon Web Services din regiunea Irlanda; Resend, pentru transmiterea e-mailurilor tranzacționale.",
      "Datele Clientului rămân stocate în Uniunea Europeană. Nu există un transfer în afara Spațiului Economic European pentru datele de personal.",
      "Furnizorul anunță în scris orice schimbare a listei, cu treizeci de zile înainte. Clientul poate obiecta motivat, iar dacă obiecția nu poate fi rezolvată, poate înceta contractul fără penalități.",
    ],
  },
  {
    titlu: "A6. Sprijinul pentru drepturile persoanelor vizate",
    paragrafe: [
      "Furnizorul îl sprijină pe Client să răspundă cererilor de acces, rectificare, ștergere sau portabilitate, prin funcțiile aplicației și, unde acestea nu ajung, prin extragere manuală, în cel mult zece zile lucrătoare.",
      "Dacă o cerere ajunge direct la Furnizor, acesta o transmite Clientului fără să răspundă în locul lui.",
    ],
  },
  {
    titlu: "A7. Incidente de securitate",
    paragrafe: [
      "Furnizorul îl anunță pe Client fără întârziere nejustificată și, în orice caz, în cel mult douăzeci și patru de ore de la momentul în care ia cunoștință de o încălcare a securității datelor.",
      "Notificarea cuprinde ce se știe la acel moment: natura incidentului, categoriile și numărul aproximativ de persoane afectate, consecințele probabile și măsurile luate.",
      "Notificarea către autoritatea de supraveghere rămâne obligația Clientului, în calitate de operator.",
    ],
  },
  {
    titlu: "A8. Ștergerea și auditul",
    paragrafe: [
      "La încetarea contractului, datele se returnează sau se șterg conform secțiunii 10, la alegerea Clientului.",
      "Clientul poate verifica respectarea prezentei anexe, o dată pe an, printr-o solicitare scrisă. Furnizorul pune la dispoziție documentația necesară și răspunde întrebărilor în cel mult treizeci de zile.",
    ],
  },
];
