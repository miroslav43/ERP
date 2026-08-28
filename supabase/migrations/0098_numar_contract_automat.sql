-- supabase/migrations/0098_numar_contract_automat.sql
--
-- NUMĂRUL DE CONTRACT SE ALOCĂ SINGUR.
--
-- ── PROBLEMA ─────────────────────────────────────────────────────────────────
-- `employment_contracts.numar` e `text not null` completat de mână, în două
-- ecrane (`pas-3-contract.tsx`, `formular-contract-nou.tsx`). Există deja un
-- index unic — `contracts_org_numar_uniq (organization_id, lower(numar))
-- where deleted_at is null`, `0004_hr.sql:342` — deci al doilea angajat căruia i
-- se scrie „1" nu produce un duplicat, ci un **23505 brut, netradus**, ieșit
-- prin `createAction` ca „Datele introduse nu sunt valide".
--
-- Un registru de contracte cu numere alese din memorie e, în plus, chiar lucrul
-- pe care un control ITM îl citește primul.
--
-- ── DE CE `document_sequences`, ȘI NU UN CONTOR NOU ─────────────────────────
-- Tabela există din `0001_kernel.sql:463`, cu `(organization_id, document_type,
-- year)` unic, `prefix` și `padding` configurabile. O folosesc deja inventarul
-- (`app.aloca_numar_inventar`, 0010) și ticketingul (`public.aloca_numar_tichet`,
-- 0047). Al treilea contor propriu ar fi a treia mecanică pentru aceeași nevoie.
--
-- Anul e ÎN CHEIE, deci resetarea anuală vine din construcție, nu dintr-un job.
--
-- ── SCHEMA `public`, NU `app` ───────────────────────────────────────────────
-- Capcana e documentată chiar în 0047, care există doar ca să repare ceea ce
-- 0045 greșise: PostgREST expune numai `public`, deci o funcție chemată prin
-- `.rpc()` din TypeScript trebuie să stea acolo. `app.aloca_numar_inventar` a
-- rămas în `app` fiindcă e chemată exclusiv din SQL.
--
-- ── ⚠️ DE CE NU SE CHEAMĂ `lpad` PE RAMURA FĂRĂ PREFIX ──────────────────────
-- În PostgreSQL `lpad` TAIE când șirul e mai lung decât lungimea cerută:
--
--     lpad('9',  1, '0') → '9'
--     lpad('10', 1, '0') → '1'      ← verificat pe baza proiectului
--     lpad('42', 1, '0') → '4'
--
-- Formatul cerut, `42/2026`, are `padding = 1`. Cu `lpad`, de la al ZECELEA
-- contract al anului numărul s-ar trunchia la „1/2026" și ar coliziona cu
-- contractul 1 pe indexul unic; reîncercarea ar cere 11, 12, 13 — toate
-- trunchiate tot la „1" — până la epuizarea încercărilor. Rezultatul ar fi
-- „numerotarea e ocupată", permanent, pentru tot restul anului, cu numere arse
-- din registru la fiecare apăsare.
--
-- Tiparul copiat (`aloca_numar_tichet`) n-a fost lovit niciodată fiindcă
-- folosește `padding = 5`. Aici, ramura fără prefix concatenează direct.
--
-- ── GOLURILE SUNT PERMISE, REPETĂRILE NU ────────────────────────────────────
-- Numărul se consumă chiar dacă înrolarea eșuează după alocare — la fel ca la
-- marcă (0033) și la tichete (0047). O secvență are voie să aibă goluri; n-are
-- voie să repete. Alternativa, alocarea la commit, ar cere blocarea contorului
-- pe toată durata tranzacției de înrolare, care scrie în opt tabele.
--
-- Forward-only: 0001, 0004 și 0047 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Alocatorul
-- =====================================================================================

create or replace function public.aloca_numar_contract(p_organization_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_an      integer := extract(year from app.azi_local())::integer;
  v_numar   integer;
  v_prefix  text;
  v_padding smallint;
begin
  -- Aceeași gardă ca la tichete: `security definer` ocolește RLS, deci dreptul
  -- se verifică explicit, aici. `employees:create` e pragul înrolării — cine nu
  -- poate înrola nu are de ce să consume numere din registru.
  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, 'employees', 'create', 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a aloca numere de contract în această organizație.';
  end if;

  -- Un singur INSERT … ON CONFLICT DO UPDATE … RETURNING: fără fereastră între
  -- citire și scriere, deci fără două înrolări simultane cu același număr.
  insert into public.document_sequences
    (organization_id, document_type, year, prefix, next_number, padding)
  values
    (p_organization_id, 'contract_munca', v_an, '', 2, 1)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;

  -- Ramura fără prefix: „42/2026”. FĂRĂ `lpad` — vezi antetul; cu `padding = 1`
  -- ar trunchia orice număr de două cifre la prima.
  if coalesce(v_prefix, '') = '' then
    return v_numar::text || '/' || v_an::text;
  end if;

  -- Ramura cu prefix, pentru firmele care își configurează o serie proprie:
  -- „CIM-2026-00042”. `greatest` apără și aici de trunchiere, dacă cineva pune
  -- un padding mai mic decât numărul de cifre atins.
  return v_prefix || '-' || v_an::text || '-'
       || lpad(v_numar::text, greatest(v_padding, length(v_numar::text)), '0');
end;
$$;

comment on function public.aloca_numar_contract(uuid) is
  'Rezervă următorul număr de contract al anului („42/2026”). Contorul se resetează '
  'anual, fiindcă `document_sequences` are anul în cheie. Numărul se consumă chiar dacă '
  'înrolarea eșuează ulterior — o secvență are voie să aibă goluri, dar nu are voie să '
  'repete un număr. Formatul e configurabil per firmă prin `prefix` și `padding`.';

revoke all on function public.aloca_numar_contract(uuid) from public, anon;
grant execute on function public.aloca_numar_contract(uuid) to authenticated;

-- =====================================================================================
-- 2. Note de proiectare
-- =====================================================================================
--
-- CE NU FACE MIGRAREA ASTA:
--
-- · Nu adaugă niciun index unic. Există deja: `contracts_org_numar_uniq`
--   (`0004_hr.sql:342`). Presupunerea contrară — că unicitatea lipsește — a fost
--   verificată în `pg_indexes` pe baza reală și infirmată.
--
-- · Nu renumerotează contractele existente. Cele opt rânduri de azi poartă
--   `CIM-DEMO-001..008`, evident dintr-un seed. Prima alocare automată dă
--   „1/2026", care nu coliziază cu niciunul. Registrul acelei firme va conține
--   două scheme de numerotare — se lasă așa, deliberat: renumerotarea unui
--   contract deja semnat ar rupe legătura cu hârtia.
--
-- · Nu face numărul obligatoriu în bază. `numar` rămâne `not null`; aplicația îl
--   alocă înainte de INSERT, iar câmpul din formular devine opțional. Un contract
--   preluat prin transfer sau importat istoric își păstrează numărul propriu.

commit;
