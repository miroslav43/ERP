-- supabase/migrations/0160_act_aditional_salariu.sql
--
-- ȘABLONUL ACTULUI ADIȚIONAL DE MODIFICARE A SALARIULUI.
--
-- „Modifică salariul" din fișa angajatului rescria `salariu_baza` pe contractul
-- de bază: niciun act adițional, nicio dată de aplicare, niciun eveniment
-- REGES. De acum acțiunea creează actul ca rând nou în `employment_contracts`
-- (`este_act_aditional = true`, legat de contract prin `parent_contract_id`) și
-- emite documentul din șablonul de mai jos.
--
-- Doar date, nicio schimbare de structură: `hr_document_templates` +
-- `genereazaDocument` (`src/lib/documents/generator.ts`) fac deja randarea,
-- numerotarea pe serie, amprenta și înregistrarea în registrul general (0120).
--
-- ── ⚠️ TEXTUL NU E AVIZAT JURIDIC ───────────────────────────────────────────
-- Aceeași convenție ca la 0100: plauzibil pentru dreptul român (art. 17 și
-- art. 41 din Codul muncii — modificarea contractului prin acordul părților),
-- dar NEVERIFICAT de un jurist. Firma îl poate suprascrie din
-- /angajati/sabloane-documente; varianta ei are prioritate (`generator.ts`).
--
-- ── VARIABILELE ─────────────────────────────────────────────────────────────
-- Fiecare `{{…}}` are corespondent în `valoriActAditionalSalariu`
-- (`src/lib/documents/valori-inrolare.ts`); `valori-inrolare.test.ts` citește
-- lista de mai jos din acest fișier și o compară cu harta.
--
-- ── SERIA ───────────────────────────────────────────────────────────────────
-- AAS, nouă și distinctă: `hr_issued_documents` numerotează pe
-- `(organization_id, serie)`. Numărul ACTULUI (cel scris pe contract, „42/2026-AA1")
-- e altceva — stă în `employment_contracts.numar`, iar documentul îl tipărește
-- prin `{{numar_act_aditional}}`.
--
-- Se poate aplica oricând, înaintea codului: până urcă acțiunea nouă, nimic nu
-- cere șablonul.

\set ON_ERROR_STOP on

begin;

insert into public.hr_document_templates
  (organization_id, cod, denumire, descriere, continut_html, variabile, serie)
values
  (null, 'act_aditional_salariu', 'Act adițional — modificarea salariului',
   'Emis automat la modificarea salariului din fișa angajatului. ⚠️ Model neverificat juridic — de confirmat de jurist.',
   '<h1>ACT ADIȚIONAL NR. {{numar_act_aditional}}</h1>' ||
   '<p>din {{data_act_aditional}}, la contractul individual de muncă nr. {{numar_contract}} din ' ||
   '{{data_contract}}</p>' ||
   '<p>Încheiat între {{organizatie_denumire}}, reprezentată legal prin {{reprezentant_legal}}, în ' ||
   'calitate de Angajator, și {{angajat_nume}}, încadrat(ă) în funcția de {{functie}}, în calitate ' ||
   'de Salariat.</p>' ||
   '<h2>1. Obiectul actului adițional</h2>' ||
   '<p>Părțile convin, potrivit art. 17 și art. 41 din Legea nr. 53/2003 — Codul muncii, ' ||
   'modificarea elementului privind salariul din contractul individual de muncă.</p>' ||
   '<h2>2. Salariul</h2>' ||
   '<p>Începând cu data de {{data_aplicarii}}, salariul de bază lunar brut se modifică de la ' ||
   '{{salariu_vechi}} la {{salariu_nou}}.</p>' ||
   '<h2>3. Dispoziții finale</h2>' ||
   '<p>Celelalte clauze ale contractului individual de muncă rămân neschimbate. Prezentul act ' ||
   'adițional face parte integrantă din contract și s-a încheiat în două exemplare, câte unul ' ||
   'pentru fiecare parte.</p>' ||
   '<p>Angajator: {{organizatie_denumire}} &nbsp;&nbsp;&nbsp; Salariat: {{angajat_nume}}</p>',
   '["numar_act_aditional","data_act_aditional","numar_contract","data_contract","organizatie_denumire","reprezentant_legal","angajat_nume","functie","salariu_vechi","salariu_nou","data_aplicarii"]'::jsonb,
   'AAS')
on conflict do nothing;

commit;
