-- supabase/migrations/0157_antet_documente.sql
--
-- DATELE DE IDENTIFICARE ALE FIRMEI PE FIECARE DOCUMENT EMIS.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Legea 31/1990 art. 74 alin. (1) cere ca pe documentele care emană de la o
-- societate să apară denumirea, forma juridică, sediul social, numărul din
-- registrul comerțului și codul unic de înregistrare; alin. (3) adaugă
-- capitalul social pentru SRL, iar pentru SA și SCA atât capitalul SUBSCRIS,
-- cât și cel VĂRSAT; alin. (2) cere mențiunea „societate administrată în
-- sistem dualist" când SA-ul a optat pentru sistemul dualist (art. 153).
-- Sancțiunea e contravențională, art. 270^3 alin. (1): 2.500–5.000 lei.
-- Legea 265/2022 art. 128 impune același lucru, mai larg (prinde și PFA/II/IF),
-- iar OMFP 2634/2015 Anexa 1 pct. 3 o repetă pentru ORICE document emis de o
-- entitate: forma juridică, codul de identificare fiscală și capitalul social.
--
-- Pentru documentele de personal, Ordinul MMSS 2171/2022 (model-cadru CIM,
-- care a înlocuit HG 64/2011) enumeră în partea A și telefonul și e-mailul
-- angajatorului, plus reprezentantul legal și calitatea lui.
--
-- Nicio normă nu impune POZIȚIA. Antetul e uzanță; subsolul e la fel de legal.
-- De aceea poziția e o alegere a firmei, nu o constantă în cod.
--
-- ── CE LIPSEA ÎN BAZĂ ───────────────────────────────────────────────────────
-- `organizations` avea deja denumirea, forma juridică, CUI-ul, registrul
-- comerțului, sediul, telefonul, e-mailul, reprezentantul legal și UN singur
-- `capital_social` (0030). Pentru un SRL e exact ce cere alin. (3). Pentru un
-- SA, „capital social 90.000 lei" nu spune care e subscris și care vărsat, deci
-- antetul ar fi fost incomplet față de lege fără ca nimic să semnaleze asta.
-- De aici cele două coloane noi, amândouă folosite DOAR când forma juridică e
-- SA sau SCA.
--
-- ── DE CE `organization_branding` ȘI NU O TABELĂ NOUĂ ───────────────────────
-- Tabela există din 0001 („Faza 1a: strict minimul"), cu `logo_light_path`,
-- `logo_dark_path` și `primary_color`, cu politicile ei din 0002 și cu auditul
-- atașat — și n-a avut până azi niciun apelant în `src/`. Logoul de pe
-- documente e exact ce descrie coloana `logo_light_path`: documentele se
-- tipăresc pe hârtie albă, deci varianta pe fundal deschis. O tabelă nouă ar fi
-- fost a doua casă pentru aceeași noțiune.
--
-- ── DE CE SE DESCHIDE `branding` LA CITIRE PENTRU TOATE ROLURILE ────────────
-- `organization_branding_select` (0002) cere doar apartenența la organizație,
-- deci rândul se citește deja de oricine. FIȘIERUL nu: `storage_objects_select`
-- trece prin `app.can_path`, care ia resursa din segmentul 2 al căii —
-- `{org}/branding/logo/{uuid}.png` înseamnă resursa `branding`, iar seed-ul din
-- 0002 o dă doar lui `org_admin` și `super_admin`. Un `employee` care își
-- deschidea propriul contract ar fi primit un PDF fără siglă, fără nicio
-- eroare: exact felul de refuz tăcut pe care proiectul îl numără în capcane.
--
-- Se deschide DOAR `read`, și doar pe rândul global. Încărcarea și ștergerea
-- siglei rămân la `branding:update`, adică la `org_admin`.
--
-- Toate coloanele noi sunt nullable sau au default sigur — nimic breaking pe
-- rândurile existente. Fără tabele noi, deci fără politici, granturi sau
-- trigger-e de atașat: cele din 0001/0002 acoperă coloanele noi, fiindcă
-- granturile proiectului sunt la nivel de TABELĂ (`0001_kernel.sql:648`), nu de
-- coloană.

begin;

-- ============================================================
-- 1. ENUM — unde stă blocul de identificare
-- ============================================================

create type public.pozitie_antet as enum ('antet', 'subsol');

-- ============================================================
-- 2. ORGANIZATIONS — ce cere art. 74 alin. (2) și (3) pentru SA
-- ============================================================

alter table public.organizations
  add column capital_social_varsat numeric(14, 2),
  add column sistem_dualist boolean not null default false;

alter table public.organizations
  add constraint organizations_capital_varsat_ck
    check (capital_social_varsat is null or capital_social_varsat >= 0),
  -- Vărsatul nu poate depăși subscrisul. Constrângerea se verifică doar când
  -- ambele sunt completate: o firmă care n-a atins încă ecranul de profil are
  -- amândouă null și nu trebuie blocată.
  add constraint organizations_capital_varsat_sub_subscris_ck
    check (
      capital_social_varsat is null
      or capital_social is null
      or capital_social_varsat <= capital_social
    );

comment on column public.organizations.capital_social_varsat is
  'Capitalul social vărsat. Folosit doar pentru SA/SCA — Legea 31/1990 art. 74 alin. (3), '
  'care cere pentru societățile pe acțiuni atât capitalul subscris (capital_social), cât și '
  'cel vărsat. Pentru SRL rămâne null: legea cere acolo un singur capital.';

comment on column public.organizations.sistem_dualist is
  'SA administrată în sistem dualist (Legea 31/1990 art. 153). Când e adevărat, documentele '
  'poartă mențiunea „societate administrată în sistem dualist" — art. 74 alin. (2).';

-- ============================================================
-- 3. ORGANIZATION_BRANDING — poziția blocului și sigla
-- ============================================================

alter table public.organization_branding
  add column antet_pozitie public.pozitie_antet not null default 'antet',
  add column antet_arata_logo boolean not null default true;

comment on column public.organization_branding.antet_pozitie is
  'Unde se tipărește blocul de identificare a firmei: sus (antet) sau jos (subsol). '
  'Nicio normă nu impune poziția — Legea 31/1990 art. 74 cere doar prezența datelor în document.';

comment on column public.organization_branding.antet_arata_logo is
  'Dacă sigla din logo_light_path se tipărește lângă blocul de identificare. Logoul nu e cerut '
  'de nicio normă: vechiul art. 43 alin. (2) din Legea 26/1990, singurul care lega emblema de '
  'documente, a dispărut odată cu abrogarea legii prin Legea 265/2022.';

-- ============================================================
-- 4. PERMISIUNI — citirea siglei pentru toate rolurile
-- ============================================================
--
-- Fără `on conflict`: indexul unic pe role_permissions e PARȚIAL (0023), deci
-- nu poate fi ținta unei clauze `on conflict`. Actualizare, apoi inserare dacă
-- n-a găsit nimic — același tipar ca în 0154.

do $$
declare
  v_rol public.app_role;
begin
  foreach v_rol in array array['org_admin', 'hr', 'manager', 'employee']::public.app_role[] loop
    update public.role_permissions
       set scope = 'all', updated_at = now()
     where role = v_rol
       and resource = 'branding'
       and action = 'read'
       and organization_id is null
       and member_id is null
       and deleted_at is null;

    if not found then
      insert into public.role_permissions (role, resource, action, scope)
      values (v_rol, 'branding', 'read', 'all');
    end if;
  end loop;
end
$$;

commit;
