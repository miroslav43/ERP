// src/app/(portal)/portal/masina-mea/rezervari/card-urmatoare.tsx
//
// Cardul „Rezervările mele următoare” din „Mașina mea” (0216, F12d): cel mult
// trei, și legătura spre `/portal/masina-mea/rezervari`. Componentă de server
// care își citește singură datele: pagina „Mașina mea” primește doar un import
// și un element. Nimic pentru cine n-are `vehicle_reservations:read`.
import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { stareAfisata } from "@/domain/fleet/rezervari";
import { can, type PermissionMap } from "@/lib/auth/permissions";
import { formatInterval } from "@/lib/format/date";
import { urmatoareleMeleRezervari } from "@/lib/queries/fleet-rezervari";
import { ETICHETE_STARE_AFISATA, TONURI_STARE_AFISATA } from "@/app/(app)/flota/rezervari/etichete";

export type PropsCardRezervariUrmatoare = Readonly<{
  organizationId: string;
  fisaId: string;
  permisiuni: PermissionMap;
  azi: string;
}>;

export async function CardRezervariUrmatoare({
  organizationId,
  fisaId,
  permisiuni,
  azi,
}: PropsCardRezervariUrmatoare): Promise<ReactElement | null> {
  if (!can(permisiuni, "vehicle_reservations:read", "own")) return null;
  const rezervari = await urmatoareleMeleRezervari(organizationId, fisaId, azi, 3);

  return (
    <section aria-labelledby="titlu-rezervari-mele" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titlu-rezervari-mele" className="text-sectiune font-semibold">
          Rezervările mele următoare
        </h2>
        <Link
          href="/portal/masina-mea/rezervari"
          className="text-corp underline underline-offset-2"
        >
          {can(permisiuni, "vehicle_reservations:create", "own")
            ? "Rezervă o mașină comună"
            : "Toate rezervările"}
        </Link>
      </div>
      {rezervari.length === 0 ? (
        <p className="text-muted-foreground text-corp">Nicio rezervare de azi înainte.</p>
      ) : (
        <ul className="space-y-2">
          {rezervari.map((r) => {
            const stare = stareAfisata(r, azi);
            return (
              <li
                key={r.id}
                className="bg-surface border-border rounded-panou flex flex-wrap items-start justify-between gap-3 border p-4"
              >
                <div className="min-w-0">
                  <p className="text-foreground text-corp font-medium">
                    {r.vehicul?.nr_inmatriculare ?? "Mașina nu mai e în pool"}
                  </p>
                  <p className="text-muted-foreground text-corp tabular-nums">
                    {formatInterval(r.de_la, r.pana_la)}
                  </p>
                </div>
                <Badge ton={TONURI_STARE_AFISATA[stare]}>{ETICHETE_STARE_AFISATA[stare]}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
