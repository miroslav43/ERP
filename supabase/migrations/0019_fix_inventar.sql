-- ─────────────────────────────────────────────────────────────────────────────
-- 0019_fix_inventar.sql — ce a mai rămas stricat în modulul de INVENTAR
--                          (supabase/migrations/0010_inventory.sql)
--
-- 0016_fix_izolare_module.sql a închis găurile de IZOLARE (ștergerea cross-
-- tenant prin import_batch_id, cheia primară rescriibilă a alocărilor,
-- vizibilitatea „ce am eu în primire" care arăta și ce returnasem, granturile
-- redeschise). Migrarea de față repară ce a rămas: două defecte de LOGICĂ DE
-- FLUX în `internal.inventory_alloc_propaga` și un defect de IGIENĂ A DATELOR
-- la ștergerea fizică a unui obiect. Niciunul dintre ele scurge date între
-- firme — de-asta au trecut de cele trei bariere (security-definer,
-- rls-enabled, policies-explain): toate trei verifică FORMA politicilor și a
-- funcțiilor SECURITY DEFINER (search_path, cast la uuid[], plan de execuție),
-- nu ADEVĂRUL de business pe care o funcție corect izolată îl calculează
-- greșit. O funcție poate fi perfect izolată pe tenant și, în același timp,
-- perfect greșită în ce scrie pe rândul propriu.
--
-- Fiecare defect de mai jos a fost reprodus efectiv pe o bază locală (toate
-- migrările 0001-0016 aplicate), înainte de reparație și după — vezi
-- rezultatele în raportul care însoțește migrarea. Nu sunt observații de
-- stil.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- V1. `internal.inventory_alloc_propaga` — DOUĂ defecte în același trigger,
--     amândouă din aceeași cauză: funcția tratează ORICE INSERT/UPDATE pe
--     `inventory_allocations` ca pe „chiar acum s-a produs o returnare",
--     inclusiv o simplă corectură de text pe o alocare închisă de mult.
--
-- (a) STAREA CURENTĂ E SUPRASCRISĂ LA EDITAREA ORICĂREI ALOCĂRI ISTORICE.
--     Reprodus: obiect cu 2 alocări închise — prima cu stare_la_returnare=
--     'uzat' (acum 90 de zile), a doua cu 'defect' (acum câteva zile). Starea
--     obiectului e corect 'defect'. Apoi
--         update inventory_allocations set observatii='corectură'
--         where id = <alocarea de acum 90 de zile>;
--     — un UPDATE care nu atinge nici `returnat_la`, nici `stare_la_returnare`.
--     Linia `stare = coalesce(new.stare_la_returnare, i.stare)` rulează
--     necondiționat la FIECARE UPDATE al FIECĂREI alocări a obiectului, deci
--     rescrie starea curentă cu 'uzat' — valoarea de acum 90 de zile. O
--     corectură de text rescrie realitatea fizică a obiectului.
--
-- (b) UN OBIECT RETURNAT 'defect' REDEVINE IMEDIAT 'in_stoc'.
--     Reprodus: predare + returnare cu stare_la_returnare='defect' pe un
--     obiect fără altă alocare → status ajunge 'in_stoc', stare='defect'. CASE-
--     ul de status avea o singură ramură pentru „nicio alocare deschisă":
--     `else 'in_stoc'`, indiferent de starea fizică la returnare. Un laptop
--     stricat apare disponibil pentru o nouă predare.
--
-- DE CE A SCĂPAT VERIFICĂRILOR AUTOMATE: ambele sunt calcule greșite într-un
-- trigger SECURITY DEFINER corect configurat (search_path gol, nume complet
-- calificate) — exact ce verifică barierele. Bariera nu rulează triggerul,
-- nu-i verifică rezultatul.
--
-- REMEDIU: introduc `v_returnare_noua` — adevărat DOAR când returnarea de pe
-- ACEST rând tocmai s-a produs (INSERT cu returnat_la completat direct, ceea
-- ce politica normală de INSERT nu permite dar un script de service ar putea,
-- sau UPDATE care schimbă returnat_la). `stare` se scrie doar atunci — pe
-- orice altă atingere a rândului (confirmare, observații, corectură de PV),
-- `i.stare` rămâne neschimbată. Pentru status, adaug o ramură explicită:
-- returnare nouă + stare_la_returnare='defect' → 'in_reparatie'. Prima ramură
-- a CASE-ului (status in ('casat','in_reparatie') și nicio alocare deschisă →
-- rămâne așa) există deja și e ceea ce ține obiectul în 'in_reparatie' la
-- ORICE atingere ulterioară a alocării — inclusiv corectura de observații de
-- mai sus: al doilea WHEN nu mai apucă să ruleze, fiindcă primul câștigă.
-- Ieșirea din 'in_reparatie' rămâne, ca și până acum, un gest EXPLICIT al
-- administratorului pe fișa obiectului (inventory_items), nu un efect
-- secundar al unei alocări atinse din greșeală.
--
-- Corpul de mai jos e cel din 0010:449-478, neschimbat în afara declarației
-- `v_returnare_noua` și a celor două linii marcate mai jos.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.inventory_alloc_propaga()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.item_id, old.item_id);
  -- Adevărat doar când ACEST rând tocmai a trecut din „deschis" în „închis",
  -- sau i s-a corectat direct data returnării. `old.returnat_la` e NULL (nu
  -- eroare) când tg_op = 'INSERT' — verificat empiric — deci pe o predare nouă
  -- (returnat_la NULL de ambele părți) expresia dă `false`, corect: o predare
  -- nu are ce să propage.
  v_returnare_noua boolean :=
    new.returnat_la is not null
    and new.returnat_la is distinct from old.returnat_la;
begin
  update public.inventory_items i
     set status = case
           when i.status in ('casat', 'in_reparatie')
             and not exists (
               select 1 from public.inventory_allocations a
                where a.item_id = i.id and a.returnat_la is null and a.deleted_at is null
             ) then i.status
           when exists (
             select 1 from public.inventory_allocations a
              where a.item_id = i.id and a.returnat_la is null and a.deleted_at is null
           ) then 'alocat'::public.inventory_item_status
           -- V1(b): returnare nouă cu obiectul constatat 'defect' → reparație,
           -- nu stoc disponibil. Verificat o singură dată, la ÎNCHIDEREA
           -- efectivă; orice atingere ulterioară e prinsă de primul WHEN, care
           -- ține obiectul în 'in_reparatie' până la un gest explicit pe fișă.
           when v_returnare_noua and new.stare_la_returnare = 'defect'
             then 'in_reparatie'::public.inventory_item_status
           else 'in_stoc'::public.inventory_item_status
         end,
         -- V1(a): starea FIZICĂ se rescrie doar la o returnare care tocmai s-a
         -- produs pe ACEST rând — nu la orice UPDATE al oricărei alocări.
         stare = case when v_returnare_noua
                   then coalesce(new.stare_la_returnare, i.stare)
                   else i.stare
                 end,
         updated_at = now()
   where i.id = v_item;

  perform internal.inventory_sync_garantie(v_item);
  return null;
end;
$$;

-- Trigger deja există din 0010 (același nume, aceeași funcție) — CREATE OR
-- REPLACE de mai sus e suficient, nu e nevoie de DROP/CREATE TRIGGER.


-- ═════════════════════════════════════════════════════════════════════════════
-- V2. Ștergerea fizică a unui obiect lasă în `expirables` un rând ACTIV orfan.
--
-- Reprodus: obiect cu `garantie_expira` → 1 rând activ în `expirables`
-- (kind='garantie', entity_type='inventory_item'). `delete from
-- inventory_items where id = ...` → rândul din `expirables` rămâne cu
-- `is_active=true` și `entity_id` fără corespondent în `inventory_items`. Motorul
-- de alerte din 0008 continuă să genereze scadențe pentru un obiect care nu
-- mai există.
--
-- `app.revoca_import_inventar` (0010, întărită izolat în 0016) NU are acest
-- defect — apelează explicit `internal.sync_expirable(..., null::date, ...,
-- false)` înainte de DELETE, pentru fiecare rând din lot. Dar e SINGURA cale de
-- ștergere fizică azi, și nu va rămâne singura: `inventory_items` e singura
-- tabelă din tot proiectul fără soft delete (decizia centrală din antetul
-- 0010), deci DELETE pe ea e o cale legitimă, refolosită de orice viitoare
-- funcție de corecție (de ex. ștergerea unui obiect introdus manual greșit,
-- semnalată dar neimplementată încă în vânătoarea din docs/design/faza-5).
-- O proiecție care depinde de fiecare APELANT să-și amintească să cureți
-- `expirables` cedează la primul apelant care uită.
--
-- VERIFICAT dacă mai există alte tabele-sursă cu ștergere fizică ce
-- proiectează în `expirables`: grep `delete from public\.` pe toate migrările
-- găsește doar `rate_limits` (fără proiecție, e curățare de jurnal de rată) și
-- `leave_request_days` (nu e `entity_type` înregistrat în `expirables`) — în
-- plus cele două DELETE-uri de mai sus, pe `inventory_items`. Toate celelalte
-- module (flotă, SSM) proiectează din tabele cu soft delete, prin
-- `internal.sync_expirable(..., is_active => false)` la `deleted_at`, nu prin
-- DELETE fizic. `inventory_items` rămâne singura tabelă-sursă care are nevoie
-- de un trigger AFTER DELETE.
--
-- REMEDIU: trigger AFTER DELETE pe `inventory_items`, plasă de siguranță
-- generică — funcționează indiferent PE CE CALE s-a produs ștergerea (direct,
-- sau printr-o viitoare funcție de corecție care va uita, la fel de ușor ca
-- oricare alta, să curețe `expirables`). Idempotent cu apelul deja existent
-- din `app.revoca_import_inventar`: a doua chemare a lui `sync_expirable` cu
-- `p_expires_at = null` pe un rând deja închis logic (`deleted_at` completat)
-- nu găsește rândul activ și nu face nimic.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function internal.inventory_items_sterge_expirabil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `p_expires_at = null` este semnalul, în internal.sync_expirable (0008),
  -- pentru „scadența a dispărut din sursă": închide logic rândul din
  -- `expirables` și rezolvă orice alertă deschisă. Exact ce trebuie la
  -- dispariția FIZICĂ a obiectului însuși.
  perform internal.sync_expirable(
    old.organization_id, 'inventory_item', old.id, 'garantie',
    old.denumire, null::date, 'inventory_items', null, false);
  return null;
end;
$$;

drop trigger if exists inventory_items_expirari_ad on public.inventory_items;
create trigger inventory_items_expirari_ad
  after delete on public.inventory_items
  for each row execute function internal.inventory_items_sterge_expirabil();

comment on function internal.inventory_items_sterge_expirabil() is
  'Plasă de siguranță pentru ștergerea fizică a unui obiect de inventar (0010: singura tabelă fără soft delete). Închide logic proiecția din expirables, indiferent de calea prin care s-a produs DELETE-ul — vezi 0019 pentru reproducerea defectului rezolvat.';


-- ═════════════════════════════════════════════════════════════════════════════
-- V3. `supabase/seed-inventar.sql` (docs/design/faza-5/5-integrare-teste.md,
--     NEintegrat în cod) — verificat, NU integrat, conform sarcinii.
--
-- Fișierul nu există pe disc ca fișier separat; trăiește doar ca bloc de cod
-- în markdown. Conținutul REAL al scriptului (al doilea bloc ```sql din acel
-- document) începe corect cu `-- supabase/seed-inventar.sql` — comentariu SQL
-- valid, fără defectul de antet „// " în loc de „-- ".
--
-- Există totuși, chiar deasupra, un bloc ```sql separat, de o singură linie,
-- `// supabase/seed-inventar.sql` — dar acela e o ETICHETĂ de document, nu
-- fișierul: aceeași pereche „etichetă apoi conținut" apare și pentru celălalt
-- fișier propus în același document (src/config/navigation.ts), cu eticheta
-- ei corectă în `//` (JS). Eticheta seed-ului a moștenit sintaxa de comentariu
-- a etichetei de dinaintea ei, nu pe a fișierului pe care îl anunță. Dacă
-- cineva integrează vreodată acest script, capul de copiat este AL DOILEA bloc
-- (cel cu `-- `), nu eticheta.
-- ═════════════════════════════════════════════════════════════════════════════
