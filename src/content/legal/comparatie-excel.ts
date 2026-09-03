/**
 * Conținutul paginii `/comparatie/excel`.
 *
 * ── DE CE ARE PAGINĂ PROPRIE ──────────────────────────────────────────────
 * „Pontaj în Excel" e felul în care lucrează majoritatea firmelor de 5-50 de
 * oameni, deci e concurentul real — nu celelalte programe. Cine caută asta nu
 * caută un produs, caută un răspuns la întrebarea „chiar merită să schimb?".
 *
 * ── REGULA SUB CARE E SCRIS ───────────────────────────────────────────────
 * Excel-ul NU e prezentat ca prost. E o unealtă bună, folosită dincolo de
 * punctul în care mai poate face față — iar pagina spune și când e în regulă
 * să rămâi la el. O comparație care pierde de fiecare dată nu e citită ca
 * argument, ci ca reclamă, și pierde exact cititorul atent pe care îl vrei.
 */

export type PerecheComparatie = Readonly<{
  aspect: string;
  excel: string;
  aplicatie: string;
}>;

export const ANTET_COMPARATIE = {
  supratitlu: "Comparație",
  titlu: "Pontaj în Excel sau în aplicație — când merită schimbarea",
  lead: "Excel-ul nu e o unealtă proastă. E o unealtă bună, folosită de multe ori dincolo de punctul în care mai poate face față. Mai jos e unde anume se rupe, și unde nu se rupe deloc.",
} as const;

export const PERECHI: readonly PerecheComparatie[] = [
  {
    aspect: "Cine completează",
    excel:
      "O persoană, de obicei aceeași. Când lipsește, luna rămâne necompletată sau o preia cineva care nu știe convențiile fișierului.",
    aplicatie:
      "Fiecare își pontează ziua sau șeful de echipă pontează echipa. Absența unei persoane nu blochează luna.",
  },
  {
    aspect: "Unde e versiunea bună",
    excel:
      "În fișierul cu numele cel mai lung. „pontaj_final_v3_ok” e o glumă doar până când cineva trimite la contabilitate versiunea greșită.",
    aplicatie: "Nu există versiuni. Există o singură lună, cu istoricul modificărilor ei.",
  },
  {
    aspect: "Când totalurile nu se potrivesc",
    excel:
      "Se caută greșeala cu ochiul, celulă cu celulă. O formulă ștearsă din greșeală nu se vede: arată exact ca un zero legitim.",
    aplicatie:
      "Totalul pe rând și cel pe coloană se calculează din aceleași date. Nu se pot despărți, fiindcă nu sunt două calcule.",
  },
  {
    aspect: "Concediul aprobat pe telefon",
    excel:
      "Se retastează în fișier, dacă își amintește cineva. Peste opt luni, soldul de zile se reconstituie din memorie.",
    aplicatie:
      "Cererea aprobată devine zi de concediu pe foaie, o singură dată. Soldul se scade singur.",
  },
  {
    aspect: "Cine a schimbat ora aia",
    excel: "Nu se știe. Fișierul păstrează ultima stare, nu drumul până la ea.",
    aplicatie:
      "Fiecare modificare lasă cine, când și de la ce adresă. Jurnalul se adaugă, nu se șterge.",
  },
  {
    aspect: "Cine vede salariile",
    excel:
      "Oricine deschide fișierul. O parolă de foaie de calcul se scoate în câteva minute cu unelte gratuite.",
    aplicatie:
      "Fiecare rol vede ce ține de el, iar regula e impusă în baza de date. Un manager vede echipa; un angajat, doar propria fișă.",
  },
  {
    aspect: "La un control",
    excel: "Se caută fișierul lunii cerute, se verifică dacă e cel final, se tipărește.",
    aplicatie: "Se deschide luna și se tipărește. Ce s-a modificat și când, se poate arăta.",
  },
  {
    aspect: "Costul",
    excel:
      "Aparent zero. Real: orele lunare ale persoanei care ține fișierul, plus riscul unei amenzi la un pontaj care nu se poate proba.",
    aplicatie: "O sumă lunară previzibilă, care apare pe factură.",
  },
];

export const CAND_RAMAI = {
  titlu: "Când e în regulă să rămâi la Excel",
  paragrafe: [
    "Dacă ai sub cinci angajați, toți în același loc, cu program fix și fără concedii de urmărit, un fișier bine făcut chiar e suficient. Nu-ți vindem altceva.",
    "Dacă ai un contabil extern care ține el evidența și tu doar îi trimiți orele, schimbarea aduce mai puțin decât pare: câștigul e la tine, nu la el.",
    "Dacă lucrezi cu proiecte scurte și oameni care se schimbă des, iar evidența nu e cerută de nimeni, un tabel e mai rapid decât orice altceva.",
    "Momentul în care se schimbă socoteala e destul de precis: când apar oameni în locuri diferite, când cineva trebuie să aprobe ceva de pe telefon, sau când ți s-a cerut o dată să dovedești ce scria în pontaj acum șase luni.",
  ],
} as const;

export const CE_SE_PASTREAZA = {
  titlu: "Ce nu pierzi",
  paragrafe: [
    "Datele existente se importă din fișierul pe care îl ai — lista de angajați, cu marca și datele de contract.",
    "Exportul în Excel rămâne. Foaia lunii se descarcă în format de calcul, cu aceleași cifre ca pe ecran, pentru contabil sau pentru arhivă.",
    "Foaia tipărită arată ca o foaie colectivă de prezență, nu ca un ecran de aplicație.",
  ],
} as const;
