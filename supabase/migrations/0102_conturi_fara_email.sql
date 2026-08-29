-- supabase/migrations/0102_conturi_fara_email.sql
--
-- CONTURI PENTRU ANGAJAȚII CARE N-AU ADRESĂ DE E-MAIL — plus adresa de serviciu,
-- pentru cei care au una de la firmă.
--
-- ── PROBLEMA, MĂSURATĂ ───────────────────────────────────────────────────────
-- Contul se creează EXCLUSIV prin invitație, iar `invitations.email` e
-- `citext not null` (0001:213). Un angajat fără adresă de e-mail nu poate fi
-- invitat, deci nu poate avea cont, deci nu poate deschide aplicația de pe
-- telefon. La scrierea migrării, 4 din 11 angajați activi n-aveau `user_id` —
-- iar publicul-țintă al pontării dintr-o atingere e exact acela.
--
-- ── DE CE `invitations.email` RĂMÂNE `not null` ──────────────────────────────
-- Pare că soluția evidentă e s-o facem nullabilă. NU este, și motivul e mai
-- adânc decât schema noastră: Supabase Auth are nevoie de o adresă ca să existe
-- un cont cu parolă, iar `accept_invitation` (0002) rulează CA UTILIZATOR și
-- compară `auth.email()` cu adresa din invitație. O invitație fără adresă n-ar
-- avea cu ce să se potrivească.
--
-- Deci „fără e-mail" înseamnă, în realitate, „cu o adresă SINTETICĂ", generată
-- din marca angajatului și din slug-ul firmei:
--
--     marca-0042@hala-nord.administrativo.intern
--
-- E un NUME DE UTILIZATOR care arată ca o adresă, nu o cutie poștală. Nu se
-- trimite nimic acolo și nu se așteaptă nimic de acolo. Angajatul primește pe
-- hârtie un link (cu cod QR) și adresa asta, ca să se poată autentifica ulterior.
--
-- Domeniul `.intern` e rezervat de RFC 8375 pentru uz privat, exact ca să nu se
-- poată ciocni vreodată cu un domeniu real. `example.com` ar fi fost o adresă
-- LIVRABILĂ către un server care nu e al nostru.
--
-- ── CE ADAUGĂ MIGRAREA ───────────────────────────────────────────────────────
-- Doar `employees.email_serviciu`. Restul e cod: sinteza adresei, fișa de
-- invitație tipăribilă și alegerea „pe care adresă trimit".
--
-- ⚠️ Adresa sintetică e o decizie de PRODUS, nu una tehnică: angajatul se va
-- autentifica de acum înainte cu ea. Dacă firma preferă altă convenție (CNP,
-- număr de telefon), aici se schimbă.
--
-- Forward-only: 0001 și 0004 NU se editează.

\set ON_ERROR_STOP on

begin;

alter table public.employees
  add column if not exists email_serviciu text;

alter table public.employees
  drop constraint if exists employees_email_serviciu_format;

-- Aceeași verificare ca pentru `email_personal` (0004:206): destul cât să
-- prindă o greșeală de tastare, nu atât cât să respingă o adresă validă
-- neobișnuită. Validarea adevărată e că mesajul ajunge.
alter table public.employees
  add constraint employees_email_serviciu_format
  check (email_serviciu is null or email_serviciu ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

comment on column public.employees.email_serviciu is
  'Adresa de e-mail dată de firmă. Separată de `email_personal` fiindcă sunt '
  'lucruri diferite: una se ia înapoi la plecare, cealaltă nu. Invitația se '
  'trimite pe cea aleasă explicit de HR, nu pe „prima găsită".';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce NU un cod scurt separat pe `invitations`: ar fi un al doilea acreditiv
--   pentru același lucru. Tokenul există deja, e stocat doar ca hash (0001:216) și
--   ajunge la om printr-un link. Fișa tipărită poartă chiar acel link, ca text și
--   ca imagine (cod QR) — deci „codul" și „linkul" sunt același lucru, iar baza
--   n-are de păzit încă un secret.
--
-- · De ce nu se șterge nimic din fluxul de e-mail: pentru cei care AU adresă,
--   invitația prin e-mail rămâne calea normală. Fișa tipărită e rezerva — și
--   pentru cei fără adresă, și pentru cazul în care mesajul nu ajunge. Fluxul de
--   e-mail a fost reparat abia în 0091 și n-a fost încă probat pe volum:
--   `email_log` avea ZERO rânduri de la începutul proiectului.
