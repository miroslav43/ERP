-- 0185_registru_angajat_garda.sql
--
-- REGISTRUL DOCUMENTELOR: ANGAJATUL LEGAT E AL FIRMEI RÂNDULUI, PE ORICE DRUM.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- 0184 a verificat apartenența angajatului la firmă DOAR pe drumul manual
-- (`inregistreaza_document_manual`). Celelalte drumuri — scriitorul generic din
-- hartă, cele două trigger-e dedicate, backfill-ul — se bazau pe faptul că
-- rândul-sursă e, prin construcție, al aceleiași firme ca angajatul lui. E
-- adevărat azi; nu e o GARANȚIE. Revizuirea de securitate a cerut paritate:
-- regula stă în alocator, singurul loc prin care trece orice rând, nu în
-- fiecare apelant.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · `internal.inregistreaza_document` refuză cu P0001 un `p_angajat_id` care
--    nu e un angajat al lui `p_organization_id`. Aceeași semnătură de 14 tipuri
--    ca în 0184, deci `create or replace` ÎNLOCUIEȘTE (capcana 41 nu se aplică).
--  · Curățare: rândurile legate de un angajat din ALTĂ firmă (aștept zero) se
--    dezleagă, pe anii deschiși, și se raportează.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu atinge drumul manual: verificarea lui rămâne, cu mesajul ei pentru om.
--  · Nu atinge garda din 0148, politicile, granturile.
--
-- Forward-only: 0184 e aplicată pe staging prin CI și NU se editează.
-- Aplicare: psql byte-exact (NOTES.md §1), după bancul local.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Alocatorul verifică apartenența angajatului
-- =====================================================================================

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
  -- Izolarea între firme nu se lasă pe seama apelanților: funcția e `security
  -- definer`, deci FK-ul singur ar lega rândul de un angajat din altă firmă.
  if p_angajat_id is not null and not exists (
    select 1
    from public.employees e
    where e.id              = p_angajat_id
      and e.organization_id = p_organization_id
  ) then
    raise exception using errcode = 'P0001',
      message = 'Angajatul legat de document nu aparține organizației documentului.';
  end if;

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

-- `create or replace` păstrează comentariul și granturile din 0184; coada se
-- repetă totuși, ca migrarea să fie completă de una singură.
revoke all on function internal.inregistreaza_document(
  uuid, public.registru_sens, text, text, text, uuid, text, date, text, text, uuid, date,
  boolean, uuid
) from public, anon, authenticated;

-- =====================================================================================
-- 2. Curățare — legături peste firme, dacă există (aștept zero)
-- =====================================================================================
--
-- Backfill-ul din 0184 verifica doar că angajatul EXISTĂ, nu și că e al firmei
-- rândului. Sursele îl garantau prin construcție; se verifică totuși, iar ce se
-- găsește se dezleagă, nu se ascunde. Anii închiși nu se ating (pct. 58 lit. h).

do $$
declare
  v_cate bigint;
begin
  update public.registru_documente r
     set angajat_id = null
   where r.angajat_id is not null
     and exists (
       select 1 from public.employees e
       where e.id = r.angajat_id
         and e.organization_id <> r.organization_id
     )
     and not exists (
       select 1 from public.registru_exercitii x
       where x.organization_id = r.organization_id
         and x.an              = r.an
         and x.stare           = 'inchis'
     );
  get diagnostics v_cate = row_count;

  if v_cate > 0 then
    raise warning 'Registru: % rânduri erau legate de un angajat din ALTĂ firmă și au fost dezlegate.', v_cate;
  else
    raise notice 'Registru: nicio legătură peste firme.';
  end if;
end;
$$;

commit;
