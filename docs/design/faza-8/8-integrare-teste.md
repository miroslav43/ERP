```sql
// supabase/migrations/0012b_fleet_expirables.sql
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
```

```ts
// tests/rls/flota.test.ts
//
// ASUMĂRI marcate explicit — NU erau în inventarul primit, verificaţi înainte
// de a rula testul (vezi şi secţiunea de semnalări de la finalul livrării):
//   A1. Rulăm cu vitest (describe/it/expect/beforeAll/afterAll).
//   A2. Clientul „ca utilizator" citeşte URL/anon key din process.env
//       (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) — formele
//       exacte expuse de @/config/env (clientEnv) nu erau listate.
//   A3. organization_members are coloanele (organization_id, user_id, role).
//   A4. profiles.id = auth.users.id (convenţia standard Supabase) şi
//       employees are o coloană profile_id care leagă angajatul de un cont.
//   A5. role_permissions are coloanele (organization_id, role, resource,
//       action, scope) — dedus din semnătura confirmată app.has_permission(
//       uuid, text, text), care ia resursă/acţiune separat, nu un singur
//       PermissionKey unit prin ':'.
// Logica de business verificată aici (politicile RLS + triggerele din
// 0012_fleet.sql) e corectă indiferent de A1-A5; doar fixture-urile de tenant
// trebuie ajustate dacă schema reală diferă.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { APP_ROLES } from '@/lib/tenant/types';
import { RANK } from '@/config/permissions';
import type { Database } from '@/types/database';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY din mediul de test.');
}

const admin = createAdminSupabase();

const roluriDupaRang = [...APP_ROLES].sort((a, b) => RANK[a] - RANK[b]);
const ROL_SOFER = roluriDupaRang[0];
if (!ROL_SOFER) throw new Error('APP_ROLES este gol — nu pot alege un rol de şofer pentru test.');

const PAROLA_TEST = 'Test-Parola-Flota-0012!';

async function creeazaUtilizatorAutentificat(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PAROLA_TEST, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('Crearea utilizatorului de test a eşuat.');
  return data.user.id;
}

async function clientCaUtilizator(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  const { error } = await client.auth.signInWithPassword({ email, password: PAROLA_TEST });
  if (error) throw error;
  return client;
}

describe('RLS şi trigger-e — flota auto (0012_fleet)', () => {
  const sufix = Date.now().toString(36);
  let orgA = '';
  let orgB = '';
  let soferA1: { userId: string; employeeId: string; email: string };
  let soferA2: { userId: string; employeeId: string; email: string };
  let vehiculOrgA = '';
  let vehiculOrgB = '';
  const curatenie: Array<() => Promise<unknown>> = [];

  async function creeazaOrganizatie(nume: string): Promise<string> {
    const { data, error } = await admin
      .from('organizations')
      .insert({ name: nume, slug: `${nume}-${sufix}`.toLowerCase().replace(/\s+/g, '-') } as never)
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Crearea organizaţiei de test a eşuat.');
    return (data as { id: string }).id;
  }

  async function adaugaMembru(organizationId: string, userId: string, rol: string) {
    const { error } = await admin
      .from('organization_members')
      .insert({ organization_id: organizationId, user_id: userId, role: rol } as never);
    if (error) throw error;
  }

  async function creeazaAngajat(organizationId: string, userId: string, nume: string): Promise<string> {
    await admin.from('profiles').upsert({ id: userId, full_name: nume } as never, { onConflict: 'id' });
    const { data, error } = await admin
      .from('employees')
      .insert({ organization_id: organizationId, profile_id: userId, full_name: nume } as never)
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Crearea angajatului de test a eşuat.');
    return (data as { id: string }).id;
  }

  async function acordaPermisiune(organizationId: string, rol: string, resource: string, action: string, scope: string) {
    const { error } = await admin
      .from('role_permissions')
      .insert({ organization_id: organizationId, role: rol, resource, action, scope } as never);
    if (error) throw error;
  }

  async function creeazaVehicul(organizationId: string, employeeId: string | null, nrInmatriculare: string): Promise<string> {
    const { data, error } = await admin
      .from('vehicles')
      .insert({
        organization_id: organizationId,
        employee_id: employeeId,
        nr_inmatriculare: nrInmatriculare,
        marca: 'Dacia',
        model: 'Logan',
      } as never)
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Crearea vehiculului de test a eşuat.');
    return (data as { id: string }).id;
  }

  beforeAll(async () => {
    orgA = await creeazaOrganizatie(`Flota Test A ${sufix}`);
    orgB = await creeazaOrganizatie(`Flota Test B ${sufix}`);
    curatenie.push(() => admin.from('organizations').delete().eq('id', orgA));
    curatenie.push(() => admin.from('organizations').delete().eq('id', orgB));

    const emailSofer1 = `sofer1-${sufix}@test.administrativo.local`;
    const emailSofer2 = `sofer2-${sufix}@test.administrativo.local`;
    const uid1 = await creeazaUtilizatorAutentificat(emailSofer1);
    const uid2 = await creeazaUtilizatorAutentificat(emailSofer2);
    curatenie.push(() => admin.auth.admin.deleteUser(uid1));
    curatenie.push(() => admin.auth.admin.deleteUser(uid2));

    await adaugaMembru(orgA, uid1, ROL_SOFER);
    await adaugaMembru(orgA, uid2, ROL_SOFER);
    const eid1 = await creeazaAngajat(orgA, uid1, 'Şofer Unu Test');
    const eid2 = await creeazaAngajat(orgA, uid2, 'Şofer Doi Test');
    soferA1 = { userId: uid1, employeeId: eid1, email: emailSofer1 };
    soferA2 = { userId: uid2, employeeId: eid2, email: emailSofer2 };

    await acordaPermisiune(orgA, ROL_SOFER, 'vehicles', 'read', 'own');
    await acordaPermisiune(orgA, ROL_SOFER, 'trip_sheets', 'read', 'own');
    await acordaPermisiune(orgA, ROL_SOFER, 'trip_sheets', 'create', 'own');
    await acordaPermisiune(orgA, ROL_SOFER, 'trip_sheets', 'update', 'own');

    vehiculOrgA = await creeazaVehicul(orgA, eid1, `TSTA${sufix.slice(-4)}`);
    vehiculOrgB = await creeazaVehicul(orgB, null, `TSTB${sufix.slice(-4)}`);
    curatenie.push(() => admin.from('vehicles').delete().eq('id', vehiculOrgA));
    curatenie.push(() => admin.from('vehicles').delete().eq('id', vehiculOrgB));
  }, 30_000);

  afterAll(async () => {
    for (const pas of curatenie.reverse()) {
      await pas().catch(() => undefined);
    }
  });

  it('un vehicul din organizaţia B nu e vizibil unui utilizator din organizaţia A', async () => {
    const clientA1 = await clientCaUtilizator(soferA1.email);
    const { data, error } = await clientA1.from('vehicles').select('id').eq('id', vehiculOrgB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('un şofer vede doar foile de parcurs proprii', async () => {
    const { error: e1 } = await admin.from('trip_sheets').insert({
      organization_id: orgA,
      vehicle_id: vehiculOrgA,
      employee_id: soferA1.employeeId,
      plecare_la: new Date().toISOString(),
      km_plecare: 0,
    } as never);
    expect(e1).toBeNull();

    const { error: e2 } = await admin.from('trip_sheets').insert({
      organization_id: orgA,
      vehicle_id: vehiculOrgA,
      employee_id: soferA2.employeeId,
      plecare_la: new Date().toISOString(),
      km_plecare: 0,
    } as never);
    expect(e2).toBeNull();

    const clientA1 = await clientCaUtilizator(soferA1.email);
    const { data, error } = await clientA1.from('trip_sheets').select('id, employee_id').eq('vehicle_id', vehiculOrgA);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const rand of data ?? []) {
      expect((rand as { employee_id: string }).employee_id).toBe(soferA1.employeeId);
    }
  });

  it('reînnoirea unui RCA cu 3 săptămâni înainte de expirare nu produce eroare', async () => {
    const { data: tipRca, error: eTip } = await admin
      .from('vehicle_document_types')
      .select('id')
      .is('organization_id', null)
      .eq('cod', 'rca')
      .single();
    expect(eTip).toBeNull();
    const rcaTypeId = (tipRca as { id: string }).id;

    const azi = new Date();
    const zi = (offset: number) => {
      const d = new Date(azi);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    const { error: eVechi } = await admin.from('vehicle_documents').insert({
      organization_id: orgA,
      vehicle_id: vehiculOrgA,
      document_type_id: rcaTypeId,
      valabil_de_la: zi(-345),
      expira_la: zi(21),
    } as never);
    expect(eVechi).toBeNull();

    // Defectul real din planul iniţial: un EXCLUDE pe suprapunerea perioadelor
    // ar respinge acest INSERT. vdoc_curent_uq fiind parţial pe este_curent,
    // reînnoirea nu se ciocneşte de nimic.
    const { error: eNou } = await admin.from('vehicle_documents').insert({
      organization_id: orgA,
      vehicle_id: vehiculOrgA,
      document_type_id: rcaTypeId,
      valabil_de_la: zi(0),
      expira_la: zi(365),
    } as never);
    expect(eNou).toBeNull();

    const { data: docs, error: eList } = await admin
      .from('vehicle_documents')
      .select('expira_la, este_curent')
      .eq('vehicle_id', vehiculOrgA)
      .eq('document_type_id', rcaTypeId)
      .is('deleted_at', null);
    expect(eList).toBeNull();
    const curent = (docs ?? []).filter((d) => (d as { este_curent: boolean }).este_curent);
    expect(curent).toHaveLength(1);
    expect((curent[0] as { expira_la: string }).expira_la).toBe(zi(365));
  });

  it('regresul de kilometraj blochează, saltul doar avertizează', async () => {
    const vehicul = await creeazaVehicul(orgA, soferA1.employeeId, `TSTC${sufix.slice(-4)}`);
    curatenie.push(() => admin.from('vehicles').delete().eq('id', vehicul));

    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 2 * 3_600_000);

    const { error: e1 } = await admin.from('trip_sheets').insert({
      organization_id: orgA,
      vehicle_id: vehicul,
      employee_id: soferA1.employeeId,
      plecare_la: t0.toISOString(),
      sosire_la: t1.toISOString(),
      km_plecare: 0,
      km_sosire: 100,
      status: 'aprobat',
      aprobat_la: t1.toISOString(),
    } as never);
    expect(e1).toBeNull();

    const { data: vDupa1 } = await admin.from('vehicles').select('km_curent').eq('id', vehicul).single();
    expect((vDupa1 as { km_curent: number }).km_curent).toBe(100);

    // REGRES: 50 km < ultimul kilometraj cunoscut (100) => refuz explicit.
    const { error: eRegres } = await admin.from('trip_sheets').insert({
      organization_id: orgA,
      vehicle_id: vehicul,
      employee_id: soferA1.employeeId,
      plecare_la: new Date(t1.getTime() + 3_600_000).toISOString(),
      km_plecare: 50,
      status: 'draft',
    } as never);
    expect(eRegres).not.toBeNull();
    expect(eRegres?.message ?? '').toMatch(/mai mic decât ultimul|nu poate da înapoi/);

    // SALT: peste pragul implicit de 1.500 km => nu blochează, doar semnalează.
    const t2 = new Date(t1.getTime() + 24 * 3_600_000);
    const { data: foaie2, error: eSalt } = await admin
      .from('trip_sheets')
      .insert({
        organization_id: orgA,
        vehicle_id: vehicul,
        employee_id: soferA1.employeeId,
        plecare_la: t2.toISOString(),
        km_plecare: 100 + 1500 + 50,
        status: 'draft',
      } as never)
      .select('id')
      .single();
    expect(eSalt).toBeNull();

    const { data: anomalii, error: eAnom } = await admin
      .from('odometer_anomalies')
      .select('tip, km_asteptat, km_declarat')
      .eq('trip_sheet_id', (foaie2 as { id: string }).id);
    expect(eAnom).toBeNull();
    expect(anomalii).toHaveLength(1);
    expect((anomalii?.[0] as { tip: string }).tip).toBe('salt');
  });
});
```

```ts
// src/config/navigation.ts  — NU rescrie fişierul; liniile de mai jos se ADAUGĂ.

// 1) Dacă icon-urile din NAV_ITEMS sunt componente lucide-react (verificaţi
//    convenţia deja folosită de alte module, ex. HR), adăugaţi în blocul de
//    import-uri de sus:
import { Car, Route as RouteIcon, FileStack, Fuel } from 'lucide-react';

// 2) NAV_GROUPS — un grup nou, alături de cele existente (Operaţional/HR):
{
  id: 'flota',
  label: 'Flotă auto',
  order: /* următorul număr liber, după ultimul grup existent */,
}

// 3) NAV_ITEMS — patru intrări noi, toate cu featureKey: 'fleet' (modul
//    dezactivat => 404 prin requireFeature, nu ascundere de meniu — S2):
{
  id: 'flota-vehicule',
  label: 'Vehicule',
  href: '/flota/vehicule',
  icon: Car,
  group: 'flota',
  featureKey: 'fleet',
  permission: { key: 'vehicles:read', minScope: 'own' },
},
{
  id: 'flota-foi-parcurs',
  label: 'Foi de parcurs',
  href: '/flota/foi-parcurs',
  icon: RouteIcon,
  group: 'flota',
  featureKey: 'fleet',
  permission: { key: 'trip_sheets:read', minScope: 'own' },
},
{
  id: 'flota-documente',
  label: 'Documente şi scadenţe',
  href: '/flota/documente',
  icon: FileStack,
  group: 'flota',
  featureKey: 'fleet',
  permission: { key: 'vehicles:read', minScope: 'own' },
},
{
  id: 'flota-alimentari',
  label: 'Alimentări',
  href: '/flota/alimentari',
  icon: Fuel,
  group: 'flota',
  featureKey: 'fleet',
  permission: { key: 'trip_sheets:read', minScope: 'own' },
},

// 4) Dacă există PORTAL_NAV_ITEMS pentru angajaţi (employee_portal), adăugaţi
//    aici DOAR linkul şoferului spre foile lui proprii — minScope 'own', ca
//    să nu apară pentru cineva fără vehicul alocat:
{
  id: 'portal-flota',
  label: 'Foile mele de parcurs',
  href: '/portal/flota',
  icon: RouteIcon,
  featureKey: 'fleet',
  permission: { key: 'trip_sheets:read', minScope: 'own' },
}

// NOTĂ: numele exacte ale câmpurilor NavItem/NavLink (id/label/href/icon/
// featureKey/permission/group sau altele) nu erau în inventar — verificaţi
// tipurile reale din fişier înainte de a integra liniile de mai sus.
```

```sql
// supabase/seed-flota.sql
-- ============================================================================
-- DATE DEMO — Faza 8 (flotă auto). NU rula în producţie.
-- Rulare:
--   psql "$DATABASE_URL" -v org_id="'11111111-1111-1111-1111-111111111111'" \
--        -f supabase/seed-flota.sql
-- `org_id` e un literal uuid ÎNTRE GHILIMELE SIMPLE, pasat ca variabilă psql.
-- Presupune: organizaţia are deja modulul `fleet` activ (organization_features)
-- şi cel puţin 2 angajaţi (public.employees) — gardat mai jos.
-- ============================================================================

\if :{?org_id}
\else
  \echo 'Rulaţi cu -v org_id="''<uuid-organizaţie>''"'
  \quit
\endif

do $$
declare v_n integer;
begin
  select count(*) into v_n from public.employees
   where organization_id = :org_id and deleted_at is null;
  if v_n < 2 then
    raise exception using errcode = 'P0001',
      message = 'Organizaţia are mai puţin de 2 angajaţi activi — seed-ul de flotă are nevoie de cel puţin 2, pentru cei doi şoferi demo.';
  end if;
end
$$;

-- ── Vehicule ─────────────────────────────────────────────────────────────
insert into public.vehicles (organization_id, nr_inmatriculare, marca, model, categorie, tip_combustibil, an_fabricatie, km_curent, employee_id)
values (:org_id, 'B100DEM', 'Dacia', 'Logan', 'autoturism', 'motorina', 2021, 42000,
        (select id from public.employees where organization_id = :org_id and deleted_at is null order by created_at limit 1))
returning id as vehicul1_id \gset

insert into public.vehicles (organization_id, nr_inmatriculare, marca, model, categorie, tip_combustibil, an_fabricatie, km_curent, employee_id)
values (:org_id, 'B200DEM', 'Volkswagen', 'Transporter', 'autoutilitara', 'motorina', 2019, 118500,
        (select id from public.employees where organization_id = :org_id and deleted_at is null order by created_at limit 1 offset 1))
returning id as vehicul2_id \gset

select id as sofer1_id from public.employees where organization_id = :org_id and deleted_at is null order by created_at limit 1 \gset
select id as sofer2_id from public.employees where organization_id = :org_id and deleted_at is null order by created_at limit 1 offset 1 \gset

select id as tip_itp from public.vehicle_document_types where organization_id is null and cod = 'itp' \gset
select id as tip_rca from public.vehicle_document_types where organization_id is null and cod = 'rca' \gset
select id as tip_rov from public.vehicle_document_types where organization_id is null and cod = 'rovinieta' \gset

-- ── Documente: trei stări pe fiecare vehicul (expirat / expiră curând / în regulă) ──
insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, numar, valabil_de_la, expira_la, cost)
values
  (:org_id, :'vehicul1_id', :'tip_itp', 'ITP-DEMO-1', current_date - interval '1 year',  current_date - interval '10 days', 90.00),   -- expirat
  (:org_id, :'vehicul1_id', :'tip_rca', 'RCA-DEMO-1', current_date - interval '353 days', current_date + interval '12 days', 620.00), -- expiră curând
  (:org_id, :'vehicul1_id', :'tip_rov', 'ROV-DEMO-1', current_date - interval '115 days', current_date + interval '250 days', 555.00), -- în regulă
  (:org_id, :'vehicul2_id', :'tip_itp', 'ITP-DEMO-2', current_date - interval '65 days',  current_date + interval '300 days', 95.00),  -- în regulă
  (:org_id, :'vehicul2_id', :'tip_rca', 'RCA-DEMO-2', current_date - interval '373 days', current_date - interval '8 days', 780.00),   -- expirat
  (:org_id, :'vehicul2_id', :'tip_rov', 'ROV-DEMO-2', current_date - interval '356 days', current_date + interval '9 days', 555.00);   -- expiră curând

-- ── Foi de parcurs + alimentări ────────────────────────────────────────────
insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire, traseu, scop, status)
values (:org_id, :'vehicul1_id', :'sofer1_id', now() - interval '3 days', now() - interval '3 days' + interval '4 hours',
        42000, 42180, 'Bucureşti - Ploieşti - Bucureşti', 'Livrare marfă', 'trimis')
returning id as foaie1_id \gset

insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, statie, numar_bon, alimentat_la, plin)
values (:org_id, :'foaie1_id', 38.20, 261.15, 'OMV Ploieşti', 'BON-1001', now() - interval '3 days' + interval '2 hours', true);

insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire, traseu, scop, status, aprobat_la)
values (:org_id, :'vehicul1_id', :'sofer1_id', now() - interval '1 day', now() - interval '1 day' + interval '3 hours',
        42180, 42260, 'Bucureşti - Otopeni', 'Ridicare piese', 'aprobat', now() - interval '1 day' + interval '3 hours');

insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire, traseu, scop, status)
values (:org_id, :'vehicul2_id', :'sofer2_id', now() - interval '2 days', now() - interval '2 days' + interval '6 hours',
        118500, 118710, 'Bucureşti - Braşov', 'Transport echipamente', 'trimis')
returning id as foaie2_id \gset

insert into public.fuel_entries (organization_id, trip_sheet_id, litri, cost, statie, numar_bon, alimentat_la, plin)
values (:org_id, :'foaie2_id', 62.50, 425.00, 'Rompetrol Ploieşti', 'BON-2001', now() - interval '2 days' + interval '3 hours', true);

insert into public.trip_sheets (organization_id, vehicle_id, employee_id, plecare_la, sosire_la, km_plecare, km_sosire, traseu, scop, status, aprobat_la)
values (:org_id, :'vehicul2_id', :'sofer2_id', now() - interval '6 hours', now() - interval '2 hours',
        118710, 118900, 'Bucureşti local', 'Distribuţie', 'aprobat', now() - interval '2 hours');

\echo 'Seed flotă încărcat: 2 vehicule, 6 documente (2 expirate, 2 expiră curând, 2 în regulă), 4 foi de parcurs, 2 alimentări.'
```

=== CE RĂMÂNE DE FĂCUT — modulul de mentenanță (echipamente montate pe vehicule) ===

Motorul de expirări din 0008 e strict pe date calendaristice (`expira_la date`); intervalele de service reale sunt de multe ori kilometrice ("revizie la fiecare 15.000 km"), nu doar temporale. `expirables` nu are un câmp `expira_la_km`, deci mentenanța va avea nevoie fie de o extindere a `expirables` cu un al doilea prag (numeric, opţional), fie de un motor paralel care compară `vehicles.km_curent` (deja actualizat automat de `foi_parcurs_dupa`) cu o scadenţă kilometrică — verificarea nu poate fi un trigger pe un singur rând, pentru că kilometrajul se acumulează prin multe foi de parcurs succesive; cel mai natural loc e chiar `internal.foi_parcurs_dupa`, care oricum rulează la fiecare aprobare şi are deja `new.vehicle_id` şi noul `km_curent` la îndemână.

Pentru echipamentele propriu-zise (stingătoare montate, GPS, sisteme AdBlue, tahografe fizice — distincte de *documentele* omonime deja acoperite aici prin `vehicle_document_types`): tabelul de mentenanţă va avea nevoie de un FK opţional `vehicle_id` către `public.vehicles`, va reutiliza acelaşi tipar de nomenclator organizaţie-opţională ca `vehicle_document_types` (rânduri de platformă + rânduri proprii firmei) şi va reutiliza `app.poate_vedea_vehicul(organization_id, employee_id)` pentru vizibilitate, ca să nu se dubleze regula de scope 'own'/'team'/'all' deja scrisă aici. Dacă echipamentul are şi el o expirare pe dată (verificare periodică, calibrare), se proiectează în `expirables` la fel ca documentele — `entity_type` nou (ex. `'vehicle_equipment'`), înregistrat explicit în `app.poate_vedea_expirabil()`, cu acelaşi avertisment de gardă ca la finalul lui 0012.

Costul intervenţiilor de mentenanţă va vrea probabil o tabelă proprie de tip `service_interventions` (furnizor/garaj, piese, manoperă, cost total) — `vehicle_documents.cost` de aici acoperă doar costul *documentului* (ex. o revizie plătită ca atare), nu structura unei intervenţii cu mai multe linii de cost; asta e o decizie de design pentru Faza 9, nu ceva de inventat aici.

=== SEMNALĂRI (lucruri care nu erau în inventar) ===

1. **0012b, aşa cum a fost cerut, e deja livrat integral în 0012_fleet.sql.** Tot ce trebuia — trigger vehicle_documents → `internal.sync_expirable()`, `entity_type='vehicle_document'`, `kind=cod`, populare iniţială, `is_active=false` la vândut/casat — există în secţiunile 9, 13, 14 ale sursei de adevăr primite. Am scris 0012b ca migrare de VERIFICARE (eşuează tare dacă triggerele/funcţiile dispar), nu ca reimplementare, ca să nu produc `CREATE TRIGGER` duplicat (eroare la aplicare) sau logică dublată, interzisă explicit de regulile primite.
2. **Framework-ul de testare** nu era în inventar; am presupus vitest (`describe/it/expect`). Dacă proiectul foloseşte alt runner, doar sintaxa de import/assert se schimbă — scenariile testate rămân valabile.
3. **Numele câmpurilor din `clientEnv`/`serverEnv`** nu erau enumerate; testul citeşte direct `process.env.NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` ca ocolire sigură.
4. **Schema exactă** pentru `organizations`, `organization_members`, `employees`, `profiles`, `role_permissions` nu era în inventar (doar numele tabelelor). Testul face presupuneri explicit marcate (`ASUMĂRI A1-A5` în capul fişierului) despre coloane — trebuie confirmate din migrările 0001-0002/Faza 1a înainte de a rula.
5. **Un helper comun de fixture-uri RLS** (`tests/helpers/...`) ar putea exista deja din fazele anterioare, dat fiind că `tests/rls/flota.test.ts` sugerează o convenţie de folder repetată. Nu era în inventar, deci am scris fixture-urile local, în fişier; dacă un helper comun există, testul ar trebui refactorizat să-l refolosească, nu duplicat.
6. **Forma exactă a `NavItem`/`NavLink`** (nume de câmpuri, structura `NAV_GROUPS`) nu era în inventar — am descris adăugările cu o formă plauzibilă (`id/label/href/icon/featureKey/permission/group`), de verificat contra tipurilor reale înainte de integrare.
7. **Rutele `/flota/vehicule`, `/flota/foi-parcurs` etc.** sunt propunerea mea, nu rute confirmate din `src/app/(app)/` — nu erau în inventarul primit (doar `RUTA_*` pentru autentificare sunt confirmate).