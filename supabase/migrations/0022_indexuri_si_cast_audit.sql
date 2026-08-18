-- ─────────────────────────────────────────────────────────────────────────────
-- 0022_indexuri_si_cast_audit.sql
--
-- Două constatări de pe cloud, unde `plpgsql_check` și advisor-ii Supabase au
-- rulat pentru prima oară peste lanțul complet de 21 de migrări. Verificarea de
-- fond a ieșit curată: 116 funcții PL/pgSQL, ZERO erori. Ce urmează sunt
-- avertismente — dar două dintre ele merită reparate acum, nu „cândva".
--
--
-- A. `organization_id` fără index pe două tabele
--
-- Fiecare politică RLS din proiect începe cu
--     organization_id = any ((select app.current_org_ids())::uuid[])
-- Coloana asta e citită la FIECARE rând evaluat, pe fiecare interogare, în toată
-- aplicația. Fără un index care s-o aibă pe prima poziție, filtrul de tenant
-- devine o parcurgere secvențială.
--
-- Verificat pe baza locală, cu lanțul complet aplicat: din cele 103 tabele, doar
-- două aveau `organization_id` fără niciun index care să înceapă cu ea —
-- `business_trip_legs` și `salary_components`. Amândouă cresc liniar cu
-- activitatea: etape de deplasare pentru fiecare călătorie, componente salariale
-- pentru fiecare angajat și fiecare lună.
--
-- Degradarea ar fi fost tăcută și tardivă: cu date de demonstrație totul pare
-- instantaneu, iar problema apare la primul client cu doi ani de istoric.
--
--
-- B. `internal.audit_trigger()` atribuia literale `text` unei coloane enum
--
-- `plpgsql_check` a semnalat-o de 89 de ori — o dată pentru fiecare dintre cele
-- ~74 de tabele pe care triggerul e atașat. E un singur defect, nu 74.
--
--     v_action := case ... then 'delete' ... then 'restore' else 'update' end;
--
-- `v_action` e de tip `public.audit_action`. CASE-ul peste literale se rezolvă la
-- `text`, iar atribuirea merge azi doar prin coerția de I/O a enum-ului. Merge —
-- până când cineva adaugă o ramură care nu se potrivește, și atunci cade la
-- rulare, în trigger, adică în mijlocul unei scrieri de business.
--
-- Nu e o presupunere: EXACT clasa asta a fost defectul C2 din 0017, unde aceeași
-- construcție într-o funcție de sold ridica
--     column "eveniment" is of type public.leave_accrual_event
--     but expression is of type text
-- și făcea ca orice consum de zile de concediu să eșueze. Și tot ea a fost unul
-- dintre cele două defecte din 0006, pe calea de citire a CNP-ului.
--
-- Corpul de mai jos NU e rescris de mână. E extras din baza de date cu
-- `pg_get_functiondef` și modificat programatic în două locuri: `case` devine
-- `(case`, iar `end;` devine `end)::public.audit_action;`. O rescriere de la zero
-- a pierdut deja tăcut, o dată, o ramură întreagă dintr-o funcție de calendar.
--
--
-- CE NU REPAR AICI, deliberat:
--
-- `multiple_permissive_policies` pe `inventory_items` și `inventory_allocations`:
-- politica de bază se suprapune cu cea adăugată de checklist în 0014, care dă
-- drept de citire celui cu `checklists:update` — necesară, fiindcă blocarea
-- offboardingului trebuie să poată NUMI obiectele nereturnate. Postgres le
-- combină cu OR și le evaluează pe amândouă. Fuzionarea lor e o optimizare, iar
-- o paranteză greșită într-o politică fuzionată LĂRGEȘTE accesul. Nu merită
-- riscul pentru un câștig de viteză pe tabele mici.
--
-- `v_i` care umbrește variabila de buclă în `app.calculeaza_zile_diurna`: ambele
-- sunt întregi cu aceeași valoare, iar singura citire e în interiorul buclei.
-- Spre deosebire de cazul din 0017 — unde o variabilă `record` umbrea un ALIAS DE
-- TABELĂ și rezolvarea numelui cădea pe variabila neatribuită — aici nu se
-- schimbă nimic la execuție. Declarația redundantă ar cere rescrierea unei
-- funcții lungi pentru zero câștig de comportament.
--
-- `unused_index` (163) și restul de `unindexed_foreign_keys`: fără trafic real,
-- primele nu spun nimic, iar celelalte se aleg după interogările efective, nu
-- după o listă generată. Indexurile de mai sus sunt altceva: `organization_id` e
-- citită de RLS pe fiecare rând, indiferent de ce interoghează cineva.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. Filtrul de tenant devine sargable ────────────────────────────────────

create index if not exists business_trip_legs_org_idx
  on public.business_trip_legs (organization_id)
  where deleted_at is null;

create index if not exists salary_components_org_idx
  on public.salary_components (organization_id)
  where deleted_at is null;


-- ── B. Castul explicit către enum ───────────────────────────────────────────
--
-- Corpul funcției NU se rescrie de mână și nu se copiază în acest fișier. Se
-- citește din bază cu `pg_get_functiondef` și se modifică în DOUĂ locuri.
--
-- Motivul e o greșeală deja făcută: rescriind `app.este_zi_lucratoare` de la zero
-- ca să-i adaug o gardă, am pierdut tăcut ramura `zi_recuperare` — cea evaluată
-- ÎNAINTEA weekendului — și o sâmbătă lucrată în locul unei punți ar fi devenit
-- nelucrătoare, în pontaj și în normele de concediu deopotrivă. Nimic n-ar fi
-- semnalat-o; a prins-o doar reconcilierea pe 36 de luni.
--
-- Un patch aplicat pe definiția reală nu poate pierde ce nu atinge. Iar dacă
-- tiparul căutat nu mai există, migrarea cade AICI, cu un mesaj care spune de ce,
-- în loc să instaleze o funcție ciuntită.
--
-- Idempotent: dacă acțiunea a fost deja aplicată, iese fără să rescrie nimic.

do $$
declare
  v_def text;
begin
  v_def := pg_catalog.pg_get_functiondef('internal.audit_trigger()'::regprocedure);

  if v_def like '%::public.audit_action%' then
    raise notice 'Castul e deja aplicat; nu se rescrie.';
    return;
  end if;

  v_def := replace(v_def, 'v_action := case' || chr(10), 'v_action := (case' || chr(10));
  v_def := replace(v_def,
    '      else ''update''' || chr(10) || '    end;',
    '      else ''update''' || chr(10) || '    end)::public.audit_action;');

  if v_def not like '%::public.audit_action%' then
    raise exception 'Tiparul CASE nu a fost găsit în corpul funcției; corpul s-a schimbat față de 0002.';
  end if;

  execute v_def;
end
$$;


-- ── Verificare ──────────────────────────────────────────────────────────────
do $$
declare
  v_fara_index text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_fara_index
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id'
                       and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_index i where i.indrelid = c.oid and a.attnum = i.indkey[0]);

  if v_fara_index is not null then
    raise exception 'Tabele cu organization_id neindexată pe prima poziție: %. Fiecare politică RLS le va parcurge secvențial.', v_fara_index;
  end if;

  if pg_catalog.pg_get_functiondef('internal.audit_trigger()'::regprocedure)
     not like '%::public.audit_action%' then
    raise exception 'Castul explicit către audit_action nu a fost aplicat.';
  end if;
end
$$;
