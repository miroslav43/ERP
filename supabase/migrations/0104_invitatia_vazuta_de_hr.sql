-- supabase/migrations/0104_invitatia_vazuta_de_hr.sql
--
-- `employees:invite` era decorativ: `hr` putea INSERA invitația, dar nu o putea
-- CITI, iar aplicația citește imediat ce a scris.
--
-- ── CE SE ÎNTÂMPLA ──────────────────────────────────────────────────────────
-- 0099 a dat rolului `hr` dreptul îngust de a invita angajați și a lărgit
-- politica `invitations_insert` pe măsură. INSERT-ul chiar trecea. Dar
-- `creeazaInvitatie` (`src/lib/invitatii/creeaza.ts`) face:
--
--     .insert({…}).select("id, email").single()
--
-- adică `INSERT … RETURNING`. Iar `RETURNING` pe o tabelă cu RLS trece ȘI prin
-- politica de SELECT — `invitations_select`, care cere `users:read = all`, o
-- permisiune pe care `hr` nu o are deloc (n-are NICIUN `users:*`, prin
-- proiectare).
--
-- Măsurat pe banc, pe același rând, cu același rol:
--
--     insert … values (…)                  → TRECE
--     insert … values (…) returning id     → 42501
--     app.can(org,'users','read','all')    → false
--
-- Efectul în aplicație: la fiecare înrolare făcută de `hr` — adică rolul care
-- înrolează — pasul de invitație ar fi căzut în `catch`, iar omul ar fi văzut
-- „Invitația de acces nu a putut fi trimisă". Tăcut ca defect, vizibil ca
-- avertisment permanent.
--
-- ── DE CE E CAPCANA CASEI ───────────────────────────────────────────────────
-- „RETURNING sub o politică SELECT care ascunde rândul" e una dintre cele
-- unsprezece clase de defecte pe care agentul `erp-santinela-tenant` le caută
-- înainte de fiecare commit. A fost scrisă acolo fiindcă s-a mai întâmplat.
--
-- ── DE CE E PROPORȚIONAT SĂ VADĂ ────────────────────────────────────────────
-- Invitația conține adresa de e-mail, rolul propus, starea și termenul.
-- Tokenul NU e acolo: coloana e `token_hash`, un SHA-256, iar cel în clar nu
-- atinge niciodată baza (0001, CHECK-ul `^[0-9a-f]{64}$`). Cine are
-- `employees:invite = all` vede oricum fișele de personal ale firmei, cu tot cu
-- adrese. Nu se deschide nimic nou.
--
-- Ramura e legată de organizație, ca și celelalte: `hr` din Alfa nu vede
-- invitațiile lui Beta.
--
-- Forward-only: 0002 și 0099 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Cine are dreptul de a invita, are dreptul de a vedea ce a invitat
-- =====================================================================================
-- Restul clauzelor rămân octet cu octet cele din `0002_authz.sql:916`.

drop policy if exists invitations_select on public.invitations;

create policy invitations_select on public.invitations for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and (
    app.can(organization_id, 'users', 'read', 'all')
    or app.can(organization_id, 'employees', 'invite', 'all')
  )
);

-- =====================================================================================
-- 2. Note de proiectare
-- =====================================================================================
--
-- POLITICA DE UPDATE NU SE ATINGE. `hr` poate crea o invitație, nu o poate
-- revoca: revocarea rămâne la `users:update = all`, adică la `org_admin`. Cine
-- înrolează n-are nevoie să și retragă accesul cuiva, iar dreptul îngust
-- trebuie să rămână îngust.
--
-- CE AR FI ASCUNS DEFECTUL: o probă care inserează fără `RETURNING`. Prima
-- versiune a lui `tests/rls/proba-inrolare.sql` făcea exact asta și raporta
-- verde. Cazul din `izolare.sql` folosește `returning id into …`, ca aplicația.

commit;
