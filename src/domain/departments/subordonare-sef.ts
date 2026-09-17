// src/domain/departments/subordonare-sef.ts
/**
 * Cine intră în subordinea noului șef, și în ce ORDINE se scrie.
 *
 * ── DE CE NU E DE AJUNS ROLUL ─────────────────────────────────────────────
 * Rolul `manager` nu aduce cu el nicio echipă. Scope-ul `team` se calculează în
 * `app.is_manager_of` (0005_hr_rls.sql:40) din `employees.manager_path` — lanțul
 * de subordonare — și n-are nicio legătură cu `departments.manager_employee_id`.
 * Un șef de departament promovat manager, dar de care nu atârnă nimeni, se vede
 * doar pe el însuși: `manager_path` include deliberat fișa proprie. Pe date
 * reale exact asta era starea — un șef de departament cu zero subordonați.
 *
 * ── DE CE PLANUL ARE DOUĂ CÂMPURI, NU O LISTĂ ─────────────────────────────
 * `tg_employees_manager_path` (0004_hr.sql:798) e `BEFORE INSERT OR UPDATE` și
 * ARUNCĂ `P0001` la ciclu, nu ignoră rândul. Într-o scriere în masă asta
 * înseamnă că un singur rând incompatibil anulează tot lotul.
 *
 * Ciclul e ușor de produs fără să vrei: șeful de departament e adesea el însuși
 * subordonat cuiva din propriul departament. Legând oamenii de el, acel cineva
 * devine subordonatul lui — iar lanțul se închide. Deci întâi se RIDICĂ șeful
 * din lanțul propriului departament, abia apoi se leagă oamenii de el. Invers,
 * prima scriere pică.
 *
 * Verificarea se face pe TOATĂ calea, nu doar pe managerul direct: șeful poate
 * atârna de cineva din afară care, la rândul lui, atârnă de un membru.
 *
 * ── DE CE UȘA TREBUIE SĂ AIBĂ DOUĂ SENSURI ────────────────────────────────
 * Legarea se scria, dezlegarea nu — și asta a produs, pe date reale, o
 * organigramă în care un Project Manager stătea deasupra directorului firmei.
 * Din jurnalul de audit al unei firme, cu ore cu tot:
 *
 *   04 sept 20:36:39  Conducere: manager Maletici → Popescu
 *   04 sept 20:36:40  ⇒ Maletici (DIRECTOR, membru în Conducere) primește
 *                       `manager_employee_id = Popescu`
 *   04 sept 20:36:45  Conducere: manager Popescu → GOL          ⇒ nimic
 *   17 sept 19:26:09  Conducere: manager GOL → Maletici          ⇒ nimic
 *
 * A doua și a treia linie sunt defectul. Odată scrisă, subordonarea nu se mai
 * desface din ecranul care a scris-o: nici ștergând managerul, nici punând în
 * locul lui chiar pe cel atârnat greșit. Singura ieșire rămasă era câmpul
 * „Manager direct" de pe fișa fiecărui om — un drum pe care nimic din ecranul
 * de departamente nu-l arată.
 *
 * De aceea regula primește acum și `sefAnteriorId`, iar planul are o a treia
 * ramură. Ce NU face, deliberat: nu se atinge de subordonările care merg spre
 * altcineva decât fostul șef. Singura legătură pe care o desface e exact cea pe
 * care o poate demonstra că a scris-o ea însăși — `manager direct == fostul
 * șef` — iar verificarea e pe managerul DIRECT, nu pe toată calea. Un fost șef
 * aflat mai sus în lanț poate fi acolo pe merit (directorul rămâne deasupra
 * tuturor), iar o ridicare „pe toată calea" ar rupe ierarhii legitime în numele
 * unei simetrii.
 */

export interface MembruDepartament {
  readonly id: string;
  /** `employees.manager_employee_id` de acum. */
  readonly managerEmployeeId: string | null;
}

export interface IntrareSubordonare {
  /** Fișa desemnată șef. */
  readonly sefId: string;
  /** Fișele active cu `department_id` = departamentul, șeful inclusiv dacă e acolo. */
  readonly membri: readonly MembruDepartament[];
  /** `employees.manager_path` al șefului: de la vârf până la el, inclusiv. */
  readonly caleaSefului: readonly string[];
  /** Șeful departamentului părinte — destinația firească a celui ridicat din lanț. */
  readonly sefulParinte: string | null;
  /** Cine conducea departamentul înainte. `null` = n-avea șef. */
  readonly sefAnteriorId: string | null;
  /** `employees.manager_employee_id` al noului șef, ACUM. */
  readonly managerDirectAlSefului: string | null;
}

export type PlanSubordonare = Readonly<{
  /**
   * Se scrie ÎNTÂI. `null` = lanțul șefului nu trece prin departament, deci
   * n-are ce ciclu să apară și fișa lui rămâne neatinsă.
   */
  ridicaSeful: Readonly<{ nouManager: string | null }> | null;
  /** Se scriu DUPĂ: fișele care primesc șeful ca manager direct. */
  deLegat: readonly string[];
}>;

export function planificaSubordonarea(intrare: IntrareSubordonare): PlanSubordonare {
  const { sefId, membri, caleaSefului, sefulParinte, sefAnteriorId, managerDirectAlSefului } =
    intrare;

  const idMembri = new Set(membri.map((m) => m.id));

  // Cei care îl au deja pe șef ca manager sunt săriți: altfel fiecare salvare ar
  // rescrie fișe neschimbate, ar mișca `updated_at` degeaba și ar umple jurnalul
  // cu modificări care nu sunt modificări.
  const deLegat = membri
    .filter((m) => m.id !== sefId && m.managerEmployeeId !== sefId)
    .map((m) => m.id);

  const lantulTrecePrinDepartament = caleaSefului.some((id) => id !== sefId && idMembri.has(id));
  // A doua cauză, cea care a lăsat directorul sub Project Manager: noul șef
  // atârnă chiar de fostul șef al aceluiași departament. Legătura a fost scrisă
  // de mecanismul ăsta, la desemnarea precedentă, deci tot el o desface.
  const atarnaDeFostulSef = sefAnteriorId !== null && managerDirectAlSefului === sefAnteriorId;
  if (!lantulTrecePrinDepartament && !atarnaDeFostulSef) return { ridicaSeful: null, deLegat };

  return {
    ridicaSeful: { nouManager: destinatiaRidicarii(sefId, sefulParinte, idMembri) },
    deLegat,
  };
}

/**
 * Unde ajunge cel ridicat din lanț.
 *
 * Ridicarea trebuie să iasă DIN departament, altfel mută ciclul cu un pas mai
 * încolo în loc să-l rupă. Dacă șeful părinte e tot aici — sau e chiar cel
 * ridicat — omul rămâne fără manager.
 */
function destinatiaRidicarii(
  cineUrca: string,
  sefulParinte: string | null,
  idMembri: ReadonlySet<string>,
): string | null {
  return sefulParinte !== null && sefulParinte !== cineUrca && !idMembri.has(sefulParinte)
    ? sefulParinte
    : null;
}

export interface IntrareEliberare {
  /** Cine conducea departamentul și tocmai a fost șters din dreptul lui. */
  readonly sefAnteriorId: string;
  /** Fișele active cu `department_id` = departamentul. */
  readonly membri: readonly MembruDepartament[];
  /** Șeful departamentului părinte — unde urcă cei rămași fără șef. */
  readonly sefulParinte: string | null;
}

export type PlanEliberare = Readonly<{
  /** Fișele care ies din subordinea fostului șef. */
  deEliberat: readonly string[];
  /** Noul lor manager: șeful părinte, sau nimeni. */
  nouManager: string | null;
}>;

/**
 * Oglinda lui `planificaSubordonarea`, pentru „manager → gol".
 *
 * Se eliberează DOAR cei al căror manager direct e chiar fostul șef — adică
 * exact fișele pe care desemnarea lui le-a scris. Cine atârnă de altcineva n-a
 * fost legat de mecanismul ăsta și nu se atinge.
 *
 * Fostul șef nu se eliberează pe sine: dacă e membru în departament, rămâne cu
 * managerul pe care îl are. Ștergerea lui din dreptul departamentului nu spune
 * nimic despre cui raportează EL.
 */
export function planificaEliberarea(intrare: IntrareEliberare): PlanEliberare {
  const { sefAnteriorId, membri, sefulParinte } = intrare;

  const idMembri = new Set(membri.map((m) => m.id));
  const deEliberat = membri
    .filter((m) => m.id !== sefAnteriorId && m.managerEmployeeId === sefAnteriorId)
    .map((m) => m.id);

  // Destinația se calculează o singură dată, pentru tot lotul: sunt oameni din
  // același departament, deci au toți același loc firesc deasupra.
  return { deEliberat, nouManager: destinatiaRidicarii(sefAnteriorId, sefulParinte, idMembri) };
}
