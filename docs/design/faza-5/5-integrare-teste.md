```ts
// src/config/navigation.ts (ADĂUGARE — NU rescrie fișierul; intrări noi sub featureKey 'inventory')
```
```ts
// Se inserează în NAV_ITEMS (aplicația principală) un părinte cu patru
// copii, plus o singură intrare în PORTAL_NAV_ITEMS pentru portalul
// angajatului. Toate sunt gate-uite pe featureKey 'inventory' — modulul
// dezactivat înseamnă 404 prin requireFeature în pagină (S2), nu ascunderea
// tăcută a intrării din meniu ca unică apărare.
//
// Numele exacte ale câmpurilor NavItem/NavLink (id/label/href/icon/group/
// children/badge) și cheile reale din NAV_GROUPS NU sunt în inventar — cele
// de mai jos sunt cea mai bună aproximare posibilă din convenția restului
// fișierului documentat; verificați-le înainte de a le lipi în fișierul
// real (vezi SEMNALĂRI).

// 1) NAV_ITEMS — părinte „Inventar”, vizibil din momentul în care oricare
//    dintre copii e vizibil (minScope 'own' pe părinte = pragul cel mai jos):
{
  id: 'inventar',
  label: 'Inventar',
  href: '/inventar',
  icon: 'package',
  group: 'resurse',                 // TODO: confirmați cheia reală din NAV_GROUPS
  featureKey: 'inventory',
  permission: 'inventory:read',
  minScope: 'own',
  children: [
    {
      id: 'inventar-obiecte',
      label: 'Obiecte de inventar',
      href: '/inventar/obiecte',
      featureKey: 'inventory',
      permission: 'inventory:read',
      minScope: 'own',              // magazionerul (scope 'all') vede tot; angajatul, doar ce are în primire
    },
    {
      id: 'inventar-alocari',
      label: 'Predare-primire',
      href: '/inventar/alocari',
      featureKey: 'inventory',
      permission: 'inventory:read',
      minScope: 'own',
    },
    {
      id: 'inventar-categorii',
      label: 'Categorii',
      href: '/inventar/categorii',
      featureKey: 'inventory',
      permission: 'inventory:update',
      minScope: 'all',              // nomenclator — doar administrare
    },
    {
      id: 'inventar-import',
      label: 'Import loturi',
      href: '/inventar/import',
      featureKey: 'inventory',
      permission: 'inventory:update',
      minScope: 'all',
    },
  ],
} satisfies NavItem,

// 2) PORTAL_NAV_ITEMS — o singură intrare, mereu la scope 'own': angajatul
//    vede DOAR ce are personal în primire, niciodată inventarul firmei:
{
  id: 'portal-inventar',
  label: 'Obiectele mele',
  href: '/portal/inventar',
  icon: 'package',
  featureKey: 'inventory',
  permission: 'inventory:read',
  minScope: 'own',
} satisfies NavLink,
```

```sql
// supabase/seed-inventar.sql
```
```sql
-- supabase/seed-inventar.sql
-- DEMO — date de test pentru modulul de inventar (Faza 5). NU rulați acest
-- script pe o bază de date de producție. Toate obiectele create au numere
-- de inventar care încep cu „DEMO-INV-”, ușor de identificat și de curățat.
--
-- Idempotent: rulabil de mai multe ori — șterge întâi orice rămășiță a unei
-- rulări anterioare (alocări, obiecte, lotul de import), apoi reinserează.
-- Ajustați v_org_slug la slugul organizației demo din mediul dvs. dacă
-- diferă de „demo”. Organizația trebuie să aibă deja cel puțin 2 angajați
-- activi (seed-uri de Fazele anterioare).

begin;

do $do$
declare
  v_org_slug   text := 'demo';
  v_org_id     uuid;
  v_batch_id   uuid;
  v_cat_laptop uuid;
  v_cat_tel    uuid;
  v_cat_mon    uuid;
  v_cat_scule  uuid;
  v_cat_mob    uuid;
  v_ang1       uuid;
  v_ang2       uuid;
  v_item1      uuid;
  v_item2      uuid;
begin
  select o.id into v_org_id from public.organizations o where o.slug = v_org_slug;
  if v_org_id is null then
    raise exception using errcode = 'P0001', message = format(
      'Organizația demo cu slug „%s” nu există. Ajustați v_org_slug la o organizație reală înainte de a rula seed-ul.',
      v_org_slug
    );
  end if;

  select e.id into v_ang1 from public.employees e
   where e.organization_id = v_org_id and e.deleted_at is null
   order by e.created_at limit 1;
  select e.id into v_ang2 from public.employees e
   where e.organization_id = v_org_id and e.deleted_at is null
   order by e.created_at offset 1 limit 1;
  if v_ang1 is null or v_ang2 is null then
    raise exception using errcode = 'P0001', message =
      'Organizația demo are nevoie de cel puțin 2 angajați activi înainte de a rula seed-ul de inventar.';
  end if;

  select c.id into v_cat_laptop from public.inventory_categories c where c.organization_id is null and c.cod = 'laptop';
  select c.id into v_cat_tel    from public.inventory_categories c where c.organization_id is null and c.cod = 'telefon';
  select c.id into v_cat_mon    from public.inventory_categories c where c.organization_id is null and c.cod = 'monitor';
  select c.id into v_cat_scule  from public.inventory_categories c where c.organization_id is null and c.cod = 'scule';
  select c.id into v_cat_mob    from public.inventory_categories c where c.organization_id is null and c.cod = 'mobilier';
  if v_cat_laptop is null then
    raise exception using errcode = 'P0001', message =
      'Nomenclatorul de platformă din 0010_inventory.sql lipsește (categoria „laptop” nu a fost găsită).';
  end if;

  -- Curățare idempotentă a unei rulări anterioare a acestui seed.
  delete from public.inventory_allocations a
   using public.inventory_items i
   where a.item_id = i.id and i.organization_id = v_org_id and i.numar_inventar like 'DEMO-INV-%';
  delete from public.inventory_items where organization_id = v_org_id and numar_inventar like 'DEMO-INV-%';
  delete from public.inventory_import_batches
   where organization_id = v_org_id and fisier_nume = 'demo-seed-inventar.csv';

  -- Lotul e inserat direct în starea finală (script de service, nu trece
  -- prin RLS/politica de INSERT care ar cere pornirea la 'in_lucru').
  insert into public.inventory_import_batches
    (organization_id, fisier_nume, randuri_total, randuri_importate, randuri_esuate, status, importat_la)
  values
    (v_org_id, 'demo-seed-inventar.csv', 5, 5, 0, 'finalizat', now())
  returning id into v_batch_id;

  insert into public.inventory_items
    (organization_id, category_id, denumire, numar_inventar, model, producator,
     data_achizitie, valoare, garantie_expira, stare, locatie, import_batch_id)
  values
    (v_org_id, v_cat_laptop, 'Laptop — Dell Latitude 5540', 'DEMO-INV-00001',
     'Latitude 5540', 'Dell', app.azi_local() - interval '60 days', 4500.00,
     app.azi_local() + interval '400 days', 'nou', 'Birou etaj 2', v_batch_id)
  returning id into v_item1;

  insert into public.inventory_items
    (organization_id, category_id, denumire, numar_inventar, model, producator,
     data_achizitie, valoare, garantie_expira, stare, locatie, import_batch_id)
  values
    (v_org_id, v_cat_tel, 'Telefon — iPhone 13', 'DEMO-INV-00002',
     'iPhone 13', 'Apple', app.azi_local() - interval '335 days', 2800.00,
     app.azi_local() + interval '30 days', 'bun', 'Mobil', v_batch_id)
  returning id into v_item2;

  -- Obiectul cu garanția pe cale să expire — apare ca alertă în motorul de
  -- expirări la un prag obișnuit de 14 sau 30 de zile.
  insert into public.inventory_items
    (organization_id, category_id, denumire, numar_inventar, model, producator,
     data_achizitie, valoare, garantie_expira, stare, locatie, import_batch_id)
  values
    (v_org_id, v_cat_mon, 'Monitor — Dell 27"', 'DEMO-INV-00003',
     'P2723DE', 'Dell', app.azi_local() - interval '720 days', 1200.00,
     app.azi_local() + interval '10 days', 'bun', 'Magazie', v_batch_id);

  insert into public.inventory_items
    (organization_id, category_id, denumire, numar_inventar, producator,
     data_achizitie, valoare, stare, locatie, import_batch_id)
  values
    (v_org_id, v_cat_scule, 'Set scule electrice', 'DEMO-INV-00004',
     'Bosch', app.azi_local() - interval '900 days', 850.00, 'uzat', 'Magazie', v_batch_id);

  insert into public.inventory_items
    (organization_id, category_id, denumire, numar_inventar, valoare, stare, locatie, import_batch_id)
  values
    (v_org_id, v_cat_mob, 'Birou reglabil pe înălțime', 'DEMO-INV-00005',
     650.00, 'uzat', 'Birou etaj 1', v_batch_id);

  -- Două predări-primiri deschise — v_item1 și v_item2 devin „alocat”
  -- automat prin triggerul internal.inventory_alloc_propaga.
  insert into public.inventory_allocations (organization_id, item_id, employee_id, stare_la_predare, observatii)
  values (v_org_id, v_item1, v_ang1, 'nou', 'DEMO — predare seed');

  insert into public.inventory_allocations (organization_id, item_id, employee_id, stare_la_predare, observatii)
  values (v_org_id, v_item2, v_ang2, 'bun', 'DEMO — predare seed');

  raise notice 'seed-inventar: 5 obiecte demo pentru organizația %, 2 alocate, 1 cu garanție aproape expirată.', v_org_id;
end
$do$;

commit;
```

SEMNALĂRI (lucruri absente din inventar, pe care nu le-am inventat, ci am aproximat vizibil):

1. `tests/rls/inventar.test.ts` depinde de coloane care nu sunt în inventar: `organizations(name, slug)`, `organization_features(organization_id, feature_key, enabled)` cu unicitate presupusă `(organization_id, feature_key)`, `organization_members(organization_id, user_id, role)`, `employees(organization_id, user_id, nume_complet)`, `role_permissions(organization_id, role, resource, action, scope)` cu unicitate presupusă `(organization_id, role, resource, action)`, plus valorile literale `'admin'` / `'employee'` pentru `AppRole`. `employees` are aproape sigur și alte coloane `NOT NULL` (departament, dată angajare etc.) pe care nu le cunosc — insert-ul minimal din `creeazaAngajat` va trebui completat. Verificați contra migrărilor reale (`0002_authz.sql`, migrarea HR) și `@/lib/tenant/types.ts` înainte de a rula.
2. Folosesc direct `process.env.NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` pentru clientul anonim de autentificare, fiindcă `@/config/env` e documentat doar ca existent (`clientEnv, serverEnv`), nu cu numele exacte ale câmpurilor. Înlocuiți cu `clientEnv.*` odată confirmate.
3. Am presupus Vitest (`describe/it/expect/beforeAll/afterAll` din `'vitest'`) ca test runner, prin convenție — ajustați importurile dacă Fazele anterioare folosesc Jest.
4. `0010b_inventory_expirables.sql` redefinește idempotent (CREATE OR REPLACE / DROP...IF EXISTS) exact același trigger deja prezent în `0010_inventory.sql` §6, ca migrarea cerută să fie auto-suficientă — dacă fișierul `0010_inventory.sql` livrat efectiv NU conține acea secțiune (de exemplu din cauza limitei de ~900 de linii), 0010b acoperă golul; dacă o conține deja, reasertarea e sigură (nu produce erori de duplicat).
5. `src/config/navigation.ts` — blocul livrat e o PROPUNERE, nu un diff real (fișierul nu a fost citit, cum s-a cerut). Numele exacte ale câmpurilor `NavItem`/`NavLink` (`featureKey` vs `feature`, existența lui `group`/`children`) și cheile reale din `NAV_GROUPS` trebuie confirmate înainte de a le lipi în fișier.
6. `supabase/seed-inventar.sql` presupune o organizație cu `slug = 'demo'` deja existentă, cu minimum 2 angajați activi (din seed-urile Fazelor anterioare) — ajustați `v_org_slug` dacă demo-ul folosește alt slug.
7. Fișiere: `/Users/maleticimiroslav/ERP Adminio/supabase/migrations/0010b_inventory_expirables.sql`, `/Users/maleticimiroslav/ERP Adminio/tests/rls/inventar.test.ts`, `/Users/maleticimiroslav/ERP Adminio/src/domain/inventory/numar-inventar.ts`, `/Users/maleticimiroslav/ERP Adminio/src/domain/inventory/numar-inventar.test.ts`, `/Users/maleticimiroslav/ERP Adminio/src/config/navigation.ts` (adăugare propusă), `/Users/maleticimiroslav/ERP Adminio/supabase/seed-inventar.sql` (niciunul creat pe disc — sunt read-only, conform sarcinii).