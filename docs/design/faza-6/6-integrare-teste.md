```ts
// tests/rls/checklist.test.ts
/**
 * Teste de integrare (scrieri reale) pentru modulul de checklist (Faza 6):
 * 0014_checklist.sql — RLS + trigger-e.
 *
 * PRESUPUNERI NEVERIFICATE — nu au putut fi confirmate în regim read-only, fără
 * tool-uri; vezi secțiunea de semnalare de la finalul livrării înainte de a rula
 * această suită și ajustează ce diferă de codul real:
 *   1. clientEnv expune NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY.
 *   2. Runner-ul de teste este vitest (describe/it/expect/beforeAll/afterAll).
 *   3. public.organizations are coloanele (denumire, slug).
 *   4. public.employees are coloanele (organization_id, profile_id, nume, prenume)
 *      și alte coloane NOT NULL nedescrise (CNP, dată angajare etc.) pot exista —
 *      dacă insert-urile de mai jos eșuează pe NOT NULL, completează câmpurile lipsă.
 *   5. public.organization_members are coloanele (organization_id, profile_id, role)
 *      și public.profiles(id) e populat automat la crearea utilizatorului în auth
 *      (sau se poate upserta manual, cum se face mai jos).
 *   6. app.current_employee_id(organization_id) rezolvă angajatul curent pornind
 *      de la employees.profile_id = auth.uid().
 *   7. Valorile enumerate app_role folosite mai jos ('administrator', 'angajat')
 *      există în public.app_role.
 *   8. role_permissions conține deja, pentru rolurile folosite mai jos, intrările
 *      checklists:read/create/update la scopurile corespunzătoare — vezi
 *      secțiunea despre src/config/permissions.ts din livrare.
 *
 * Testele 1-4 folosesc clientul admin (bypass RLS) fiindcă verifică logică de
 * TRIGGER, independentă de rol. Testele 5-6 verifică efectiv RLS și au nevoie
 * de utilizatori autentificați reali.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { clientEnv } from '@/config/env'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

const PAROLA_TEST = 'Test-parola-#2026!'

async function clientCaUtilizator(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
  const { error } = await client.auth.signInWithPassword({ email, password: PAROLA_TEST })
  if (error) throw new Error(`Autentificare eșuată pentru ${email}: ${error.message}`)
  return client
}

async function creazaUtilizator(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PAROLA_TEST,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Nu s-a putut crea utilizatorul de test ${email}: ${error?.message}`)
  }
  // Best-effort: dacă nu există trigger de auto-provizionare a profilului.
  await admin.from('profiles').upsert({ id: data.user.id, email } as never)
  return data.user.id
}

describe('checklist — trigger-e (0014_checklist.sql)', () => {
  const admin = createAdminSupabase()

  let orgA: string
  let angajatOnboarding: string
  let angajatOffboarding: string
  let sablonOnboarding: string
  let sablonOffboarding: string

  beforeAll(async () => {
    const { data: org, error: eOrg } = await admin
      .from('organizations')
      .insert({ denumire: 'Test Checklist SRL', slug: `test-checklist-${Date.now()}` } as never)
      .select('id')
      .single()
    if (eOrg || !org) throw new Error(`Setup organizație eșuat: ${eOrg?.message}`)
    orgA = org.id as string

    const { data: angajati, error: eAng } = await admin
      .from('employees')
      .insert([
        { organization_id: orgA, nume: 'Popescu', prenume: 'Ion' },
        { organization_id: orgA, nume: 'Ionescu', prenume: 'Maria' },
      ] as never)
      .select('id')
    if (eAng || !angajati || angajati.length !== 2) {
      throw new Error(`Setup angajați eșuat: ${eAng?.message}`)
    }
    angajatOnboarding = angajati[0]!.id as string
    angajatOffboarding = angajati[1]!.id as string

    const { data: sabloane, error: eSab } = await admin
      .from('checklist_templates')
      .insert([
        { organization_id: orgA, denumire: 'Onboarding test', tip: 'onboarding' },
        { organization_id: orgA, denumire: 'Offboarding test', tip: 'offboarding' },
      ] as never)
      .select('id')
    if (eSab || !sabloane || sabloane.length !== 2) {
      throw new Error(`Setup șabloane eșuat: ${eSab?.message}`)
    }
    sablonOnboarding = sabloane[0]!.id as string
    sablonOffboarding = sabloane[1]!.id as string

    const { error: eItemsOnb } = await admin.from('checklist_template_items').insert([
      {
        organization_id: orgA,
        template_id: sablonOnboarding,
        ordine: 1,
        titlu: 'Pregătire echipament IT',
        responsabil_tip: 'manager_direct',
        termen_zile_relativ: -3,
        obligatoriu: true,
        tip_dovada: 'bifa',
      },
    ] as never)
    if (eItemsOnb) throw new Error(`Setup pași onboarding eșuat: ${eItemsOnb.message}`)

    const { error: eItemsOff } = await admin.from('checklist_template_items').insert([
      {
        organization_id: orgA,
        template_id: sablonOffboarding,
        ordine: 1,
        titlu: 'Returnare echipamente și bunuri ale companiei',
        responsabil_tip: 'manager_direct',
        termen_zile_relativ: 0,
        obligatoriu: true,
        tip_dovada: 'bifa',
        verificare_automata: 'inventar_returnat',
      },
      {
        organization_id: orgA,
        template_id: sablonOffboarding,
        ordine: 2,
        titlu: 'Revocare acces la sisteme',
        responsabil_tip: 'manager_direct',
        termen_zile_relativ: 0,
        obligatoriu: true,
        tip_dovada: 'bifa',
      },
      {
        organization_id: orgA,
        template_id: sablonOffboarding,
        ordine: 3,
        titlu: 'Interviu de ieșire',
        responsabil_tip: 'manager_direct',
        termen_zile_relativ: -2,
        obligatoriu: false,
        tip_dovada: 'bifa',
      },
    ] as never)
    if (eItemsOff) throw new Error(`Setup pași offboarding eșuat: ${eItemsOff.message}`)
  })

  afterAll(async () => {
    // Presupune ON DELETE CASCADE organizations -> employees/checklist_* (fundația Fazei 1a/2).
    await admin.from('organizations').delete().eq('id', orgA)
  })

  it('offboarding cu un bun nereturnat NU se poate finaliza, iar mesajul indică bunul', async () => {
    const { data: item, error: eItem } = await admin
      .from('inventory_items')
      .insert({ organization_id: orgA, denumire: 'Laptop Dell Latitude 5540', cod: 'INV-0042' } as never)
      .select('id')
      .single()
    if (eItem || !item) throw new Error(`Setup obiect inventar eșuat: ${eItem?.message}`)

    const { error: eAlocare } = await admin.from('inventory_allocations').insert({
      organization_id: orgA,
      inventory_item_id: item.id,
      employee_id: angajatOffboarding,
      predat_la: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      returnat_la: null,
    } as never)
    if (eAlocare) throw new Error(`Setup alocare inventar eșuat: ${eAlocare.message}`)

    const { data: instanta, error: eInst } = await admin
      .from('checklist_instances')
      .insert({
        organization_id: orgA,
        template_id: sablonOffboarding,
        employee_id: angajatOffboarding,
        data_referinta: new Date().toISOString().slice(0, 10),
      } as never)
      .select('id')
      .single()
    if (eInst || !instanta) throw new Error(`Setup instanță offboarding eșuat: ${eInst?.message}`)

    const { data: pasi } = await admin
      .from('checklist_instance_items')
      .select('id, ordine')
      .eq('instance_id', instanta.id)
      .order('ordine')

    // Bifează pasul 2 (obligatoriu, manual); pasul 3 (interviu) rămâne nebifat — nu e obligatoriu.
    await admin
      .from('checklist_instance_items')
      .update({ status: 'bifat' } as never)
      .eq('id', pasi![1]!.id)

    const { error: eFinalizare } = await admin
      .from('checklist_instances')
      .update({ status: 'finalizata' } as never)
      .eq('id', instanta.id)

    expect(eFinalizare).not.toBeNull()
    expect(eFinalizare?.message).toContain('Laptop Dell Latitude 5540')
    expect(eFinalizare?.message).toContain('INV-0042')

    // Returnarea bunului trebuie să bifeze SINGUR pasul automat, fără intervenție manuală.
    const { data: alocare } = await admin
      .from('inventory_allocations')
      .select('id')
      .eq('organization_id', orgA)
      .eq('employee_id', angajatOffboarding)
      .is('returnat_la', null)
      .single()

    await admin
      .from('inventory_allocations')
      .update({ returnat_la: new Date().toISOString() } as never)
      .eq('id', alocare!.id)

    const { data: pasAutomat } = await admin
      .from('checklist_instance_items')
      .select('status, bifat_automat, bifat_de')
      .eq('id', pasi![0]!.id)
      .single()
    expect(pasAutomat?.status).toBe('bifat')
    expect(pasAutomat?.bifat_automat).toBe(true)
    expect(pasAutomat?.bifat_de).toBeNull()

    const { error: eFinalizare2 } = await admin
      .from('checklist_instances')
      .update({ status: 'finalizata' } as never)
      .eq('id', instanta.id)
    expect(eFinalizare2).toBeNull()

    const { data: dovada } = await admin
      .from('checklist_completion_records')
      .select('total_pasi, pasi_bifati, pasi_obligatorii, continut_checksum')
      .eq('instance_id', instanta.id)
      .single()
    expect(dovada?.total_pasi).toBe(3)
    expect(dovada?.pasi_bifati).toBe(2)
    expect(dovada?.pasi_obligatorii).toBe(2)
    expect(dovada?.continut_checksum).toBeTruthy()
  })

  it('un angajat reangajat primește un al doilea ciclu de onboarding, nu e blocat de cheia unică', async () => {
    const { data: ciclu1, error: e1 } = await admin
      .from('checklist_instances')
      .insert({
        organization_id: orgA,
        template_id: sablonOnboarding,
        employee_id: angajatOnboarding,
        data_referinta: new Date().toISOString().slice(0, 10),
      } as never)
      .select('id, ciclu')
      .single()
    expect(e1).toBeNull()
    expect(ciclu1?.ciclu).toBe(1)

    const { data: ciclu2, error: e2 } = await admin
      .from('checklist_instances')
      .insert({
        organization_id: orgA,
        template_id: sablonOnboarding,
        employee_id: angajatOnboarding,
        data_referinta: new Date().toISOString().slice(0, 10),
      } as never)
      .select('id, ciclu')
      .single()
    expect(e2).toBeNull()
    expect(ciclu2?.ciclu).toBe(2)
    expect(ciclu2?.id).not.toBe(ciclu1?.id)
  })

  it('modificarea șablonului după crearea instanței NU schimbă textul pașilor instanței', async () => {
    const { data: instanta } = await admin
      .from('checklist_instances')
      .insert({
        organization_id: orgA,
        template_id: sablonOnboarding,
        employee_id: angajatOnboarding,
        data_referinta: new Date().toISOString().slice(0, 10),
      } as never)
      .select('id')
      .single()

    const { data: pasInstanta } = await admin
      .from('checklist_instance_items')
      .select('id, titlu, template_item_id')
      .eq('instance_id', instanta!.id)
      .eq('ordine', 1)
      .single()
    expect(pasInstanta?.titlu).toBe('Pregătire echipament IT')

    await admin
      .from('checklist_template_items')
      .update({ titlu: 'Cu totul altceva' } as never)
      .eq('id', pasInstanta!.template_item_id as string)

    const { data: pasDupa } = await admin
      .from('checklist_instance_items')
      .select('titlu')
      .eq('id', pasInstanta!.id)
      .single()
    expect(pasDupa?.titlu).toBe('Pregătire echipament IT')

    const { error: eBlocat } = await admin
      .from('checklist_instance_items')
      .update({ titlu: 'Încercare de ocolire' } as never)
      .eq('id', pasInstanta!.id)
    expect(eBlocat).not.toBeNull()
    expect(eBlocat?.message).toContain('nu se modifică')
  })
})

describe('checklist — RLS (vizibilitate pe instanțe)', () => {
  const admin = createAdminSupabase()
  let orgA: string
  let orgB: string
  let sablonA: string
  let sablonB: string
  let emailSelf: string
  let instantaSelf: string
  let instantaColeg: string
  let instantaOrgB: string

  beforeAll(async () => {
    const { data: orgs } = await admin
      .from('organizations')
      .insert([
        { denumire: 'RLS A SRL', slug: `rls-a-${Date.now()}` },
        { denumire: 'RLS B SRL', slug: `rls-b-${Date.now()}` },
      ] as never)
      .select('id')
    orgA = orgs![0]!.id as string
    orgB = orgs![1]!.id as string

    const { data: sabloane } = await admin
      .from('checklist_templates')
      .insert([
        { organization_id: orgA, denumire: 'Onboarding RLS', tip: 'onboarding' },
        { organization_id: orgB, denumire: 'Onboarding RLS B', tip: 'onboarding' },
      ] as never)
      .select('id')
    sablonA = sabloane![0]!.id as string
    sablonB = sabloane![1]!.id as string

    emailSelf = `checklist-self-${Date.now()}@exemplu.test`
    const idSelf = await creazaUtilizator(admin, emailSelf)

    const { data: angajati } = await admin
      .from('employees')
      .insert([
        { organization_id: orgA, profile_id: idSelf, nume: 'Vasile', prenume: 'Ana' },
        { organization_id: orgA, nume: 'Georgescu', prenume: 'Dan' },
        { organization_id: orgB, nume: 'Radu', prenume: 'Elena' },
      ] as never)
      .select('id')
    const employeeSelf = angajati![0]!.id as string
    const employeeColeg = angajati![1]!.id as string
    const employeeOrgB = angajati![2]!.id as string

    await admin.from('organization_members').insert({
      organization_id: orgA,
      profile_id: idSelf,
      role: 'angajat',
    } as never)

    const { data: instante } = await admin
      .from('checklist_instances')
      .insert([
        {
          organization_id: orgA,
          template_id: sablonA,
          employee_id: employeeSelf,
          data_referinta: new Date().toISOString().slice(0, 10),
        },
        {
          organization_id: orgA,
          template_id: sablonA,
          employee_id: employeeColeg,
          data_referinta: new Date().toISOString().slice(0, 10),
        },
        {
          organization_id: orgB,
          template_id: sablonB,
          employee_id: employeeOrgB,
          data_referinta: new Date().toISOString().slice(0, 10),
        },
      ] as never)
      .select('id')
    instantaSelf = instante![0]!.id as string
    instantaColeg = instante![1]!.id as string
    instantaOrgB = instante![2]!.id as string
  })

  afterAll(async () => {
    await admin.from('organizations').delete().eq('id', orgA)
    await admin.from('organizations').delete().eq('id', orgB)
  })

  it('un angajat vede propriul checklist, nu pe al colegului, și nu pe cel din altă organizație', async () => {
    const utilizator = await clientCaUtilizator(emailSelf)
    const { data, error } = await utilizator.from('checklist_instances').select('id')
    expect(error).toBeNull()
    const idVizibile = (data ?? []).map((r) => r.id)
    expect(idVizibile).toContain(instantaSelf)
    expect(idVizibile).not.toContain(instantaColeg)
    expect(idVizibile).not.toContain(instantaOrgB)
  })
})
```

```sql
-- supabase/seed-checklist.sql
-- DEMO: date de exemplu pentru modulul de checklist (Faza 6).
-- Rulează după 0014_checklist.sql și după seed-urile Nucleu + HR + Inventar.
-- Idempotent: re-rularea nu duplică șabloane/pași/instanțe deja create.
--
-- PRESUPUNERI (vezi semnalarea de la finalul livrării):
--   - există deja cel puțin o organizație și doi angajați activi;
--   - public.organizations(denumire, slug); public.employees(nume, prenume).

do $$
declare
  v_org uuid;
  v_ang_onboarding uuid;
  v_ang_offboarding uuid;
  v_sablon_onb uuid;
  v_sablon_off uuid;
  v_item_id uuid;
  v_alocare_id uuid;
  v_item_denumire text := 'Laptop Dell Latitude 5540';
  v_item_cod text := 'INV-0042';
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then
    raise notice 'seed-checklist: nu există nicio organizație — rulează întâi seed-ul de bază.';
    return;
  end if;

  select id into v_ang_onboarding
    from public.employees
   where organization_id = v_org and deleted_at is null
   order by created_at
   limit 1;

  select id into v_ang_offboarding
    from public.employees
   where organization_id = v_org and deleted_at is null and id <> v_ang_onboarding
   order by created_at
   offset 1 limit 1;

  if v_ang_onboarding is null or v_ang_offboarding is null then
    raise notice 'seed-checklist: sunt necesari cel puțin doi angajați în organizația demo.';
    return;
  end if;

  -- ---------------------------------------------------------------------
  -- Șablon onboarding — 8 pași (get-or-create, ca reluarea seed-ului să nu dubleze)
  -- ---------------------------------------------------------------------
  select id into v_sablon_onb from public.checklist_templates
   where organization_id = v_org and tip = 'onboarding'
     and lower(btrim(denumire)) = lower('Integrare angajat nou — DEMO')
     and deleted_at is null;

  if v_sablon_onb is null then
    insert into public.checklist_templates (organization_id, denumire, tip, descriere, activ)
    values (v_org, 'Integrare angajat nou — DEMO', 'onboarding',
            'Șablon demonstrativ de integrare, aplicabil oricărui post.', true)
    returning id into v_sablon_onb;

    insert into public.checklist_template_items
      (organization_id, template_id, ordine, titlu, descriere, responsabil_tip,
       termen_zile_relativ, obligatoriu, tip_dovada, verificare_automata)
    values
      (v_org, v_sablon_onb, 1, 'Pregătire echipament IT (laptop, telefon)',
       'Se pregătește înainte de prima zi.', 'manager_direct', -3, true, 'bifa', null),
      (v_org, v_sablon_onb, 2, 'Creare cont e-mail și acces la sisteme interne',
       null, 'manager_direct', -1, true, 'bifa', null),
      (v_org, v_sablon_onb, 3, 'Semnare contract individual de muncă',
       null, 'manager_direct', 0, true, 'semnatura', null),
      (v_org, v_sablon_onb, 4, 'Instruire SSM la angajare',
       'Obligatorie înainte de începerea activității.', 'manager_direct', 0, true, 'bifa', null),
      (v_org, v_sablon_onb, 5, 'Predare echipamente și materiale de lucru',
       null, 'manager_direct', 0, true, 'bifa', null),
      (v_org, v_sablon_onb, 6, 'Prezentare regulament intern și cultură organizațională',
       null, 'manager_direct', 1, true, 'bifa', null),
      (v_org, v_sablon_onb, 7, 'Stabilire obiective pentru perioada de probă',
       null, 'manager_direct', 5, true, 'bifa', null),
      (v_org, v_sablon_onb, 8, 'Verificare integrare la 30 de zile',
       'Discuție de follow-up cu managerul direct.', 'manager_direct', 30, false, 'bifa', null);
  end if;

  -- ---------------------------------------------------------------------
  -- Șablon offboarding — 6 pași
  -- ---------------------------------------------------------------------
  select id into v_sablon_off from public.checklist_templates
   where organization_id = v_org and tip = 'offboarding'
     and lower(btrim(denumire)) = lower('Plecare angajat — DEMO')
     and deleted_at is null;

  if v_sablon_off is null then
    insert into public.checklist_templates (organization_id, denumire, tip, descriere, activ)
    values (v_org, 'Plecare angajat — DEMO', 'offboarding',
            'Șablon demonstrativ de offboarding, aplicabil oricărui post.', true)
    returning id into v_sablon_off;

    insert into public.checklist_template_items
      (organization_id, template_id, ordine, titlu, descriere, responsabil_tip,
       termen_zile_relativ, obligatoriu, tip_dovada, verificare_automata)
    values
      (v_org, v_sablon_off, 1, 'Returnare echipamente și bunuri ale companiei',
       'Se sincronizează automat cu modulul Inventar.', 'manager_direct', 0, true, 'bifa', 'inventar_returnat'),
      (v_org, v_sablon_off, 2, 'Revocare acces la sisteme și conturi',
       null, 'manager_direct', 0, true, 'bifa', null),
      (v_org, v_sablon_off, 3, 'Semnare document de încetare a raporturilor de muncă',
       null, 'manager_direct', 0, true, 'semnatura', null),
      (v_org, v_sablon_off, 4, 'Interviu de ieșire',
       null, 'manager_direct', -2, false, 'bifa', null),
      (v_org, v_sablon_off, 5, 'Emitere documente (adeverințe, decizie de încetare)',
       null, 'manager_direct', 2, true, 'document', null),
      (v_org, v_sablon_off, 6, 'Predare acces fizic (cartelă, chei)',
       null, 'manager_direct', 0, true, 'bifa', null);
  end if;

  -- ---------------------------------------------------------------------
  -- Instanță 1: onboarding în curs, fără blocaje
  -- ---------------------------------------------------------------------
  if not exists (
    select 1 from public.checklist_instances
     where organization_id = v_org and employee_id = v_ang_onboarding
       and template_id = v_sablon_onb and deleted_at is null
  ) then
    insert into public.checklist_instances (organization_id, template_id, employee_id, data_referinta, observatii)
    values (v_org, v_sablon_onb, v_ang_onboarding, current_date, 'DEMO — integrare în curs, fără blocaje.');
  end if;

  -- ---------------------------------------------------------------------
  -- Instanță 2: offboarding blocat de un bun nereturnat
  -- ---------------------------------------------------------------------
  if not exists (
    select 1 from public.checklist_instances
     where organization_id = v_org and employee_id = v_ang_offboarding
       and template_id = v_sablon_off and deleted_at is null
  ) then
    if not exists (
      select 1 from public.inventory_allocations
       where organization_id = v_org and employee_id = v_ang_offboarding
         and predat_la is not null and returnat_la is null and deleted_at is null
    ) then
      begin
        insert into public.inventory_items (organization_id, denumire, cod)
        values (v_org, v_item_denumire, v_item_cod)
        returning id into v_item_id;

        insert into public.inventory_allocations
          (organization_id, inventory_item_id, employee_id, predat_la, returnat_la)
        values (v_org, v_item_id, v_ang_offboarding, now() - interval '90 days', null)
        returning id into v_alocare_id;
      exception when others then
        raise notice 'seed-checklist: nu s-a putut crea alocarea DEMO de inventar (%). Verifică schema reală a Inventarului.', sqlerrm;
      end;
    end if;

    insert into public.checklist_instances (organization_id, template_id, employee_id, data_referinta, observatii)
    values (v_org, v_sablon_off, v_ang_offboarding, current_date,
            format('DEMO — blocat: %s (%s) încă nu a fost returnat.', v_item_denumire, v_item_cod));
  end if;

  raise notice 'seed-checklist: OK — organizație %, angajați % / %.', v_org, v_ang_onboarding, v_ang_offboarding;
end;
$$;
```

```ts
// src/config/navigation.ts  (NU se rescrie — mai jos e DOAR adăugarea propusă)
// Formă exactă a NavItem nu a putut fi confirmată (fișierul nu e în inventar pentru
// citire); structura de mai jos e ilustrativă și trebuie aliniată la forma reală
// (nume de câmpuri, convenția de rute, tipul de badge) înainte de aplicare.
//
// Se adaugă un grup nou (sau intrări într-un grup HR existent), condiționat de
// featureKey: 'onboarding', cu DOUĂ intrări:
//
// 1. „Șabloane checklist” — administrarea checklist_templates / checklist_template_items.
//    permission: 'checklists:update', minScope: 'all' (doar cine poate configura procesul).
// 2. „Checklist-uri” — checklist_instances în curs (onboarding/offboarding/transfer).
//    permission: 'checklists:read', minScope: 'own' (vizibil oricărui angajat pentru
//    propriul checklist; managerii/adminii văd mai mult prin filtrare pe scope în pagină,
//    nu prin navigație — cf. S2).
//
// Exemplu ilustrativ (ajustează la forma reală a NavItem/NavLink):
const INTRARI_ONBOARDING_PROPUSE = [
  {
    label: 'Șabloane checklist',
    href: '/onboarding/sabloane',
    feature: 'onboarding',
    permission: 'checklists:update',
    minScope: 'all',
  },
  {
    label: 'Checklist-uri',
    href: '/onboarding/checklist',
    feature: 'onboarding',
    permission: 'checklists:read',
    minScope: 'own',
  },
] as const
```

```ts
// src/config/permissions.ts  (verificare — NU s-a putut citi conținutul real)
// Resursa „checklists” apare deja în vocabularul documentat al PermissionKey
// (secțiunea API din sarcină), dar prezența ei acolo e documentație de contract,
// nu dovadă că PERMISSION_KEYS conține deja intrările concrete. Fără acces de
// citire nu pot confirma dacă lipsesc. Migrarea 0014_checklist.sql are nevoie
// STRICT de aceste trei chei (RLS-ul nu folosește delete/approve/export pe
// checklists în această fază):
//
//   'checklists:read'
//   'checklists:create'
//   'checklists:update'
//
// Dacă lipsesc din PERMISSION_KEYS, adaugă-le în ordine alfabetică a resursei
// (între 'branding:*' și 'compliance:*'):
const PERMISSION_KEYS_DE_ADAUGAT = [
  'checklists:read',
  'checklists:create',
  'checklists:update',
] as const
```

```sql
-- supabase/migrations/0002_authz.sql  (verificare — NU s-a putut citi conținutul real)
-- Dacă seed-ul de acolo nu conține deja rânduri role_permissions pentru resursa
-- „checklists”, testul src/config/permissions.test.ts va eșua (compară codul cu
-- seed-ul). Propunere minimă, aliniată la RLS din 0014_checklist.sql — ajustează
-- numele de rol la valorile reale din public.app_role/APP_ROLES:
--
-- insert into public.role_permissions (role, permission_key, scope) values
--   ('administrator', 'checklists:read',   'all'),
--   ('administrator', 'checklists:create', 'all'),
--   ('administrator', 'checklists:update', 'all'),
--   ('manager',       'checklists:read',   'team'),
--   ('manager',       'checklists:create', 'team'),
--   ('manager',       'checklists:update', 'team'),
--   ('angajat',       'checklists:read',   'own'),
--   ('angajat',       'checklists:update', 'own');
```

## SEMNALĂRI

Nu am putut citi niciun fișier real (regim read-only, fără tool-uri), deci tot ce urmează e neverificat și trebuie confirmat de un agent cu acces de citire înainte de aplicare:

1. **`src/config/navigation.ts`** — forma exactă a `NavItem`/`NavLink` (nume de câmpuri, convenție de rute, mecanism de badge) nu e în inventar. Am descris intrările necesare (Șabloane checklist / Checklist-uri, gated pe `feature: 'onboarding'`) dar nu pot garanta că rutele `/onboarding/sabloane` și `/onboarding/checklist` corespund convenției reale.

2. **`src/config/permissions.ts` + `0002_authz.sql`** — nu am putut confirma dacă `checklists:read/create/update` există deja. Migrarea 0014 le folosește direct în RLS; dacă lipsesc din oricare loc, `checklist.test.ts` de mai sus și RLS-ul din 0014 eșuează la runtime (nu la aplicarea migrării, care nu validează valorile de `permission_key`). Am dat exact ce trebuie adăugat în ambele locuri, condiționat.

3. **Schema `employees`/`organizations`/`organization_members`/`profiles`** — am presupus `organizations(denumire, slug)`, `employees(organization_id, profile_id, nume, prenume)`, `organization_members(organization_id, profile_id, role)`, și că `app.current_employee_id()` leagă utilizatorul curent de un `employees.profile_id`. Niciuna dintre aceste coloane nu e în inventarul dat. Dacă numele diferă (de exemplu `user_id` în loc de `profile_id`, sau `employees` are coloane suplimentare `NOT NULL` precum CNP/dată angajare), testele din `tests/rls/checklist.test.ts` eșuează la insert, nu la assert.

4. **Valorile `public.app_role`** — am folosit `'administrator'` și `'angajat'` ca placeholder-e; valorile reale trebuie confirmate din `@/lib/tenant/types` (`APP_ROLES`).

5. **`clientEnv`** — am presupus `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY`; numele exacte nu sunt în inventar.

6. **Runner-ul de teste** — am presupus `vitest`; dacă proiectul folosește alt runner, importurile din antetul fișierului de test trebuie schimbate.