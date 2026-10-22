-- supabase/migrations/0213_flota_bon_ocr.sql
--
-- FLOTA, F12a: CE A CITIT AI-UL DE PE BON, LÂNGĂ ALIMENTARE.
--
-- Specificația o numea `0210_flota_bon_ocr`; 0210–0212 le-a luat mentenanța la
-- integrare, deci e 0213.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · fuel_entries.cui_statie — CUI-ul emitentului bonului, doar cifre (fără RO).
--    Cifra de control o verifică aplicația (src/domain/organization/cui.ts);
--    baza ține doar forma.
--  · fuel_entries.ocr_propunere — propunerea citită de pe poză. O scrie DOAR
--    contextul de serviciu (adaugaAlimentare, prin clientul admin, după ce
--    INSERT-ul omului a trecut de RLS), o singură dată, de la null la valoare.
--    Apoi e imuabilă. Motivul: grantul de insert/update e pe tot tabelul
--    (0012:1084), deci fără gardă oricine ar putea scrie o propunere inventată
--    direct prin PostgREST, iar semnalul „diferă de bon" n-ar mai valora nimic.
--
-- ── CE NU ATINGE ────────────────────────────────────────────────────────────
--  · internal.alimentari_inainte (forma ultimă: 0200 §7) și
--    internal.alimentari_bon_cale (0202 §6): trigger SEPARAT, al treilea.
--  · politicile alimentari_* și granturile: coloanele noi intră sub ele.
--  · niciun index nou: avertismentul de bon dublat caută pe
--    fuel_org_data_idx (organization_id, alimentat_la), 0012:272.
--  · nicio cheie de permisiune: citirea bonului stă pe trip_sheets:update.
--
-- ── DE CE GARDA NU IESE PE PRIMA LINIE ÎN CONTEXT DE SERVICIU ───────────────
-- Triggerele cu drepturi ale flotei încep cu `app.is_service_context()` și
-- lasă serviciul să treacă. Aici contextul de serviciu ESTE dreptul: întrebarea
-- e „cine scrie propunerea”, iar imuabilitatea de după prima scriere se aplică
-- și serviciului (proba, verificarea 4). Un al doilea UPDATE de serviciu ar
-- putea altfel rescrie semnalul.
--
-- Proba: tests/rls/proba-flota-bon-ocr.sql. Forward-only.

begin;

-- ============================================================
-- 1. Coloane
-- ============================================================
alter table public.fuel_entries
  add column if not exists cui_statie text,
  add column if not exists ocr_propunere jsonb;

alter table public.fuel_entries
  add constraint fuel_cui_statie_ck
    check (cui_statie is null or cui_statie ~ '^[0-9]{2,10}$'),
  add constraint fuel_ocr_propunere_ck
    check (
      ocr_propunere is null
      or (jsonb_typeof(ocr_propunere) = 'object'
          and ocr_propunere ? 'v'
          and pg_column_size(ocr_propunere) <= 4096)
    );

comment on column public.fuel_entries.cui_statie is
  'CUI-ul emitentului bonului (stația), doar cifre, fără prefixul RO (0213).';
comment on column public.fuel_entries.ocr_propunere is
  'Ce a citit modelul de viziune de pe poza bonului (0213). Scrisă doar din contextul de serviciu, o dată; apoi imuabilă.';

-- ============================================================
-- 2. Propunerea o scrie doar serverul, o singură dată
-- ============================================================
-- SECURITY DEFINER ca restul triggerelor flotei; app.is_service_context()
-- citește GUC-ul `role`, nu current_user, deci merge corect și de aici
-- (comentariul din 0002_authz.sql:300-309).
create or replace function internal.alimentari_ocr_garda()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.ocr_propunere is not null and not app.is_service_context() then
      raise exception using errcode = 'P0001',
        message = 'Propunerea citită de pe bon o scrie doar aplicația, la salvarea alimentării.';
    end if;
  elsif new.ocr_propunere is distinct from old.ocr_propunere then
    if old.ocr_propunere is not null or not app.is_service_context() then
      raise exception using errcode = 'P0001',
        message = 'Propunerea citită de pe bon nu se mai poate modifica după salvarea alimentării.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function internal.alimentari_ocr_garda() from public, anon, authenticated;

-- Numele sortează DUPĂ `alimentari_bon_cale` și `alimentari_inainte`
-- (triggerele cu același moment și eveniment rulează în ordinea alfabetică a
-- numelui), deci garda de foaie și cea de cale răspund primele.
create trigger alimentari_ocr_garda before insert or update on public.fuel_entries
  for each row execute function internal.alimentari_ocr_garda();

-- ============================================================
-- 3. Garda finală
-- ============================================================
do $$
declare
  v_lipsa text[] := array[]::text[];
begin
  if not exists (select 1 from pg_trigger where tgname = 'alimentari_ocr_garda'
                  and tgrelid = 'public.fuel_entries'::regclass and not tgisinternal) then
    v_lipsa := v_lipsa || 'triggerul alimentari_ocr_garda';
  end if;
  -- Ordinea: garda de propunere rulează după gărzile de foaie și de cale
  -- (familia `alimentari_*`; `trg_*` de actor și audit nu ating coloana).
  if (select max(tgname) from pg_trigger
       where tgrelid = 'public.fuel_entries'::regclass and not tgisinternal
         and (tgtype & 2) = 2 and tgname like 'alimentari\_%') <> 'alimentari_ocr_garda' then
    v_lipsa := v_lipsa || 'alimentari_ocr_garda după alimentari_inainte și alimentari_bon_cale';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fuel_cui_statie_ck'
                  and conrelid = 'public.fuel_entries'::regclass) then
    v_lipsa := v_lipsa || 'fuel_cui_statie_ck';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fuel_ocr_propunere_ck'
                  and conrelid = 'public.fuel_entries'::regclass) then
    v_lipsa := v_lipsa || 'fuel_ocr_propunere_ck';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'internal' and p.proname = 'alimentari_ocr_garda'
                and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))) then
    v_lipsa := v_lipsa || 'search_path gol pe internal.alimentari_ocr_garda';
  end if;
  if has_function_privilege('authenticated', 'internal.alimentari_ocr_garda()', 'execute') then
    v_lipsa := v_lipsa || 'authenticated poate executa internal.alimentari_ocr_garda';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0213: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;

commit;

-- ============================================================
-- 4. Note de proiectare
-- ============================================================
-- · Fără backfill: coloanele sunt `null` pe rândurile existente, adică „fără
--   OCR”, iar asta e adevărat.
-- · Contextul de serviciu (seed, un import viitor de carduri) poate scrie
--   `ocr_propunere` la INSERT; sesiunea omului, nu.
-- · Ștergerea logică (`stergeAlimentare`) e un UPDATE care nu schimbă
--   `ocr_propunere`, deci trece (proba, verificarea 12).
-- · `fuel_ocr_propunere_ck` taie la 4096 de octeți. Propunerea are cel mult
--   ~1,5 KB (câmpuri plafonate, avertismente ≤ 8 × ≤ 200 de caractere), iar
--   aplicația o verifică înainte de semnare (`src/lib/fleet/jeton-bon.ts`),
--   fiindcă un 23514 aici ar pica tot UPDATE-ul de serviciu.
-- · INSERT-ul omului și UPDATE-ul de serviciu NU sunt atomice: dacă al doilea
--   pică, alimentarea rămâne salvată, fără propunere, cu urmă în jurnal. E o
--   decizie asumată (F12a §8.7), nu o scăpare.
