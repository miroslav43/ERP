-- tests/rls/proba-saptamana-devine-pontaj.sql
--
-- POARTA POZITIVĂ a fișei săptămânale (0138): nu „săptămâna nu calcă peste
-- pontaj", ci „săptămâna aprobată CHIAR ajunge în pontaj".
--
-- ── DE CE EXISTĂ PROBA ──────────────────────────────────────────────────────
-- `attendance_week_submissions` (0041) a fost gândit ca PLAN, iar aprobarea lui
-- nu producea nimic. Pentru firma care îl folosește însă, formularul acela E
-- fișa de pontaj a săptămânii: ecranul stă sub „Pontaj", butonul spune „Trimite
-- spre aprobare", aprobarea vine — și calendarul rămânea gol.
--
-- Verificat pe baza reală înainte de reparație: două submisii `aprobata`, ZERO
-- intrări de pontaj produse de ele. Salarizarea, care citește
-- `attendance_entries`, ar fi numărat zero ore pentru o lună întreagă
-- declarată și aprobată.
--
-- Proba verifică AICI doar ce ține de bază — că eticheta nouă de sursă există
-- și că o zi scrisă cu ea trece de toate triggerele și politicile. Filtrarea
-- (zile fără interval, zile deja pontate) e în `scrie-pontajul.ts`, cu testele
-- ei; SQL-ul n-o poate exercita fără să reimplementeze acțiunea.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) `saptamana` e o valoare acceptată de `attendance_entry_source`
-- (2) o zi scrisă cu ea intră în pontaj și PRIMEȘTE period_id de la trigger
-- (3) `tip_zi` trimis explicit se PĂSTREAZĂ — triggerul nu-l rescrie
-- (4) ziua ajunge în agregarea de salarizare, adică e văzută ca oră lucrată
-- (5) o zi APROBATĂ cu interval complet trece de constrângerea din 0096 —
--     zilele scrise dintr-o săptămână aprobată sosesc gata aprobate, ca să nu
--     ceară o a doua aprobare pentru ce tocmai s-a aprobat
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-saptamana-devine-pontaj.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_e_ang    uuid;
  v_zi       date;
  v_period   uuid;
  v_tip      text;
  v_ore      numeric;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „SĂPTĂMÂNA APROBATĂ DEVINE PONTAJ" (0138)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- O sâmbătă, ca (3) să aibă ce dovedi: dacă triggerul ar rescrie `tip_zi`,
  -- ziua ar ieși `weekend` chiar dacă am trimis altceva — sau invers.
  v_zi := date_trunc('week', current_date)::date + 5;

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-sapt-pontaj-' || v_sufix, 'Proba Săptămână→Pontaj SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into public.organization_features (organization_id, feature_key, enabled) values
    (v_org, 'nucleu', true), (v_org, 'attendance', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  insert into auth.users (id, email) values (v_u_ang, 'ang-' || v_sufix || '@proba.test');
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_ang, 'employee');

  insert into public.employees (organization_id, marca, first_name, last_name, user_id, is_primary)
    values (v_org, 'W-' || v_sufix, 'Ana', 'Angajat', v_u_ang, true)
    returning id into v_e_ang;

  -- ── (1) + (2) POARTA POZITIVĂ ──
  -- `period_id` inert, ca în cod: triggerul îl suprascrie și deschide luna.
  begin
    insert into public.attendance_entries
      (organization_id, employee_id, data, ora_inceput, ora_sfarsit, ore_lucrate,
       tip_zi, sursa, period_id)
    values (v_org, v_e_ang, v_zi, '09:00', '17:00', 7.5,
            'weekend', 'saptamana', '00000000-0000-0000-0000-000000000000');
    raise notice '  ✓ (1) sursa „saptamana" e acceptată de enum';
  exception when others then
    raise warning '  ✗ (1) inserarea cu sursa „saptamana" a picat: % (%)', sqlerrm, sqlstate;
    v_esecuri := v_esecuri + 1;
  end;

  select ae.period_id, ae.tip_zi::text, ae.ore_lucrate
    into v_period, v_tip, v_ore
    from public.attendance_entries ae
   where ae.organization_id = v_org and ae.employee_id = v_e_ang and ae.data = v_zi;

  if v_period is not null and v_period <> '00000000-0000-0000-0000-000000000000' then
    raise notice '  ✓ (2) triggerul a pus period_id real și a deschis luna';
  else
    raise warning '  ✗ (2) period_id a rămas placeholderul — luna nu s-a deschis.';
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (3) `tip_zi` trimis explicit se păstrează ──
  if v_tip = 'weekend' then
    raise notice '  ✓ (3) tip_zi trimis explicit s-a păstrat („weekend")';
  else
    raise warning '  ✗ (3) tip_zi a ieșit „%s", nu „weekend" — triggerul îl rescrie, deci sâmbăta lucrată pierde sporul.', v_tip;
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (4) ziua chiar ajunge în salarizare ──
  select coalesce(sum(a.ore_lucrate), 0) into v_ore
    from public.pontaj_agregat_salarizare(v_period) a
   where a.employee_id = v_e_ang;
  if v_ore = 7.5 then
    raise notice '  ✓ (4) ziua intră în agregarea de salarizare (7,5 ore)';
  else
    raise warning '  ✗ (4) salarizarea vede % ore, se așteptau 7,5 — ziua nu se plătește.', v_ore;
    v_esecuri := v_esecuri + 1;
  end if;

  -- ── (5) ziua sosește APROBATĂ ──
  -- Firma folosește fișa săptămânală ca metodă de pontaj: managerul aprobă
  -- săptămâna, iar zilele trebuie să apară aprobate peste tot. Scrise
  -- neaprobate, reapăreau în „Aprobă în bloc" ca linii de aprobat — exact ce
  -- tocmai fusese aprobat, cerut a doua oară de același om, iar ecranul de
  -- aprobare ajungea să spună sus „o săptămână de aprobat" și jos „nimic de
  -- aprobat".
  begin
    update public.attendance_entries
       set approved_at = now(), approved_by = v_u_ang
     where organization_id = v_org and employee_id = v_e_ang and data = v_zi;
    raise notice '  ✓ (5) o zi cu interval complet POATE fi aprobată la scriere';
  exception when others then
    raise warning '  ✗ (5) aprobarea la scriere a picat: % (%) — zilele ar cere o a doua aprobare.', sqlerrm, sqlstate;
    v_esecuri := v_esecuri + 1;
  end;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri = 0 then
    raise notice '  TOT VERDE — săptămâna aprobată ajunge în pontaj și în salarizare.';
  else
    raise exception 'PROBA SĂPTĂMÂNĂ→PONTAJ: % verificări picate.', v_esecuri;
  end if;
  raise notice '';
end $$;
