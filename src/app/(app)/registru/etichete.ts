// src/app/(app)/registru/etichete.ts
//
// Cum se citesc în ecran valorile tehnice din registru.

import type { TonStare } from "@/components/ui/badge";
import type { SensRegistru } from "@/lib/queries/registru";

/**
 * Cele trei sensuri, cu cuvintele legii.
 *
 * Legea 16/1996 art. 7 le numește „documente **intrate**", „întocmite pentru
 * **uz intern**" și „**ieșite**" — nu „primite/trimise". Etichetele urmează
 * textul, fiindcă exact după el se uită inspectorul.
 */
export const ETICHETE_SENS: Readonly<Record<SensRegistru, string>> = {
  intrare: "Intrare",
  iesire: "Ieșire",
  intern: "Uz intern",
};

/** Tonul insignei de sens — același în listă și în panou. */
export const TON_SENS: Readonly<Record<SensRegistru, TonStare>> = {
  intrare: "neutru",
  iesire: "succes",
  intern: "ciorna",
};

/**
 * Denumirile tipurilor de document produse de aplicație.
 *
 * `tip_document` e text liber în bază, deliberat: un modul nou nu trebuie să
 * ceară o migrare de enum ca să înregistreze. Harta de aici e doar pentru
 * afișare, iar un cod necunoscut cade pe forma lui brută, curățată — nu pe un
 * gol. Un rând de registru fără denumire ar fi mai rău decât unul urât.
 *
 * ── SURSA TEXTULUI ────────────────────────────────────────────────────────
 * Harta SQL a surselor (`internal.registru_config_surse`, 0142) are coloana
 * `eticheta` cu denumirea legală a fiecărui tip; de acolo vin denumirile de
 * mai jos, scurtate unde coloana de tabel n-ar încăpea. `etichete.test.ts`
 * citește migrarea de pe disc și cere ca FIECARE cod de acolo să aibă intrare
 * aici — înainte, 25 de tipuri ieșeau ca „Fisa eip", „Pv verificare stingator".
 */
const DENUMIRI: Readonly<Record<string, string>> = {
  // Documentele angajării (șabloane, contracte).
  contract_munca: "Contract individual de muncă",
  act_aditional: "Act adițional la contract",
  fisa_postului: "Fișa postului",
  nda: "Acord de confidențialitate",
  anexa_proprietate_intelectuala: "Anexă de proprietate intelectuală",
  act_aditional_telemunca: "Act adițional de telemuncă",
  document_personal: "Document de personal",
  adeverinta: "Adeverință",
  adeverinta_salariat: "Adeverință de salariat",
  adeverinta_vechime: "Adeverință de vechime",
  adeverinta_venit: "Adeverință de venit",
  decizie_incetare: "Decizie de încetare",
  decizie_suspendare: "Decizie de suspendare a contractului",
  decizie_interna: "Decizie internă",
  certificat_handicap: "Certificat de handicap",
  certificat_medical: "Certificat medical",
  // Harta surselor — ieșiri.
  autorizatie_personal: "Autorizație de exercitare",
  adeverinta_curs: "Adeverință de absolvire a cursului",
  comunicare_itm: "Comunicare accident de muncă către ITM",
  adresa_poprire: "Adresă privind poprirea",
  transmitere_reges: "Transmitere REGES",
  // Harta surselor — uz intern.
  decizie_compensare_sarbatoare: "Decizie de compensare pentru sărbătoare legală",
  decizie_compensare_ore: "Decizie de compensare a orelor suplimentare",
  ordin_deplasare: "Ordin de deplasare",
  decont_deplasare: "Decont de deplasare",
  pv_predare_primire: "Proces-verbal de predare-primire",
  fisa_eip: "Fișă de evidență a echipamentului individual de protecție",
  fisa_instruire: "Fișă de instruire SSM",
  evaluare_riscuri: "Evaluare de riscuri",
  plan_prevenire: "Plan de prevenire și protecție",
  permis_lucru_foc: "Permis de lucru cu foc",
  pv_verificare_stingator: "Proces-verbal de verificare a stingătoarelor",
  pv_exercitiu_evacuare: "Proces-verbal de exercițiu de evacuare",
  pv_sedinta_cssm: "Proces-verbal de ședință CSSM",
  pv_incident_periculos: "Proces-verbal de cercetare a incidentului periculos",
  fisa_semnalare_bp: "Fișă de semnalare a bolii profesionale",
  fisa_evaluare: "Fișă de evaluare profesională",
  foaie_parcurs: "Foaie de parcurs",
  pv_interventie: "Proces-verbal de intervenție",
  // Harta surselor — intrări.
  cerere_concediu: "Cerere de concediu",
  permis_munca: "Permis de muncă",
  fisa_aptitudine: "Fișă de aptitudine — medicina muncii",
  autorizatie_iscir: "Autorizație ISCIR",
  autorizatie_mediu: "Autorizație de mediu",
  document_vehicul: "Document al vehiculului",
  dosar_curs: "Dosar de curs",
  // Generate la cerere (`inregistreaza_document_generat`).
  fluturas: "Fluturaș de salariu",
  stat_plata: "Stat de plată",
  d112: "Declarația D112",
  nota_contabila: "Notă contabilă",
  ordin_bancar: "Ordin de plată bancar",
  foaie_colectiva_prezenta: "Foaie colectivă de prezență",
  // Scoase din hartă de 0142; rândurile vechi rămân, anulate, și cer denumire.
  invitatie_inrolare: "Invitație de înrolare",
  nota_interna: "Notă internă",
  sesizare_defectiune: "Sesizare de defecțiune",
  dovada_integrare: "Dovadă de integrare",
};

/** „adeverinta_vechime" → „Adeverinta vechime" pentru codurile fără denumire proprie. */
function dinCod(cod: string): string {
  const cuvinte = cod.replace(/_/g, " ").trim();
  return cuvinte.charAt(0).toUpperCase() + cuvinte.slice(1);
}

// `Object.hasOwn`: „constructor” e un cod valid de tip, dar și o cheie din
// prototip — citit direct, întorcea funcția `Object`, nu un text.
const din = (harta: Readonly<Record<string, string>>, cheie: string): string | undefined =>
  Object.hasOwn(harta, cheie) ? harta[cheie] : undefined;

export function eticheteazaTipDocument(cod: string): string {
  return din(DENUMIRI, cod) ?? dinCod(cod);
}

/**
 * Modul rezolvării, art. 9. Sursele cu status scriu în rubrică starea lor brută
 * (`aprobata`, `decontata`); înregistrarea manuală scrie text liber. Un cod
 * cunoscut primește forma lui în română, textul liber trece neatins, iar lipsa
 * se spune cu cuvinte — „—" nu se aude la cititorul de ecran și nu deosebește
 * „nerezolvat" de „necompletat".
 */
const REZOLVARI: Readonly<Record<string, string>> = {
  aprobata: "Aprobată",
  respinsa: "Respinsă",
  anulata: "Anulată",
  decontata: "Decontată",
  incheiata: "Încheiată",
  finalizata: "Finalizată",
  finalizat: "Finalizat",
  aprobat: "Aprobat",
  respins: "Respins",
};

export function eticheteazaRezolvare(cod: string | null): string {
  if (cod === null) return "În lucru";
  return din(REZOLVARI, cod) ?? dinCod(cod);
}

/**
 * Modulul din care vine rândul — pentru linia „Sursă" din panou. Cheia e
 * `entitate_tip`: numele tabelei-sursă sau un literal (`manual`,
 * `payroll_periods_nota`).
 */
const SURSE: Readonly<Record<string, string>> = {
  manual: "Înregistrat manual",
  leave_requests: "Concedii",
  hr_issued_documents: "Documente emise",
  employment_contracts: "Contracte de muncă",
  contract_suspendari: "Suspendări de contract",
  employee_documents: "Dosarul de personal",
  job_descriptions: "Fișe de post",
  employee_evaluations: "Evaluări",
  work_permits: "Angajați",
  invitations: "Invitații",
  checklist_instances: "Integrare angajați",
  personnel_authorizations: "SSM și PSI",
  ssm_trainings: "SSM și PSI",
  ppe_issuances: "SSM și PSI",
  risk_assessments: "SSM și PSI",
  hot_work_permits: "SSM și PSI",
  fire_extinguisher_checks: "SSM și PSI",
  evacuation_drills: "SSM și PSI",
  safety_committee_meetings: "SSM și PSI",
  dangerous_incidents: "SSM și PSI",
  occupational_diseases: "SSM și PSI",
  occupational_health_exams: "SSM și PSI",
  work_accidents: "SSM și PSI",
  course_completion_records: "Cursuri",
  payroll_garnishments: "Salarizare",
  payroll_periods: "Salarizare",
  payroll_periods_bancar: "Salarizare",
  payroll_periods_nota: "Salarizare",
  payroll_periods_d112: "Salarizare",
  payroll_periods_d112_rect: "Salarizare",
  payroll_entries: "Salarizare",
  holiday_compensation: "Salarizare",
  overtime_compensation: "Salarizare",
  reges_propuneri: "REGES",
  business_trips: "Deplasări și diurne",
  per_diem_calculations: "Deplasări și diurne",
  inventory_allocations: "Inventar",
  trip_sheets: "Parc auto",
  vehicle_documents: "Parc auto",
  maintenance_interventions: "Mentenanță",
  iscir_authorizations: "Mentenanță",
  fault_reports: "Mentenanță",
  environmental_permits: "Conformitate",
  announcements: "Anunțuri",
  pontaj_arhive_lunare: "Pontaj",
};

export function eticheteazaSursa(entitateTip: string): string {
  return din(SURSE, entitateTip) ?? dinCod(entitateTip);
}
