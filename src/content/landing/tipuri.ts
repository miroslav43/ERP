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
   * „Ce pornești întâi” — banda care a înlocuit catalogul de șapte sute de
   * cuvinte de pe pagina de start.
   *
   * Rolul ei nu e să enumere, ci să RAMIFICE: trei drumuri, fiecare cu pagina
   * lui. Fără ea, paginile care au preluat conținutul mutat ar fi accesibile
   * doar din subsol — orfane pentru vizitator și aproape orfane pentru un motor.
   */
  pornire: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    blocuri: readonly Readonly<{ titlu: string; text: string; legatura: Legatura }>[];
    nota: string;
    legaturaModule: Legatura;
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
    /** Ce se întâmplă peste pragul de angajați din `preturi.ts`. */
    pestePrag: string;
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

  implementare: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    pasi: readonly Readonly<{ actor: string; titlu: string; text: string }>[];
  }>;

  intrebari: Readonly<{
    supratitlu: string;
    titlu: string;
    lead: string;
    intrebari: readonly Readonly<{ q: string; a: string }>[];
  }>;

  clienti: Readonly<{
    supratitlu: string;
    titlu: string;
    text: string;
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
  }>;
}>;

/** Antetul unei pagini publice secundare: supratitlu mono, `<h1>`, lead. */
export type AntetPagina = Readonly<{
  supratitlu: string;
  titlu: string;
  lead: string;
}>;
