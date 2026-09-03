// src/app/(portal)/portal/documentele-mele/page.tsx
import type { Metadata } from "next";
import { FileText } from "lucide-react";

import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { StareGoala } from "@/components/ui/stare-goala";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { requireFeature } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import { documenteleMele, fisaMea } from "@/lib/queries/portal";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Documentele mele" };

export default async function PaginaDocumenteleMele() {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "employee_portal"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // Gardul lipsea. Pagina se sprijinea doar pe RLS, ceea ce funcționa — dar
  // preambulul canonic are patru pași tocmai ca refuzul să fie explicit și
  // vizibil, nu o listă goală pe care omul o citește ca „nu am documente".
  if (!can(permisiuni, "employees:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta documentele emise pe numele dumneavoastră." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const documente = await documenteleMele(tenant.organizationId, stare.fisa.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-foreground text-titlu font-semibold">Documentele mele</h1>
        <p className="text-muted-foreground text-corp">
          Adeverințele și fișele emise pe numele dumneavoastră.
        </p>
      </div>

      {documente.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={FileText}
          titlu="Niciun document emis"
          descriere="Adeverințele de venit, de vechime și celelalte documente apar aici după ce le emit resursele umane. Puteți cere unul direct departamentului."
        />
      ) : (
        <ul className="space-y-2">
          {documente.map((d) => {
            const anulat = d.anulat_la !== null;
            return (
              <li key={d.id} className="bg-surface border-border rounded-panou border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={
                        anulat
                          ? "text-muted-foreground text-corp font-medium line-through"
                          : "text-foreground text-corp font-medium"
                      }
                    >
                      {d.titlu}
                    </p>
                    <p className="text-muted-foreground text-corp">
                      {d.numar_afisat === null ? null : `${d.numar_afisat} · `}
                      emis {formatDate(d.emis_la)}
                      {d.valabil_pana === null
                        ? null
                        : ` · valabil până ${formatDate(d.valabil_pana)}`}
                    </p>
                    {d.scop === null ? null : (
                      <p className="text-muted-foreground text-nota mt-1">{d.scop}</p>
                    )}
                  </div>
                  {/* Un document anulat rămâne vizibil, marcat ca atare: dispariția
                      lui l-ar face pe om să creadă că nu l-a primit niciodată. */}
                  {anulat ? (
                    <span className="border-danger text-danger text-nota shrink-0 rounded border px-2 py-0.5">
                      Anulat
                    </span>
                  ) : null}
                </div>

                {/* Codul de verificare e util în afara aplicației: cine primește
                    adeverința îl poate confirma fără să aibă cont. */}
                {d.cod_verificare === null || anulat ? null : (
                  <p className="text-muted-foreground text-nota mt-2 font-mono">
                    Cod de verificare: {d.cod_verificare}
                  </p>
                )}

                {/*
                  Singura legătură din portal care iese din `/portal`, și e
                  intenționat: `documente/[id]` e Route Handler, deci nu trece
                  prin layout și nu e prins de poarta de rol. E și singurul drum
                  prin care angajatul își deschide adeverința — `hr_issued_select`
                  are ramură `own`. Pagina lista documentele fără niciun link
                  către ele, adică arăta ce există fără să-l lase să ajungă.
                */}
                {anulat ? null : (
                  <Link
                    href={`/documente/${d.id}`}
                    className="border-border hover:border-primary text-foreground rounded-control text-corp mt-3 inline-flex min-h-11 items-center border px-3 font-medium transition-colors"
                  >
                    Deschide pentru tipărire
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
