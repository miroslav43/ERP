-- 0186_asistent_activeaza_firma.sql
--
-- ADMINISTRATORUL FIRMEI POATE TERMINA ASISTENTUL: `pending` → `active`, O DATĂ.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- `internal.guard_organizations()` (0002, redefinită în 0121) readuce la
-- valoarea veche, pentru orice sesiune care nu e de serviciu sau de platformă,
-- toate coloanele „ale platformei": `plan`, `seats_limit`, `cui`, `status`,
-- `activated_at` … — TĂCUT, fără eroare, ca un `select('*')` trimis înapoi de
-- un org_admin să nu pice. Dar `completeazaDateleFirmei` (asistentul
-- `/bun-venit`) scrie `status = 'active'` prin sesiunea org_admin-ului, cu
-- intenție: RLS confirmă că e firma LUI. Garda îi anula exact coloana pentru
-- care există, UPDATE-ul întorcea rândul (deci nici `actualizata === null` nu
-- prindea nimic), `payroll_settings` se crea, iar firma rămânea `pending`.
-- A doua încercare dădea CONFLICT pe unicitatea din `payroll_settings`.
--
-- Consecința, verificată în producție pe 8 oct 2026 (QA, ONB-011): NICIO firmă
-- înregistrată public nu a putut termina vreodată asistentul. Firmele existente
-- fuseseră create din consolă, de un administrator de platformă, deci nu au
-- trecut pe aici. Poarta negativă era verificată; cea pozitivă, nu.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · O singură excepție îngustă în gardă: dacă rândul vechi e `pending`, cel nou
--    e `active`, iar apelantul are `organizations:update = all` pe firma
--    respectivă (adică e org_admin-ul ei), `status` și `activated_at` trec.
--    Restul coloanelor platformei se readuc la valoarea veche exact ca înainte.
--  · Orice altă tranziție (`active` → `suspended`, `active` → `pending`) rămâne
--    a platformei. Un org_admin nu-și poate suspenda, arhiva sau „dezactiva"
--    firma — și nici n-o poate activa din nou dacă platforma a suspendat-o.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu atinge politicile RLS, granturile, nici drumul de INSERT din 0121.
--  · Nu repară rândurile deja blocate în `pending`: firma de test a fost
--    activată din consolă; dacă mai apar, se activează tot de acolo.
--
-- Proba: `tests/rls/proba-activare-asistent.sql`.
-- Forward-only: 0121 e aplicată pe cloud și NU se editează.

begin;

create or replace function internal.guard_organizations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_activare boolean := false;
begin
  if app.is_service_context() or (select app.is_platform_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Singura cale prin care o firmă se poate crea singură. Steagul e pus de
    -- `public.inregistreaza_organizatie`, iar forma rândului e verificată aici,
    -- nu acolo: o gardă care se bazează pe buna-credință a apelantului nu e gardă.
    if coalesce(current_setting('app.inregistrare_publica', true), '') = 'on'
       and new.status = 'pending'
       and new.plan = 'trial'
       and new.created_by is null
       and new.deleted_at is null then
      return new;
    end if;

    raise exception 'Organizațiile se creează exclusiv din Super-Admin.'
      using errcode = 'PT403';
  end if;

  -- Excepția asistentului (0186): administratorul firmei o trece din `pending`
  -- în `active` o singură dată. Verificat PE firma rândului, cu funcția care
  -- aplică și suprascrierile per organizație / per membru — nu pe rolul brut.
  if old.status = 'pending'
     and new.status = 'active'
     and app.has_permission(old.id, 'organizations', 'update') = 'all' then
    v_activare := true;
  end if;

  -- Coloanele rezervate platformei se readuc la valoarea veche în loc să se
  -- refuze update-ul: un org_admin poate trimite `select('*')` înapoi, iar un
  -- GRANT pe coloane ar sparge PostgREST. Rezultatul e identic ca securitate.
  new.id                  := old.id;
  new.slug                := old.slug;
  new.cui                 := old.cui;
  new.plan                := old.plan;
  new.seats_limit         := old.seats_limit;
  new.subscription_status := old.subscription_status;
  new.trial_ends_at       := old.trial_ends_at;
  new.suspended_at        := old.suspended_at;
  new.suspended_reason    := old.suspended_reason;
  new.deleted_at          := old.deleted_at;
  new.created_at          := old.created_at;

  if v_activare then
    new.status       := 'active';
    new.activated_at := coalesce(new.activated_at, now());
  else
    new.status       := old.status;
    new.activated_at := old.activated_at;
  end if;

  return new;
end;
$$;

comment on function internal.guard_organizations() is
  'Gardă BEFORE INSERT/UPDATE pe organizations: coloanele platformei se readuc la valoarea veche pentru sesiunile non-platformă; singura excepție este tranziția pending → active făcută de org_admin-ul firmei (0186, asistentul /bun-venit).';

commit;
