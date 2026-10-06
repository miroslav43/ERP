/**
 * Forma conținutului de landing.
 *
 * Textele NU stau în componente. Stau în `ro.ts` și `en.ts`, amândouă tipate de
 * interfața asta, iar componentele primesc obiectul ca parametru. Consecința
 * practică: o cheie lipsă din engleză nu e un text rămas în română pe ecran, e
 * o eroare de compilare. Traducerea incompletă cade la `tsc`, nu la vizitator.
 */
import type { FeatureKey } from "@/config/features";

import type { CheiePachet } from "./preturi";

export type Legatura = Readonly<{ eticheta: string; href: string }>;

/** Rândul generic de registru: cod mono la stânga, titlu, text, sub-puncte. */
export type RandRegistru = Readonly<{
  cod: string;
  titlu: string;
  text: string;
  puncte?: readonly string[];
}>;

export type ContinutLanding = Readonly<{
  limba: "ro" | "en";
  /** Link către aceeași pagină în cealaltă limbă. */
  cealaltaLimba: Legatura;
  meta: Readonly<{ titlu: string; descriere: string }>;

  antet: Readonly<{
    navigare: readonly Legatura[];
    autentificare: string;
    /**
     * Eticheta butonului principal din antet.
     *
     * E forma SCURTĂ a lui `hero.ctaPrimar.eticheta` — antetul n-are loc pentru
     * „Creează cont · prima lună gratuită". Destinația e comună: antetul citește
     * `hero.ctaPrimar.href`, deci nu pot duce în locuri diferite. Ce trebuie
     * ținut împreună e doar SENSUL: cât timp eroul spune „creează cont", aici nu
     * poate scrie „cere o demonstrație".
     */
    demo: string;
    meniu: string;
    sariLaContinut: string;
  }>;

  hero: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    ctaPrimar: Legatura;
    ctaSecundar: Legatura;
    /**
     * Ce NU cere înscrierea, chiar sub butoane — răspunsul la „ce risc dacă
     * apăs?" pus acolo unde se ia decizia, nu trei benzi mai jos.
     */
    asigurari: readonly string[];
    /** Eticheta dinaintea numărului de telefon, scris din `CONTACT`, nu de mână. */
    suna: string;
    /**
     * Fraza dintre butoane și foaie: spune ce e tabelul de dedesubt. Fără ea,
     * foaia era un tabel dens cu date fictive, fără legătură cu titlul.
     */
    punteFoaie: string;
  }>;

  foaie: Readonly<{
    eticheta: string;
    subtitlu: string;
    capAngajat: string;
    capOre: string;
    capSuplimentare: string;
    capNoapte: string;
    randTotal: string;
    legendaTitlu: string;
    notaCodConcediu: string;
    notaSubset: string;
    notaNorma: string;
    monumentEticheta: string;
    monumentNota: string;
    monumentStatic: string;
    ferestreEticheta: string;
    descriereTabel: string;
    /** `{zi}`, `{ore}`, `{persoane}` se înlocuiesc la randare. */
    anuntColoana: string;
    /** `{nume}`, `{ore}`. */
    anuntRand: string;
  }>;

  dovada: Readonly<{
    randuri: readonly Readonly<{ valoare: string; eticheta: string; nota: string }>[];
  }>;

  realitatea: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    scene: readonly Readonly<{ titlu: string; text: string }>[];
  }>;

  platforma: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    noduri: readonly Readonly<{ cheie: string; eticheta: string }>[];
    legaturi: readonly Readonly<{ de: string; la: string; eticheta: string; text: string }>[];
    nota: string;
  }>;

  module: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    grupuri: readonly Readonly<{
      cheie: string;
      titlu: string;
      module: readonly Readonly<{
        cheie: FeatureKey;
        titlu: string;
        text: string;
        puncte: readonly string[];
      }>[];
    }>[];
  }>;

  ecrane: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    randuri: readonly RandRegistru[];
  }>;

  pontaj: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    livrateTitlu: string;
    livrate: readonly Readonly<{ titlu: string; text: string; detaliu: string }>[];
    granita: string;
    viitoareTitlu: string;
    viitoare: readonly Readonly<{ titlu: string; text: string }>[];
    notaViitoare: string;
    buton: Legatura;
  }>;

  fluxuri: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    fluxuri: readonly Readonly<{
      titlu: string;
      pasi: readonly Readonly<{ actor: string; text: string }>[];
    }>[];
  }>;

  roluri: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    capResursa: string;
    note: readonly string[];
    notaPlatforma: string;
  }>;

  izolare: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    straturi: readonly Readonly<{ nume: string; rol: string; text: string; bariera: boolean }>[];
    vinieta: Readonly<{
      titlu: string;
      politica: string;
      /** `{ascunse}`, `{total}`. */
      contor: string;
      nota: string;
      randuri: readonly string[];
      ascunse: number;
    }>;
    /**
     * Linkul către pagina de încredere.
     *
     * Pe pagina de start banda asta apare în formă scurtă — supratitlu, titlu,
     * lead și atât. Cele patru straturi și vinieta care pierde patru rânduri sub
     * politică rămân pe `/incredere`, unde au loc să fie citite.
     */
    legaturaPagina: Legatura;
  }>;

  conformitate: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    carduri: readonly Readonly<{ titlu: string; text: string; temei: string }>[];
    retentieTitlu: string;
    retentie: readonly Readonly<{ ce: string; regula: string }>[];
    retentieNota: string;
  }>;

  onestitate: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    randuri: readonly Readonly<{ titlu: string; text: string }>[];
    incheiere: string;
  }>;

  verticale: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    domenii: readonly Readonly<{
      titlu: string;
      text: string;
      module: readonly string[];
    }>[];
    nota: string;
  }>;

  comparatie: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    capAzi: string;
    capNoi: string;
    perechi: readonly Readonly<{ azi: string; noi: string }>[];
  }>;

  /**
   * „Ce face” — produsul arătat pe ecranele lui reale, câte un rând pe treaba
   * pe care o rezolvă, nu pe modul.
   *
   * Până pe 6 oct 2026 pagina de start nu arăta NICIUN ecran al aplicației, deși
   * `public/capturi/` avea șaptesprezece. Cumpărătorul vedea o foaie stilizată
   * cu date fictive și trebuia să ghicească restul.
   *
   * `captura` e cheia unui modul din `vitrine.ts`, `"telefon"` pentru perechea
   * telefon + afiș, sau `null` — atunci rândul își arată `panou`-ul.
   */
  produs: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    randuri: readonly Readonly<{
      captura: FeatureKey | "telefon" | null;
      /** Textul alternativ al capturii: ce se vede, nu ce e. */
      descriereCaptura: string;
      eticheta: string;
      titlu: string;
      text: string;
      puncte: readonly string[];
      legatura: Legatura;
      /** Ecranul viu, fără cont (`/vitrina/...`), unde există unul. */
      demo?: Legatura;
      /** Pentru rândurile fără ecran: un tabel mic, cu sursa scrisă dedesubt. */
      panou?: Readonly<{
        titlu: string;
        randuri: readonly Readonly<{ ce: string; termen: string }>[];
        sursa: string;
      }>;
    }>[];
    /**
     * Restul modulelor, ca grilă de legături. Lista NU se scrie aici: se
     * generează din catalog, ca pagina de start să trimită la FIECARE pagină de
     * modul (vezi testul din `continut.test.ts`). Până pe 2 oct 2026 nu trimitea
     * la niciuna, iar Google amâna paginile aflate la două clicuri de ea.
     */
    restTitlu: string;
    legaturaModule: Legatura;
    /** Sub fiecare captură: că e aplicația reală, cu o firmă inventată. */
    notaCaptura: string;
    /** Completează eticheta butonului de mărire: „<descriere> — <mareste>”. */
    mareste: string;
    inchide: string;
  }>;

  /** Cine folosește aplicația și ce câștigă fiecare — patronul, HR, contabilul, angajatul. */
  pentruCine: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    roluri: readonly Readonly<{ cine: string; text: string; legatura: Legatura }>[];
  }>;

  /**
   * Uneltele gratuite, pe pagina de start.
   *
   * Keyword Planner, oct 2026: „calcul salariu net” are 10.000–100.000 de
   * căutări pe lună, modelele de documente câte 100–1.000, iar termenii
   * comerciali („program pontaj angajați”) 10–100. Cererea e pe unelte, iar
   * pagina de start — cea mai legată pagină a sitului — nu le pomenea decât în
   * subsol.
   */
  unelteGratuite: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    unelte: readonly Readonly<{ titlu: string; text: string; formate: string; href: string }>[];
    ghiduriTitlu: string;
    ghiduri: readonly Legatura[];
    legaturaToate: Legatura;
  }>;

  /**
   * „Suntem la început” — ce ne asumăm, în locul recomandărilor pe care nu le
   * avem încă.
   *
   * Nouă din șaisprezece site-uri de HR analizate pe 6 oct 2026 pun dovadă
   * socială sub erou; niciunul dintre cele mici sau noi n-are de unde. Cel mai
   * apropiat concurent ca poziționare răspunde cu un bloc de promisiuni. Aici
   * stau doar promisiuni pe care le putem ține azi — fiecare are deja acoperire
   * în altă pagină a sitului.
   */
  promisiuni: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    puncte: readonly Readonly<{ titlu: string; text: string }>[];
  }>;

  /**
   * Siguranța datelor, în cuvintele cumpărătorului.
   *
   * Versiunea tehnică — straturile, politica, vinieta — rămâne pe `/incredere`,
   * în `izolare`. Aici patronul află ce îl privește: cine vede, ce se criptează,
   * unde stau datele și că le ia cu el dacă pleacă.
   */
  siguranta: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    puncte: readonly Readonly<{ titlu: string; text: string }>[];
    legatura: Legatura;
  }>;

  /**
   * Pașii de pornire. A înlocuit două benzi care se contraziceau: „Primii pași”
   * spunea „îți faci contul”, „Cum începem” spunea „nu-ți creăm cont” — pe
   * aceeași pagină, sub același buton „Creează cont”.
   */
  incepe: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    pasi: readonly Readonly<{ titlu: string; text: string }>[];
    alternativa: Readonly<{ text: string; legatura: Legatura }>;
  }>;

  /**
   * Prețurile.
   *
   * Aici stă DOAR ce se traduce: numele pachetului, pentru cine e, notele.
   * Sumele și componența pachetelor stau în `preturi.ts` — o sumă în lei e
   * aceeași în ambele limbi, iar scrisă în două fișiere devine două lucruri care
   * trebuie schimbate împreună.
   *
   * `cheie` leagă rândul de aici de pachetul din `preturi.ts`. Tipul e uniunea
   * literală `CheiePachet`, nu `string`: un pachet redenumit acolo și uitat aici
   * cade la `tsc`, nu la vizitator.
   */
  preturi: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    planuri: readonly Readonly<{
      cheie: CheiePachet;
      nume: string;
      pentru: string;
    }>[];
    capModul: string;
    /** Eticheta sumei tăiate, ex. „în loc de”. Cifra se calculează, nu se scrie. */
    inLocDe: string;
    /** Rândul care înlocuiește repetarea nucleului pe fiecare card. */
    pesteNucleu: string;
    /** Mențiunea obligatorie de lângă fiecare cifră: preț final, fără TVA. */
    mentiuneTva: string;
    /**
     * Ce se întâmplă peste pragul de angajați din `preturi.ts`, cu drumul spre
     * ofertă. Până pe 2 oct 2026 era un `string`: „cere o ofertă" fără legătură.
     */
    pestePrag: Readonly<{ text: string; legatura: Legatura }>;
    /** Oferta de intrare: prima lună gratuită. */
    primaLuna: string;
    /*
     * NU există `cta` aici. Butonul fiecărui card e chiar `hero.ctaPrimar` —
     * aceeași etichetă, aceeași destinație. Repetarea aceluiași obiectiv nu se
     * penalizează; ce se penalizează sunt obiective concurente. Iar practic:
     * când apare înregistrarea self-serve, se schimbă UN token, nu două.
     */
    nota: string;
    legaturaPagina: Legatura;
  }>;

  intrebari: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    intrebari: readonly Readonly<{ q: string; a: string }>[];
  }>;

  /**
   * Întrebările de pe pagina de start: șase, scurte, cu legătura spre restul.
   * Răspunsurile lungi, scrise ca pasaje citabile, rămân pe `/intrebari`.
   */
  intrebariScurte: Readonly<{
    supratitlu: string;
    titlu: string;
    intrebari: readonly Readonly<{ q: string; a: string; legatura?: Legatura }>[];
    legatura: Legatura;
  }>;

  contact: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    telefonEticheta: string;
    emailEticheta: string;
    programEticheta: string;
    program: string;
    notaReferinte: string;
    /** Cine e în spatele produsului. `{firma}` și `{oras}` vin din `FIRMA`, nu de mână. */
    cine: string;
    formularTitlu: string;
  }>;

  subsol: Readonly<{
    descriere: string;
    coloane: readonly Readonly<{ titlu: string; legaturi: readonly Legatura[] }>[];
    contactTitlu: string;
    copyright: string;
    notaDiacritice: string;
  }>;

  /**
   * Antetele paginilor publice secundare.
   *
   * Fiecare pagină secundară e compusă din benzi care au deja `<h2>`-ul lor
   * (`Banda` îl randează). Ce le lipsește e un `<h1>` propriu — și, mai
   * important, un motiv de a exista scris în cuvintele cuiva care a ajuns acolo
   * dintr-o căutare, nu derulând pagina de start.
   *
   * Aici stă DOAR ce se vede pe ecran. Titlul SEO și descrierea meta rămân în
   * `metadata` din fișierul rutei: sunt altă propoziție, pentru alt cititor
   * (rezultatul de căutare), și n-au voie să fie aceleași cu `<h1>`-ul.
   */
  pagini: Readonly<{
    module: AntetPagina;
    incredere: AntetPagina;
    deCeNu: AntetPagina;
    intrebari: AntetPagina;
    domenii: AntetPagina;
    pontajTelefon: AntetPagina;
    /** Al doilea cititor al sitului: cine ține mai multe firme deodată. */
    pentruContabili: AntetPagina;
    /** Hub-urile care dădeau 404 până la 17 sept 2026, deși copiii lor existau. */
    ghid: AntetPagina;
    unelte: AntetPagina;
    comparatie: AntetPagina;
  }>;
}>;

/** Antetul unei pagini publice secundare: supratitlu mono, `<h1>`, lead. */
export type AntetPagina = Readonly<{
  supratitlu: string;
  titlu: string;
  lead: string;
}>;
