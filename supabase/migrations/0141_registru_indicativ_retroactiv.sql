-- supabase/migrations/0141_registru_indicativ_retroactiv.sql
--
-- INDICATIVUL DOSARULUI PE RÂNDURILE SCRISE ÎNAINTE SĂ EXISTE NOMENCLATORUL.
--
-- `0120` și `0124` au scris în registru înainte ca `0135` să aducă nomenclatorul,
-- deci rândurile lor au `indicativ_dosar` gol. Verificat pe producție după
-- aplicarea lui 0136: contractele de muncă, fișele de post, NDA-urile, anexele de
-- proprietate intelectuală și actele adiționale de telemuncă — toate emise prin
-- `hr_issued_documents` sau `employment_contracts` — n-au niciun indicativ, deși
-- tipurile lor SUNT clasate în nomenclatorul implicit.
--
-- Ordin 217/1996 art. 9 spune că indicativul „se va stabili şi completa în registru
-- DUPĂ REZOLVAREA documentului", deci un gol nu e o neconformitate în sine. Dar
-- art. 11 cere ca indicativul să figureze „la rubrica rezervată acestuia", iar un
-- registru în care primele rânduri ale anului n-au rubrica aia completată, restul
-- da, arată ca o evidență ținută pe apucate — exact impresia pe care nu vrei s-o
-- lași la un control.
--
-- ── DE CE MERGE PRINTR-UN UPDATE, DEȘI REGISTRUL E APPEND-ONLY ──────────────
-- Garda din `0120` pinuiește ce nu are voie să se schimbe: numărul, numărul
-- afișat, data înregistrării, sensul, tipul și legătura cu entitatea. NU pinuiește
-- `indicativ_dosar` — tocmai fiindcă art. 9 îl declară completabil ulterior.
-- OMFP 2634/2015 pct. 58 lit. d) interzice modificarea NUMEROTĂRII, nu completarea
-- unei rubrici descriptive lăsate goale.
--
-- ── EXERCIȚIILE ÎNCHISE SE OCOLESC ──────────────────────────────────────────
-- `internal.registru_verifica_exercitiu` ridică P0001 la orice UPDATE pe un an cu
-- `stare = 'inchis'` — pct. 58 lit. h). Migrarea le exclude explicit în loc să
-- cadă pe ele: un registru deja închis și listat la control nu se mai atinge, nici
-- măcar ca să fie completat.
--
-- Forward-only: 0120, 0124, 0135, 0136 și 0140 sunt aplicate și NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Completarea
-- =====================================================================================

with de_completat as (
  select r.id, d.indicativ
  from public.registru_documente r
  join public.nomenclator_tipuri t
    on t.organization_id = r.organization_id
   and t.tip_document    = r.tip_document
   and t.deleted_at is null
  join public.nomenclator_dosare d
    on d.id = t.dosar_id
   and d.deleted_at is null
  where r.indicativ_dosar is null
    -- Exercițiul închis nu se mai atinge — vezi antetul.
    and not exists (
      select 1
      from public.registru_exercitii e
      where e.organization_id = r.organization_id
        and e.an              = r.an
        and e.stare           = 'inchis'
    )
)
update public.registru_documente r
   set indicativ_dosar = de_completat.indicativ
  from de_completat
 where de_completat.id = r.id;

-- =====================================================================================
-- 2. Ce a rămas gol, spus cu voce tare
-- =====================================================================================
--
-- Un tip de document care nu e clasat în nomenclator rămâne fără indicativ, și
-- trebuie să se VADĂ. Altfel migrarea ar părea că a rezolvat tot, iar rubrica ar
-- rămâne goală pentru totdeauna, tăcut — exact tiparul de defect pe care restul
-- proiectului îl vânează.

do $$
declare
  v_rand  record;
  v_cate  integer := 0;
begin
  for v_rand in
    select r.tip_document as tip, count(*) as cate
    from public.registru_documente r
    where r.indicativ_dosar is null
    group by r.tip_document
    order by count(*) desc, r.tip_document
  loop
    v_cate := v_cate + 1;
    raise warning 'Registru: % rânduri de tip „%” au rămas fără indicativ — tipul nu e clasat în nomenclator. Adăugați-l din /registru/nomenclator.',
                  v_rand.cate, v_rand.tip;
  end loop;

  if v_cate = 0 then
    raise notice 'Registru: fiecare rând are indicativ de dosar.';
  end if;
end;
$$;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
--
-- 1. DE CE NU E UN TRIGGER CARE COMPLETEAZĂ RETROACTIV LA FIECARE SCRIERE ÎN
--    NOMENCLATOR. Ar fi tentant: adaugi un tip într-un dosar, iar rândurile vechi
--    se completează singure. Ar însemna însă ca o editare de nomenclator să rescrie
--    tăcut rânduri de registru din ani trecuți, poate deja listate. Completarea
--    retroactivă rămâne o operațiune explicită, făcută de o migrare care se vede
--    în istoric.
--
-- 2. DE CE FĂRĂ `where r.indicativ_dosar is distinct from d.indicativ`. Filtrul e
--    deja `is null`: nu se rescrie niciun indicativ existent, nici dacă nomenclatorul
--    s-a schimbat între timp. Un indicativ scris în registru rămâne al rândului
--    aceluia — dosarul din care făcea parte la data înregistrării.
