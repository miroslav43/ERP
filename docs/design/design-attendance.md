## Enum-uri Postgres introduse

```
attendance_period_status : open | locked
attendance_day_type      : normal | ore_suplimentare | munca_noapte | weekend | sarbatoare_legala
attendance_entry_status  : draft | trimis | aprobat | respins
attendance_entry_source  : manual | auto_concediu | auto_sarbatoare
attendance_batch_scope   : perioada | angajat | selectie
```
Extensii necesare: `btree_gist` (pentru EXCLUDE cu `uuid WITH =`).

---

## Tabele

### attendance_periods
scop: o lună calendaristică de pontaj per organizație, cu stare deschis/blocat și urmă completă a blocării/redeschiderii.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  year int NOT NULL
  month int NOT NULL
  status attendance_period_status NOT NULL DEFAULT 'open'
  opened_at timestamptz NOT NULL DEFAULT now()
  opened_by uuid
  locked_by uuid
  locked_at timestamptz
  lock_snapshot jsonb                      -- totaluri la momentul blocării (ore/angajat), pentru comparație după redeschidere
  reopen_reason text
  reopened_by uuid
  reopened_at timestamptz
  reopen_count int NOT NULL DEFAULT 0
```
constrangeri: `UNIQUE(organization_id, year, month) WHERE deleted_at IS NULL`; `CHECK(month BETWEEN 1 AND 12)`; `CHECK(year BETWEEN 2020 AND 2100)`; `CHECK(status <> 'locked' OR (locked_by IS NOT NULL AND locked_at IS NOT NULL))`; `CHECK(reopen_count = 0 OR (reopen_reason IS NOT NULL AND length(reopen_reason) >= 10 AND reopened_by IS NOT NULL))`
indexuri: `(organization_id, year DESC, month DESC) WHERE deleted_at IS NULL`; `(organization_id, status) WHERE deleted_at IS NULL`
rls: SELECT = `is_member(organization_id)`; INSERT/UPDATE = `has_permission(organization_id,'attendance.period.manage')`; DELETE = niciodată (REVOKE)
nota: perioada lipsă înseamnă implicit `open` — vezi `attendance_period_status_for()`. Nu se creează perioade viitoare automat mai departe de luna curentă + 1.

### attendance_settings
scop: parametrii de calcul ai pontajului per organizație, **versionați** pe interval de valabilitate (niciun prag hardcodat).
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  valid_from date NOT NULL
  default_daily_minutes int NOT NULL DEFAULT 480        -- norma implicită
  max_daily_minutes int NOT NULL DEFAULT 720            -- limită maximă ore/zi
  overtime_threshold_minutes int NOT NULL DEFAULT 480   -- prag peste care se contorizează suplimentare
  max_monthly_overtime_minutes int NOT NULL DEFAULT 480
  night_start time NOT NULL DEFAULT '22:00'
  night_end time NOT NULL DEFAULT '06:00'
  night_min_minutes int NOT NULL DEFAULT 180            -- minim ore în interval nocturn ca ziua să devină munca_noapte
  mandatory_break_after_minutes int NOT NULL DEFAULT 360
  mandatory_break_minutes int NOT NULL DEFAULT 30
  rounding_minutes int NOT NULL DEFAULT 1
  grace_days int NOT NULL DEFAULT 3                     -- zile de grație înainte de alertă
  allow_split_shifts boolean NOT NULL DEFAULT false
  submit_deadline_day int NOT NULL DEFAULT 3            -- ziua din luna următoare până la care se mai poate trimite
```
constrangeri: `UNIQUE(organization_id, valid_from) WHERE deleted_at IS NULL`; `CHECK(default_daily_minutes BETWEEN 60 AND 720)`; `CHECK(max_daily_minutes BETWEEN default_daily_minutes AND 1440)`; `CHECK(overtime_threshold_minutes BETWEEN 60 AND max_daily_minutes)`; `CHECK(rounding_minutes IN (1,5,10,15,30))`; `CHECK(grace_days BETWEEN 1 AND 30)`; `CHECK(mandatory_break_minutes >= 0)`
indexuri: `(organization_id, valid_from DESC) WHERE deleted_at IS NULL`
rls: SELECT = `is_member(organization_id)`; INSERT/UPDATE = `has_permission(organization_id,'attendance.settings.manage')`; DELETE = niciodată
nota: NU se face UPDATE pe o versiune deja folosită de pontaje aprobate — se inserează o versiune nouă cu `valid_from` viitor. Un trigger blochează UPDATE dacă există `attendance_entries.settings_version_id = OLD.id AND status = 'aprobat'`.

### legal_holidays
scop: sărbătorile legale naționale, întreținute de platformă (singura tabelă din modul fără `organization_id`).
coloane:
```
  id uuid PK
  country_code text NOT NULL DEFAULT 'RO'
  holiday_date date NOT NULL
  name text NOT NULL
  is_working_day_replacement boolean NOT NULL DEFAULT false   -- zi de punte / recuperare
```
constrangeri: `UNIQUE(country_code, holiday_date) WHERE deleted_at IS NULL`
indexuri: `(country_code, holiday_date)`
rls: SELECT = `auth.role() = 'authenticated'`; INSERT/UPDATE/DELETE = `is_super_admin()`
nota: excepție conștientă de la regula `organization_id` — date de referință globale, read-only pentru clienți.

### organization_non_working_days
scop: zile nelucrătoare proprii firmei (zile libere acordate, opriri de producție) peste calendarul legal.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  holiday_date date NOT NULL
  name text NOT NULL
  paid boolean NOT NULL DEFAULT true
```
constrangeri: `UNIQUE(organization_id, holiday_date) WHERE deleted_at IS NULL`
indexuri: `(organization_id, holiday_date) WHERE deleted_at IS NULL`
rls: SELECT = `is_member(organization_id)`; INSERT/UPDATE = `has_permission(organization_id,'attendance.settings.manage')`; DELETE = niciodată

### attendance_entries
scop: o înregistrare de pontaj (un interval de lucru) pentru un angajat într-o zi calendaristică.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  period_id uuid NOT NULL FK->attendance_periods(id) RESTRICT
  settings_version_id uuid NOT NULL FK->attendance_settings(id) RESTRICT
  work_date date NOT NULL
  start_time time NOT NULL
  end_time time NOT NULL
  break_minutes int NOT NULL DEFAULT 0
  day_type attendance_day_type NOT NULL DEFAULT 'normal'
  worked_minutes int NOT NULL DEFAULT 0
  overtime_minutes int NOT NULL DEFAULT 0
  night_minutes int NOT NULL DEFAULT 0
  note text
  status attendance_entry_status NOT NULL DEFAULT 'draft'
  rejection_reason text
  submitted_at timestamptz
  approved_by uuid
  approved_at timestamptz
  approval_batch_id uuid FK->attendance_approval_batches(id) RESTRICT
  source attendance_entry_source NOT NULL DEFAULT 'manual'
  source_ref_id uuid                 -- leave_requests.id sau legal_holidays.id, pentru reconciliere idempotentă
  work_start timestamp GENERATED ALWAYS AS (work_date + start_time) STORED
  work_end timestamp GENERATED ALWAYS AS (work_date + end_time + CASE WHEN end_time <= start_time THEN interval '1 day' ELSE interval '0 day' END) STORED
  gross_minutes int GENERATED ALWAYS AS ((extract(epoch FROM (work_date + end_time + CASE WHEN end_time <= start_time THEN interval '1 day' ELSE interval '0 day' END) - (work_date + start_time)) / 60)::int) STORED
```
constrangeri:
```
CHECK (break_minutes >= 0 AND break_minutes < gross_minutes)                      -- pauza < durata brută
CHECK (gross_minutes > 0 AND gross_minutes <= 1440)
CHECK (worked_minutes >= 0 AND worked_minutes <= 1440)
CHECK (overtime_minutes >= 0 AND overtime_minutes <= worked_minutes)
CHECK (night_minutes >= 0 AND night_minutes <= worked_minutes)
CHECK (worked_minutes <= gross_minutes - break_minutes + 1)                       -- toleranță 1 min pentru rotunjire
CHECK (status <> 'respins' OR (rejection_reason IS NOT NULL AND length(rejection_reason) >= 5))
CHECK (status <> 'aprobat' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
CHECK (status = 'draft' OR submitted_at IS NOT NULL)
CHECK (source = 'manual' OR (status = 'aprobat' AND source_ref_id IS NOT NULL))
UNIQUE (employee_id, work_date, start_time) WHERE deleted_at IS NULL             -- fără zile duplicate identice
UNIQUE (employee_id, work_date) WHERE deleted_at IS NULL AND source <> 'manual'  -- o singură zi auto/zi
UNIQUE (source, source_ref_id, employee_id, work_date) WHERE deleted_at IS NULL AND source <> 'manual'  -- idempotență prepopulare
EXCLUDE USING gist (
  organization_id WITH =, employee_id WITH =, tsrange(work_start, work_end, '[)') WITH &&
) WHERE (deleted_at IS NULL AND status <> 'respins')                             -- fără suprapuneri, inclusiv peste miezul nopții
```
indexuri: `(organization_id, period_id, status) WHERE deleted_at IS NULL`; `(organization_id, employee_id, work_date DESC) WHERE deleted_at IS NULL`; `(organization_id, status) WHERE deleted_at IS NULL AND status = 'trimis'`; `(approval_batch_id) WHERE approval_batch_id IS NOT NULL`
rls:
```
SELECT = is_member(organization_id) AND (
           employee_id = current_employee_id(organization_id)
        OR (has_permission(organization_id,'attendance.read.team') AND is_manager_of(employee_id))
        OR has_permission(organization_id,'attendance.read.all'))
INSERT = employee_id = current_employee_id(organization_id)
         AND source = 'manual' AND status IN ('draft','trimis')
         AND attendance_period_status_for(organization_id, work_date) = 'open'
       -- inserarea rândurilor auto_* se face doar prin funcție SECURITY DEFINER
UPDATE = attendance_period_status_for(organization_id, work_date) = 'open' AND (
           (employee_id = current_employee_id(organization_id) AND status IN ('draft','respins') AND source = 'manual')
        OR (has_permission(organization_id,'attendance.approve') AND is_manager_of(employee_id))
        OR has_permission(organization_id,'attendance.approve.all'))
DELETE = niciodată (REVOKE DELETE); soft delete = UPDATE deleted_at, permis doar autorului pe status draft/respins
```
nota: RLS nu poate limita *care coloane* modifică aprobatorul. Trigger-ul `attendance_guard_columns` respinge orice modificare de `start_time/end_time/break_minutes/work_date/day_type` făcută de altcineva decât deținătorul rândului, și orice modificare pe `source <> 'manual'`.

### attendance_approval_batches
scop: un act de aprobare în bloc, ca antet auditabil pentru rândurile afectate.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  period_id uuid NOT NULL FK->attendance_periods(id) RESTRICT
  scope attendance_batch_scope NOT NULL DEFAULT 'perioada'
  filter_snapshot jsonb NOT NULL           -- {employee_ids, department_id, date_from, date_to, statuses}
  entries_affected int NOT NULL DEFAULT 0
  entries_skipped int NOT NULL DEFAULT 0
  skipped_reasons jsonb NOT NULL DEFAULT '[]'::jsonb
  total_worked_minutes int NOT NULL DEFAULT 0
  total_overtime_minutes int NOT NULL DEFAULT 0
  performed_by uuid NOT NULL
  performed_at timestamptz NOT NULL DEFAULT now()
```
constrangeri: `CHECK(entries_affected >= 0)`; `CHECK(jsonb_typeof(filter_snapshot) = 'object')`
indexuri: `(organization_id, period_id, performed_at DESC)`
rls: SELECT = `has_permission(organization_id,'attendance.read.all')`; INSERT = doar prin funcție SECURITY DEFINER; UPDATE/DELETE = niciodată
nota: tabelă append-only. `updated_at`/`deleted_at` există prin convenție, dar sunt blocate de trigger.

---

## (a) Unde trăiește calculul: funcție TypeScript pură. Ferm.

Generated column în Postgres **este imposibilă tehnic**, nu doar nepotrivită:
1. Expresia unei generated column trebuie să fie `IMMUTABLE` și poate referi **doar coloane din același rând**. Regula ta depinde de `attendance_settings` (versionat pe `valid_from`), de `legal_holidays` și de `organization_non_working_days` — trei tabele externe. Un `SELECT` acolo e imposibil.
2. Clasificarea zilei (`weekend`, `sarbatoare_legala`, `munca_noapte`) și pragul de ore suplimentare depind de versiunea de setări valabilă la `work_date`. Dacă logica ar sta în DB și ai schimba setările, ai reinterpreta retroactiv luni deja închise.
3. Munca de noapte cere intersecția intervalului lucrat cu fereastra `[night_start, night_end)` care traversează miezul nopții — logică de interval, nu aritmetică de coloană.

**Ce se face în schimb:**
- Sursa unică de adevăr: `computeAttendance()` în `src/modules/attendance/domain/compute.ts`, pură (fără `Date.now()`, fără I/O), acoperită Vitest cu tabel de cazuri (tură normală, tură de noapte peste 00:00, sărbătoare, weekend, pauză obligatorie, rotunjire, depășire limită).
- Server Action-ul încarcă snapshot-ul de setări valabil la `work_date`, apelează funcția, și scrie `worked_minutes`, `overtime_minutes`, `night_minutes`, `day_type` **plus `settings_version_id`**. Astfel fiecare rând știe cu ce regulă a fost calculat → recalcul reproductibil și auditabil.
- DB-ul păstrează doar *garduri structurale*, nu logica: coloanele generate `work_start/work_end/gross_minutes` (pur aritmetice, deci legitim generate) și CHECK-urile de coerență de mai sus. Un client compromis nu poate scrie `worked_minutes = 900` pentru un interval de 4 ore.
- Limita `max_daily_minutes` (dependentă de setări) se impune prin trigger, nu prin CHECK.

Beneficiu practic: aceeași funcție rulează în preview-ul din formular (feedback instant, fără round-trip) și pe server la validare — un singur set de reguli, testat o singură dată.

## (b) Semnătura exactă a funcției pure

```ts
// src/modules/attendance/domain/types.ts
export type HHmm = `${number}:${number}`;            // "08:30"
export type IsoDate = string;                         // "2026-03-17" (yyyy-MM-dd)

export type AttendanceDayType =
  | 'normal' | 'ore_suplimentare' | 'munca_noapte' | 'weekend' | 'sarbatoare_legala';

export type AttendanceViolationCode =
  | 'INTERVAL_INVALID' | 'PAUZA_DEPASESTE_DURATA' | 'PAUZA_OBLIGATORIE_LIPSA'
  | 'PESTE_LIMITA_ZILNICA' | 'IN_VIITOR' | 'ZI_INAINTE_DE_ANGAJARE' | 'ZI_DUPA_INCETARE';

export interface AttendanceViolation {
  readonly code: AttendanceViolationCode;
  readonly message: string;                           // în română, gata de afișat
  readonly field: 'startTime' | 'endTime' | 'breakMinutes' | 'workDate' | null;
}

export interface AttendanceSettingsSnapshot {
  readonly id: string;                                // settings_version_id
  readonly validFrom: IsoDate;
  readonly defaultDailyMinutes: number;
  readonly maxDailyMinutes: number;
  readonly overtimeThresholdMinutes: number;
  readonly nightStart: HHmm;
  readonly nightEnd: HHmm;
  readonly nightMinMinutes: number;
  readonly mandatoryBreakAfterMinutes: number;
  readonly mandatoryBreakMinutes: number;
  readonly roundingMinutes: number;
}

export interface DayCalendarContext {
  readonly isWeekend: boolean;
  readonly isLegalHoliday: boolean;
  readonly isOrganizationNonWorkingDay: boolean;
  readonly contractDailyMinutes: number | null;       // norma din contract; null ⇒ defaultDailyMinutes
  readonly employmentFrom: IsoDate;
  readonly employmentTo: IsoDate | null;
}

export interface ComputeAttendanceInput {
  readonly workDate: IsoDate;
  readonly startTime: HHmm;
  readonly endTime: HHmm;                             // endTime <= startTime ⇒ tura trece de miezul nopții
  readonly breakMinutes: number;
  readonly declaredDayType: AttendanceDayType | null; // ce a ales angajatul; null ⇒ se deduce
  readonly calendar: DayCalendarContext;
  readonly settings: AttendanceSettingsSnapshot;
  readonly nowLocal: IsoDate & { readonly __brand?: never } | string; // "2026-03-17T14:05" în Europe/Bucharest, injectat
}

export interface AttendanceComputation {
  readonly grossMinutes: number;
  readonly workedMinutes: number;
  readonly overtimeMinutes: number;
  readonly nightMinutes: number;
  readonly effectiveDayType: AttendanceDayType;
  readonly crossesMidnight: boolean;
  readonly settingsVersionId: string;
  readonly warnings: readonly AttendanceViolation[];  // neblocante (ex. pauză sub minim recomandat)
}

export type ComputeAttendanceResult =
  | { readonly ok: true; readonly value: AttendanceComputation }
  | { readonly ok: false; readonly violations: readonly AttendanceViolation[] };

export function computeAttendance(input: ComputeAttendanceInput): ComputeAttendanceResult;
```
Reguli implementate: `effectiveDayType` = `sarbatoare_legala` > `weekend` > `munca_noapte` (dacă `nightMinutes >= nightMinMinutes`) > `ore_suplimentare` (dacă `workedMinutes > overtimeThresholdMinutes`) > `normal`. `overtimeMinutes = max(0, workedMinutes - overtimeThresholdMinutes)`, dar `= workedMinutes` integral pe `weekend`/`sarbatoare_legala`.

## (c) Constrângeri — vezi blocul `constrangeri` din `attendance_entries`, plus cele care NU pot fi CHECK

`CHECK` nu poate folosi `now()` (nu e IMMUTABLE) și nu poate citi `attendance_settings`. Deci:

```sql
create or replace function attendance_guard_business()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int; v_hire date; v_end date;
begin
  -- fără ore în viitor (fus orar al firmei, toleranță 1 minut pentru drift de ceas)
  if new.work_end > (now() at time zone 'Europe/Bucharest') + interval '1 minute' then
    raise exception 'Nu se poate ponta în viitor: intervalul se termină la %.',
      to_char(new.work_end, 'DD.MM.YYYY HH24:MI') using errcode = 'P0001';
  end if;

  -- limită maximă ore/zi, din versiunea de setări atașată rândului
  select max_daily_minutes into v_max from attendance_settings where id = new.settings_version_id;
  if new.worked_minutes > v_max then
    raise exception 'Depășire limită zilnică: % ore lucrate, maxim admis % ore.',
      round(new.worked_minutes/60.0, 2), round(v_max/60.0, 2) using errcode = 'P0001';
  end if;

  -- total pe zi (mai multe intervale) sub aceeași limită
  if (select coalesce(sum(worked_minutes),0) from attendance_entries e
      where e.employee_id = new.employee_id and e.work_date = new.work_date
        and e.deleted_at is null and e.status <> 'respins' and e.id <> new.id) + new.worked_minutes > v_max then
    raise exception 'Totalul orelor din data % depășește limita zilnică.', to_char(new.work_date,'DD.MM.YYYY');
  end if;

  -- ziua trebuie să cadă în perioada de angajare
  select hired_on, terminated_on into v_hire, v_end from employees where id = new.employee_id;
  if new.work_date < v_hire or (v_end is not null and new.work_date > v_end) then
    raise exception 'Data % este în afara perioadei de angajare.', to_char(new.work_date,'DD.MM.YYYY');
  end if;

  -- period_id trebuie să corespundă lunii din work_date
  if not exists (select 1 from attendance_periods p where p.id = new.period_id
                 and p.organization_id = new.organization_id
                 and p.year = extract(year from new.work_date)::int
                 and p.month = extract(month from new.work_date)::int) then
    raise exception 'Perioada atașată nu corespunde datei pontajului.';
  end if;
  return new;
end $$;

create trigger trg_attendance_entries_business
before insert or update on attendance_entries
for each row execute function attendance_guard_business();
```

## (d) Blocarea perioadei — impusă în DB, pe două straturi

```sql
-- 1. helper: perioada lipsă = deschisă
create or replace function attendance_period_status_for(p_org uuid, p_date date)
returns attendance_period_status
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.status from attendance_periods p
      where p.organization_id = p_org
        and p.year  = extract(year  from p_date)::int
        and p.month = extract(month from p_date)::int
        and p.deleted_at is null),
    'open'::attendance_period_status);
$$;

-- 2. trigger care prinde ORICE scriere, inclusiv service_role și Edge Functions (RLS le ocolește)
create or replace function attendance_guard_locked_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_date date;
begin
  if coalesce(current_setting('app.bypass_period_lock', true), 'off') = 'on' then
    return case tg_op when 'DELETE' then old else new end;   -- doar în funcțiile de lock/reopen/recalcul
  end if;

  if tg_op in ('UPDATE','DELETE') then
    if attendance_period_status_for(old.organization_id, old.work_date) = 'locked' then
      raise exception 'Perioada de pontaj %.% este blocată; modificarea nu este permisă.',
        lpad(extract(month from old.work_date)::text,2,'0'), extract(year from old.work_date)
        using errcode = 'P0001', hint = 'Cere unui org_admin redeschiderea perioadei.';
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') then
    if attendance_period_status_for(new.organization_id, new.work_date) = 'locked' then
      raise exception 'Perioada de pontaj %.% este blocată; înregistrarea nu este permisă.',
        lpad(extract(month from new.work_date)::text,2,'0'), extract(year from new.work_date)
        using errcode = 'P0001';
    end if;
  end if;

  return case tg_op when 'DELETE' then old else new end;
end $$;

create trigger trg_attendance_entries_locked
before insert or update or delete on attendance_entries
for each row execute function attendance_guard_locked_period();
```

Al doilea strat este RLS: predicatul `attendance_period_status_for(organization_id, work_date) = 'open'` apare deja în politicile INSERT/UPDATE. Ambele sunt necesare: **RLS** dă comportament curat (0 rânduri afectate) pentru clientul `anon`/`authenticated`, **trigger-ul** dă un mesaj de eroare explicit și acoperă căile care ocolesc RLS (`service_role`, funcții `SECURITY DEFINER`, joburi `pg_cron`).

Redeschiderea, cu urmă:

```sql
create or replace function attendance_reopen_period(p_period_id uuid, p_reason text)
returns attendance_periods
language plpgsql security definer set search_path = public as $$
declare v_row attendance_periods;
begin
  if length(coalesce(btrim(p_reason), '')) < 10 then
    raise exception 'Motivul redeschiderii este obligatoriu (minim 10 caractere).';
  end if;

  select * into v_row from attendance_periods
   where id = p_period_id and deleted_at is null for update;
  if not found then raise exception 'Perioada nu există.'; end if;
  if v_row.status <> 'locked' then raise exception 'Perioada nu este blocată.'; end if;
  if not has_permission(v_row.organization_id, 'attendance.period.reopen') then
    raise exception 'Nu ai dreptul să redeschizi perioade de pontaj.' using errcode = '42501';
  end if;

  perform set_config('app.bypass_period_lock', 'on', true);   -- true = doar pe tranzacția curentă

  update attendance_periods set
    status = 'open', locked_by = null, locked_at = null,
    reopen_reason = p_reason, reopened_by = auth.uid(), reopened_at = now(),
    reopen_count = reopen_count + 1, updated_at = now(), updated_by = auth.uid()
  where id = p_period_id returning * into v_row;

  insert into audit_log (organization_id, actor_id, entity, entity_id, action, payload, occurred_at)
  values (v_row.organization_id, auth.uid(), 'attendance_periods', v_row.id, 'perioada_redeschisa',
          jsonb_build_object('an', v_row.year, 'luna', v_row.month, 'motiv', p_reason,
                             'reopen_count', v_row.reopen_count,
                             'snapshot_la_blocare', v_row.lock_snapshot), now());
  return v_row;
end $$;
```

`attendance_lock_period()` este simetrică: setează `status='locked'`, `locked_by/locked_at`, calculează `lock_snapshot` (totaluri per angajat) și scrie `perioada_blocata` în `audit_log`. Refuză blocarea dacă mai există rânduri cu `status = 'trimis'`.

## (e) Aprobarea în bloc

Ce face exact:
1. Verifică permisiunea și că perioada e `open`.
2. Inserează antetul în `attendance_approval_batches` cu `filter_snapshot` (perioada, angajați, departament, interval de zile) — fotografia intenției.
3. Un singur `UPDATE ... RETURNING` peste rândurile eligibile: `status = 'trimis'`, `deleted_at IS NULL`, angajat în aria de responsabilitate a aprobatorului. Setează `status='aprobat'`, `approved_by=auth.uid()`, `approved_at=now()`, `approval_batch_id`.
4. Rândurile neeligibile (peste limita lunară de suplimentare, zile cu suprapuneri, angajați fără contract activ) rămân `trimis` și se întorc în `skipped_reasons` — aprobarea în bloc nu ascunde niciodată o excepție.
5. Actualizează contoarele și totalurile pe batch.

Cum rămâne auditabilă **per rând**: fiecare rând păstrează `approved_by` / `approved_at` proprii (nu doar legătura la batch), iar un trigger `AFTER UPDATE FOR EACH ROW` scrie o intrare separată în `audit_log` pentru fiecare tranziție de stare:

```sql
create or replace function attendance_audit_entry_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into audit_log (organization_id, actor_id, entity, entity_id, action, payload, occurred_at)
    values (new.organization_id, auth.uid(), 'attendance_entries', new.id,
            'pontaj_status_' || old.status || '_' || new.status,
            jsonb_build_object(
              'employee_id', new.employee_id, 'work_date', new.work_date,
              'worked_minutes', new.worked_minutes, 'overtime_minutes', new.overtime_minutes,
              'day_type', new.day_type, 'batch_id', new.approval_batch_id,
              'motiv_respingere', new.rejection_reason,
              'settings_version_id', new.settings_version_id), now());
  end if;
  return new;
end $$;

create trigger trg_attendance_entries_audit
after update on attendance_entries
for each row execute function attendance_audit_entry_status();
```
Deci: 200 de rânduri aprobate în bloc ⇒ 1 batch + 200 de rânduri de audit. Se poate răspunde atât la „cine a aprobat luna martie” cât și la „cine a aprobat exact ziua de 17 martie a lui Popescu”.

## (f) Prepopularea zilelor auto — recomandare

**O singură funcție idempotentă, chemată din trei locuri.** Nu alege între trigger / job / deschiderea lunii — ai nevoie de toate trei, dar cu o singură implementare:

```
attendance_sync_auto_entries(p_org uuid, p_from date, p_to date, p_employee_id uuid default null)
```
Funcția face `INSERT ... ON CONFLICT (source, source_ref_id, employee_id, work_date) DO UPDATE` din `leave_requests` aprobate și din `legal_holidays ∪ organization_non_working_days`, și *soft-delete* pe rândurile `source <> 'manual'` care nu mai au sursă validă. Rulează cu `app.bypass_period_lock = 'off'` — nu atinge lunile blocate.

Declanșatoare, în ordinea importanței:
1. **La aprobarea concediului** (trigger `AFTER UPDATE` pe `leave_requests` când `status → 'aprobat'`, sau apel explicit în Server Action-ul de aprobare, în aceeași tranzacție). Motiv: e un eveniment discret, cu consecință imediat vizibilă în calendarul angajatului. Dacă aștepți un job, angajatul își pontează manual o zi pe care tocmai și-a luat-o liberă și primești o coliziune inutilă. Simetric la revocare/anulare.
2. **La deschiderea perioadei** (`attendance_open_period()` apelează sincronizarea pentru toată luna). Motiv: sărbătorile legale sunt cunoscute cu un an înainte, dar nu au sens ca rânduri într-o lună care nu există încă. Deschiderea lunii e momentul natural în care calendarul devine material.
3. **Job `pg_cron` nocturn** (03:15 Europe/Bucharest) pentru luna curentă și cea precedentă, ca reconciliere. Motiv: acoperă schimbările retroactive — sărbătoare adăugată de platformă, zi liberă acordată de firmă, concediu revocat, angajat adăugat la mijlocul lunii, un trigger care a eșuat.

Needitabile ca zile lucrate: rândurile auto au `source <> 'manual'`, iar politica INSERT de pe `attendance_entries` cere `source = 'manual'` — clientul nu le poate crea. Modificarea lor e respinsă de `attendance_guard_columns`:
```sql
if old.source <> 'manual' and (new.start_time, new.end_time, new.break_minutes, new.work_date, new.day_type, new.worked_minutes)
   is distinct from (old.start_time, old.end_time, old.break_minutes, old.work_date, old.day_type, old.worked_minutes) then
  raise exception 'Zilele generate automat (% ) nu pot fi editate ca ore lucrate.', old.source;
end if;
```
`worked_minutes = 0`, `overtime_minutes = 0` pe aceste rânduri; ele contează la prezență, nu la ore plătite ca muncă.

## (g) Query de alertă: angajați care nu au pontat de X zile

```sql
create or replace function attendance_missing_alerts(p_org uuid, p_grace_days int default null)
returns table (
  employee_id uuid, full_name text, department_id uuid,
  last_entry_date date, missing_working_days int, missing_dates date[]
)
language sql stable security definer set search_path = public as $$
with cfg as (
  select coalesce(p_grace_days, s.grace_days) as grace
  from attendance_settings s
  where s.organization_id = p_org and s.deleted_at is null and s.valid_from <= current_date
  order by s.valid_from desc limit 1
),
cal as (   -- zile lucrătoare, cea mai recentă = rn 1
  select d::date as work_date,
         row_number() over (order by d desc) as rn
  from generate_series(current_date - interval '60 days', current_date - interval '1 day', interval '1 day') d
  where extract(isodow from d) < 6
    and not exists (select 1 from legal_holidays h
                     where h.holiday_date = d::date and h.country_code = 'RO' and h.deleted_at is null)
    and not exists (select 1 from organization_non_working_days o
                     where o.organization_id = p_org and o.holiday_date = d::date and o.deleted_at is null)
),
emp as (
  select e.id, e.full_name, e.department_id, e.hired_on,
         coalesce(e.terminated_on, 'infinity'::date) as ends_on
  from employees e
  where e.organization_id = p_org and e.deleted_at is null and e.is_active
),
missing as (
  select emp.id, emp.full_name, emp.department_id, cal.work_date, cal.rn
  from emp
  cross join cal
  cross join cfg
  where cal.rn <= cfg.grace
    and cal.work_date between emp.hired_on and emp.ends_on
    and not exists (
      select 1 from attendance_entries a
      where a.organization_id = p_org and a.employee_id = emp.id
        and a.work_date = cal.work_date and a.deleted_at is null and a.status <> 'respins')
)
select m.id, m.full_name, m.department_id,
       (select max(a.work_date) from attendance_entries a
         where a.employee_id = m.id and a.deleted_at is null and a.status <> 'respins'),
       count(*)::int,
       array_agg(m.work_date order by m.work_date desc)
from missing m, cfg
group by m.id, m.full_name, m.department_id, cfg.grace
having count(*) = cfg.grace       -- TOATE ultimele `grace` zile lucrătoare lipsesc
order by 5 desc, 2;
$$;
```
Rulat zilnic de `pg_cron` (07:30) → e-mail Resend către manager și hr, agregat pe departament. Alertele se scriu în `notifications` cu cheie de deduplicare `(employee_id, last_entry_date)` ca să nu se trimită zilnic același mesaj.

## (h) Export „Foaie colectivă de prezență”

**Excel (exceljs), 3 foi.**

Foaie 1 — `Foaie colectivă`:
- Antet (celule fuzionate, deasupra grilei): Denumire angajator, CUI, Nr. Reg. Com., Adresă punct de lucru, **Luna / Anul** (`martie 2026`), Normă zilnică (ore), Nr. angajați, Generat la (`17.03.2026 14:05`), Generat de (nume + rol), ID export (uuid, apare și în `audit_log`).
- Grilă, un rând per angajat: `Nr. crt.` | `Marcă` | `Nume și prenume` | `Funcție` | `Departament` | `Normă (h/zi)` | coloane `1`…`31` (una per zi, header pe două rânduri: cifra zilei + inițiala zilei săptămânii `L M M J V S D`, weekendurile și sărbătorile cu fundal gri).
- Conținut celulă zi: numărul de ore lucrate (`8`, `7,5`) sau simbol: `CO` concediu de odihnă, `CM` concediu medical, `CFP` fără plată, `CFS` fără salariu/eveniment, `SL` sărbătoare legală, `L` zi liberă, `A` absent nemotivat, `D` delegație, `–` în afara perioadei de angajare. Ore de noapte marcate cu sufix `N` (`8N`).
- Coloane de total, la dreapta: `Zile lucrate`, `Ore lucrate (normal)`, `Ore suplimentare`, `Ore noapte`, `Ore weekend`, `Ore sărbătoare legală`, `Total ore plătibile`, `Zile CO`, `Zile CM`, `Zile CFP`, `Zile absente`, `Zile SL`.
- Rând final `TOTAL GENERAL` cu sumele pe coloane.
- Subsol: `Întocmit` / `Verificat` / `Aprobat` (nume, funcție, semnătură, dată), plus mențiunea stării perioadei: `Perioadă blocată la 05.04.2026 de Ionescu Maria` sau `ATENȚIE: perioadă deschisă — date provizorii`.
- Formate: ore `#.##0,00` (separator zecimal virgulă), date `dd.MM.yyyy`, freeze panes pe primele 3 coloane + 2 rânduri de header, `autoFilter` pe grilă, lățimi fixate, print setup A4 landscape cu rânduri de header repetate.

Foaie 2 — `Detaliu`: un rând per `attendance_entries`, pentru verificare punctuală: `Marcă`, `Nume`, `Data`, `Ziua`, `Ora început`, `Ora sfârșit`, `Pauză (min)`, `Ore brute`, `Ore lucrate`, `Ore suplimentare`, `Ore noapte`, `Tip zi`, `Sursă`, `Status`, `Trimis la`, `Aprobat de`, `Aprobat la`, `ID lot aprobare`, `Motiv respingere`, `Observații`.

Foaie 3 — `Legendă`: simbolurile, versiunea de setări folosită (`settings_version_id`, `valid_from`, normă, prag suplimentare, fereastră noapte) — ca un control să poată reface calculul.

**PDF** (aceleași date, generat server-side): A4 **landscape**, header repetat pe fiecare pagină (angajator + luna + coloanele de zile), max ~25 angajați/pagină, `Pagina X din Y`, blocul de semnături doar pe ultima pagină, iar în subsolul fiecărei pagini `ID export` + data generării. Fără foaia `Detaliu` (opțional, ca anexă). Diacritice: font încorporat cu suport complet `ș ț ă î â` (nu font standard PDF).

Reguli comune: exportul unei perioade `open` primește filigran `PROVIZORIU`; orice export scrie un rând în `audit_log` (`action='export_foaie_prezenta'`, payload cu `period_id`, filtre, nr. angajați); CNP-ul **nu** apare niciodată în export (marca angajatului e suficientă pentru contabilitate), iar dacă furnizorul de salarizare îl cere, este o opțiune separată, permisă doar `hr`/`org_admin`, cu audit distinct pe fiecare CNP citit din `employee_sensitive_data`.