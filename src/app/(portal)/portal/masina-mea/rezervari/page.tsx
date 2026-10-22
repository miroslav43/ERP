// src/app/(portal)/portal/masina-mea/rezervari/page.tsx
//
// „Mașina mea → Rezervări” (0216, F12d): rezervările MELE (filtru explicit pe
// fișa proprie, ca tot portalul), grila de ocupare pe 14 zile — fără nume, doar
// „ocupat” sau „al meu” — și caseta de rezervare nouă, aceeași componentă ca în
// aplicația mare. Selectul de angajat nu apare: în portal omul rezervă pentru el.
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { adaugaZile } from "@/domain/attendance/saptamana";
import { grilaOcupare, ZILE_GRILA } from "@/domain/fleet/rezervari";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { todayInBucharest } from "@/lib/format/date";
import {
  ocupareaPool,
  PE_PAGINA_REZERVARI,
  rezervarileMele,
  setarileRezervarilor,
  vehiculePool,
} from "@/lib/queries/fleet-rezervari";
import { fisaMea } from "@/lib/queries/portal";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { DialogRezervareNoua } from "@/app/(app)/flota/rezervari/dialog-rezervare-noua";
import { GrilaOcuparii } from "@/app/(app)/flota/rezervari/grila-ocupare";
import {
  RandRezervareCard,
  type DrepturiRezervari,
} from "@/app/(app)/flota/rezervari/rand-rezervare";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Rezervările mele" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const BAZA = "/portal/masina-mea/rezervari";

export default async function PaginaRezervarileMele({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "vehicle_reservations:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a rezerva mașinile comune. Solicitați administratorului organizației rolul potrivit." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const fisaId = stare.fisa.id;

  const parametri = await searchParams;
  const text = (cheie: string): string | null => {
    const v = parametri[cheie];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const cursor = text("cursor");
  const deschideCaseta = parametri["rezervare"] === "noua";
  const poateRezerva = can(permisiuni, "vehicle_reservations:create", "own");
  const drepturi: DrepturiRezervari = {
    update: scopeFor(permisiuni, "vehicle_reservations:update"),
    // În portal omul își vede doar rezervările lui: nu decide nimic aici
    // (decizia I-d11: responsabilul care aprobă lucrează în aplicația mare).
    approve: null,
    poateCreaFoaie: can(permisiuni, "trip_sheets:create", "own"),
  };
  const azi = todayInBucharest();

  const [vehicule, ocupari, setari, pagina] = await Promise.all([
    vehiculePool(tenant.organizationId),
    ocupareaPool(tenant.organizationId, azi, adaugaZile(azi, ZILE_GRILA - 1)),
    setarileRezervarilor(tenant.organizationId),
    rezervarileMele(tenant.organizationId, fisaId, cursor),
  ]);
  const grila = grilaOcupare(ocupari, vehicule, azi, ZILE_GRILA);
  const aprobaOricui = scopeFor(permisiuni, "vehicle_reservations:approve") === "all";

  return (
    <div className={`${LATIMI.lista} space-y-6 p-4`}>
      <AntetPagina
        titlu="Rezervările mele"
        firimituri={[{ eticheta: "Mașina mea", href: "/portal/masina-mea" }]}
        descriere={
          setari.cuAprobare && !aprobaOricui
            ? "Rezervați o mașină comună pe zile întregi. Rezervarea merge la aprobare; zilele se blochează de la cerere."
            : "Rezervați o mașină comună pe zile întregi. Rezervarea se confirmă pe loc."
        }
        {...(poateRezerva && vehicule.length > 0
          ? {
              actiuni: (
                <DialogRezervareNoua
                  key={deschideCaseta ? "rezervare-noua" : "lista"}
                  vehicule={vehicule}
                  angajati={null}
                  azi={azi}
                  maxZile={setari.maxZile}
                  seConfirmaImediat={!setari.cuAprobare || aprobaOricui}
                  deschisInitial={deschideCaseta}
                  vehiculInitial={text("vehicul")}
                  deLaInitial={text("de_la")}
                  baza={BAZA}
                />
              ),
            }
          : {})}
      />

      <section aria-labelledby="titlu-ocupare" className="space-y-3">
        <h2 id="titlu-ocupare" className="text-sectiune font-semibold">
          Mașinile comune, în următoarele {ZILE_GRILA} zile
        </h2>
        {vehicule.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={CalendarDays}
            titlu="Nicio mașină comună"
            descriere="Firma nu are încă mașini de pool de rezervat."
          />
        ) : (
          <GrilaOcuparii grila={grila} bazaRezervare={poateRezerva ? BAZA : null} azi={azi} />
        )}
      </section>

      <section aria-labelledby="titlu-ale-mele" className="space-y-3">
        <h2 id="titlu-ale-mele" className="text-sectiune font-semibold">
          Rezervările mele
        </h2>
        {pagina.randuri.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={CalendarDays}
            titlu="Nicio rezervare"
            descriere="Rezervările dumneavoastră apar aici, cu starea lor."
            {...(poateRezerva && vehicule.length > 0
              ? { actiune: { eticheta: "Rezervare nouă", href: `${BAZA}?rezervare=noua` } }
              : {})}
          />
        ) : (
          <>
            <ul className="space-y-2">
              {pagina.randuri.map((r) => (
                <RandRezervareCard
                  key={r.id}
                  rezervare={r}
                  azi={azi}
                  fisaMeaId={fisaId}
                  drepturi={drepturi}
                  bazaFoaie="/portal/masina-mea"
                  afiseazaAngajat={false}
                />
              ))}
            </ul>
            <Paginare
              afisate={pagina.randuri.length}
              total={null}
              cursorUrmator={pagina.urmatorulCursor}
              limita={PE_PAGINA_REZERVARI}
              marimiPosibile={[PE_PAGINA_REZERVARI]}
              construiesteHref={({ cursor: c }) => (c === null ? BAZA : `${BAZA}?cursor=${c}`)}
            />
          </>
        )}
        {cursor === null ? null : (
          <p className="text-nota">
            <Link href={BAZA} className="underline underline-offset-2">
              Înapoi la început
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
