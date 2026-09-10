-- tests/rls/proba-cod-departament.sql
--
-- CODUL OPȚIONAL AL DEPARTAMENTULUI (0139), probat pe schema reală.
--
-- ── DE CE NU AJUNGE `alter column cod drop not null` ────────────────────────
-- Coloana are, din 0004, DOUĂ paznici pe care migrarea îi lasă neatinși în mod
-- deliberat, iar ambii se pot comporta altfel decât spune intuiția:
--
--   * `departments_cod_len check (char_length(cod) between 1 and 32)`. Un CHECK
--     care se evaluează la NULL nu respinge rândul — Postgres cere „not false",
--     nu „true". Dacă intuiția ar fi fost greșită aici, migrarea ar fi părut
--     aplicată și tot ce urmează ar fi picat la prima inserare fără cod.
--   * `departments_org_cod_uniq on (organization_id, lower(cod))`. Într-un index
--     unic NULL e distinct de orice alt NULL, CÂT TIMP indexul nu e declarat
--     `nulls not distinct`. Dacă ar fi fost, a doua firmă care creează al doilea
--     departament fără cod ar fi primit 23505 pe un câmp lăsat gol intenționat.
--
-- Verificarea (6) e cea care leagă schimbarea de 0107: comparația
-- `lower(cod) = 'conducere'` se evaluează la NULL pentru un cod absent, deci
-- fals în `where`. Un departament fără cod nu poate fi confundat cu conducerea
-- firmei — altfel repartizarea automată a administratorilor ar fi ajuns, tăcut,
-- în primul departament fără cod din listă.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) un departament se creează FĂRĂ cod;
-- (2) două departamente fără cod coexistă în aceeași firmă;
-- (3) șirul vid rămâne refuzat — golul se scrie NULL, nu "";
-- (4) codul duplicat, chiar scris cu alte majuscule, rămâne refuzat în firmă;
-- (5) același cod în DOUĂ firme diferite trece — unicitatea e per organizație;
-- (6) departamentele fără cod nu se adaugă la cele recunoscute drept „conducere";
-- (7) codul se poate completa ulterior, pe un departament creat fără el.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org1    uuid := gen_random_uuid();
  v_org2    uuid := gen_random_uuid();
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc.
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_fara    uuid;
  v_citit   text;
  v_nr      int;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „COD OPȚIONAL DE DEPARTAMENT" (0139)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui)
  values (v_org1, 'proba-cod-a-' || v_sufix, 'Proba Cod A SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text),
         (v_org2, 'proba-cod-b-' || v_sufix, 'Proba Cod B SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);

  -- ═══ (1) Un departament fără cod ═══════════════════════════════════════════
  begin
    insert into public.departments (organization_id, denumire)
    values (v_org1, 'Contabilitate')
    returning id into v_fara;
    raise notice '  ✓ (1) departamentul se creează fără cod';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) inserarea fără cod a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (2) Al doilea fără cod, în ACEEAȘI firmă ══════════════════════════════
  begin
    insert into public.departments (organization_id, denumire)
    values (v_org1, 'Achiziții');
    raise notice '  ✓ (2) două departamente fără cod coexistă în aceeași firmă';
  exception when unique_violation then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) al doilea departament fără cod a lovit indexul unic — '
                  'NULL e tratat ca valoare, nu ca absență';
  end;

  -- ═══ (3) Șirul vid RĂMÂNE refuzat ══════════════════════════════════════════
  -- Dacă ar trece, aplicația ar avea două feluri de „fără cod", iar al doilea
  -- s-ar ciocni de el însuși la următorul departament. Vezi `codOptional` din
  -- `src/schemas/department.ts`, care taie spațiile și scrie NULL.
  begin
    insert into public.departments (organization_id, cod, denumire)
    values (v_org1, '', 'Marketing');
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) șirul vid a fost ACCEPTAT drept cod';
  exception when check_violation then
    raise notice '  ✓ (3) șirul vid rămâne refuzat de `departments_cod_len`';
  end;

  -- ═══ (4) Codul duplicat rămâne refuzat, indiferent de majuscule ════════════
  insert into public.departments (organization_id, cod, denumire)
  values (v_org1, 'PROD', 'Producție');
  begin
    insert into public.departments (organization_id, cod, denumire)
    values (v_org1, 'prod', 'Producție 2');
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) „prod" a trecut peste „PROD" în aceeași firmă';
  exception when unique_violation then
    raise notice '  ✓ (4) codul duplicat rămâne refuzat, insensibil la majuscule';
  end;

  -- ═══ (5) Același cod în două firme ═════════════════════════════════════════
  begin
    insert into public.departments (organization_id, cod, denumire)
    values (v_org2, 'PROD', 'Producție');
    raise notice '  ✓ (5) același cod trece în altă firmă — unicitatea e per organizație';
  exception when unique_violation then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) codul se ciocnește ÎNTRE firme — izolarea indexului e ruptă';
  end;

  -- ═══ (6) Fără cod ≠ conducerea firmei ══════════════════════════════════════
  -- Firma se naște cu departamentul CONDUCERE (0107). După cele două
  -- departamente fără cod adăugate mai sus, el trebuie să rămână singurul pe
  -- care triggerele îl recunosc.
  select count(*) into v_nr
    from public.departments d
   where d.organization_id = v_org1
     and lower(d.cod) = 'conducere'
     and d.deleted_at is null;

  if v_nr <> 1 then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) firma are % departamente recunoscute drept „conducere", nu 1', v_nr;
  else
    raise notice '  ✓ (6) departamentele fără cod nu sunt confundate cu conducerea';
  end if;

  -- ═══ (7) Codul se poate completa ulterior ══════════════════════════════════
  -- Perechea SQL a lui `actualizeazaDepartamentSchema`, care nu-l mai omite.
  update public.departments set cod = 'CTB' where id = v_fara;
  select cod into v_citit from public.departments where id = v_fara;
  if v_citit is distinct from 'CTB' then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) codul completat ulterior nu s-a scris (cod = %)',
      coalesce(v_citit, 'null');
  else
    raise notice '  ✓ (7) codul se poate completa ulterior, pe un departament fără el';
  end if;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % verificări nepotrivite.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: golul e NULL, unicitatea ține doar pentru cine scrie un cod.';
end
$$;
