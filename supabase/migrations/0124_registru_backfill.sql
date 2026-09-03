-- supabase/migrations/0124_registru_backfill.sql
--
-- BACKFILL-UL REGISTRULUI: documentele emise în anul curent ÎNAINTE ca 0120 să
-- pună triggerele primesc și ele numere de înregistrare.
--
-- ── PROBLEMA ────────────────────────────────────────────────────────────────
-- 0120 a pus triggere `after insert`. Ele prind ce se emite DE ACUM ÎNAINTE.
-- Contractele și adeverințele emise mai devreme în același an rămân în afara
-- registrului, iar un registru pe 2026 care începe în septembrie nu e un
-- registru — e o listă care începe de la mijloc, exact obiecția pe care un
-- inspector o formulează prima.
--
-- Ordinul 217/1996 art. 9 cere înregistrarea „cronologic, în ordinea primirii
-- lor". Backfill-ul respectă ordinea asta: parcurge documentele pe data lor, nu
-- pe ordinea în care se întâmplă să iasă din tabele.
--
-- ── DE CE `inregistrat_retroactiv` E VIZIBIL, NU ASCUNS ─────────────────────
-- Un contract tipărit și semnat în ianuarie primește acum un număr care NU e pe
-- hârtia semnată. Registrul trebuie să spună asta singur, în coloană, nu să lase
-- inspectorul s-o descopere comparând. Rândurile astea se văd distinct în
-- arhivă, cu explicație la trecerea cursorului.
--
-- ── DE CE `insert` DIRECT, ȘI NU `internal.inregistreaza_document` ──────────
-- Funcția aia e scriitorul unic al registrului și așa rămâne pentru tot ce se
-- emite de acum înainte. Aici NU se poate folosi: ar cere un parametru
-- `p_retroactiv` în plus, iar adăugarea lui e o operație riscantă pe o funcție
-- deja vie în producție. `create or replace` cu un parametru în plus nu
-- ÎNLOCUIEȘTE funcția, ci creează o SUPRAÎNCĂRCARE; apelurile cu argumente
-- numite din cele două triggere ar potrivi atunci AMBELE semnături și ar cădea
-- cu „function is not unique" — adică fiecare contract nou ar înceta să se mai
-- poată insera, în producție, până la o migrare de reparație.
--
-- Alternativa — `drop` urmat de `create` — merge, dar pune cele două triggere
-- vii pe un fir subțire pentru o singură rulare care nu se repetă niciodată.
-- Backfill-ul își scrie deci propriul INSERT, o dată, aici. Numărul vine tot din
-- `internal.aloca_numar_registru`, deci contorul rămâne singurul.
--
-- Notă: garda care îngheață numerotarea e `BEFORE UPDATE`, nu `BEFORE INSERT`,
-- deci un INSERT poate seta `inregistrat_retroactiv` — un UPDATE ulterior, nu.
--
-- ── DE CE DOAR ANUL CURENT ──────────────────────────────────────────────────
-- Registrul e un volum pe an (art. 9). Anii încheiați n-au avut niciodată un
-- registru în aplicație, iar a le fabrica unul acum, retroactiv, ar însemna să
-- pretindem o evidență care n-a existat. Anul în curs e altceva: el ESTE
-- registrul deschis, iar o gaură la începutul lui e un defect.
--
-- ── RE-RULAREA ──────────────────────────────────────────────────────────────
-- `not exists` pe `(firmă, tip, entitate)` — aceleași coloane ca indexul unic
-- `registru_entitate_uniq`. Rulat de două ori, al doilea trecere nu face nimic
-- și NU arde numere. Bancul local și CI rulează toate migrările la fiecare
-- pornire, deci asta nu e o precauție teoretică.
--
-- Forward-only: 0120 NU se editează.

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_an       integer := extract(year from app.azi_local())::integer;
  v_rand     record;
  v_numar    integer;
  v_data     date;
  v_total    integer := 0;
begin
  for v_rand in
    with sursa as (
      -- Documentele de personal emise (adeverințe, fișe, NDA, acte adiționale).
      select
        d.organization_id,
        d.emis_la                                          as data_doc,
        coalesce(t.cod, 'document_personal')               as tip,
        d.titlu || coalesce(' — ' || e.full_name, '')      as rezumat,
        d.numar_afisat                                     as nr_emitent,
        d.emis_la                                          as data_emitent,
        e.full_name                                        as destinatar,
        'hr_issued_documents'                              as ent_tip,
        d.id                                               as ent_id,
        d.created_at                                       as creat_la
      from public.hr_issued_documents d
      left join public.hr_document_templates t on t.id = d.template_id
      left join public.employees e            on e.id = d.employee_id
      where d.deleted_at is null
        and extract(year from d.emis_la)::integer = v_an

      union all

      -- Contractele și actele adiționale.
      select
        c.organization_id,
        c.data_contract,
        case when c.este_act_aditional then 'act_aditional' else 'contract_munca' end,
        (case when c.este_act_aditional
              then 'Act adițional la contractul de muncă'
              else 'Contract individual de muncă' end)
          || coalesce(' — ' || e.full_name, ''),
        c.numar,
        c.data_contract,
        e.full_name,
        'employment_contracts',
        c.id,
        c.created_at
      from public.employment_contracts c
      left join public.employees e on e.id = c.employee_id
      where c.deleted_at is null
        and extract(year from c.data_contract)::integer = v_an
    )
    select s.*
    from sursa s
    where not exists (
      select 1 from public.registru_documente r
      where r.organization_id = s.organization_id
        and r.tip_document    = s.tip
        and r.entitate_tip    = s.ent_tip
        and r.entitate_id     = s.ent_id
    )
    -- Cronologic, per firmă. `creat_la` și `ent_id` departajează documentele din
    -- aceeași zi, ca o re-rulare pe bancul local să dea EXACT același registru.
    order by s.organization_id, s.data_doc, s.creat_la, s.ent_id
  loop
    v_data  := v_rand.data_doc;
    v_numar := internal.aloca_numar_registru(v_rand.organization_id, v_data);

    insert into public.registru_documente (
      organization_id, an, numar, numar_afisat, data_inregistrare, sens, tip_document,
      continut_rezumat, numar_document_emitent, data_document_emitent, emitent, destinatar,
      entitate_tip, entitate_id, inregistrat_retroactiv
    ) values (
      v_rand.organization_id,
      v_an,
      v_numar,
      -- FĂRĂ `lpad`, ca în 0098 și 0120: cu `padding = 1` ar trunchia orice
      -- număr de două cifre la prima.
      v_numar::text || '/' || to_char(v_data, 'DD.MM.YYYY'),
      v_data,
      'iesire'::public.registru_sens,
      v_rand.tip,
      left(v_rand.rezumat, 500),
      v_rand.nr_emitent,
      v_rand.data_emitent,
      internal.registru_denumire_org(v_rand.organization_id),
      v_rand.destinatar,
      v_rand.ent_tip,
      v_rand.ent_id,
      true
    );

    v_total := v_total + 1;
  end loop;

  if v_total = 0 then
    raise notice 'Backfill registru: nimic de înregistrat pe % (fie e gol, fie s-a rulat deja).', v_an;
  else
    raise notice 'Backfill registru: % documente înregistrate retroactiv pe %.', v_total, v_an;
  end if;
end;
$$;

commit;
