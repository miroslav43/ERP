```sql
-- supabase/migrations/0011b_ssm_expirables.sql
-- Faza 7 — completare: integrarea explicită SSM/PSI/mentenanță → expirables,
-- cu populare inițială pentru rândurile deja existente la momentul aplicării.
-- Idempotentă intenționat (create or replace / drop+create trigger), ca să poată fi
-- reaplicată în siguranță indiferent dacă 0011_ssm.sql a rulat deja integral pe mediul
-- țintă. Nu creează tabele noi de alerte și nu duplică logica de praguri — reutilizează
-- exact funcțiile din 0011_ssm.sql și pe internal.sync_expirable() (0008_expirables.sql).

-- ───────────  1. RE-ASERTAREA TRIGGERELOR DE SINCRONIZARE (idempotent)  ───────────
drop trigger if exists ssm_trainings_exp on public.ssm_trainings;
create trigger ssm_trainings_exp after insert or update on public.ssm_trainings
  for each row execute function internal.ssm_training_sync();

drop trigger if exists fire_extinguishers_exp on public.fire_extinguishers;
create trigger fire_extinguishers_exp after insert or update on public.fire_extinguishers
  for each row execute function internal.ssm_extinguisher_sync();

drop trigger if exists health_exams_exp on public.occupational_health_exams;
create trigger health_exams_exp after insert or update on public.occupational_health_exams
  for each row execute function internal.ssm_exam_sync();

drop trigger if exists iscir_authorizations_exp on public.iscir_authorizations;
create trigger iscir_authorizations_exp after insert or update on public.iscir_authorizations
  for each row execute function internal.ssm_sync_exp(
    'iscir_authorization', '@tip', 'Autorizație ISCIR', 'valabil_pana', 'equipment_id', '');

drop trigger if exists personnel_authorizations_exp on public.personnel_authorizations;
create trigger personnel_authorizations_exp after insert or update on public.personnel_authorizations
  for each row execute function internal.ssm_sync_exp(
    'personnel_authorization', '@tip', 'Autorizație nominală', 'valabil_pana', 'employee_id', 'employee_id');

drop trigger if exists environmental_permits_exp on public.environmental_permits;
create trigger environmental_permits_exp after insert or update on public.environmental_permits
  for each row execute function internal.ssm_sync_exp(
    'environmental_permit', 'valabilitate', 'Autorizație de mediu', 'valabil_pana', 'id', 'responsabil_employee_id');

drop trigger if exists maintenance_plans_exp on public.maintenance_plans;
create trigger maintenance_plans_exp after insert or update on public.maintenance_plans
  for each row execute function internal.ssm_sync_exp(
    'maintenance_plan', 'scadenta', 'Mentenanță planificată', 'urmatoarea_scadenta', 'id', 'responsabil_employee_id');

-- ───────────────────────  2. POPULARE INIȚIALĂ (backfill)  ───────────────────────
-- „set updated_at = updated_at” e un no-op semantic care re-declanșează triggerele
-- AFTER de mai sus pe rândurile deja existente (de ex. inserate de seed-ssm.sql sau
-- de o aplicare parțială anterioară). internal.set_actor() suprascrie oricum
-- updated_at = now() la orice UPDATE, deci nu contează valoarea atribuită aici.
-- Toate funcțiile țintă sunt idempotente (sync_expirable face upsert pe cheia
-- (organization_id, entity_type, entity_id, kind)), deci re-rularea e sigură.
update public.ssm_trainings set updated_at = updated_at where deleted_at is null;
update public.fire_extinguishers set updated_at = updated_at where deleted_at is null;
update public.occupational_health_exams set updated_at = updated_at where deleted_at is null;
update public.iscir_authorizations set updated_at = updated_at where deleted_at is null;
update public.personnel_authorizations set updated_at = updated_at where deleted_at is null;
update public.environmental_permits set updated_at = updated_at where deleted_at is null;
update public.maintenance_plans set updated_at = updated_at where deleted_at is null;

-- ─────────  3. app.poate_vedea_expirabil() — rescriere completă (idempotentă)  ─────────
-- Identică semantic cu 0011_ssm.sql §8: toate ramurile vechi (medical_exam,
-- employee_document, work_permit, employment_contract, vehicle_document,
-- inventory_item) + toate cele opt noi introduse de Faza 7. Reprodusă aici ca
-- „create or replace" pur defensiv, pentru cazul în care 0011b ajunge aplicată
-- independent de 0011_ssm.sql pe un mediu care are deja tabelele dar nu și funcția.
create or replace function app.poate_vedea_expirabil(p_org uuid, p_entity_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_entity_type
    when 'medical_exam'             then app.feature_on(p_org,'ssm')        and app.can(p_org,'ssm','read','team')
    when 'employee_document'        then app.can(p_org,'employees','read','team')
    when 'work_permit'              then app.can(p_org,'employees','read','team')
    when 'employment_contract'      then app.can(p_org,'employees','read','team')
    when 'vehicle_document'         then app.feature_on(p_org,'fleet')       and app.can(p_org,'vehicles','read','team')
    when 'equipment'                then app.feature_on(p_org,'maintenance') and app.can(p_org,'maintenance','read','team')
    when 'fire_extinguisher'        then app.feature_on(p_org,'ssm')         and app.can(p_org,'ssm','read','team')
    when 'ssm_training'             then app.feature_on(p_org,'ssm')         and app.can(p_org,'ssm','read','team')
    when 'environmental_permit'     then app.feature_on(p_org,'ssm')         and app.can(p_org,'compliance','read','team')
    when 'inventory_item'           then app.feature_on(p_org,'inventory')   and app.can(p_org,'inventory','read','team')
    when 'iscir_authorization'      then app.feature_on(p_org,'maintenance') and app.can(p_org,'maintenance','read','team')
    when 'maintenance_plan'         then app.feature_on(p_org,'maintenance') and app.can(p_org,'maintenance','read','team')
    when 'personnel_authorization'  then app.feature_on(p_org,'ssm')         and app.can(p_org,'ssm','read','team')
    when 'ppe_issuance'             then app.feature_on(p_org,'ssm')         and app.can(p_org,'ssm','read','team')
    else false
  end
$$;

revoke all on function app.poate_vedea_expirabil(uuid, text) from public, anon;
grant execute on function app.poate_vedea_expirabil(uuid, text) to authenticated;
```

```ts
// src/domain/ssm/autorizare-iscir.ts
import type { DateString } from '@/lib/format/date';

/** Angajatul propus ca responsabil pe un echipament sub incidența ISCIR. */
export interface AngajatPentruIscir {
  readonly id: string;
  readonly numeComplet: string;
}

/** Doar câmpurile echipamentului relevante pentru verificarea autorizării. */
export interface EchipamentPentruIscir {
  readonly esteIscir: boolean;
  readonly tipAutorizareNecesara: string | null;
}

/** O autorizație nominală de personal, așa cum e stocată în public.personnel_authorizations. */
export interface AutorizatieNominala {
  readonly employeeId: string;
  readonly tip: string;
  readonly valabilPana: DateString;
  readonly suspendataLa: DateString | null;
}

export type RezultatAsignareIscir =
  | { readonly permisa: true }
  | { readonly permisa: false; readonly motiv: string };

function esteValabilaLa(autorizatie: AutorizatieNominala, astazi: DateString): boolean {
  return autorizatie.suspendataLa === null && autorizatie.valabilPana >= astazi;
}

/**
 * Verifică, în afara bazei de date, dacă un angajat poate fi desemnat responsabil pe
 * un echipament ISCIR. Oglindește regula din triggerul internal.ssm_iscir_guard()
 * (supabase/migrations/0011_ssm.sql), FĂRĂ componenta de derogare — derogarea ține de
 * rolul actorului din sesiune (org_admin/super_admin + motiv scris), nu de datele de
 * intrare ale acestei funcții, și rămâne o decizie server-side.
 *
 * Funcție pură: nu are efecte laterale, nu mută niciun argument.
 */
export function poateFiAsignat(
  angajat: AngajatPentruIscir,
  echipament: EchipamentPentruIscir,
  autorizatii: readonly AutorizatieNominala[],
  astazi: DateString,
): RezultatAsignareIscir {
  if (!echipament.esteIscir) {
    return { permisa: true };
  }

  const tipCerut = echipament.tipAutorizareNecesara;
  const aleAngajatului = autorizatii.filter((a) => a.employeeId === angajat.id);
  const potrivite = tipCerut === null ? aleAngajatului : aleAngajatului.filter((a) => a.tip === tipCerut);

  if (potrivite.length === 0) {
    const detaliuTip = tipCerut === null ? '' : ` de tip „${tipCerut}”`;
    return {
      permisa: false,
      motiv: `${angajat.numeComplet} nu are nicio autorizație nominală${detaliuTip}. Echipamentul este sub incidența ISCIR și cere un responsabil autorizat.`,
    };
  }

  if (potrivite.some((a) => esteValabilaLa(a, astazi))) {
    return { permisa: true };
  }

  const toateSuspendate = potrivite.every((a) => a.suspendataLa !== null);
  if (toateSuspendate) {
    return {
      permisa: false,
      motiv: `${angajat.numeComplet} are o autorizație nominală, dar aceasta este suspendată. Alegeți alt responsabil sau ridicați suspendarea.`,
    };
  }

  return {
    permisa: false,
    motiv: `${angajat.numeComplet} are o autorizație nominală, dar valabilitatea acesteia a expirat. Reînnoiți autorizația înainte de a-l desemna responsabil.`,
  };
}
```

```ts
// src/domain/ssm/autorizare-iscir.test.ts
import { describe, expect, it } from 'vitest';
import { poateFiAsignat, type AutorizatieNominala } from './autorizare-iscir';

const ANGAJAT = { id: 'ang-1', numeComplet: 'Ion Popescu' } as const;
const ASTAZI = '2026-08-17' as const;

function autorizatie(overrides: Partial<AutorizatieNominala> = {}): AutorizatieNominala {
  return {
    employeeId: ANGAJAT.id,
    tip: 'fochist',
    valabilPana: '2027-01-01',
    suspendataLa: null,
    ...overrides,
  };
}

describe('poateFiAsignat', () => {
  it('permite orice angajat pe un echipament care nu e sub incidența ISCIR', () => {
    const rezultat = poateFiAsignat(ANGAJAT, { esteIscir: false, tipAutorizareNecesara: null }, [], ASTAZI);
    expect(rezultat).toEqual({ permisa: true });
  });

  it('refuză când angajatul nu are nicio autorizație', () => {
    const rezultat = poateFiAsignat(ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'fochist' }, [], ASTAZI);
    expect(rezultat.permisa).toBe(false);
    if (!rezultat.permisa) expect(rezultat.motiv).toContain('nicio autorizație nominală');
  });

  it('permite când există o autorizație validă de tipul cerut', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'fochist' }, [autorizatie()], ASTAZI,
    );
    expect(rezultat).toEqual({ permisa: true });
  });

  it('permite exact în ziua expirării (valabilPana === astăzi)', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'fochist' },
      [autorizatie({ valabilPana: ASTAZI })], ASTAZI,
    );
    expect(rezultat).toEqual({ permisa: true });
  });

  it('refuză o autorizație expirată, cu motiv distinct de „nu are autorizație”', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'fochist' },
      [autorizatie({ valabilPana: '2026-01-01' })], ASTAZI,
    );
    expect(rezultat.permisa).toBe(false);
    if (!rezultat.permisa) expect(rezultat.motiv).toContain('a expirat');
  });

  it('refuză o autorizație suspendată, chiar dacă e încă valabilă calendaristic', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'fochist' },
      [autorizatie({ suspendataLa: '2026-07-01' })], ASTAZI,
    );
    expect(rezultat.permisa).toBe(false);
    if (!rezultat.permisa) expect(rezultat.motiv).toContain('suspendată');
  });

  it('ignoră autorizațiile de alt tip decât cel cerut de echipament', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'macaragiu' },
      [autorizatie({ tip: 'fochist' })], ASTAZI,
    );
    expect(rezultat.permisa).toBe(false);
  });

  it('ignoră autorizațiile altui angajat', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'fochist' },
      [autorizatie({ employeeId: 'alt-angajat' })], ASTAZI,
    );
    expect(rezultat.permisa).toBe(false);
  });

  it('acceptă orice tip când echipamentul nu cere un tip anume', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: null },
      [autorizatie({ tip: 'electrician' })], ASTAZI,
    );
    expect(rezultat).toEqual({ permisa: true });
  });

  it('alege autorizația validă când angajatul are mai multe, unele expirate', () => {
    const rezultat = poateFiAsignat(
      ANGAJAT, { esteIscir: true, tipAutorizareNecesara: 'fochist' },
      [autorizatie({ valabilPana: '2020-01-01' }), autorizatie({ valabilPana: '2027-01-01' })], ASTAZI,
    );
    expect(rezultat).toEqual({ permisa: true });
  });
});
```

```ts
// tests/rls/ssm.test.ts
// Teste de integrare care execută SCRIERI REALE prin PostgREST, cu clienți autentificați
// ca utilizatori reali (nu doar cu clientul admin), ca să verifice RLS + triggerele de
// business din 0011_ssm.sql / 0011b_ssm_expirables.sql pe o bază de date vie.
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { clientEnv } from '@/config/env';
import type { Database } from '@/types/database';

// PRESUPUNERE: acestea sunt numele câmpurilor din clientEnv pentru URL / anon key —
// necesare pentru un client „brut", autentificat per-utilizator, altfel RLS nu se poate
// testa realist (createAdminSupabase ocolește RLS intenționat). De verificat pe
// src/config/env.ts.
const SUPABASE_URL = clientEnv.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const PAROLA_TEST = 'Parola-Test-Ssm!2026';

async function clientCaUtilizator(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: PAROLA_TEST });
  if (error) throw error;
  return client;
}

async function creeazaUtilizator(admin: ReturnType<typeof createAdminSupabase>, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PAROLA_TEST, email_confirm: true });
  if (error || !data.user) throw error ?? new Error(`Creare utilizator eșuată: ${email}`);
  return data.user.id;
}

describe('RLS — SSM / PSI / mentenanță (Faza 7)', () => {
  const admin = createAdminSupabase();

  const sufix = Date.now();
  const orgA = { id: randomUUID(), slug: `ssm-test-a-${sufix}` };
  const orgB = { id: randomUUID(), slug: `ssm-test-b-${sufix}` };

  let orgAdminUserId = '';
  let angajatFaraAutorizatieUserId = '';
  let angajat1UserId = '';
  let angajat2UserId = '';
  let angajatFaraAutorizatieId = '';
  let angajat1Id = '';
  let angajat2Id = '';
  let echipamentIscirId = '';

  beforeAll(async () => {
    for (const org of [orgA, orgB]) {
      const { error } = await admin.from('organizations').insert({ id: org.id, name: org.slug, slug: org.slug });
      if (error) throw error;
      // PRESUPUNERE: coloane organization_features(organization_id, feature_key, enabled).
      const { error: errFeat } = await admin.from('organization_features').insert([
        { organization_id: org.id, feature_key: 'ssm', enabled: true },
        { organization_id: org.id, feature_key: 'maintenance', enabled: true },
      ]);
      if (errFeat) throw errFeat;
    }

    orgAdminUserId = await creeazaUtilizator(admin, `admin-${sufix}@ssm-test.local`);
    angajatFaraAutorizatieUserId = await creeazaUtilizator(admin, `fara-auth-${sufix}@ssm-test.local`);
    angajat1UserId = await creeazaUtilizator(admin, `angajat1-${sufix}@ssm-test.local`);
    angajat2UserId = await creeazaUtilizator(admin, `angajat2-${sufix}@ssm-test.local`);

    // PRESUPUNERE: employees cere doar organization_id + full_name pentru un insert
    // minimal valid — dacă tabela are alte coloane NOT NULL (post/departament etc.),
    // acest insert trebuie completat.
    const { data: angajati, error: errAng } = await admin
      .from('employees')
      .insert([
        { organization_id: orgA.id, full_name: 'Fără Autorizație' },
        { organization_id: orgA.id, full_name: 'Angajat Unu' },
        { organization_id: orgA.id, full_name: 'Angajat Doi' },
      ])
      .select('id');
    if (errAng || !angajati) throw errAng ?? new Error('employees insert a eșuat');
    [angajatFaraAutorizatieId, angajat1Id, angajat2Id] = angajati.map((a) => a.id) as [string, string, string];

    // PRESUPUNERE: valorile app_role dincolo de 'super_admin'/'org_admin' (confirmate în
    // internal.ssm_iscir_guard) — 'angajat' e o ghicire, de aliniat cu enumul real.
    const { error: errMembri } = await admin.from('organization_members').insert([
      { organization_id: orgA.id, user_id: orgAdminUserId, role: 'org_admin', employee_id: null },
      { organization_id: orgA.id, user_id: angajatFaraAutorizatieUserId, role: 'angajat', employee_id: angajatFaraAutorizatieId },
      { organization_id: orgA.id, user_id: angajat1UserId, role: 'angajat', employee_id: angajat1Id },
      { organization_id: orgA.id, user_id: angajat2UserId, role: 'angajat', employee_id: angajat2Id },
    ]);
    if (errMembri) throw errMembri;

    const { data: echipament, error: errEch } = await admin
      .from('equipment')
      .insert({
        organization_id: orgA.id,
        cod: `ECH-${sufix}`,
        denumire: 'Cazan test ISCIR',
        este_iscir: true,
        tip_autorizare_necesara: 'fochist',
      })
      .select('id')
      .single();
    if (errEch || !echipament) throw errEch ?? new Error('equipment insert a eșuat');
    echipamentIscirId = echipament.id;
  });

  afterAll(async () => {
    // Cleanup best-effort: echipamentele/tabelele SSM au FK organization_id cu
    // ON DELETE RESTRICT (0011_ssm.sql §11), deci ștergerea organizației ar eșua fără
    // să șteargă întâi copiii, pe mai multe tabele. Ștergem doar utilizatorii de test —
    // suficient ca rerulările să nu se ciocnească (id-uri și sloguri unice per rulare).
    for (const userId of [orgAdminUserId, angajatFaraAutorizatieUserId, angajat1UserId, angajat2UserId]) {
      if (!userId) continue;
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.warn(`[cleanup] ștergere utilizator ${userId} eșuată:`, error.message);
    }
  });

  it('un angajat fără autorizație nominală validă NU poate fi asignat pe un echipament ISCIR', async () => {
    const clientAdmin = await clientCaUtilizator(`admin-${sufix}@ssm-test.local`);
    const { error } = await clientAdmin
      .from('equipment')
      .update({ responsabil_employee_id: angajatFaraAutorizatieId })
      .eq('id', echipamentIscirId);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/autorizație nominală valabilă/i);
  });

  it('cu derogare de org_admin ȘI motiv, asignarea reușește, iar motivul ajunge în audit_logs', async () => {
    const clientAdmin = await clientCaUtilizator(`admin-${sufix}@ssm-test.local`);
    const motiv = 'Derogare aprobată provizoriu — angajat în curs de autorizare, aviz ITM emis.';

    const { error } = await clientAdmin
      .from('equipment')
      .update({ responsabil_employee_id: angajatFaraAutorizatieId, derogare_motiv: motiv })
      .eq('id', echipamentIscirId);
    expect(error).toBeNull();

    const { data: randEchipament } = await admin
      .from('equipment')
      .select('derogare_acordata_de, derogare_acordata_la')
      .eq('id', echipamentIscirId)
      .single();
    expect(randEchipament?.derogare_acordata_de).toBe(orgAdminUserId);
    expect(randEchipament?.derogare_acordata_la).not.toBeNull();

    // Nu presupunem numele exact al coloanei care ține payload-ul în audit_logs —
    // serializăm rândul întreg și căutăm motivul ca substring.
    const { data: audit, error: errAudit } = await admin
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'equipment')
      .eq('entity_id', echipamentIscirId)
      .order('created_at', { ascending: false })
      .limit(1);
    expect(errAudit).toBeNull();
    expect(JSON.stringify(audit)).toContain(motiv);
  });

  it('un employee vede propria fișă medicală, dar nu pe a colegului', async () => {
    const { error: errInsert } = await admin.from('occupational_health_exams').insert([
      { organization_id: orgA.id, employee_id: angajat1Id, tip: 'periodic', data_examinarii: '2026-06-01', rezultat: 'apt' },
      { organization_id: orgA.id, employee_id: angajat2Id, tip: 'periodic', data_examinarii: '2026-06-01', rezultat: 'apt' },
    ]);
    expect(errInsert).toBeNull();

    const clientAngajat1 = await clientCaUtilizator(`angajat1-${sufix}@ssm-test.local`);
    const { data, error } = await clientAngajat1.from('occupational_health_exams').select('employee_id');

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect(data?.every((r) => r.employee_id === angajat1Id)).toBe(true);
    expect(data?.some((r) => r.employee_id === angajat2Id)).toBe(false);
  });

  it('un utilizator din organizația A nu vede echipamentele lui B', async () => {
    const { error: errInsert } = await admin.from('equipment').insert({
      organization_id: orgB.id,
      cod: `ECH-B-${sufix}`,
      denumire: 'Echipament organizația B',
      este_iscir: false,
    });
    expect(errInsert).toBeNull();

    const clientAdminA = await clientCaUtilizator(`admin-${sufix}@ssm-test.local`);
    const { data, error } = await clientAdminA.from('equipment').select('id').eq('organization_id', orgB.id);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('un stingător cu proba de presiune expirată apare în conformitate chiar dacă verificarea e la zi', async () => {
    const azi = new Date();
    const acum6Ani = new Date(azi);
    acum6Ani.setFullYear(azi.getFullYear() - 6);

    const { data: stingator, error: errSt } = await admin
      .from('fire_extinguishers')
      .insert({
        organization_id: orgA.id,
        cod: `ST-${sufix}`,
        tip: 'pulbere',
        locatie: 'Hol parter',
        ultima_verificare: azi.toISOString().slice(0, 10),
        ultima_proba_presiune: acum6Ani.toISOString().slice(0, 10),
      })
      .select('id')
      .single();
    if (errSt || !stingator) throw errSt ?? new Error('fire_extinguishers insert a eșuat');

    // PRESUPUNERE: coloanele public.expirables urmează ordinea argumentelor din
    // internal.sync_expirable(...) — organization_id, entity_type, entity_id, kind,
    // titlu, data_expirare, sursa_tabel, responsabil_employee_id, activ. De verificat
    // pe supabase/migrations/0008_expirables.sql (nu am putut fi citit, fiind read-only).
    const { data: rand, error: errExp } = await admin
      .from('expirables')
      .select('kind, data_expirare, activ')
      .eq('organization_id', orgA.id)
      .eq('entity_type', 'fire_extinguisher')
      .eq('entity_id', stingator.id)
      .eq('kind', 'proba_presiune')
      .single();

    expect(errExp).toBeNull();
    expect(rand?.activ).toBe(true);
    expect((rand?.data_expirare ?? '') < azi.toISOString().slice(0, 10)).toBe(true);

    const { data: verificare } = await admin
      .from('expirables')
      .select('data_expirare')
      .eq('organization_id', orgA.id)
      .eq('entity_type', 'fire_extinguisher')
      .eq('entity_id', stingator.id)
      .eq('kind', 'verificare')
      .single();
    expect((verificare?.data_expirare ?? '') > azi.toISOString().slice(0, 10)).toBe(true);
  });
});
```

```ts
// src/config/navigation.ts — ADĂUGĂRI (nu rescrie fișierul existent)
//
// Nu am putut citi forma curentă a fișierului (agent read-only, fără unelte), deci mai
// jos sunt DOAR intrările noi, de integrat manual în NAV_GROUPS/NAV_ITEMS existente —
// nu o rescriere a fișierului. Presupun forma NavItem = { title, href, icon, feature?,
// permission?, minScope? } (vezi SEMNALĂRI); ajustați numele câmpurilor dacă diferă.
// Fiecare intrare e verificată ȘI la afișare (S2): pagina din href trebuie să facă
// requireFeature('ssm' | 'maintenance') și să verifice getPermissionMap + scopeFor
// înainte de a randa, nu doar să se bazeze pe faptul că intrarea de meniu e ascunsă.

import type { NavItem } from '@/config/navigation';

/** De adăugat sub grupul cu featureKey 'ssm'. */
export const SSM_NAV_ITEMS: readonly NavItem[] = [
  { title: 'Instruiri SSM/PSI', href: '/ssm/instruiri', icon: 'GraduationCap', feature: 'ssm', permission: 'ssm:read', minScope: 'own' },
  { title: 'Evaluări de risc', href: '/ssm/evaluari-risc', icon: 'ShieldAlert', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
  { title: 'Accidente de muncă', href: '/ssm/accidente', icon: 'AlertTriangle', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
  { title: 'Incidente periculoase', href: '/ssm/incidente-periculoase', icon: 'Siren', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
  { title: 'Boli profesionale', href: '/ssm/boli-profesionale', icon: 'HeartPulse', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
  { title: 'CSSM — procese-verbale', href: '/ssm/cssm', icon: 'Users', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
  { title: 'Echipament de protecție (EIP)', href: '/ssm/eip', icon: 'HardHat', feature: 'ssm', permission: 'ssm:read', minScope: 'own' },
  { title: 'Stingătoare (PSI)', href: '/ssm/psi/stingatoare', icon: 'FlameKindling', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
  { title: 'Exerciții de evacuare', href: '/ssm/psi/evacuari', icon: 'DoorOpen', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
  { title: 'Permise de lucru cu foc', href: '/ssm/psi/permise-foc', icon: 'Flame', feature: 'ssm', permission: 'ssm:create', minScope: 'team' },
  { title: 'Avize de mediu', href: '/ssm/avize-mediu', icon: 'Leaf', feature: 'ssm', permission: 'compliance:read', minScope: 'team' },
  { title: 'Medicina muncii', href: '/ssm/medicina-muncii', icon: 'Stethoscope', feature: 'ssm', permission: 'ssm:read', minScope: 'own' },
  { title: 'Autorizații nominale', href: '/ssm/autorizatii-personal', icon: 'BadgeCheck', feature: 'ssm', permission: 'ssm:read', minScope: 'team' },
] as const;

/** De adăugat sub grupul cu featureKey 'maintenance'. */
export const MAINTENANCE_NAV_ITEMS: readonly NavItem[] = [
  { title: 'Echipamente', href: '/mentenanta/echipamente', icon: 'Wrench', feature: 'maintenance', permission: 'maintenance:read', minScope: 'team' },
  { title: 'Planuri de mentenanță', href: '/mentenanta/planuri', icon: 'CalendarClock', feature: 'maintenance', permission: 'maintenance:read', minScope: 'team' },
  { title: 'Intervenții', href: '/mentenanta/interventii', icon: 'Hammer', feature: 'maintenance', permission: 'maintenance:read', minScope: 'team' },
  { title: 'Sesizări defecte', href: '/mentenanta/sesizari', icon: 'MessageSquareWarning', feature: 'maintenance', permission: 'maintenance:read', minScope: 'own' },
  { title: 'Autorizații ISCIR', href: '/mentenanta/iscir', icon: 'FileCheck2', feature: 'maintenance', permission: 'maintenance:read', minScope: 'team' },
] as const;

// Integrare sugerată: spread în array-ul existent din grupul 'ssm' / 'maintenance' din
// NAV_GROUPS, respectiv concatenare în NAV_ITEMS dacă e o listă plată. „Sesizări
// defecte" apare la minScope 'own' pentru că orice angajat poate raporta un defect;
// restul cer 'team' pentru că țin de gestiunea echipamentelor, nu de propria fișă.
```

```sql
-- supabase/seed-ssm.sql
-- Date demonstrative pentru Faza 7 (SSM/PSI/mentenanță). Toate rândurile sunt marcate
-- cu prefixul „[DEMO]" în câmpurile text vizibile în UI, ca să poată fi identificate și
-- șterse ulterior fără ambiguitate. Se rulează manual, DUPĂ migrații, pe o organizație
-- existentă — implicit prima organizație activă găsită, sau una cu slug conținând
-- „demo" dacă există. Idempotență NU e garantată la rulări repetate (nu are ON CONFLICT
-- DO NOTHING pe toate inserturile) — gândit pentru o singură populare pe un mediu demo.

do $$
declare
  v_org uuid;
  v_emp_fochist uuid;
  v_emp_altul uuid;
  v_tip_periodic uuid;
  v_echipament uuid;
  v_azi date := (now() at time zone 'Europe/Bucharest')::date;
begin
  select id into v_org from public.organizations
   where deleted_at is null
   order by (slug ilike '%demo%') desc, created_at asc
   limit 1;

  if v_org is null then
    raise notice '[seed-ssm] Nicio organizație găsită — seed omis.';
    return;
  end if;

  select id into v_tip_periodic from public.ssm_training_types
   where organization_id = v_org and cod = 'periodic' and deleted_at is null;

  if v_tip_periodic is null then
    raise notice '[seed-ssm] Tipul de instruire „periodic" lipsește (app.seed_ssm_defaults nu a rulat?) — seed omis.';
    return;
  end if;

  select id into v_emp_fochist from public.employees
   where organization_id = v_org and deleted_at is null order by created_at asc limit 1;
  select id into v_emp_altul from public.employees
   where organization_id = v_org and deleted_at is null order by created_at asc offset 1 limit 1;

  if v_emp_fochist is null or v_emp_altul is null then
    raise notice '[seed-ssm] Organizația are mai puțin de 2 angajați — seed omis.';
    return;
  end if;

  -- ── Instruiri SSM/PSI în trei stări ──────────────────────────────────────
  insert into public.ssm_trainings
    (organization_id, employee_id, training_type_id, data_instruirii, durata_ore,
     tematica, semnatura_confirmata, semnat_la, urmatoarea_scadenta, observatii)
  values
    (v_org, v_emp_fochist, v_tip_periodic, v_azi - interval '1 month', 2,
     '[DEMO] Instruire periodică SSM — la zi', true, now() - interval '1 month',
     v_azi + interval '5 months', '[DEMO] scadență confortabilă'),
    (v_org, v_emp_altul, v_tip_periodic, v_azi - interval '5 months 20 days', 2,
     '[DEMO] Instruire periodică SSM — scadență apropiată', true, now() - interval '5 months 20 days',
     v_azi + interval '10 days', '[DEMO] scadentă în curând'),
    (v_org, v_emp_fochist, v_tip_periodic, v_azi - interval '8 months', 2,
     '[DEMO] Instruire periodică SSM — restanță', true, now() - interval '8 months',
     v_azi - interval '2 months', '[DEMO] scadență depășită');

  -- ── Două stingătoare: unul conform, unul cu verificare ȘI probă de presiune expirate ──
  insert into public.fire_extinguishers
    (organization_id, cod, tip, masa_kg, locatie, ultima_verificare, ultima_reincarcare, ultima_proba_presiune)
  values
    (v_org, '[DEMO]-ST-01', 'pulbere', 6, '[DEMO] Hol parter — lângă intrare',
     v_azi - interval '2 months', v_azi - interval '10 months', v_azi - interval '2 years'),
    (v_org, '[DEMO]-ST-02', 'CO2', 5, '[DEMO] Depozit — lângă tabloul electric',
     v_azi - interval '14 months', v_azi - interval '14 months', v_azi - interval '6 years 1 month');

  -- ── Autorizație nominală + un echipament ISCIR conform (fără nevoie de derogare) ──
  insert into public.personnel_authorizations
    (organization_id, employee_id, tip, grupa, numar, emitent, emis_la, valabil_pana)
  values
    (v_org, v_emp_fochist, 'fochist', 'gr. II', '[DEMO]-AUT-001', 'ISCIR',
     v_azi - interval '1 year', v_azi + interval '2 years');

  insert into public.equipment
    (organization_id, cod, denumire, producator, an_fabricatie, locatie, responsabil_employee_id,
     este_iscir, tip_autorizare_necesara, data_punerii_in_functiune)
  values
    (v_org, '[DEMO]-ECH-01', '[DEMO] Cazan abur CR 2t/h', 'Vulcan', 2015,
     '[DEMO] Centrala termică', v_emp_fochist, true, 'fochist', v_azi - interval '5 years')
  returning id into v_echipament;

  insert into public.iscir_authorizations
    (organization_id, equipment_id, numar, tip, emis_la, valabil_pana, scadenta_verificare_tehnica)
  values
    (v_org, v_echipament, '[DEMO]-ISCIR-01', 'autorizare_functionare',
     v_azi - interval '1 year', v_azi + interval '9 years', v_azi + interval '1 year');

  -- ── O fișă medicală expirată ──────────────────────────────────────────────
  -- Rezultat 'apt' — expirarea ține doar de dată, nu de un aviz negativ; restricția
  -- automată din employee_work_restrictions nu apare la acest insert (trigger-ul o
  -- generează doar pentru rezultat <> 'apt'), ci abia după rularea periodică a
  -- app.aplica_restrictii_medicale_expirate(v_org).
  insert into public.occupational_health_exams
    (organization_id, employee_id, tip, data_examinarii, medic, unitate_medicala,
     rezultat, valabil_pana, numar_fisa, observatii)
  values
    (v_org, v_emp_altul, 'periodic', v_azi - interval '14 months', '[DEMO] Dr. Popescu',
     '[DEMO] Clinica MedMuncă SRL', 'apt', v_azi - interval '2 months', '[DEMO]-FA-001',
     '[DEMO] fișă expirată — necesită reexaminare');
end $$;
```

SEMNALĂRI (informații care nu apar în inventar și nu au putut fi verificate, fiind read-only):

1. Coloanele exacte ale `public.expirables` — le-am dedus din argumentele `internal.sync_expirable(...)` folosite în 0011_ssm.sql (`organization_id, entity_type, entity_id, kind, titlu, data_expirare, sursa_tabel, responsabil_employee_id, activ`), nu le-am putut citi din `0008_expirables.sql`. `tests/rls/ssm.test.ts` presupune coloanele `kind`, `data_expirare`, `activ`.
2. Coloanele reale ale `organizations`, `organization_features`, `organization_members`, `employees` dincolo de `id` — folosite în `tests/rls/ssm.test.ts` și `seed-ssm.sql` doar cu presupuneri rezonabile (`name`, `slug`, `feature_key`, `enabled`, `role`, `employee_id`, `full_name`). Dacă `employees` are alte coloane `NOT NULL`, insertul minimal din test trebuie completat.
3. Valorile complete ale enumului `public.app_role` — sigure sunt doar `'super_admin'` și `'org_admin'` (din `internal.ssm_iscir_guard`); am folosit `'angajat'` pentru rolul obișnuit în test, o presupunere.
4. Câmpurile exacte din `clientEnv` pentru URL/anon key — folosite în `tests/rls/ssm.test.ts` ca `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; necesare pentru un client per-utilizator care testează RLS real (`createAdminSupabase` ocolește intenționat RLS, deci nu poate fi folosit pentru aceste asertări).
5. Forma exactă a interfeței `NavItem` din `@/config/navigation` — am presupus `{ title, href, icon, feature?, permission?, minScope? }`; nu am putut citi fișierul (agent read-only), deci `src/config/navigation.ts` de mai sus e o listă de intrări de adăugat, nu o rescriere.
6. Runner-ul de teste — am presupus `vitest` (`describe/it/expect` din `'vitest'`); dacă proiectul folosește alt runner, importurile trebuie schimbate.
7. Coloanele reale ale `audit_logs` — pentru a nu presupune un nume de coloană pentru payload, testul de derogare verifică prezența motivului prin serializarea JSON a întregului rând, nu printr-un câmp anume.
8. Suprapunerea cu `0011_ssm.sql` §8–§9: `0011b_ssm_expirables.sql` reface aceleași triggere și aceeași funcție `app.poate_vedea_expirabil()` — scris intenționat idempotent (`create or replace` / `drop trigger if exists` + `create trigger`) ca să fie sigur de reaplicat indiferent de starea `0011_ssm.sql`; dacă ambele migrații ajung în lanț, doar comportamentul contează (identic), dar cineva ar trebui să decidă care fișier rămâne sursa unică.
9. `afterAll` din `tests/rls/ssm.test.ts` NU șterge organizațiile/rândurile de test (doar utilizatorii auth), din cauza `FOREIGN KEY ... ON DELETE RESTRICT` adăugat pe toate tabelele SSM în 0011_ssm.sql §11 — o curățenie completă ar cere ștergerea copiilor în ordine de dependență înainte de organizație.