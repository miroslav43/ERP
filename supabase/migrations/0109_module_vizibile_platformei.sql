-- =====================================================================================
-- 0109_module_vizibile_platformei.sql
--
-- Consola de platformă își vede propriile comutări de module.
--
-- ── DEFECTUL, AȘA CUM SE VEDE ────────────────────────────────────────────────
-- Pe `/super-admin/organizatii/<id>/module`, toate comutatoarele apar STINSE,
-- indiferent ce scrie în bază. Apeși unul: mesajul spune „modulul a fost
-- activat", iar după reîmprospătare comutatorul sare înapoi pe „Inactiv".
-- Nicio eroare, nicăieri. Fișa organizației, în schimb, numără corect modulele
-- active — două ecrane vecine care se contrazic.
--
-- ── DE CE ────────────────────────────────────────────────────────────────────
-- Cele două ecrane citesc prin clienți diferiți. Fișa merge prin `service_role`
-- (`fisaOrganizatie`, actions.ts:407) și vede tot. Pagina de module citește cu
-- clientul de sesiune, deci prin RLS — iar politica scrisă în 0002_authz.sql
-- cerea APARTENENȚĂ:
--
--     using (organization_id = any (app.current_org_ids()) and deleted_at is null)
--
-- `app.current_org_ids()` se calculează exclusiv din `organization_members`
-- (0002:135), iar un `super_admin` nu e NICIODATĂ acolo — sursa lui e
-- `platform_admins`. Pentru orice firmă din care administratorul de platformă
-- nu întâmplător face parte, interogarea întoarce ZERO RÂNDURI, fără eroare,
-- iar pagina desenează fiecare modul necomutabil ca inactiv.
--
-- Proba, rulată înainte de migrarea asta, pe baza reală:
--
--   set local request.jwt.claims = '{"sub":"<admin de platformă>", ...}';
--   select count(*) from public.organization_features
--    where organization_id = '<firmă din care NU e membru>';   -- 0
--                                                              -- în bază: 11
--
-- ── ASIMETRIA, CARE E MIEZUL ─────────────────────────────────────────────────
-- INSERT și UPDATE pe aceeași tabelă cereau deja `app.is_platform_admin()`
-- (0002:976-981). Doar SELECT nu. Scrierea reușea, recitirea o ascundea — cel
-- mai neplăcut tipar din proiect, fiindcă lasă interfața să mintă în tăcere în
-- loc să pice zgomotos. `organizations_select` (0002:840) are deja exact ramura
-- care lipsea aici; migrarea asta o aliniază, nu inventează o regulă nouă.
--
-- ── CE NU SCHIMBĂ ────────────────────────────────────────────────────────────
-- Nimic pentru rolurile din firmă: ramura de apartenență rămâne cuvânt cu
-- cuvânt aceeași, la fel și `deleted_at is null`, scos în față ca să se aplice
-- pe amândouă ramurile. Un `org_admin`, `hr`, `manager` sau `employee` vede
-- exact ce vedea. Nicio politică nouă de DELETE. Nicio coloană atinsă.
--
-- Lărgirea nu deschide date de firmă: `organization_features` conține chei de
-- modul și cine le-a pornit, iar administratorul de platformă are deja dreptul
-- să le SCRIE. Dreptul de a vedea ce ai voie să schimbi nu adaugă suprafață.
-- =====================================================================================

begin;

-- Se rescrie politica, nu se adaugă una a doua: politicile PERMISSIVE se adună
-- prin OR, deci o politică suplimentară ar fi funcționat — dar ar fi lăsat
-- regula împărțită în două locuri, iar următorul care citește tabela ar fi
-- trebuit să le țină minte pe amândouă ca să știe cine vede ce.
drop policy if exists organization_features_select on public.organization_features;

create policy organization_features_select on public.organization_features for select to authenticated
using (
  deleted_at is null
  and (
    (select app.is_platform_admin())
    or organization_id = any ((select app.current_org_ids())::uuid[])
  )
);

comment on policy organization_features_select on public.organization_features is
  'Rândurile nesterse ale firmelor în care ești membru, plus TOATE pentru administratorii de '
  'platformă. Ramura de platformă exista deja pe INSERT și UPDATE; fără ea pe SELECT, consola '
  'scria comutarea și apoi n-o mai vedea — zero rânduri, fără eroare.';

commit;
