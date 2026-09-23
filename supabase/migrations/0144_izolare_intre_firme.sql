-- supabase/migrations/0144_izolare_intre_firme.sql
--
-- CELE PATRU LOCURI PE UNDE SE IESE DIN FIRMĂ.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Auditul din 21 sept 2026 (`docs/audit-frontend-baza-2026-09-21.md`) a pornit
-- de la o întrebare despre frontend — „atinge browserul baza direct?" — și a
-- găsit ușa prin care o atingea: cheia publicabilă coaptă în bundle plus
-- sesiunea lizibilă din `document.cookie`. Ușa s-a închis în cod. Rămâne ce se
-- putea face pe ea, iar utilizatorul propriu o poate face în continuare, din
-- consola browserului, cu sesiunea lui: 55 de reguli care trăiesc DOAR în
-- `createAction`, nu și în bază.
--
-- Migrarea asta le rezolvă pe cele patru care ies din firma proprie — singurele
-- care rup izolarea multi-tenant, adică promisiunea pe care stă tot produsul.
-- Restul urmează pe loturi.
--
-- ── DE CE ÎN BAZĂ, NU ÎN ACȚIUNI ────────────────────────────────────────────
-- Fiindcă exact acolo NU erau. Toate patru sunt respectate azi de codul care
-- cheamă acțiunile; niciuna nu e respectată de PostgREST, care vede doar un
-- `authenticated` legitim cu jetonul lui. O regulă de izolare care se poate
-- ocoli cu un `curl` nu e o regulă, e o convenție.
--
-- ── CELE PATRU ──────────────────────────────────────────────────────────────
-- (F01) `avatars_select` = `bucket_id = 'avatars'`, fără nicio altă condiție:
--       orice cont autentificat, din ORICE firmă, listează căile tuturor
--       avatarurilor platformei cu un singur POST pe /object/list/avatars.
--       `avatars_update` are același USING gol, deci același cont poate MUTA
--       poza oricui în folderul lui — la victimă `profiles.avatar_path` rămâne
--       să arate spre un obiect care nu mai există. Probat pe banc: un cont din
--       firma A a văzut obiectul unui utilizator al firmei B (cu care n-are
--       nicio organizație comună) și l-a redenumit sub el.
--
-- (F12) `organization_members_insert` cere doar `org_admin` pe firma ȚINTĂ, nu
--       și consimțământul celui adăugat: un org_admin inserează direct un rând
--       de apartenență pentru orice `auth.users.id` cunoscut — inclusiv al unui
--       utilizator al altei firme-client — iar `profiles_select` (care merge pe
--       „împărțim o organizație") îi deschide apoi numele, e-mailul și
--       telefonul. Calea legitimă e `accept_invitation`, care cere sesiunea
--       invitatului și potrivirea adresei.
--
-- (F13) `app.can_path` tratează `team` ca `all` (`when 'team' then true`), deci
--       un manager cu `employees:read = team` citește direct din Storage TOATE
--       dosarele firmei — certificate medicale, acte confidențiale, fișierele
--       de import cu CNP și IBAN în clar. Nu iese din firmă, dar iese din
--       echipă exact acolo unde restul produsului nu-l lasă; l-am pus în lotul
--       ăsta fiindcă e aceeași clasă: un scope care nu e verificat.
--
-- (F38) `notifications_insert` verifică organizația EXPEDITORULUI, nu
--       apartenența DESTINATARULUI: cine are `announcements:create = all`
--       într-o firmă poate scrie o notificare (cu titlu și text alese de el)
--       către orice `user_id` de pe platformă, dacă îl cunoaște. Ajunge și pe
--       telefon, prin coada de push.
--
-- ── CE NU ATINGE, DELIBERAT ─────────────────────────────────────────────────
-- 1. BUCKET-UL `avatars` RĂMÂNE PUBLIC. Politicile de mai jos opresc
--    ENUMERAREA și MUTAREA; nu schimbă faptul că o cale cunoscută se descarcă
--    fără cont (`/object/public/...` ocolește RLS prin definiție). Căile conțin
--    două UUID-uri, deci nu se ghicesc, iar cine le vede în HTML e oricum un
--    coleg. Trecerea bucket-ului pe privat cere o rută proprie de servire, cu
--    tot ce ține de cache — schimbare de cod, nu de politică, și merită propriul
--    ei plan.
-- 2. `avatars_insert` RĂMÂNE NEATINSĂ. Funcționează, e deja îngustă (folder
--    propriu sau `users:update = all`), iar rescrierea ei ar pune în joc exact
--    fluxul de încărcare pe care tocmai l-am schimbat în cod.
-- 3. NU SE ȘTERG RÂNDURI EXISTENTE. Dacă în producție există deja apartenențe
--    introduse fără invitație, migrarea nu le atinge — le lasă vizibile pentru
--    o decizie omenească.

begin;

-- ── 1. HELPER: apartenența ALTUI utilizator ────────────────────────────────
-- `app.is_member(org)` răspunde doar despre apelant. Aici trebuie răspuns
-- despre destinatarul unei notificări, deci a doua semnătură, cu utilizatorul
-- explicit. SECURITY DEFINER fiindcă e chemată dintr-o politică și n-are voie
-- să depindă de ce vede apelantul în `organization_members`.
create or replace function app.este_membru(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

comment on function app.este_membru(uuid, uuid) is
  'Este utilizatorul dat membru ACTIV al organizației date? Perechea cu două argumente a lui app.is_member, pentru politicile care verifică destinatarul, nu apelantul.';

revoke all on function app.este_membru(uuid, uuid) from public, anon;
grant execute on function app.este_membru(uuid, uuid) to authenticated, service_role;

-- ── 2. HELPER: avatarul e al meu sau al cuiva pe care îl administrez ───────
-- Predicatul scris o singură dată, în loc de trei copii ale aceluiași EXISTS
-- (`avatars_insert` îl are deja inline; rămâne așa, vezi §3 din antet).
create or replace function app.avatar_propriu_sau_administrat(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (storage.foldername(p_name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1
        from public.organization_members m
        where m.user_id = ((storage.foldername(p_name))[1])::uuid
          and m.status = 'active'
          and m.deleted_at is null
          and app.has_permission(m.organization_id, 'users', 'update') = 'all'
      )
    ),
    false
  );
$$;

comment on function app.avatar_propriu_sau_administrat(text) is
  'Folderul din calea avatarului e contul apelantului, sau al unui membru pe care apelantul îl administrează (users:update = all). Aceeași condiție ca în WITH CHECK-ul lui avatars_insert.';

revoke all on function app.avatar_propriu_sau_administrat(text) from public, anon;
grant execute on function app.avatar_propriu_sau_administrat(text) to authenticated, service_role;

-- ── 3. F01: avatarele nu se mai enumeră și nu se mai mută ──────────────────
-- SELECT: afișarea NU trece pe aici (bucket public), deci restrângerea nu se
-- vede în niciun ecran. Ce dispare e listarea prin SDK — singura ei utilizare
-- reală era enumerarea din altă firmă.
drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and app.avatar_propriu_sau_administrat(name)
);

-- UPDATE: USING-ul gol lăsa mutarea obiectului ALTCUIVA (WITH CHECK se uita
-- doar la numele NOU). Acum rândul-sursă trece prin aceeași poartă ca rândul
-- destinație, iar `owner` trebuie să fie apelantul: nimeni nu rescrie obiectul
-- urcat de altcineva.
--
-- `owner` ancorează obiectul de cine l-a URCAT, nu de cine e în folder. Două
-- consecințe, ambele fără efect azi, ambele probate ca să nu fie redescoperite:
--   * un avatar urcat de `org_admin` pentru un angajat (`avatar-actions.ts`)
--     are `owner` = administratorul, deci angajatul îl VEDE, dar nu-l poate
--     rescrie în loc. Nu se întâmplă: `caleAvatar` pune un UUID nou în fiecare
--     cale, deci orice încărcare e INSERT curat, niciodată suprascriere.
--   * un obiect cu `owner is null` (urcat cândva cu `service_role`) nu mai e
--     modificabil de nimeni prin clientul utilizatorului. Nici nu trebuie:
--     ștergerile de serviciu merg oricum pe `service_role`, care nu trece prin
--     politici.
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and owner = (select auth.uid())
  and app.avatar_propriu_sau_administrat(name)
)
with check (
  bucket_id = 'avatars'
  and app.avatar_propriu_sau_administrat(name)
);

-- ── 4. F12: apartenența nu se mai scrie direct din client ─────────────────
-- Nicio Server Action și niciun ecran nu inserează în `organization_members` cu
-- clientul utilizatorului (verificat prin grep pe tot `src/`): rândurile vin din
-- `public.accept_invitation` — SECURITY DEFINER, cere sesiunea invitatului și
-- potrivirea adresei din invitație — sau din panoul de platformă, cu
-- `service_role`. Tabela NU are FORCE ROW LEVEL SECURITY, deci ambele căi trec
-- pe lângă politici și rămân neatinse.
--
-- Politica dispare în loc să fie rescrisă cu „trebuie să existe o invitație
-- acceptată": o invitație acceptată e chiar ce scrie `accept_invitation`, deci
-- orice politică echivalentă ar fi o a doua implementare a aceleiași reguli, cu
-- risc de divergență. Mai puțin cod, aceeași regulă.
drop policy if exists organization_members_insert on public.organization_members;

-- ── 5. F13: `team` nu mai înseamnă `all` pe căile din Storage ─────────────
-- Ramura `team` cerea doar ca resursa din segmentul 2 să aibă scope `team` —
-- niciodată ca entitatea din segmentul 3 să fie a echipei. Acum o cere:
-- entitatea trebuie să fie o fișă de personal a firmei pe care apelantul o
-- conduce (`is_manager_of` include propria fișă, deci nimeni nu-și pierde
-- propriile documente).
--
-- `app.can_path` păzește TREI bucket-uri, nu unul — verificat cu
-- `grep -rn "and app.can_path" supabase/migrations/`:
--
--   `org-documents` + `org-branding` (0002) — segment 2 ∈ {employees, leave},
--        segment 3 = fișa de personal (și la concedii: `entitateId` e tot fișa,
--        nu id-ul cererii). Aici verificarea pe entitate e exact ce trebuie.
--   `org-courses` (0075) — segment 3 = `course_materials.id`. Verificarea pe
--        entitate ar refuza TOT, deci resursa `courses` rămâne pe vechiul
--        comportament (vezi §5 și comentariul din funcție).
--
-- Căile fără fișă în segmentul 3 sub resursa `employees` — loturile de import,
-- `{org}/employees/{batch_id}/...` — cad acum pe `false` la scope `team`. Nu
-- rupe importul: ambele acțiuni de import cer `employees:create`, pe care
-- seedul îl dă doar cu scope `all` (hr, org_admin, super_admin). Exact fișierul
-- ăla, cu CNP și IBAN în clar, era premiul cel mare al defectului.
--
-- Un manager FĂRĂ rând în `employees` (rolul stă pe apartenență, fișa e
-- separată) are `app.current_employee_id(org) = null`, deci `is_manager_of`
-- întoarce fals: pierde accesul pe care `team → true` i-l dădea înainte. E
-- intenționat — cine nu are fișă n-are nici echipă — și e probat explicit.
create or replace function app.can_path(p_name text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select app.path_org(p_name) as org,
           app.path_resource(p_name) as res,
           app.path_segment(p_name, 3) as ent
  )
  select coalesce((
    select case
      when p.org is null or p.res is null then false
      when not (p.org = any (app.current_org_ids())) then false
      else case app.has_permission(p.org, p.res, p_action)
             when 'all'  then true
             -- `team` verificat pe ENTITATEA din cale — dar NUMAI pe resursele
             -- ale căror căi poartă chiar o fișă de personal în segmentul 3.
             -- Alea sunt exact cele două din `ENTITATI_DOCUMENT`
             -- (`src/lib/documents/cale.ts`): `employees` și `leave`.
             --
             -- `courses` trece și el prin `can_path` (politicile din 0075), dar
             -- acolo segmentul 3 e `course_materials.id`
             -- (`construiesteCaleMaterial`), nu o fișă. Fără excepția asta, un
             -- manager cu `courses:* = team` ar fi pierdut TOT modulul Cursuri:
             -- încărcare, previzualizare, versiuni noi — toate cad pe
             -- `courses_objects_insert/_select/_update`, iar ecranul ar fi
             -- spus „Nu am putut pregăti încărcarea fișierului", adică un refuz
             -- de permisiune deghizat în defecțiune.
             when 'team' then case
                                when p.res in ('employees', 'leave') then exists (
                                  select 1
                                  from public.employees e
                                  where e.id::text = p.ent
                                    and e.organization_id = p.org
                                    and e.deleted_at is null
                                    and app.is_manager_of(p.org, e.id)
                                )
                                else true
                              end
             -- Două chei pentru aceeași persoană: `auth.uid()` când entitatea
             -- din cale ESTE contul (avatare, preferințe), `employees.id` când
             -- entitatea e fișa de personal. A cere doar prima însemna că un
             -- angajat nu-și poate citi propriul document — defect (b) din
             -- antetul migrării 0073.
             when 'own'  then p.ent = (select auth.uid())::text
                           or exists (
                                select 1
                                from public.employees e
                                where e.id::text = p.ent
                                  and e.organization_id = p.org
                                  and e.user_id = (select auth.uid())
                                  and e.deleted_at is null
                              )
             else false
           end
    end
    from p
  ), false);
$$;

revoke all on function app.can_path(text, text) from public, anon;
grant execute on function app.can_path(text, text) to authenticated, service_role;

-- ── 6. F38: notificarea nu mai pleacă în afara firmei ─────────────────────
-- Condiția adăugată e pe DESTINATAR. Ramura `user_id = auth.uid()` rămâne
-- prima: cine își scrie o notificare sieși e membru prin definiție, dar
-- verificarea explicită costă o căutare pe index și ține politica citibilă.
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and (
    user_id = (select auth.uid())
    or app.can(organization_id, 'announcements', 'create', 'all')
  )
  and app.este_membru(organization_id, user_id)
  and read_at is null
  and sent_email_at is null
  and deleted_at is null
);

commit;
