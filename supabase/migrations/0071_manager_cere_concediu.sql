-- supabase/migrations/0071_manager_cere_concediu.sql
-- Redenumită din 0064: între timp amonte a ocupat 0064-0070 cu migrări de
-- concedii, salarizare, pontaj și înrolare. Convenția din CLAUDE.md la coliziune
-- e să îți redenumești PROPRIA migrare. Conținutul e neschimbat și a fost deja
-- rulat pe baza de dezvoltare sub numele vechi — iar acele 0064-0070 erau deja
-- aplicate acolo, deci ordinea reală de aplicare e chiar cea din numele nou.
-- Managerul nu-și putea depune propriul concediu.
--
-- Seed-ul din 0002 îi dă exact `('manager','leave','team','{read,approve}')`.
-- Nu are `create`, deci `can(permisiuni, 'leave:create', 'own')` e fals și îi
-- răspund cu „Nu aveți dreptul de a depune cereri de concediu.” TREI locuri
-- deodată: butonul „Cerere nouă” din `/concedii`, pagina `/concedii/noua` și
-- pagina `/portal/concediile-mele/noua`. Un manager putea aproba concediile
-- echipei, dar nu putea cere unul pentru el.
--
-- Nu era o restricție a bazei. `leave_requests_insert` (0009, §RLS) acceptă
-- rândul dacă `employee_id = app.current_employee_id(organization_id)`, fără să
-- ceară vreo permisiune — poarta era strict aplicativă, în `createAction`.
--
-- Al doilea rând, `update`, nu e opțional: fără el managerul ar putea depune o
-- cerere pe care n-o mai poate ANULA (`leave.request.cancel` cere
-- `leave:update = own`). Exact tiparul din Faza 2 — poarta negativă trece, cea
-- pozitivă nu — de aceea cele două drepturi vin în aceeași migrare.
--
-- Scope `own`, nu `team`: managerul depune și anulează DOAR pentru el. Pentru
-- echipă are deja `approve`, care e decizia potrivită asupra cererii altcuiva;
-- anularea în locul respingerii ar ocoli motivul obligatoriu de respingere.
-- Handler-ul `leave.request.cancel` primește în aceeași livrare filtrul explicit
-- pe fișa proprie când `ctx.scope <> 'all'`, fiindcă politica
-- `leave_requests_update` acceptă și `app.is_manager_of(...)` — RLS singură ar
-- fi lăsat managerul să anuleze cererea unui subaltern.
--
-- Precedent de formă: `('manager','maintenance','all','{create}')` din 0002 —
-- un al doilea rând pe aceeași resursă, cu alt scope, pentru altă acțiune.
-- Indexul unic e (organization_id, role, resource, action), deci rândurile
-- `read`/`approve` existente nu sunt atinse.
--
-- Cine aprobă cererea managerului, verificat înainte de a scrie migrarea:
--   • NU el însuși — `internal.rezolva_aprobatori` (0017) filtrează prin
--     `cb.user_id is distinct from v_subiect.user_id`;
--   • managerul lui direct, sau oricine cu `leave:approve = all` (org_admin);
--   • dacă mulțimea iese vidă — un manager fără șef — triggerul de trimitere
--     (0017, §„Mulțime vidă pe un pas obligatoriu”) ESCALADEAZĂ la deținătorii
--     de `leave:approve = all`, nu blochează cererea.
-- Nicio funcție de flux nu se modifică aici.

begin;

-- ============================================================
-- 1. DREPTUL DE A CERE ȘI DE A ANULA, PENTRU SINE
-- ============================================================
-- Rând GLOBAL (`organization_id is null`): se aplică tuturor organizațiilor,
-- existente și viitoare. O organizație care ar vrea altfel poate insera un rând
-- propriu cu `scope = 'none'` — rândul local bate globalul în `getPermissionMap`.
--
-- `member_id` = null înseamnă „rând la nivel de ROL”, spre deosebire de rândul
-- unui membru anume (0063). Coloana e în cheia unică de la 0063 încoace, deci
-- ținta lui `on conflict` trebuie s-o cuprindă — altfel Postgres nu recunoaște
-- niciun index și refuză instrucțiunea cu „no unique or exclusion constraint
-- matching the ON CONFLICT specification”. Aceeași clauză scrisă în 0002 (fără
-- `member_id`) nu se mai potrivește azi; nu se corectează acolo, e aplicată.
--
-- `where deleted_at is null` repetă PREDICATUL indexului parțial
-- `role_permissions_uq`; fără predicat, Postgres nu recunoaște indexul.

insert into public.role_permissions (organization_id, member_id, role, resource, action, scope)
values
  (null, null, 'manager'::public.app_role, 'leave', 'create', 'own'::public.permission_scope),
  (null, null, 'manager'::public.app_role, 'leave', 'update', 'own'::public.permission_scope)
on conflict (organization_id, member_id, role, resource, action)
  where deleted_at is null do nothing;

-- ============================================================
-- 2. REFUZURILE EXPLICITE RĂMASE DIN ISTORIC
-- ============================================================
-- Dacă o livrare anterioară a scris `scope = 'none'` pe aceste două acțiuni
-- (refuz explicit, nu absența rândului), inserarea de mai sus n-ar fi făcut
-- nimic — cheia există deja. Ridicăm refuzul DOAR pe rândul global și DOAR
-- dacă e `none`, ca să nu atingem un `all` pus intenționat de cineva.

update public.role_permissions
   set scope = 'own'::public.permission_scope, updated_at = now()
 where organization_id is null
   and member_id is null
   and role = 'manager'
   and resource = 'leave'
   and action in ('create', 'update')
   and scope = 'none'
   and deleted_at is null;

commit;
