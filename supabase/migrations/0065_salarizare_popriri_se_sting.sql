-- supabase/migrations/0065_salarizare_popriri_se_sting.sql
--
-- POPRIRILE NU SE STINGEAU NICIODATĂ.
--
-- `payroll_garnishments.suma_recuperata` (0059:35) nu era incrementată de nimic
-- — nici trigger, nici RPC, nici Server Action. Un `grep` pe tot repo-ul o
-- găsea doar în declarația coloanei, în constrângeri, în coloana generată și în
-- politica de INSERT. Iar `sold_ramas` e GENERATĂ din ea (0059:59-61), deci
-- rămânea veșnic egal cu datoria inițială: dosarul reținea la infinit, inclusiv
-- după ce datoria fusese achitată. Exact defectul pe care antetul lui 0059
-- (liniile 9-11) își propunea să-l repare.
--
-- CAUZA REALĂ e mai adâncă decât „lipsește un increment". Motorul
-- `src/domain/payroll/etape/retineri-popriri.ts` CALCULEAZĂ corect cât s-a
-- reținut din fiecare dosar — întoarce `aplicate: RetinereAplicata[]` cu `id`,
-- `aplicata` și `soldDupa`, cu 37 de teste care confirmă plafoanele de 1/3 și
-- 1/2 și prioritatea creanțelor de întreținere. Dar `calc.ts:615` păstrează
-- numai `r.totalRetinut` și aruncă restul. Suma per dosar nu supraviețuia
-- ieșirii din motor, deci n-avea cum să ajungă nicăieri.
--
-- DE CE RECALCULARE, NU INCREMENT.
-- Un increment la închiderea perioadei ar fi cerut o cheie de idempotență și ar
-- fi dublat datoria la orice recalculare a lunii — iar recalcularea unei luni în
-- ciornă e operațiunea normală, nu excepția. Aici `suma_recuperata` devine
-- DERIVATĂ: suma reținerilor legate de dosar prin `payroll_deductions.garnishment_id`
-- (coloana există din 0059:78, nescrisă de nimeni până acum). O recalculare e
-- idempotentă prin construcție, oricâte ori ar rula, iar o reținere ștearsă
-- logic eliberează automat soldul.
--
-- Coloana rămâne stocată, nu `generated always as`: o coloană generată nu poate
-- referi alt tabel, iar `sold_ramas` depinde de ea.
--
-- Forward-only: 0059 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Recalcularea soldului unui dosar
-- =====================================================================================

create or replace function internal.recalc_sold_poprire(p_garnishment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recuperat numeric(14, 2);
  v_total     numeric(14, 2);
begin
  select g.suma_totala into v_total
    from public.payroll_garnishments g
   where g.id = p_garnishment;
  if not found then
    return;
  end if;

  select coalesce(sum(d.suma), 0) into v_recuperat
    from public.payroll_deductions d
   where d.garnishment_id = p_garnishment
     and d.deleted_at is null;

  -- Plafonarea la datoria totală nu e cosmetică: `pg_sume_ck` (0059:50-53) cere
  -- `suma_recuperata <= suma_totala`, iar un UPDATE respins de CHECK ar face să
  -- eșueze întreaga tranzacție de calcul al salariilor. Motorul plafonează deja
  -- reținerea la `soldRamas`, dar o reținere introdusă manual nu trece pe acolo.
  v_recuperat := least(v_recuperat, v_total);

  update public.payroll_garnishments g
     set suma_recuperata = v_recuperat,
         -- Stingerea automată: dosarul cu datoria achitată iese din calcul de
         -- luna următoare, fără intervenție. `popririActive` (queries/payroll.ts)
         -- filtrează pe `activa = true`.
         activa = case when v_recuperat >= v_total then false else g.activa end,
         updated_at = now()
   where g.id = p_garnishment
     and (g.suma_recuperata is distinct from v_recuperat
          or (v_recuperat >= v_total and g.activa));
end;
$$;

comment on function internal.recalc_sold_poprire(uuid) is
  'Recalculează suma_recuperata a unui dosar de poprire ca sumă a reținerilor '
  'legate de el, și îl dezactivează când datoria e stinsă. RECALCULARE, nu '
  'increment: e idempotentă, deci o recalculare a lunii nu dublează datoria.';

revoke all on function internal.recalc_sold_poprire(uuid) from public, anon, authenticated;

-- =====================================================================================
-- 2. Triggerul care o pornește
-- =====================================================================================
-- AFTER, nu BEFORE: soldul se recalculează din rândul deja scris. Pe UPDATE se
-- ating AMÂNDOUĂ dosarele când reținerea e mutată de pe unul pe altul.

create or replace function internal.payroll_deductions_recalc_poprire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `old` nu e atribuit într-un trigger de INSERT și `new` nu e atribuit într-unul
  -- de DELETE: ramurile trebuie separate pe `tg_op`, nu combinate cu `in (...)`.
  if tg_op = 'INSERT' then
    if new.garnishment_id is not null then
      perform internal.recalc_sold_poprire(new.garnishment_id);
    end if;
  elsif tg_op = 'DELETE' then
    if old.garnishment_id is not null then
      perform internal.recalc_sold_poprire(old.garnishment_id);
    end if;
  else
    -- UPDATE. Dosarul vechi se recalculează întotdeauna: acoperă și cazul în
    -- care s-a schimbat doar `suma` sau `deleted_at`, nu legătura.
    if old.garnishment_id is not null then
      perform internal.recalc_sold_poprire(old.garnishment_id);
    end if;
    if new.garnishment_id is not null
       and new.garnishment_id is distinct from old.garnishment_id then
      perform internal.recalc_sold_poprire(new.garnishment_id);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function internal.payroll_deductions_recalc_poprire() from public, anon, authenticated;

create trigger trg_payroll_deductions_recalc_poprire
  after insert or update or delete on public.payroll_deductions
  for each row execute function internal.payroll_deductions_recalc_poprire();

-- =====================================================================================
-- 3. Scrierea reținerilor de poprire ale unei perioade
-- =====================================================================================
-- Aceeași formă ca `payroll_scrie_rezultate` (0051): SECURITY INVOKER, ca
-- politicile `payroll_deductions_*` să se aplice apelantului, iar
-- `organization_id` derivat din perioadă, nu preluat din sarcina utilă.
--
-- Recalcularea unei luni ÎNLOCUIEȘTE reținerile generate automat: rândurile
-- vechi cu `garnishment_id` se șterg logic (nicio politică DELETE în proiect),
-- apoi se inserează cele noi. Reținerile introduse manual — `garnishment_id is
-- null` — nu se ating: avansul, imputația și rata internă rămân ale omului.

create or replace function public.payroll_scrie_popriri(
  p_period_id uuid,
  p_randuri   jsonb
)
returns table (sterse integer, inserate integer)
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_org      uuid;
  v_sterse   integer := 0;
  v_inserate integer := 0;
begin
  if jsonb_typeof(p_randuri) is distinct from 'array' then
    raise exception 'Reținerile de poprire trebuie trimise ca listă.' using errcode = 'P0001';
  end if;

  select pp.organization_id into v_org
    from public.payroll_periods pp
   where pp.id = p_period_id
     and pp.deleted_at is null;

  if v_org is null then
    raise exception 'Perioada de salarizare nu a fost găsită.' using errcode = 'P0001';
  end if;

  with vechi as (
    update public.payroll_deductions d
       set deleted_at = now(), updated_at = now()
     where d.period_id = p_period_id
       and d.organization_id = v_org
       and d.garnishment_id is not null
       and d.deleted_at is null
    returning 1
  )
  select count(*) into v_sterse from vechi;

  with intrari as (
    select
      (e ->> 'employee_id')::uuid    as employee_id,
      (e ->> 'garnishment_id')::uuid as garnishment_id,
      (e ->> 'suma')::numeric        as suma,
      (e ->> 'motiv')::text          as motiv
      from jsonb_array_elements(p_randuri) e
  ),
  noi as (
    insert into public.payroll_deductions
      (organization_id, period_id, employee_id, tip, suma, motiv, garnishment_id)
    select v_org, p_period_id, i.employee_id, 'poprire', i.suma, i.motiv, i.garnishment_id
      from intrari i
     -- O reținere de zero lei nu e o reținere: dosarul plafonat la sold zero
     -- sau la netul epuizat nu trebuie să lase urmă, iar `suma > 0` e CHECK în
     -- bază (0026:245) — filtrul de aici o oprește înainte să rupă tranzacția.
     where i.suma > 0
    returning 1
  )
  select count(*) into v_inserate from noi;

  return query select v_sterse, v_inserate;
end;
$fn$;

comment on function public.payroll_scrie_popriri(uuid, jsonb) is
  'Înlocuiește reținerile de poprire generate automat pentru o perioadă. '
  'Reținerile manuale (garnishment_id null) rămân neatinse. Triggerul '
  'trg_payroll_deductions_recalc_poprire recalculează soldul dosarelor atinse.';

revoke all on function public.payroll_scrie_popriri(uuid, jsonb) from public, anon;
grant execute on function public.payroll_scrie_popriri(uuid, jsonb) to authenticated;

-- =====================================================================================
-- 4. Alinierea dosarelor existente
-- =====================================================================================
-- Bazele care au deja rânduri de poprire: soldul se recalculează o dată, ca
-- starea să pornească din aceeași sursă de adevăr ca de-acum-încolo.

do $$
declare
  v_id uuid;
begin
  for v_id in
    select g.id from public.payroll_garnishments g where g.deleted_at is null
  loop
    perform internal.recalc_sold_poprire(v_id);
  end loop;
end;
$$;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce nu un `generated always as` pentru `suma_recuperata`: o coloană
--   generată poate referi doar coloane ale aceluiași rând. Suma vine din alt
--   tabel, deci recalcularea trebuie declanșată de un trigger.
--
-- · De ce recalcularea NU e apelată la închiderea perioadei, ci la scrierea
--   reținerii: închiderea e un moment, scrierea e evenimentul. Legând-o de
--   eveniment, orice cale care atinge `payroll_deductions` — RPC-ul de mai sus,
--   `adaugaRetinere`, o corecție manuală în consolă — lasă soldul corect. O
--   funcție apelată doar de la închidere ar fi fost ocolită de primele două.
--
-- · Dezactivarea e ireversibilă doar în sensul automat: `activa` rămâne
--   editabilă din UI, deci o poprire stinsă din greșeală se poate reactiva
--   după ce reținerea greșită e ștearsă logic.
