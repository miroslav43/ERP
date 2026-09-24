-- supabase/migrations/0158_anulare_document_emis_in_registru.sql
--
-- ANULAREA UNUI DOCUMENT EMIS SE VEDE ȘI ÎN REGISTRU.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Un document de personal emis de aplicație (contract, NDA, anexă PI, act de
-- telemuncă, adeverință) intră în registrul general printr-un trigger AFTER
-- INSERT (0120 §12). Anularea lui — din butonul „Anulează" al dosarului sau
-- din regenerare — scria `anulat_la` numai pe `hr_issued_documents`. Rândul
-- din registru rămânea valabil: registrul spunea că firma a emis un act pe care
-- ea însăși îl anulase.
--
-- Pct. 58 lit. d) din OMFP 2634/2015 interzice eliminările, deci rândul nu se
-- șterge: se ANULEAZĂ, cu motivul în clar, iar numărul rămâne consumat — exact
-- ce face 0142 §5 pentru tipurile scoase din registru.
--
-- ── CUM ─────────────────────────────────────────────────────────────────────
-- Un trigger AFTER UPDATE OF anulat_la, pe tranziția null → nenull. Funcția e
-- `security definer`: cine anulează documentul are `employees:update`, nu
-- `registru:update` (hr n-are nicio cheie de registru), iar dreptul care
-- contează e cel de a anula DOCUMENTUL, verificat deja de `hr_issued_update`.
-- Aceeași judecată ca la inserare (registru.md, „Trei drumuri", drumul 1).
--
-- ── EXERCIȚIUL ÎNCHIS ───────────────────────────────────────────────────────
-- `internal.registru_verifica_exercitiu` ridică P0001 la orice UPDATE pe un an
-- închis. Triggerul NU îl ocolește: eroarea urcă și anulează toată tranzacția,
-- deci nici documentul nu se anulează. E voit — un document valabil în registru
-- și anulat în dosar ar fi exact divergența pe care migrarea o închide. Mesajul
-- bazei („Registrul pe anul X este închis…") ajunge la utilizator.
--
-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- Documentele deja anulate (regenerări de dinainte) își anulează rândul din
-- registru, cu excepția anilor închiși — un registru listat la control nu se
-- mai atinge (aceeași regulă ca 0142 §5).

begin;

-- =====================================================================================
-- 1. Funcția
-- =====================================================================================

create or replace function internal.hr_issued_documents_anuleaza_in_registru()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.registru_documente r
     set anulat_la     = new.anulat_la,
         motiv_anulare = 'Documentul ' || new.numar_afisat || ' a fost anulat'
                      || coalesce(': ' || nullif(btrim(new.motiv_anulare), ''), '.')
   where r.organization_id = new.organization_id
     and r.entitate_tip    = 'hr_issued_documents'
     and r.entitate_id     = new.id
     and r.anulat_la is null;

  return null;
end;
$$;

comment on function internal.hr_issued_documents_anuleaza_in_registru() is
  'Anularea unui document de personal emis anulează și rândul lui din registrul general. '
  'Nu ocolește garda exercițiului închis: pe un an închis, anularea documentului e respinsă.';

-- =====================================================================================
-- 2. Triggerul
-- =====================================================================================

drop trigger if exists zz_hr_issued_documents_anuleaza_in_registru on public.hr_issued_documents;
create trigger zz_hr_issued_documents_anuleaza_in_registru
  after update of anulat_la on public.hr_issued_documents
  for each row
  when (old.anulat_la is null and new.anulat_la is not null)
  execute function internal.hr_issued_documents_anuleaza_in_registru();

-- =====================================================================================
-- 3. Backfill — documentele anulate înainte de migrare
-- =====================================================================================

update public.registru_documente r
   set anulat_la     = h.anulat_la,
       motiv_anulare = 'Documentul ' || h.numar_afisat || ' a fost anulat'
                    || coalesce(': ' || nullif(btrim(h.motiv_anulare), ''), '.')
  from public.hr_issued_documents h
 where r.entitate_tip    = 'hr_issued_documents'
   and r.entitate_id     = h.id
   and r.organization_id = h.organization_id
   and r.anulat_la is null
   and h.anulat_la is not null
   and not exists (
     select 1
     from public.registru_exercitii e
     where e.organization_id = r.organization_id
       and e.an              = r.an
       and e.stare           = 'inchis'
   );

-- =====================================================================================
-- 4. Coada REVOKE/GRANT
-- =====================================================================================

revoke all on function internal.hr_issued_documents_anuleaza_in_registru()
  from public, anon, authenticated;

commit;
