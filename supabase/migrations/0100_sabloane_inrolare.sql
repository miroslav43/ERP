-- supabase/migrations/0100_sabloane_inrolare.sql
--
-- TREI ȘABLOANE NOI, PE MECANICA CARE EXISTĂ DEJA.
--
-- La înrolare se generau două documente din cinci: contractul de muncă și fișa
-- postului (`0033_inrolare_unificata.sql`, chemate din `angajati/nou/actions.ts`).
-- Lipseau acordul de confidențialitate, anexa de proprietate intelectuală și
-- actul adițional de telemuncă.
--
-- Nu se construiește nimic nou: `hr_document_templates` + `genereazaDocument`
-- (`src/lib/documents/generator.ts`) fac deja căutarea șablonului, randarea
-- `{{variabilelor}}`, numerotarea pe serie cu retry pe coliziune, amprenta
-- SHA-256 și codul de verificare. Aici intră doar textele și seriile.
--
-- ── ⚠️ TEXTELE NU SUNT AVIZATE JURIDIC ──────────────────────────────────────
-- Sunt plauzibile pentru dreptul român și acoperă clauzele uzuale, dar NU au
-- trecut pe la un jurist. Aceeași convenție ca la valorile din `NOTES.md` §3:
-- marcajul ⚠️ înseamnă „nu folosi în producție până nu confirmă juristul".
-- Fiecare firmă își poate suprascrie oricare șablon — `genereazaDocument` dă
-- prioritate variantei organizației peste seed-ul de platformă
-- (`generator.ts:77`), fără nicio migrare.
--
-- ── DE CE SEED DE PLATFORMĂ (`organization_id = null`) ──────────────────────
-- La fel ca adeverințele (0004) și ca CIM-ul (0033): o firmă nouă are documentele
-- din prima zi, fără niciun pas de configurare. Indexul unic
-- `hr_templates_platform_uniq` face `on conflict do nothing` idempotent.
--
-- ── DE CE VARIABILELE SUNT PUȚINE ───────────────────────────────────────────
-- `randeaza()` (`generator.ts:36-44`) tratează cheia ABSENTĂ exact ca pe una
-- goală, iar `genereazaDocument` ARUNCĂ la prima variabilă fără valoare. O
-- singură variabilă neacoperită de adaptor face să cadă 100% din emiterile
-- documentului — nu ocazional. Fiecare `{{…}}` de mai jos are corespondent în
-- `src/lib/documents/valori-inrolare.ts`, iar `valori-inrolare.test.ts` compară
-- cele două liste, per cod de șablon.
--
-- Forward-only: 0004 și 0033 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Tipurile de document lipsă din catalog
-- =====================================================================================
-- `cim`, `act_aditional` și `fisa_post` există din 0004; `acord_telemunca` din
-- 0005. Lipseau doar acestea două.

insert into public.employee_document_types
  (organization_id, cod, denumire, cere_valabilitate, confidential_implicit, vizibil_angajatului_implicit, ordine)
values
  (null, 'nda', 'Acord de confidențialitate', false, true, true, 35),
  (null, 'anexa_pi', 'Anexă proprietate intelectuală', false, true, true, 36)
on conflict do nothing;

-- =====================================================================================
-- 2. Acordul de confidențialitate
-- =====================================================================================

insert into public.hr_document_templates
  (organization_id, cod, denumire, descriere, continut_html, variabile, serie)
values
  (null, 'nda', 'Acord de confidențialitate',
   'Generat automat la înrolare. ⚠️ Model neverificat juridic — de confirmat de jurist.',
   '<h1>ACORD DE CONFIDENȚIALITATE</h1>' ||
   '<p>Încheiat astăzi, {{data_document}}, între {{organizatie_denumire}}, reprezentată legal ' ||
   'prin {{reprezentant_legal}}, în calitate de Angajator, și {{angajat_nume}}, CNP {{cnp_complet}}, ' ||
   'încadrat(ă) în funcția de {{functie}}, în calitate de Salariat.</p>' ||
   '<h2>1. Obiectul acordului</h2>' ||
   '<p>Salariatul se obligă să păstreze confidențialitatea asupra tuturor informațiilor de care ia ' ||
   'cunoștință în cursul executării contractului individual de muncă și care nu au caracter public.</p>' ||
   '<h2>2. Informații confidențiale</h2>' ||
   '<p>Intră sub incidența prezentului acord, fără ca enumerarea să fie limitativă: datele ' ||
   'comerciale și financiare ale Angajatorului, listele de clienți și furnizori, prețurile și ' ||
   'condițiile contractuale, procedurile interne, datele cu caracter personal ale colegilor și ' ||
   'ale clienților, precum și orice informație marcată drept confidențială.</p>' ||
   '<h2>3. Durata</h2>' ||
   '<p>Obligația de confidențialitate produce efecte pe toată durata contractului individual de ' ||
   'muncă și încă {{durata_confidentialitate}} de la încetarea acestuia, indiferent de motivul încetării.</p>' ||
   '<h2>4. Excepții</h2>' ||
   '<p>Nu constituie încălcare a prezentului acord divulgarea informațiilor care sunt publice fără ' ||
   'culpa Salariatului, cele comunicate la solicitarea unei autorități competente, în condițiile ' ||
   'legii, și cele a căror divulgare este protejată de legislația privind avertizarea în interes public.</p>' ||
   '<h2>5. Răspundere</h2>' ||
   '<p>Încălcarea obligației de confidențialitate atrage răspunderea disciplinară, civilă sau penală ' ||
   'a Salariatului, în condițiile legii.</p>' ||
   '<p>Prezentul acord s-a încheiat în două exemplare, câte unul pentru fiecare parte.</p>' ||
   '<p>Angajator: {{organizatie_denumire}} &nbsp;&nbsp;&nbsp; Salariat: {{angajat_nume}}</p>',
   '["data_document","organizatie_denumire","reprezentant_legal","angajat_nume","cnp_complet","functie","durata_confidentialitate"]'::jsonb,
   'NDA')
on conflict do nothing;

-- =====================================================================================
-- 3. Anexa de proprietate intelectuală
-- =====================================================================================
-- ⚠️ Zona cea mai delicată juridic din cele trei: art. 44 din Legea 8/1996 dă
-- drepturile patrimoniale angajatorului doar în lipsă de clauză contrară și
-- doar pe termen limitat, iar programele pentru calculator au regim propriu
-- (art. 74). Textul de mai jos alege varianta uzuală — cesiune către angajator
-- pentru operele create în exercitarea atribuțiilor — dar CERE confirmarea unui
-- jurist înainte de folosire reală.

insert into public.hr_document_templates
  (organization_id, cod, denumire, descriere, continut_html, variabile, serie)
values
  (null, 'anexa_proprietate_intelectuala', 'Anexă privind drepturile de proprietate intelectuală',
   'Generată automat la înrolare. ⚠️ Model neverificat juridic — de confirmat de jurist.',
   '<h1>ANEXĂ PRIVIND DREPTURILE DE PROPRIETATE INTELECTUALĂ</h1>' ||
   '<p>la contractul individual de muncă nr. {{numar_contract}} din {{data_contract}}</p>' ||
   '<p>Încheiată astăzi, {{data_document}}, între {{organizatie_denumire}}, reprezentată legal prin ' ||
   '{{reprezentant_legal}}, în calitate de Angajator, și {{angajat_nume}}, încadrat(ă) în funcția de ' ||
   '{{functie}}, în calitate de Salariat.</p>' ||
   '<h2>1. Obiect</h2>' ||
   '<p>Prezenta anexă reglementează regimul drepturilor de proprietate intelectuală asupra ' ||
   'rezultatelor create de Salariat în exercitarea atribuțiilor de serviciu sau după instrucțiunile ' ||
   'Angajatorului.</p>' ||
   '<h2>2. Drepturi patrimoniale</h2>' ||
   '<p>Drepturile patrimoniale de autor asupra operelor create de Salariat în exercitarea ' ||
   'atribuțiilor de serviciu aparțin Angajatorului, în condițiile art. 44 din Legea nr. 8/1996 ' ||
   'privind dreptul de autor și drepturile conexe. Pentru programele pentru calculator se aplică ' ||
   'art. 74 din aceeași lege.</p>' ||
   '<h2>3. Drepturi morale</h2>' ||
   '<p>Drepturile morale de autor rămân ale Salariatului și sunt inalienabile, potrivit legii.</p>' ||
   '<h2>4. Invenții de serviciu</h2>' ||
   '<p>Invențiile realizate de Salariat în îndeplinirea atribuțiilor de serviciu urmează regimul ' ||
   'Legii nr. 83/2014 privind invențiile de serviciu, inclusiv în ceea ce privește obligația de ' ||
   'informare a Angajatorului și dreptul la o remunerație suplimentară.</p>' ||
   '<h2>5. Creații din afara atribuțiilor</h2>' ||
   '<p>Creațiile realizate de Salariat în afara atribuțiilor de serviciu, fără folosirea resurselor ' ||
   'Angajatorului, rămân în întregime ale Salariatului.</p>' ||
   '<p>Prezenta anexă face parte integrantă din contractul individual de muncă și s-a încheiat în ' ||
   'două exemplare.</p>' ||
   '<p>Angajator: {{organizatie_denumire}} &nbsp;&nbsp;&nbsp; Salariat: {{angajat_nume}}</p>',
   '["numar_contract","data_contract","data_document","organizatie_denumire","reprezentant_legal","angajat_nume","functie"]'::jsonb,
   'API')
on conflict do nothing;

-- =====================================================================================
-- 4. Actul adițional de telemuncă
-- =====================================================================================
-- Se generează DOAR pentru `work_mode in ('telemunca','domiciliu','mixt')` —
-- decizia stă în adaptor, nu aici: un șablon nu poate ști contextul.

insert into public.hr_document_templates
  (organization_id, cod, denumire, descriere, continut_html, variabile, serie)
values
  (null, 'act_aditional_telemunca', 'Act adițional — clauza de telemuncă',
   'Generat automat la înrolare, doar pentru telemuncă, muncă la domiciliu sau regim mixt. ⚠️ Model neverificat juridic — de confirmat de jurist.',
   '<h1>ACT ADIȚIONAL LA CONTRACTUL INDIVIDUAL DE MUNCĂ</h1>' ||
   '<p>Nr. {{numar_contract}} din {{data_contract}} — clauza de telemuncă</p>' ||
   '<p>Încheiat între {{organizatie_denumire}}, reprezentată legal prin {{reprezentant_legal}}, în ' ||
   'calitate de Angajator, și {{angajat_nume}}, încadrat(ă) în funcția de {{functie}}, în calitate ' ||
   'de Telesalariat.</p>' ||
   '<h2>1. Regimul de lucru</h2>' ||
   '<p>Începând cu data de {{data_intrare_vigoare}}, activitatea se desfășoară în regim de ' ||
   '{{mod_lucru}}, cu o durată a muncii de {{norma_ore_saptamana}} ore pe săptămână.</p>' ||
   '<h2>2. Locul desfășurării activității</h2>' ||
   '<p>Telesalariatul își desfășoară activitatea la: {{loc_telemunca}}. Schimbarea locului convenit ' ||
   'se face prin acordul scris al părților.</p>' ||
   '<h2>3. Programul și evidența timpului de muncă</h2>' ||
   '<p>Părțile convin ca Telesalariatul să își organizeze programul de lucru cu respectarea duratei ' ||
   'legale a muncii și a perioadelor de repaus. Evidența orelor lucrate se ține potrivit ' ||
   'procedurilor interne ale Angajatorului.</p>' ||
   '<h2>4. Securitate și sănătate în muncă</h2>' ||
   '<p>Angajatorul asigură instruirea Telesalariatului în domeniul securității și sănătății în ' ||
   'muncă, potrivit Legii nr. 81/2018 privind reglementarea activității de telemuncă. ' ||
   'Telesalariatul răspunde de respectarea instrucțiunilor primite.</p>' ||
   '<h2>5. Echipamente și cheltuieli</h2>' ||
   '<p>Echipamentele necesare desfășurării activității se asigură potrivit procedurilor interne. ' ||
   'Eventuala indemnizație de telemuncă se acordă în condițiile și în limitele prevăzute de lege ' ||
   'și de regulamentul intern.</p>' ||
   '<h2>6. Drepturi egale</h2>' ||
   '<p>Telesalariatul beneficiază de toate drepturile recunoscute prin lege, prin regulamentul ' ||
   'intern și prin contractul colectiv de muncă aplicabil salariaților care lucrează la sediul ' ||
   'Angajatorului.</p>' ||
   '<p>Celelalte clauze ale contractului individual de muncă rămân neschimbate. Prezentul act ' ||
   'adițional s-a încheiat în două exemplare.</p>' ||
   '<p>Angajator: {{organizatie_denumire}} &nbsp;&nbsp;&nbsp; Telesalariat: {{angajat_nume}}</p>',
   '["numar_contract","data_contract","organizatie_denumire","reprezentant_legal","angajat_nume","functie","mod_lucru","loc_telemunca","data_intrare_vigoare","norma_ore_saptamana"]'::jsonb,
   'AAT')
on conflict do nothing;

-- =====================================================================================
-- 5. Note de proiectare
-- =====================================================================================
--
-- SERIILE sunt noi și distincte — NDA, API, AAT — fiindcă `hr_issued_documents`
-- numerotează pe `(organization_id, serie)`. Puse pe seria CIM, cele trei ar fi
-- consumat numere din registrul contractelor de muncă.
--
-- ACTUALIZAREA ȘABLONULUI CIM (adăugarea lui `{{loc_munca}}` și a datelor din
-- actul de identitate) NU e aici. Stă în 0101, deliberat: un UPDATE pe seed-ul
-- de platformă intră în vigoare INSTANTANEU pentru aplicația care rulează, iar
-- baza e una singură pentru dezvoltare și producție. Până urcă și codul care
-- furnizează variabilele noi, fiecare înrolare ar ieși fără contract. Migrarea
-- aceasta se poate aplica oricând; 0101 se aplică DUPĂ deploy.

commit;
