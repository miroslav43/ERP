-- ─────────────────────────────────────────────────────────────────────────────
-- 0023_portal_angajat.sql — un angajat își poate citi propria fișă
--
-- Politica de SELECT pe `public.employees` are, din 0005, trei ramuri:
--
--     when 'all'  then true
--     when 'team' then manager_path @> array[app.current_employee_id(...)]
--     when 'own'  then user_id = (select auth.uid())
--
-- Ramura `own` nu era atinsă de NIMENI. Măsurat pe seed:
--     select role, scope from role_permissions
--      where resource = 'employees' and action = 'read';
--   → super_admin=all, org_admin=all, hr=all, manager=team, employee=NONE
--
-- Adică singurul rol pentru care ramura fusese scrisă era exact cel care nu o
-- putea atinge. Consecința nu e teoretică: portalul angajatului este, aproape în
-- întregime, „datele mele" — nume, marcă, departament, post, data angajării,
-- managerul direct. Fără dreptul ăsta, portalul nu poate exista.
--
-- CE SE DESCHIDE, EXACT
--
-- `own` înseamnă literal `user_id = auth.uid()`: UN singur rând, al lui.
-- Nu vede colegii, nu vede subordonații nimănui, nu vede ierarhia.
--
-- Prin ricoșeu se mai deschid două lucruri, ambele verificate înainte de a scrie
-- migrarea, fiindcă folosesc tiparul `<> 'none'` — cel care colapsează scope-urile
-- și care a fost un defect real în 0007:
--
--   • `job_positions_select` — nomenclatorul de posturi al firmei. Denumiri de
--     funcții, nimic personal. Un om trebuie să-și poată citi propriul post.
--   • `job_descriptions_select`, doar ramura `employee_id is null` — fișele de
--     post GENERICE, șabloanele. Fișa personală a altcuiva rămâne închisă.
--
-- CE NU SE DESCHIDE
--
-- `hr_read_sensitive` cere `employees:read = 'all'` exact: CNP-ul și IBAN-ul
-- rămân inaccesibile. La fel `app.poate_vedea_expirabil()` pentru fișele de
-- aptitudine medicală, permisele de muncă și contracte — toate cer `= 'all'`.
-- Datele salariale trec prin `payroll:read`, altă cheie.
--
-- Verificat că distincția ține: `= 'all'` nu se satisface cu `own`.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fără `on conflict`: indexul unic e PARȚIAL — `(organization_id, role, resource,
-- action) nulls not distinct where deleted_at is null` — iar `on conflict` nu
-- poate ținti un index parțial decât repetându-i predicatul exact. Aceeași
-- capcană a oprit deja seed-ul de demonstrație. Actualizare-apoi-inserare e
-- explicită și nu depinde de forma indexului.
do $$
begin
  update public.role_permissions
     set scope = 'own', updated_at = now()
   where role = 'employee'
     and resource = 'employees'
     and action = 'read'
     and organization_id is null
     and deleted_at is null;

  if not found then
    insert into public.role_permissions (role, resource, action, scope)
    values ('employee', 'employees', 'read', 'own');
  end if;
end
$$;


-- ── Verificare: ramura `own` chiar devine atingibilă, și nimic mai mult ─────
do $$
declare
  v_scope public.permission_scope;
begin
  select scope into v_scope
    from public.role_permissions
   where role = 'employee' and resource = 'employees' and action = 'read'
     and organization_id is null;

  if v_scope is distinct from 'own' then
    raise exception 'Rolul `employee` nu a primit employees:read = own (are: %).', v_scope;
  end if;

  -- Gărzile care trebuie să rămână închise. Dacă vreuna dintre ele ar fi scrisă
  -- vreodată cu `<> ''none''` în loc de `= ''all''`, acordarea de mai sus ar
  -- deveni o scurgere de date sensibile — de aceea o verific aici, nu în review.
  if pg_catalog.pg_get_functiondef('public.hr_read_sensitive(uuid)'::regprocedure)
     not like '%''employees'', ''read'') <> ''all''%' then
    raise exception 'hr_read_sensitive nu mai cere employees:read = all — CNP-ul ar deveni vizibil cu scope `own`.';
  end if;

  if pg_catalog.pg_get_functiondef('app.poate_vedea_expirabil(uuid, text)'::regprocedure)
     like '%''employees'', ''read'', ''own''%' then
    raise exception 'poate_vedea_expirabil acceptă acum scope `own` pentru date de personal — fișele medicale ar deveni vizibile.';
  end if;
end
$$;
