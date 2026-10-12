// src/components/registru/numar-registru.tsx
import "server-only";

import Link from "next/link";
import { Fragment } from "react";

import { poateDeschide } from "@/config/porti-ruta";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { numereRegistruPentru } from "@/lib/queries/registru";

/**
 * Numărul de înregistrare al unui document-sursă, ca drum înapoi spre registru.
 *
 * Relația exista doar într-un sens: din registru se deschidea documentul, dar
 * fișa cererii, a deplasării, a foii, a accidentului sau a perioadei de
 * salarizare nu-și arăta numărul, deci nici rândul lui (analiza 2026-10-08,
 * registru-L8/P8). Componenta e autonomă — își citește porțile singură
 * (memoizate pe cerere) — tocmai ca să se poată pune pe orice fișă fără
 * plumbing. Citirea trece prin RLS: cine n-are `registru:read` primește zero
 * rânduri, iar componenta nu randează nimic; linkul apare doar pentru cine poate
 * deschide `/registru`, restul văd numărul ca text.
 *
 * O perioadă de salarizare poate avea mai multe înregistrări (statul, nota
 * contabilă, fișierul bancar, D112): se enumeră toate, în ordinea numerelor.
 */
export async function NumarRegistru({
  tenant,
  entitateTip,
  entitateId,
}: Readonly<{
  tenant: Readonly<{
    organizationId: string;
    role: Parameters<typeof getPermissionMap>[1];
    memberId: Parameters<typeof getPermissionMap>[2];
  }>;
  /** `entitate_tip` din registru; mai multe pentru documentele cu variante. */
  entitateTip: string | readonly string[];
  entitateId: string;
}>) {
  const tipuri = typeof entitateTip === "string" ? [entitateTip] : entitateTip;
  const [permisiuni, module, numere] = await Promise.all([
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
    numereRegistruPentru(tenant.organizationId, tipuri, [entitateId]),
  ]);
  const randuri = numere.get(entitateId) ?? [];
  if (randuri.length === 0) return null;
  const deschide = poateDeschide("/registru", { features: module, permissions: permisiuni });

  return (
    <p className="text-muted-foreground text-nota">
      {randuri.length === 1
        ? "Înregistrat în registru sub nr. "
        : "Înregistrat în registru sub nr. "}
      {randuri.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 ? ", " : ""}
          {deschide ? (
            <Link
              href={`/registru?an=${String(r.an)}&doc=${r.id}`}
              className="text-foreground tabular-nums underline-offset-2 hover:underline"
            >
              {r.numarAfisat}
            </Link>
          ) : (
            <span className="text-foreground tabular-nums">{r.numarAfisat}</span>
          )}
        </Fragment>
      ))}
    </p>
  );
}
