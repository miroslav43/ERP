import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/spor-de-noapte`.
 *
 * ── CE FACE PAGINA ASTA DIFERIT ───────────────────────────────────────────
 * Trei lucruri citite în text, greșite des în afară:
 *
 *  1. **Sporul e de 25%, nu „de cel puțin 25%”.** Art. 126 lit. b) spune „de 25%
 *     din salariul de bază”; minimul negociabil e la orele suplimentare (75%) și
 *     la sărbători (100%), nu aici. Un contract poate da mai mult, dar legea nu
 *     scrie „cel puțin”.
 *  2. **E „fie… fie”.** Salariatul de noapte primește ori program redus cu o oră,
 *     ori sporul — nu amândouă din lege.
 *  3. **Pragul de 3 ore.** Sporul se datorează când timpul lucrat noaptea e de
 *     cel puțin 3 ore din timpul normal de lucru. Motorul de salarizare al
 *     produsului aplică același prag (`pragOreNoapte`, `src/domain/payroll/calc.ts`).
 *
 * ── DE UNDE VIN CIFRELE ───────────────────────────────────────────────────
 * Codul muncii, forma consolidată (doc. 128647, cu modificări până în aprilie
 * 2026), art. 125–128 și art. 260, citite cu `curl` pe 2 oct 2026.
 */
export const SPOR_DE_NOAPTE: PaginaLege = {
  cale: "/ghid/spor-de-noapte",
  antet: {
    supratitlu: "Obligație legală",
    titlu: "Sporul de noapte în Codul muncii: 25% și cele 3 ore",
    lead: "Munca de noapte e între 22:00 și 6:00. Salariatul de noapte primește fie o oră mai puțin de lucru, fie un spor de 25% din salariul de bază — dacă lucrează noaptea cel puțin 3 ore.",
  },

  raspunsScurt: [
    "Munca prestată între 22:00 și 6:00 e muncă de noapte — art. 125 alin. (1). Salariat de noapte e cel care lucrează noaptea cel puțin 3 ore din timpul zilnic sau cel puțin 30% din timpul lunar de lucru — art. 125 alin. (2).",
    "Salariatul de noapte primește fie program redus cu o oră, fără scăderea salariului de bază, în zilele cu cel puțin 3 ore de noapte, fie un spor de 25% din salariul de bază pentru munca prestată noaptea, dacă e de cel puțin 3 ore din timpul normal de lucru — art. 126.",
    "Înainte de a începe munca de noapte și apoi periodic, salariatul face un examen medical gratuit — art. 127. Tinerii sub 18 ani nu pot lucra noaptea — art. 128.",
  ],

  titluReguli: "Regulile, cu articolul lângă fiecare",

  reguli: [
    {
      situatie: "Ce e munca de noapte",
      cerinta: "Munca prestată între orele 22:00 și 6:00.",
      temei: "art. 125 alin. (1) Codul muncii",
    },
    {
      situatie: "Cine e salariat de noapte",
      cerinta:
        "Cel care lucrează noaptea cel puțin 3 ore din timpul zilnic de lucru, sau cel puțin 30% din timpul lunar de lucru.",
      temei: "art. 125 alin. (2) Codul muncii",
    },
    {
      situatie: "Durata",
      cerinta:
        "Cel mult o medie de 8 ore pe zi, calculată pe o perioadă de referință de cel mult 3 luni calendaristice.",
      temei: "art. 125 alin. (3) Codul muncii",
    },
    {
      situatie: "Ce primește",
      cerinta:
        "Fie program redus cu o oră, fără scăderea salariului de bază, în zilele cu cel puțin 3 ore de noapte; fie un spor de 25% din salariul de bază, dacă munca de noapte e de cel puțin 3 ore din timpul normal de lucru.",
      temei: "art. 126 Codul muncii",
    },
    {
      situatie: "Anunțul la ITM",
      cerinta:
        "Angajatorul care folosește frecvent munca de noapte e obligat să informeze inspectoratul teritorial de muncă.",
      temei: "art. 125 alin. (6) Codul muncii",
    },
    {
      situatie: "Examenul medical",
      cerinta:
        "Gratuit, înainte de începerea muncii de noapte și apoi periodic; cine are probleme de sănătate legate de munca de noapte trece la o muncă de zi pentru care e apt.",
      temei: "art. 127 Codul muncii",
    },
    {
      situatie: "Cine nu lucrează noaptea",
      cerinta:
        "Tinerii sub 18 ani nu pot. Femeile gravide, lăuzele, cele care alăptează și persoana singură din familia monoparentală nu pot fi obligate.",
      temei: "art. 128 Codul muncii",
    },
  ],

  amenzi: [
    {
      fapta: "Neacordarea sporului de noapte sau a programului redus",
      suma: "nicio amendă anume",
      aplicare:
        "Art. 260 alin. (1) din Codul muncii, căutat după art. 125–128 și după munca de noapte, nu conține o faptă distinctă. Sporul neplătit rămâne un drept salarial, care se recuperează, la nevoie, în instanță.",
      temei: "art. 260 alin. (1) Codul muncii",
    },
  ],

  sectiuni: [
    {
      titlu: "Cum se calculează sporul",
      paragrafe: [
        "Sporul e 25% din salariul de bază corespunzător orelor lucrate noaptea. Un exemplu: salariu de bază de 5.000 de lei, normă de 168 de ore în lună, 40 de ore lucrate între 22:00 și 6:00. Ora de bază valorează 5.000 / 168 = 29,76 lei, iar sporul e 29,76 × 40 × 25% = 297,62 lei pe luna aceea.",
        "Sporul se datorează doar pentru zilele în care munca de noapte e de cel puțin 3 ore din timpul normal de lucru. O tură care se termină la 23:00 are o singură oră de noapte, deci nu intră.",
      ],
    },
    {
      titlu: "Noaptea în weekend sau de sărbătoare",
      paragrafe: [
        "Sporul de noapte, cel de sărbătoare (art. 142) și cel de ore suplimentare (art. 123) au temeiuri diferite. Pe aceeași oră se pot suprapune, dar ce se cumulează și cum se stabilește prin contractul colectiv sau individual.",
      ],
    },
  ],

  nesigur: [
    {
      intrebare: "Contează sporul de noapte la pensie? Ce adeverință trebuie după 2001?",
      raspuns:
        "E o întrebare de dreptul pensiilor, nu de Codul muncii, iar răspunsul depinde de perioadă și de casa de pensii. Pagina nu răspunde la ea.",
    },
    {
      intrebare: "Se poate negocia un spor mai mare de 25%?",
      raspuns:
        "Legea scrie 25%, fără „cel puțin”. Un contract colectiv sau individual mai favorabil salariatului e, în general, permis; cât de mult și în ce formă rămâne la negociere.",
    },
  ],

  legaturaSecundara: {
    eticheta: "Ore suplimentare: limita și plata",
    href: "/ghid/ore-suplimentare",
  },

  legaturiConexe: [
    { eticheta: "Program de pontaj cu ora de început și de sfârșit", href: "/module/pontaj" },
    { eticheta: "Program de salarizare", href: "/module/salarizare" },
    { eticheta: "Ore suplimentare: limita și plata", href: "/ghid/ore-suplimentare" },
  ],

  surse: [
    {
      eticheta: "Codul muncii, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/128647",
    },
  ],

  actualizat: "octombrie 2026",
  actualizatIso: "2026-10-02",
  publicatIso: "2026-10-02",
};
