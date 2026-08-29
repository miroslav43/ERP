-- supabase/migrations/0096_concediu_document_original.sql
-- Angajatul nu putea trimite din portal NICIUN concediu care cere act.
--
-- ┌ Ce se întâmpla ───────────────────────────────────────────────────────────
-- │ `internal.leave_requests_pregateste` (0009_leave.sql:631) respinge cu P0001
-- │ orice trimitere a unui tip cu `necesita_document`, dacă `atasament_path` e
-- │ gol ȘI `medical_code_id` e null.
-- │
-- │ Formularul din portal trimite `atasament_path: null` — scris explicit,
-- │ cu un comentariu care spune că un câmp de cale de storage „pe telefon, e
-- │ absurd" (formular-cerere.tsx:212). Are, în schimb, `medical_code_id`.
-- │
-- │ Deci: `medical` trecea, prin codul de indemnizație. Restul de NOUĂ tipuri
-- │ cu `necesita_document = true` — maternitate, donator_sange, casatorie,
-- │ crestere_copil, deces_ruda, ingrijitor, nastere_copil, paternal, studii —
-- │ se opreau într-un mesaj care cere un atașament pe care ecranul nu-l putea
-- │ oferi. Fără ieșire, nu doar incomod.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Se rezolvă în două mișcări, iar asta e prima:
--
--   (1) AICI: cele trei concedii care cer originalul PE HÂRTIE nu mai cer și
--       atașament. Actul lor nu se poate încărca — pleacă mai departe fizic:
--       certificatul medical tipizat în dosarul FNUASS la Casa de Sănătate,
--       maternitatea pe același certificat (cod 08), adeverința de donator la
--       control. O copie scanată nu închide niciuna dintre ele.
--
--   (2) În aplicație: pentru celelalte tipuri apare o încărcare reală de
--       fișier, în portal și în ecranul de resurse umane — deci cerința
--       triggerului devine, în sfârșit, satisfăcută.
--
-- Lista celor trei trăiește și în `src/domain/leave/documente-fizice.ts`.
-- `documente-fizice.test.ts` citește FIȘIERUL ĂSTA și pică dacă cele două se
-- despart — singura apărare, de vreme ce una e în TypeScript și cealaltă în
-- plpgsql.
--
-- DE CE NU O COLOANĂ pe `leave_types`: regula vine din lege, nu din politica
-- unei firme. Nicio organizație nu poate decide că FNUASS îi acceptă un PDF,
-- iar un comutator în interfață ar sugera că se poate.
--
-- Forward-only, idempotentă: `create or replace` pe o funcție care există din
-- 0009 și n-a mai fost redefinită de atunci. Nu se atinge niciun rând.

begin;

---------------------------------------------------------------------------
-- 1. internal.leave_requests_pregateste — scutirea de atașament
---------------------------------------------------------------------------
-- Copie EXACTĂ a corpului din 0009_leave.sql:616-653, cu o singură ramură
-- schimbată: condiția care ridică P0001. Restul rămâne literă cu literă, ca
-- diferența dintre versiuni să fie citibilă dintr-o privire.

create or replace function internal.leave_requests_pregateste()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tip public.leave_types%rowtype; v_org uuid;
begin
  select * into v_tip from public.leave_types where id = new.leave_type_id and deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Tipul de concediu selectat nu există sau a fost dezactivat.';
  end if;
  if v_tip.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'Tipul de concediu aparține altei organizații.';
  end if;
  select organization_id into v_org from public.employees where id = new.employee_id and deleted_at is null;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'Angajatul selectat nu aparține organizației curente.';
  end if;

  -- Cele trei chei sunt aceleași, în aceeași ordine, ca
  -- `TIPURI_CU_ORIGINAL_FIZIC` din `src/domain/leave/documente-fizice.ts`.
  -- Actul lor se predă pe hârtie, deci trimiterea nu mai așteaptă un fișier;
  -- încărcarea rămâne posibilă din interfață, ca ajutor, dar e opțională.
  if v_tip.necesita_document and new.status = 'trimisa'
     and v_tip.key not in ('medical', 'maternitate', 'donator_sange')
     and coalesce(btrim(new.atasament_path), '') = '' and new.medical_code_id is null then
    raise exception using errcode = 'P0001',
      message = 'Acest tip de concediu necesită un document justificativ atașat înainte de trimitere.';
  end if;

  if new.data_inceput < (current_date - interval '2 years')::date then
    raise exception using errcode = 'P0001',
      message = 'Perioada solicitată este mai veche de doi ani. Corectați datele cererii.';
  end if;

  new.intrerupe_alte_concedii := v_tip.intrerupe_alte_concedii;
  new.zile_calendaristice := (new.data_sfarsit - new.data_inceput) + 1;
  new.zile_lucratoare := app.numara_zile_lucratoare(
    new.organization_id, new.data_inceput, new.data_sfarsit,
    new.portiune_inceput, new.portiune_sfarsit);

  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status <> 'trimisa') then
    new.trimisa_la := now();
  end if;
  if new.status in ('aprobata', 'respinsa') and (tg_op = 'INSERT' or old.status <> new.status) then
    new.decis_la := now();
  end if;
  new.updated_at := now();
  return new;
end; $$;

---------------------------------------------------------------------------
-- 2. Privilegii pe funcție
---------------------------------------------------------------------------
-- `create or replace` păstrează privilegiile existente, dar coada le rescrie
-- explicit — aceeași regulă ca în 0073: o funcție nu se lasă niciodată pe
-- moștenirea implicită.

revoke all on function internal.leave_requests_pregateste() from public;
grant execute on function internal.leave_requests_pregateste() to authenticated, service_role;

commit;
