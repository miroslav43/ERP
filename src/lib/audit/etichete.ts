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
  const curat = cheie.replace(/[_.]+/g, " ").trim();
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
