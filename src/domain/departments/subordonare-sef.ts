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
  const { sefId, membri, caleaSefului, sefulParinte } = intrare;

  const idMembri = new Set(membri.map((m) => m.id));

  // Cei care îl au deja pe șef ca manager sunt săriți: altfel fiecare salvare ar
  // rescrie fișe neschimbate, ar mișca `updated_at` degeaba și ar umple jurnalul
  // cu modificări care nu sunt modificări.
  const deLegat = membri
    .filter((m) => m.id !== sefId && m.managerEmployeeId !== sefId)
    .map((m) => m.id);

  const lantulTrecePrinDepartament = caleaSefului.some((id) => id !== sefId && idMembri.has(id));
  if (!lantulTrecePrinDepartament) return { ridicaSeful: null, deLegat };

  // Ridicarea trebuie să iasă DIN departament, altfel mută ciclul cu un pas mai
  // încolo în loc să-l rupă. Dacă șeful părinte e tot aici, rămâne fără manager.
  const nouManager =
    sefulParinte !== null && sefulParinte !== sefId && !idMembri.has(sefulParinte)
      ? sefulParinte
      : null;

  return { ridicaSeful: { nouManager }, deLegat };
}
