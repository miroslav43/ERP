-- supabase/migrations/0168_sablon_evaluare_personalizat.sql
--
-- VARIANTA FIRMEI A UNUI ȘABLON DE EVALUARE DE PLATFORMĂ.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Șablonul de platformă (`organization_id is null`) e comun tuturor firmelor,
-- deci nu se poate edita pe loc. „Personalizează” făcea o COPIE alături: în
-- listă apăreau două carduri, „Evaluare anuală standard” și „… (copie)”, iar
-- omul — care voia să schimbe șablonul, nu să mai aibă unul — ștergea copia
-- și întreba de ce nu poate personaliza șablonul (6 oct 2026).
--
-- Acum varianta ține minte din ce șablon de platformă provine (`derivat_din`),
-- iar citirea (`src/lib/queries/evaluari.ts`, `listeazaSabloane`) ascunde
-- șablonul de platformă cât timp firma are o variantă vie a lui: în listă, la
-- „Evaluare nouă” și pe fișa angajatului rămâne UN singur șablon. Ștergerea
-- variantei (0162) îl readuce pe cel de platformă.
--
-- ── CE GARANTEAZĂ BAZA ──────────────────────────────────────────────────────
-- · `derivat_din` arată doar spre un șablon de PLATFORMĂ (trigger) și doar de
--   pe un șablon al unei FIRME (check) — o firmă nu derivă din șablonul alteia.
-- · O singură variantă vie per firmă și șablon de platformă (index unic
--   parțial `where deleted_at is null`, ca peste tot în proiect).
--
-- ── COMPLETAREA DATELOR EXISTENTE ───────────────────────────────────────────
-- Variantele create înainte de coloana asta (prin vechiul „Personalizează”)
-- poartă numele șablonului de platformă — fie identic, fie cu „ (copie)”.
-- Se leagă cea mai veche variantă vie cu nume IDENTIC (fără „(copie)”, care
-- e un duplicat cerut explicit); restul rămân șabloane independente.

begin;

-- ============================================================
-- 1. COLOANA
-- ============================================================

alter table public.evaluation_templates
  add column derivat_din uuid references public.evaluation_templates (id) on delete restrict;

alter table public.evaluation_templates
  add constraint evaluation_templates_derivat_doar_firma
  check (derivat_din is null or organization_id is not null);

comment on column public.evaluation_templates.derivat_din is
  'Șablonul de platformă din care e personalizată varianta firmei. Cât timp varianta e vie, cel de platformă nu se mai arată firmei (0168).';

-- ============================================================
-- 2. INDEX
-- ============================================================

create unique index evaluation_templates_varianta_uniq
  on public.evaluation_templates (organization_id, derivat_din)
  where deleted_at is null and derivat_din is not null;

-- ============================================================
-- 3. TRIGGER — `derivat_din` doar spre un șablon de platformă
-- ============================================================

create or replace function internal.evaluation_templates_derivat_din_platforma()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.derivat_din is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.derivat_din is not distinct from old.derivat_din then
    return new;
  end if;
  if not exists (
    select 1 from public.evaluation_templates t
     where t.id = new.derivat_din
       and t.organization_id is null
       and t.deleted_at is null
  ) then
    raise exception 'Se poate personaliza doar un șablon de platformă.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal.evaluation_templates_derivat_din_platforma() from public, anon;

create trigger evaluation_templates_derivat_din_platforma
  before insert or update of derivat_din on public.evaluation_templates
  for each row execute function internal.evaluation_templates_derivat_din_platforma();

-- ============================================================
-- 4. COMPLETAREA VARIANTELOR EXISTENTE
-- ============================================================

update public.evaluation_templates v
   set derivat_din = p.id
  from public.evaluation_templates p
 where v.organization_id is not null
   and v.deleted_at is null
   and v.derivat_din is null
   and p.organization_id is null
   and p.deleted_at is null
   and lower(v.denumire) = lower(p.denumire)
   and v.id = (
     select v2.id from public.evaluation_templates v2
      where v2.organization_id = v.organization_id
        and v2.deleted_at is null
        and lower(v2.denumire) = lower(p.denumire)
      order by v2.created_at, v2.id
      limit 1
   );

commit;
