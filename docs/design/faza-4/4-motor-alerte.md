```tsx
// src/app/(app)/conformitate/page.tsx
import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { resolveTenant } from '@/lib/tenant/resolve-tenant';
import { getPermissionMap, scopeFor } from '@/lib/auth/permissions';
import { meetsScope } from '@/config/permissions';
import { createServerSupabase } from '@/lib/supabase/server';
import { obtineDashboardConformitate, type RandDashboardConformitate } from '@/lib/queries/conformitate';
import { formatDate } from '@/lib/format/date';
import { AccesRestrictionat } from '@/components/feedback/acces-restrictionat';
import { EmptyState } from '@/components/feedback/empty-state';
import { SkeletonTable } from '@/components/data/skeleton-table';
import { RUTA_AUTENTIFICARE, RUTA_ALEGE_ORGANIZATIA, RUTA_DUPA_AUTENTIFICARE } from '@/config/routes';

function formateazaCategorie(entityType: string): string {
  return entityType
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export default async function PaginaConformitate() {
  await requireUser();
  const rezolvare = await resolveTenant();
  if (rezolvare.status === 'neautentificat') redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status === 'fara_organizatie') redirect(RUTA_DUPA_AUTENTIFICARE);
  if (rezolvare.status === 'alegere_necesara') redirect(RUTA_ALEGE_ORGANIZATIA);

  const { organizationId, role } = rezolvare.tenant;
  const hartaPermisiuni = await getPermissionMap(organizationId, role);
  const scopCitire = scopeFor(hartaPermisiuni, 'compliance:read');

  if (!meetsScope(scopCitire ?? undefined, 'own')) {
    return (
      <AccesRestrictionat mesaj="Nu aveți drepturi pentru a vedea situația conformității. Cereți unui administrator să vă acorde acces." />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Conformitate</h1>
        <p className="text-sm text-muted-foreground">
          Semaforul scadențelor din toate modulele: vehicule, SSM, mentenanță și documentele de personal.
        </p>
      </header>
      <Suspense fallback={<SkeletonTable />}>
        <PanouDashboard organizationId={organizationId} />
      </Suspense>
    </div>
  );
}

async function PanouDashboard({ organizationId }: { organizationId: string }) {
  let randuri: RandDashboardConformitate[];
  try {
    const supabase = await createServerSupabase();
    randuri = await obtineDashboardConformitate(supabase, organizationId, 30);
  } catch {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">Nu am putut încărca situația conformității.</p>
        <p className="mt-1 text-sm text-muted-foreground">Verificați conexiunea și încercați din nou.</p>
        <Link href="/conformitate" className="mt-4 inline-block underline">
          Reîncearcă
        </Link>
      </div>
    );
  }

  if (randuri.length === 0) {
    return (
      <EmptyState
        icon="shield-check"
        title="Niciun document urmărit încă"
        description="Situația de conformitate se completează automat pe măsură ce introduceți vehicule, instruiri SSM sau alte documente cu scadență. Adăugați prima înregistrare într-un modul care generează scadențe pentru a vedea semaforul aici."
      />
    );
  }

  const t = randuri.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      expirate: acc.expirate + r.expirate,
      expiraCurand: acc.expiraCurand + r.expiraCurand,
      inRegula: acc.inRegula + r.inRegula,
    }),
    { total: 0, expirate: 0, expiraCurand: 0, inRegula: 0 },
  );

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Totaluri conformitate">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:bg-red-950/30">
          <dt className="text-sm font-medium text-red-700 dark:text-red-300">Expirate</dt>
          <dd className="text-3xl font-semibold text-red-700 dark:text-red-300">{t.expirate}</dd>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/30">
          <dt className="text-sm font-medium text-amber-700 dark:text-amber-300">Expiră curând (30 zile)</dt>
          <dd className="text-3xl font-semibold text-amber-700 dark:text-amber-300">{t.expiraCurand}</dd>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <dt className="text-sm font-medium text-emerald-700 dark:text-emerald-300">În regulă</dt>
          <dd className="text-3xl font-semibold text-emerald-700 dark:text-emerald-300">{t.inRegula}</dd>
        </div>
      </dl>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Situația conformității pe categorie</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="p-3">Categorie</th>
              <th scope="col" className="p-3">Total</th>
              <th scope="col" className="p-3">Expirate</th>
              <th scope="col" className="p-3">Expiră curând</th>
              <th scope="col" className="p-3">În regulă</th>
              <th scope="col" className="p-3">Cea mai apropiată</th>
              <th scope="col" className="p-3"><span className="sr-only">Acțiuni</span></th>
            </tr>
          </thead>
          <tbody>
            {randuri.map((r) => (
              <tr key={r.entityType} className="border-t">
                <th scope="row" className="p-3 font-medium">{formateazaCategorie(r.entityType)}</th>
                <td className="p-3">{r.total}</td>
                <td className="p-3">
                  {r.expirate > 0 ? (
                    <Link
                      href={`/conformitate/alerte?entityType=${encodeURIComponent(r.entityType)}&status=expirat`}
                      className="font-semibold text-red-700 underline dark:text-red-300"
                    >
                      {r.expirate}
                    </Link>
                  ) : (
                    '0'
                  )}
                </td>
                <td className="p-3">
                  {r.expiraCurand > 0 ? (
                    <Link
                      href={`/conformitate/alerte?entityType=${encodeURIComponent(r.entityType)}&status=nou`}
                      className="font-semibold text-amber-700 underline dark:text-amber-300"
                    >
                      {r.expiraCurand}
                    </Link>
                  ) : (
                    '0'
                  )}
                </td>
                <td className="p-3">{r.inRegula}</td>
                <td className="p-3">{r.ceaMaiApropiata ? formatDate(r.ceaMaiApropiata) : '—'}</td>
                <td className="p-3">
                  <Link href={`/conformitate/alerte?entityType=${encodeURIComponent(r.entityType)}`} className="underline">
                    Vezi lista
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

```tsx
// src/app/(app)/conformitate/alerte/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { resolveTenant } from '@/lib/tenant/resolve-tenant';
import { getPermissionMap, scopeFor } from '@/lib/auth/permissions';
import { meetsScope } from '@/config/permissions';
import { createServerSupabase } from '@/lib/supabase/server';
import { interogheazaAlerteConformitate, type StatusAlertaConformitate } from '@/lib/queries/conformitate';
import { formatDate } from '@/lib/format/date';
import { AccesRestrictionat } from '@/components/feedback/acces-restrictionat';
import { EmptyState } from '@/components/feedback/empty-state';
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE, RUTA_DUPA_AUTENTIFICARE } from '@/config/routes';
import { confirmaAlerta, rezolvaAlerta } from './actions';

const STATUSURI: readonly StatusAlertaConformitate[] = ['nou', 'confirmat', 'rezolvat', 'expirat'];
const ETICHETA_STATUS: Record<StatusAlertaConformitate, string> = {
  nou: 'Nouă',
  confirmat: 'Confirmată',
  rezolvat: 'Rezolvată',
  expirat: 'Expirată',
};

interface CautareAlerte {
  readonly entityType?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly cursor?: string;
  readonly eroare?: string;
}

export default async function PaginaAlerteConformitate({
  searchParams,
}: {
  searchParams: Promise<CautareAlerte>;
}) {
  await requireUser();
  const rezolvare = await resolveTenant();
  if (rezolvare.status === 'neautentificat') redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status === 'fara_organizatie') redirect(RUTA_DUPA_AUTENTIFICARE);
  if (rezolvare.status === 'alegere_necesara') redirect(RUTA_ALEGE_ORGANIZATIA);

  const { organizationId, role } = rezolvare.tenant;
  const hartaPermisiuni = await getPermissionMap(organizationId, role);
  const scopCitire = scopeFor(hartaPermisiuni, 'compliance:read');
  if (!meetsScope(scopCitire ?? undefined, 'own')) {
    return <AccesRestrictionat mesaj="Nu aveți drepturi pentru a vedea alertele de conformitate." />;
  }
  const poateActualiza = meetsScope(scopeFor(hartaPermisiuni, 'compliance:update') ?? undefined, 'team');

  const parametri = await searchParams;
  const statusValid = STATUSURI.find((s) => s === parametri.status);

  async function confirmaSiRevino(formData: FormData) {
    'use server';
    const alertaId = String(formData.get('alertaId') ?? '');
    const nota = String(formData.get('nota') ?? '').trim();
    const rezultat = await confirmaAlerta({ alertaId, ...(nota ? { nota } : {}) });
    if (!rezultat.ok) redirect(`/conformitate/alerte?eroare=${encodeURIComponent(rezultat.error.message)}`);
    redirect('/conformitate/alerte');
  }

  async function rezolvaSiRevino(formData: FormData) {
    'use server';
    const alertaId = String(formData.get('alertaId') ?? '');
    const nota = String(formData.get('nota') ?? '').trim();
    const rezultat = await rezolvaAlerta({ alertaId, ...(nota ? { nota } : {}) });
    if (!rezultat.ok) redirect(`/conformitate/alerte?eroare=${encodeURIComponent(rezultat.error.message)}`);
    redirect('/conformitate/alerte');
  }

  let pagina;
  try {
    const supabase = await createServerSupabase();
    pagina = await interogheazaAlerteConformitate(supabase, organizationId, {
      ...(parametri.entityType ? { entityType: parametri.entityType } : {}),
      ...(parametri.kind ? { kind: parametri.kind } : {}),
      ...(statusValid ? { status: statusValid } : {}),
      ...(parametri.cursor ? { cursor: parametri.cursor } : {}),
    });
  } catch {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">Nu am putut încărca lista de alerte.</p>
        <Link href="/conformitate/alerte" className="mt-3 inline-block underline">
          Reîncearcă
        </Link>
      </div>
    );
  }

  const paramsUrmator = new URLSearchParams({
    ...(parametri.entityType ? { entityType: parametri.entityType } : {}),
    ...(parametri.kind ? { kind: parametri.kind } : {}),
    ...(statusValid ? { status: statusValid } : {}),
    ...(pagina.cursorUrmator ? { cursor: pagina.cursorUrmator } : {}),
  }).toString();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Alerte de conformitate</h1>
        <p className="text-sm text-muted-foreground">Scadențe apropiate sau depășite, pe toate categoriile.</p>
      </header>

      {parametri.eroare ? (
        <p role="alert" className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {parametri.eroare}
        </p>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Categorie
          <input name="entityType" defaultValue={parametri.entityType ?? ''} className="rounded border p-2" />
        </label>
        <label className="flex flex-col text-sm">
          Tip
          <input name="kind" defaultValue={parametri.kind ?? ''} className="rounded border p-2" />
        </label>
        <label className="flex flex-col text-sm">
          Stare
          <select name="status" defaultValue={parametri.status ?? ''} className="rounded border p-2">
            <option value="">Toate</option>
            {STATUSURI.map((s) => (
              <option key={s} value={s}>{ETICHETA_STATUS[s]}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border px-4 py-2">Filtrează</button>
      </form>

      {pagina.randuri.length === 0 ? (
        <EmptyState
          icon="bell-off"
          title="Nicio alertă pentru filtrele alese"
          description="Fie nu există scadențe apropiate, fie criteriile de filtrare sunt prea stricte. Încercați să lărgiți filtrele de mai sus."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Lista alertelor de conformitate</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3">Document</th>
                <th scope="col" className="p-3">Categorie</th>
                <th scope="col" className="p-3">Scadență</th>
                <th scope="col" className="p-3">Prag</th>
                <th scope="col" className="p-3">Stare</th>
                {poateActualiza ? <th scope="col" className="p-3"><span className="sr-only">Acțiuni</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {pagina.randuri.map((alerta) => (
                <tr key={alerta.id} className="border-t align-top">
                  <th scope="row" className="p-3 font-medium">{alerta.label}</th>
                  <td className="p-3">{alerta.entityType} / {alerta.kind}</td>
                  <td className="p-3">{formatDate(alerta.dueDate)}</td>
                  <td className="p-3">{alerta.pragZile === 0 ? 'Depășit' : `${alerta.pragZile} zile`}</td>
                  <td className="p-3">{ETICHETA_STATUS[alerta.status]}</td>
                  {poateActualiza ? (
                    <td className="p-3">
                      {alerta.status === 'rezolvat' ? (
                        <span className="text-xs text-muted-foreground">Rezolvată</span>
                      ) : (
                        <>
                          <form action={confirmaSiRevino} className="mb-2 flex gap-2">
                            <input type="hidden" name="alertaId" value={alerta.id} />
                            <input type="text" name="nota" placeholder="Notă (opțional)" className="rounded border p-1 text-xs" />
                            <button type="submit" className="rounded border px-2 py-1 text-xs">Am văzut</button>
                          </form>
                          <form action={rezolvaSiRevino} className="flex gap-2">
                            <input type="hidden" name="alertaId" value={alerta.id} />
                            <input type="text" name="nota" placeholder="Notă (opțional)" className="rounded border p-1 text-xs" />
                            <button type="submit" className="rounded border px-2 py-1 text-xs">Rezolvă</button>
                          </form>
                        </>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagina.cursorUrmator ? (
        <Link href={`/conformitate/alerte?${paramsUrmator}`} className="underline">Pagina următoare</Link>
      ) : null}
    </div>
  );
}
```

```ts
// src/app/(app)/conformitate/alerte/actions.ts
'use server';

import { z } from 'zod';
import { createAction } from '@/lib/actions/create-action';
import { businessRule, mapPostgrestError, notFound } from '@/lib/actions/errors';
import type { ActionContext } from '@/lib/actions/types';

const notaSchema = z.string().trim().max(1000);
const confirmaSchema = z.object({ alertaId: z.uuid(), nota: notaSchema.optional() });
const rezolvaSchema = z.object({ alertaId: z.uuid(), nota: notaSchema.optional() });
const notaAlertaSchema = z.object({ alertaId: z.uuid(), nota: notaSchema });

interface RezultatAlerta {
  readonly id: string;
  readonly status: string;
}

async function alertaExistenta(ctx: ActionContext, alertaId: string) {
  const { data, error } = await ctx.supabase
    .from('compliance_alerts')
    .select('id, status')
    .eq('id', alertaId)
    .eq('organization_id', ctx.tenant.organizationId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw mapPostgrestError(error);
  if (!data) throw notFound('Alerta nu a fost găsită.');
  return data;
}

export const confirmaAlerta = createAction<typeof confirmaSchema, RezultatAlerta>({
  name: 'conformitate.alerte.confirma',
  input: confirmaSchema,
  permission: 'compliance:update',
  minScope: 'team',
  audit: {
    action: 'update',
    entityType: 'compliance_alerts',
    entityId: (input) => input.alertaId,
    allow: ['status', 'nota'],
  },
  revalidate: ['/conformitate/alerte', '/conformitate'],
  handler: async (ctx, input) => {
    const actuala = await alertaExistenta(ctx, input.alertaId);
    if (actuala.status === 'rezolvat') {
      throw businessRule('Alerta a fost deja rezolvată și nu mai poate fi confirmată.');
    }
    const { data, error } = await ctx.supabase
      .from('compliance_alerts')
      .update({ status: 'confirmat', ...(input.nota === undefined ? {} : { nota: input.nota }) })
      .eq('id', input.alertaId)
      .eq('organization_id', ctx.tenant.organizationId)
      .select('id, status')
      .single();
    if (error) throw mapPostgrestError(error);
    return { id: data.id, status: data.status };
  },
});

export const rezolvaAlerta = createAction<typeof rezolvaSchema, RezultatAlerta>({
  name: 'conformitate.alerte.rezolva',
  input: rezolvaSchema,
  permission: 'compliance:update',
  minScope: 'team',
  audit: {
    action: 'update',
    entityType: 'compliance_alerts',
    entityId: (input) => input.alertaId,
    allow: ['status', 'nota'],
  },
  revalidate: ['/conformitate/alerte', '/conformitate'],
  handler: async (ctx, input) => {
    const actuala = await alertaExistenta(ctx, input.alertaId);
    if (actuala.status === 'rezolvat') {
      throw businessRule('Alerta a fost deja rezolvată.');
    }
    const { data, error } = await ctx.supabase
      .from('compliance_alerts')
      .update({ status: 'rezolvat', ...(input.nota === undefined ? {} : { nota: input.nota }) })
      .eq('id', input.alertaId)
      .eq('organization_id', ctx.tenant.organizationId)
      .select('id, status')
      .single();
    if (error) throw mapPostgrestError(error);
    return { id: data.id, status: data.status };
  },
});

export const seteazaNotaAlerta = createAction<typeof notaAlertaSchema, RezultatAlerta>({
  name: 'conformitate.alerte.noteaza',
  input: notaAlertaSchema,
  permission: 'compliance:update',
  minScope: 'team',
  audit: {
    action: 'update',
    entityType: 'compliance_alerts',
    entityId: (input) => input.alertaId,
    allow: ['nota'],
  },
  revalidate: ['/conformitate/alerte'],
  handler: async (ctx, input) => {
    await alertaExistenta(ctx, input.alertaId);
    const { data, error } = await ctx.supabase
      .from('compliance_alerts')
      .update({ nota: input.nota })
      .eq('id', input.alertaId)
      .eq('organization_id', ctx.tenant.organizationId)
      .select('id, status')
      .single();
    if (error) throw mapPostgrestError(error);
    return { id: data.id, status: data.status };
  },
});
```

```ts
// src/app/(app)/conformitate/reguli/actions.ts
'use server';

import { z } from 'zod';
import { createAction } from '@/lib/actions/create-action';
import { businessRule, isPostgrestError, mapPostgrestError } from '@/lib/actions/errors';

const identificatorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(\*|[a-z][a-z0-9_]{1,48})$/, 'Folosiți litere mici, cifre și underscore, sau „*” pentru toate.');

const configureazaRegulaSchema = z.object({
  entityType: identificatorSchema.default('*'),
  kind: identificatorSchema.default('*'),
  praguriZile: z
    .array(z.number().int().min(1).max(3650))
    .min(1, 'Adăugați cel puțin un prag, în zile.')
    .max(8, 'Cel mult 8 praguri.'),
  alerteazaLaDepasire: z.boolean().default(true),
  valabilDeLa: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data trebuie să fie în formatul an-lună-zi.')
    .optional(),
});

interface RezultatRegula {
  readonly id: string;
}

// Nu se rescrie o regulă — se adaugă o versiune nouă (vezi alert_rules_versiune_uq).
export const configureazaReguliAlertare = createAction<typeof configureazaRegulaSchema, RezultatRegula>({
  name: 'conformitate.reguli.configureaza',
  input: configureazaRegulaSchema,
  permission: 'compliance:update',
  minScope: 'all',
  audit: {
    action: 'create',
    entityType: 'alert_rules',
    entityId: (_input, data) => data.id,
    allow: ['entity_type', 'kind', 'praguri_zile', 'alerteaza_la_depasire', 'valabil_de_la'],
  },
  revalidate: ['/conformitate/reguli'],
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from('alert_rules')
      .insert({
        organization_id: ctx.tenant.organizationId,
        entity_type: input.entityType,
        kind: input.kind,
        praguri_zile: input.praguriZile,
        alerteaza_la_depasire: input.alerteazaLaDepasire,
        ...(input.valabilDeLa === undefined ? {} : { valabil_de_la: input.valabilDeLa }),
      })
      .select('id')
      .single();

    if (error) {
      if (isPostgrestError(error) && error.code === '23505') {
        throw businessRule(
          'Există deja o regulă pentru această categorie cu aceeași dată de valabilitate. Alegeți altă dată.',
        );
      }
      throw mapPostgrestError(error);
    }
    return { id: data.id };
  },
});
```

```tsx
// src/app/(app)/conformitate/reguli/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { resolveTenant } from '@/lib/tenant/resolve-tenant';
import { getPermissionMap, scopeFor } from '@/lib/auth/permissions';
import { meetsScope } from '@/config/permissions';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format/date';
import type { DateString } from '@/lib/format/date';
import { AccesRestrictionat } from '@/components/feedback/acces-restrictionat';
import { EmptyState } from '@/components/feedback/empty-state';
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE, RUTA_DUPA_AUTENTIFICARE } from '@/config/routes';
import type { Tables } from '@/types/database';
import { configureazaReguliAlertare } from './actions';

type RandRegula = Pick<
  Tables<'alert_rules'>,
  'id' | 'entity_type' | 'kind' | 'praguri_zile' | 'alerteaza_la_depasire' | 'valabil_de_la'
>;

export default async function PaginaReguliAlertare({
  searchParams,
}: {
  searchParams: Promise<{ eroare?: string }>;
}) {
  await requireUser();
  const rezolvare = await resolveTenant();
  if (rezolvare.status === 'neautentificat') redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status === 'fara_organizatie') redirect(RUTA_DUPA_AUTENTIFICARE);
  if (rezolvare.status === 'alegere_necesara') redirect(RUTA_ALEGE_ORGANIZATIA);

  const { organizationId, role } = rezolvare.tenant;
  const hartaPermisiuni = await getPermissionMap(organizationId, role);
  const poateConfigura = meetsScope(scopeFor(hartaPermisiuni, 'compliance:update') ?? undefined, 'all');
  if (!poateConfigura) {
    return <AccesRestrictionat mesaj="Doar un administrator poate modifica pragurile de alertare pentru organizație." />;
  }

  const parametri = await searchParams;

  async function salveazaRegula(formData: FormData) {
    'use server';
    const praguri = String(formData.get('praguriZile') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map(Number);
    const valabilDeLa = String(formData.get('valabilDeLa') ?? '').trim();

    const rezultat = await configureazaReguliAlertare({
      entityType: String(formData.get('entityType') ?? '*').trim() || '*',
      kind: String(formData.get('kind') ?? '*').trim() || '*',
      praguriZile: praguri,
      alerteazaLaDepasire: formData.get('alerteazaLaDepasire') === 'on',
      ...(valabilDeLa ? { valabilDeLa } : {}),
    });

    if (!rezultat.ok) {
      redirect(`/conformitate/reguli?eroare=${encodeURIComponent(rezultat.error.message)}`);
    }
    redirect('/conformitate/reguli');
  }

  let reguli: RandRegula[];
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('alert_rules')
      .select('id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('entity_type', { ascending: true })
      .order('kind', { ascending: true })
      .order('valabil_de_la', { ascending: false });
    if (error) throw error;
    reguli = data ?? [];
  } catch {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">Nu am putut încărca regulile de alertare.</p>
        <Link href="/conformitate/reguli" className="mt-3 inline-block underline">Reîncearcă</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Praguri de alertare</h1>
        <p className="text-sm text-muted-foreground">
          Cu cât timp înainte se ridică o alertă, pe categorie și tip de document. O regulă nouă adaugă o
          versiune; regulile vechi rămân pentru istoric.
        </p>
      </header>

      {parametri.eroare ? (
        <p role="alert" className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {parametri.eroare}
        </p>
      ) : null}

      <form action={salveazaRegula} className="grid max-w-xl gap-3 rounded-lg border p-4">
        <label className="flex flex-col text-sm">
          Categorie (entity_type) — „*” pentru toate
          <input name="entityType" defaultValue="*" className="rounded border p-2" />
        </label>
        <label className="flex flex-col text-sm">
          Tip (kind) — „*” pentru toate
          <input name="kind" defaultValue="*" className="rounded border p-2" />
        </label>
        <label className="flex flex-col text-sm">
          Praguri, în zile, separate prin virgulă
          <input name="praguriZile" defaultValue="30, 14, 7" required className="rounded border p-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="alerteazaLaDepasire" defaultChecked />
          Alertează și după ce scadența a trecut
        </label>
        <label className="flex flex-col text-sm">
          Valabilă de la (implicit azi)
          <input type="date" name="valabilDeLa" className="rounded border p-2" />
        </label>
        <button type="submit" className="justify-self-start rounded border px-4 py-2">Salvează regula</button>
      </form>

      {reguli.length === 0 ? (
        <EmptyState
          icon="sliders-horizontal"
          title="Se folosesc pragurile implicite"
          description="Nu ați configurat nicio regulă proprie — se aplică automat 30, 14 și 7 zile pentru toate categoriile. Adăugați o regulă mai sus dacă aveți nevoie de alte praguri."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Reguli de alertare configurate</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3">Categorie</th>
                <th scope="col" className="p-3">Tip</th>
                <th scope="col" className="p-3">Praguri (zile)</th>
                <th scope="col" className="p-3">La depășire</th>
                <th scope="col" className="p-3">Valabilă de la</th>
              </tr>
            </thead>
            <tbody>
              {reguli.map((regula) => (
                <tr key={regula.id} className="border-t">
                  <th scope="row" className="p-3 font-medium">{regula.entity_type}</th>
                  <td className="p-3">{regula.kind}</td>
                  <td className="p-3">{regula.praguri_zile.join(', ')}</td>
                  <td className="p-3">{regula.alerteaza_la_depasire ? 'Da' : 'Nu'}</td>
                  <td className="p-3">{formatDate(regula.valabil_de_la as DateString)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

SEMNALEZ (nu am putut verifica prin inventar):

7. `EmptyState`, `SkeletonTable`, `AccesRestrictionat` — am folosit doar props confirmate explicit (`mesaj` pentru `AccesRestrictionat`; `icon`/`title`/`description` pentru `EmptyState`, cu `icon` ca literal string precum `"shield-check"`); `SkeletonTable` a fost folosit fără props. Verificați semnăturile reale înainte de aplicare.
8. `obtineDashboardConformitate` apelează `supabase.schema('app').rpc('dashboard_conformitate', ...)` — presupune că schema `app` e expusă către PostgREST (Supabase → API → Exposed schemas) și că tipul generat `Database` o include. Dacă nu, funcția trebuie expusă printr-un proxy în schema `public`.
9. `createServerSupabase()` presupus asincron (Next.js 15, cookies async) — la fel `searchParams` tipat ca `Promise<...>`. Dacă proiectul e pe o versiune mai veche de Next.js, ambele presupuneri trebuie ajustate (fără `await`, `searchParams` obiect simplu).
10. Politica RLS `reguli_insert` din migrare cere `compliance:create` la scope `'all'` pentru INSERT în `alert_rules`, dar SARCINA cere explicit gating pe `compliance:update`/`'all'` pentru acțiunea de configurare. Am urmat literal SARCINA pentru `permission`/`minScope` din `createAction`, dar INSERT-ul va eșua la nivel de RLS dacă rolul care configurează regulile nu are și `compliance:create` la `'all'` — verificați seed-ul `role_permissions`.
11. Presupun că `interogare.eq('expirabil.entity_type', ...)` (filtru pe coloană din resursa înglobată via `expirables!inner`) funcționează cu PostgREST/supabase-js așa cum e scris; dacă versiunea de supabase-js din proiect nu suportă filtrare pe alias de relație înglobată, filtrele `entityType`/`kind` din `interogheazaAlerteConformitate` trebuie rescrise ca două interogări separate, îmbinate în TS.
12. Cursorul de paginare din `interogheazaAlerteConformitate` este o implementare locală (base64url peste `{dueDate, id}`), nu reface `codificaCursor`/`decodificaCursor` din `@/lib/queries/audit` — nu le-am putut verifica semnătura și le-am tratat ca specifice modulului audit.