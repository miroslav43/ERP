-- supabase/migrations/0012b_fleet_expirables.sql
-- ============================================================================
-- 0012b_fleet_expirables.sql — integrare cu motorul de expirări: VERIFICARE,
-- nu reimplementare.
-- ----------------------------------------------------------------------------
-- Tot ce cerea sarcina este DEJA livrat în 0012_fleet.sql:
--   • triggerul vehicle_documents -> internal.sync_expirable()
--       lanţ: vdoc_inainte / vdoc_dupa (secţ. 9) -> internal.flota_sincronizeaza_grup
--       entity_type = 'vehicle_document', kind = cod (din vehicle_document_types)
--   • popularea iniţială: internal.flota_resincronizeaza_expirari() rulată la
--       finalul lui 0012 (secţ. 14)
--   • vândut/casat -> is_active = false: internal.vehicles_dupa (secţ. 9) prinde
--       schimbarea de status şi reapelează flota_sincronizeaza_grup, care trece
--       p_is_active := (deleted_at is null and status in ('activ','in_service'))
--       către internal.sync_expirable() — inclusiv la soft-delete (deleted_at
--       e parte din tupla urmărită de trigger).
--
-- A REPETA aceleaşi `create trigger` / `create function` aici ar EŞUA la
-- aplicare ("trigger ... already exists" pe public.vehicle_documents şi
-- public.vehicles) şi, dacă cineva le-ar redenumi ca să scape de eroare, AR
-- DUPLICA logica — exact ce interzice regula motorului de expirări din
-- inventar ("CONECTEAZĂ-TE la el, nu îl rescrie") şi S10. Fişierul de faţă nu
-- creează niciun trigger nou: verifică, tare, că integrarea chiar există şi
-- reafirmă popularea iniţială în mod idempotent.
-- ============================================================================

do $$
begin
  if to_regprocedure('internal.flota_sincronizeaza_grup(uuid, uuid, uuid)') is null then
    raise exception using errcode = 'P0001',
      message = 'internal.flota_sincronizeaza_grup lipseşte — 0012_fleet.sql nu a fost aplicată înaintea acestei migrări.';
  end if;

  if to_regprocedure('internal.flota_resincronizeaza_expirari(uuid)') is null then
    raise exception using errcode = 'P0001',
      message = 'internal.flota_resincronizeaza_expirari lipseşte — popularea iniţială a scadenţelor de flotă e indisponibilă.';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_trigger tg
      join pg_catalog.pg_class c on c.oid = tg.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'vehicle_documents'
       and tg.tgname = 'vdoc_dupa' and not tg.tgisinternal
  ) then
    raise exception using errcode = 'P0001',
      message = 'Triggerul vdoc_dupa pe vehicle_documents lipseşte — documentele de vehicul nu se mai proiectează în expirables.';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_trigger tg
      join pg_catalog.pg_class c on c.oid = tg.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'vehicles'
       and tg.tgname = 'vehicles_dupa' and not tg.tgisinternal
  ) then
    raise exception using errcode = 'P0001',
      message = 'Triggerul vehicles_dupa pe vehicles lipseşte — vândut/casat nu mai închide scadenţele vehiculului.';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'poate_vedea_expirabil'
       and pg_catalog.pg_get_functiondef(p.oid) like '%vehicle_document%'
  ) then
    raise exception using errcode = 'P0001',
      message = 'app.poate_vedea_expirabil() nu mai recunoaşte entity_type = ''vehicle_document'' — scadenţele de flotă ar deveni invizibile (implicitul funcţiei e restrictiv).';
  end if;
end
$$;

-- Idempotent: flota_sincronizeaza_grup face UPSERT prin internal.sync_expirable,
-- deci rularea repetată nu produce duplicate. Util după un import în masă de
-- documente de vehicul care a ocolit INSERT-urile normale (de ex. COPY direct
-- în tabelă dintr-un sistem vechi, cu triggere temporar dezactivate).
select internal.flota_resincronizeaza_expirari();
