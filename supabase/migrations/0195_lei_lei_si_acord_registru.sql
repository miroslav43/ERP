-- supabase/migrations/0195_lei_lei_si_acord_registru.sql
-- „lei lei” în două șabloane de document și „1 angajați” în registru.
--
-- ┌ CE REPARĂ (QA 8 oct 2026: PRM-006, UX-038) ───────────────────────────────
-- │ PRM-006 — contractul de muncă scria „Salariul de bază lunar brut: 4.500,00
-- │ lei lei.”: unitatea o pune deja `formatLei`, în `valori-inrolare.ts` și în
-- │ `adeverinte.ts`, iar șablonul o repeta după `{{salariu_brut}}`. Același
-- │ „lei” dublat e și în `adeverinta_venit` (0004), nu doar în `contract_munca`
-- │ (0101, 0033). `act_aditional_salariu` (0160) e deja corect.
-- │ UX-038 — rezumatul din registru al foii colective de prezență se scria
-- │ „— 1 angajați” (și „— 25 angajați”), direct din SQL, în
-- │ `internal.pontaj_arhiveaza_luna` (0134).
-- └───────────────────────────────────────────────────────────────────────────
--
-- Fără backfill pe `registru_documente`: `continut_rezumat` e înghețat de
-- triggerul din 0148 (`new.continut_rezumat := old.continut_rezumat`), conform
-- legii registrului. Rândurile deja scrise rămân cum sunt; se repară doar
-- arhivările viitoare. Actele deja emise (`hr_documents`) au HTML-ul înghețat
-- la emitere și nu se ating.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. PRM-006 — unitatea o pune `formatLei`, șablonul n-o mai repetă
-- =====================================================================================
--
-- Fără filtru pe `organization_id`: acoperă rândurile de platformă
-- (`contract_munca`, `adeverinta_venit`) ȘI copiile pe firmă create din ele
-- (`sabloane-documente/actions.ts`). Coloana cu lista variabilelor nu se
-- atinge — numele variabilei rămâne același. `strpos`, nu `like`: în `like`,
-- `_` din `salariu_brut` e un caracter-joker.

update public.hr_document_templates
   set continut_html = replace(continut_html, '{{salariu_brut}} lei', '{{salariu_brut}}'),
       updated_at = now()
 where deleted_at is null
   and strpos(continut_html, '{{salariu_brut}} lei') > 0;

do $$
declare v_n integer;
begin
  select count(*) into v_n
    from public.hr_document_templates
   where deleted_at is null
     and strpos(continut_html, '{{salariu_brut}} lei') > 0;
  if v_n > 0 then
    raise exception 'Au rămas % șabloane cu „lei” dublat după {{salariu_brut}}.', v_n;
  end if;
end $$;

-- =====================================================================================
-- 2. UX-038 — „1 angajat”, „25 de angajați” în rezumatul din registru
-- =====================================================================================
--
-- Corpul e copiat BYTE-EXACT din 0134 (liniile 245-335; nicio migrare
-- ulterioară nu redefinește funcția), generat mecanic, nu retranscris. Singura
-- diferență: rândul rezumatului, care trece printr-un `case` cu regula din
-- `src/lib/format/numar.ts` — singular la 1, „de” când ultimele două cifre sunt
-- 0 sau ≥ 20 (peste 19). Semnătura, `security definer` și `search_path`
-- rămân; `create or replace` păstrează comentariul și granturile, iar coada
-- REVOKE de mai jos e cea din 0134, repetată ca să nu depindem de asta.

create or replace function internal.pontaj_arhiveaza_luna(
  p_organization_id uuid,
  p_an              integer,
  p_luna            integer,
  p_motiv           public.pontaj_arhiva_motiv
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_continut  jsonb;
  v_id        uuid := gen_random_uuid();
  v_versiune  smallint;
  v_perioada  public.attendance_periods%rowtype;
  v_angajati  integer;
begin
  v_continut := internal.pontaj_instantaneu_luna(p_organization_id, p_an, p_luna);
  v_angajati := coalesce((v_continut #>> '{total_general,angajati}')::integer, 0);

  if v_angajati = 0 then
    return null;
  end if;

  select * into v_perioada
  from public.attendance_periods
  where organization_id = p_organization_id
    and an = p_an
    and luna = p_luna
    and deleted_at is null;

  select coalesce(max(versiune), 0)::smallint + 1
    into v_versiune
  from public.pontaj_arhive_lunare
  where organization_id = p_organization_id
    and an = p_an
    and luna = p_luna
    and deleted_at is null;

  -- Versiunea veche se marchează ÎNAINTE de inserare: `pontaj_arhive_in_vigoare_uq`
  -- nu tolerează două rânduri cu `inlocuita_de is null` pe aceeași lună.
  update public.pontaj_arhive_lunare
  set inlocuita_de = v_id
  where organization_id = p_organization_id
    and an = p_an
    and luna = p_luna
    and inlocuita_de is null
    and deleted_at is null;

  insert into public.pontaj_arhive_lunare (
    id, organization_id, period_id, an, luna, versiune, motiv, status_perioada,
    continut, checksum, numar_angajati, total_ore, total_ore_suplimentare,
    total_ore_noapte, generat_de
  ) values (
    v_id,
    p_organization_id,
    v_perioada.id,
    p_an::smallint,
    p_luna::smallint,
    v_versiune,
    p_motiv,
    v_perioada.status,
    v_continut,
    internal.sha256_hex(v_continut::text),
    v_angajati,
    coalesce((v_continut #>> '{total_general,ore}')::numeric, 0),
    coalesce((v_continut #>> '{total_general,sup}')::numeric, 0),
    coalesce((v_continut #>> '{total_general,noapte}')::numeric, 0),
    auth.uid()
  );

  -- Numărul de înregistrare. Alocatorul e idempotent pe (firmă, tip, entitate),
  -- iar fiecare versiune e un rând propriu cu id propriu — deci v2 primește
  -- număr nou, fără să-l atingă pe al lui v1.
  perform internal.inregistreaza_document(
    p_organization_id        => p_organization_id,
    p_sens                   => 'intern'::public.registru_sens,
    p_tip_document           => 'foaie_colectiva_prezenta',
    p_continut_rezumat       => 'Foaie colectivă de prezență '
                                || lpad(p_luna::text, 2, '0') || '.' || p_an::text
                                || ' — ' || v_angajati::text
                                || case when v_angajati = 1 then ' angajat'
                                        when v_angajati >= 20 and (v_angajati % 100 = 0 or v_angajati % 100 >= 20) then ' de angajați'
                                        else ' angajați' end,
    p_entitate_tip           => 'pontaj_arhive_lunare',
    p_entitate_id            => v_id,
    p_emitent                => internal.registru_denumire_org(p_organization_id)
  );

  return v_id;
end;
$$;

revoke all on function internal.pontaj_arhiveaza_luna(uuid, integer, integer, public.pontaj_arhiva_motiv)
  from public, anon, authenticated;

commit;
