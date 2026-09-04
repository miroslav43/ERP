-- supabase/migrations/0128_absente_nemotivate_suspendare.sql
-- Absența nemotivată devine a doua sursă de suspendare a contractului — cu
-- termen propriu, sursă marcată în rând și un drum care NU pleacă dintr-o
-- cerere de concediu.
--
-- ┌ De ce absența nu poate folosi termenele suspendării obișnuite ────────────
-- │ HG 905/2017 cere suspendarea „cel târziu în ziua anterioară" începerii —
-- │ regulă pe care absența nemotivată n-o poate respecta niciodată: nimeni nu
-- │ știe ieri că omul nu vine azi. Legea prevede pentru ea o EXCEPȚIE de 3 zile
-- │ lucrătoare DE LA data suspendării. Termenul e altul, deci și tipul de
-- │ eveniment trebuie să fie altul: `reges_termene` are un rând per
-- │ `event_type`, iar două termene sub aceeași cheie nu încap.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ Aberația legislativă de la RELUARE, și ce facem cu ea ────────────────────
-- │ Excepția de 3 zile e scrisă doar pentru ÎNCEPEREA suspendării. Pentru
-- │ reluare, textul lasă în picioare regula generală — „ziua anterioară
-- │ întoarcerii" — care aici e logic imposibilă: omul se prezintă azi, fără
-- │ preaviz, iar transmiterea de ieri nu se mai poate face.
-- │
-- │ `reluare_nemotivata` primește deci termen ZERO, cu reperul pe data
-- │ evenimentului: „cel târziu în ziua în care omul s-a întors". În practică
-- │ inspectorii acceptă transmiterea în ziua curentă. Aplicația NU trebuie să
-- │ marcheze asta ca întârziere — un ecran care arată roșu pentru fiecare
-- │ revenire din absență ar învăța oamenii să ignore culoarea.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce tipuri noi de eveniment, dar NU operații noi de protocol ───────────
-- │ REGES nu cunoaște distincția: pentru Inspecția Muncii o suspendare din
-- │ absență e tot `SuspendareContract`, iar întoarcerea tot
-- │ `ReactivareContract`. Diferența e a NOASTRĂ, și e despre termen. Cele două
-- │ etichete noi din `reges_tip_eveniment` se mapează în `plan.ts` la aceleași
-- │ operații ca surorile lor — altfel am fi inventat un vocabular pe care
-- │ serverul de la ITM îl respinge.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce DOUĂ tranzacții în fișier ──────────────────────────────────────────
-- │ `alter type ... add value` poate rula într-o tranzacție pe Postgres 12+,
-- │ dar valoarea adăugată NU poate fi FOLOSITĂ până la commit. Secțiunea 2
-- │ inserează rânduri în `reges_termene` care poartă chiar etichetele noi,
-- │ deci trebuie să vină după un commit. Nu e o scăpare de stil.
-- └───────────────────────────────────────────────────────────────────────────

begin;

-- =====================================================================================
-- 1. Etichetele noi
-- =====================================================================================

alter type public.reges_tip_eveniment add value if not exists 'suspendare_nemotivata';
alter type public.reges_tip_eveniment add value if not exists 'reluare_nemotivata';

commit;

begin;

-- =====================================================================================
-- 2. Termenele lor
-- =====================================================================================
-- Rânduri de PLATFORMĂ (`organization_id is null`), ca toate celelalte. O firmă
-- care vrea altceva își pune propriul rând, fără deploy.

insert into public.reges_termene
  (organization_id, event_type, termen_zile, reper, zile_lucratoare, cod_revisal, descriere, valabil_de_la)
select null, 'suspendare_nemotivata', 3, 'data_eveniment', true, 'S',
       'În termen de cel mult 3 zile lucrătoare de la data suspendării — excepția prevăzută '
       'pentru absențele nemotivate, care nu pot fi anunțate în ziua anterioară (HG 905/2017)',
       date '2018-01-01'
 where not exists (
   select 1 from public.reges_termene t
    where t.organization_id is null
      and t.event_type = 'suspendare_nemotivata'
      and t.deleted_at is null
 );

insert into public.reges_termene
  (organization_id, event_type, termen_zile, reper, zile_lucratoare, cod_revisal, descriere, valabil_de_la)
select null, 'reluare_nemotivata', 0, 'data_eveniment', true, 'RA',
       'Cel târziu în ziua în care salariatul se prezintă la lucru. Legea nu prevede o '
       'excepție pentru reluare, iar regula generală (ziua anterioară) e imposibil de '
       'respectat la o întoarcere neanunțată',
       date '2018-01-01'
 where not exists (
   select 1 from public.reges_termene t
    where t.organization_id is null
      and t.event_type = 'reluare_nemotivata'
      and t.deleted_at is null
 );

-- =====================================================================================
-- 3. De unde vine suspendarea
-- =====================================================================================
-- Fără coloana asta, „contractul e suspendat pentru absență nemotivată" s-ar
-- deduce din `temei_legal`, adică dintr-un text liber scris de om. Detecția de
-- conflict la pontaj (v. nota A) are nevoie de un predicat, nu de o ghicitoare.

create type public.reges_sursa_suspendare as enum ('manuala', 'concediu', 'absenta_nemotivata');

alter table public.contract_suspendari
  add column if not exists sursa public.reges_sursa_suspendare not null default 'manuala';

comment on column public.contract_suspendari.sursa is
  'Cine a produs suspendarea. `concediu` = aprobarea unei cereri cu '
  '`leave_types.suspenda_contract`; `absenta_nemotivata` = decizie emisă de HR '
  'după constatarea absențelor; `manuala` = introdusă direct, inclusiv toate '
  'rândurile de dinainte de 0128.';

-- Rândurile existente vin toate din `decideCerere` (0125) — nu exista alt drum
-- care să scrie în tabelă. Se marchează ca atare, în loc să rămână „manuala",
-- care ar fi fals.
update public.contract_suspendari
   set sursa = 'concediu', updated_at = now()
 where sursa = 'manuala'
   and deleted_at is null
   and explicatie like 'Generată automat din cererea de concediu%';

-- =====================================================================================
-- 4. Note de proiectare
-- =====================================================================================
--
-- (A) DE CE NU SE SUSPENDĂ AUTOMAT DIN ZIUA ÎNTÂI
--     O absență de o zi are prea multe explicații nevinovate — telefon mort,
--     accident, urgență în familie — iar o suspendare transmisă la ITM și apoi
--     retrasă e o corecție de registru pe care o vede toată lumea. Aplicația
--     SEMNALEAZĂ de la a doua zi consecutivă și lasă decizia unui om, care o
--     emite pe un interval ales de el. Pragul stă în cod (`PRAG_ZILE_ALERTA`),
--     nu aici: e o convenție de produs, nu o regulă legală.
--
-- (B) INTERVALUL SE ÎNCHIDE LA ÎNTOARCERE, NU LA EMITERE
--     Suspendarea din absență se deschide cu `data_sfarsit` NULL: nimeni nu
--     știe când se întoarce omul, iar constrângerea de excludere tratează NULL
--     ca „infinity", deci intervalul rămâne deschis și blochează corect o a
--     doua suspendare suprapusă. Se închide când pontajul primește ore lucrate
--     — momentul în care aplicația află, prima, că omul e înapoi.
--
-- (C) O SERIE CONTINUĂ = O SINGURĂ SUSPENDARE
--     Nu una pe zi. Constrângerea `contract_suspendari_fara_suprapunere` o
--     impune oricum la nivel de bază: a doua încercare pe același interval
--     cade cu 23P01.

commit;
