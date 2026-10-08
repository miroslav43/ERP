-- 0184_registru_angajat.sql
--
-- REGISTRUL DOCUMENTELOR: LEGĂTURA STRUCTURALĂ CU ANGAJATUL.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Ordin 217/1996 art. 9 cere „emitentul” și „destinatarul”, iar la documentele
-- salariatului el e unul dintre ele. Registrul le ține ca TEXT — numele, la
-- momentul înregistrării — cum cere rubrica. Dar ecranul trebuie să ducă de la
-- rând la fișa angajatului și de la fișă la rândurile lui, iar numele e text
-- liber: doi omonimi, un nume schimbat, o diacritică. Coloana `angajat_id` e
-- LEGĂTURA, nu o rubrică nouă: listarea pentru inspector (art. 9) n-o arată.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · `registru_documente.angajat_id`, FK la `employees` cu `on delete set null`,
--    index NEPARȚIAL `(organization_id, an, angajat_id, numar)` — sortarea pe
--    angajat cu `nulls last` trebuie să poată parcurge și NULL-urile.
--  · Alocatorul `internal.inregistreaza_document` primește `p_angajat_id`, al
--    14-lea parametru, implicit `null`.
--  · Scriitorul generic din hartă îl ia din `col_ang` — aceeași coloană din
--    care lua deja NUMELE; cele două trigger-e dedicate (documente emise,
--    contracte) din `new.employee_id`; înregistrarea manuală dintr-un parametru
--    nou opțional, verificat că e un angajat al firmei.
--  · Backfill pe anii deschiși, din aceeași hartă, deci nu poate diverge de ea.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · NU atinge garda `guard_registru_documente`. Forma ei finală e în 0148 și
--    pinuiește mai mult decât cea din 0120; un `create or replace` din corpul
--    vechi ar anula tăcut pinuirea. `angajat_id` nu e în lista ei — rămâne
--    corectabil, ca `indicativ_dosar`.
--  · NU atinge `public.inregistreaza_document_generat` (0142): fluturașul nu
--    primește angajat acum. Semnătura lui e publică — schimbarea cere drop +
--    re-grant (0142 §coada), nu `create or replace`.
--  · NU schimbă politicile RLS (0120 §6, agnostice la coloană) și nici
--    granturile (pe tabelă, 0120 §14).
--  · NU completează anii ÎNCHIȘI. `registru_verifica_exercitiu` e `before insert
--    or update` fără poartă de rol: nici superuser-ul prin psql n-o ocolește,
--    iar un singur UPDATE pe un an închis ar anula migrarea. Rândurile rămase se
--    raportează cu `raise warning`, nu se forțează.
--
-- ⚠️ `on delete set null` e un UPDATE care trece prin aceeași gardă: ștergerea
-- FIZICĂ a unui angajat cu rânduri într-un an închis ar ridica P0001. Angajații
-- se șterg logic (`deleted_at`), deci acceptabil — același compromis ca
-- `punct_lucru_id` (0120). FK-ul rămâne: el face posibil embed-ul PostgREST
-- `employees!registru_documente_angajat_id_fkey` din ecran.
--
-- Capcana 41: parametru nou ⇒ `drop function` ÎNAINTE de `create or replace`,
-- altfel iese o supraîncărcare și apelurile cu argumente numite cad la execuție.
-- Toți apelanții alocatorului folosesc argumente numite (0120 §12-13, 0134 §…,
-- 0135 §12, 0140 §1, 0142 §3), deci parametrul cu `default` nu strică pe niciunul.
--
-- Forward-only: 0120, 0135, 0140, 0142 sunt aplicate pe producție și NU se editează.
-- Aplicare: psql byte-exact (NOTES.md §1), după bancul local.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Coloana și indexul
-- =====================================================================================
--
-- ATENȚIE: indexul nu e parțial. Tabela n-are `deleted_at` — abaterea deliberată
-- din antetul lui 0120 — și nici `where angajat_id is not null` nu merge: sortarea
-- pe angajat pune NULL-urile la coadă și trebuie să le poată parcurge.

alter table public.registru_documente
  add column if not exists angajat_id uuid references public.employees (id) on delete set null;

comment on column public.registru_documente.angajat_id is
  'Salariatul la care se referă documentul: legătura spre fișa lui, NU o rubrică a '
  'registrului (art. 9 ține emitentul și destinatarul ca text). Completată de alocator din '
  'sursă; corectabilă; NULL la documentele fără salariat (vehicule, stat de plată, manual).';

create index if not exists registru_org_an_angajat_idx
  on public.registru_documente (organization_id, an, angajat_id, numar);

-- =====================================================================================
-- 2. Alocatorul primește angajatul
-- =====================================================================================
--
-- Corpul e cel din 0135 §8, cu o singură coloană în plus în INSERT. Drumul
-- idempotent (al doilea apel pe aceeași entitate) întoarce rândul existent FĂRĂ
-- să-i completeze `angajat_id`: un UPDATE acolo ar trece prin
-- `registru_verifica_exercitiu`, iar regenerarea unui fluturaș dintr-un an închis
-- ar cădea cu P0001 în loc să întoarcă numărul vechi.

drop function if exists internal.inregistreaza_document(
  uuid, public.registru_sens, text, text, text, uuid, text, date, text, text, uuid, date, boolean
);

create or replace function internal.inregistreaza_document(
  p_organization_id        uuid,
  p_sens                   public.registru_sens,
  p_tip_document           text,
  p_continut_rezumat       text,
  p_entitate_tip           text,
  p_entitate_id            uuid,
  p_numar_document_emitent text default null,
  p_data_document_emitent  date default null,
  p_emitent                text default null,
  p_destinatar             text default null,
  p_punct_lucru_id         uuid default null,
  p_data_inregistrare      date default null,
  -- Backfill-ul din 0136 îl pune pe `true`. NU se poate corecta printr-un UPDATE
  -- ulterior: garda din 0120 rescrie coloana din `old`, tăcut.
  p_inregistrat_retroactiv boolean default false,
  p_angajat_id             uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_data       date := coalesce(p_data_inregistrare, app.azi_local());
  v_an         integer := extract(year from v_data)::integer;
  v_numar      integer;
  v_id         uuid;
  v_indicativ  text;
begin
  -- Idempotență: al doilea apel pe aceeași entitate și același tip întoarce
  -- rândul existent, FĂRĂ să ardă un număr. Un stat de plată se descarcă de câte
  -- ori vrea contabilul; registrul îl are o singură dată.
  if p_entitate_id is not null then
    select r.id into v_id
    from public.registru_documente r
    where r.organization_id = p_organization_id
      and r.tip_document    = p_tip_document
      and r.entitate_tip    = p_entitate_tip
      and r.entitate_id     = p_entitate_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  -- art. 9 și art. 11: indicativul dosarului după nomenclator.
  select d.indicativ into v_indicativ
  from public.nomenclator_tipuri t
  join public.nomenclator_dosare d on d.id = t.dosar_id and d.deleted_at is null
  where t.organization_id = p_organization_id
    and t.tip_document    = p_tip_document
    and t.deleted_at is null;

  v_numar := internal.aloca_numar_registru(p_organization_id, v_data);

  insert into public.registru_documente (
    organization_id, an, numar, numar_afisat, data_inregistrare, sens, tip_document,
    continut_rezumat, numar_document_emitent, data_document_emitent, emitent, destinatar,
    entitate_tip, entitate_id, punct_lucru_id, indicativ_dosar, inregistrat_retroactiv,
    angajat_id
  ) values (
    p_organization_id,
    v_an,
    v_numar,
    -- FĂRĂ `lpad` — vezi antetul lui 0120. Cu `padding = 1` ar trunchia orice număr
    -- de două cifre la prima, iar registrul s-ar bloca de la al zecelea document.
    v_numar::text || '/' || to_char(v_data, 'DD.MM.YYYY'),
    v_data,
    p_sens,
    p_tip_document,
    p_continut_rezumat,
    p_numar_document_emitent,
    p_data_document_emitent,
    p_emitent,
    p_destinatar,
    p_entitate_tip,
    p_entitate_id,
    p_punct_lucru_id,
    v_indicativ,
    p_inregistrat_retroactiv,
    p_angajat_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- `drop function` a șters și comentariul din 0120 — se pune la loc.
comment on function internal.inregistreaza_document is
  'Punctul unic de intrare în registru. Chemată din triggerele tabelelor sursă, NU din '
  'aplicație — dreptul de a scrie documentul e poarta. Idempotentă pe '
  '(firmă, tip_document, entitate_tip, entitate_id).';

revoke all on function internal.inregistreaza_document(
  uuid, public.registru_sens, text, text, text, uuid, text, date, text, text, uuid, date,
  boolean, uuid
) from public, anon, authenticated;

-- =====================================================================================
-- 3. Scriitorul generic transmite angajatul din `col_ang`
-- =====================================================================================
--
-- Aceeași semnătură ca în 0140 — `create or replace` înlocuiește, nu supraîncarcă.
-- `nullif` ÎNAINTE de cast: un șir gol în jsonb ar da 22P02 în trigger.

create or replace function internal.registru_inreg_din_rand(
  p_tabela            text,
  p_rand              jsonb,
  p_sens              text,
  p_tip               text,
  p_eticheta          text,
  p_col_ang           text default null,
  p_col_numar         text default null,
  p_col_data          text default null,
  p_col_punct         text default null,
  p_col_extra         text default null,
  p_col_emit          text default null,
  p_data_inregistrare date default null,
  p_retroactiv        boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sens    public.registru_sens := p_sens::public.registru_sens;
  v_org     uuid := (p_rand ->> 'organization_id')::uuid;
  v_angajat text;
  v_angajat_id uuid;
  v_extra   text;
  v_numar   text;
begin
  if v_org is null then
    return null;
  end if;

  if p_col_ang is not null and (p_rand ->> p_col_ang) is not null then
    v_angajat_id := nullif(p_rand ->> p_col_ang, '')::uuid;
    select e.full_name into v_angajat
    from public.employees e
    where e.id = v_angajat_id;
  end if;

  -- Unde nu există angajat, rezumatul ia un text din rândul sursă — titlul unui
  -- anunț, codul unei evaluări de riscuri — ca registrul să nu aibă patruzeci de
  -- rânduri cu aceeași descriere.
  if v_angajat is null and p_col_extra is not null then
    v_extra := nullif(btrim(coalesce(p_rand ->> p_col_extra, '')), '');
  end if;

  -- „Numărul documentului dat de emitent" poate veni din mai multe coloane: un
  -- certificat medical are SERIE și NUMĂR, iar numărul singur nu identifică nimic.
  -- `with ordinality` păstrează ordinea scrisă în hartă; coloanele goale cad, deci
  -- o cerere de concediu de odihnă rămâne cu rubrica goală, cum și trebuie.
  if p_col_numar is not null then
    select nullif(btrim(string_agg(x.v, ' ' order by c.ord)), '')
      into v_numar
    from unnest(string_to_array(p_col_numar, ',')) with ordinality as c(nume, ord)
    cross join lateral (
      select nullif(btrim(coalesce(p_rand ->> btrim(c.nume), '')), '') as v
    ) x
    where x.v is not null;
  end if;

  return internal.inregistreaza_document(
    p_organization_id        => v_org,
    p_sens                   => v_sens,
    p_tip_document           => p_tip,
    p_continut_rezumat       => left(p_eticheta
                                     || coalesce(' — ' || v_angajat, '')
                                     || coalesce(' — ' || v_extra, ''), 500),
    p_entitate_tip           => p_tabela,
    p_entitate_id            => (p_rand ->> 'id')::uuid,
    p_numar_document_emitent => v_numar,
    p_data_document_emitent  => case when p_col_data is not null
                                     then (p_rand ->> p_col_data)::date end,
    -- La documentele INTRATE emitentul e altcineva — medicul, inspectoratul,
    -- asigurătorul — și se ia din sursă acolo unde există. La ce emitem noi,
    -- emitentul e firma.
    p_emitent                => case when v_sens = 'intrare'::public.registru_sens
                                     then case when p_col_emit is not null
                                               then p_rand ->> p_col_emit end
                                     else internal.registru_denumire_org(v_org) end,
    p_destinatar             => case when v_sens = 'iesire'::public.registru_sens
                                     then v_angajat end,
    p_punct_lucru_id         => case when p_col_punct is not null
                                     then (p_rand ->> p_col_punct)::uuid end,
    p_data_inregistrare      => p_data_inregistrare,
    p_inregistrat_retroactiv => p_retroactiv,
    -- Doar dacă angajatul EXISTĂ: un id orfan ar încălca FK-ul și ar opri
    -- scrierea documentului-sursă, nu doar înregistrarea.
    p_angajat_id             => case when v_angajat is not null then v_angajat_id end
  );
end;
$$;

-- =====================================================================================
-- 4. Cele două trigger-e dedicate transmit `new.employee_id`
-- =====================================================================================
--
-- Definite în 0120 §12-13 și neredefinite de atunci. Aceleași semnături `()`, deci
-- `create or replace` înlocuiește corpul, iar trigger-ele rămân atașate.

create or replace function internal.hr_issued_documents_inregistreaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cod       text;
  v_angajat   text;
begin
  select t.cod into v_cod
  from public.hr_document_templates t
  where t.id = new.template_id;

  select e.full_name into v_angajat
  from public.employees e
  where e.id = new.employee_id;

  perform internal.inregistreaza_document(
    p_organization_id        => new.organization_id,
    p_sens                   => 'iesire'::public.registru_sens,
    p_tip_document           => coalesce(v_cod, 'document_personal'),
    p_continut_rezumat       => new.titlu || coalesce(' — ' || v_angajat, ''),
    p_entitate_tip           => 'hr_issued_documents',
    p_entitate_id            => new.id,
    p_numar_document_emitent => new.numar_afisat,
    p_data_document_emitent  => new.emis_la,
    p_emitent                => internal.registru_denumire_org(new.organization_id),
    p_destinatar             => v_angajat,
    p_angajat_id             => case when v_angajat is not null then new.employee_id end
  );

  return null;
end;
$$;

create or replace function internal.employment_contracts_inregistreaza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_angajat text;
begin
  select e.full_name into v_angajat
  from public.employees e
  where e.id = new.employee_id;

  perform internal.inregistreaza_document(
    p_organization_id        => new.organization_id,
    p_sens                   => 'iesire'::public.registru_sens,
    p_tip_document           => case when new.este_act_aditional
                                     then 'act_aditional'
                                     else 'contract_munca' end,
    p_continut_rezumat       => case when new.este_act_aditional
                                     then 'Act adițional la contractul de muncă'
                                     else 'Contract individual de muncă' end
                                || coalesce(' — ' || v_angajat, ''),
    p_entitate_tip           => 'employment_contracts',
    p_entitate_id            => new.id,
    p_numar_document_emitent => new.numar,
    p_data_document_emitent  => new.data_contract,
    p_emitent                => internal.registru_denumire_org(new.organization_id),
    p_destinatar             => v_angajat,
    p_angajat_id             => case when v_angajat is not null then new.employee_id end
  );

  return null;
end;
$$;

-- =====================================================================================
-- 5. Înregistrarea manuală primește un angajat opțional
-- =====================================================================================
--
-- O demisie adusă pe hârtie e a unui salariat. Parametrul e opțional — o adresă
-- de la inspectorat n-are angajat — și, când e dat, trebuie să fie un angajat al
-- FIRMEI: funcția e `security definer`, deci FK-ul singur ar accepta id-ul unui
-- angajat din altă firmă.

drop function if exists public.inregistreaza_document_manual(
  uuid, text, text, text, text, date, text, integer, integer, uuid
);

create or replace function public.inregistreaza_document_manual(
  p_organization_id        uuid,
  p_sens                   text,
  p_tip_document           text,
  p_continut_rezumat       text,
  p_numar_document_emitent text default null,
  p_data_document_emitent  date default null,
  p_emitent                text default null,
  p_numar_file             integer default null,
  p_numar_anexe            integer default null,
  p_punct_lucru_id         uuid default null,
  p_angajat_id             uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_afisat text;
begin
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'registru', 'update', 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a înregistra documente în această organizație.';
  end if;

  if p_sens not in ('intrare', 'intern') then
    raise exception using errcode = 'P0001',
      message = 'Manual se pot înregistra doar documente intrate sau de uz intern. '
             || 'Documentele pe care le emite aplicația se înregistrează singure.';
  end if;

  if char_length(btrim(coalesce(p_continut_rezumat, ''))) < 3 then
    raise exception using errcode = 'P0001',
      message = 'Conținutul documentului în rezumat este obligatoriu — Ordin 217/1996 art. 9.';
  end if;

  if p_angajat_id is not null and not exists (
    select 1
    from public.employees e
    where e.id              = p_angajat_id
      and e.organization_id = p_organization_id
      and e.deleted_at is null
  ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul ales nu există în această organizație.';
  end if;

  -- `p_entitate_id => null` ocolește idempotența deliberat: două adrese diferite
  -- primite în aceeași zi sunt două documente, fiecare cu numărul lui.
  v_id := internal.inregistreaza_document(
    p_organization_id        => p_organization_id,
    p_sens                   => p_sens::public.registru_sens,
    p_tip_document           => p_tip_document,
    p_continut_rezumat       => btrim(p_continut_rezumat),
    p_entitate_tip           => 'manual',
    p_entitate_id            => null,
    p_numar_document_emitent => p_numar_document_emitent,
    p_data_document_emitent  => p_data_document_emitent,
    p_emitent                => coalesce(p_emitent,
                                  case when p_sens = 'intern'
                                       then internal.registru_denumire_org(p_organization_id) end),
    p_punct_lucru_id         => p_punct_lucru_id,
    p_angajat_id             => p_angajat_id
  );

  update public.registru_documente
     set numar_file  = p_numar_file,
         numar_anexe = p_numar_anexe
   where id = v_id;

  select r.numar_afisat into v_afisat
  from public.registru_documente r where r.id = v_id;

  return v_afisat;
end;
$$;

revoke all on function public.inregistreaza_document_manual(
  uuid, text, text, text, text, date, text, integer, integer, uuid, uuid
) from public, anon;
grant execute on function public.inregistreaza_document_manual(
  uuid, text, text, text, text, date, text, integer, integer, uuid, uuid
) to authenticated;

-- =====================================================================================
-- 6. Backfill — rândurile scrise înainte de coloană, pe anii deschiși
-- =====================================================================================
--
-- Din aceeași hartă din care scrie triggerul (`registru_config_surse`), deci nu
-- poate diverge de ea. `%I` pe tabelă ȘI pe coloană: `col_ang` nu e mereu
-- `employee_id` (`executant_employee_id`, `responsabil_employee_id`).
--
-- `exists` pe `employees` e OBLIGATORIU: un id orfan într-o singură sursă ar
-- încălca FK-ul și ar opri backfill-ul pentru TOATE firmele — lecția din 0136,
-- unde un an tastat „6” a oprit prima aplicare pe producție.
--
-- `angajat_id is null` face rularea repetată un no-op. Trigger-ele de actor,
-- `updated_at` și audit se declanșează pe UPDATE — același zgomot acceptat de 0141.

do $$
declare
  v_cfg   record;
  v_cate  bigint;
  v_total bigint := 0;
begin
  for v_cfg in
    select c.tabela, c.col_ang
    from internal.registru_config_surse() c
    where c.col_ang <> ''
  loop
    execute format(
      'update public.registru_documente r '
      || '   set angajat_id = s.%2$I '
      || '  from public.%1$I s '
      || ' where r.entitate_tip    = %1$L '
      || '   and r.entitate_id     = s.id '
      || '   and r.organization_id = s.organization_id '
      || '   and r.angajat_id is null '
      || '   and s.%2$I is not null '
      || '   and exists (select 1 from public.employees e where e.id = s.%2$I) '
      || '   and not exists ( '
      || '     select 1 from public.registru_exercitii x '
      || '     where x.organization_id = r.organization_id '
      || '       and x.an              = r.an '
      || '       and x.stare           = ''inchis'')',
      v_cfg.tabela, v_cfg.col_ang);
    get diagnostics v_cate = row_count;
    v_total := v_total + v_cate;
    if v_cate > 0 then
      raise notice 'Registru: % rânduri din „%” au primit angajatul.', v_cate, v_cfg.tabela;
    end if;
  end loop;

  raise notice 'Registru: % rânduri completate din harta surselor.', v_total;
end;
$$;

-- Cele două surse din afara hărții, cu trigger propriu (0120 §12-13).

update public.registru_documente r
   set angajat_id = s.employee_id
  from public.hr_issued_documents s
 where r.entitate_tip    = 'hr_issued_documents'
   and r.entitate_id     = s.id
   and r.organization_id = s.organization_id
   and r.angajat_id is null
   and s.employee_id is not null
   and exists (select 1 from public.employees e where e.id = s.employee_id)
   and not exists (
     select 1 from public.registru_exercitii x
     where x.organization_id = r.organization_id
       and x.an              = r.an
       and x.stare           = 'inchis'
   );

update public.registru_documente r
   set angajat_id = s.employee_id
  from public.employment_contracts s
 where r.entitate_tip    = 'employment_contracts'
   and r.entitate_id     = s.id
   and r.organization_id = s.organization_id
   and r.angajat_id is null
   and s.employee_id is not null
   and exists (select 1 from public.employees e where e.id = s.employee_id)
   and not exists (
     select 1 from public.registru_exercitii x
     where x.organization_id = r.organization_id
       and x.an              = r.an
       and x.stare           = 'inchis'
   );

-- =====================================================================================
-- 7. Ce a rămas gol într-un an închis, spus cu voce tare
-- =====================================================================================
--
-- Un rând dintr-un exercițiu închis nu se atinge (pct. 58 lit. h). Dar trebuie să
-- se VADĂ că a rămas fără legătură — altfel migrarea ar părea completă și ecranul
-- ar arăta „fără angajat” pentru totdeauna, tăcut. Rândurile fără salariat prin
-- natura lor (vehicule, stat de plată, manual) NU se numără aici.

do $$
declare
  v_rand record;
  v_cate integer := 0;
begin
  for v_rand in
    select r.entitate_tip as tip, r.an, count(*) as cate
    from public.registru_documente r
    where r.angajat_id is null
      and (
        r.entitate_tip in ('hr_issued_documents', 'employment_contracts')
        or r.entitate_tip in (
          select c.tabela from internal.registru_config_surse() c where c.col_ang <> ''
        )
      )
      and exists (
        select 1 from public.registru_exercitii x
        where x.organization_id = r.organization_id
          and x.an              = r.an
          and x.stare           = 'inchis'
      )
    group by r.entitate_tip, r.an
    order by r.an, r.entitate_tip
  loop
    v_cate := v_cate + 1;
    raise warning 'Registru: % rânduri de tip „%” din anul % (exercițiu închis) au rămas fără angajat — se completează după o eventuală redeschidere.',
                  v_rand.cate, v_rand.tip, v_rand.an;
  end loop;

  if v_cate = 0 then
    raise notice 'Registru: niciun rând dintr-un an închis n-a rămas fără angajat.';
  end if;
end;
$$;

commit;
