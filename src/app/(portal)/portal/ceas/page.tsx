// src/app/(portal)/portal/ceas/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Lock } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, oraInBucharest, todayInBucharest } from "@/lib/format/date";
import { citestePerioada, setariPontaj, setariPontareRapida } from "@/lib/queries/attendance";
import { fisaMea, pontajulMeu } from "@/lib/queries/portal";
import { configZiDin, intervalulPropus } from "@/domain/attendance/calcul-ore";
import { stareaCeasului } from "@/domain/attendance/ceas";
import { configPontareRapida } from "@/domain/attendance/pontare-rapida";

import { FaraFisa } from "../fara-fisa";
import { PontareRapida } from "../pontare-rapida";

export const metadata: Metadata = { title: "Pontează" };

/**
 * Ținta scurtăturii din manifest — apăsarea lungă pe iconița de pe ecranul de
 * start duce direct aici.
 *
 * Există ca PAGINĂ, nu doar ca acel card de pe ecranul de start, dintr-un motiv
 * practic: deschiderea la rece a aplicației trebuie să ducă în locul cu un
 * singur buton mare, nu într-un ecran cu șase carduri prin care omul caută. Iar
 * o scurtătură care aterizează pe ecranul de start ar fi doar un al doilea drum
 * spre același loc.
 *
 * Preambulul e complet, deși învelișul portalului a verificat deja sesiunea:
 * un layout NU e barieră de autorizare, iar pagina asta se poate deschide
 * direct, din scurtătură, fără să treacă prin ecranul de start.
 */
export default async function PaginaCeas() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a completa pontajul." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const azi = todayInBucharest();
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));

  const [perioada, setari, randPontare, zile] = await Promise.all([
    citestePerioada(tenant.organizationId, an, luna),
    setariPontaj(tenant.organizationId, azi),
    setariPontareRapida(tenant.organizationId),
    pontajulMeu(tenant.organizationId, an, luna, stare.fisa.id),
  ]);

  const pontare = configPontareRapida(randPontare);
  const ziDeAzi = zile.find((z) => z.data === azi) ?? null;
  const config = configZiDin(setari);
  const stareCeas = stareaCeasului(ziDeAzi, oraInBucharest(new Date()));
  const intervalPropus =
    pontare.programStart === null ? null : intervalulPropus(pontare.programStart, config);

  const antet = <AntetPagina titlu={formatDate(azi)} descriere="Pontajul dumneavoastră de azi." />;

  // Firma n-a aprins pontarea rapidă: scurtătura n-are ce face, dar nici nu
  // trebuie să ducă într-un ecran gol. Omul e trimis unde poate lucra.
  if (pontare.mod === "oprit") {
    return (
      <div className={`${LATIMI.formular} space-y-4 p-4`}>
        {antet}
        <StareGoala
          fel="initiala"
          pictograma={Clock}
          titlu="Pontarea dintr-o atingere nu e activată"
          descriere="Firma dumneavoastră completează pontajul cu ore de intrare și de ieșire. Deschideți ziua și scrieți-le."
        />
        <p>
          <Link href={`/portal/pontajul-meu/zi/${azi}`} className={buton({ varianta: "primar" })}>
            Completează ziua
          </Link>
        </p>
      </div>
    );
  }

  if (perioada === null || perioada.status !== "deschisa") {
    return (
      <div className={`${LATIMI.formular} space-y-4 p-4`}>
        {antet}
        <StareGoala
          fel="restrictionata"
          pictograma={Lock}
          titlu="Luna nu este deschisă pentru pontaj"
          descriere="Pontajul se completează doar cât timp luna e deschisă de resursele umane. Pentru o corectură, întrebați responsabilul de pontaj."
        />
      </div>
    );
  }

  return (
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      {antet}
      <section className="bg-surface border-border rounded-panou border p-4">
        <PontareRapida
          stare={stareCeas}
          pontare={pontare}
          intervalPropus={intervalPropus}
          numeFirma={tenant.name}
          lunaDeschisa
        />
        {stareCeas.fel === "alta_sursa" ? (
          <p className="text-muted-foreground text-corp">
            Ziua de azi e deja înregistrată — din concediu, din foaia colectivă sau ca absență.
          </p>
        ) : null}
      </section>
      <p>
        <Link href="/portal/pontajul-meu" className={buton({ varianta: "link" })}>
          Vezi luna întreagă
        </Link>
      </p>
    </div>
  );
}
