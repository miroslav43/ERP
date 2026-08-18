ă…' : 'Predă obiectul'}
      </button>
    </form>
  );
}

export function RandAlocareDeschisa({ allocationId }: { allocationId: string }) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [stare, setStare] = useState<InventoryItemStare>('bun');
  const [pending, startTransition] = useTransition();

  function returneaza() {
    setEroare(null);
    startTransition(async () => {
      const rezultat = await returneazaObiectulDeInventar({ allocationId, stareLaReturnare: stare });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {eroare && <span className="w-full text-xs text-red-600">{eroare}</span>}
      <select
        value={stare}
        onChange={(e) => setStare(e.target.value as InventoryItemStare)}
        className="rounded border px-1 py-0.5 text-xs"
      >
        {INVENTORY_ITEM_STARE.map((s) => (
          <option key={s} value={s}>{INVENTORY_STARE_LABEL[s]}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={returneaza}
        className="rounded border px-2 py-0.5 text-xs"
      >
        {pending ? 'Se returnează…' : 'Returnează'}
      </button>
    </div>
  );
}
```

```tsx
// src/app/(app)/angajati/[id]/bunuri/page.tsx
import { requireTenant } from '@/lib/tenant/resolve-tenant';
import { requireFeature } from '@/lib/auth/features';
import { getPermissionMap, scopeFor } from '@/lib/auth/permissions';
import { createServerSupabase } from '@/lib/supabase/server';
import { AccesRestrictionat } from '@/components/feedback/acces-restrictionat';
import { EmptyState } from '@/components/feedback/empty-state';
import { formatDateTime } from '@/lib/format/date';
import { INVENTORY_STARE_LABEL, INVENTORY_STATUS_LABEL } from '@/schemas/inventory';
import Link from 'next/link';

export default async function PaginaBunuriAngajat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  await requireFeature(tenant.organizationId, 'inventory'); // modul dezactivat = 404

  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  if (!scopeFor(permisiuni, 'inventory:read')) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a vedea bunurile de inventar ale angajaților." />;
  }
  // Notă: la scope 'own', RLS pe inventory_allocations întoarce automat doar
  // rândurile angajatului curent — dacă „id" nu e chiar angajatul curent,
  // pagina va afișa starea „nimic alocat" în loc de refuz explicit; adevărul
  // de securitate rămâne în RLS, nu în această verificare de UI.

  const supabase = await createServerSupabase();

  const { data: angajat } = await supabase
    .from('employees')
    .select('id, nume, prenume')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!angajat) {
    return (
      <EmptyState
        icon="user-x"
        title="Angajatul nu a fost găsit"
        description="Fișa angajatului nu există sau nu aparține acestei organizații."
      />
    );
  }

  const { data: alocari } = await supabase
    .from('inventory_allocations')
    .select('id, item_id, predat_la, returnat_la, stare_la_predare, stare_la_returnare, confirmat_de_angajat_la')
    .eq('employee_id', id)
    .is('deleted_at', null)
    .order('predat_la', { ascending: false });

  const idItemi = [...new Set((alocari ?? []).map((a) => a.item_id))];
  const { data: itemi } =
    idItemi.length > 0
      ? await supabase
          .from('inventory_items')
          .select('id, denumire, numar_inventar, status, stare')
          .in('id', idItemi)
      : { data: [] as { id: string; denumire: string; numar_inventar: string; status: string; stare: string }[] };
  const itemById = new Map((itemi ?? []).map((i) => [i.id, i]));

  const curente = (alocari ?? []).filter((a) => !a.returnat_la);
  const istorice = (alocari ?? []).filter((a) => a.returnat_la);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        Bunuri de inventar — {angajat.prenume} {angajat.nume}
      </h1>

      <section>
        <h2 className="mb-2 font-medium">În prezent la angajat</h2>
        {curente.length === 0 ? (
          <EmptyState
            icon="package"
            title="Niciun obiect alocat"
            description="Angajatul nu are în prezent niciun obiect de inventar în primire."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Obiect</th>
                  <th className="p-2">Predat la</th>
                  <th className="p-2">Stare la predare</th>
                  <th className="p-2">Confirmat</th>
                </tr>
              </thead>
              <tbody>
                {curente.map((a) => {
                  const item = itemById.get(a.item_id);
                  return (
                    <tr key={a.id} className="border-b">
                      <td className="p-2">
                        {item ? (
                          <Link href={`/inventar/${item.id}`} className="underline">
                            {item.denumire} ({item.numar_inventar})
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="p-2">{formatDateTime(a.predat_la)}</td>
                      <td className="p-2">{INVENTORY_STARE_LABEL[a.stare_la_predare as keyof typeof INVENTORY_STARE_LABEL]}</td>
                      <td className="p-2">{a.confirmat_de_angajat_la ? 'Da' : 'Nu'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {istorice.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Istoric predări-primiri</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Obiect</th>
                  <th className="p-2">Predat la</th>
                  <th className="p-2">Returnat la</th>
                  <th className="p-2">Stare la returnare</th>
                </tr>
              </thead>
              <tbody>
                {istorice.map((a) => {
                  const item = itemById.get(a.item_id);
                  return (
                    <tr key={a.id} className="border-b">
                      <td className="p-2">{item ? `${item.denumire} (${item.numar_inventar})` : '—'}</td>
                      <td className="p-2">{formatDateTime(a.predat_la)}</td>
                      <td className="p-2">{a.returnat_la ? formatDateTime(a.returnat_la) : '—'}</td>
                      <td className="p-2">
                        {a.stare_la_returnare
                          ? INVENTORY_STARE_LABEL[a.stare_la_returnare as keyof typeof INVENTORY_STARE_LABEL]
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
```

```tsx
// src/app/(app)/angajati/[id]/bunuri/loading.tsx
import { SkeletonTable } from '@/components/data/skeleton-table';

export default function ÎncărcareBunuriAngajat() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-72 animate-pulse rounded bg-slate-200" />
      <SkeletonTable />
    </div>
  );
}
```

SEMNALĂRI (lucruri absente din inventar, pe care nu le-am inventat — de verificat înainte de merge):

1. **Coloanele tabelei `employees` pentru numele afișat** (`nume`, `prenume`) nu apar în inventarul de module — doar `organization_id` și `deleted_at` sunt confirmate direct în migrarea 0010 (folosite în `internal.inventory_alloc_valideaza`). Am presupus `nume`/`prenume` fiindcă restul schemei e în română; dacă fișa reală folosește `full_name` sau `nume_complet`, toate locurile care fac `select('id, nume, prenume')` și `${a.prenume} ${a.nume}` trebuie ajustate (`inventar/page.tsx`, `inventar/[id]/page.tsx`, `inventar/alocari/*`, `angajati/[id]/bunuri/page.tsx`).

2. **`ctx.supabase.schema('app').rpc(...)`** — folosit în `creeazaObiectInventar` pentru `app.aloca_numar_inventar`. Niciun modul din inventar nu arată dacă `ServerSupabase`/clientul din `ctx` e tipat cu suport pentru schema `app` (necesită fie `db.schemas` extins în proiectul Supabase, fie `.schema('app')` disponibil pe tipul clientului). De verificat că schema `app` e expusă în PostgREST și că tipul clientului acceptă `.schema()`.

3. **`ActionContext`** a fost importat și folosit fără parametri generici (`ActionContext`, nu `ActionContext<...>`), pe baza descrierii din inventar. Dacă tipul e generic obligatoriu, `gasesteDetinatorCurent` din `alocari/actions.ts` nu va compila și are nevoie de parametrul de tip corect.

4. **Semaforul de garanție a fost calculat direct în `[id]/page.tsx` din `garantie_expira`**, nu citit din `public.expirables`/`compliance_alerts`. Motorul de expirări (0008) și pragurile din `alert_rules` nu au coloanele expuse în inventar, deci n-am inventat un query pe ele; pragurile 30/90 de zile din `semaforGarantie` sunt euristici locale de UI, nu pragurile reale configurate de organizație. Dacă Faza 4 expune un query gata făcut pentru citirea unui `expirable` (stare/prag), semaforul trebuie mutat pe acela, pentru consecvență cu restul aplicației.

5. **Nu există `@/components/ui/*`** (Button, Input, Select, Table) în inventarul de module — am folosit elemente HTML native cu clase Tailwind minimale. Dacă proiectul are o bibliotecă de componente UI internă, toate formularele/tabelele trebuie rescrise pe ea pentru consecvență vizuală.

6. **`SkeletonTable`** a fost folosit fără props (`<SkeletonTable />`), fiindcă semnătura ei exactă nu apare în inventar. **`ErrorState`/`ErrorBoundary`** nu au fost folosite deloc — nu le cunosc props-urile (probabil `reset`, posibil altele) și n-am vrut să inventez o formă care să spargă compilarea; paginile de listă folosesc doar `EmptyState` pentru eroare (mesaj + fără retry funcțional). Trebuie adăugate `error.tsx` proprii pe `inventar/`, `inventar/alocari/` și `angajati/[id]/bunuri/` odată ce semnătura reală a `ErrorState` e confirmată.

7. **`requireTenant()` și `requireFeature(organizationId, featureKey)`** au fost apelate presupunând că `requireTenant` întoarce direct un `Tenant` (nu un `TenantResolution`) și gestionează el însuși redirect-urile pentru stările non-`ok`, iar `requireFeature` face 404 intern. Semnăturile exacte nu sunt în inventar — doar existența funcțiilor.

8. **`formatDate`/`formatDateTime`** au fost apelate cu string-uri brute venite din Postgres (`date`/`timestamptz` ca `string`), nu cu tipul brandat `DateString`. Dacă `DateString` e un brand real (nu doar alias), aceste apeluri au nevoie de conversie prin `toBucharestDateString`.

9. **Nicio pagină/acțiune pentru loturile de import** (`inventory_import_batches`, `app.revoca_import_inventar`) nu a fost cerută explicit în sarcină și nu a fost livrată — doar obiectele individuale și alocările. Dacă import-ul în lot e parte din Faza 5, e un fișier separat, netratat aici.

10. Fișierele produse: `src/schemas/inventory.ts`, `src/app/(app)/inventar/actions.ts`, `src/app/(app)/inventar/page.tsx`, `src/app/(app)/inventar/loading.tsx`, `src/app/(app)/inventar/[id]/page.tsx`, `src/app/(app)/inventar/[id]/actiuni-obiect.tsx`, `src/app/(app)/inventar/nou/page.tsx`, `src/app/(app)/inventar/nou/formular-obiect.tsx`, `src/app/(app)/inventar/alocari/page.tsx`, `src/app/(app)/inventar/alocari/actions.ts`, `src/app/(app)/inventar/alocari/loading.tsx`, `src/app/(app)/inventar/alocari/formulare.tsx`, `src/app/(app)/angajati/[id]/bunuri/page.tsx`, `src/app/(app)/angajati/[id]/bunuri/loading.tsx`.