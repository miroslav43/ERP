-- supabase/migrations/0111_functia_in_functiile_sql.sql
-- Cele trei funcții SQL care citeau nomenclatorul trec pe codul COR.
--
-- ┌ De ce nu în aceeași migrare cu ștergerile ────────────────────────────────
-- │ 0110 a adăugat coloanele și a copiat datele; ștergerea coloanelor vechi
-- │ mai așteaptă, fiindcă build-ul aflat în producție încă le citește. Dar
-- │ funcțiile de mai jos NU pot aștepta, iar motivul e o singură linie de cod
-- │ din aplicație:
-- │
-- │     ctx.supabase.rpc("checklist_salveaza_sablon", { p_sablon: input })
-- │
-- │ Acțiunea trimite de acum `cod_cor` în încărcătura JSON. Funcția din bază
-- │ citește `p_sablon->>'job_position_id'`. Nimic nu eșuează: câmpul „Restrâns
-- │ la ocupație" s-ar salva ca și cum ar merge, iar restricția nu s-ar scrie
-- │ niciodată. Un refuz tăcut, exact clasa pe care o documentează
-- │ `docs/design/ecrane/capcane.md`.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ DE CE RPC-UL DE ȘABLON SCRIE AMÂNDOUĂ COLOANELE ──────────────────────────
-- │ `checklist_salveaza_sablon` continuă să scrie `job_position_id` din
-- │ încărcătură, pe lângă `cod_cor`. Nu e nehotărâre: în fereastra dintre
-- │ migrarea asta și deploy, build-ul livrat trimite încă vechea cheie. Dacă
-- │ funcția ar înceta să o citească, salvările din acea fereastră ar pierde
-- │ tăcut restricția — același defect, doar în cealaltă direcție.
-- │ Ramura veche pică odată cu coloana, în migrarea de curățenie.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce nu are coadă de REVOKE/GRANT ───────────────────────────────────────
-- │ `create or replace function` PĂSTREAZĂ drepturile existente. Un
-- │ `revoke ... from public` scris „după tipar" ar SCHIMBA aici starea curentă:
-- │ `app.drept_concediu` are azi EXECUTE pentru PUBLIC (`=X/postgres`), iar
-- │ retragerea lui e o decizie de securitate separată, nu un efect secundar al
-- │ unei redenumiri de coloană.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Corpurile de mai jos sunt EXTRASE din bază cu `pg_get_functiondef` și
-- peticite programatic — nu retranscrise. Diferența față de original e de
-- exact 3 linii la `app.drept_concediu`, 1 la `internal.cursuri_aplica_regulile`
-- și 3 la `public.checklist_salveaza_sablon`.
--
-- Plan: docs/superpowers/plans/2026-08-30-functia-pe-fisa.md

-- =====================================================================================
-- 1. Dreptul de concediu — criteriul „funcție" citește codul COR
-- =====================================================================================

CREATE OR REPLACE FUNCTION app.drept_concediu(p_org uuid, p_employee uuid, p_type uuid, p_an integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_baza          numeric(6,2);
  v_suplimentar   numeric(6,2);
  v_referinta     date;
  v_hired_on      date;
  v_data_nasterii date;
  v_conditii      text;
  v_handicap      text;
  v_department    uuid;
  v_cod_cor       text;
  v_vechime_luni  integer;
begin
  select lt.zile_implicite into v_baza
  from public.leave_types lt
  where lt.id = p_type and lt.organization_id = p_org and lt.deleted_at is null;

  if v_baza is null then
    return 0;
  end if;

  v_referinta := make_date(p_an, 12, 31);

  select e.hired_on, e.data_nasterii, e.conditii_munca::text, e.grad_handicap,
         e.department_id, e.cod_cor
    into v_hired_on, v_data_nasterii, v_conditii, v_handicap, v_department, v_cod_cor
  from public.employees e
  where e.id = p_employee and e.organization_id = p_org and e.deleted_at is null;

  v_vechime_luni := case
    when v_hired_on is null or v_hired_on > v_referinta then 0
    else (
      extract(year from age(v_referinta, v_hired_on)) * 12
      + extract(month from age(v_referinta, v_hired_on))
    )::integer
  end;

  select coalesce(sum(r.zile_suplimentare), 0) into v_suplimentar
  from public.leave_entitlement_rules r
  where r.organization_id = p_org
    and r.leave_type_id = p_type
    and r.activ
    and r.deleted_at is null
    and r.valabil_de_la <= v_referinta
    and (r.valabil_pana_la is null or r.valabil_pana_la >= v_referinta)
    and (
      (r.tip_criteriu = 'vechime' and v_vechime_luni >= r.vechime_ani_min * 12)
      or (r.tip_criteriu = 'conditii_munca' and v_conditii = r.valoare_text)
      or (r.tip_criteriu = 'grad_handicap' and v_handicap = r.valoare_text)
      or (
        r.tip_criteriu = 'varsta_sub_18'
        and v_data_nasterii is not null
        and age(v_referinta, v_data_nasterii) < interval '18 years'
      )
      or (r.tip_criteriu = 'departament' and v_department = r.department_id)
      or (r.tip_criteriu = 'functie' and v_cod_cor is not null and v_cod_cor = r.cod_cor)
    );

  return v_baza + v_suplimentar;
end;
$function$;

-- =====================================================================================
-- 2. Atribuirea automată a cursurilor
-- =====================================================================================

CREATE OR REPLACE FUNCTION internal.cursuri_aplica_regulile(p_org uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_regula record;
  v_facute integer := 0;
begin
  for v_regula in
    select r.*, c.termen_zile as termen_curs
    from public.course_assignment_rules r
    join public.courses c
      on c.id = r.course_id and c.deleted_at is null and c.publicat and c.activ
    where r.deleted_at is null
      and r.activ
      and (p_org is null or r.organization_id = p_org)
      and app.feature_on(r.organization_id, 'courses')
      and exists (
        select 1 from public.course_items ci
        where ci.course_id = r.course_id and ci.deleted_at is null
      )
  loop
    begin
      insert into public.course_enrollments (
        organization_id, course_id, employee_id, motiv, termen
      )
      select
        v_regula.organization_id,
        v_regula.course_id,
        e.id,
        'regula'::public.curs_motiv,
        current_date + coalesce(v_regula.termen_zile, v_regula.termen_curs)::integer
      from public.employees e
      where e.organization_id = v_regula.organization_id
        and e.deleted_at is null
        and e.status in ('activ', 'suspendat', 'preaviz')
        -- Decalajul se numără de la angajare. O fișă fără dată de angajare
        -- intră imediat: altfel n-ar intra niciodată, tăcut.
        and (v_regula.decalaj_zile = 0
             or e.hired_on is null
             or e.hired_on + v_regula.decalaj_zile::integer <= current_date)
        and (
          v_regula.criteriu = 'toti'
          or (v_regula.criteriu = 'departament' and e.department_id = v_regula.department_id)
          or (v_regula.criteriu = 'functie' and e.cod_cor is not null and e.cod_cor = v_regula.cod_cor)
          or (v_regula.criteriu = 'angajat' and e.id = v_regula.employee_id)
          or (v_regula.criteriu = 'rol' and exists (
                select 1 from public.organization_members m
                where m.organization_id = v_regula.organization_id
                  and m.user_id = e.user_id
                  and m.role = v_regula.rol
                  and m.status = 'active'
                  and m.deleted_at is null))
        )
        -- Cine are deja cursul deschis sau parcurs nu se re-înrolează.
        -- Recertificarea deschide ciclul următor pe alt drum (0075).
        and not exists (
          select 1 from public.course_enrollments ex
          where ex.organization_id = v_regula.organization_id
            and ex.course_id = v_regula.course_id
            and ex.employee_id = e.id
            and ex.deleted_at is null
            and ex.status in ('neinceput', 'in_curs', 'finalizat')
        );

      get diagnostics v_facute = row_count;
    exception
      when others then null;
    end;
  end loop;
  return v_facute;
end;
$function$;

-- =====================================================================================
-- 3. Salvarea șablonului de checklist (RPC din asistent)
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.checklist_salveaza_sablon(p_sablon jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_org      uuid;
  v_id       uuid;
  v_etapa    jsonb;
  v_pas      jsonb;
  v_etapa_id uuid;
  v_nr_etapa smallint := 0;
  v_nr_pas   smallint := 0;
begin
  if p_sablon is null or jsonb_typeof(p_sablon) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Șablonul trimis nu are forma așteptată.';
  end if;

  v_id := nullif(p_sablon->>'id', '')::uuid;

  ---------------------------------------------------------------------------
  -- Antetul
  ---------------------------------------------------------------------------
  if v_id is null then
    -- Organizația NU vine din încărcătură: se ia de la sesiune. Altfel
    -- clientul ar putea numi altă firmă, iar `WITH CHECK` ar fi ultima poartă.
    select o.id into v_org
      from public.organizations o
     where o.id = any ((select app.current_org_ids())::uuid[])
     limit 1;

    if v_org is null then
      raise exception using errcode = 'P0001', message = 'Nicio organizație activă în sesiune.';
    end if;

    insert into public.checklist_templates (
      organization_id, denumire, tip, descriere, department_id, job_position_id, cod_cor,
      activ, valabil_de_la, valabil_pana_la
    ) values (
      v_org,
      p_sablon->>'denumire',
      (p_sablon->>'tip')::public.checklist_tip,
      nullif(p_sablon->>'descriere', ''),
      nullif(p_sablon->>'department_id', '')::uuid,
      nullif(p_sablon->>'job_position_id', '')::uuid,
      nullif(p_sablon->>'cod_cor', ''),
      coalesce((p_sablon->>'activ')::boolean, true),
      coalesce(nullif(p_sablon->>'valabil_de_la', '')::date, current_date),
      nullif(p_sablon->>'valabil_pana_la', '')::date
    )
    returning id, organization_id into v_id, v_org;
  else
    update public.checklist_templates t
       set denumire        = p_sablon->>'denumire',
           tip             = (p_sablon->>'tip')::public.checklist_tip,
           descriere       = nullif(p_sablon->>'descriere', ''),
           department_id   = nullif(p_sablon->>'department_id', '')::uuid,
           job_position_id = nullif(p_sablon->>'job_position_id', '')::uuid,
           cod_cor         = nullif(p_sablon->>'cod_cor', ''),
           activ           = coalesce((p_sablon->>'activ')::boolean, true),
           valabil_de_la   = coalesce(nullif(p_sablon->>'valabil_de_la', '')::date, t.valabil_de_la),
           valabil_pana_la = nullif(p_sablon->>'valabil_pana_la', '')::date,
           updated_at      = now()
     where t.id = v_id
       and t.deleted_at is null
    returning t.organization_id into v_org;

    -- Un UPDATE respins de clauza `USING` a politicii atinge ZERO RÂNDURI,
    -- FĂRĂ EROARE. Fără verificarea asta, funcția ar merge mai departe și ar
    -- părea că a salvat.
    if v_org is null then
      raise exception using errcode = 'P0001',
        message = 'Șablonul nu există sau nu aveți dreptul să-l modificați.';
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- Parcarea: tot ce e viu trece pe banda negativă
  ---------------------------------------------------------------------------
  update public.checklist_template_items
     set ordine = -ordine
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine > 0;

  update public.checklist_template_stages
     set ordine = -ordine
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine > 0;

  ---------------------------------------------------------------------------
  -- Etapele și pașii, în ordinea din încărcătură
  ---------------------------------------------------------------------------
  for v_etapa in
    select value from jsonb_array_elements(coalesce(p_sablon->'etape', '[]'::jsonb))
  loop
    v_nr_etapa := v_nr_etapa + 1;
    v_etapa_id := nullif(v_etapa->>'id', '')::uuid;

    if v_etapa_id is null then
      insert into public.checklist_template_stages (
        organization_id, template_id, ordine, titlu, descriere, termen_zile_relativ
      ) values (
        v_org, v_id, v_nr_etapa,
        v_etapa->>'titlu',
        nullif(v_etapa->>'descriere', ''),
        coalesce((v_etapa->>'termen_zile_relativ')::smallint, 0)
      )
      returning id into v_etapa_id;
    else
      update public.checklist_template_stages st
         set ordine              = v_nr_etapa,
             titlu               = v_etapa->>'titlu',
             descriere           = nullif(v_etapa->>'descriere', ''),
             termen_zile_relativ = coalesce((v_etapa->>'termen_zile_relativ')::smallint, 0),
             deleted_at          = null,
             updated_at          = now()
       where st.id = v_etapa_id and st.organization_id = v_org and st.template_id = v_id;

      if not found then
        raise exception using errcode = 'P0001',
          message = 'O etapă trimisă nu aparține acestui șablon.';
      end if;
    end if;

    for v_pas in
      select value from jsonb_array_elements(coalesce(v_etapa->'pasi', '[]'::jsonb))
    loop
      v_nr_pas := v_nr_pas + 1;
      perform app.checklist_scrie_pasul(v_org, v_id, v_etapa_id, v_nr_pas, v_pas);
    end loop;
  end loop;

  -- Pașii fără etapă, dacă asistentul îi trimite (șabloane vechi, migrate).
  for v_pas in
    select value from jsonb_array_elements(coalesce(p_sablon->'pasi_fara_etapa', '[]'::jsonb))
  loop
    v_nr_pas := v_nr_pas + 1;
    perform app.checklist_scrie_pasul(v_org, v_id, null, v_nr_pas, v_pas);
  end loop;

  ---------------------------------------------------------------------------
  -- Ce a rămas pe banda negativă nu mai există în asistent: ștergere logică.
  -- Poziția se readuce pozitivă, ca triggerul amânat să nu se plângă și ca un
  -- eventual „undelete” să găsească o valoare cu sens.
  ---------------------------------------------------------------------------
  update public.checklist_template_items
     set ordine = -ordine, deleted_at = now(), updated_at = now()
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine < 0;

  update public.checklist_template_stages
     set ordine = -ordine, deleted_at = now(), updated_at = now()
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine < 0;

  return v_id;
end;
$function$;
