-- supabase/migrations/0079_concedii_anulare_dupa_aprobare.sql
-- Angajatul nu-și putea retrage un concediu APROBAT, iar cine îl aprobase nu
-- afla niciodată că a fost retras.
--
-- Prima parte era blocată în DOUĂ locuri independente, iar asta e motivul
-- pentru care corectarea acțiunii singure n-ar fi schimbat nimic:
--   • `leave_requests_update` (0016), ramura autorului din `USING`, cere
--     `status in ('ciorna', 'trimisa')` — un rând `aprobata` nici nu intră în
--     politică;
--   • aceeași politică, ramura autorului din `WITH CHECK`, cere
--     `decis_de is null and decis_la is null`. Un rând aprobat le are pe
--     amândouă completate de `internal.leave_requests_pregateste`, deci chiar
--     dacă `USING` l-ar lăsa să treacă, scrierea ar pica la a doua poartă.
-- Iar `anuleazaCerere` filtra oricum `.in("status", ["ciorna","trimisa"])`.
--
-- Partea a doua: 0048 a construit trei notificări pentru concedii (cerere
-- trimisă → aprobatori, treaptă următoare, decizie → solicitant) și 0056 a
-- adăugat-o pe a patra (decizie → HR). Ieșirea din flux prin voia angajatului
-- nu emite niciuna. Sarcinile de aprobare se închid tăcut încă din 0058, deci
-- aprobatorul deschidea `/concedii/aprobari` și cererea pur și simplu nu mai
-- era acolo.
--
-- CE NU SE ATINGE, pentru că funcționează deja și a fost verificat înainte de a
-- scrie migrarea:
--   • soldul — `internal.leave_requests_sincronizeaza` (0017) propagă statusul
--     în `leave_request_days`, iar `internal.recalc_sold` numără doar zilele
--     `aprobata` (folosite) și `trimisa`/`in_aprobare` (în așteptare). Zilele se
--     întorc singure. Clauza care oprește soldul negativ testează explicit
--     direcția de consum, deci nu blochează restituirea;
--   • sarcinile de aprobare — `internal.leave_requests_inchide_sarcinile`
--     (0058) le trece pe `anulata` la orice ieșire din flux;
--   • fluxul de aprobare, `internal.rezolva_aprobatori`, granturile.
--
-- FEREASTRA. Anularea de către autor se oprește la prima zi a concediului.
-- Regula stă în bază, nu doar în acțiune: altfel ar exista exact în singurul
-- loc pe care un al doilea apelant îl poate ocoli. Un concediu deja început sau
-- consumat rămâne treaba managerului sau a HR-ului — acolo zilele trecute nu
-- trebuie să se întoarcă în sold, iar luna de pontaj poate fi deja blocată.
--
-- PONTAJUL. La aprobare, `decideCerere` (concedii/actions.ts) scrie
-- `attendance_entries` cu `sursa = 'sincronizare_concedii'` și `leave_request_id`.
-- Nimic nu le retrăgea la anulare: pontajul și salarizarea ar fi păstrat zile de
-- concediu pentru un concediu inexistent, iar agregarea din 0049 numără pe
-- `tip_zi`. Retragerea se face AICI, într-un trigger, nu în TypeScript
-- best-effort ca sincronizarea de la aprobare: în trigger e tranzacțională, deci
-- dacă luna e `blocata` și `internal.pontaj_intrare_pregateste` ridică excepție,
-- se dă înapoi ANULAREA ÎNTREAGĂ. Cele două nu pot rămâne desincronizate în
-- tăcere. Cu fereastra de mai sus luna e oricum în viitor, deci cazul e teoretic
-- — dar când apare, refuzul e răspunsul corect.

begin;

-- ============================================================
-- 1. POLITICA — ramura autorului se deschide către `aprobata`
-- ============================================================
-- Rescrisă integral din 0016, nu completată: o politică nu se poate modifica
-- pe bucăți. Ramurile celui care decide și cea administrativă sunt copiate
-- neschimbate, cuvânt cu cuvânt.
--
-- În `USING` (rândul VECHI) autorul primește și `aprobata`. În `WITH CHECK`
-- (rândul NOU) primește o ramură proprie, fără cerința `decis_de is null`:
-- retragerea unui concediu aprobat PĂSTREAZĂ urma deciziei, nu o șterge.
--
-- Ramura asta e, singură, mai largă decât trebuie — l-ar lăsa pe autor să
-- rescrie orice pe rând cât timp aterizează pe `anulata`, inclusiv
-- `decis_de = eu`. Disciplina o pune secțiunea 2, într-un trigger BEFORE care
-- vede și OLD, și NEW. RLS nu poate: `WITH CHECK` nu vede niciodată rândul
-- vechi.

drop policy if exists leave_requests_update on public.leave_requests;
create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'leave')
    and (
      (employee_id = app.current_employee_id(organization_id)
       and status in ('ciorna', 'trimisa', 'aprobata'))
      or app.is_manager_of(organization_id, employee_id)
      or app.has_permission(organization_id, 'leave', 'update') = 'all'
      or app.has_permission(organization_id, 'leave', 'approve') = 'all'
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and (
      -- Ramura autorului: stări proprii, fără câmpuri de decizie.
      (
        employee_id = app.current_employee_id(organization_id)
        and status in ('ciorna', 'trimisa', 'anulata')
        and decis_de is null
        and decis_la is null
        and motiv_respingere is null
      )
      -- Ramura autorului, retragerea: singura ieșire proprie dintr-un concediu
      -- aprobat. Câmpurile deciziei rămân cele scrise de aprobator — sunt
      -- înghețate de `internal.leave_requests_anulare_de_autor`.
      or (
        employee_id = app.current_employee_id(organization_id)
        and status = 'anulata'
      )
      -- Ramura celui care decide: nu poate fi angajatul însuși.
      or (
        employee_id <> app.current_employee_id(organization_id)
        and (
          app.is_manager_of(organization_id, employee_id)
          or app.has_permission(organization_id, 'leave', 'approve') = 'all'
        )
      )
      -- Ramura administrativă: HR corectează o cerere fără să o decidă.
      or (
        app.has_permission(organization_id, 'leave', 'update') = 'all'
        and employee_id <> app.current_employee_id(organization_id)
      )
    )
  );

-- ============================================================
-- 2. DISCIPLINA ANULĂRII — ce are voie autorul să schimbe
-- ============================================================
-- Trei reguli, toate DOAR pentru autorul cererii. Cine nu e autorul iese pe
-- primul `return`: managerul, HR-ul și rulările de serviciu (unde
-- `app.current_employee_id` întoarce null, fiindcă `auth.uid()` e null) rămân
-- exact cu drepturile de dinainte.
--
--   (a) dintr-un concediu aprobat, autorul are o SINGURĂ ieșire — anularea.
--       Fără regula asta, ramura 1 din `WITH CHECK` acceptă `aprobata → ciorna`
--       cu `decis_de` pus pe null: angajatul și-ar putea „dez-aproba” concediul
--       și l-ar retrimite, ștergând urma deciziei;
--   (b) fereastra — prima zi a concediului. `(now() at time zone
--       'Europe/Bucharest')::date` e convenția proiectului pentru „azi”
--       (0004:867, 0008:207, 0011:508); `current_date` gol e ora serverului;
--   (c) la anulare se schimbă DOAR statusul. `updated_at`, `zile_lucratoare`,
--       `zile_calendaristice` și `intrerupe_alte_concedii` NU sunt în listă:
--       le rescrie `internal.leave_requests_pregateste` la fiecare UPDATE, din
--       aceleași date, iar o comparație pe ele ar respinge scrieri legitime.
--
-- Ordinea triggerelor BEFORE e alfabetică: `trg_leave_requests_anulare_de_autor`
-- rulează ÎNAINTEA lui `trg_leave_requests_pregateste`. Voit — comparăm ce a
-- trimis CLIENTUL, nu ce a rescris triggerul (capcana 6, în oglindă).

create or replace function internal.leave_requests_anulare_de_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.current_employee_id(new.organization_id) is distinct from old.employee_id then
    return new;
  end if;

  -- (a) — `intrerupta` e exceptată, și nu din indulgență: pe ea o scrie
  -- `internal.leave_requests_sincronizeaza` (0017), în trigger, când un concediu
  -- medical acoperă un concediu de odihnă aprobat. Dacă angajatul își depune
  -- singur concediul medical, ACTORUL acelei scrieri e chiar autorul cererii
  -- întrerupte, iar regula de mai jos i-ar refuza propriul concediu medical.
  -- Calea directă rămâne închisă oricum: nicio ramură din `WITH CHECK` nu
  -- acceptă `intrerupta` de la autor, iar triggerul e `security definer`.
  if old.status = 'aprobata' and new.status not in ('anulata', 'intrerupta') then
    raise exception using errcode = 'P0001', message =
      'Un concediu aprobat poate fi doar anulat de către angajat. Pentru orice altă schimbare, '
      'cereți corecția managerului sau departamentului de resurse umane.';
  end if;

  if new.status <> 'anulata' or old.status is not distinct from new.status then
    return new;
  end if;

  -- (b)
  if old.status = 'aprobata'
     and old.data_inceput <= (now() at time zone 'Europe/Bucharest')::date then
    raise exception using errcode = 'P0001', message = format(
      'Concediul a început deja (prima zi: %s) și nu mai poate fi anulat de dumneavoastră. '
      'Cereți corecția managerului sau departamentului de resurse umane.',
      to_char(old.data_inceput, 'DD.MM.YYYY'));
  end if;

  -- (c)
  if new.employee_id <> old.employee_id
     or new.leave_type_id <> old.leave_type_id
     or new.data_inceput <> old.data_inceput
     or new.data_sfarsit <> old.data_sfarsit
     or new.decis_de is distinct from old.decis_de
     or new.decis_la is distinct from old.decis_la
     or new.motiv_respingere is distinct from old.motiv_respingere then
    raise exception using errcode = 'P0001', message =
      'La anularea unei cereri se schimbă doar statusul ei.';
  end if;

  return new;
end;
$$;

revoke all on function internal.leave_requests_anulare_de_autor()
  from public, anon, authenticated;

drop trigger if exists trg_leave_requests_anulare_de_autor on public.leave_requests;
create trigger trg_leave_requests_anulare_de_autor
  before update on public.leave_requests
  for each row execute function internal.leave_requests_anulare_de_autor();

-- ============================================================
-- 3. PONTAJUL SE RETRAGE ODATĂ CU CONCEDIUL
-- ============================================================
-- Numai zilele generate de sincronizare (`sursa = 'sincronizare_concedii'`) și
-- numai ale acestei cereri. O zi introdusă MANUAL peste aceeași dată nu se
-- atinge — aceeași grijă pe care o are `sincronizeazaZileleDeConcediu` la
-- scriere. Indexul parțial `attendance_entries_concediu_idx` acoperă filtrul.
--
-- Ștergere logică, ca peste tot: `deleted_at`, nu `delete`. Indexul unic
-- `attendance_entries_zi_uq` are `where deleted_at is null`, deci ziua rămâne
-- liberă pentru o cerere nouă pe aceeași dată.
--
-- Triggerul BEFORE `trg_attendance_entries_pregatire` se declanșează și pe acest
-- UPDATE. Dacă luna e `blocata`, ridică P0001 și anularea se dă înapoi întreagă
-- — comportamentul dorit, explicat în antet. `trg_attendance_entries_sarbatoare`
-- iese pe prima linie la `new.deleted_at is not null` (0013:390), deci nu
-- generează compensări pentru zile șterse.
--
-- Doar `aprobata → anulata`: `respinsa` și `intrerupta` NU sunt aici.
-- Întreruperea (concediu medical peste concediu de odihnă) își înlocuiește
-- zilele prin upsert-ul propriu al cererii care întrerupe; o ștergere de aici
-- ar concura cu ea pe aceeași cheie.

create or replace function internal.leave_requests_retrage_pontajul()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from 'aprobata' or new.status <> 'anulata' then
    return null;
  end if;

  update public.attendance_entries
     set deleted_at = now(), updated_at = now()
   where organization_id = new.organization_id
     and leave_request_id = new.id
     and sursa = 'sincronizare_concedii'
     and deleted_at is null;

  return null;
end;
$$;

revoke all on function internal.leave_requests_retrage_pontajul()
  from public, anon, authenticated;

drop trigger if exists trg_zleave_requests_retrage_pontajul on public.leave_requests;
create trigger trg_zleave_requests_retrage_pontajul
  after update of status on public.leave_requests
  for each row execute function internal.leave_requests_retrage_pontajul();

-- ============================================================
-- 4. ANULAREA → APROBATORII
-- ============================================================
-- Destinatarii sunt „toți cei cu `leave:approve`” în sensul în care îl
-- definește deja `internal.rezolva_aprobatori` (0017), poarta (b): scope `all`
-- oricând, scope `team` doar dacă aprobatorul e ascendent al angajatului în
-- `manager_path`. Nu se reinterpretează fluxul și nu se citesc `approval_tasks`:
-- la o cerere auto-aprobată (pas fără destinatar, 0017) nu există sarcină
-- decisă de cineva, iar dacă managerul s-a schimbat între timp cel care aprobase
-- nu mai e cel care trebuie să afle.
--
-- Nu se notifică: autorul (el a apăsat butonul) și `super_admin` (nu apare
-- NICIODATĂ în `organization_members` — sursa lui e `platform_admins`, deci se
-- exclude structural, nu prin filtru).
--
-- Se acoperă DOUĂ tranziții, cu texte diferite. `trimisa`/`in_aprobare` e aici
-- pentru că aprobatorii au fost deja anunțați de 0048 că există o cerere, iar
-- 0058 le închide sarcina în tăcere: fără rândul ăsta, deschideau
-- `/concedii/aprobari` și cererea dispăruse fără explicație.

create or replace function internal.leave_requests_notifica_anularea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subiect public.employees%rowtype;
  v_tip     text;
  v_era_aprobat boolean;
begin
  if new.status <> 'anulata'
     or old.status is not distinct from new.status
     or old.status not in ('aprobata', 'trimisa', 'in_aprobare') then
    return null;
  end if;

  -- Numai anularea făcută DE ANGAJATUL ÎNSUȘI. Textul de mai jos spune „X a
  -- anulat concediul”; dacă HR-ul retrage cererea altcuiva, propoziția ar fi
  -- falsă și aprobatorii ar cere explicații omului nepotrivit. Anularea
  -- administrativă e o conversație pe care o poartă cine a făcut-o.
  --
  -- Sub `service_role` — scripturi, sarcini de întreținere —
  -- `app.current_employee_id` întoarce null (`auth.uid()` e null), deci nu se
  -- notifică nimeni. Voit: o retragere în masă dintr-un script nu trebuie să
  -- umple cutiile aprobatorilor. `anuleazaCerere` scrie prin clientul
  -- utilizatorului, nu prin cel de serviciu — vezi `ctx.supabase` în handler.
  if app.current_employee_id(new.organization_id) is distinct from new.employee_id then
    return null;
  end if;

  v_era_aprobat := old.status = 'aprobata';

  select * into v_subiect
    from public.employees e
   where e.id = new.employee_id;
  if not found then
    return null;
  end if;

  select lt.denumire into v_tip
    from public.leave_types lt where lt.id = new.leave_type_id;

  insert into public.notifications
    (organization_id, user_id, kind, title, body, link, entity_type, entity_id)
  select distinct
         new.organization_id,
         d.user_id,
         case when v_era_aprobat then 'warning'::public.notification_kind
              else 'info'::public.notification_kind end,
         case when v_era_aprobat then 'Concediu aprobat, anulat de angajat'
              else 'Cerere de concediu retrasă' end,
         coalesce(v_subiect.full_name, 'Un angajat')
           || case when v_era_aprobat
                   then ' a anulat concediul'
                   else ' a retras cererea de concediu' end
           || coalesce(' de ' || v_tip, '')
           || ' pentru perioada ' || to_char(new.data_inceput, 'DD.MM.YYYY')
           || ' – ' || to_char(new.data_sfarsit, 'DD.MM.YYYY') || '.'
           || case when v_era_aprobat
                   then ' Zilele s-au întors în sold, iar zilele de pontaj generate au fost retrase.'
                   else ' Nu mai așteaptă decizia dumneavoastră.' end,
         '/concedii/' || new.id::text,
         'leave_request', new.id
    from (
      -- Scope-ul de `leave:approve` al fiecărui membru activ, cu rândul pe
      -- organizație bătând rândul global — exact ordonarea din
      -- `internal.rezolva_aprobatori`, altfel un membru cu ambele rânduri ar fi
      -- evaluat de două ori, cu scope-uri diferite.
      select distinct on (m.user_id)
             m.user_id, rp.scope, f.id as fisa_id
        from public.organization_members m
        join public.role_permissions rp
          on rp.role = m.role and rp.deleted_at is null
         and rp.resource = 'leave' and rp.action = 'approve'
         and (rp.organization_id = new.organization_id or rp.organization_id is null)
        left join public.employees f
          on f.organization_id = new.organization_id and f.user_id = m.user_id
         and f.is_primary and f.deleted_at is null
       where m.organization_id = new.organization_id
         and m.deleted_at is null
         and m.status = 'active'
         and m.user_id is not null
         and m.user_id is distinct from v_subiect.user_id
       order by m.user_id, (rp.organization_id is null) asc
    ) d
   where d.scope = 'all'
      or (d.scope = 'team'
          and d.fisa_id is not null
          and v_subiect.manager_path @> array[d.fisa_id]);

  return null;
end;
$$;

revoke all on function internal.leave_requests_notifica_anularea()
  from public, anon, authenticated;

-- Prefixul `z`, ca la toate notificările de concedii: după triggerele de flux
-- din 0009/0017, care sincronizează zilele și sarcinile.
drop trigger if exists trg_zleave_requests_notifica_anularea on public.leave_requests;
create trigger trg_zleave_requests_notifica_anularea
  after update of status on public.leave_requests
  for each row execute function internal.leave_requests_notifica_anularea();

commit;

-- ============================================================
-- 5. NOTE DE PROIECTARE
-- ============================================================
-- De ce fereastra e „prima zi”, nu „ziua dinaintea primei zile”: comparația e
-- `old.data_inceput <= azi`, deci în chiar prima zi a concediului anularea e
-- deja refuzată. Un om care e în prima zi de concediu a consumat-o.
--
-- De ce nu am cerut motiv la anulare: nu a fost cerut, iar câmpul
-- `motiv_respingere` aparține respingerii, nu retragerii. Dacă se adaugă vreodată,
-- îi trebuie coloană proprie — refolosirea lui ar amesteca două lucruri diferite
-- în același loc și ar strica textul notificării de respingere.
--
-- De ce notificarea nu se scrie din `anuleazaCerere`: aceeași separație pe care
-- o argumentează antetul lui 0048 — notificarea e un efect secundar și stă în
-- triggere, ca să nu se rupă una când se schimbă cealaltă. În plus, aici ar fi
-- trebuit scrisă în trei locuri (ecranul intern, portalul, orice al treilea
-- apelant viitor) în loc de unul.
