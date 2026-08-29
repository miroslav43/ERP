// src/config/permissions.ts
/**
 * Cheile de permisiune și algebra scope-urilor.
 *
 * Aici stau doar TIPURILE și ordinea. Valorile efective (ce scope primește
 * fiecare rol) trăiesc în `public.role_permissions`, cu suprascriere per
 * organizație — nu în cod, altfel fiecare client ar cere un deploy.
 *
 * Formatul cheii este `resursa:acțiune` și trebuie să respecte constrângerile
 * din 0001_kernel.sql: `resource ~ '^[a-z][a-z0-9_.]{1,63}$'`,
 * `action ~ '^[a-z][a-z0-9_]{1,31}$'`.
 */

export const PERMISSION_SCOPES = ["none", "own", "team", "all"] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

/**
 * `none` = REFUZ EXPLICIT, nu absența rândului. De aceea nu poate fi cerut ca
 * prag: o acțiune cu `minScope: "none"` ar trece pentru oricine. Excluderea la
 * nivel de tip face configurația greșită imposibil de scris.
 */
export type MinScope = Exclude<PermissionScope, "none">;

export const RANK: Readonly<Record<PermissionScope, number>> = {
  none: 0,
  own: 1,
  team: 2,
  all: 3,
};

/** Absența permisiunii se tratează identic cu `none`: refuz. */
export function meetsScope(granted: PermissionScope | undefined, min: MinScope): boolean {
  return RANK[granted ?? "none"] >= RANK[min];
}

/**
 * Vocabularul de permisiuni. **Sursa de adevăr este seed-ul din
 * `0002_authz.sql`**, nu această listă: politicile RLS interoghează acele
 * rânduri, iar o cheie inventată aici pur și simplu nu are corespondent și
 * întoarce `none` — adică refuz tăcut.
 *
 * Nepotrivirea a fost reală o dată: codul cerea `leave_requests:read`,
 * `organization:update`, `members:manage`, iar baza avea `leave:read`,
 * `organizations:update`, `users:update`. Efectul nu era o eroare, ci un meniu
 * gol pentru toată lumea, inclusiv pentru `org_admin`. Testul `permisiuni.test.ts`
 * compară acum cele două liste și eșuează dacă diverg din nou.
 *
 * Resurse: announcements, attendance, audit, branding, checklists, compliance,
 * courses, departments, employees, features, inventory, leave, maintenance,
 * organizations, payroll, per_diem, reports, roles, ssm, trip_sheets, users,
 * vehicles. Acțiuni: read, create, update, delete, approve, export.
 */
export const PERMISSION_KEYS = [
  "announcements:read",
  "announcements:create",
  "announcements:update",
  "attendance:read",
  "attendance:create",
  // Acordată rolului `employee` de seed (0002_authz.sql:1207) și nedeclarată aici
  // până acum, ceea ce făcea imposibilă scrierea unei acțiuni care s-o ceară:
  // `createAction` tipează `permission` pe uniunea de mai jos, deci o cheie
  // absentă nici măcar nu compilează. Politicile de pontaj comută astăzi tot pe
  // `attendance:create` (0013_attendance.sql:249-259) — cheia există ca să poată
  // fi cerută explicit de o acțiune de EDITARE, nu ca să schimbe vreo politică.
  "attendance:update",
  "attendance:approve",
  "audit:read",
  "branding:create",
  "branding:update",
  "checklists:read",
  "checklists:create",
  "checklists:update",
  // `approve` a stat seedată în 0002 și citită de ZERO politici până la 0088,
  // care i-a dat conținut. Împărțirea, de acum: `update` = cine bifează pași,
  // `approve` = cine ÎNCHIDE parcursul (finalizare sau anulare). Managerul o
  // avea deja la scope `team`, deci închiderea pentru subordonați i s-a deschis
  // fără niciun seed nou — iar bifarea i-a rămas îngustă, la `own`.
  "checklists:approve",
  "compliance:read",
  "compliance:create",
  "compliance:update",
  "compliance:export",
  // Modulul de cursuri (0075). Exact patru chei: nu există politică DELETE
  // (ștergerea e `deleted_at`, deci `update`) și nu există flux de aprobare.
  // Absența e forma corectă a lui „nu" — un rând decorativ ar produce exact ce a
  // fost `checklists:approve` până la 0088: seedat din 0002 și citit de nimeni.
  "courses:read",
  "courses:create",
  "courses:update",
  "courses:export",
  "departments:read",
  "departments:create",
  "departments:update",
  "departments:delete",
  "employees:read",
  "employees:create",
  "employees:update",
  "employees:delete",
  /**
   * Cheie proprie din 0099, îngustă deliberat.
   *
   * `hr` e rolul care înrolează, dar n-are NICIUN `users:*` — deci nu putea
   * trimite invitația pe care înrolarea o cere. Dându-i `users:create`, ar fi
   * primit și dreptul de a invita `org_admin` din ecranul de membri: o
   * extindere reală de privilegiu, pentru o nevoie îngustă. Politica RLS
   * `invitations_insert` leagă cheia asta de rolul `employee`.
   */
  "employees:invite",
  // Chei proprii din 0070. Până atunci evaluările cereau `employees:update`, pe
  // care `manager` nu-l are la scope suficient — deci formularul de evaluare era,
  // în fapt, exclusiv al HR-ului și al administratorului, contrar cerinței
  // „creat de super user SAU de managerul direct".
  "evaluations:read",
  "evaluations:create",
  "evaluations:update",
  "features:read",
  "features:update",
  "inventory:read",
  "inventory:update",
  "leave:read",
  "leave:create",
  "leave:update",
  // Acordată rolului `employee` de seed (0002_authz.sql:1208). Nu există nicio
  // politică DELETE pe `leave_requests` — ștergerea e logică, prin `anuleazaCerere`
  // (care cere `leave:update`). Cheia se declară pentru ca inventarul din cod să
  // corespundă seed-ului: o cheie acordată în bază și absentă din cod e drift
  // tăcut, iar testul din `permissions.test.ts` îl prinde de acum în ambele sensuri.
  "leave:delete",
  "leave:approve",
  "maintenance:create",
  "maintenance:read",
  "maintenance:update",
  "organizations:read",
  "organizations:update",
  "payroll:read",
  "payroll:create",
  "payroll:update",
  "payroll:approve",
  // `payroll:delete` e acordat de seed ca artefact al produsului cartezian din
  // 0002_authz.sql, dar modulul nu are NICIO politică DELETE (soft delete +
  // REVOKE DELETE, 0026_payroll.sql:627) — cheia ar invita un drum pe care baza
  // îl refuză, deci rămâne nedeclarată.
  "payroll:export",
  "per_diem:read",
  "per_diem:create",
  "per_diem:update",
  "per_diem:delete",
  "per_diem:approve",
  // Modulul REGES-Online (0087). Șase chei, dintre care două — `transmit` și
  // `configure` — NU sunt în produsul cartezian de acțiuni din 0002_authz.sql
  // (read/create/update/delete/approve/export), deci nici `super_admin` nu le
  // primește automat: fiecare are rândul ei explicit în seed.
  //
  // `transmit` e separată de `update` deliberat. A apăsa „Transmite" înseamnă a
  // scrie în registrul oficial al Inspecției Muncii; a corecta un rând din coadă
  // înainte de trimitere nu. Modulul vechi le confunda: acțiunile declarau
  // `compliance:read` iar pagina gata pe `compliance:update`, deci cine avea doar
  // citire putea chema Server Action-ul direct și falsifica registrul.
  "reges:read",
  "reges:create",
  "reges:update",
  "reges:transmit",
  "reges:configure",
  "reges:export",
  "reports:read",
  "roles:read",
  "roles:update",
  "ssm:read",
  "ssm:create",
  "ssm:update",
  "tickets:read",
  "tickets:create",
  "tickets:update",
  "tickets:approve",
  "tickets:delete",
  "trip_sheets:read",
  "trip_sheets:create",
  "trip_sheets:update",
  "trip_sheets:approve",
  "users:read",
  "users:create",
  "users:update",
  "vehicles:read",
  "vehicles:create",
  "vehicles:update",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Filtru la granița cu baza: `resource:action` venit din DB poate fi vechi. */
export const isPermissionKey = (value: string): value is PermissionKey =>
  (PERMISSION_KEYS as readonly string[]).includes(value);
