// src/app/(app)/anunturi/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { LIMITA_ANUNTURI, listeazaAnunturi } from "@/lib/queries/announcements";
import { Megaphone, Pin } from "lucide-react";

import { FormularAnuntNou } from "./formular-anunt-nou";

export const metadata: Metadata = { title: "Anunțuri" };

export default async function PaginaAnunturi() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "announcements");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </div>
    );
  }

  const poateAdministra = can(permisiuni, "announcements:update", "all");
  const { randuri: anunturi, trunchiat } = await listeazaAnunturi(tenant.organizationId);
  const acum = new Date();

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina titlu="Anunțuri" descriere="Avizierul organizației." />

      {poateAdministra ? <FormularAnuntNou /> : null}

      {anunturi.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Megaphone}
          titlu="Niciun anunț"
          descriere={
            poateAdministra
              ? "Scrieți primul anunț mai sus."
              : "Nu există încă niciun anunț publicat."
          }
        />
      ) : (
        <ul className="divide-border border-border rounded-panou divide-y border">
          {anunturi.map((a) => {
            const ciorna = a.publicat_la === null;
            const expirat =
              a.expira_la !== null && new Date(a.expira_la).getTime() < acum.getTime();
            return (
              <li key={a.id} className="p-4">
                {/*
                  Pastilele stau ÎN AFARA linkului: înăuntru se subliniau odată
                  cu titlul la hover și intrau în numele accesibil al linkului,
                  care ajungea „Ciornă Expirat Titlu”.
                */}
                <div className="flex flex-wrap items-center gap-2">
                  {a.fixat ? (
                    <>
                      <Pin className="text-primary size-4 shrink-0" aria-hidden="true" />
                      {/* Fără asta, „fixat” e o pictogramă mută: la cititorul de ecran informația dispărea complet. */}
                      <span className="sr-only">Fixat în capul listei.</span>
                    </>
                  ) : null}
                  <Link
                    href={`/anunturi/${a.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {a.titlu}
                  </Link>
                  {/*
                    „Ciornă” și „Expirat” erau caracter cu caracter aceeași
                    pastilă gri — două stări cu consecințe opuse (una n-a fost
                    încă văzută de nimeni, cealaltă n-o mai vede nimeni).
                    `Badge` le separă prin bulină goală vs. pictogramă de
                    avertisment, deci și fără culoare, și la imprimantă.
                  */}
                  {ciorna ? <Badge ton="ciorna">Ciornă</Badge> : null}
                  {expirat ? (
                    <Badge ton="neutru" cuAvertisment>
                      Expirat
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-nota mt-1">
                  {a.publicat_la === null
                    ? `Creat ${formatDateTime(a.created_at)}`
                    : `Publicat ${formatDateTime(a.publicat_la)}`}
                  {/*
                    `expira_la` se citea din bază doar ca să se calculeze
                    pastila; data în sine nu apărea nicăieri în listă, deci
                    „mai e valabil o zi” nu se putea afla decât deschizând
                    fiecare anunț.
                  */}
                  {a.expira_la === null
                    ? ""
                    : ` · ${expirat ? "a expirat" : "expiră"} ${formatDateTime(a.expira_la)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {trunchiat ? (
        <p role="status" className="text-muted-foreground text-nota">
          Lista se oprește la {LIMITA_ANUNTURI} de anunțuri, cele mai recente. Avizierul mai are și
          altele, mai vechi, care nu apar aici.
        </p>
      ) : null}
    </div>
  );
}
