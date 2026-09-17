import { ADRESA_FIRMA, CONTACT, FIRMA } from "@/content/landing/contact";

import type { SectiuneLegala } from "./termeni";

/**
 * Politica de confidențialitate.
 *
 * ── DE UNDE VINE FIECARE AFIRMAȚIE ────────────────────────────────────────
 * Pagina era un schelet cu „DE COMPLETAT DE JURIST” în fiecare secțiune și o
 * locație a serverelor „DE CONFIRMAT”, deși termenii o spuneau deja. Textul de
 * mai jos e redactat din ce face codul, nu din ce ar fi bine să facă:
 *   - datele cererii de demo, inclusiv `ip` și `user_agent`: `0001_kernel.sql`,
 *     tabela `demo_requests`;
 *   - termenele de păstrare: rândurile implicite din `retention_policies`
 *     (`0001_kernel.sql`), pe care o firmă le poate înlocui cu ale ei;
 *   - CNP și IBAN criptate AES-256-GCM: `0004_hr.sql`, secțiunea 5;
 *   - furnizorii: hosturile apelate efectiv din `src/` (testul de conținut
 *     cade dacă apare unul nenumit aici sau în anexa termenilor);
 *   - Google Analytics în Consent Mode v2, cu refuz implicit:
 *     `(marketing)/_componente/analitice.tsx`;
 *   - sesiunea, 400 de zile ca plafon de cookie: `src/lib/supabase/optiuni-cookie.ts`;
 *   - serverul: Contabo GmbH, Germania (`whois` pe adresa VM-ului, 17 sept 2026).
 *
 * Ce ține de judecată juridică — temeiurile de prelucrare și garanțiile fiecărui
 * transfer — e formulat ca propunere și spus ca atare în avertismentul de sus,
 * o singură dată, ca la termeni.
 */

export const DATA_CONFIDENTIALITATE = "17 septembrie 2026";

export const AVERTISMENT_CONFIDENTIALITATE =
  "Documentul descrie exact ce date atinge Administrativo astăzi și unde ajung. Nu a fost încă verificat de un jurist: temeiurile de prelucrare și garanțiile pentru transferurile în afara Spațiului Economic European sunt propunerea noastră și pot fi reformulate la validare. Faptele — ce colectăm, cât păstrăm, cine are acces — nu depind de validare.";

export const SECTIUNI_CONFIDENTIALITATE: readonly SectiuneLegala[] = [
  {
    titlu: "1. Cine răspunde de date",
    paragrafe: [
      `Pentru vizitatorii acestui site, pentru cererile de demonstrație și pentru conturile din aplicație, operatorul datelor este ${FIRMA.denumire}, ${ADRESA_FIRMA}, CUI ${FIRMA.cui}, ${FIRMA.regCom}. Ne scrii la ${CONTACT.email} sau ne suni la ${CONTACT.telefon}.`,
      `Pentru datele angajaților pe care o firmă le introduce în aplicație, operatorul este firma respectivă, iar ${FIRMA.denumire} este persoana împuternicită care le prelucrează în numele ei, după anexa de prelucrare a datelor din Termeni și condiții.`,
    ],
  },
  {
    titlu: "2. Ce date prelucrăm",
    paragrafe: [
      "Din formularul de demonstrație: numele, firma, adresa de e-mail, telefonul (opțional), intervalul numărului de angajați și mesajul (opțional). Odată cu cererea se păstrează adresa IP și identificarea browserului, ca să putem opri cererile automate.",
      "Din contul tău: numele, adresa de e-mail, firma și rolul din firmă, plus jurnalul acțiunilor făcute în aplicație — cine, când, de la ce adresă și ce s-a schimbat.",
      "În aplicație, datele pe care firma le ține despre angajații ei: identificare și contact, contractul de muncă și timpul lucrat, concediile, datele necesare salarizării și documentele încărcate. Codul numeric personal și IBAN-ul sunt criptate în baza de date.",
      "La pontajul de pe telefon se înregistrează ora serverului și punctul de lucru ales. Nu colectăm localizarea telefonului.",
      "Dacă firma a pornit asistentul, întrebările puse lui. Dacă folosești aplicația Android, identificatorul dispozitivului, necesar ca să primești notificări.",
      "Pe paginile publice: statistici de vizitare, descrise la secțiunea 8.",
    ],
  },
  {
    titlu: "3. De ce și pe ce temei",
    paragrafe: [
      "Cererea de demonstrație: ca să-ți răspundem — interesul nostru legitim, articolul 6 alineatul (1) litera f din Regulamentul general privind protecția datelor.",
      "Contul și aplicația: ca să furnizăm serviciul contractat — executarea contractului, litera b.",
      "Documentele contabile și fiscale ale relației cu firma ta: obligația legală, litera c.",
      "Statistica paginilor publice cu Google Analytics: consimțământul tău, litera a, dat din bara de jos. Statistica fără cookie-uri: interesul nostru legitim de a ști ce pagini sunt citite.",
      "Datele angajaților dintr-o firmă-client: temeiul îl stabilește firma, ca operator. Noi le prelucrăm doar pentru a furniza serviciul.",
    ],
  },
  {
    titlu: "4. Cine are acces",
    paragrafe: [
      "Din partea noastră, doar la cererea firmei, pentru asistență; orice acces lasă urmă în același jurnal pe care îl vede și firma.",
      "Furnizorii care ne ajută să furnizăm serviciul: Supabase, pentru baza de date și fișiere, pe infrastructura Amazon Web Services din regiunea Irlanda; Contabo GmbH, Germania, pentru serverul pe care rulează aplicația și statistica proprie a vizitelor; Cloudflare, prin care trece traficul spre site și aplicație; Resend, pentru e-mailurile trimise de aplicație, precum invitațiile și notificările.",
      "Numai dacă firma a pornit modulul respectiv: OpenRouter și furnizorul de model Google, pentru răspunsurile asistentului; Expo, pentru livrarea notificărilor în aplicația Android — titlul și textul notificării.",
      "Pe paginile publice: Google, pentru Google Analytics, în condițiile de la secțiunea 8.",
      "Videoclipurile din cursuri sunt găzduite la furnizorul ales de firmă — YouTube, Vimeo, Loom sau Dailymotion. La redare, playerul acelui furnizor primește adresa IP a celui care privește.",
      "Autoritățile publice primesc date doar când o acțiune din aplicație o cere: Inspecția Muncii, prin REGES-ONLINE, și ANAF, pentru verificarea unei firme după codul fiscal.",
    ],
  },
  {
    titlu: "5. Transferuri în afara Spațiului Economic European",
    paragrafe: [
      "Baza de date și fișierele stau în Uniunea Europeană, în Irlanda. Serverul aplicației este al unui furnizor din Germania.",
      "Unii furnizori sunt stabiliți sau pot prelucra date în afara Spațiului Economic European: OpenRouter și Google pentru asistent, Expo pentru notificări, Resend pentru e-mail, Cloudflare pentru livrarea traficului și Google Analytics. Transferul se sprijină pe garanțiile oferite de fiecare furnizor, de regulă clauze contractuale standard sau Cadrul de confidențialitate a datelor UE–SUA; lista exactă, pe furnizor, face parte din validarea juridică.",
    ],
  },
  {
    titlu: "6. Cât timp păstrăm datele",
    paragrafe: [
      "Cererile de demonstrație: 24 de luni, după care se anonimizează.",
      "Jurnalul de audit: 60 de luni. Jurnalul e-mailurilor trimise, notificările și invitațiile: 12 luni.",
      "Datele angajaților dintr-o firmă-client: cât stabilește firma, prin politica ei de păstrare, și termenele de ștergere de la încetarea contractului, din Termeni și condiții. O firmă își poate fixa termene proprii în locul celor de mai sus.",
    ],
  },
  {
    titlu: "7. Drepturile tale",
    paragrafe: [
      `Ai dreptul de acces, de rectificare, de ștergere, de restricționare, de portabilitate și de opoziție, iar consimțământul dat pentru statistică îl poți retrage oricând. Pentru oricare, scrie-ne la ${CONTACT.email}.`,
      "Dacă ești angajatul unei firme care folosește Administrativo, cererea privind datele tale de angajat se adresează firmei, fiindcă ea este operatorul. Noi o ajutăm să răspundă.",
      "Poți depune plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP).",
    ],
  },
  {
    titlu: "8. Cookie-uri și stocarea din browser",
    paragrafe: [
      "Sesiunea din aplicație folosește cookie-uri strict necesare pentru autentificare, care nu cer consimțământ. Plafonul lor e de 400 de zile; sesiunea propriu-zisă poate expira mai devreme, după setările de autentificare.",
      "Alegerea din bara de consimțământ se păstrează în stocarea locală a browserului, nu într-un cookie, până o ștergi.",
      "Google Analytics 4 scrie cookie-urile _ga și _ga_ urmat de identificatorul proprietății, cu durata de doi ani, numai după ce apeși „Accept”. Până atunci, refuzul e implicit: biblioteca Google se încarcă totuși și trimite semnale fără cookie-uri, cum prevede modul de consimțământ al Google.",
      "Statistica proprie, pe serverul nostru, nu folosește cookie-uri și nu urmărește vizitatorii de la un site la altul.",
    ],
  },
  {
    titlu: "9. Securitate",
    paragrafe: [
      "Izolarea dintre firme e impusă de baza de date, prin politici la nivel de rând, obligatorii pe fiecare tabelă: o interogare care ar trece granița firmei nu întoarce rânduri.",
      "Codul numeric personal și IBAN-ul sunt criptate cu AES-256-GCM, cu chei care nu se află în codul sursă. Traficul circulă numai criptat.",
      "Jurnalul de audit se poate doar completa, nu și modifica. Formularul public acceptă cel mult trei cereri pe oră de la aceeași sursă.",
    ],
  },
  {
    titlu: "10. Modificări",
    paragrafe: [
      "Data ultimei actualizări e scrisă în capul paginii.",
      "Firmele-client primesc în scris, cu treizeci de zile înainte, orice schimbare a furnizorilor care prelucrează datele angajaților, cum prevede anexa din Termeni și condiții.",
    ],
  },
];
