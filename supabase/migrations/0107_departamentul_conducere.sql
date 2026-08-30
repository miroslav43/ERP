-- 0107_departamentul_conducere.sql
--
-- FIECARE FIRMĂ SE NAȘTE CU UN DEPARTAMENT „CONDUCERE", IAR ADMINISTRATORII
-- INTRĂ ÎN EL SINGURI.
--
-- ── PROBLEMA ─────────────────────────────────────────────────────────────────
-- O firmă nouă pornea cu structura organizatorică goală. Patronul primea, prin
-- 0083, o fișă de angajat (`status = 'candidat'`, `is_primary`), dar acea fișă
-- avea `department_id` null: nu apărea în nicio organigramă, în niciun efectiv,
-- în nicio listă de membri. Omul care deține firma era, din punctul de vedere al
-- modulului de departamente, nicăieri.
--
-- Al doilea efect, mai supărător fiindcă e tăcut: cofondatorul invitat ca
-- „Administrator" din `/setari/membri` ateriza în aceeași stare. Doi oameni care
-- conduc firma, zero urme în structură.
--
-- ── CE CONSTRUIEȘTE MIGRAREA ────────────────────────────────────────────────
-- Un departament rădăcină, `cod = 'CONDUCERE'`, creat odată cu firma, plus
-- regula „orice `org_admin` activ care nu e repartizat nicăieri ajunge în el".
--
-- Apartenența e HIBRIDĂ, prin decizie explicită, nu din comoditate:
--   · administratorii intră AUTOMAT — n-ai de reținut un pas în plus după ce ai
--     invitat un cofondator;
--   · dar departamentul NU e o oglindă a rolului. Poți muta acolo, cu uneltele
--     obișnuite, și oameni care nu au cont în aplicație (un asociat, un director
--     general angajat); și nimeni nu e scos automat din el când i se ia rolul.
-- Alternativa — mulțimea `org_admin`-ilor, întreținută de bază — s-a respins
-- fiindcă ar fi interzis exact cazul firmei mici din România, unde asociatul
-- care apare în actele constitutive n-are neapărat cont în ERP.
--
-- ── CE NU FACE, DELIBERAT ───────────────────────────────────────────────────
-- NU mută pe nimeni care are deja un departament. Un șef de producție promovat
-- administrator rămâne la Producție; altfel promovarea l-ar fi smuls tăcut din
-- structura pe care o conduce, iar `manager_employee_id` al Producției ar fi
-- arătat către cineva din alt departament — chiar starea incoerentă pe care
-- `src/domain/departments/manager-membru.ts` o repară în paralel.
--
-- NU apără departamentul de ștergere sau redenumire. Funcția e idempotentă: dacă
-- un patron îl șterge, următorul administrator îl reface. Se auto-vindecă, în loc
-- să certe omul pentru o alegere care e a lui.
--
-- Forward-only: 0004 (tabela), 0011 (precedentul de însămânțare la crearea
-- firmei) și 0083 (fișa patronului) NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. DEPARTAMENTUL — o singură implementare, trei apelanți
-- =====================================================================================
-- Idempotentă și fără condiție de cursă: cei trei apelanți (triggerul pe
-- `organizations`, triggerul pe `organization_members` și umplerea retroactivă
-- de la §4) pot ajunge aici în orice ordine, inclusiv simultan.
--
-- `on conflict do nothing` e scris FĂRĂ țintă, intenționat. Indexul care apără
-- unicitatea codului e `departments_org_cod_uniq (organization_id, lower(cod))
-- where deleted_at is null` — parțial ȘI pe o expresie. O clauză de inferență
-- care nu repetă exact ambele ar cădea cu 42P10 la PLANIFICARE, adică la fiecare
-- apel, nu doar la conflict (capcana 7). Forma fără țintă prinde orice violare
-- de unicitate și nu are ce greși; recitirea de dedesubt acoperă cazul în care
-- rândul a fost inserat între timp de altcineva.
--
-- `path` și `depth` NU se trimit: `departments_path_biu` (0004) le calculează
-- înaintea inserării — pentru un nod rădăcină, `array[new.id]` și 0.

create or replace function internal.asigura_departamentul_conducere(p_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select d.id into v_id
    from public.departments d
   where d.organization_id = p_organization_id
     and lower(d.cod) = 'conducere'
     and d.deleted_at is null
   limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.departments (organization_id, parent_id, cod, denumire, descriere, activ)
  values (
    p_organization_id,
    null,
    'CONDUCERE',
    'Conducere',
    'Conducerea firmei: administratorii intră aici automat. Aici se adaugă și asociații sau directorii care nu au cont în aplicație.',
    true
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    -- Altcineva a inserat între `select` și `insert`. Rândul lui e la fel de bun.
    select d.id into v_id
      from public.departments d
     where d.organization_id = p_organization_id
       and lower(d.cod) = 'conducere'
       and d.deleted_at is null
     limit 1;
  end if;

  return v_id;
end;
$$;

revoke all on function internal.asigura_departamentul_conducere(uuid) from public, anon, authenticated;

-- =====================================================================================
-- 2. FIRMA SE NAȘTE CU EL
-- =====================================================================================
-- Aceeași formă ca `organizations_ssm_seed` din 0011, și din același motiv: un
-- trigger prinde TOATE căile prin care apare o organizație — cele două acțiuni
-- din `super-admin/organizatii/nou/actions.ts` plus cea din
-- `super-admin/organizatii/actions.ts` — pe când modificarea acțiunilor ar fi
-- prins trei din trei azi și două din patru la următoarea cale adăugată.

create or replace function internal.organizatie_creeaza_conducerea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.asigura_departamentul_conducere(new.id);
  return null;
end;
$$;

revoke all on function internal.organizatie_creeaza_conducerea() from public, anon, authenticated;

drop trigger if exists organizations_conducere_seed on public.organizations;
create trigger organizations_conducere_seed
  after insert on public.organizations
  for each row execute function internal.organizatie_creeaza_conducerea();

-- =====================================================================================
-- 3. ADMINISTRATORUL INTRĂ SINGUR
-- =====================================================================================
-- ⚠️ NUMELE TRIGGERULUI E FUNCȚIONAL, NU DECORATIV. Postgres execută triggerele
-- de aceeași fază în ordine ALFABETICĂ. Fișa patronului o creează
-- `trg_zorganization_members_fisa_patron` (0083) — care și el și-a luat un `z`
-- ca să ruleze ultimul. Al nostru trebuie să vadă fișa DUPĂ ce aceea o inserează,
-- deci `zz`. Un nume care ar sorta înainte n-ar da nicio eroare: `update`-ul de
-- mai jos ar atinge zero rânduri, iar patronul ar rămâne nerepartizat — exact
-- defectul pentru care s-a scris migrarea, doar că invizibil.
--
-- Se prinde și pe UPDATE of role, status: promovarea unui membru existent la
-- `org_admin`, sau reactivarea unui administrator suspendat. Dacă omul n-are
-- fișă (a fost invitat `manager` și n-a fost niciodată angajat), `update`-ul
-- atinge zero rânduri și nu se întâmplă nimic — corect: n-avem pe cine repartiza.
--
-- `is_primary` e obligatoriu în filtru: `employees` NU are
-- `unique(organization_id, user_id)`, fiindcă susține cumulul de funcții. Fără
-- el, repartizarea ar putea nimeri fișa de part-time.

create or replace function internal.membru_intra_in_conducere()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_departament uuid;
begin
  if new.role <> 'org_admin'
     or new.status <> 'active'
     or new.user_id is null
     or new.deleted_at is not null then
    return null;
  end if;

  v_departament := internal.asigura_departamentul_conducere(new.organization_id);
  if v_departament is null then
    return null;
  end if;

  -- `department_id is null` e toată regula hibridă, într-o linie: intrăm numai
  -- în golul de la început. Cine e deja repartizat undeva nu se mișcă de acolo
  -- fiindcă a primit un rol.
  update public.employees e
     set department_id = v_departament,
         updated_by    = coalesce((select auth.uid()), e.updated_by)
   where e.organization_id = new.organization_id
     and e.user_id         = new.user_id
     and e.is_primary
     and e.department_id is null
     and e.deleted_at is null;

  return null;
end;
$$;

revoke all on function internal.membru_intra_in_conducere() from public, anon, authenticated;

drop trigger if exists trg_zz_organization_members_conducere on public.organization_members;
create trigger trg_zz_organization_members_conducere
  after insert or update of role, status on public.organization_members
  for each row execute function internal.membru_intra_in_conducere();

-- =====================================================================================
-- 4. FIRMELE CARE EXISTĂ DEJA
-- =====================================================================================
-- Triggerele de mai sus acoperă doar ce se întâmplă de acum înainte. Fără pasul
-- ăsta, exact firmele pentru care s-a raportat problema ar rămâne cu ea.
-- Rezultatul e identic cu ce ar fi produs triggerele dacă existau atunci.

do $$
declare
  o record;
begin
  for o in
    select id from public.organizations where deleted_at is null
  loop
    perform internal.asigura_departamentul_conducere(o.id);
  end loop;
end $$;

update public.employees e
   set department_id = d.id
  from public.organization_members m
  join public.departments d
    on d.organization_id = m.organization_id
   and lower(d.cod) = 'conducere'
   and d.deleted_at is null
 where m.organization_id = e.organization_id
   and m.user_id         = e.user_id
   and m.role            = 'org_admin'
   and m.status          = 'active'
   and m.deleted_at is null
   and e.is_primary
   and e.department_id is null
   and e.deleted_at is null;

-- =====================================================================================
-- 5. NOTE DE PROIECTARE
-- =====================================================================================
--
-- DE CE NU O COLOANĂ `departments.este_conducerea boolean`. Ar fi fost al doilea
-- adevăr despre același lucru, și primul care poate diverge: nimic n-ar fi
-- împiedicat două rânduri cu steagul aprins, sau steagul stins pe rândul pe care
-- triggerele îl caută după cod. `lower(cod) = 'conducere'` are deja un index
-- unic parțial în spate, deci unicitatea e apărată de bază, nu de convenție.
-- Costul e că un patron care redenumește codul rupe legătura — dar atunci
-- funcția creează un departament nou, ceea ce e o consecință vizibilă pe ecran,
-- nu una tăcută.
--
-- DE CE NU SE SCRIE ÎN `departments.manager_employee_id`. Ar fi fost tentant să-l
-- punem pe patron manager al Conducerii. Dar acea coloană e a doua sursă de
-- adevăr despre apartenență, complet nesincronizată cu `employees.department_id`
-- — defectul reparat în paralel de `src/domain/departments/manager-membru.ts`.
-- Cine conduce Conducerea e o decizie a firmei, luată dintr-un ecran, nu una pe
-- care baza are dreptul s-o presupună.
--
-- DE CE `security definer`. Cele trei funcții scriu în `departments` și
-- `employees` dintr-un context în care `auth.uid()` e adesea null: crearea firmei
-- din consola de platformă trece prin `service_role`. O funcție `invoker` ar fi
-- căzut pe RLS exact acolo — și doar acolo, deci ar fi trecut de orice probă
-- rulată cu o sesiune de om. Aceeași alegere ca la `app.seed_ssm_defaults` (0011)
-- și `internal.urmatoarea_marca` (0083), din același motiv.
--
-- CE AR ASCUNDE DEFECTUL LA LOC: o probă care verifică doar că departamentul
-- „Conducere" există după crearea firmei. Partea care se strică tăcut e a doua —
-- repartizarea — și ea depinde de ordinea alfabetică a două triggere scrise în
-- migrări diferite. Proba corectă citește `employees.department_id` DUPĂ
-- inserarea membrului. Vezi `tests/rls/proba-conducere.sql`.

commit;
