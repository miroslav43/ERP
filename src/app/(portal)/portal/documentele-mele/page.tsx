// src/app/(portal)/portal/documentele-mele/page.tsx
import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { requireFeature } from "@/lib/auth/features";
import { formatDate } from "@/lib/format/date";
import { documenteleMele, fisaProprie } from "@/lib/queries/portal";

export const metadata: Metadata = { title: "Documentele mele" };

export default async function PaginaDocumenteleMele() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "employee_portal");

  const fisa = await fisaProprie(tenant.organizationId, user.id);
  if (fisa === null) {
    return (
      <div className="p-4">
        <div className="bg-surface border-border rounded-lg border p-6 text-center">
          <h1 className="text-foreground text-lg font-semibold">Nu aveți o fișă de personal</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Documentele se emit către un angajat. Cereți resurselor umane să vă completeze fișa.
          </p>
        </div>
      </div>
    );
  }

  const documente = await documenteleMele(tenant.organizationId, fisa.id);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold">Documentele mele</h1>
        <p className="text-muted-foreground text-sm">
          Adeverințele și fișele emise pe numele dumneavoastră.
        </p>
      </div>

      {documente.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Niciun document emis"
          description="Adeverințele de venit, de vechime și celelalte documente apar aici după ce le emit resursele umane. Puteți cere unul direct departamentului."
        />
      ) : (
        <ul className="space-y-2">
          {documente.map((d) => {
            const anulat = d.anulat_la !== null;
            return (
              <li
                key={d.id}
                className="bg-surface border-border rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={
                        anulat
                          ? "text-muted-foreground text-sm font-medium line-through"
                          : "text-foreground text-sm font-medium"
                      }
                    >
                      {d.titlu}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {d.numar_afisat === null ? null : `${d.numar_afisat} · `}
                      emis {formatDate(d.emis_la)}
                      {d.valabil_pana === null
                        ? null
                        : ` · valabil până ${formatDate(d.valabil_pana)}`}
                    </p>
                    {d.scop === null ? null : (
                      <p className="text-muted-foreground mt-1 text-xs">{d.scop}</p>
                    )}
                  </div>
                  {/* Un document anulat rămâne vizibil, marcat ca atare: dispariția
                      lui l-ar face pe om să creadă că nu l-a primit niciodată. */}
                  {anulat ? (
                    <span className="border-danger text-danger shrink-0 rounded border px-2 py-0.5 text-xs">
                      Anulat
                    </span>
                  ) : null}
                </div>

                {/* Codul de verificare e util în afara aplicației: cine primește
                    adeverința îl poate confirma fără să aibă cont. */}
                {d.cod_verificare === null || anulat ? null : (
                  <p className="text-muted-foreground mt-2 font-mono text-xs">
                    Cod de verificare: {d.cod_verificare}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
