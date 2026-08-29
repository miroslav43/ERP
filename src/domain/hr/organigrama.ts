// src/domain/hr/organigrama.ts
/**
 * Construcția arborelui de OAMENI, separată de ecran.
 *
 * Vecinul ei, `domain/departments/arbore.ts`, leagă departamente între ele prin
 * `parent_id`. Aici se leagă oameni de oameni prin `manager_employee_id`, iar
 * cele două se pot contrazice legitim — cineva poate raporta la un om din alt
 * departament — deci niciuna nu se deduce din cealaltă.
 *
 * ── DE CE ADMINISTRATORUL PRIMEȘTE UN TRATAMENT APARTE ────────────────────
 * Triggerul care creează fișa patronului la acceptarea invitației
 * (`0099_invitatia_leaga_fisa.sql`) nu-i pune manager — n-ar avea pe cine. Nici
 * angajaților nou-înrolați nu li se cere unul. Rezultatul, verificat pe baza
 * reală: o firmă cu două fișe le afișa pe amândouă ca rădăcini, adică drept doi
 * arbori paraleli fără nicio legătură între ei. Ecranul spunea „nu se știe cine
 * cui raportează" într-o formă pe care nimeni n-o citește așa.
 *
 * Aici se deduce ce e evident — patronul e vârful — și NUMAI atât:
 *
 * · **Se cere exact un `org_admin`.** La doi, întrebarea „sub cine intră
 *   ceilalți?" n-are răspuns, iar un răspuns ales de noi ar desena o ierarhie
 *   plauzibilă și falsă. La zero (scope „team", unde patronul nu e vizibil) nu
 *   e nimic de dedus.
 * · **Administratorul trebuie să fie el însuși rădăcină.** Dacă și-a pus un
 *   manager direct pe fișă, nu el e vârful, iar mutarea celorlalți sub el ar
 *   contrazice o configurare explicită.
 * · **Muchia dedusă se marchează.** `implicit: true` urcă până în ecran, care o
 *   desenează punctat. Baza rămâne neatinsă: `manager_employee_id` continuă să
 *   fie `null`, deci aprobările de concediu și de pontaj — care citesc baza,
 *   nu ecranul — nu se rutează pe legături pe care nu le-a confirmat nimeni.
 *
 * Funcția e pură: primește rânduri și o hartă de roluri, nu știe nimic despre
 * Supabase și nici despre React.
 */

export interface RandOrganigrama {
  readonly id: string;
  readonly manager_employee_id: string | null;
  /** Contul din portal, cheia după care se caută rolul. `null` = fișă fără cont. */
  readonly user_id: string | null;
}

export interface NodOrganigrama<T extends RandOrganigrama> {
  readonly date: T;
  readonly copii: readonly NodOrganigrama<T>[];
  /** 1 pentru rădăcini. */
  readonly nivel: number;
  /**
   * Muchia care leagă nodul de părintele lui e DEDUSĂ, nu configurată în bază.
   * Mereu `false` la rădăcină: acolo nu există muchie.
   */
  readonly implicit: boolean;
}

export interface RezultatOrganigrama<T extends RandOrganigrama> {
  readonly arbore: readonly NodOrganigrama<T>[];
  /** Fișa administratorului, când ea a devenit rădăcina unică. `null` altfel. */
  readonly administrator: T | null;
  /** Câți au fost atașați implicit sub administrator. */
  readonly atasatiImplicit: number;
  /**
   * Rădăcini care AU un manager, dar al cărui rând nu e vizibil — manager șters,
   * inactiv, sau în afara scope-ului. Numărate ÎNAINTE de cuibărire, fiindcă
   * asta e cifra care spune câte legături lipsesc din bază.
   */
  readonly radaciniFaraManagerVizibil: number;
}

const ROL_ADMINISTRATOR = "org_admin";

export function construiesteOrganigrama<T extends RandOrganigrama>(
  randuri: readonly T[],
  roluriPeCont: ReadonlyMap<string, string>,
): RezultatOrganigrama<T> {
  const existente = new Set(randuri.map((r) => r.id));

  const copiiPeManager = new Map<string, T[]>();
  const radacini: T[] = [];
  for (const r of randuri) {
    const areManagerVizibil =
      r.manager_employee_id !== null && existente.has(r.manager_employee_id);
    if (!areManagerVizibil) {
      radacini.push(r);
      continue;
    }
    const cheie = r.manager_employee_id as string;
    const lista = copiiPeManager.get(cheie);
    if (lista === undefined) copiiPeManager.set(cheie, [r]);
    else lista.push(r);
  }

  const radaciniFaraManagerVizibil = radacini.filter((r) => r.manager_employee_id !== null).length;

  // Administratorul se caută în TOATE rândurile, nu doar în rădăcini: dacă are
  // manager, trebuie să aflăm asta ca să NU cuibărim — nu doar să nu-l găsim.
  const administratori = randuri.filter(
    (r) => r.user_id !== null && roluriPeCont.get(r.user_id) === ROL_ADMINISTRATOR,
  );
  const unicAdministrator = administratori.length === 1 ? (administratori[0] as T) : null;
  const administrator =
    unicAdministrator !== null && radacini.some((r) => r.id === unicAdministrator.id)
      ? unicAdministrator
      : null;

  const atasati = administrator === null ? [] : radacini.filter((r) => r.id !== administrator.id);

  const vizitate = new Set<string>();

  function construieste(r: T, nivel: number, implicit: boolean): NodOrganigrama<T> {
    vizitate.add(r.id);
    const copiiReali = (copiiPeManager.get(r.id) ?? [])
      .filter((c) => !vizitate.has(c.id))
      .map((c) => construieste(c, nivel + 1, false));

    // Subordonații configurați stau ÎNAINTEA celor atașați de noi: primii sunt
    // ce a decis omul, ceilalți sunt ce am dedus. Ordinea o spune fără cuvinte.
    const copiiImpliciti =
      administrator !== null && r.id === administrator.id
        ? atasati.filter((c) => !vizitate.has(c.id)).map((c) => construieste(c, nivel + 1, true))
        : [];

    return { date: r, copii: [...copiiReali, ...copiiImpliciti], nivel, implicit };
  }

  const pornire = administrator === null ? radacini : [administrator];
  const arbore = pornire.map((r) => construieste(r, 1, false));

  // Coada pentru cicluri: un nod prins într-un ciclu nu e rădăcină (are manager
  // vizibil) și nu e atins de nicio recursie pornită dintr-o rădăcină. Fără ea
  // ar dispărea de pe ecran, tăcut.
  //
  // `vizitate` se verifică la FIECARE iterație, nu o dată la început:
  // `construieste` marchează pe parcurs, iar un `.filter().map()` ar evalua
  // filtrul integral înainte de prima construcție — deci al doilea nod al
  // aceluiași ciclu ar fi construit a doua oară, ca rădăcină duplicată.
  const suplimentare: NodOrganigrama<T>[] = [];
  for (const r of randuri) {
    if (!vizitate.has(r.id)) suplimentare.push(construieste(r, 1, false));
  }

  return {
    arbore: [...arbore, ...suplimentare],
    administrator,
    atasatiImplicit: administrator === null ? 0 : atasati.length,
    radaciniFaraManagerVizibil,
  };
}
