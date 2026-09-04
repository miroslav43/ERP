/**
 * Tipurile comune ale paginilor care explică o obligație legală.
 *
 * ── DE CE AU FORMĂ FIXĂ ───────────────────────────────────────────────────
 * Paginile astea nu sunt articole de blog. Sunt răspunsuri la o întrebare pe
 * care cineva a tastat-o, iar forma servește exact asta: răspunsul scurt sus,
 * regulile cu articolul de lege lângă ele, la final lista lucrurilor care NU se
 * pot afirma cu certitudine.
 *
 * Ultima secțiune e cea neobișnuită și e intenționată. Piața de conținut pe
 * subiectele astea e vizibil stricată — s-au găsit articole datate 2026 care
 * încă listau cuantumuri depășite de un an, și articole care confundă trei
 * contravenții diferite într-o singură cifră. O pagină care spune limpede unde
 * se termină certitudinea e mai utilă decât una care alege o variantă și tace,
 * și e singurul fel în care putem concura cu domenii vechi de nouă ani.
 *
 * ── DE CE `temei` E OBLIGATORIU PE FIECARE REGULĂ ─────────────────────────
 * Nu din pedanterie: o regulă fără articol nu se poate verifica, deci nu se
 * poate corecta când legea se schimbă. Cu articolul lângă ea, revizuirea anuală
 * a paginii e mecanică — se deschid articolele enumerate și se compară.
 */

/** O regulă, cu actul care o spune. `temei` apare vizibil, lângă text. */
export type Regula = Readonly<{
  /** Situația: „Contract nou", „Modificare de salariu", … */
  situatie: string;
  /** Ce cere legea, într-o frază. */
  cerinta: string;
  /** Articolul și actul, exact: „art. 5 alin. (4) HG 295/2025". */
  temei: string;
}>;

/** O contravenție, cu cuantumul și cu fapta care o atrage. */
export type Amenda = Readonly<{
  fapta: string;
  /**
   * Suma singură: „20.000 lei", „3.000 – 5.000 lei".
   *
   * E despărțită de calificativ fiindcă e ce se caută efectiv pe pagină. Ținute
   * într-un singur șir, cifra și fraza se rup împreună la capătul coloanei, iar
   * suma ajunge citită pe două rânduri — exact informația care trebuia să se
   * vadă dintr-o privire.
   */
  suma: string;
  /** Pe ce se aplică și plafonul cumulat, când are. Absent la amenzile pe faptă. */
  aplicare?: string;
  temei: string;
  /**
   * Nota care desparte fapta asta de una vecină cu care se confundă în presă.
   * Absentă când nu există confuzie de evitat.
   */
  nuConfunda?: string;
}>;

/** Un lucru pe care pagina NU îl afirmă, și de ce. */
export type Nesigur = Readonly<{
  intrebare: string;
  raspuns: string;
}>;

export type PaginaLege = Readonly<{
  antet: Readonly<{ supratitlu: string; titlu: string; lead: string }>;
  /**
   * Răspunsul, în 2-3 propoziții, înaintea oricărei nuanțe.
   *
   * E prima secțiune fiindcă e ce caută și cititorul grăbit, și modelul care
   * rezumă pagina. O pagină care începe cu istoricul legislativ nu răspunde
   * nimănui.
   */
  raspunsScurt: readonly string[];
  reguli: readonly Regula[];
  /** Titlul tabelei de reguli — diferă de la o pagină la alta. */
  titluReguli: string;
  amenzi: readonly Amenda[];
  /** Secțiuni de proză, între tabele. */
  sectiuni: readonly Readonly<{ titlu: string; paragrafe: readonly string[] }>[];
  nesigur: readonly Nesigur[];
  /**
   * A doua acțiune, de la finalul paginii.
   *
   * Se declară per pagină fiindcă paginile astea se citesc în lanț: cine
   * termină de citit ce cere art. 119 vrea de obicei să știe ce se întâmplă la
   * un control, nu să se întoarcă la unealta gratuită. Un link fix ar fi trimis
   * toate trei în același loc, iar două dintre ele ar fi rămas fundături.
   */
  legaturaSecundara: Readonly<{ eticheta: string; href: string }>;
  /** Luna și anul ultimei verificări a textelor de lege. Se scrie de mână. */
  actualizat: string;
  /** Data ISO a aceleiași verificări, pentru `dateModified`. */
  actualizatIso: string;
}>;
