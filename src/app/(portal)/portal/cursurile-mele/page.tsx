// src/app/(portal)/portal/cursurile-mele/page.tsx
//
// O LISTĂ DE SARCINI, nu un catalog. Restanțele întâi, un singur buton primar
// per card, zero taburi. Angajatul intră de pe telefon: `<main>` din portal e
// `max-w-3xl`, iar pagina își pune singură `p-4`.

import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Nivel } from "@/components/ui/nivel";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { cursurileMele } from "@/lib/queries/cursuri";
import { fisaMea } from "@/lib/queries/portal";
import { treaptaTermen, treaptaValabilitate } from "@/domain/cursuri/scadente";

import { DESCRIERI, ETICHETE_STATUS, TITLURI, TONURI_STATUS } from "@/app/(app)/cursuri/etichete";
import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: TITLURI.portal };

export default async function PaginaCursurileMele() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "courses");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cursurile." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  // `employeeId` EXPLICIT: un cont cu `courses:read = all` care intră în portal
  // ar vedea altfel toată firma sub „ale mele".
  const cursuri = await cursurileMele(tenant.organizationId, stare.fisa.id);
  const azi = todayInBucharest();

  const deFacut = cursuri.filter(
    (c) => c.inrolare.status === "neinceput" || c.inrolare.status === "in_curs",
  );
  const parcurse = cursuri.filter(
    (c) => c.inrolare.status === "finalizat" || c.inrolare.status === "expirat",
  );

  return (
    <div className="space-y-6 p-4">
      <AntetPagina titlu={TITLURI.portal} descriere={DESCRIERI.portal} />

      {cursuri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={GraduationCap}
          titlu="Niciun curs"
          descriere="Când firma vă atribuie un curs, apare aici și primiți o notificare."
        />
      ) : null}

      {deFacut.length > 0 ? (
        <section aria-labelledby="titlu-de-facut" className="space-y-3">
          <h2 id="titlu-de-facut" className="text-sectiune font-medium">
            De parcurs
          </h2>
          <ul className="space-y-3">
            {deFacut.map((c) => {
              const treapta = treaptaTermen(c.inrolare.termen, azi, c.inrolare.status);
              return (
                <li
                  key={c.inrolare.id}
                  className="bg-surface border-border rounded-panou border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="flex-1 font-medium">{c.denumire}</h3>
                    {c.obligatoriu ? <Badge ton="atentie">Obligatoriu</Badge> : null}
                  </div>

                  {c.descriere === null ? null : (
                    <p className="text-muted-foreground text-corp mt-1">{c.descriere}</p>
                  )}

                  <div className="mt-3">
                    <Nivel
                      valoare={c.inrolare.materiale_finalizate}
                      din={Math.max(1, c.inrolare.materiale_total)}
                      eticheta="Progresul cursului"
                      text={`${String(c.inrolare.materiale_finalizate)} din ${String(c.inrolare.materiale_total)} lecții parcurse`}
                      ton={c.inrolare.materiale_finalizate > 0 ? "bun" : "neutru"}
                    />
                  </div>

                  <p className="text-nota mt-2">
                    <Scadenta treapta={treapta}>
                      {c.inrolare.termen === null
                        ? "Fără termen"
                        : `Termen: ${formatDate(c.inrolare.termen)}`}
                    </Scadenta>
                  </p>

                  <div className="mt-3">
                    <Link
                      href={`/portal/cursurile-mele/${c.inrolare.id}`}
                      className={buton({ varianta: "primar" })}
                    >
                      {c.inrolare.materiale_finalizate > 0 ? "Continuați" : "Începeți"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {parcurse.length > 0 ? (
        <section aria-labelledby="titlu-parcurse" className="space-y-3">
          <h2 id="titlu-parcurse" className="text-sectiune font-medium">
            Parcurse
          </h2>
          <ul className="divide-border border-border rounded-panou divide-y border">
            {parcurse.map((c) => (
              <li key={c.inrolare.id} className="flex flex-wrap items-center gap-2 p-3">
                <Link
                  href={`/portal/cursurile-mele/${c.inrolare.id}`}
                  className="flex-1 font-medium underline-offset-2 hover:underline"
                >
                  {c.denumire}
                </Link>
                <Badge ton={TONURI_STATUS[c.inrolare.status]}>
                  {ETICHETE_STATUS[c.inrolare.status]}
                </Badge>
                {c.inrolare.expira_la === null ? null : (
                  <Scadenta
                    treapta={treaptaValabilitate(c.inrolare.expira_la, azi, c.prag_avertizare_zile)}
                  >
                    {`Valabil până la ${formatDate(c.inrolare.expira_la)}`}
                  </Scadenta>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
