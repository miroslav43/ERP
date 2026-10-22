// src/app/(app)/flota/rezervari/sectiune-vehicul.tsx
//
// Secțiunea „Rezervări” de pe fișa unei mașini de pool (0216, F12d): următoarele
// rezervări active și „Rezervă”. Componentă de server care își citește singură
// datele: fișa vehiculului primește doar un import și un element (regula de o
// linie din README-ul F12, §2.2), iar logica stă aici.
//
// Nimic pentru o mașină care nu e pool și nimic pentru cine n-are
// `vehicle_reservations:read` (ex. `hr` din decizia 3, care își vede mașina
// alocată fără restul flotei).
import Link from "next/link";
import type { ReactElement } from "react";

import { buton } from "@/components/ui/buton";
import { can, scopeFor, type PermissionMap } from "@/lib/auth/permissions";
import { idFisaProprie } from "@/lib/queries/employees";
import { rezervarileVehiculului } from "@/lib/queries/fleet-rezervari";

import { RandRezervareCard } from "./rand-rezervare";

export type PropsSectiuneRezervariVehicul = Readonly<{
  organizationId: string;
  userId: string;
  vehicul: Readonly<{ id: string; pool: boolean; status: string }>;
  permisiuni: PermissionMap;
  azi: string;
}>;

export async function SectiuneRezervariVehicul({
  organizationId,
  userId,
  vehicul,
  permisiuni,
  azi,
}: PropsSectiuneRezervariVehicul): Promise<ReactElement | null> {
  if (!vehicul.pool || !can(permisiuni, "vehicle_reservations:read", "own")) return null;

  const [rezervari, fisaMeaId] = await Promise.all([
    rezervarileVehiculului(organizationId, vehicul.id, azi),
    idFisaProprie(organizationId, userId),
  ]);
  const poateRezerva =
    can(permisiuni, "vehicle_reservations:create", "own") &&
    (vehicul.status === "activ" || vehicul.status === "in_service");

  return (
    <section aria-labelledby="rezervari-vehicul" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rezervari-vehicul" className="text-sectiune font-semibold">
          Rezervări
        </h2>
        {poateRezerva ? (
          <Link
            href={`/flota/rezervari?rezervare=noua&vehicul=${vehicul.id}`}
            className={buton({ varianta: "secundar" })}
          >
            Rezervă
          </Link>
        ) : null}
      </div>
      {rezervari.length === 0 ? (
        <p className="text-muted-foreground text-corp">
          Nicio rezervare activă de azi înainte.{" "}
          <Link href="/flota/rezervari" className="underline underline-offset-2">
            Grila de ocupare
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {rezervari.map((r) => (
            <RandRezervareCard
              key={r.id}
              rezervare={r}
              azi={azi}
              fisaMeaId={fisaMeaId}
              drepturi={{
                update: scopeFor(permisiuni, "vehicle_reservations:update"),
                approve: scopeFor(permisiuni, "vehicle_reservations:approve"),
                poateCreaFoaie: can(permisiuni, "trip_sheets:create", "own"),
              }}
              bazaFoaie="/flota/foi"
              afiseazaVehicul={false}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
