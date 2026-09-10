-- supabase/migrations/0138_saptamana_devine_pontaj.sql
-- Săptămâna aprobată devine PONTAJ, nu rămâne o declarație de intenție.
--
-- ┌ Ce s-a descoperit din uz ─────────────────────────────────────────────────
-- │ `attendance_week_submissions` (0041) a fost construit ca PLAN: ce ai de gând
-- │ să lucrezi. Faptul se scria separat, zi cu zi, în `attendance_entries`.
-- │
-- │ Numai că, pentru firma care îl folosește, formularul acela ESTE fișa de
-- │ pontaj a săptămânii. Ecranul stă sub „Pontaj", butonul spune „Trimite spre
-- │ aprobare", aprobarea vine — și nu se întâmpla nimic. Calendarul rămânea
-- │ gol, iar salarizarea, care citește `attendance_entries`, număra zero ore
-- │ pentru o lună întreagă declarată și aprobată.
-- │
-- │ Verificat pe baza reală înainte de a scrie migrarea: două submisii
-- │ `aprobata`, zero intrări de pontaj produse de ele. Singura intrare manuală
-- │ a angajatului era din 31 august.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce la APROBARE, și nu la trimitere ────────────────────────────────────
-- │ Trimiterea rămâne o declarație; aprobarea o face fapt. O săptămână respinsă
-- │ nu lasă atunci nicio oră în salarizare — pe când, scrise la trimitere, ele
-- │ ar fi trebuit RETRASE la respingere, iar retragerea unei ore deja intrate
-- │ într-un stat de plată e mult mai scumpă decât neintrarea ei.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce o SURSĂ nouă, și nu `manuala` ──────────────────────────────────────
-- │ `sursa` există tocmai ca „cine a scris rândul" să poată fi NUMĂRAT într-un
-- │ raport, nu doar citit din `audit_logs` (v. nota lui `pontare_rapida`, 0096).
-- │ O zi venită dintr-o săptămână aprobată are altă natură decât una tastată de
-- │ responsabilul de pontaj: a trecut printr-o aprobare, are un document în
-- │ spate, și se corectează în alt loc.
-- │
-- │ Distincția are și un rol mecanic: sincronizarea concediilor sare peste
-- │ zilele cu `sursa <> 'sincronizare_concedii'`, iar scrierea de aici va trebui
-- │ să facă simetric — să nu calce peste o zi pe care omul a pontat-o el însuși.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Migrarea adaugă DOAR eticheta. Scrierea propriu-zisă e cod, în
-- `decideSaptamanaPontaj` — aici nu se poate face, fiindcă `alter type … add
-- value` nu permite folosirea valorii în aceeași tranzacție.

begin;

alter type public.attendance_entry_source add value if not exists 'saptamana';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
--
-- (A) O SINGURĂ INSTRUCȚIUNE, O SINGURĂ TRANZACȚIE
--     `alter type … add value` poate rula într-o tranzacție pe Postgres 12+,
--     dar valoarea adăugată nu poate fi FOLOSITĂ până la commit. Nu există aici
--     nimic care s-o folosească, deci fișierul rămâne cu un singur bloc — spre
--     deosebire de 0128, unde secțiunea a doua chiar insera rânduri cu
--     etichetele noi și a avut nevoie de două tranzacții.
--
-- (B) NIMIC RETROACTIV
--     Cele două săptămâni deja aprobate NU se transformă în pontaj de aici.
--     Una dintre ele e în octombrie, deci în viitor; cealaltă acoperă zile care
--     au trecut fără ca nimeni să le fi pontat. A le scrie acum ar însemna să
--     declarăm ore lucrate pe baza unei intenții vechi, în luni care pot fi deja
--     închise. Se refac din ecran, prin retrimitere și reaprobare, dacă chiar
--     descriu ce s-a lucrat.
--
-- (C) CE NU DEVINE PONTAJ
--     Zilele fără interval. O zi lăsată goală în plan înseamnă „n-am lucrat",
--     iar absența unui rând în `attendance_entries` spune exact asta. Un rând cu
--     zero ore ar fi arătat, în foaia colectivă, ca o zi pontată la zero — altă
--     afirmație decât „nepontată".

