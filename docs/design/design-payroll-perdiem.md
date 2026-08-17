CONVENȚII SUPLIMENTARE (o singură dată):
- Cote procentuale: `numeric(6,4)` ca fracție (0.2500 = 25%). Sume: `numeric(14,2)`. Cursuri valutare: `numeric(12,6)`.
- Integritate multi-tenant pe FK-uri între tabele de business: FK compus `(organization_id, x_id) -> tabela(organization_id, id)` (necesită UNIQUE(organization_id, id) pe părinte). Elimină clasa de bug „referință către rândul altui tenant".
- Nomenclatoarele de platformă (`countries`, baremul HG) nu au `organization_id`; sunt read-only pentru `authenticated`, scriere doar `super_admin`.
- Toate tabelele: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`, fără policy pentru DELETE (soft delete).

ENUM-URI NOI:
```
payroll_period_status      : draft | calculat | aprobat | inchis
payroll_entry_status       : draft | calculat | blocat
payroll_bonus_type         : prima_performanta | prima_proiect | prima_vacanta | spor_conditii | diurna_peste_plafon | avantaj_in_natura | alta
payroll_deduction_type     : avans | poprire | imputatie | rata_interna | retinere_sindicat | cotizatie | alta
meal_voucher_tax_treatment : impozit_si_cass | doar_impozit | neimpozabil
meal_voucher_grant_rule    : zile_lucrate_efectiv | zile_prezenta_pontaj | zile_lucratoare_luna
personal_deduction_kind    : procent_din_salariu_minim | suma_fixa | degresiv_liniar
per_diem_scope             : intern | extern
per_diem_ceiling_rule      : multiplu_barem_institutii_publice | plafon_procent_salarii_baza | plafon_fix | fara_plafon
partial_day_rule           : prag_ore | zile_calendaristice | ore_impartite_la_24
business_trip_status       : cerere | aprobat | in_desfasurare | decontat | respins | anulat
trip_expense_type          : cazare | transport | combustibil | taxe_drum | viza_asigurare | altele
transport_means            : auto_firma | auto_personal | avion | tren | autocar | altele
```

AVERTISMENT UI (obligatoriu, banner persistent pe toate ecranele `/payroll` + în footer-ul PDF fluturaș):
> „Modulul Salarii este un instrument intern de calcul și evidență. NU este software de salarizare certificat. Nu înlocuiește Revisal, declarația D112, statul de plată oficial sau avizul contabilului. Toate valorile legale se configurează de organizație și se verifică de contabilul autorizat înainte de plată."

---

# MODUL SALARII (feature: payroll)

### payroll_settings
scop: setul versionat de parametri fiscali și de calcul al organizației, valabil de la o dată calendaristică.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  valabil_de_la date NOT NULL
  cota_cas numeric(6,4) NOT NULL
  cota_cass numeric(6,4) NOT NULL
  cota_impozit numeric(6,4) NOT NULL
  cota_cam_angajator numeric(6,4) NOT NULL
  salariu_minim_brut numeric(14,2) NOT NULL
  norma_zilnica_ore numeric(4,2) NOT NULL DEFAULT 8
  procent_spor_noapte numeric(6,4) NOT NULL DEFAULT 0.25
  procent_spor_weekend numeric(6,4) NOT NULL DEFAULT 0
  procent_ore_supl_primele numeric(6,4) NOT NULL DEFAULT 0.75
  procent_ore_supl_urmatoarele numeric(6,4) NOT NULL DEFAULT 1.00
  valoare_tichet_masa numeric(14,2) NOT NULL DEFAULT 0
  tichete_tratament_fiscal meal_voucher_tax_treatment NOT NULL DEFAULT 'impozit_si_cass'
  tichete_regula_acordare meal_voucher_grant_rule NOT NULL DEFAULT 'zile_lucrate_efectiv'
  tichete_exclude_zile_concediu boolean NOT NULL DEFAULT true
  tichete_exclude_zile_delegatie boolean NOT NULL DEFAULT true
  plafon_neimpozabil_lunar_cumulat numeric(14,2) NULL
  rotunjire_lei boolean NOT NULL DEFAULT true
  calc_engine_version text NOT NULL
  verificat_de_contabil boolean NOT NULL DEFAULT false
  verificat_la timestamptz NULL
  note text NULL
```
constrângeri: `UNIQUE(organization_id, valabil_de_la) WHERE deleted_at IS NULL`; `CHECK (cota_cas BETWEEN 0 AND 1 AND cota_cass BETWEEN 0 AND 1 AND cota_impozit BETWEEN 0 AND 1 AND cota_cam_angajator BETWEEN 0 AND 1)`; `CHECK (salariu_minim_brut > 0)`; `UNIQUE(organization_id, id)`
indexuri: `(organization_id, valabil_de_la DESC) WHERE deleted_at IS NULL`
rls: SELECT = `has_perm(org,'payroll.settings.view')`; INSERT/UPDATE = `has_perm(org,'payroll.settings.manage')` (org_admin); UPDATE blocat de trigger dacă versiunea e deja referită de un `payroll_periods` cu status <> 'draft'.
notă: rezolvarea versiunii se face cu `ORDER BY valabil_de_la DESC LIMIT 1` pentru `valabil_de_la <= data_referinta` (ultima zi a lunii de plată). Nu se folosește `daterange` cu `valabil_pana_la`, ca să nu existe „găuri" între versiuni.

### payroll_personal_deduction_brackets
scop: pragurile de venit × persoane în întreținere din care rezultă deducerea personală.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  settings_id uuid NOT NULL FK->payroll_settings(id) RESTRICT
  nr_persoane_intretinere smallint NOT NULL
  venit_brut_min numeric(14,2) NOT NULL
  venit_brut_max numeric(14,2) NULL           -- NULL = fara plafon superior
  tip personal_deduction_kind NOT NULL
  valoare numeric(14,4) NOT NULL              -- procent (0.20) sau suma fixa
  degresiv_pana_la numeric(14,2) NULL         -- capat superior pentru interpolare liniara
  ordine smallint NOT NULL DEFAULT 0
```
constrângeri: `CHECK (nr_persoane_intretinere BETWEEN 0 AND 10)`; `CHECK (venit_brut_max IS NULL OR venit_brut_max > venit_brut_min)`; `CHECK (tip <> 'degresiv_liniar' OR degresiv_pana_la IS NOT NULL)`; `EXCLUDE USING gist (settings_id WITH =, nr_persoane_intretinere WITH =, numrange(venit_brut_min, COALESCE(venit_brut_max,'Infinity'::numeric), '[)') WITH &&) WHERE (deleted_at IS NULL)`; FK compus `(organization_id, settings_id)`
indexuri: `(settings_id, nr_persoane_intretinere, venit_brut_min) WHERE deleted_at IS NULL`
rls: identic cu `payroll_settings`.

**JUSTIFICARE tabelă vs jsonb:** aleg **tabelă de praguri**, din patru motive care nu se pot obține cu jsonb:
1. **Non-suprapunerea intervalelor e o constrângere de integritate reală**, iar Postgres o poate impune cu `EXCLUDE ... USING gist` pe `numrange`. Într-un jsonb, două intervale suprapuse trec neobservate până în ziua în care un angajat pică exact la graniță și primește o deducere greșită — eroare care se descoperă la control, nu la deploy.
2. **Auditul e pe rând.** Când ANAF schimbă un singur prag, jurnalul de audit arată exact ce prag s-a schimbat, de cine, când — nu „câmpul jsonb a fost modificat".
3. **Import/export CSV.** La fiecare modificare legislativă contabilul primește un fișier de verificat și îl reimportă. Un jsonb ar cere un editor dedicat în UI.
4. **Interogabilitate.** Rapoartele de tip „câți angajați sunt în pragul X" și validările „există acoperire pentru toate combinațiile 0–4 persoane?" sunt un `SELECT`, nu o funcție de parcurgere a jsonb.
Jsonb rămâne folosit **exclusiv** unde nu se interoghează niciodată și unde imutabilitatea e scopul: `payroll_entries.settings_snapshot`.

### payroll_periods
scop: luna de salarizare a unei organizații, cu ciclul ei de viață și legătura obligatorie la perioada de pontaj.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  an smallint NOT NULL
  luna smallint NOT NULL
  attendance_period_id uuid NOT NULL FK->attendance_periods(id) RESTRICT
  settings_id uuid NOT NULL FK->payroll_settings(id) RESTRICT
  status payroll_period_status NOT NULL DEFAULT 'draft'
  data_plata date NULL
  calculat_de uuid NULL FK->auth.users(id)
  calculat_la timestamptz NULL
  aprobat_de uuid NULL FK->auth.users(id)
  aprobat_la timestamptz NULL
  inchis_de uuid NULL FK->auth.users(id)
  inchis_la timestamptz NULL
  total_brut numeric(14,2) NOT NULL DEFAULT 0
  total_net numeric(14,2) NOT NULL DEFAULT 0
  total_cost_angajator numeric(14,2) NOT NULL DEFAULT 0
  observatii text NULL
```
constrângeri: `UNIQUE(organization_id, an, luna) WHERE deleted_at IS NULL`; `CHECK (luna BETWEEN 1 AND 12)`; `CHECK (an BETWEEN 2020 AND 2100)`; `CHECK (status <> 'aprobat' OR aprobat_de IS NOT NULL)`; `UNIQUE(organization_id, id)`; FK compuse pe `attendance_period_id` și `settings_id`
indexuri: `(organization_id, status) WHERE deleted_at IS NULL`; `(organization_id, an DESC, luna DESC)`
rls: SELECT = `has_perm(org,'payroll.view_all') OR has_perm(org,'payroll.view_own')`; INSERT/UPDATE = `has_perm(org,'payroll.manage')`; tranziția în `aprobat` cere `payroll.approve` (separare de atribuții: cine calculează ≠ cine aprobă).
notă: `inchis` e terminal. Orice corecție ulterioară se face printr-o perioadă de regularizare separată (an/luna + `is_regularizare`), niciodată prin redeschidere — altfel istoricul declarat devine nereproductibil.

### payroll_entries
scop: rezultatul calculului pentru un angajat într-o perioadă, împreună cu fotografia setărilor folosite.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  period_id uuid NOT NULL FK->payroll_periods(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  status payroll_entry_status NOT NULL DEFAULT 'draft'
  salariu_baza numeric(14,2) NOT NULL DEFAULT 0
  zile_lucratoare_luna smallint NOT NULL
  zile_lucrate numeric(6,2) NOT NULL DEFAULT 0
  zile_concediu numeric(6,2) NOT NULL DEFAULT 0
  zile_absente numeric(6,2) NOT NULL DEFAULT 0
  ore_lucrate numeric(8,2) NOT NULL DEFAULT 0
  ore_suplimentare numeric(8,2) NOT NULL DEFAULT 0
  ore_noapte numeric(8,2) NOT NULL DEFAULT 0
  ore_weekend numeric(8,2) NOT NULL DEFAULT 0
  suma_ore_suplimentare numeric(14,2) NOT NULL DEFAULT 0
  spor_noapte numeric(14,2) NOT NULL DEFAULT 0
  spor_weekend numeric(14,2) NOT NULL DEFAULT 0
  indemnizatie_concediu numeric(14,2) NOT NULL DEFAULT 0
  prime_total numeric(14,2) NOT NULL DEFAULT 0
  retineri_total numeric(14,2) NOT NULL DEFAULT 0
  nr_tichete smallint NOT NULL DEFAULT 0
  valoare_tichete numeric(14,2) NOT NULL DEFAULT 0
  brut numeric(14,2) NOT NULL DEFAULT 0
  baza_impozabila numeric(14,2) NOT NULL DEFAULT 0
  deducere_personala numeric(14,2) NOT NULL DEFAULT 0
  cas numeric(14,2) NOT NULL DEFAULT 0
  cass numeric(14,2) NOT NULL DEFAULT 0
  impozit numeric(14,2) NOT NULL DEFAULT 0
  cam_angajator numeric(14,2) NOT NULL DEFAULT 0
  net numeric(14,2) NOT NULL DEFAULT 0
  net_de_plata numeric(14,2) NOT NULL DEFAULT 0
  cost_total_angajator numeric(14,2) NOT NULL DEFAULT 0
  settings_snapshot jsonb NOT NULL
  calc_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb
  calc_warnings jsonb NOT NULL DEFAULT '[]'::jsonb
  calculat_la timestamptz NULL
```
constrângeri: `UNIQUE(organization_id, period_id, employee_id) WHERE deleted_at IS NULL`; `CHECK (brut >= 0 AND net >= 0 AND cost_total_angajator >= brut)`; `CHECK (zile_lucrate + zile_concediu + zile_absente <= zile_lucratoare_luna + 0.01)`; `CHECK (jsonb_typeof(settings_snapshot) = 'object')`; FK compuse pe `period_id` și `employee_id`
indexuri: `(organization_id, period_id) WHERE deleted_at IS NULL`; `(organization_id, employee_id, period_id) WHERE deleted_at IS NULL`
rls: vezi (c).
notă: `net_de_plata = net - retineri_total`. Sunt coloane distincte pentru că fluturașul afișează ambele, iar viramentul bancar folosește doar `net_de_plata`.

### payroll_bonuses
scop: elemente variabile pozitive alocate unui angajat pe o perioadă, aprobate separat de calcul.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  period_id uuid NOT NULL FK->payroll_periods(id) RESTRICT
  tip payroll_bonus_type NOT NULL
  suma numeric(14,2) NOT NULL
  motiv text NOT NULL
  impozabil boolean NOT NULL DEFAULT true
  supus_contributii boolean NOT NULL DEFAULT true
  sursa_tabela text NULL          -- ex. 'business_trips'
  sursa_id uuid NULL              -- trasabilitate diurna peste plafon
  aprobat_de uuid NULL FK->auth.users(id)
  aprobat_la timestamptz NULL
```
constrângeri: `CHECK (suma > 0)`; `CHECK (aprobat_la IS NULL) = (aprobat_de IS NULL)`; FK compuse pe `employee_id`, `period_id`
indexuri: `(organization_id, period_id, employee_id) WHERE deleted_at IS NULL`; `(organization_id, sursa_tabela, sursa_id) WHERE sursa_id IS NOT NULL`
rls: SELECT = `has_perm(org,'payroll.view_all') OR (employee_id = current_employee_id(org))`; INSERT/UPDATE = `has_perm(org,'payroll.manage')`; aprobarea cere `payroll.approve`. Blocat de trigger dacă perioada nu e `draft`.
notă: primele neaprobate NU intră în calcul. Motorul filtrează `aprobat_la IS NOT NULL` — regula trăiește în funcția pură, nu în query.

### payroll_deductions
scop: rețineri recurente sau punctuale din net (avansuri, popriri, rate interne).
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  period_id uuid NULL FK->payroll_periods(id) RESTRICT   -- NULL = recurent
  tip payroll_deduction_type NOT NULL
  suma numeric(14,2) NOT NULL
  suma_totala_de_retinut numeric(14,2) NULL
  suma_retinuta_pana_acum numeric(14,2) NOT NULL DEFAULT 0
  procent_maxim_din_net numeric(6,4) NULL
  motiv text NOT NULL
  document_referinta text NULL
  activ_de_la date NOT NULL
  activ_pana_la date NULL
  prioritate smallint NOT NULL DEFAULT 100
  aprobat_de uuid NULL FK->auth.users(id)
```
constrângeri: `CHECK (suma > 0)`; `CHECK (activ_pana_la IS NULL OR activ_pana_la >= activ_de_la)`; `CHECK (procent_maxim_din_net IS NULL OR procent_maxim_din_net <= 1)`
indexuri: `(organization_id, employee_id, activ_de_la) WHERE deleted_at IS NULL`
rls: identic cu `payroll_bonuses`.
notă: popririle au plafon legal cumulat pe net. Plafonul e o valoare de configurare (`procent_maxim_din_net`), nu o constantă în cod, și se aplică în ordinea `prioritate`.

### payslip_views
scop: dovadă că angajatul a deschis și confirmat fluturașul (obligație de comunicare).
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  entry_id uuid NOT NULL FK->payroll_entries(id) RESTRICT
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  user_id uuid NOT NULL FK->auth.users(id)
  vazut_la timestamptz NOT NULL DEFAULT now()
  confirmat_la timestamptz NULL
  ip inet NULL
  user_agent text NULL
  hash_document text NOT NULL
```
constrângeri: `UNIQUE(organization_id, entry_id, user_id, vazut_la)`; FK compus pe `entry_id`
indexuri: `(organization_id, entry_id)`; `(organization_id, employee_id, vazut_la DESC)`
rls: SELECT = `has_perm(org,'payroll.view_all') OR employee_id = current_employee_id(org)`; INSERT = `employee_id = current_employee_id(org)`; **fără UPDATE, fără DELETE** (append-only, e probă).
notă: `hash_document` = SHA-256 al PDF-ului servit. Dacă fluturașul se regenerează după o regularizare, hash-ul diferă și se vede că angajatul a confirmat altă versiune.

---

## (a) Constrângerea „fără calcul peste pontaj nefinalizat" — impusă în DB

```sql
create or replace function public.payroll_guard_attendance_finalized()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status attendance_period_status;
  v_an smallint; v_luna smallint;
  v_nefinalizate integer;
begin
  if new.status = 'draft' then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  if new.status not in ('calculat','aprobat','inchis') then return new; end if;

  select ap.status, ap.an, ap.luna into v_status, v_an, v_luna
  from attendance_periods ap
  where ap.id = new.attendance_period_id
    and ap.organization_id = new.organization_id
    and ap.deleted_at is null;

  if v_status is null then
    raise exception 'Perioada de pontaj legată nu există sau a fost ștearsă.'
      using errcode = '23514', hint = 'Selectați o perioadă de pontaj validă.';
  end if;
  if v_an <> new.an or v_luna <> new.luna then
    raise exception 'Perioada de pontaj (%/%) nu corespunde perioadei de salarizare (%/%).',
      v_luna, v_an, new.luna, new.an using errcode = '23514';
  end if;
  if v_status <> 'aprobat' then
    raise exception 'Pontajul pentru %/% are statusul "%". Salariile se pot calcula doar peste un pontaj aprobat.',
      v_luna, v_an, v_status using errcode = '23514';
  end if;

  select count(*) into v_nefinalizate
  from attendance_entries ae
  where ae.organization_id = new.organization_id
    and ae.period_id = new.attendance_period_id
    and ae.deleted_at is null
    and ae.status <> 'aprobat';
  if v_nefinalizate > 0 then
    raise exception 'Există % pontaje neaprobate în perioada %/%.',
      v_nefinalizate, v_luna, v_an using errcode = '23514';
  end if;

  select count(*) into v_nefinalizate
  from leave_requests lr
  where lr.organization_id = new.organization_id
    and lr.deleted_at is null
    and lr.status = 'in_asteptare'
    and daterange(lr.data_inceput, lr.data_sfarsit, '[]')
        && daterange(make_date(new.an, new.luna, 1),
                     (make_date(new.an, new.luna, 1) + interval '1 month')::date, '[)');
  if v_nefinalizate > 0 then
    raise exception 'Există % cereri de concediu în așteptare care se suprapun peste %/%.',
      v_nefinalizate, new.luna, new.an using errcode = '23514';
  end if;

  return new;
end $$;

create trigger trg_payroll_guard_attendance
  before insert or update of status on payroll_periods
  for each row execute function public.payroll_guard_attendance_finalized();
```

Al doilea zid — nimic nu se scrie în `payroll_entries` peste o perioadă care nu mai e `draft`:

```sql
create or replace function public.payroll_guard_period_open()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status payroll_period_status;
begin
  select p.status into v_status from payroll_periods p
  where p.id = coalesce(new.period_id, old.period_id);
  if v_status is distinct from 'draft' then
    raise exception 'Perioada de salarizare este "%". Modificările nu mai sunt permise; folosiți o perioadă de regularizare.',
      v_status using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_entries_period_open
  before insert or update on payroll_entries
  for each row execute function public.payroll_guard_period_open();
-- acelasi trigger pe payroll_bonuses si payroll_deductions
```

Al treilea zid: statusul perioadei de pontaj nu poate coborî din `aprobat` dacă există o perioadă de salarizare `calculat`/`aprobat`/`inchis` legată de ea (trigger simetric pe `attendance_periods`). Fără el, cineva redeschide pontajul și invalidează tăcut un stat de plată deja aprobat.

## (b) De ce `settings_snapshot` imutabil pe fiecare entry

1. **Legea se schimbă retroactiv, dar statul de plată din martie trebuie să rămână statul din martie.** Dacă motorul citește `payroll_settings` la fiecare afișare, un fluturaș tipărit în aprilie și redeschis în noiembrie arată alte cifre — fără ca cineva să fi modificat vreun rând din `payroll_entries`. Aceasta e definiția unui istoric fals.
2. **Reproductibilitate la control.** Un inspector cere „arătați cum a rezultat 4.312,55 lei". Cu snapshot, răspunsul e `calculatePayrollEntry(snapshot, pontaj_arhivat)` → aceleași cifre, bit cu bit. Fără snapshot, răspunsul depinde de starea curentă a unei tabele care s-a schimbat între timp.
3. **Versiunea motorului contează la fel de mult ca cotele.** Snapshot-ul include `calc_engine_version`; o corecție de rotunjire în cod nu trebuie să rescrie tăcut trecutul.
4. **Recalculul retroactiv devine o decizie explicită, nu un accident.** Cu snapshot, recalcularea unei luni închise cere o perioadă de regularizare, un utilizator cu `payroll.approve` și un `diff` vizibil între snapshot vechi și nou. Fără snapshot, „recalculul" se întâmplă la fiecare `SELECT` și nimeni nu-l observă.
5. **FK-urile nu sunt suficiente.** `settings_id` protejează doar dacă `payroll_settings` e imutabil — iar el nu e: cineva corectează un typo într-o cotă. Snapshot-ul e apărarea împotriva `UPDATE`-ului pe părinte.
Costul (câțiva KB jsonb pe angajat pe lună) e neglijabil față de riscul.

## (c) RLS pentru vizibilitatea salariilor — SQL real

```sql
-- helper: permisiune efectiva din role_permissions, pe TOATE rolurile userului in acea org
create or replace function public.has_perm(p_org uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from organization_members m
    join role_permissions rp
      on rp.organization_id = m.organization_id
     and rp.role = m.role
    where m.user_id = auth.uid()
      and m.organization_id = p_org
      and m.status = 'activ'
      and m.deleted_at is null
      and rp.permission = p_perm
      and rp.allowed is true
      and rp.deleted_at is null
  );
$$;
revoke execute on function public.has_perm(uuid,text) from public, anon;
grant execute on function public.has_perm(uuid,text) to authenticated;

create or replace function public.current_employee_id(p_org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.id from employees e
  where e.organization_id = p_org and e.user_id = auth.uid() and e.deleted_at is null
  limit 1;
$$;

create or replace function public.is_manager_of(p_org uuid, p_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with me as (select public.current_employee_id(p_org) as id)
  select exists (
    select 1 from employees e, me
    where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null
      and me.id is not null
      and ( e.manager_id = me.id
            or e.department_id in (
                 select d.id from departments d
                 where d.organization_id = p_org and d.manager_id = me.id and d.deleted_at is null) )
  );
$$;

alter table payroll_entries enable row level security;
alter table payroll_entries force  row level security;

create policy payroll_entries_select on payroll_entries
for select to authenticated
using (
  public.is_feature_enabled(organization_id, 'payroll')
  and (
        -- 1. hr / org_admin: vad tot
        public.has_perm(organization_id, 'payroll.view_all')

        -- 2. angajatul: doar propriul fluturas, si doar dupa aprobarea perioadei
     or ( employee_id = public.current_employee_id(organization_id)
          and public.has_perm(organization_id, 'payroll.view_own')
          and exists (select 1 from payroll_periods p
                      where p.id = payroll_entries.period_id
                        and p.status in ('aprobat','inchis')) )

        -- 3. managerul: NUMAI daca org_admin a activat explicit payroll.view_team
        --    in role_permissions, si numai pentru subordonatii directi
     or ( public.has_perm(organization_id, 'payroll.view_team')
          and public.is_manager_of(organization_id, employee_id)
          and employee_id <> public.current_employee_id(organization_id) is not false )
  )
);

create policy payroll_entries_insert on payroll_entries
for insert to authenticated
with check (
  public.is_feature_enabled(organization_id, 'payroll')
  and public.has_perm(organization_id, 'payroll.manage')
);

create policy payroll_entries_update on payroll_entries
for update to authenticated
using      ( public.has_perm(organization_id, 'payroll.manage') )
with check ( public.has_perm(organization_id, 'payroll.manage') );
-- fara policy DELETE: stergerea fizica e imposibila pentru `authenticated`
```

Seed obligatoriu în `role_permissions` (per organizație, la creare din Super-Admin):
```
org_admin : payroll.view_all=true, payroll.manage=true, payroll.approve=true, payroll.settings.manage=true, payroll.view_team=true
hr        : payroll.view_all=true, payroll.manage=true, payroll.approve=false, payroll.settings.view=true
manager   : payroll.view_all=false, payroll.view_team=FALSE, payroll.view_own=true
employee  : payroll.view_own=true
```
`payroll.view_team = false` pentru manager este **valoarea implicită și singura poartă**. Nu există `if (role === 'manager')` nicăieri în cod; org_admin schimbă un singur rând în `role_permissions` și RLS-ul se comportă altfel imediat, fără deploy.

Aceleași trei straturi se replică pentru `payslip_views`, `payroll_bonuses`, `payroll_deductions`. Server Action-ul re-verifică `has_perm` înainte de query (mesaj de eroare util în loc de listă goală), iar UI-ul ascunde meniul — dar sursa de adevăr rămâne policy-ul.

## (d) Semnătura funcției pure de calcul

```ts
// src/modules/payroll/calc/types.ts  — zero import-uri din supabase, next, date curenta
export type Bani = number & { readonly __brand: 'bani' }; // intregi, minorul valutei

export interface PayrollSettingsSnapshot {
  readonly valabilDeLa: string;              // 'yyyy-MM-dd'
  readonly cotaCas: number; readonly cotaCass: number;
  readonly cotaImpozit: number; readonly cotaCamAngajator: number;
  readonly salariuMinimBrut: Bani;
  readonly normaZilnicaOre: number;
  readonly procentSporNoapte: number; readonly procentSporWeekend: number;
  readonly procentOreSuplPrimele: number; readonly procentOreSuplUrmatoarele: number;
  readonly valoareTichetMasa: Bani;
  readonly tichete: {
    readonly tratamentFiscal: 'impozit_si_cass' | 'doar_impozit' | 'neimpozabil';
    readonly regulaAcordare: 'zile_lucrate_efectiv' | 'zile_prezenta_pontaj' | 'zile_lucratoare_luna';
    readonly excludeZileConcediu: boolean; readonly excludeZileDelegatie: boolean;
  };
  readonly deducerePersonala: readonly PersonalDeductionBracket[];
  readonly rotunjireLei: boolean;
  readonly calcEngineVersion: string;
}

export interface EmployeeContract {
  readonly employeeId: string;
  readonly salariuBaza: Bani;
  readonly normaOreSaptamana: number;
  readonly nrPersoaneIntretinere: number;
  readonly scutiri: readonly ('it' | 'constructii' | 'agricultura' | 'pensie_cass')[];
  readonly optiunePilonII: boolean;
  readonly dataAngajarii: string; readonly dataIncetarii: string | null;
}

export interface ApprovedAttendance {   // provine EXCLUSIV din pontaj aprobat
  readonly zileLucratoareLuna: number; readonly zileLucrate: number;
  readonly oreLucrate: number; readonly oreSuplimentare: number;
  readonly oreNoapte: number; readonly oreWeekend: number;
  readonly zileDelegatie: number;
}

export interface ApprovedLeaveSlice {
  readonly tip: 'odihna' | 'medical' | 'fara_plata' | 'crestere_copil' | 'evenimente' | 'alt';
  readonly zile: number; readonly procentPlata: number;
  readonly bazaCalcul: Bani; readonly suportatDe: 'angajator' | 'fnuass';
}

export interface PayrollCalcInput {
  readonly perioada: { readonly an: number; readonly luna: number };
  readonly settings: PayrollSettingsSnapshot;
  readonly contract: EmployeeContract;
  readonly attendance: ApprovedAttendance;
  readonly leaves: readonly ApprovedLeaveSlice[];
  readonly bonuses: readonly { tip: string; suma: Bani; impozabil: boolean; supusContributii: boolean }[];
  readonly deductions: readonly { tip: string; suma: Bani; prioritate: number; procentMaximDinNet: number | null }[];
}

export interface PayrollCalcResult {
  readonly brut: Bani; readonly bazaImpozabila: Bani; readonly deducerePersonala: Bani;
  readonly cas: Bani; readonly cass: Bani; readonly impozit: Bani;
  readonly camAngajator: Bani; readonly net: Bani; readonly netDePlata: Bani;
  readonly costTotalAngajator: Bani;
  readonly nrTichete: number; readonly valoareTichete: Bani;
  readonly componente: readonly { cod: string; eticheta: string; suma: Bani }[];
  readonly breakdown: readonly { pas: string; formula: string; intrari: Record<string, number>; rezultat: number }[];
  readonly warnings: readonly { cod: string; mesaj: string; severitate: 'info' | 'atentie' | 'blocant' }[];
}

export function calculatePayrollEntry(input: PayrollCalcInput): PayrollCalcResult;
```

**De ce e pură și de ce contează:** nu atinge rețeaua, baza de date, `Date.now()`, `Intl` sau `process.env`; luna de referință și setările intră ca date. Consecințe practice: (1) aceeași funcție rulează în Server Action, în job-ul batch de recalcul și în ecranul de simulare din UI, garantat cu același rezultat; (2) contabilul livrează un fișier de cazuri de test — salariu, pontaj, persoane în întreținere → net așteptat — care devine direct un `describe.each` în Vitest, fără mock-uri și fără bază de date; (3) `breakdown` face din fiecare pas o aserțiune verificabilă, deci un test eșuat arată *care* pas a greșit, nu doar că totalul diferă; (4) `Bani` ca întregi cu brand elimină clasa de erori de virgulă mobilă la sume — conversia în `numeric(14,2)` se face o singură dată, la persistare; (5) o modificare legislativă se testează izolat schimbând doar `settings`, fără migrări.

## (e) Valori legale/fiscale de verificat de contabil

Toate se schimbă prin lege (Cod fiscal, OUG-uri, legea bugetului asigurărilor sociale) și **niciuna nu apare hardcodată în cod** — trăiesc în `payroll_settings` / `payroll_personal_deduction_brackets`, versionate cu `valabil_de_la`. Ecranul de setări afișează lângă fiecare câmp: „Valoare configurabilă. Se modifică prin lege. Verificați cu contabilul înainte de calcul."

1. **Cota CAS angajat** — și cotele majorate pentru condiții deosebite/speciale de muncă.
2. **Cota CASS angajat.**
3. **Cota impozit pe venit din salarii.**
4. **Cota CAM (contribuție asiguratorie pentru muncă) datorată de angajator.**
5. **Salariul minim brut pe țară garantat în plată** — și minimele diferențiate (construcții, agricultură/industrie alimentară).
6. **Salariul minim de referință pentru calculul deducerii personale**, praguri de venit și procente pe număr de persoane în întreținere; intervalul de degresivitate.
7. **Valoarea maximă legală a tichetului de masă** și **regimul fiscal al tichetelor** (ce contribuții se aplică; s-a schimbat de mai multe ori).
8. **Plafonul lunar cumulat al veniturilor neimpozabile** (33% din salariul de bază, cu ordinea de includere a elementelor în plafon — diurnă, tichete de vacanță, contribuții pilon III, abonamente etc.).
9. **Plafonul neimpozabil al diurnei interne** (multiplu al indemnizației pentru instituții publice) și **plafonul de 3 salarii de bază**.
10. **Baremul HG 518/1995** pentru diurna externă, pe țări și valute.
11. **Facilitățile fiscale sectoriale** (IT, construcții, agroalimentar): condiții de eligibilitate, plafoane de venit, ce contribuții se scutesc — se schimbă frecvent și retroactiv.
12. **Cotele și regimul concediilor medicale** (procente pe tip de cod de indemnizație, zile suportate de angajator vs. FNUASS, baza de calcul, plafonarea bazei).
13. **Numărul de zile lucrătoare și sărbătorile legale ale anului** (tabelă de configurare cu istoric — vezi `public_holidays`).
14. **Procentele minime legale pentru ore suplimentare, spor de noapte, muncă în weekend/sărbători** (minime legale; contractul colectiv poate fi mai favorabil).
15. **Plafonul legal al reținerilor din net** (popriri, ordinea de prioritate a creanțelor).
16. **Contribuția la Pilonul II** — cota și opțiunea de participare.
17. **Regulile de rotunjire** ale fiecărei contribuții și ale impozitului (la leu / la ban, în sus / matematic).
18. **Termenele de plată și declarare** (D112) — informative, dar afișate în UI ca memento, nu ca funcționalitate.

---

# MODUL DIURNE (feature: per_diem)

### countries
scop: nomenclator de platformă cu țările și valuta lor de referință pentru diurnă.
coloane:
```
  id uuid PK
  cod_iso2 char(2) NOT NULL
  cod_iso3 char(3) NOT NULL
  denumire_ro text NOT NULL
  denumire_en text NULL
  valuta char(3) NOT NULL
  este_ue boolean NOT NULL DEFAULT false
  activ boolean NOT NULL DEFAULT true
```
constrângeri: `UNIQUE(cod_iso2)`; `UNIQUE(cod_iso3)`; `CHECK (cod_iso2 = upper(cod_iso2))`
indexuri: `(denumire_ro)`; `(activ) WHERE activ`
rls: SELECT = `auth.role() = 'authenticated'`; INSERT/UPDATE = `is_super_admin()`.
notă: `RO` este rând obligatoriu — deplasările interne îl referă, ca să nu existe `country_id` NULL cu semantică ascunsă.

### per_diem_country_rates
scop: baremul de diurnă externă pe țară, importat ca date (HG 518/1995 și actualizările ei), cu suprascrieri opționale per organizație.
coloane:
```
  id uuid PK
  organization_id uuid NULL FK->organizations(id) RESTRICT  -- NULL = barem de platforma
  country_id uuid NOT NULL FK->countries(id) RESTRICT
  suma_zi numeric(14,2) NOT NULL
  valuta char(3) NOT NULL
  valabil_de_la date NOT NULL
  sursa text NOT NULL DEFAULT 'HG 518/1995'
  categorie text NULL                    -- ex. 'personal_conducere'
  import_batch_id uuid NULL
```
constrângeri: `CHECK (suma_zi >= 0)`; `UNIQUE(country_id, valabil_de_la, coalesce(categorie,'')) WHERE organization_id IS NULL AND deleted_at IS NULL`; `UNIQUE(organization_id, country_id, valabil_de_la, coalesce(categorie,'')) WHERE organization_id IS NOT NULL AND deleted_at IS NULL`
indexuri: `(country_id, valabil_de_la DESC) WHERE deleted_at IS NULL`; `(organization_id, country_id, valabil_de_la DESC) WHERE organization_id IS NOT NULL`
rls: SELECT = `organization_id IS NULL OR is_org_member(organization_id)`; INSERT/UPDATE = `(organization_id IS NULL AND is_super_admin()) OR has_perm(organization_id,'per_diem.settings.manage')`.
notă: rezolvare cu precedență — mai întâi override-ul organizației la data respectivă, apoi baremul de platformă. Import prin CSV cu `import_batch_id`, ca o actualizare legislativă greșită să poată fi revocată în bloc.

### per_diem_policies
scop: politica versionată de diurnă a organizației, separat pentru deplasări interne și externe.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  tip per_diem_scope NOT NULL
  valabil_de_la date NOT NULL
  suma_zi numeric(14,2) NOT NULL DEFAULT 0     -- pt. intern; extern foloseste baremul pe tara
  valuta char(3) NOT NULL DEFAULT 'RON'
  foloseste_barem_tara boolean NOT NULL DEFAULT false
  regula_plafon per_diem_ceiling_rule NOT NULL
  multiplu_plafon numeric(6,2) NULL            -- ex. 2.50
  barem_institutii_publice numeric(14,2) NULL
  plafon_procent_salarii_baza numeric(6,4) NULL
  plafon_fix_zi numeric(14,2) NULL
  regula_zile_partiale partial_day_rule NOT NULL DEFAULT 'prag_ore'
  prag_ore_zi_intreaga numeric(5,2) NOT NULL DEFAULT 12
  prag_ore_jumatate_zi numeric(5,2) NOT NULL DEFAULT 12
  ore_minime_pentru_diurna numeric(5,2) NOT NULL DEFAULT 12
  plateste_ziua_intoarcerii boolean NOT NULL DEFAULT true
  regula_trecere_frontiera text NOT NULL DEFAULT 'ziua_trecerii_se_plateste_extern'
  necesita_aprobare boolean NOT NULL DEFAULT true
  permite_avans boolean NOT NULL DEFAULT true
  procent_maxim_avans numeric(6,4) NOT NULL DEFAULT 1.0
```
constrângeri: `UNIQUE(organization_id, tip, valabil_de_la) WHERE deleted_at IS NULL`; `CHECK (regula_plafon <> 'multiplu_barem_institutii_publice' OR (multiplu_plafon IS NOT NULL AND barem_institutii_publice IS NOT NULL))`; `CHECK (prag_ore_jumatate_zi <= prag_ore_zi_intreaga)`; `UNIQUE(organization_id, id)`
indexuri: `(organization_id, tip, valabil_de_la DESC) WHERE deleted_at IS NULL`
rls: SELECT = `is_org_member(organization_id) AND is_feature_enabled(organization_id,'per_diem')`; INSERT/UPDATE = `has_perm(organization_id,'per_diem.settings.manage')`.
notă: `prag_ore_zi_intreaga = prag_ore_jumatate_zi = 12` reproduce regula clasică „sub 12h nimic, peste 12h zi întreagă". Setări diferite activează schema cu jumătate de zi. Regula e un parametru, nu o ramură de cod.

### business_trips
scop: o deplasare în interes de serviciu, de la cerere până la decont.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  numar_ordin text NOT NULL
  employee_id uuid NOT NULL FK->employees(id) RESTRICT
  policy_id uuid NOT NULL FK->per_diem_policies(id) RESTRICT
  tip per_diem_scope NOT NULL
  country_id uuid NOT NULL FK->countries(id) RESTRICT
  oras text NOT NULL
  scop text NOT NULL
  plecare_la timestamptz NOT NULL
  intoarcere_la timestamptz NULL
  mijloc_transport transport_means NOT NULL
  vehicle_id uuid NULL FK->vehicles(id) RESTRICT
  trip_sheet_id uuid NULL FK->trip_sheets(id) RESTRICT
  zile_diurna numeric(6,2) NOT NULL DEFAULT 0
  suma_diurna numeric(14,2) NOT NULL DEFAULT 0
  valuta char(3) NOT NULL DEFAULT 'RON'
  curs_valutar numeric(12,6) NOT NULL DEFAULT 1
  curs_data date NULL
  suma_diurna_ron numeric(14,2) NOT NULL DEFAULT 0
  suma_neimpozabila_ron numeric(14,2) NOT NULL DEFAULT 0
  suma_impozabila_ron numeric(14,2) NOT NULL DEFAULT 0
  avans numeric(14,2) NOT NULL DEFAULT 0
  decont_total numeric(14,2) NOT NULL DEFAULT 0
  diferenta numeric(14,2) NOT NULL DEFAULT 0
  status business_trip_status NOT NULL DEFAULT 'cerere'
  aprobat_de uuid NULL FK->auth.users(id)
  aprobat_la timestamptz NULL
  decontat_la timestamptz NULL
  payroll_bonus_id uuid NULL FK->payroll_bonuses(id) SET NULL
  calc_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
```
constrângeri: `UNIQUE(organization_id, numar_ordin) WHERE deleted_at IS NULL`; `CHECK (intoarcere_la IS NULL OR intoarcere_la > plecare_la)`; `CHECK (curs_valutar > 0)`; `CHECK (avans >= 0 AND avans <= suma_diurna_ron + decont_total)`; `CHECK (mijloc_transport <> 'auto_firma' OR vehicle_id IS NOT NULL)`; `CHECK (status <> 'decontat' OR intoarcere_la IS NOT NULL)`; FK compuse pe `employee_id`, `policy_id`, `vehicle_id`, `trip_sheet_id`
indexuri: `(organization_id, employee_id, plecare_la DESC) WHERE deleted_at IS NULL`; `(organization_id, status) WHERE deleted_at IS NULL`; `(organization_id, trip_sheet_id) WHERE trip_sheet_id IS NOT NULL`
rls: SELECT = `has_perm(org,'per_diem.view_all') OR employee_id = current_employee_id(org) OR (has_perm(org,'per_diem.view_team') AND is_manager_of(org, employee_id))`; INSERT = angajatul pentru el însuși sau `per_diem.manage`; UPDATE = autorul cât timp `status='cerere'`, altfel `per_diem.manage`; aprobarea cere `per_diem.approve`.
notă: `curs_valutar` se îngheață la `curs_data` (curs BNR din ziua stabilită de politică) și nu se mai recalculează niciodată — altfel decontul se schimbă singur în timp.

### business_trip_legs
scop: segmentele unei deplasări cu mai multe țări, ca fiecare zi să primească baremul corect.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  trip_id uuid NOT NULL FK->business_trips(id) RESTRICT
  country_id uuid NOT NULL FK->countries(id) RESTRICT
  intrare_la timestamptz NOT NULL
  iesire_la timestamptz NULL
  rate_id uuid NULL FK->per_diem_country_rates(id) RESTRICT
  suma_zi numeric(14,2) NOT NULL
  valuta char(3) NOT NULL
  zile_diurna numeric(6,2) NOT NULL DEFAULT 0
  ordine smallint NOT NULL
```
constrângeri: `UNIQUE(organization_id, trip_id, ordine) WHERE deleted_at IS NULL`; `CHECK (iesire_la IS NULL OR iesire_la > intrare_la)`; FK compus pe `trip_id`
indexuri: `(organization_id, trip_id, ordine)`
rls: moștenită logic de la `business_trips` (aceleași predicate, prin `EXISTS` pe trip).
notă: pentru o deplasare cu o singură țară se generează automat un singur leg. Regula „ziua trecerii frontierei se plătește la baremul țării în care se intră" e implementată aici, nu în UI.

### trip_expenses
scop: cheltuielile decontabile ale unei deplasări, separat de diurnă.
coloane:
```
  id uuid PK
  organization_id uuid NOT NULL FK->organizations(id) RESTRICT
  trip_id uuid NOT NULL FK->business_trips(id) RESTRICT
  tip trip_expense_type NOT NULL
  descriere text NOT NULL
  data_cheltuiala date NOT NULL
  suma numeric(14,2) NOT NULL
  valuta char(3) NOT NULL DEFAULT 'RON'
  curs_valutar numeric(12,6) NOT NULL DEFAULT 1
  suma_ron numeric(14,2) NOT NULL
  tva numeric(14,2) NOT NULL DEFAULT 0
  deductibil boolean NOT NULL DEFAULT true
  motiv_nedeductibil text NULL
  document_numar text NULL
  document_furnizor text NULL
  bon_storage_path text NULL
  bon_verificat boolean NOT NULL DEFAULT false
  aprobat_de uuid NULL FK->auth.users(id)
```
constrângeri: `CHECK (suma > 0)`; `CHECK (curs_valutar > 0)`; `CHECK (deductibil OR motiv_nedeductibil IS NOT NULL)`; `CHECK (tva >= 0 AND tva <= suma)`; FK compus pe `trip_id`
indexuri: `(organization_id, trip_id) WHERE deleted_at IS NULL`; `(organization_id, tip, data_cheltuiala)`
rls: aceleași predicate ca `business_trips`, prin `EXISTS` pe trip; upload-ul bonului scrie într-un bucket privat cu path `org/{organization_id}/trips/{trip_id}/...` și policy de Storage pe același predicat.
notă: `suma_ron` e stocată, nu calculată la citire — cursul zilei cheltuielii poate diferi de cursul diurnei.

## Funcția pură de calcul al zilelor de diurnă

```ts
export type PartialDayRule =
  | { readonly kind: 'prag_ore'; readonly pragZiIntreagaOre: number; readonly pragJumatateZiOre: number }
  | { readonly kind: 'zile_calendaristice'; readonly platesteZiuaIntoarcerii: boolean }
  | { readonly kind: 'ore_impartite_la_24'; readonly rotunjire: 'jos' | 'sus' | 'jumatati' };

export interface PerDiemLegInput {
  readonly countryId: string;
  readonly intrareLa: string;   // ISO 8601 cu offset explicit
  readonly iesireLa: string;
  readonly sumaZi: Bani;
  readonly valuta: string;
}

export interface PerDiemCalcInput {
  readonly legs: readonly PerDiemLegInput[];
  readonly regulaZilePartiale: PartialDayRule;
  readonly oreMinimePentruDiurna: number;
  readonly regulaTrecereFrontiera: 'tara_de_intrare' | 'tara_de_iesire';
  readonly plafonNeimpozabilZiRon: Bani | null;
  readonly cursValutar: Readonly<Record<string, number>>;
}

export interface PerDiemCalcResult {
  readonly zileTotal: number;                       // 0 | 0.5 | 1 | 1.5 ...
  readonly peLeg: readonly { countryId: string; zile: number; suma: Bani; valuta: string }[];
  readonly sumaTotalaRon: Bani;
  readonly sumaNeimpozabilaRon: Bani;
  readonly sumaImpozabilaRon: Bani;
  readonly breakdown: readonly { eticheta: string; oreCalculate: number; zileRezultate: number }[];
  readonly warnings: readonly { cod: string; mesaj: string }[];
}

export function calculeazaZileDiurna(input: PerDiemCalcInput): PerDiemCalcResult;
```

Pură din același motiv ca motorul de salarii: durata se calculează **în milisecunde UTC**, nu prin scădere de date locale. Detaliul contează — 30 martie și 26 octombrie au 23h, respectiv 25h în Europe/Bucharest, iar o deplasare de „12 ore" peste schimbarea orei devine 11h sau 13h dacă se calculează pe ore locale. Funcția nu citește niciodată ceasul de sistem: `intoarcere_la` lipsă înseamnă status `in_desfasurare` și se refuză calculul, nu se substituie `now()`.

**Cazuri limită (regula implicită `prag_ore`, prag 12h / jumătate 12h):**
| Plecare | Întoarcere | Durată | Zile |
|---|---|---|---|
| 22:00 luni | 06:00 marți | 8h | **0** — sub prag, deși traversează două zile calendaristice |
| 22:00 luni | 12:00 marți | 14h | **1** |
| 08:00 luni | 20:00 luni | 12h | **1** — pragul e `>=`, decizie explicită documentată în UI |
| 22:00 luni | 06:00 miercuri | 32h | **1** (24h) + 8h rest sub prag → **1** |
| 22:00 luni | 12:00 miercuri | 38h | 24h + 14h → **2** |
| 06:00 luni | 06:00 luni | 0h | **0** + warning `DURATA_ZERO` |
| întoarcere < plecare | — | — | eroare de validare Zod, nu warning |

Cu praguri asimetrice (ex. zi întreagă 12h, jumătate 8h): 22:00→06:00 = 8h → **0,5 zile**. Cu `ore_impartite_la_24` și rotunjire `jumatati`: 8h/24 = 0,33 → **0,5**. Cu `zile_calendaristice`: **2 zile** — permis pentru firmele care au această regulă în regulamentul intern, dar UI-ul afișează avertisment că depășește tratamentul neimpozabil uzual.

Restul deplasării după zilele întregi se evaluează cu aceleași praguri: `zile = floor(ore/24)`, apoi `rest = ore mod 24` trece prin regula de zi parțială. Pe deplasări multi-țară, zilele se alocă pe legs în ordine cronologică, iar ziua trecerii frontierei merge la țara indicată de `regulaTrecereFrontiera`.

## Semnalarea automată a depășirii plafonului neimpozabil și impactul fiscal

Un trigger `AFTER UPDATE OF status ON business_trips WHEN new.status = 'decontat'` calculează, folosind politica validă la `plecare_la`:
```
plafon_zi = CASE regula_plafon
  WHEN 'multiplu_barem_institutii_publice' THEN multiplu_plafon * barem_institutii_publice   -- intern
  WHEN 'multiplu_barem_institutii_publice' THEN multiplu_plafon * barem_tara(country, data)  -- extern
  WHEN 'plafon_fix' THEN plafon_fix_zi
END
suma_neimpozabila = min(suma_diurna_ron, zile_diurna * plafon_zi)
suma_impozabila   = suma_diurna_ron - suma_neimpozabila
```
Al doilea plafon, **lunar și cumulat pe angajat**, se aplică în modulul salarii, unde e singurul loc care cunoaște salariul de bază: diurna neimpozabilă nu poate depăși nici plafonul-zi, nici echivalentul a 3 salarii de bază pe lună, nici plafonul global al veniturilor neimpozabile (`plafon_neimpozabil_lunar_cumulat`). Depășirea se calculează la închiderea perioadei, în ordinea de includere configurată în `payroll_settings`.

Semnalizare și consecințe:
- În UI, la salvarea decontului: badge roșu „Depășire plafon neimpozabil: X lei" pe deplasare, plus coloană dedicată în lista de deconturi și un raport lunar „Diurne peste plafon" pentru HR.
- Impact fiscal: partea care depășește plafonul **se asimilează veniturilor din salarii** — intră în baza CAS, CASS, impozit pe venit și CAM angajator. Nu e o penalizare, e reîncadrare.
- Automatizare: triggerul creează un rând în `payroll_bonuses` cu `tip='diurna_peste_plafon'`, `impozabil=true`, `supus_contributii=true`, `sursa_tabela='business_trips'`, `sursa_id=trip.id`, în perioada de salarizare `draft` corespunzătoare lunii decontării, și scrie `payroll_bonus_id` înapoi pe deplasare. Dacă perioada e deja `aprobat`/`inchis`, rândul se creează în prima perioadă `draft` disponibilă, cu warning vizibil pentru HR — nu se pierde tăcut și nu forțează redeschiderea unei luni închise.
- Anularea unei deplasări decontate face soft delete pe bonusul asociat doar dacă perioada e încă `draft`; altfel generează un bonus de corecție cu sumă negativă în luna curentă.
- Avertisment permanent în UI: plafoanele și baremul sunt valori configurabile care se schimbă prin lege; încadrarea fiscală finală o confirmă contabilul.

## PDF-uri

**Ordin de deplasare (delegație)** — generat la aprobare, cu QR spre înregistrarea din aplicație:
antet cu denumirea firmei, CUI, adresă, nr. registrul comerțului, logo; numărul și data ordinului; numele, funcția și marca angajatului; destinația (țara, orașul, denumirea entității vizitate); scopul deplasării; data și ora plecării, data și ora sosirii prevăzute; durata în zile; mijlocul de transport (și numărul de înmatriculare al autovehiculului de firmă, dacă e cazul); diurna zilnică și valuta, baremul aplicat cu sursa lui; avansul acordat, data și modalitatea de plată; rubrici de semnătură — conducătorul unității, contabil/CFP, delegat (luare la cunoștință); rubrici de sosire/plecare cu ștampila unității vizitate (verso); mențiunea că documentul e generat electronic din Administrativo.

**Decont de cheltuieli** — generat la decontare, imutabil după aprobare:
aceleași date de identificare plus trimitere la numărul ordinului de deplasare; perioada efectivă cu ore de plecare și întoarcere; numărul de zile de diurnă cu **regula aplicată explicit** („12h prag zi întreagă → 2,5 zile"); tabel de diurnă pe segmente (țară, interval, zile, sumă/zi, valută, curs BNR și data cursului, echivalent lei); tabel de cheltuieli (data, tip, furnizor, nr. document, sumă, valută, curs, sumă în lei, TVA, deductibil da/nu cu motiv); totaluri: diurnă + cheltuieli = total decont; avans primit; **diferența de încasat de la angajat sau de plătit către angajat**, evidențiată; secțiunea „Regim fiscal": sumă neimpozabilă, sumă peste plafon și mențiunea că partea peste plafon se impozitează pe statul de plată al lunii X; lista documentelor justificative anexate cu numărul de pagini; semnături — titular de avans, verificat de, aprobat de; hash SHA-256 al documentului în subsol.

Ambele: A4, generate server-side, diacritice complete, sume `1.234,56`, date `dd.MM.yyyy`, stocate în bucket privat cu path pe `organization_id` și servite exclusiv prin URL semnat cu expirare scurtă.

## Legătura cu foaia de parcurs (auto de firmă)

Când `mijloc_transport = 'auto_firma'`, `vehicle_id` devine obligatoriu prin CHECK. La aprobarea deplasării, un Server Action creează sau leagă o foaie de parcurs în modulul fleet (`trip_sheets`) și scrie `trip_sheet_id`:
- Foaia moștenește din deplasare: perioada, șoferul (`employee_id`), vehiculul, destinația, scopul. Utilizatorul completează doar km la plecare, km la întoarcere și alimentările.
- FK compus `(organization_id, trip_sheet_id)` garantează că nu se poate lega foaia altui tenant. `UNIQUE(organization_id, trip_sheet_id) WHERE trip_sheet_id IS NOT NULL AND deleted_at IS NULL` — o foaie aparține unei singure deplasări.
- Consistență impusă prin trigger: dacă foaia de parcurs nu e finalizată (km de întoarcere lipsă), deplasarea nu poate trece în `decontat`; dacă perioada foii nu se suprapune cu `[plecare_la, intoarcere_la]`, salvarea eșuează cu mesaj explicit.
- Anti-dublă-decontare: când există `trip_sheet_id`, cheltuielile de tip `combustibil` și `taxe_drum` se marchează implicit `deductibil = false` pe `trip_expenses`, cu motiv precompletat „decontat prin foaia de parcurs" — combustibilul se justifică prin bonurile atașate foii, nu de două ori. Regula e un default în UI plus un warning din motorul de calcul, nu o interdicție rigidă: se poate suprascrie cu motiv scris.
- Consumul normat vs. real și eventualul depășit de consum rămân integral în modulul fleet; modulul diurne doar afișează link și totalul de km pe deplasare.
- Dacă `mijloc_transport = 'auto_personal'`, `trip_sheet_id` rămâne NULL și se activează în schimb o cheltuială de tip `transport` calculată pe km × tarif/km din politica organizației (valoare configurabilă, plafonul fiscal fiind încă o valoare de verificat de contabil).