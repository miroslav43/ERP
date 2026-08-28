-- supabase/migrations/0096_pontaj_rapid.sql
--
-- PONTAREA DINTR-O ATINGERE — programul firmei, modul de pontare și dovada de
-- prezență, ca angajatul să nu mai tasteze două ore pe un ecran de telefon.
--
-- ── PROBLEMA ─────────────────────────────────────────────────────────────────
-- Ca să-și înregistreze o zi normală, angajatul deschide ziua, completează două
-- selectoare native de oră și salvează: patru atingeri de intenție, care pe
-- Android devin unsprezece-douăsprezece cu rotițele de ore și minute. Pentru un
-- om care intră la 7 dimineața pe șantier, ecranul ăsta e motivul pentru care
-- pontajul îl completează altcineva, din memorie, la sfârșit de lună.
--
-- Ce lipsea din SCHEMĂ ca să se poată altfel: nicăieri, în toată baza, nu scrie
-- LA CE ORĂ ÎNCEPE PROGRAMUL. `attendance_settings` știe câte ore are ziua
-- (`ore_pe_zi`), cât e pauza și când începe noaptea — dar nu ora de început.
-- `contracts.norma_ore_zi` dă tot durata, nu ora. Un buton „Confirm ziua
-- 08:00–16:30" n-avea de unde lua 08:00.
--
-- ── DE CE `program_start` SINGUR, FĂRĂ `program_sfarsit` ─────────────────────
-- Ora de sfârșit se DERIVĂ, nu se stochează: `intervalulPropus()` din
-- `src/domain/attendance/calcul-ore.ts` o calculează din `ore_pe_zi` plus
-- regulile de pauză, ca inversă exactă a lui `oreleZilei()`. Stocată, ar fi a
-- doua sursă de adevăr pentru aceeași cifră: cine schimbă `ore_pe_zi` de la 8 la
-- 6 și uită să miște sfârșitul ar produce zile cu două ore suplimentare pentru
-- toată firma, tăcut. Aceeași regulă ca la `ore_planificate` în 0081 — aritmetica
-- stă într-un singur loc, iar acela e stratul de domeniu.
--
-- ── DE CE IMPLICITUL E `oprit` ───────────────────────────────────────────────
-- Nicio firmă existentă nu-și schimbă comportamentul la aplicarea migrării.
-- Butonul apare abia după ce cineva completează programul și alege modul din
-- `/pontaj/setari`. Aceeași disciplină pe care 0066 și 0080 și-o impun în scris:
-- o migrare care aprinde tăcut o cale nouă de scriere pe organizații care deja
-- calculează salarii e mai rea decât lipsa funcției.
--
-- ── DOVADA DE PREZENȚĂ: COD QR, NU GEOLOCAȚIE ────────────────────────────────
-- `cod_pontaj` pe punctul de lucru e un token opac, tipărit pe un afiș lipit la
-- intrare. Verifică apropierea fizică FĂRĂ permisiune de sistem, fără coordonate
-- și fără nicio discuție de date personale. Se spune totuși pe față, ca nimeni
-- să nu-l citească greșit: codul dovedește că cineva a fost lângă afiș, nu că
-- angajatul era acolo. E o frână, nu o probă — pontajul rămâne o DECLARAȚIE a
-- angajatului, exact ca formularul de azi.
--
-- ── CONSTRÂNGEREA CARE TRANSFORMĂ O TĂCERE ÎN EROARE ────────────────────────
-- `aprobaPontajBloc` mătură toate liniile neaprobate ale perioadei, fără niciun
-- filtru. O zi deschisă cu ceasul la 07:32 și neînchisă încă poate fi înghețată
-- la prânz; UPDATE-ul de la ora 17 („Am ieșit") e apoi respins de clauza `USING`
-- a politicii — ZERO rânduri, FĂRĂ eroare. Constrângerea de mai jos face ca
-- aprobarea unei zile neîncheiate să cadă cu 23514 în loc să reușească tăcut.
-- Acțiunea sare oricum peste zilele în curs și le raportează; constrângerea e
-- plasa de sub ea, în bază, unde nu poate fi ocolită de o cale de scriere nouă.
--
-- Se adaugă VALID, fără `not valid`: la scrierea migrării, toate cele 356 de
-- rânduri active au `ora_inceput` NULL, deci niciunul nu o atinge.
--
-- Forward-only: 0013, 0030, 0066, 0080 și 0081 NU se editează.
--
-- ⚠️ `program_start` NU e o valoare de drept al muncii — e programul declarat de
-- firmă. Restul parametrilor de pontaj rămân „DE VERIFICAT DE JURIST" ca în 0013.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Tipurile
-- =====================================================================================

-- Cele patru moduri, în ordinea în care cresc pretențiile față de angajat:
-- `oprit` (ca până acum), `confirmare` (o atingere pe zi), `ceas` (două),
-- `ambele` (firma le oferă pe amândouă și omul alege).
create type public.mod_pontare_rapida as enum ('oprit', 'confirmare', 'ceas', 'ambele');

comment on type public.mod_pontare_rapida is
  'Ce fel de pontare rapidă oferă firma în portalul angajatului. `oprit` = numai '
  'formularul cu interval, ca înainte de 0096.';

create type public.verificare_pontare as enum ('fara', 'cod_qr');

comment on type public.verificare_pontare is
  'Cum se verifică prezența la pontarea rapidă. `fara` = pe încredere, ca '
  'formularul de azi. `cod_qr` = angajatul scanează afișul de la punctul de lucru.';

-- `sursa` distingea până acum doar cine a SCRIS rândul din perspectiva
-- sistemului (manual, import, sincronizare), nu și dacă l-a pus angajatul de pe
-- telefon sau responsabilul de pontaj din foaia colectivă. Distincția trăia doar
-- în `audit_logs`, adică nicăieri unde un raport să o poată număra. Contează
-- pentru „câți oameni se pontează singuri" și pentru orice contestație.
alter type public.attendance_entry_source add value if not exists 'pontare_rapida';

-- =====================================================================================
-- 2. Programul și modul, pe setările de pontaj
-- =====================================================================================

alter table public.attendance_settings
  add column if not exists program_start        time,
  add column if not exists mod_pontare_rapida   public.mod_pontare_rapida not null default 'oprit',
  add column if not exists verificare_pontare   public.verificare_pontare not null default 'fara';

comment on column public.attendance_settings.program_start is
  'Ora la care începe programul obișnuit. NULLABLE: firmele care n-au un program '
  'fix nu sunt obligate să inventeze unul, iar butonul de confirmare a zilei nu '
  'se afișează fără el. Ora de sfârșit NU se stochează — se derivă din '
  '`ore_pe_zi` și din regulile de pauză în src/domain/attendance/calcul-ore.ts.';

comment on column public.attendance_settings.mod_pontare_rapida is
  'Implicit `oprit`: aplicarea migrării nu schimbă comportamentul niciunei firme '
  'existente. Modul `confirmare` și `ambele` cer în plus `program_start`.';

comment on column public.attendance_settings.verificare_pontare is
  'Implicit `fara`. Cu `cod_qr`, pontarea rapidă se face prin scanarea afișului '
  'de la punctul de lucru, iar `attendance_entries.punct_lucru_id` reține unde.';

-- =====================================================================================
-- 3. Codul de pe afișul punctului de lucru
-- =====================================================================================

alter table public.puncte_lucru
  add column if not exists cod_pontaj text;

alter table public.puncte_lucru
  drop constraint if exists puncte_lucru_cod_pontaj_len;

-- Token opac, generat de aplicație. Lungimea minimă ține departe coduri
-- ghicibile; cea maximă e o limită de bun-simț pentru un URL tipărit.
alter table public.puncte_lucru
  add constraint puncte_lucru_cod_pontaj_len
  check (cod_pontaj is null or char_length(cod_pontaj) between 16 and 64);

-- Unicitate GLOBALĂ, nu pe organizație: codul se rezolvă din URL-ul scanat,
-- ÎNAINTE de a ști în ce firmă suntem. Un cod care s-ar putea repeta între firme
-- ar face rezolvarea ambiguă exact în punctul în care nu există încă tenant.
create unique index if not exists puncte_lucru_cod_pontaj_uq
  on public.puncte_lucru (cod_pontaj)
  where cod_pontaj is not null and deleted_at is null;

comment on column public.puncte_lucru.cod_pontaj is
  'Tokenul de pe afișul tipărit, pentru pontarea prin cod QR. Rotirea lui '
  'invalidează afișele vechi. NU e o probă de prezență a persoanei — dovedește '
  'doar că cineva a fost lângă afiș.';

-- =====================================================================================
-- 4. Unde s-a pontat, și plasa de sub aprobare
-- =====================================================================================

alter table public.attendance_entries
  add column if not exists punct_lucru_id uuid references public.puncte_lucru (id);

-- Index PARȚIAL, ca toate celelalte din 0013: rândurile fără punct de lucru sunt
-- majoritatea și n-au ce căuta în index.
create index if not exists attendance_entries_punct_lucru_idx
  on public.attendance_entries (organization_id, punct_lucru_id)
  where punct_lucru_id is not null and deleted_at is null;

comment on column public.attendance_entries.punct_lucru_id is
  'Punctul de lucru al cărui cod QR a fost scanat la pontare. NULL când firma '
  'pontează pe încredere sau când ziua a fost scrisă din foaia colectivă.';

alter table public.attendance_entries
  drop constraint if exists attendance_entries_aprobare_zi_incheiata_ck;

alter table public.attendance_entries
  add constraint attendance_entries_aprobare_zi_incheiata_ck
  check (approved_at is null or ora_inceput is null or ora_sfarsit is not null);

comment on constraint attendance_entries_aprobare_zi_incheiata_ck on public.attendance_entries is
  'O zi deschisă cu ceasul și neînchisă încă NU poate fi aprobată. Fără ea, '
  'aprobarea în bloc îngheață ziua la prânz, iar „Am ieșit" de la ora 17 e '
  'respins de politica de UPDATE cu zero rânduri și fără nicio eroare.';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce nicio politică RLS nouă: nu se creează nicio tabelă. Coloanele adăugate
--   moștenesc politicile existente ale tabelelor lor — `attendance_settings`
--   (0013), `attendance_entries` (0013), `puncte_lucru` (0030) — iar granturile
--   sunt pe tabelă, nu pe coloană. Nimic de atașat, nimic de repetat.
--
-- · De ce `cod_pontaj` stă pe `puncte_lucru` și NU se citește din portal:
--   politica `puncte_lucru_select` (0030) cere `departments:read <> 'none'`, iar
--   rolul `employee` n-are NICIO permisiune pe `departments` (0002:1206-1219).
--   Deci angajatul nu poate și nu trebuie să poată citi tabela. Rezolvarea
--   codului scanat se face în Server Action, cu clientul admin și cu filtru
--   explicit pe `organization_id` — singurul tipar permis de ESLint pentru
--   ocolirea RLS, și același pe care `salveazaZiPontaj` îl folosește deja ca
--   să-și găsească propria fișă.
--
-- · De ce `ore_lucrate` NU devine nullable pentru ziua în curs: e `not null
--   default 0` din 0013 și rămâne așa. Ziua deschisă se scrie cu ZERO explicit.
--   `null` ar trece de `tsc` (tipul generat marchează coloana opțională, nu
--   nullabilă) și ar cădea cu 23502 abia la runtime.
--
-- · Ce NU rezolvă migrarea asta: tura care trece de miezul nopții. Modelul are un
--   rând pe zi și ore de tip `time`, fără dată; `oreleZilei` întoarce null când
--   sfârșitul e înaintea începutului. Acoperirea ar cere schimbarea modelului
--   (data ieșirii sau `timestamptz`) și ar atinge tot lanțul de salarizare
--   (0049:82). Rămâne deliberat în afara scopului, cu refuzul explicit păstrat.
