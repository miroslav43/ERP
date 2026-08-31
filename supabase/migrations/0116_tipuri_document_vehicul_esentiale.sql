-- =====================================================================================
-- 0116_tipuri_document_vehicul_esentiale.sql
--
-- Nomenclatorul de tipuri de document de vehicul se reduce la cele ȘAPTE care
-- privesc orice mașină, indiferent de firmă. Cele patru rămase — licență de
-- transport, copie conformă, verificare tahograf, certificat ADR — privesc
-- exclusiv transportul rutier de marfă sau persoane și nu se aplică niciunui
-- client de azi.
--
-- ── DE CE CONTEAZĂ, DEȘI E DOAR UN NOMENCLATOR ───────────────────────────────
-- Lista asta nu e doar conținutul unui `<select>`. `flota/[id]/page.tsx`
-- construiește tabelul de conformitate PARCURGÂND tipurile, nu documentele:
--
--     tipuri.filter((tip) => dupaTip.has(tip.id) || tip.obligatoriu)
--
-- Un tip activ, neobligatoriu și necompletat nu produce rând — deci cele patru
-- nu murdăresc azi tabelul. Dar produc patru opțiuni într-o listă din care
-- cineva alege sub presiune, iar „Copie conformă” lângă „Trusă medicală” e
-- exact felul de zgomot care face ca formularul să pară al altcuiva.
--
-- ── DEZACTIVARE, NU ȘTERGERE ─────────────────────────────────────────────────
-- `activ = false`, nu `deleted_at`. Diferența e că `vdt_select` filtrează pe
-- `deleted_at is null` dar NU pe `activ` — deci un rând dezactivat rămâne
-- citibil, iar `internal.flota_sincronizeaza_grup` își poate lua în continuare
-- `cod` și `denumire` din el pentru orice document istoric. Filtrul pe `activ`
-- îl pune stratul de citire (`tipuriDocument()` din `src/lib/queries/fleet.ts`).
--
-- ── CE NU STRICĂ ─────────────────────────────────────────────────────────────
-- 1. Nu îngheață documente existente. `internal.vdoc_inainte()`, rescrisă în
--    0018 §F4, revalidează existența și starea `activ` a tipului DOAR la INSERT
--    sau când `document_type_id` chiar se schimbă. Înainte de reparația aia,
--    dezactivarea unui tip făcea documentele lui imposibil de atins — nici
--    măcar de șters logic.
-- 2. Nu lasă documente orfane. Verificat înainte de scrierea migrării, pe baza
--    reală: zero rânduri `vehicle_documents` neșterse pe cele patru coduri.
--    Garda de mai jos reface verificarea la aplicare, pe orice bază.
-- 3. Nu atinge `expirables`. `sync_expirable` se cheamă din triggerul de
--    document, nu din nomenclator; niciun rând nu se mișcă.
--
-- ── CUM SE DĂ ÎNAPOI ─────────────────────────────────────────────────────────
-- Același UPDATE cu `activ = true`. Rândurile sunt de PLATFORMĂ
-- (`organization_id is null`), deci reactivarea le redă tuturor firmelor
-- deodată — nu există azi un mecanism de activare per organizație.
--
-- Ce NU merge: crearea unui tip propriu firmei cu același `cod`.
-- `internal.vdt_normalizeaza()`, rescrisă în 0018 §F6, ridică P0001 —
-- „Codul «%s» este deja folosit de un tip de document de platformă” — fiindcă
-- `kind`-ul din `expirables` se deduce din `cod`, iar o coliziune ar face ca
-- două tipuri să scrie peste aceeași scadență.
-- =====================================================================================

begin;

-- ============================================================
-- 1. Garda: niciun document activ pe tipurile care se retrag
-- ============================================================
--
-- Dezactivarea e sigură pentru documentele EXISTENTE (0018 §F4), dar un tip
-- care poartă documente n-ar trebui să dispară din interfață fără ca cineva să
-- decidă asta explicit. Pe baza de azi contorul e zero; garda există pentru
-- orice altă bază pe care se aplică migrarea.

do $$
declare v_n integer;
begin
  select count(*) into v_n
    from public.vehicle_documents d
    join public.vehicle_document_types t on t.id = d.document_type_id
   where d.deleted_at is null
     and t.organization_id is null
     and t.cod in ('licenta_transport', 'copie_conforma', 'tahograf', 'adr');

  if v_n > 0 then
    raise exception
      'Există % document(e) pe tipurile de transport care urmează să fie retrase. Migrarea se oprește: mutați-le sau păstrați tipurile active.', v_n;
  end if;
end $$;

-- ============================================================
-- 2. Retragerea propriu-zisă
-- ============================================================

update public.vehicle_document_types
   set activ = false,
       updated_at = now()
 where organization_id is null
   and deleted_at is null
   and activ
   and cod in ('licenta_transport', 'copie_conforma', 'tahograf', 'adr');

-- ============================================================
-- 3. Verificarea de rezultat
-- ============================================================
--
-- Migrarea trebuie să lase EXACT șapte tipuri de platformă active. Numărul e
-- scris aici ca să se rupă zgomotos dacă altcineva adaugă un tip de platformă
-- fără să treacă pe aici — o listă care crește pe tăcute e exact ce am corectat.

do $$
declare v_active integer;
begin
  select count(*) into v_active
    from public.vehicle_document_types
   where organization_id is null and deleted_at is null and activ;

  if v_active <> 7 then
    raise exception
      'După retragere ar trebui să rămână 7 tipuri de platformă active, sunt %.', v_active;
  end if;
end $$;

comment on table public.vehicle_document_types is
  'Nomenclator de tipuri de document de vehicul. Rândurile de platformă '
  '(organization_id null) sunt cele ȘAPTE care privesc orice mașină: ITP, RCA, '
  'CASCO, rovinietă, revizie, stingător, trusă medicală. Cele patru de transport '
  '(licență, copie conformă, tahograf, ADR) există dar sunt activ = false din '
  '0116 — se reactivează cu un UPDATE când apare un client de transport.';

commit;
