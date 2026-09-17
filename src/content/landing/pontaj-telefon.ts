/**
 * Conținutul propriu al paginii `/pontaj-pe-telefon`.
 *
 * ── DE CE UN FIȘIER SEPARAT ───────────────────────────────────────────────
 * Pagina e doar în română — o obligație și un obicei de aici —, iar `ro.ts` și
 * `en.ts` sunt ținute în aceeași structură de un test. Scris acolo, textul ăsta
 * ar fi cerut o traducere care n-are unde să fie afișată.
 *
 * ── DE CE A FOST REscris ──────────────────────────────────────────────────
 * Auditul SEO din 17 sept 2026: pagina avea 354 de cuvinte și nu spunea nicăieri
 * cum pontează efectiv omul de pe telefon. Lista „merge azi” pornea de la foaia
 * lunară — adică de la ecranul administratorului —, iar interogarea pe care o
 * țintește („aplicație de pontaj”) e a celui care caută butonul.
 *
 * Fiecare afirmație de mai jos are corespondent în cod:
 *   - butoanele și modurile: `mod_pontare_rapida` ('oprit' | 'confirmare' |
 *     'ceas' | 'ambele'), `(portal)/portal/pontare-rapida.tsx`;
 *   - ora scrisă e a serverului: același fișier, antetul lui;
 *   - afișul cu cod QR și verificarea: `verificare_pontare` ('fara' | 'cod_qr'),
 *     `(app)/puncte-lucru/[id]/afis/page.tsx`, `(portal)/portal/ponteaza/[cod]`;
 *   - instalarea pe ecranul de start: `src/app/manifest.ts`, `display: standalone`;
 *   - fără lucru offline: nu există service worker, tot din `manifest.ts`;
 *   - fără localizare: nicio citire de geolocație în `src/`.
 */

export type SectiunePontajTelefon = Readonly<{
  supratitlu: string;
  titlu: string;
  lead?: string;
  pasi: readonly Readonly<{ titlu: string; text: string }>[];
}>;

export const CUM_PONTEAZA: SectiunePontajTelefon = {
  supratitlu: "Pas cu pas",
  titlu: "Cum pontează omul, de pe telefonul lui",
  lead: "Nimic de instalat din magazin și niciun cont nou de ținut minte: angajatul intră cu invitația primită pe e-mail și pontează din aceeași adresă pe care o deschide managerul.",
  pasi: [
    {
      titlu: "1. Primește invitația și își pune parola",
      text: "Invitația pleacă din aplicație, pe e-mail. Omul o deschide de pe telefon, își alege parola și e înăuntru. Nu are nevoie de cont de Google sau de Apple și nu trebuie să aștepte aprobarea nimănui.",
    },
    {
      titlu: "2. Adaugă adresa pe ecranul de start",
      text: "Pe iPhone: Safari, butonul de partajare, „Adaugă la ecranul principal”. Pe Android: Chrome, meniul din colț, „Adaugă la ecranul de start”. Rezultatul arată ca o aplicație — pornește pe tot ecranul, fără bara de adrese — dar nu ocupă spațiu ca una și nu cere actualizări.",
    },
    {
      titlu: "3. Apasă butonul de pontare",
      text: "Pe prima pagină a portalului e butonul zilei. Firma alege ce arată: o singură confirmare pentru ziua obișnuită, două butoane — „Am intrat” și „Am ieșit” —, sau amândouă. Ora care se scrie e a serverului, nu a telefonului: un ceas dat înapoi pe telefon nu schimbă nimic.",
    },
    {
      titlu: "4. Dacă firma cere, scanează întâi afișul",
      text: "Fiecare punct de lucru poate avea un afiș tipărit din aplicație, cu un cod QR. Omul îl scanează cu camera telefonului — nu are nevoie de un scanner separat — și pontează pe punctul acela. Când firma cere scanarea, butoanele apar doar după ea. E o frână împotriva pontării din pat, nu o dovadă că omul a fost la lucru: codul se poate fotografia, iar administratorul îl poate schimba oricând, caz în care afișele vechi nu mai merg.",
    },
    {
      titlu: "5. Vede ce-l privește, tot de acolo",
      text: "Din același portal își vede luna lui de pontaj, soldul de concediu și cererile depuse, fluturașul și documentele primite. Ce nu e al lui nu apare: regula stă în baza de date, nu în meniu.",
    },
  ],
};

export const CE_ALEGE_FIRMA: SectiunePontajTelefon = {
  supratitlu: "Ce se configurează",
  titlu: "Ce alege firma, o singură dată",
  pasi: [
    {
      titlu: "Modul de pontare",
      text: "Oprit, o confirmare pe zi, ceas cu intrare și ieșire, sau amândouă. Se schimbă din setările de pontaj, fără o versiune nouă a aplicației.",
    },
    {
      titlu: "Dacă se cere scanarea codului",
      text: "Fără verificare, sau cu cod QR obligatoriu. A doua variantă cere un afiș tipărit la fiecare punct de lucru.",
    },
    {
      titlu: "Punctele de lucru și afișele",
      text: "Fiecare punct primește codul lui și un afiș gata de tipărit. Codul se schimbă la cerere, când un afiș a ajuns unde nu trebuia.",
    },
    {
      titlu: "Cine aprobă",
      text: "Pontajul zilei poate cere aprobarea managerului de echipă. Managerul aprobă, dar nu pontează în locul oamenilor: cheia de creare nu e a lui.",
    },
  ],
};

export const CE_NU_MERGE: SectiunePontajTelefon = {
  supratitlu: "Limitele",
  titlu: "Ce nu face pontarea din browser",
  lead: "Sunt lucruri pe care le cere lumea și pe care nu le avem. Le scriem aici, nu la a treia discuție.",
  pasi: [
    {
      titlu: "Nu merge fără internet",
      text: "Portalul nu ține nimic offline: fără semnal, butonul nu scrie nimic. Pentru o hală fără acoperire, pontajul se face în continuare din foaia lunară.",
    },
    {
      titlu: "Nu citește localizarea telefonului",
      text: "Nu cerem GPS și nu verificăm dacă omul e în raza punctului de lucru. Nu există nicio linie de cod care să ceară localizarea.",
    },
    {
      titlu: "Nu are NFC, cartelă sau recunoaștere facială",
      text: "Nici măcar ca o coloană în baza de date. Dacă una dintre ele ar schimba decizia ta, spune-ne — construim în ordinea în care ne cer firmele care ne folosesc.",
    },
    {
      titlu: "Nu e în App Store sau Google Play",
      text: "Există o aplicație Android care împachetează același portal, instalată manual, pentru scanarea codului din aplicație și pentru notificări. În magazine nu e, iar pe iPhone rămâne varianta din browser — cea de pe ecranul de start.",
    },
  ],
};
