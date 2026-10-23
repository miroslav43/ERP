// src/app/(app)/flota/[id]/iesire/panou-termene-iesire.tsx
//
// Panoul „Termene după ieșirea din parc” de pe `/flota` (F12h): termenele
// DESCHISE ale tuturor vehiculelor ieșite, cele mai apropiate primele. Acolo
// duce notificarea zilnică a termenelor de ieșire (`internal.flota_rezumat`,
// ramura `else '/flota'`). Server component care își citește singur datele.
//
// Pagina îl randează doar sub `vehicles:read = all`: politicile ieșirilor cer
// exact asta (implicita I-h6). Fără termene deschise, panoul nu apare deloc.
import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Scadenta } from "@/components/ui/scadenta";
import { stareScadentaFlota } from "@/domain/fleet/scadente";
import { formatDate } from "@/lib/format/date";
import { termeneDeIesireDeschise } from "@/lib/queries/flota-iesire";

import { ETICHETE_NATURA_TERMEN, TONURI_NATURA_TERMEN, etichetaIesirii } from "./etichete-iesire";

/** Câte termene arată o pagină a panoului. */
export const TERMENE_PE_PAGINA = 10;

type Proprietati = Readonly<{
  organizationId: string;
  /** Cursorul paginii (`?termene=`), deja validat de pagină; `null` = prima. */
  cursor: string | null;
  /** `AAAA-LL-ZZ`, ziua României. */
  azi: string;
}>;

export async function PanouTermeneIesire({
  organizationId,
  cursor,
  azi,
}: Proprietati): Promise<ReactElement | null> {
  const pagina = await termeneDeIesireDeschise(organizationId, {
    cursor,
    limita: TERMENE_PE_PAGINA,
  });
  if (pagina.randuri.length === 0 && cursor === null) return null;

  return (
    <section
      aria-labelledby="titlu-termene-iesire"
      className="bg-surface border-border rounded-panou space-y-3 border p-4"
    >
      <div>
        <h2 id="titlu-termene-iesire" className="text-sectiune font-semibold">
          Termene după ieșirea din parc
        </h2>
        <p className="text-muted-foreground text-corp mt-0.5">
          Pașii încă deschiși ai vehiculelor vândute, casate sau radiate. Se bifează pe fișa
          vehiculului.
        </p>
      </div>
      {pagina.randuri.length === 0 ? (
        <p className="text-muted-foreground text-corp">Niciun alt termen deschis.</p>
      ) : (
        <ul className="divide-border divide-y">
          {pagina.randuri.map((t) => {
            const treapta = stareScadentaFlota(t.termen, azi);
            return (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-corp">
                    <Link
                      href={`/flota/${t.vehicle_id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {t.vehicul?.nr_inmatriculare ?? "Vehicul indisponibil"}
                    </Link>{" "}
                    · {t.denumire}
                  </p>
                  <p className="text-muted-foreground text-nota mt-0.5">
                    {etichetaIesirii(
                      t.iesire.tip,
                      t.iesire.destinatie_epava,
                      t.iesire.motiv_radiere,
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge ton={TONURI_NATURA_TERMEN[t.natura]}>
                    {ETICHETE_NATURA_TERMEN[t.natura]}
                  </Badge>
                  <Scadenta treapta={treapta}>
                    {treapta === "expirat"
                      ? `Depășit din ${formatDate(t.termen)}`
                      : `Până la ${formatDate(t.termen)}`}
                  </Scadenta>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-4">
        {cursor === null ? null : (
          <Link href="/flota" className="text-primary text-corp underline-offset-2 hover:underline">
            Primele termene
          </Link>
        )}
        {pagina.urmatorulCursor === null ? null : (
          <Link
            href={`/flota?termene=${encodeURIComponent(pagina.urmatorulCursor)}`}
            className="text-primary text-corp underline-offset-2 hover:underline"
          >
            Termenele următoare
          </Link>
        )}
      </div>
    </section>
  );
}
