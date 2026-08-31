-- supabase/migrations/0117_modul_asistent.sql
-- „Asistent AI" ca modul opțional, cu comutator per firmă-client.
--
-- Modulul nu adaugă nicio tabelă și nicio politică: asistentul e READ-ONLY și
-- citește exclusiv prin funcțiile de citire existente, cu clientul de sesiune,
-- deci sub RLS-ul celui care întreabă. Singurul lucru care lipsea era rândul de
-- catalog, ca modulul să apară în consola de platformă lângă celelalte
-- șaisprezece și să poată fi stins pentru o firmă care nu-l plătește.
--
-- Grupul e `core`, nu `communication`: asistentul nu e un canal de comunicare
-- între oameni, ci o poartă către restul aplicației — răspunde despre Pontaj,
-- Concedii și Salarizare deopotrivă. `is_core` rămâne însă `false`, fiindcă
-- aplicația funcționează întreagă fără el; `nucleu` e singurul care nu poate fi
-- stins.
--
-- `sort_order = 200` îl pune ultimul în listă, după `ticketing` (140), ca
-- ordinea existentă a comutatoarelor să nu se rearanjeze sub degetele nimănui.
--
-- Al doilea comutator, INDEPENDENT de ăsta, e `OPENROUTER_API_KEY` din mediu:
-- cheie goală ⇒ `/api/asistent` răspunde 404 și bula nu se randează nicăieri,
-- indiferent ce scrie în `organization_features`. Cele două se compun cum
-- trebuie — platforma decide dacă serviciul EXISTĂ, firma decide dacă îl
-- FOLOSEȘTE.

insert into public.features (feature_key, denumire, descriere, icon, grup, is_core, sort_order)
values (
  'asistent', 'Asistent AI',
  'Asistent conversațional care explică ecranele aplicației și trimite direct la pagina potrivită, filtrat pe permisiunile celui care întreabă.',
  'sparkles', 'core', false, 200
)
on conflict (feature_key) do nothing;
