// src/lib/audit/rute.ts
/**
 * De la un rând de jurnal la obiectul pe care îl descrie.
 *
 * `entity_type` e numele tabelei scrise de trigger (sau un literal al
 * acțiunii), iar `entity_id` e rândul. Unde locuiește rândul în interfață e o
 * decizie de rutare, deci stă aici, nu în bază — același motiv ca la
 * `registru/legaturi.ts`. Doar tipurile cu pagină de detaliu PROPRIE pe acel
 * id intră în hartă; departamentele, punctele de lucru și zilele de pontaj
 * rămân text, fiindcă n-au `[id]`.
 *
 * Poarta se decide prin registrul porților de rută (`poateDeschide`), adică
 * prin modulul și permisiunea paginii-țintă: jurnalul arată toată firma, iar
 * un link spre un modul oprit ar fi un 404 într-un jurnal de audit.
 */
import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";

const RUTA_ENTITATE: Readonly<Record<string, (id: string) => string>> = {
  employees: (id) => `/angajati/${id}`,
  employee: (id) => `/angajati/${id}`,
  leave_requests: (id) => `/concedii/${id}`,
  leave_request: (id) => `/concedii/${id}`,
  vehicles: (id) => `/flota/${id}`,
  vehicle: (id) => `/flota/${id}`,
  trip_sheets: (id) => `/flota/foi/${id}`,
  trip_sheet: (id) => `/flota/foi/${id}`,
  payroll_periods: (id) => `/salarizare/${id}`,
  payroll_period: (id) => `/salarizare/${id}`,
  announcements: (id) => `/anunturi/${id}`,
  announcement: (id) => `/anunturi/${id}`,
  inventory_items: (id) => `/inventar/${id}`,
  inventory_item: (id) => `/inventar/${id}`,
  courses: (id) => `/cursuri/${id}`,
  course: (id) => `/cursuri/${id}`,
  course_materials: (id) => `/cursuri/biblioteca/${id}`,
  business_trips: (id) => `/diurna/${id}`,
  business_trip: (id) => `/diurna/${id}`,
  work_accidents: (id) => `/ssm/accidente/${id}`,
  work_accident: (id) => `/ssm/accidente/${id}`,
  fire_extinguishers: (id) => `/ssm/stingatoare/${id}`,
  tickets: (id) => `/ticketing/${id}`,
  ticket: (id) => `/ticketing/${id}`,
  fault_reports: (id) => `/mentenanta/sesizari/${id}`,
  fault_report: (id) => `/mentenanta/sesizari/${id}`,
  equipment: (id) => `/mentenanta/echipamente/${id}`,
  maintenance_plans: (id) => `/mentenanta/planuri/${id}`,
  maintenance_plan: (id) => `/mentenanta/planuri/${id}`,
  attendance_periods: (id) => `/pontaj/perioade/${id}`,
  attendance_period: (id) => `/pontaj/perioade/${id}`,
  reges_mesaje: (id) => `/reges/${id}`,
  kpi_evaluari_lunare: (id) => `/evaluari/kpi/${id}`,
  checklist_instances: (id) => `/onboarding/${id}`,
  checklist_instance: (id) => `/onboarding/${id}`,
  checklist_templates: (id) => `/onboarding/sabloane/${id}`,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ruta obiectului sau `null`: tip fără pagină, id care nu e un UUID, modul oprit sau drept lipsă. */
export function rutaEntitatei(
  entityType: string | null,
  entityId: string | null,
  context: ContextPorti,
): string | null {
  if (entityType === null || entityId === null || !UUID.test(entityId)) return null;
  const construieste = Object.hasOwn(RUTA_ENTITATE, entityType)
    ? RUTA_ENTITATE[entityType]
    : undefined;
  if (construieste === undefined) return null;
  const href = construieste(entityId);
  return poateDeschide(href, context) ? href : null;
}

/** Cheile de legătură din `before`/`after` ale jurnalului → pagina rândului legat. */
const RUTA_VALORII: Readonly<Record<string, (id: string) => string>> = {
  employee_id: (id) => `/angajati/${id}`,
  manager_employee_id: (id) => `/angajati/${id}`,
  solicitant_employee_id: (id) => `/angajati/${id}`,
  atribuit_employee_id: (id) => `/angajati/${id}`,
  responsabil_employee_id: (id) => `/angajati/${id}`,
  vehicle_id: (id) => `/flota/${id}`,
  equipment_id: (id) => `/mentenanta/echipamente/${id}`,
  course_id: (id) => `/cursuri/${id}`,
  material_id: (id) => `/cursuri/biblioteca/${id}`,
  item_id: (id) => `/inventar/${id}`,
  inventory_item_id: (id) => `/inventar/${id}`,
  leave_request_id: (id) => `/concedii/${id}`,
  ticket_id: (id) => `/ticketing/${id}`,
  period_id: (id) => `/salarizare/${id}`,
  template_id: (id) => `/onboarding/sabloane/${id}`,
  department_id: (id) => `/departamente?departament=${id}`,
  punct_lucru_id: (id) => `/puncte-lucru?punct=${id}#punct-${id}`,
};

/**
 * Valoarea unui câmp din detaliile evenimentului → pagina rândului pe care îl
 * numește, sau `null`. Cheia e ultimul segment al căii (`settings.employee_id`
 * e tot `employee_id`); valoarea trebuie să fie un UUID; poarta e a paginii-țintă.
 */
export function rutaValorii(
  cale: readonly string[],
  valoare: unknown,
  context: ContextPorti,
): string | null {
  const cheie = cale[cale.length - 1];
  if (cheie === undefined || typeof valoare !== "string" || !UUID.test(valoare)) return null;
  const construieste = Object.hasOwn(RUTA_VALORII, cheie) ? RUTA_VALORII[cheie] : undefined;
  if (construieste === undefined) return null;
  const href = construieste(valoare);
  return poateDeschide(href, context) ? href : null;
}
