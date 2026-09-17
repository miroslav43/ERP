-- supabase/migrations/0143_seful_iese_din_departament.sql
--
-- CINE E SCOS DIN DEPARTAMENTUL PE CARE ÎL CONDUCE NU-L MAI CONDUCE.
--
-- ── DEFECTUL, EXACT AȘA CUM A APĂRUT ────────────────────────────────────────
-- Schema ține două coloane care descriu lucruri diferite și n-au nicio punte
-- între ele:
--
--   `departments.manager_employee_id` — cine CONDUCE departamentul
--   `employees.department_id`         — cine e MEMBRU în el
--
-- `src/domain/departments/manager-membru.ts` a legat direcția „desemnez un
-- manager" ⇒ „îl fac și membru. Direcția inversă a rămas nelegată, iar în
-- jurnalul de audit al unei firme reale se vede consecința, în cinci minute:
--
--   19:26:00  departments.update   HR: manager ← Popescu Marius
--                                  (cu bifa de mutare, deci și membru în HR)
--   19:31:54  employees.update     Popescu Marius: department_id HR → null
--   ⇒ HR: 0 angajați, dar cardul scria mai departe „Popescu Marius".
--
-- Omul fusese scos din HR de pe fișa lui, prin `actualizeazaAngajat`. Nimic
-- n-a atins `departments.manager_employee_id`, deci departamentul a rămas
-- arătând către cineva care nu mai are nicio legătură cu el. Nicio eroare,
-- niciun avertisment: ecranul arăta un șef acolo unde nu mai era nimeni.
--
-- Aceeași stare o produce și ștergerea (logică) a fișei: `stergeAngajat`
-- numără subordonații direcți (`employees.manager_employee_id`), dar nu se uită
-- niciodată la departamentele CONDUSE de fișa pe care o închide. Iar citirea din
-- `src/lib/queries/departments.ts` ia managerul prin embed
-- `manager:employees!manager_employee_id(...)`, fără filtru pe `deleted_at` —
-- deci un șef șters continua să apară pe card.
--
-- ── DE CE ÎN BAZĂ, NU ÎN ACȚIUNI ────────────────────────────────────────────
-- `employees.department_id` se scrie azi din cinci locuri: `actualizeazaAngajat`
-- și dialogul de încadrare, `mutaAngajati` din panoul de structură, fluxul
-- `angajati/nou`, funcția din `0107` care duce administratorii în „Conducere" și
-- scripturile de import. Reparat în acțiuni, ar fi ținut cinci din cinci azi și
-- patru din șase la următoarea cale adăugată — exact argumentul scris în
-- `0107_departamentul_conducere.sql` §2, care se aplică aici neschimbat.
--
-- ── CE NU ATINGE, DELIBERAT ─────────────────────────────────────────────────
-- 1. STAREA „MANAGER FĂRĂ SĂ FIE MEMBRU" RĂMÂNE LEGITIMĂ. `camp-manager.tsx`
--    o oferă explicit: desemnezi drept manager pe cineva din alt departament și
--    lași bifa „Mută-l în …" stinsă. Atunci omul n-a fost niciodată membru, deci
--    nu e scos din nimic — `employees.department_id` nici nu se atinge, deci
--    triggerul de mai jos nu se declanșează. Regula pe care o apără migrarea e
--    mai îngustă și e singura care se poate demonstra din date: „a FOST în
--    departamentul pe care îl conduce și a fost scos din el".
--
-- 2. ROLUL DE APLICAȚIE NU SE SCHIMBĂ. `decideSchimbareaSefului` +
--    `aplicaRolurile` retrag rolul `manager` fostului șef care nu mai conduce
--    nimic, dar scrierea în `organization_members.role` cere `org_admin`, iar
--    aici ajunge și un `hr` cu `employees:update`. Un trigger care ar forța
--    rolul ar scrie pe lângă poarta pe care restul proiectului o apără. Rămâne
--    de acordat din `/setari/membri`, iar semnul „· rol de Angajat" de pe card
--    (`sefFaraRolDeManager`) arată deja divergența inversă.
--
-- 3. SUBORDONAREA (`employees.manager_path`) NU SE REFACE. Ea vine din
--    `employees.manager_employee_id`, un cu totul alt arbore — scope-ul `team`
--    nu se uită niciodată la departament. Cine pleacă din HR își păstrează
--    managerul direct până când i-l schimbă cineva din fișă.
--
-- Forward-only: `0004_hr.sql` (tabelele), `0107` (Conducerea) și `0139` (codul
-- opțional) NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. REGULA
-- =====================================================================================
-- `security definer`, ca cele trei funcții din `0107`, dar motivul e altul și
-- merită scris exact, fiindcă la prima citire pare cargo-cult: pe matricea de
-- ROLURI de azi n-ar fi nevoie de el. Cele trei roluri care au `employees:update`
-- — `super_admin`, `org_admin`, `hr` — au toate și `departments:update = all`,
-- deci o funcție `invoker` ar trece. Verificat, nu presupus: proba de la §3 a
-- trecut și cu `security invoker`.
--
-- Nevoia vine din drepturile PER MEMBRU. `role_permissions.member_id` există și
-- e folosit: `app.has_permission` sortează `(member_id is null) asc`, deci
-- rândul de membru bate rândul de rol „inclusiv când valoarea lui e 'none' —
-- refuz EXPLICIT peste un implicit permisiv", scrie chiar comentariul funcției.
-- Un administrator poate deci lua unui om `departments:update` păstrându-i
-- `employees:update` — un `hr` care mută oameni, dar nu are voie să umble în
-- structură. Pentru EL, `invoker` ar cădea pe politica `departments_update`, iar
-- fiindcă un UPDATE respins de `USING` atinge ZERO rânduri FĂRĂ eroare
-- (capcana 17), defectul ar reveni exact acolo unde nimeni nu l-ar căuta: la un
-- singur utilizator, cu drepturi croite de mână. Verificarea (6) din probă e
-- fix acest om.
--
-- Definer-ul nu e o ușă din dos: singurul rând pe care-l poate atinge e
-- departamentul pe care angajatul îl părăsește (`old.department_id`), în firma
-- lui (`old.organization_id`), și numai dacă acel departament îl arăta pe EL ca
-- șef. Nimic din cele trei nu vine de la client.
--
-- `updated_by` nu se trimite: îl pune triggerul BEFORE `set_actor_departments`
-- din `auth.uid()`. Iar `audit_departments` fiind AFTER UPDATE, retragerea
-- ajunge în jurnal ca orice altă schimbare de structură — singurul loc din care
-- se mai poate afla, peste un an, că departamentul a rămas fără șef fiindcă
-- omul a fost mutat, nu fiindcă l-a demis cineva.

create or replace function internal.sef_iese_din_departament()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.departments d
     set manager_employee_id = null
   where d.organization_id      = old.organization_id
     and d.id                   = old.department_id
     and d.manager_employee_id  = old.id
     and d.deleted_at is null;

  return null;
end;
$$;

revoke all on function internal.sef_iese_din_departament() from public, anon, authenticated;

comment on function internal.sef_iese_din_departament() is
  'Golește departments.manager_employee_id când șeful e scos din departamentul pe care îl conduce (mutat sau șters logic). Vezi 0143.';

-- Numele are cifră, ca `trg_employees_70_cursuri`: Postgres execută triggerele
-- de aceeași fază în ordine alfabetică, iar poziția se citește dintr-o privire.
-- Aici ordinea nu are consecință — scriem în ALTĂ tabelă decât cea păzită de
-- celelalte AFTER-uri de pe `employees` — dar cifra o ține așa și dacă mâine va
-- avea.
--
-- Clauza `when` face toată selecția, în index-ul de trigger, nu în corpul
-- funcției: fără ea, funcția s-ar chema la fiecare UPDATE pe `employees` — adică
-- la fiecare salvare de fișă — ca să afle că nu are nimic de făcut.
--
--   · `old.department_id is not null` — cine nu era nicăieri nu pleacă de nicăieri.
--   · `old.deleted_at is null` — fișa deja ștearsă a fost tratată la ștergere.
--   · destinația e irelevantă: `null` (nerepartizat) sau alt departament, în
--     amândouă cazurile a plecat din al lui.
--   · `new.deleted_at is not null` prinde ștergerea logică, unde
--     `department_id` rămâne neschimbat.

drop trigger if exists trg_employees_75_sef_departament on public.employees;
create trigger trg_employees_75_sef_departament
  after update on public.employees
  for each row
  when (
    old.department_id is not null
    and old.deleted_at is null
    and (
      new.department_id is distinct from old.department_id
      or new.deleted_at is not null
    )
  )
  execute function internal.sef_iese_din_departament();

-- =====================================================================================
-- 2. RÂNDURILE CARE SUNT DEJA STRICATE
-- =====================================================================================
-- Triggerul acoperă doar ce se întâmplă de acum înainte. Fără pasul ăsta, exact
-- firma pentru care s-a raportat defectul ar rămâne cu el pe ecran.
--
-- ⚠️ REPARAȚIA E ÎNGUSTĂ ÎNADINS ȘI NU SE LĂRGEȘTE LA „manager care nu e
-- membru". Datele nu mai spun care dintre cele două povești a produs starea:
-- „a fost scos din departamentul lui" (defect) sau „a fost desemnat din alt
-- departament, cu bifa de mutare stinsă" (stare legitimă, oferită de interfață).
-- Un `update` care le-ar trata la fel ar șterge, în firme pe care nu le vedem,
-- decizii pe care oameni le-au luat conștient, pe un ecran care i-a avertizat.
--
-- Se repară deci numai cele două forme care NU pot fi decizii:
--   (a) șeful e nerepartizat (`department_id is null`) — `manager-membru.ts`
--       spune „nerepartizat ⇒ se repartizează tăcut, fiindcă nu se pierde
--       nimic", deci un șef nerepartizat n-a putut ajunge acolo prin consimțământ;
--   (b) șeful are fișa ștearsă logic — nimeni nu desemnează un șters.

update public.departments d
   set manager_employee_id = null
  from public.employees e
 where e.id = d.manager_employee_id
   and e.organization_id = d.organization_id
   and d.deleted_at is null
   and (e.deleted_at is not null or e.department_id is null);

-- =====================================================================================
-- 3. CE AR ASCUNDE DEFECTUL LA LOC
-- =====================================================================================
-- O probă care mută un angajat oarecare și verifică apoi că departamentul lui
-- vechi a rămas coerent: trece și fără trigger, fiindcă angajatul oarecare nu e
-- șef. Proba corectă desemnează ÎNTÂI șeful, îl mută pe URMĂ, și citește
-- `departments.manager_employee_id` după mutare. Vezi
-- `tests/rls/proba-sef-departament.sql`.
--
-- A doua capcană: rulată ca `postgres`, orice probă trece — `postgres` are
-- `bypassrls`, deci n-ar vedea nici măcar diferența între `definer` și
-- `invoker`. Probele rulează ca `authenticated`, iar verificarea (6) își
-- construiește dinadins omul care rupe varianta `invoker`: `employees:update`
-- din rol, `departments:update = 'none'` pus per membru.

commit;
