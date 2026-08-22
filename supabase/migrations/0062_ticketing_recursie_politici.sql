-- supabase/migrations/0062_ticketing_recursie_politici.sql
--
-- Rupe recursiunea dintre politicile modulului de tichete.
--
-- Ciclul, exact așa cum îl raportează Postgres („infinite recursion detected in
-- policy for relation «tickets»"):
--
--   ticket_attachments_select  →  exists (select 1 from public.tickets …)
--     → tickets_select         →  exists (select 1 from public.ticket_watchers …)
--       → ticket_watchers_select →  exists (select 1 from public.tickets …)
--         → tickets_select     →  … la nesfârșit
--
-- Aceleași două muchii închid bucla și prin `ticket_comments`, `ticket_history`
-- și `ticket_watchers`. Efectul nu e un refuz, ci o EROARE: orice citire care
-- atinge o tabelă-copil cade cu 42P17, indiferent de drepturi. Nu s-a văzut la
-- livrare fiindcă un tichet fără urmăritori nu declanșează totdeauna ramura, iar
-- planificatorul nu intră în subinterogare când o condiție anterioară a decis
-- deja rezultatul.
--
-- Reparația taie ciclul în ambele puncte, cu funcții `security definer` — ele
-- citesc tabelele OCOLIND RLS, deci nu mai declanșează politicile care ne-au
-- adus înapoi. Regula de vizibilitate rămâne neschimbată, doar mutată din
-- politică în funcție.
--
-- Găsită de `tests/rls/izolare.sql`, verificarea (c), la adăugarea primelor
-- rânduri de ticketing în fixture. Cele cinci tabele ale modulului fuseseră
-- livrate fără niciun rând acolo, deci nimeni nu le citise vreodată sub o
-- identitate reală.

begin;

-- ── 1. Sunt urmăritorul tichetului? ─────────────────────────────────────────
--
-- Citește `ticket_watchers` ca definer. Fără ea, `tickets_select` interoghează
-- tabela sub RLS, iar politica ei se întoarce la `tickets`.
create or replace function app.sunt_urmaritor_tichet(p_ticket_id uuid, p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ticket_watchers w
    where w.ticket_id = p_ticket_id
      and w.employee_id = app.fisa_mea(p_organization_id)
  );
$$;
comment on function app.sunt_urmaritor_tichet(uuid, uuid) is
  'Urmăritor al tichetului. SECURITY DEFINER ca să nu declanșeze ticket_watchers_select din tickets_select (recursiune, 0060).';
revoke all on function app.sunt_urmaritor_tichet(uuid, uuid) from public;
grant execute on function app.sunt_urmaritor_tichet(uuid, uuid) to authenticated;

-- ── 2. Pot vedea tichetul? ──────────────────────────────────────────────────
--
-- Aceeași regulă ca `tickets_select`, dar citind `tickets` ca definer. Tabelele
-- copil o apelează în locul unui `exists (select 1 from public.tickets …)`.
--
-- Regula se scrie o singură dată: dacă mâine se schimbă cine vede un tichet, se
-- schimbă aici, iar copiii o urmează. Înainte, fiecare tabelă-copil se sprijinea
-- pe politica părintelui, ceea ce era corect ca intenție și fatal ca mecanism.
create or replace function app.pot_vedea_tichetul(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        (select app.is_platform_admin())
        or (
          t.deleted_at is null
          and t.organization_id = any ((select app.current_org_ids())::uuid[])
          and (
            app.has_permission(t.organization_id, 'tickets', 'read') = 'all'
            or t.solicitant_employee_id = app.fisa_mea(t.organization_id)
            or t.asignat_employee_id = app.fisa_mea(t.organization_id)
            or app.sunt_manager_direct(t.solicitant_employee_id)
            or app.sunt_urmaritor_tichet(t.id, t.organization_id)
          )
        )
      )
  );
$$;
comment on function app.pot_vedea_tichetul(uuid) is
  'Vizibilitatea unui tichet, într-un singur loc. Apelată de politicile tabelelor copil în locul unui exists pe `tickets`, care recursa (0060).';
revoke all on function app.pot_vedea_tichetul(uuid) from public;
grant execute on function app.pot_vedea_tichetul(uuid) to authenticated;

-- ── 3. Politica părintelui, fără muchia spre `ticket_watchers` ──────────────
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      deleted_at is null
      and organization_id = any ((select app.current_org_ids())::uuid[])
      and (
        app.has_permission(organization_id, 'tickets', 'read') = 'all'
        or solicitant_employee_id = app.fisa_mea(organization_id)
        or asignat_employee_id = app.fisa_mea(organization_id)
        or app.sunt_manager_direct(solicitant_employee_id)
        -- Era `exists (select 1 from public.ticket_watchers …)`. Acolo se
        -- închidea bucla.
        or app.sunt_urmaritor_tichet(id, organization_id)
      )
    )
  );

-- ── 4. Tabelele copil: funcție în loc de `exists` pe părinte ────────────────
drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments for select to authenticated
  using (
    deleted_at is null
    and app.pot_vedea_tichetul(ticket_id)
    and (
      intern = false
      or (select app.is_platform_admin())
      or app.has_permission(organization_id, 'tickets', 'read') = 'all'
      or autor_employee_id = app.fisa_mea(organization_id)
    )
  );

drop policy if exists ticket_attachments_select on public.ticket_attachments;
create policy ticket_attachments_select on public.ticket_attachments for select to authenticated
  using (deleted_at is null and app.pot_vedea_tichetul(ticket_id));

drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.pot_vedea_tichetul(ticket_id)
  );

drop policy if exists ticket_history_select on public.ticket_history;
create policy ticket_history_select on public.ticket_history for select to authenticated
  using (app.pot_vedea_tichetul(ticket_id));

drop policy if exists ticket_watchers_select on public.ticket_watchers;
create policy ticket_watchers_select on public.ticket_watchers for select to authenticated
  using (app.pot_vedea_tichetul(ticket_id));

drop policy if exists ticket_watchers_insert on public.ticket_watchers;
create policy ticket_watchers_insert on public.ticket_watchers for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.pot_vedea_tichetul(ticket_id)
  );

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.pot_vedea_tichetul(ticket_id)
    and (intern = false or app.can(organization_id, 'tickets', 'update', 'team'))
  );

-- ── 5. `ticket_watchers`: ștergere logică, nu fizică ────────────────────────
--
-- Modulul a livrat `grant ... delete` plus o politică DELETE — singura din tot
-- proiectul. Verificarea (f) din `tests/rls/izolare.sql` o respinge, și pe bună
-- dreptate: regula e ștergere logică peste tot, iar absența politicii DELETE nu
-- e o omisiune, e decizia.
--
-- Nicio linie de aplicație nu ștergea vreodată un urmăritor (`ticket_watchers`
-- apare o singură dată în `src/`, la INSERT). Deci nu se pierde nimic — se mută
-- capacitatea pe drumul canonic, ca o funcție viitoare de „nu mai urmări" să
-- aibă unde ateriza.
alter table public.ticket_watchers
  add column if not exists deleted_at timestamptz;

drop policy if exists ticket_watchers_delete on public.ticket_watchers;
revoke delete on public.ticket_watchers from authenticated;

-- Indexul unic devine PARȚIAL: altfel, cine încetează să urmărească un tichet
-- n-ar mai putea reveni niciodată — rândul șters logic ar bloca perechea.
drop index if exists public.ticket_watchers_uq;
create unique index ticket_watchers_uq
  on public.ticket_watchers (ticket_id, employee_id)
  where deleted_at is null;

-- Ștergerea logică se face prin UPDATE, cu aceleași drepturi ca vechea politică
-- DELETE: propriul rând, sau `tickets:update` la prag `team`.
grant update on public.ticket_watchers to authenticated;
drop policy if exists ticket_watchers_update on public.ticket_watchers;
create policy ticket_watchers_update on public.ticket_watchers for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      employee_id = app.fisa_mea(organization_id)
      or app.can(organization_id, 'tickets', 'update', 'team')
    )
  )
  with check (organization_id = any ((select app.current_org_ids())::uuid[]));

-- Rândurile șterse logic ies din citiri.
drop policy if exists ticket_watchers_select on public.ticket_watchers;
create policy ticket_watchers_select on public.ticket_watchers for select to authenticated
  using (deleted_at is null and app.pot_vedea_tichetul(ticket_id));

-- `app.sunt_urmaritor_tichet` trebuie să ignore și ea rândurile șterse, altfel
-- cine a încetat să urmărească ar continua să vadă tichetul.
create or replace function app.sunt_urmaritor_tichet(p_ticket_id uuid, p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ticket_watchers w
    where w.ticket_id = p_ticket_id
      and w.employee_id = app.fisa_mea(p_organization_id)
      and w.deleted_at is null
  );
$$;

-- ── 6. Verificare: nicio politică a modulului nu mai citește direct `tickets` ─
--
-- Bucla se poate reface printr-un singur `exists` adăugat la loc, iar simptomul
-- (42P17) apare abia când cineva chiar are un urmăritor. Verificarea o prinde la
-- aplicarea migrării, nu în producție.
do $$
declare
  v_ramase text := '';
  v_rand record;
begin
  for v_rand in
    select p.polname, c.relname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('ticket_comments', 'ticket_attachments', 'ticket_history', 'ticket_watchers')
      and (
        pg_get_expr(p.polqual, p.polrelid) like '%FROM tickets%'
        or pg_get_expr(p.polwithcheck, p.polrelid) like '%FROM tickets%'
      )
  loop
    v_ramase := v_ramase || format(E'\n  %s pe %s', v_rand.polname, v_rand.relname);
  end loop;

  if v_ramase <> '' then
    raise exception
      'RECURSIE POSIBILĂ: politici care citesc direct `tickets` în loc de app.pot_vedea_tichetul():%s',
      v_ramase;
  end if;
end
$$;

commit;
