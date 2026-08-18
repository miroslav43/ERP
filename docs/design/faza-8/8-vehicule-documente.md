```tsx
// src/app/(app)/flota/page.tsx
import Link from 'next/link';
import { Suspense } from 'react';
import { requireTenant } from '@/lib/tenant/resolve-tenant';
import { requireFeature } from '@/lib/auth/features';
import { getPermissionMap, scopeFor } from '@/lib/auth/permissions';
import { meetsScope } from '@/config/permissions';
import { createServerSupabase } from '@/lib/supabase/server';
import { AccesRestrictionat } from '@/components/feedback/acces-restrictionat';
import { EmptyState } from '@/components/feedback/empty-state';
import { SkeletonTable } from '@/components/data/skeleton-table';
import { formatDate } from '@/lib/format/date';
import {
  ETICHETE_CATEGORIE, ETICHETE_STATUS, VEHICLE_CATEGORII, VEHICLE_STATUSURI,
  type VehicleCategorie, type VehicleStatus,
} from '@/schemas/fleet';
import type { Tables } from '@/types/database';

const MARIME_PAGINA = 20;

interface Cursor { createdAt: string; id: string }

function codificaCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}
function decodificaCursor(s: string | undefined): Cursor | null {
  if (!s) return null;
  try {
    const obiect = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof obiect.createdAt === 'string' && typeof obiect.id === 'string') return obiect as Cursor;
    return null;
  } catch {
    return null;
  }
}

function culoareScadenta(expiraLa: string | null): 'rosu' | 'galben' | 'verde' | 'gri' {
  if (!expiraLa) return 'gri';
  const zile = Math.round((new Date(expiraLa).getTime() - Date.now()) / 86_400_000);
  if (zile <= 14) return 'rosu';
  if (zile <= 30) return 'galben';
  return 'verde';
}

const CLASE_SEMAFOR: Record<ReturnType<typeof culoareScadenta>, string> = {
  rosu: 'bg-red-100 text-red-800', galben: 'bg-amber-100 text-amber-800',
  verde: 'bg-green-100 text-green-800', gri: 'bg-gray-100 text-gray-600',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FlotaPage({ searchParams }: { searchParams: SearchParams }) {
  const tenant = await requireTenant();
  await requireFeature(tenant.organizationId, 'fleet');

  const harta = await getPermissionMap(tenant.organizationId, tenant.role);
  const scopCitire = scopeFor(harta, 'vehicles:read') ?? undefined;
  if (!meetsScope(scopCitire, 'own')) {
    return <AccesRestrictionat mesaj="Nu aveţi drepturi de vizualizare a parcului auto." />;
  }
  const poateCrea = meetsScope(scopeFor(harta, 'vehicles:create') ?? undefined, 'all');

  const sp = await searchParams;
  const status = typeof sp.status === 'string' ? (sp.status as VehicleStatus) : undefined;
  const categorie = typeof sp.categorie === 'string' ? (sp.categorie as VehicleCategorie) : undefined;
  const cursor = decodificaCursor(typeof sp.cursor === 'string' ? sp.cursor : undefined);

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Parc auto</h1>
        {poateCrea ? (
          <Link href="/flota/nou" className="rounded bg-blue-600 px-4 py-2 text-sm text-white">+ Adaugă vehicul</Link>
        ) : null}
      </header>

      <form method="get" className="flex flex-wrap gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={status ?? ''} className="rounded border px-2 py-1">
            <option value="">Toate</option>
            {VEHICLE_STATUSURI.map((s) => <option key={s} value={s}>{ETICHETE_STATUS[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Categorie
          <select name="categorie" defaultValue={categorie ?? ''} className="rounded border px-2 py-1">
            <option value="">Toate</option>
            {VEHICLE_CATEGORII.map((c) => <option key={c} value={c}>{ETICHETE_CATEGORIE[c]}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end rounded border px-3 py-1.5">Filtrează</button>
      </form>

      <Suspense fallback={<SkeletonTable />}>
        <ListaVehicule organizationId={tenant.organizationId} status={status} categorie={categorie} cursor={cursor} />
      </Suspense>
    </div>
  );
}

async function ListaVehicule({
  organizationId, status, categorie, cursor,
}: {
  organizationId: string; status: VehicleStatus | undefined; categorie: VehicleCategorie | undefined; cursor: Cursor | null;
}) {
  const supabase = await createServerSupabase();

  let interogare = supabase
    .from('vehicles')
    .select('id, nr_inmatriculare, marca, model, categorie, status, km_curent, employee_id, department_id, created_at')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MARIME_PAGINA + 1);

  if (status) interogare = interogare.eq('status', status);
  if (categorie) interogare = interogare.eq('categorie', categorie);
  if (cursor) {
    interogare = interogare.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data: vehicule, error } = await interogare;
  if (error) {
    return <p role="alert" className="text-red-700">Nu am putut încărca vehiculele. Reîncercaţi.</p>;
  }
  if (!vehicule || vehicule.length === 0) {
    return (
      <EmptyState icon="🚗" title="Niciun vehicul înregistrat"
        description="Adăugaţi primul vehicul din parcul auto folosind butonul „Adaugă vehicul”." />
    );
  }

  const arePagUrmatoare = vehicule.length > MARIME_PAGINA;
  const paginaAfisata = arePagUrmatoare ? vehicule.slice(0, MARIME_PAGINA) : vehicule;
  const ultimulRand = paginaAfisata[paginaAfisata.length - 1];

  const idVehicule = paginaAfisata.map((v) => v.id);
  const { data: documenteCurente } = await supabase
    .from('vehicle_documents')
    .select('vehicle_id, expira_la')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .eq('este_curent', true)
    .not('expira_la', 'is', null)
    .in('vehicle_id', idVehicule);

  const scadentaMinima = new Map<string, string>();
  for (const doc of documenteCurente ?? []) {
    if (!doc.expira_la) continue;
    const existent = scadentaMinima.get(doc.vehicle_id);
    if (!existent || doc.expira_la < existent) scadentaMinima.set(doc.vehicle_id, doc.expira_la);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Număr</th>
              <th className="px-3 py-2">Marcă / model</th>
              <th className="px-3 py-2">Categorie</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Km curent</th>
              <th className="px-3 py-2">Cea mai apropiată scadenţă</th>
            </tr>
          </thead>
          <tbody>
            {paginaAfisata.map((v: Pick<Tables<'vehicles'>, 'id' | 'nr_inmatriculare' | 'marca' | 'model' | 'categorie' | 'status' | 'km_curent' | 'employee_id' | 'department_id' | 'created_at'>) => {
              const scadenta = scadentaMinima.get(v.id) ?? null;
              const culoare = culoareScadenta(scadenta);
              return (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`/flota/${v.id}`} className="font-medium text-blue-700 hover:underline">
                      {v.nr_inmatriculare}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{v.marca} {v.model}</td>
                  <td className="px-3 py-2">{ETICHETE_CATEGORIE[v.categorie]}</td>
                  <td className="px-3 py-2">{ETICHETE_STATUS[v.status]}</td>
                  <td className="px-3 py-2">{v.km_curent.toLocaleString('ro-RO')} km</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${CLASE_SEMAFOR[culoare]}`}>
                      {scadenta ? formatDate(scadenta) : 'fără scadenţă'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {arePagUrmatoare && ultimulRand ? (
        <Link
          href={`/flota?cursor=${codificaCursor({ createdAt: ultimulRand.created_at, id: ultimulRand.id })}${status ? `&status=${status}` : ''}${categorie ? `&categorie=${categorie}` : ''}`}
          className="self-start rounded border px-3 py-1.5 text-sm"
        >
          Pagina următoare →
        </Link>
      ) : null}
    </div>
  );
}
```

```tsx
// src/app/(app)/flota/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTenant } from '@/lib/tenant/resolve-tenant';
import { requireFeature } from '@/lib/auth/features';
import { getPermissionMap, scopeFor } from '@/lib/auth/permissions';
import { meetsScope } from '@/config/permissions';
import { createServerSupabase } from '@/lib/supabase/server';
import { AccesRestrictionat } from '@/components/feedback/acces-restrictionat';
import { formatDate, formatDateTime } from '@/lib/format/date';
import { formatLei } from '@/lib/format/money';
import { ETICHETE_CATEGORIE, ETICHETE_COMBUSTIBIL, ETICHETE_STATUS } from '@/schemas/fleet';
import { VehicleForm } from '../_components/vehicle-form';
import { StatusForm } from '../_components/status-form';

function culoareScadenta(expiraLa: string | null): 'rosu' | 'galben' | 'verde' | 'gri' {
  if (!expiraLa) return 'gri';
  const zile = Math.round((new Date(expiraLa).getTime() - Date.now()) / 86_400_000);
  if (zile <= 14) return 'rosu';
  if (zile <= 30) return 'galben';
  return 'verde';
}
const CLASE_SEMAFOR: Record<ReturnType<typeof culoareScadenta>, string> = {
  rosu: 'bg-red-100 text-red-800', galben: 'bg-amber-100 text-amber-800',
  verde: 'bg-green-100 text-green-800', gri: 'bg-gray-100 text-gray-600',
};

export default async function FisaVehiculPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  await requireFeature(tenant.organizationId, 'fleet');

  const harta = await getPermissionMap(tenant.organizationId, tenant.role);
  const scopCitire = scopeFor(harta, 'vehicles:read') ?? undefined;
  if (!meetsScope(scopCitire, 'own')) {
    return <AccesRestrictionat mesaj="Nu aveţi drepturi de vizualizare a acestui vehicul." />;
  }
  const poateEdita = meetsScope(scopeFor(harta, 'vehicles:update') ?? undefined, 'all');

  const supabase = await createServerSupabase();
  const { data: vehicul, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error('Nu am putut încărca vehiculul.');
  if (!vehicul) notFound();

  const { data: documente } = await supabase
    .from('vehicle_documents')
    .select('id, numar, expira_la, valabil_de_la, cost, este_curent, document_type_id')
    .eq('organization_id', tenant.organizationId)
    .eq('vehicle_id', id)
    .eq('este_curent', true)
    .is('deleted_at', null)
    .order('expira_la', { ascending: true, nullsFirst: false });

  const idTipuri = [...new Set((documente ?? []).map((d) => d.document_type_id))];
  const { data: tipuri } = idTipuri.length
    ? await supabase.from('vehicle_document_types').select('id, denumire, cod').in('id', idTipuri)
    : { data: [] as { id: string; denumire: string; cod: string }[] };
  const denumireTip = new Map((tipuri ?? []).map((t) => [t.id, t.denumire]));

  const { data: foi } = await supabase
    .from('trip_sheets')
    .select('id, numar, plecare_la, sosire_la, km_plecare, km_sosire, km_parcursi, status, employee_id')
    .eq('organization_id', tenant.organizationId)
    .eq('vehicle_id', id)
    .is('deleted_at', null)
    .order('plecare_la', { ascending: false })
    .limit(10);

  const idFoiAprobate = (foi ?? []).filter((f) => f.status === 'aprobat' && f.km_parcursi).map((f) => f.id);
  let consumReal: number | null = null;
  if (idFoiAprobate.length > 0) {
    const { data: alimentari } = await supabase
      .from('fuel_entries')
      .select('litri, trip_sheet_id')
      .eq('organization_id', tenant.organizationId)
      .in('trip_sheet_id', idFoiAprobate)
      .is('deleted_at', null);
    const totalLitri = (alimentari ?? []).reduce((acc, a) => acc + Number(a.litri), 0);
    const totalKm = (foi ?? [])
      .filter((f) => idFoiAprobate.includes(f.id))
      .reduce((acc, f) => acc + (f.km_parcursi ?? 0), 0);
    if (totalKm > 0 && totalLitri > 0) consumReal = (totalLitri / totalKm) * 100;
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{vehicul.nr_inmatriculare}</h1>
          <p className="text-sm text-gray-600">{vehicul.marca} {vehicul.model} · {ETICHETE_CATEGORIE[vehicul.categorie]} · {ETICHETE_COMBUSTIBIL[vehicul.tip_combustibil]}</p>
        </div>
        <Link href={`/flota/${id}/documente`} className="rounded border px-4 py-2 text-sm">Documente</Link>
      </header>

      {poateEdita ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Status</h2>
          <StatusForm vehicleId={vehicul.id} statusCurent={vehicul.status} />
        </section>
      ) : (
        <p className="text-sm">Status: {ETICHETE_STATUS[vehicul.status]}</p>
      )}

      <section className="grid grid-cols-2 gap-6">
        <div className="rounded border p-4 text-sm">
          <h2 className="mb-2 font-medium">Date generale</h2>
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-gray-500">VIN</dt><dd>{vehicul.vin ?? '—'}</dd>
            <dt className="text-gray-500">Km curent</dt><dd>{vehicul.km_curent.toLocaleString('ro-RO')} km</dd>
            <dt className="text-gray-500">Şofer alocat</dt><dd>{vehicul.employee_id ?? '—'}</dd>
            <dt className="text-gray-500">Departament alocat</dt><dd>{vehicul.department_id ?? '—'}</dd>
            <dt className="text-gray-500">Data achiziţiei</dt><dd>{vehicul.data_achizitie ? formatDate(vehicul.data_achizitie) : '—'}</dd>
            <dt className="text-gray-500">Valoare achiziţie</dt><dd>{vehicul.valoare_achizitie ? formatLei(vehicul.valoare_achizitie) : '—'}</dd>
          </dl>
        </div>
        <div className="rounded border p-4 text-sm">
          <h2 className="mb-2 font-medium">Consum</h2>
          <p>Declarat: {vehicul.consum_mediu_declarat ? `${vehicul.consum_mediu_declarat} l/100km` : 'nespecificat'}</p>
          <p>Real (foi aprobate): {consumReal !== null ? `${consumReal.toFixed(2)} l/100km` : 'date insuficiente'}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Documente curente</h2>
        {(documente ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">Niciun document înregistrat încă.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left"><tr><th className="px-3 py-2">Tip</th><th className="px-3 py-2">Număr</th><th className="px-3 py-2">Expiră</th></tr></thead>
            <tbody>
              {(documente ?? []).map((d) => {
                const culoare = culoareScadenta(d.expira_la);
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">{denumireTip.get(d.document_type_id) ?? '—'}</td>
                    <td className="px-3 py-2">{d.numar ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${CLASE_SEMAFOR[culoare]}`}>
                        {d.expira_la ? formatDate(d.expira_la) : 'fără expirare'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Ultimele foi de parcurs</h2>
        {(foi ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">Nicio foaie de parcurs întocmită pentru acest vehicul.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left"><tr><th className="px-3 py-2">Plecare</th><th className="px-3 py-2">Km parcurşi</th><th className="px-3 py-2">Status</th></tr></thead>
            <tbody>
              {(foi ?? []).map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="px-3 py-2">{formatDateTime(f.plecare_la)}</td>
                  <td className="px-3 py-2">{f.km_parcursi ?? '—'}</td>
                  <td className="px-3 py-2">{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {poateEdita ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Editare</h2>
          <VehicleForm vehicul={vehicul} />
        </section>
      ) : null}
    </div>
  );
}
```

```ts
// src/app/(app)/flota/[id]/documente/actions.ts
'use server';

import { createAction } from '@/lib/actions/create-action';
import { mapPostgrestError, notFound } from '@/lib/actions/errors';
import { vehicleDocumentCreateSchema } from '@/schemas/fleet';

type DocumentRezultat = { id: string; esteCurent: boolean };

// Serveşte şi pentru adăugare, şi pentru reînnoire: e mereu un INSERT nou.
// Triggerul internal.vdoc_dupa() recalculează singur care rând devine „curent”,
// deci reînnoirea NU produce nicio eroare de unicitate.
export const creeazaDocumentVehicul = createAction<typeof vehicleDocumentCreateSchema, DocumentRezultat>({
  name: 'flota.creeazaDocumentVehicul',
  input: vehicleDocumentCreateSchema,
  feature: 'fleet',
  permission: 'vehicles:create',
  minScope: 'all',
  audit: {
    action: 'create',
    entityType: 'vehicle_document',
    entityId: (_input, data) => data.id,
    allow: ['vehicleId', 'documentTypeId', 'numar', 'emitent', 'valabilDeLa', 'expiraLa', 'cost'],
  },
  revalidate: ['/flota'],
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from('vehicle_documents')
      .insert({
        organization_id: ctx.tenant.organizationId,
        vehicle_id: input.vehicleId,
        document_type_id: input.documentTypeId,
        numar: input.numar ?? null,
        emitent: input.emitent ?? null,
        valabil_de_la: input.valabilDeLa ?? null,
        expira_la: input.expiraLa ?? null,
        cost: input.cost ?? null,
        fisier_path: input.fisierPath ?? null,
        fisier_nume: input.fisierNume ?? null,
        observatii: input.observatii ?? null,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select('id, este_curent')
      .single();
    if (error) throw mapPostgrestError(error);
    if (!data) throw notFound('Documentul nu a putut fi salvat.');
    return { id: data.id, esteCurent: data.este_curent };
  },
});
```

```tsx
// src/app/(app)/flota/[id]/documente/_components/document-form.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { vehicleDocumentCreateSchema } from '@/schemas/fleet';
import { creeazaDocumentVehicul } from '../actions';

interface TipDocument { id: string; cod: string; denumire: string; cereExpirare: boolean }

export function DocumentForm({ vehicleId, tipuri }: { vehicleId: string; tipuri: TipDocument[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [documentTypeId, setDocumentTypeId] = useState(tipuri[0]?.id ?? '');
  const [numar, setNumar] = useState('');
  const [emitent, setEmitent] = useState('');
  const [valabilDeLa, setValabilDeLa] = useState('');
  const [expiraLa, setExpiraLa] = useState('');
  const [cost, setCost] = useState('');

  function submite() {
    setEroare(null);
    const parsat = vehicleDocumentCreateSchema.safeParse({
      vehicleId,
      documentTypeId,
      numar: numar.trim() === '' ? undefined : numar.trim(),
      emitent: emitent.trim() === '' ? undefined : emitent.trim(),
      valabilDeLa: valabilDeLa === '' ? undefined : valabilDeLa,
      expiraLa: expiraLa === '' ? undefined : expiraLa,
      cost: cost.trim() === '' ? undefined : Number(cost),
    });
    if (!parsat.success) {
      setEroare(parsat.error.issues[0]?.message ?? 'Date invalide.');
      return;
    }
    startTransition(async () => {
      const rezultat = await creeazaDocumentVehicul(parsat.data);
      if (!rezultat.ok) { setEroare(rezultat.error.message); return; }
      setNumar(''); setEmitent(''); setValabilDeLa(''); setExpiraLa(''); setCost('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submite(); }} className="flex flex-col gap-3 max-w-xl text-sm" aria-label="Document nou">
      {eroare ? <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-800">{eroare}</p> : null}
      <label className="flex flex-col gap-1">
        Tip document
        <select className="rounded border px-2 py-1" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)}>
          {tipuri.map((t) => <option key={t.id} value={t.id}>{t.denumire}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">Număr<input className="rounded border px-2 py-1" value={numar} onChange={(e) => setNumar(e.target.value)} /></label>
        <label className="flex flex-col gap-1">Emitent<input className="rounded border px-2 py-1" value={emitent} onChange={(e) => setEmitent(e.target.value)} /></label>
        <label className="flex flex-col gap-1">Valabil de la<input type="date" className="rounded border px-2 py-1" value={valabilDeLa} onChange={(e) => setValabilDeLa(e.target.value)} /></label>
        <label className="flex flex-col gap-1">Expiră la<input type="date" className="rounded border px-2 py-1" value={expiraLa} onChange={(e) => setExpiraLa(e.target.value)} /></label>
        <label className="flex flex-col gap-1">Cost (lei)<input type="number" step="0.01" className="rounded border px-2 py-1" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
      </div>
      <button type="submit" disabled={pending} className="self-start rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60">
        {pending ? 'Se salvează…' : 'Salvează documentul'}
      </button>
    </form>
  );
}
```

```tsx
// src/app/(app)/flota/[id]/documente/page.tsx
import { notFound } from 'next/navigation';
import { requireTenant } from '@/lib/tenant/resolve-tenant';
import { requireFeature } from '@/lib/auth/features';
import { getPermissionMap, scopeFor } from '@/lib/auth/permissions';
import { meetsScope } from '@/config/permissions';
import { createServerSupabase } from '@/lib/supabase/server';
import { AccesRestrictionat } from '@/components/feedback/acces-restrictionat';
import { formatDate } from '@/lib/format/date';
import { DocumentForm } from './_components/document-form';

function culoareScadenta(expiraLa: string | null): 'rosu' | 'galben' | 'verde' | 'gri' {
  if (!expiraLa) return 'gri';
  const zile = Math.round((new Date(expiraLa).getTime() - Date.now()) / 86_400_000);
  if (zile <= 14) return 'rosu';
  if (zile <= 30) return 'galben';
  return 'verde';
}
const CLASE_SEMAFOR: Record<ReturnType<typeof culoareScadenta>, string> = {
  rosu: 'bg-red-100 text-red-800', galben: 'bg-amber-100 text-amber-800',
  verde: 'bg-green-100 text-green-800', gri: 'bg-gray-100 text-gray-600',
};

export default async function DocumenteVehiculPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  await requireFeature(tenant.organizationId, 'fleet');

  const harta = await getPermissionMap(tenant.organizationId, tenant.role);
  if (!meetsScope(scopeFor(harta, 'vehicles:read') ?? undefined, 'own')) {
    return <AccesRestrictionat mesaj="Nu aveţi drepturi de vizualizare a documentelor acestui vehicul." />;
  }
  const poateAdauga = meetsScope(scopeFor(harta, 'vehicles:create') ?? undefined, 'all');

  const supabase = await createServerSupabase();
  const { data: vehicul } = await supabase
    .from('vehicles').select('id, nr_inmatriculare')
    .eq('id', id).eq('organization_id', tenant.organizationId).is('deleted_at', null).maybeSingle();
  if (!vehicul) notFound();

  const { data: tipuri } = await supabase
    .from('vehicle_document_types')
    .select('id, cod, denumire, cere_expirare')
    .or(`organization_id.is.null,organization_id.eq.${tenant.organizationId}`)
    .eq('activ', true)
    .is('deleted_at', null)
    .order('ordine', { ascending: true });

  const { data: documente } = await supabase
    .from('vehicle_documents')
    .select('id, numar, emitent, valabil_de_la, expira_la, cost, este_curent, document_type_id, created_at')
    .eq('organization_id', tenant.organizationId)
    .eq('vehicle_id', id)
    .is('deleted_at', null)
    .order('document_type_id', { ascending: true })
    .order('expira_la', { ascending: false, nullsFirst: false });

  const denumireTip = new Map((tipuri ?? []).map((t) => [t.id, t.denumire]));

  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Documente — {vehicul.nr_inmatriculare}</h1>

      {poateAdauga ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Adaugă sau reînnoieşte un document</h2>
          <DocumentForm
            vehicleId={id}
            tipuri={(tipuri ?? []).map((t) => ({ id: t.id, cod: t.cod, denumire: t.denumire, cereExpirare: t.cere_expirare }))}
          />
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-medium">Istoric documente</h2>
        {(documente ?? []).length === 0 ? (
          <p className="text-sm text-gray-600">Niciun document înregistrat încă pentru acest vehicul.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Tip</th><th className="px-3 py-2">Număr</th>
                <th className="px-3 py-2">Valabil de la</th><th className="px-3 py-2">Expiră</th>
                <th className="px-3 py-2">Curent</th>
              </tr>
            </thead>
            <tbody>
              {(documente ?? []).map((d) => {
                const culoare = culoareScadenta(d.expira_la);
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">{denumireTip.get(d.document_type_id) ?? '—'}</td>
                    <td className="px-3 py-2">{d.numar ?? '—'}</td>
                    <td className="px-3 py-2">{d.valabil_de_la ? formatDate(d.valabil_de_la) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${CLASE_SEMAFOR[culoare]}`}>
                        {d.expira_la ? formatDate(d.expira_la) : 'fără expirare'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{d.este_curent ? 'Da' : 'Nu'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

=== SEMNALĂRI ===

1. **`requireTenant()` / `requireFeature()` — semnătură presupusă.** Inventarul confirmă doar `resolveTenant()` fără parametri şi existenţa lui `requireTenant`/`requireFeature`, fără forma exactă a parametrilor sau a valorii de întoarcere. Am presupus `requireTenant(): Promise<Tenant>` (echivalentul lui `requireUser`, care aruncă/redirecţionează pe stări non-`ok`) şi `requireFeature(organizationId: string, feature: FeatureKey): Promise<void>` (404 pe modul dezactivat, conform S2). Verificaţi semnătura reală înainte de compilare.

2. **`createAction` — forma valorii exportate.** Am presupus că `createAction({...})` întoarce direct o funcţie `async (input) => ActionResult<TData>` apelabilă de pe client cu un obiect simplu (nu `FormData`), compatibilă cu regula „modulul `use server` exportă doar funcţii async”. Formularele client construiesc obiectul şi apelează acţiunea prin `useTransition`, nu prin `<form action={...}>`.

3. **Coloane de „nume afişabil” pe `employees`/`departments` — inexistente în inventar.** Nu am găsit în inventar coloanele de nume ale acestor tabele (doar existenţa lor, din Faza 2 HR). Ca să nu inventez o cale/coloană greşită, alocarea şofer/departament e introdusă ca UUID brut (`ID şofer alocat` / `ID departament alocat`) şi afişată tot ca UUID pe fişa vehiculului, în loc de un `<select>` cu nume. Necesită un query helper (`@/lib/queries/employees` sau similar) care nu apare în inventar — de adăugat separat.

4. **`expirables` nu a fost interogat direct.** Coloanele reale ale tabelei (dincolo de parametrii lui `internal.sync_expirable`) nu sunt în inventar, deci „documentul cel mai apropiat de expirare” e calculat direct din `vehicle_documents` (`este_curent = true`, `min(expira_la)`), nu din `expirables`. Funcţional echivalent, dar dacă există deja un query central pentru dashboard-ul de conformitate care citeşte `expirables`, ar fi mai consecvent să-l reutilizaţi.

5. **Nicio politică/bucket de storage pentru `fisier_path`/`fisier_bon_path`** — semnalat deja explicit în 0012.sql; formularul de documente acceptă doar `fisierPath`/`fisierNume` ca text simplu, fără upload real.

6. **Cadru de testare presupus Vitest** (`import ... from 'vitest'`) — dacă proiectul foloseşte Jest, doar linia de import trebuie schimbată; sintaxa `describe/it/expect` e identică.

7. **`SkeletonTable`/`EmptyState` — props folosite doar din cele documentate** (`icon, title, description` / fără props pentru `SkeletonTable`). Dacă au props suplimentare relevante (nr. rânduri/coloane), ecranul de încărcare poate fi ajustat.

8. **Regulă de business adăugată, nu din migrare:** interzicerea alocării simultane pe angajat ŞI departament (`fereAlocareDubla` în `vehicleCreateSchema`/`vehicleUpdateSchema`) — migrarea permite tehnic ambele coloane completate; am impus exclusivitatea la nivel de schemă pornind de la comentariul „unui om SAU unui departament” din 0012.sql. Dacă intenţia reală era permisivă, refine-ul trebuie scos.