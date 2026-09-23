-- supabase/migrations/0148_acte_cu_valoare_probatorie.sql
--
-- CE SE SEMNEAZĂ, SE ÎNREGISTREAZĂ SAU SE DOVEDEȘTE NU SE MAI REScrie DIN CLIENT.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Lotul 4 din auditul „atinge frontendul baza direct?"
-- (`docs/audit-frontend-baza-2026-09-21.md`). Loturile 1-3 au închis ieșirile
-- dintre firme, marginea platformei și cifrele care ajung în salariu. Aici sunt
-- actele: contractul emis, fișa postului semnată, registrul Ordinului 217/1996,
-- dovezile de integrare, confirmările de citire. Toate au în comun că valoarea
-- lor stă în faptul că NU se mai schimbă după ce au fost făcute — iar asta era
-- scris până acum doar în Server Action.
--
-- ── (F04) ȘABLOANELE ȘI ACTELE EMISE ───────────────────────────────────────
-- `curataHtml()` rulează în acțiune; baza accepta orice. Un cont hr/org_admin
-- putea planta `<script>` într-un șablon — și fiecare document generat din el
-- rula scriptul la deschidere, în aceeași origine cu aplicația — sau putea
-- rescrie textul unui contract DEJA EMIS și recalcula amprenta SHA-256, adică
-- exact garanția pe care o vinde codul de verificare de pe document.
--
-- ── (F11) FIȘA POSTULUI ────────────────────────────────────────────────────
-- `job_descriptions_update` dădea angajatului drept deplin pe propriul rând:
-- își putea rescrie atribuțiile ȘI putea pune `semnat_de_angajat = true`,
-- `semnat_la` în trecut și un `semnatura_ip` inventat. Aplicația nu face NICIUN
-- update pe tabela asta (verificat: doar insert la înrolare și citiri), deci
-- privilegiul era pur teoretic — dar teoretic până în ziua în care cineva îl
-- folosește. Tiparul aplicat e cel din `0075_cursuri.sql:1414`: grant pe coloane,
-- semnătura scrisă din server.
--
-- ── (F35) REGISTRUL LEGAL ──────────────────────────────────────────────────
-- `internal.guard_registru_documente` îngheață numerotarea (an, număr, dată,
-- sens, tip) — corect — dar lăsa editabil CONȚINUTUL: rezumat, emitent,
-- destinatar, numărul și data documentului de la emitent. Un org_admin putea
-- transforma, după înregistrare, „Demisie" în „Cerere de concediu", păstrând
-- numărul. Într-un registru de intrări-ieșiri asta e chiar lucrul pe care
-- numerotarea îl garantează că nu se poate.
--
-- ── (F26) `inregistreaza_document_generat` ─────────────────────────────────
-- Poarta funcției e „cine poate genera documentul" (payroll:export sau
-- attendance:read), nu „cine poate scrie în registru". Rămâne așa — altfel
-- generarea unui fluturaș ar cere o permisiune pe care hr n-o are — dar nu mai
-- crede pe cuvânt ce i se dă: punctul de lucru trebuie să fie al firmei, iar
-- rezumatul e plafonat. Restul (validarea entității per tip) rămâne notat în
-- audit.
--
-- ── (F31, F32) DOVEZILE DE INTEGRARE ───────────────────────────────────────
-- `tip_dovada` spune dacă pasul cere document sau semnătură și vine din ȘABLON.
-- Era scriibil de la client, deci angajatul putea coborî cerința la „bifă" și
-- închide pasul fără dovadă. Iar `checklist_material_reads_insert` avea un
-- predicat tautologic — `ii.employee_id = ii.employee_id`, `ii.material_id =
-- ii.material_id` — deci pasul pe care se confirma citirea nu era verificat că
-- e chiar al celui care confirmă.
--
-- ── (F50) CONFIRMAREA DE CITIRE ────────────────────────────────────────────
-- `citit_la` venea de la client, deci se putea antedata: o confirmare de lectură
-- a regulamentului scrisă cu o zi înaintea publicării lui nu mai e probă de
-- nimic.
--
-- ── CE NU ATINGE, DELIBERAT ─────────────────────────────────────────────────
-- 1. F48 (managerul bifează lecția de test a subalternului) nu e aici: ramura e
--    scrisă intenționat în 0075 („administrator/manager care bifează în locul
--    cuiva") și schimbarea ei e o decizie de produs, nu o corecție. Rămâne în
--    lotul 5, cu întrebarea pusă explicit.
-- 2. Randarea documentului (`/documente/[id]`) continuă să insereze HTML-ul ca
--    atare. Aici se oprește INTRAREA lui; escaparea la ieșire și CSP-ul
--    executoriu sunt schimbări de cod, notate în audit.

begin;

-- ── 1. F04a: HTML periculos nu mai intră în șabloane ──────────────────────
create or replace function internal.hr_html_fara_script()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_html text := coalesce(new.continut_html, '');
begin
  if app.is_service_context() then
    return new;
  end if;
  -- Lista e scurtă și explicită, nu un sanitizator: sanitizarea rămâne în
  -- `src/lib/documents/curata-html.ts`, care știe ce ATRIBUTE se păstrează.
  -- Aici e ultima barieră, pentru scrierile care n-au trecut prin acțiune.
  -- `[\s>/]` în loc de `\b`: în expresiile regulate din Postgres `\b` NU e
  -- graniță de cuvânt, ci caracterul BACKSPACE — o capcană care face regula să
  -- pară scrisă și să nu prindă nimic. Prinsă de proba (1).
  if v_html ~* '<\s*(script|iframe|object|embed|form)[\s>/]'
     or v_html ~* '\son[a-z]+\s*='
     or v_html ~* 'javascript\s*:' then
    raise exception 'Conținutul șablonului conține HTML executabil (script, iframe, atribute de eveniment). Documentele generate se deschid în aplicație, deci ar rula în sesiunea cititorului.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal.hr_html_fara_script() from public, anon;

drop trigger if exists trg_hr_templates_html on public.hr_document_templates;
create trigger trg_hr_templates_html
  before insert or update on public.hr_document_templates
  for each row execute function internal.hr_html_fara_script();

-- ── 2. F04b: actul emis nu se mai rescrie ─────────────────────────────────
-- Singura scriere legitimă de după emitere e anularea
-- (`angajati/[id]/documente/actions.ts`: `anulat_la` + `motiv_anulare`).
create or replace function internal.hr_act_emis_imuabil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;
  new.template_id        := old.template_id;
  new.employee_id        := old.employee_id;
  new.contract_id        := old.contract_id;
  new.serie              := old.serie;
  new.numar              := old.numar;
  new.numar_afisat       := old.numar_afisat;
  new.titlu              := old.titlu;
  new.scop               := old.scop;
  new.emis_la            := old.emis_la;
  new.emis_de            := old.emis_de;
  new.date_document      := old.date_document;
  new.continut_html      := old.continut_html;
  new.continut_checksum  := old.continut_checksum;
  new.cod_verificare     := old.cod_verificare;
  new.fisier_path        := old.fisier_path;
  return new;
end;
$$;

revoke all on function internal.hr_act_emis_imuabil() from public, anon;

drop trigger if exists trg_hr_issued_imuabil on public.hr_issued_documents;
create trigger trg_hr_issued_imuabil
  before update on public.hr_issued_documents
  for each row execute function internal.hr_act_emis_imuabil();

-- ── 3. F11: fișa postului și semnătura ei ─────────────────────────────────
-- Tabela n-are NICIO scriere de tip UPDATE în aplicație: se inserează la
-- înrolare și se citește. Grantul rămâne deci pe strictul necesar unei
-- administrări viitoare (validitate și activare), iar semnătura — `semnat_la`,
-- `semnat_de_angajat`, `semnatura_ip` — lipsește deliberat: se va scrie dintr-o
-- funcție de server, cu IP-ul din antetul cererii, exact ca la fișele de
-- instruire (0075:1412-1414). Până atunci, nimeni n-o poate fabrica.
revoke update on public.job_descriptions from authenticated;
grant update (valabil_pana, activ, fisier_path, updated_at, updated_by)
  on public.job_descriptions to authenticated;

-- ── 4. F35: conținutul înregistrării din registru ─────────────────────────
create or replace function internal.guard_registru_documente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.organization_id        := old.organization_id;
  new.an                     := old.an;
  new.numar                  := old.numar;
  new.numar_afisat           := old.numar_afisat;
  new.data_inregistrare      := old.data_inregistrare;
  new.sens                   := old.sens;
  new.tip_document           := old.tip_document;
  new.entitate_tip           := old.entitate_tip;
  new.entitate_id            := old.entitate_id;
  new.inregistrat_retroactiv := old.inregistrat_retroactiv;
  new.created_at             := old.created_at;
  -- Conținutul înregistrării, înghețat odată cu numărul (F35). Ce rămâne
  -- modificabil e strict rezolvarea: `mod_rezolvare`, `rezolvat_la`,
  -- `rezolvat_de`, `indicativ_dosar`, `conexat_la`, `anulat_la`,
  -- `motiv_anulare`, `data_expedierii`, `compartiment` — adică ce se întâmplă
  -- CU documentul după ce a intrat, nu ce SCRIE în el.
  new.continut_rezumat       := old.continut_rezumat;
  new.emitent                := old.emitent;
  new.destinatar             := old.destinatar;
  new.numar_document_emitent := old.numar_document_emitent;
  new.data_document_emitent  := old.data_document_emitent;
  new.numar_file             := old.numar_file;
  new.numar_anexe            := old.numar_anexe;
  new.punct_lucru_id         := old.punct_lucru_id;
  return new;
end;
$$;

-- ── 5. F26: ce primește registrul de la generator ─────────────────────────
create or replace function internal.registru_intrare_valida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.punct_lucru_id is not null
     and not exists (
       select 1 from public.puncte_lucru p
        where p.id = new.punct_lucru_id
          and p.organization_id = new.organization_id
          and p.deleted_at is null
     ) then
    raise exception 'Punctul de lucru nu aparține organizației.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(new.continut_rezumat, '')) > 500 then
    raise exception 'Rezumatul înregistrării depășește 500 de caractere.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function internal.registru_intrare_valida() from public, anon;

drop trigger if exists trg_registru_intrare_valida on public.registru_documente;
create trigger trg_registru_intrare_valida
  before insert on public.registru_documente
  for each row execute function internal.registru_intrare_valida();

-- ── 6. F31: cerința de dovadă vine din șablon, nu de la client ────────────
create or replace function internal.checklist_pas_campuri_fixe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;
  -- Coloanele astea descriu CONTRACTUL pasului și vin din șablon
  -- (`checklist_template_items`). Scriibile de la client, angajatul cobora
  -- `tip_dovada` de la „document" la „bifă" și închidea pasul fără dovadă.
  new.template_item_id     := old.template_item_id;
  new.tip_dovada           := old.tip_dovada;
  new.verificare_automata  := old.verificare_automata;
  new.obligatoriu          := old.obligatoriu;
  new.material_id          := old.material_id;
  new.curs_id              := old.curs_id;
  new.employee_id          := old.employee_id;
  new.instance_id          := old.instance_id;

  -- Cine a bifat și când: din sesiune, nu din cerere. Ramura automată
  -- (`app.checklist_sincronizeaza_inventar`, `internal.checklist_bifeaza_la_citire`)
  -- pune `bifat_automat = true` și `bifat_de = null` — pe aceea n-o atingem.
  if coalesce(new.bifat_automat, false) = false
     and new.status is distinct from old.status
     and new.bifat_la is not null then
    new.bifat_de := (select auth.uid());
    new.bifat_la := now();
  end if;
  return new;
end;
$$;

revoke all on function internal.checklist_pas_campuri_fixe() from public, anon;

drop trigger if exists trg_checklist_pas_campuri_fixe on public.checklist_instance_items;
create trigger trg_checklist_pas_campuri_fixe
  before update on public.checklist_instance_items
  for each row execute function internal.checklist_pas_campuri_fixe();

-- ── 7. F32: predicatul tautologic ─────────────────────────────────────────
-- `ii.organization_id = ii.organization_id` și surorile lui sunt adevărate
-- pentru ORICE rând: coloanele exterioare n-au fost calificate, iar rezoluția de
-- nume le-a legat pe toate de alias-ul interior. Singura barieră rămasă era
-- vizibilitatea pasului la SELECT.
drop policy if exists checklist_material_reads_insert on public.checklist_material_reads;
create policy checklist_material_reads_insert on public.checklist_material_reads
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'onboarding')
  and app.can(organization_id, 'checklists', 'update', 'own')
  and employee_id = app.current_employee_id(organization_id)
  and exists (
    select 1
    from public.checklist_instance_items ii
    where ii.id = checklist_material_reads.instance_item_id
      and ii.organization_id = checklist_material_reads.organization_id
      and ii.employee_id = checklist_material_reads.employee_id
      and ii.material_id = checklist_material_reads.material_id
      and ii.deleted_at is null
  )
);

-- ── 8. F50: momentul confirmării de citire ────────────────────────────────
create or replace function internal.anunt_citit_acum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;
  -- Data confirmării e probă de conformitate: cine a citit regulamentul și
  -- CÂND. Venind de la client, se putea antedata înaintea publicării anunțului.
  new.citit_la := now();
  return new;
end;
$$;

revoke all on function internal.anunt_citit_acum() from public, anon;

drop trigger if exists trg_announcement_reads_acum on public.announcement_reads;
create trigger trg_announcement_reads_acum
  before insert on public.announcement_reads
  for each row execute function internal.anunt_citit_acum();

commit;
