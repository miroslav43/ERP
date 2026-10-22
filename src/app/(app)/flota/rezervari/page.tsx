// src/app/(app)/flota/rezervari/page.tsx
//
// Rezervările mașinilor de pool (0216, F12d): grila de ocupare pe 14 zile,
// cererile care așteaptă decizia și lista rezervărilor vizibile.
//
// Ce vede fiecare rol decide `rezervari_select`: ale lui (employee), ale lui și
// ale echipei (manager), toată firma (org_admin). Ocuparea colegilor vine prin
// `ocupareaPool`, fără identitate. `hr` n-are nicio cheie: AccesRestrictionat.
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { FileModul } from "@/components/ui/file-modul";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { FILE_FLOTA } from "@/config/file-module";
import { adaugaZile } from "@/domain/attendance/saptamana";
import { grilaOcupare, ZILE_GRILA } from "@/domain/fleet/rezervari";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { todayInBucharest } from "@/lib/format/date";
import {
  angajatiPentruRezervare,
  listeazaRezervari,
  ocupareaPool,
  PE_PAGINA_REZERVARI,
  rezervariDeAprobat,
  setarileRezervarilor,
  vehiculePool,
} from "@/lib/queries/fleet-rezervari";
import { fisaMea } from "@/lib/queries/portal";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreRezervariSchema } from "@/schemas/fleet-rezervari";

import { DialogRezervareNoua } from "./dialog-rezervare-noua";
import { FiltreRezervari } from "./filtre-rezervari";
import { GrilaOcuparii } from "./grila-ocupare";
import { RandRezervareCard, type DrepturiRezervari } from "./rand-rezervare";

export const metadata: Metadata = { title: "Rezervări de mașini" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const BAZA = "/flota/rezervari";

export default async function PaginaRezervari({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "vehicle_reservations:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta rezervările mașinilor. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateRezerva = can(permisiuni, "vehicle_reservations:create", "own");
  const poateAproba = can(permisiuni, "vehicle_reservations:approve", "team");
  const poateRezervaPentruOricine = scopeFor(permisiuni, "vehicle_reservations:create") === "all";
  const aprobaOricui = scopeFor(permisiuni, "vehicle_reservations:approve") === "all";
  const poateMarcaPool = can(permisiuni, "vehicles:update", "all");
  const drepturi: DrepturiRezervari = {
    update: scopeFor(permisiuni, "vehicle_reservations:update"),
    approve: scopeFor(permisiuni, "vehicle_reservations:approve"),
    poateCreaFoaie: can(permisiuni, "trip_sheets:create", "own"),
  };

  const parametri = await searchParams;
  const filtre = filtreDinUrl(filtreRezervariSchema, parametri);
  const azi = todayInBucharest();
  const ultimaZi = adaugaZile(azi, ZILE_GRILA - 1);
  const deschideCaseta = parametri["rezervare"] === "noua";
  const text = (cheie: string): string | null => {
    const v = parametri[cheie];
    return typeof v === "string" && v.length > 0 ? v : null;
  };

  const [vehicule, ocupari, setari, stareFisa, angajati, pagina] = await Promise.all([
    vehiculePool(tenant.organizationId),
    ocupareaPool(tenant.organizationId, azi, ultimaZi),
    setarileRezervarilor(tenant.organizationId),
    fisaMea(tenant.organizationId, user.id),
    poateRezervaPentruOricine
      ? angajatiPentruRezervare(tenant.organizationId)
      : Promise.resolve(null),
    listeazaRezervari(tenant.organizationId, filtre),
  ]);
  const fisaMeaId = stareFisa.stare === "ok" ? stareFisa.fisa.id : null;
  const deAprobat = poateAproba
    ? await rezervariDeAprobat(tenant.organizationId, fisaMeaId, azi)
    : [];
  const grila = grilaOcupare(ocupari, vehicule, azi, ZILE_GRILA);
  // Omul fără fișă (administrator invitat) rezervă doar pentru altcineva.
  const casetaUtila = poateRezerva && (fisaMeaId !== null || poateRezervaPentruOricine);

  function adresa(cursor: string | null): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "" && cheie !== "rezervare")
        p.set(cheie, valoare);
    }
    if (cursor === null) p.delete("cursor");
    else p.set("cursor", cursor);
    return p.size === 0 ? BAZA : `${BAZA}?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Rezervări"
        descriere={
          setari.cuAprobare
            ? "Mașinile comune se rezervă pe zile întregi; rezervarea merge la aprobare. Zilele cerute se blochează de la cerere."
            : "Mașinile comune se rezervă pe zile întregi și se confirmă pe loc."
        }
        {...(casetaUtila && vehicule.length > 0
          ? {
              actiuni: (
                <DialogRezervareNoua
                  key={deschideCaseta ? "rezervare-noua" : "lista"}
                  vehicule={vehicule}
                  angajati={angajati}
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
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />

      <section aria-labelledby="titlu-ocupare" className="space-y-3">
        <h2 id="titlu-ocupare" className="text-sectiune font-semibold">
          Ocuparea în următoarele {ZILE_GRILA} zile
        </h2>
        {vehicule.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={CalendarDays}
            titlu="Nicio mașină de pool"
            descriere={
              poateMarcaPool
                ? "Marcați o mașină drept pool din fișa ei, ca să poată fi rezervată de colegi."
                : "Firma nu are încă mașini comune de rezervat."
            }
            {...(poateMarcaPool ? { actiune: { eticheta: "Parcul auto", href: "/flota" } } : {})}
          />
        ) : (
          <GrilaOcuparii grila={grila} bazaRezervare={casetaUtila ? BAZA : null} azi={azi} />
        )}
      </section>

      {poateAproba ? (
        <section aria-labelledby="titlu-de-aprobat" className="space-y-3">
          <h2 id="titlu-de-aprobat" className="text-sectiune font-semibold">
            De aprobat
          </h2>
          {deAprobat.length === 0 ? (
            <p className="text-muted-foreground text-corp">
              Nicio cerere nu așteaptă decizia dumneavoastră.
            </p>
          ) : (
            <ul className="space-y-2">
              {deAprobat.map((r) => (
                <RandRezervareCard
                  key={r.id}
                  rezervare={r}
                  azi={azi}
                  fisaMeaId={fisaMeaId}
                  drepturi={drepturi}
                  bazaFoaie="/flota/foi"
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section aria-labelledby="titlu-rezervari" className="space-y-3">
        <h2 id="titlu-rezervari" className="text-sectiune font-semibold">
          Toate rezervările
        </h2>
        <FiltreRezervari parametri={parametri} vehicule={vehicule} />
        {pagina.randuri.length === 0 ? (
          <StareGoala
            fel={filtre.stare !== null || filtre.vehicul !== null ? "filtrata" : "initiala"}
            pictograma={CalendarDays}
            titlu="Nicio rezervare"
            descriere={
              filtre.stare !== null || filtre.vehicul !== null
                ? "Ștergeți filtrele ca să vedeți toate rezervările."
                : "Rezervările făcute pe mașinile comune apar aici."
            }
          />
        ) : (
          <>
            <ul className="space-y-2">
              {pagina.randuri.map((r) => (
                <RandRezervareCard
                  key={r.id}
                  rezervare={r}
                  azi={azi}
                  fisaMeaId={fisaMeaId}
                  drepturi={drepturi}
                  bazaFoaie="/flota/foi"
                />
              ))}
            </ul>
            <Paginare
              afisate={pagina.randuri.length}
              total={null}
              cursorUrmator={pagina.urmatorulCursor}
              limita={PE_PAGINA_REZERVARI}
              marimiPosibile={[PE_PAGINA_REZERVARI]}
              construiesteHref={({ cursor }) => adresa(cursor)}
            />
          </>
        )}
        {filtre.cursor === null ? null : (
          <p className="text-nota">
            <Link href={adresa(null)} className="underline underline-offset-2">
              Înapoi la început
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
