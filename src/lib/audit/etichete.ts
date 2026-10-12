import type { TonStare } from "@/components/ui/badge";

// src/lib/audit/etichete.ts
/**
 * Traduceri în română pentru valorile enum-ului `audit_action`, pentru numele
 * de tabele (`entity_type`) și pentru numele de coloane afișate în diferențe.
 *
 * Hărțile sunt indexate pe `string`, nu pe tipul enum generat: dacă în baza de
 * date apare o valoare pe care harta nu o cunoaște, se aplică o umanizare de
 * rezervă („invite_resent" → „Invite resent"), niciodată o celulă goală.
 */

export type Optiune = Readonly<{ valoare: string; eticheta: string }>;

const umanizeaza = (cheie: string): string => {
  // Cheile din `redactPayload(input, allow)` sunt camelCase („motivRespingere”):
  // fără despărțire, rezerva scria „MotivRespingere” (FLX-006).
  const curat = cheie
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.]+/g, " ")
    .trim()
    .toLowerCase();
  if (curat === "") return "—";
  return `${curat.charAt(0).toUpperCase()}${curat.slice(1)}`;
};

const ACTIUNI: Readonly<Record<string, string>> = {
  create: "Creare",
  update: "Modificare",
  delete: "Ștergere",
  view: "Vizualizare",
  export: "Export de date",
  org_created: "Organizație creată",
  org_activated: "Organizație activată",
  org_suspended: "Organizație suspendată",
  feature_toggled: "Modul activat/dezactivat",
  invite_sent: "Invitație trimisă",
  invite_revoked: "Invitație anulată",
  invite_accepted: "Invitație acceptată",
  member_added: "Membru adăugat",
  member_removed: "Membru eliminat",
  role_changed: "Rol schimbat",
  permission_changed: "Permisiune schimbată",
  demo_requested: "Cerere de demonstrație",
  email_sent: "E-mail trimis",
  login: "Autentificare",
  logout: "Deconectare",
};

/**
 * Valorile oferite în filtrul de acțiuni. Sunt cele garantate de enum-ul
 * `audit_action` din Faza 1a; dacă enum-ul primește valori noi, se adaugă aici.
 */
const VALORI_ACTIUNI: readonly string[] = [
  "create",
  "update",
  "delete",
  "view",
  "export",
  "org_created",
  "org_activated",
  "org_suspended",
  "feature_toggled",
  "invite_sent",
  "invite_revoked",
  "member_added",
  "member_removed",
  "role_changed",
  "permission_changed",
  "demo_requested",
  "email_sent",
];

const ENTITATI: Readonly<Record<string, string>> = {
  organizations: "Organizație",
  organization_branding: "Identitate vizuală",
  organization_features: "Module ale organizației",
  organization_members: "Membru",
  profiles: "Profil",
  platform_admins: "Administrator de platformă",
  features: "Catalog de module",
  role_permissions: "Permisiuni pe rol",
  invitations: "Invitație",
  audit_logs: "Jurnal de audit",
  notifications: "Notificare",
  notification_preferences: "Preferințe de notificare",
  demo_requests: "Cerere de demonstrație",
  rate_limits: "Limitare de rată",
  document_sequences: "Serii de documente",
  retention_policies: "Politici de retenție",
  email_log: "Jurnal de e-mail",
  // Tabelele de domeniu scrise de `internal.attach_audit` și literalele
  // singulare ale acțiunilor: fără ele, selectul de entitate nu cunoștea
  // tocmai rândurile care există în jurnalul unei firme reale.
  employees: "Angajat",
  employee: "Angajat",
  employment_contracts: "Contract de muncă",
  departments: "Departament",
  department: "Departament",
  puncte_lucru: "Punct de lucru",
  leave_requests: "Cerere de concediu",
  leave_request: "Cerere de concediu",
  attendance_entries: "Zi de pontaj",
  attendance_periods: "Perioadă de pontaj",
  attendance_period: "Perioadă de pontaj",
  attendance_week_submissions: "Săptămână de pontaj",
  vehicles: "Vehicul",
  vehicle: "Vehicul",
  trip_sheets: "Foaie de parcurs",
  trip_sheet: "Foaie de parcurs",
  // 0200: service, costuri, anvelope. Rândul de audit poartă id-ul planului,
  // intervenției sau cheltuielii, nu al vehiculului, deci nu au rută proprie.
  vehicle_service_plans: "Plan de service",
  vehicle_service_plan: "Plan de service",
  vehicle_service_entries: "Intervenție de service",
  vehicle_service_entry: "Intervenție de service",
  vehicle_expenses: "Cheltuială de vehicul",
  vehicle_expense: "Cheltuială de vehicul",
  payroll_periods: "Perioadă de salarizare",
  payroll_period: "Perioadă de salarizare",
  payroll_entries: "Fluturaș",
  tickets: "Tichet",
  ticket: "Tichet",
  fault_reports: "Sesizare de defecțiune",
  fault_report: "Sesizare de defecțiune",
  equipment: "Echipament",
  maintenance_plans: "Plan de mentenanță",
  maintenance_plan: "Plan de mentenanță",
  inventory_items: "Obiect de inventar",
  inventory_item: "Obiect de inventar",
  inventory_allocations: "Predare de inventar",
  courses: "Curs",
  course: "Curs",
  course_materials: "Material de curs",
  course_enrollments: "Înrolare la curs",
  announcements: "Anunț",
  announcement: "Anunț",
  business_trips: "Deplasare",
  business_trip: "Deplasare",
  // 0201 (flota F9): tabela și literalul acțiunilor din `actions-soferi.ts`.
  driver_licenses: "Permis de conducere",
  driver_license: "Permis de conducere",
  // 0203 (flota F11): tabelele și literalele acțiunilor din `actions-amenzi.ts`.
  vehicle_fines: "Amendă pe vehicul",
  vehicle_fine: "Amendă pe vehicul",
  vehicle_incidents: "Incident / daună",
  vehicle_incident: "Incident / daună",
  work_accidents: "Accident de muncă",
  work_accident: "Accident de muncă",
  fire_extinguishers: "Stingător",
  reges_evenimente: "Eveniment REGES",
  reges_mesaje: "Mesaj REGES",
  kpi_evaluari_lunare: "Lună KPI",
  employee_evaluations: "Evaluare",
  checklist_instances: "Parcurs de integrare",
  checklist_instance: "Parcurs de integrare",
  checklist_templates: "Șablon de parcurs",
  registru_documente: "Document din registru",
  // FLX-006: tabelele cu `internal.attach_audit` și literalele singulare din
  // `def.audit.entityType` care lipseau. Fără ele, jurnalul arăta „Approval
  // tasks” sau „Employee sensitive data”, iar filtrul nu le cunoștea.
  approval_tasks: "Sarcină de aprobare",
  approval_flows: "Flux de aprobare",
  approval_steps: "Pas de aprobare",
  alert_rules: "Regulă de alertă",
  compliance_alerts: "Alertă de conformitate",
  employee_sensitive_data: "Date sensibile ale angajatului",
  employee_dependents: "Persoană în întreținere",
  employee_dependent: "Persoană în întreținere",
  employee_documents: "Document al angajatului",
  employee_tax_exemptions: "Scutire fiscală",
  employment_contract: "Contract de muncă",
  contract_suspendare: "Suspendare de contract",
  inrolare_ciorna: "Ciornă de înrolare",
  organization: "Organizație",
  organization_bank_accounts: "Cont bancar al organizației",
  organization_holidays: "Zi liberă a organizației",
  role_permission: "Permisiune pe rol",
  attendance_entry: "Zi de pontaj",
  attendance_settings: "Setări de pontaj",
  attendance_week_submission: "Săptămână de pontaj",
  attendance_approval_batch: "Aprobare de pontaj în lot",
  setari_pontare_rapida: "Setări de pontare rapidă",
  leave_types: "Tip de concediu",
  leave_type: "Tip de concediu",
  leave_type_variants: "Variantă de tip de concediu",
  leave_entitlement_rules: "Regulă de drept la concediu",
  leave_entitlement_rule: "Regulă de drept la concediu",
  leave_balances: "Sold de concediu",
  medical_leave_codes: "Cod de concediu medical",
  payroll_settings: "Setări de salarizare",
  payroll_bonus_rules: "Regulă de primă",
  payroll_bonuses: "Primă",
  payroll_bonus: "Primă",
  payroll_deductions: "Reținere",
  payroll_deduction: "Reținere",
  payroll_garnishments: "Poprire",
  payroll_garnishment: "Poprire",
  payroll_personal_deduction_brackets: "Grilă de deducere personală",
  payroll_prior_income: "Venit anterior",
  salary_components: "Componentă salarială",
  salary_component_types: "Tip de componentă salarială",
  per_diem_policy: "Politică de diurnă",
  per_diem_valori_legale: "Valori legale de diurnă",
  business_trip_leg: "Etapă de deplasare",
  trip_expense: "Cheltuială de deplasare",
  vehicle_assignment: "Atribuire de vehicul",
  vehicle_document: "Document de vehicul",
  fuel_entry: "Alimentare cu combustibil",
  odometer_anomaly: "Anomalie de kilometraj",
  ticket_comment: "Comentariu la tichet",
  ticket_watcher: "Urmăritor de tichet",
  fault_report_comment: "Comentariu la sesizare",
  equipment_meter: "Contor de echipament",
  equipment_oprire: "Oprire de echipament",
  maintenance_intervention: "Intervenție de mentenanță",
  maintenance_attachment: "Fișier de mentenanță",
  maintenance_settings: "Setări de mentenanță",
  inventory_allocation: "Predare de inventar",
  checklist_instance_item: "Pas din parcurs",
  checklist_template: "Șablon de parcurs",
  checklist_template_item: "Pas din șablon",
  checklist_template_stages: "Etapă din șablon",
  checklist_material_reads: "Material citit în parcurs",
  course_items: "Lecție de curs",
  course_material_versions: "Versiune de material",
  course_enrollment_items: "Progres la curs",
  course_assignment_rules: "Regulă de atribuire a cursurilor",
  course_quiz_attempts: "Încercare la test",
  course_answer_keys: "Barem de test",
  evaluation_templates: "Șablon de evaluare",
  kpi_seturi: "Set de indicatori",
  kpi_tinte_angajat: "Ținte KPI ale angajatului",
  announcement_read: "Confirmare de citire a anunțului",
  hr_document_templates: "Șablon de document",
  hr_issued_documents: "Document emis",
  ssm_training: "Instruire SSM",
  ssm_training_type: "Tip de instruire SSM",
  occupational_health_exam: "Examen de medicina muncii",
  ppe_issuance: "Echipament de protecție predat",
  personnel_authorization: "Autorizație de personal",
  iscir_authorization: "Autorizație ISCIR",
  fire_extinguisher: "Stingător",
  fire_extinguisher_check: "Verificare de stingător",
  registru_document: "Document din registru",
  registru_exercitiu: "Exercițiu de registru",
  nomenclator_config: "Configurare de nomenclator",
  nomenclator_dosar: "Dosar din nomenclator",
  reges_credentiale: "Credențiale REGES",
  reges_nomenclatoare: "Nomenclatoare REGES",
  reges_nomenclator: "Nomenclator REGES",
  reges_propuneri: "Propunere REGES",
  reges_termene: "Termen REGES",
};

const VALORI_ENTITATI: readonly string[] = Object.keys(ENTITATI);

const CAMPURI: Readonly<Record<string, string>> = {
  id: "Identificator",
  name: "Denumire",
  legal_name: "Denumire legală",
  slug: "Identificator scurt",
  status: "Stare",
  plan: "Plan",
  seats_limit: "Limită de utilizatori",
  subscription_status: "Stare abonament",
  trial_ends_at: "Sfârșitul perioadei de probă",
  suspended_reason: "Motivul suspendării",
  suspended_at: "Suspendată la",
  activated_at: "Activată la",
  deleted_at: "Ștearsă la",
  role: "Rol",
  email: "E-mail",
  email_contact: "E-mail de contact",
  telefon_contact: "Telefon de contact",
  job_title: "Funcție",
  enabled: "Activ",
  feature_key: "Modul",
  expires_at: "Expiră la",
  timezone: "Fus orar",
  locale: "Limbă",
  moneda: "Monedă",
  cui: "CUI",
  reg_com: "Nr. Reg. Com.",
  platitor_tva: "Plătitor de TVA",
  forma_juridica: "Formă juridică",
  settings: "Setări",
  motiv_respingere: "Motivul respingerii",
  // Cheile camelCase scrise de `redactPayload(input, allow)` în acțiuni.
  motivRespingere: "Motivul respingerii",
  taskId: "Sarcină",
  decizie: "Decizie",
  comentariu: "Comentariu",
  employeeId: "Angajat",
};

/**
 * Valorile de enum care ajung în diferențe ca șiruri brute („aprobata”,
 * „in_lucru”). Se traduc doar când valoarea întreagă e un cod cunoscut; textul
 * liber trece neatins (FLX-006).
 */
const VALORI: Readonly<Record<string, string>> = {
  ciorna: "Ciornă",
  trimisa: "Trimisă",
  in_aprobare: "În aprobare",
  aprobata: "Aprobată",
  aprobat: "Aprobat",
  respinsa: "Respinsă",
  respins: "Respins",
  anulata: "Anulată",
  anulat: "Anulat",
  nou: "Nou",
  in_lucru: "În lucru",
  in_asteptare: "Așteaptă solicitantul",
  rezolvat: "Rezolvat",
  inchis: "Închis",
  redeschis: "Redeschis",
  activ: "Activ",
  inactiv: "Inactiv",
  finalizat: "Finalizat",
  in_curs: "În curs",
};

const STATUSURI: Readonly<Record<string, string>> = {
  success: "Reușit",
  failure: "Eșuat",
  denied: "Refuzat",
};

/**
 * Tonurile rezultatului unei acțiuni auditate.
 *
 * Erau culori de text: `text-success`, `text-danger` și `text-warning`. Ultima
 * dă **3,40:1** pe crem și e interzisă ca text la orice dimensiune sub 18,66px
 * bold — adică exact „Refuzat", cuvântul cel mai important din jurnal, era cel
 * mai greu de citit. Ca ton, cuvântul rămâne în cerneală și semnalul îl poartă
 * bulina.
 */
const TONURI_STATUS: Readonly<Record<string, TonStare>> = {
  success: "succes",
  failure: "pericol",
  denied: "atentie",
};

export const etichetaActiune = (valoare: string): string => ACTIUNI[valoare] ?? umanizeaza(valoare);

export const etichetaEntitate = (valoare: string | null): string =>
  valoare === null ? "—" : (ENTITATI[valoare] ?? umanizeaza(valoare));

export const etichetaCamp = (cale: readonly string[]): string =>
  cale.map((parte) => CAMPURI[parte] ?? umanizeaza(parte)).join(" › ");

/**
 * Eticheta unei valori din diferență. Doar șirurile care sunt, întregi, un cod
 * cunoscut se traduc; orice altceva se întoarce neschimbat, pentru
 * `formateazaValoare`.
 */
export const etichetaValoare = <T>(_cale: readonly string[], valoare: T): T | string =>
  typeof valoare === "string" ? (VALORI[valoare] ?? valoare) : valoare;

export const etichetaStatus = (valoare: string): string =>
  STATUSURI[valoare] ?? umanizeaza(valoare);

export const tonStatus = (valoare: string): TonStare => TONURI_STATUS[valoare] ?? "neutru";

const spreOptiuni = (
  valori: readonly string[],
  traducere: (v: string) => string,
): readonly Optiune[] =>
  valori
    .map((valoare) => ({ valoare, eticheta: traducere(valoare) }))
    .sort((a, b) => a.eticheta.localeCompare(b.eticheta, "ro"));

export const OPTIUNI_ACTIUNI: readonly Optiune[] = spreOptiuni(VALORI_ACTIUNI, etichetaActiune);
export const OPTIUNI_ENTITATI: readonly Optiune[] = spreOptiuni(VALORI_ENTITATI, (v) =>
  etichetaEntitate(v),
);
export const OPTIUNI_STATUS: readonly Optiune[] = spreOptiuni(
  ["success", "failure", "denied"],
  etichetaStatus,
);
