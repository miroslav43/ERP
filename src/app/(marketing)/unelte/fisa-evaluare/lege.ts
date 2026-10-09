/**
 * Ce spune Codul muncii despre evaluare și despre concedierea pentru
 * necorespundere profesională, pe paragrafe scurte, fiecare cu temeiul lui.
 *
 * Verificat pe forma consolidată la 27.04.2026 a Legii 53/2003
 * (https://legislatie.just.ro/Public/DetaliiDocument/309240, cea mai nouă din
 * „istoric consolidări”), descărcată cu curl pe 8 oct 2026. Textul de aici
 * rezumă, nu citează; la o modificare a codului se reverifică fiecare rând.
 *
 * Ce NU spune codul și deci nici pagina: nu există un model oficial de fișă
 * pentru sectorul privat și nici o obligație de evaluare anuală (afirmația
 * frecventă de pe alte site-uri nu apare în text). Periodicitatea, scala și
 * calificativele le stabilește regulamentul intern sau contractul colectiv.
 */

export type RegulaLege = Readonly<{ tip: string; regula: string; temei: string }>;

export const REGULI_EVALUARE: readonly RegulaLege[] = [
  {
    tip: "Cine stabilește criteriile",
    regula:
      "Angajatorul. Are dreptul să stabilească obiectivele de performanță individuală și criteriile după care se evaluează realizarea lor.",
    temei: "art. 40 alin. (1) lit. f)",
  },
  {
    tip: "Salariatul le află dinainte",
    regula:
      "Criteriile de evaluare aplicabile în firmă sunt printre elementele despre care omul e informat înainte de angajare sau de modificarea contractului.",
    temei: "art. 17 alin. (1) și (3) lit. e)",
  },
  {
    tip: "Intră în contract",
    regula:
      "Elementele din informare, deci și criteriile de evaluare, trebuie să se regăsească în contractul individual de muncă.",
    temei: "art. 17 alin. (4)",
  },
  {
    tip: "Schimbarea lor",
    regula:
      "Orice modificare a criteriilor în timpul contractului cere un act adițional, încheiat înainte de modificare, cu excepțiile prevăzute expres de lege sau de contractul colectiv. O fișă semnată „am luat la cunoștință” nu e un act adițional.",
    temei: "art. 17 alin. (5)",
  },
  {
    tip: "Procedura",
    regula:
      "Criteriile și procedura de evaluare se scriu în regulamentul intern. Codul nu dă un model de fișă și nu cere o anumită periodicitate: le stabilește firma.",
    temei: "art. 242 lit. i)",
  },
  {
    tip: "Formarea profesională",
    regula:
      "Angajatorul asigură participarea la formare cel puțin o dată la 2 ani dacă are cel puțin 21 de salariați și cel puțin o dată la 3 ani dacă are sub 21. Rubrica „Plan de dezvoltare” din fișă e locul ei.",
    temei: "art. 194 alin. (1)",
  },
  {
    tip: "Concedierea colectivă",
    regula:
      "Criteriile de prioritate la concediere se aplică pentru departajarea salariaților după evaluarea realizării obiectivelor de performanță.",
    temei: "art. 69 alin. (3)",
  },
];

/** Pașii concedierii pentru necorespundere profesională (art. 61 lit. d)), în ordine. */
export const PASI_CONCEDIERE: readonly RegulaLege[] = [
  {
    tip: "Evaluarea prealabilă",
    regula:
      "Concedierea pentru necorespundere profesională se poate dispune numai după evaluarea prealabilă a salariatului, după procedura din contractul colectiv aplicabil sau, dacă nu există, din regulamentul intern. Fișa e instrumentul; procedura trebuie să fie scrisă înainte.",
    temei: "art. 61 lit. d), art. 63 alin. (2)",
  },
  {
    tip: "Alt loc de muncă",
    regula:
      "Angajatorul îi propune locurile vacante din firmă compatibile cu pregătirea lui. Dacă nu are, cere sprijinul agenției teritoriale de ocupare a forței de muncă.",
    temei: "art. 64 alin. (1) și (2)",
  },
  {
    tip: "Răspunsul salariatului",
    regula:
      "Salariatul are 3 zile lucrătoare de la comunicare ca să accepte în scris. Dacă nu acceptă, și după notificarea agenției, concedierea se poate dispune.",
    temei: "art. 64 alin. (3) și (4)",
  },
  {
    tip: "Termenul deciziei",
    regula:
      "Decizia de concediere se emite în cel mult 30 de zile calendaristice de la data constatării cauzei.",
    temei: "art. 62 alin. (1)",
  },
  {
    tip: "Conținutul deciziei",
    regula:
      "Scrisă, motivată în fapt și în drept, cu termenul și instanța la care se contestă, sub sancțiunea nulității absolute. Cuprinde și durata preavizului și lista locurilor vacante, cu termenul de opțiune.",
    temei: "art. 62 alin. (3), art. 76",
  },
  {
    tip: "Preavizul",
    regula:
      "Cel puțin 20 de zile lucrătoare. Excepție: salariatul concediat pentru necorespundere profesională în perioada de probă.",
    temei: "art. 75 alin. (1) și (2)",
  },
  {
    tip: "Contestarea",
    regula:
      "Salariatul poate contesta decizia în 45 de zile calendaristice de la data la care a luat cunoștință de ea. Concedierea făcută fără procedura din lege e nulă absolut.",
    temei: "art. 268 alin. (1) lit. a), art. 78",
  },
];
