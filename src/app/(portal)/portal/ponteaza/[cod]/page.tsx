// src/app/(portal)/portal/ponteaza/[cod]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Lock, QrCode } from "lucide-react";

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

import { FaraFisa } from "../../fara-fisa";
import { PontareRapida } from "../../pontare-rapida";

export const metadata: Metadata = { title: "Pontare" };

/**
 * Ținta codului QR de pe afișul punctului de lucru.
 *
 * ── DE CE PAGINA NU REZOLVĂ EA CODUL ────────────────────────────────────────
 * Ar părea firesc să afișeze „Pontați la Hala 2" înainte de apăsare. Nu poate:
 * politica `puncte_lucru_select` (0030) cere `departments:read <> 'none'`, iar
 * rolul `employee` n-are NICIO permisiune pe `departments` (0002:1206-1219).
 * Iar clientul admin e permis de ESLint doar în `actions.ts`, în rutele de API și
 * în scripturi — nu în pagini, tocmai ca ocolirile de RLS să rămână numărabile.
 *
 * Deci codul e doar TRANSPORTAT până la acțiune, care îl rezolvă pe server, cu
 * filtru explicit pe organizație, și întoarce numele punctului odată cu
 * confirmarea. Angajatul află unde s-a pontat DUPĂ apăsare, nu înainte — o
 * pierdere mică, în schimbul unei singure ocoliri de RLS, în locul în care
 * proiectul le ține pe toate.
 *
 * ── CE SE ÎNTÂMPLĂ CU UN COD STRĂIN ─────────────────────────────────────────
 * Un cod al altei firme nu produce nicio scurgere: acțiunea filtrează pe
 * organizația din sesiune, deci rezultatul e „codul nu aparține firmei
 * dumneavoastră", identic cu un cod inventat. Pagina nu confirmă niciodată că un
 * cod EXISTĂ undeva.
 */
export default async function PaginaPonteazaCod({
  params,
}: {
  readonly params: Promise<{ readonly cod: string }>;
}) {
  const { cod } = await params;
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

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

  const antet = (
    <AntetPagina
      titlu="Pontare"
      descriere={`${formatDate(azi)} · ați scanat codul de la intrare`}
    />
  );

  if (pontare.mod === "oprit") {
    return (
      <div className={`${LATIMI.formular} space-y-4 p-4`}>
        {antet}
        <StareGoala
          fel="initiala"
          pictograma={QrCode}
          titlu="Pontarea prin cod nu e activată"
          descriere="Firma dumneavoastră completează pontajul cu ore de intrare și de ieșire. Afișul pe care l-ați scanat e probabil vechi."
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
          descriere="Pontajul se completează doar cât timp luna e deschisă de resursele umane. Anunțați responsabilul de pontaj."
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
          cod={cod}
        />
        {stareCeas.fel === "alta_sursa" ? (
          <p className="text-muted-foreground text-corp">
            Ziua de azi e deja înregistrată — din concediu, din foaia colectivă sau ca absență.
          </p>
        ) : null}
      </section>
    </div>
  );
}
