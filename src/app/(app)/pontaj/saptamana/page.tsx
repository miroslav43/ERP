// src/app/(app)/pontaj/saptamana/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteSaptamanaPontaj, setariPontaj } from "@/lib/queries/attendance";
import { zileNelucratoare } from "@/lib/queries/leave";
import { adaugaZile, esteLuni, lunieaUrmatoare } from "@/domain/attendance/saptamana";

import { NavPontaj } from "../nav-pontaj";
import { ETICHETE_STARE_SAPTAMANA, TONURI_STARE_SAPTAMANA, esteZiLucratoare } from "../etichete";
import { FormularSaptamana } from "./formular-saptamana";

export const metadata: Metadata = { title: "Planul săptămânii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaSaptamanaPontaj({ searchParams }: ProprietatiPagina) {
  const { user, tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a completa un plan de prezență. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const parametruSaptamana = parametri["saptamana"];
  const saptamanaCeruta = typeof parametruSaptamana === "string" ? parametruSaptamana : "";
  const saptamanaStart = esteLuni(saptamanaCeruta)
    ? saptamanaCeruta
    : lunieaUrmatoare(todayInBucharest());

  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);
  if (propriaFisaId === null) {
    return (
      <AccesRestrictionat mesaj="Contul dvs. nu este legat de o fișă de angajat principală în această organizație." />
    );
  }

  const submisie = await citesteSaptamanaPontaj(
    tenant.organizationId,
    propriaFisaId,
    saptamanaStart,
  );

  /*
   * Implicitul se calcula ca 8 ore „La birou” pentru toate cele ȘAPTE zile,
   * sâmbăta și duminica incluse: cine deschidea ecranul și apăsa direct
   * „Trimite spre aprobare” declara 56 de ore planificate pe săptămână, dintre
   * care 16 într-un weekend pe care nu-l alesese nimeni. Norma zilnică vine
   * din `attendance_settings` (fără rând de setări, 8 — același implicit ca în
   * `celula-zi.tsx`), iar zilele nelucrătoare pornesc de la 0: le poate ridica
   * oricine are nevoie, dar acum e o alegere, nu o valoare moștenită.
   */
  const saptamanaSfarsit = adaugaZile(saptamanaStart, 6);
  const anInceput = Number(saptamanaStart.slice(0, 4));
  const anSfarsit = Number(saptamanaSfarsit.slice(0, 4));
  const [setari, { nationale, organizatie }] = await Promise.all([
    setariPontaj(tenant.organizationId, saptamanaStart),
    // O săptămână poate călări două ani (28 decembrie – 3 ianuarie).
    zileNelucratoare(tenant.organizationId, anInceput, anSfarsit),
  ]);
  const orePeZi = setari?.ore_pe_zi ?? 8;
  const setNationale = new Set(nationale.map((z) => z.data));
  const setRecuperare = new Set(
    organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data),
  );
  const setLiber = new Set(
    organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data),
  );

  const zileInitiale = Array.from({ length: 7 }, (_, i) => {
    const data = adaugaZile(saptamanaStart, i);
    const existenta = submisie?.zile.find((z) => z.data === data) ?? null;
    const lucratoare = esteZiLucratoare(data, setNationale, setRecuperare, setLiber);
    return {
      data,
      tip_prezenta: existenta?.tip_prezenta ?? "birou",
      ore_planificate: String(existenta?.ore_planificate ?? (lucratoare ? orePeZi : 0)),
      observatii: existenta?.observatii ?? "",
    };
  });

  const poateEdita = submisie === null || submisie.status !== "aprobata";
  const inceputSaptamanii = new Date(`${saptamanaStart}T00:00:00Z`).toLocaleDateString("ro-RO");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Planul săptămânii"
        descriere={`Declarați, pentru săptămâna care începe ${inceputSaptamanii}, cum veniți la lucru și câte ore planificați — editabil oricând, până la decizia managerului.`}
        file={<NavPontaj poateAproba={can(permisiuni, "attendance:approve", "team")} />}
      />

      <nav aria-label="Alege săptămâna" className="flex flex-wrap items-center gap-3">
        <Link
          href={`/pontaj/saptamana?saptamana=${adaugaZile(saptamanaStart, -7)}`}
          className={buton({ varianta: "secundar" })}
        >
          ← Săptămâna anterioară
        </Link>
        <Link
          href={`/pontaj/saptamana?saptamana=${adaugaZile(saptamanaStart, 7)}`}
          className={buton({ varianta: "secundar" })}
        >
          Săptămâna următoare →
        </Link>
        {submisie === null ? null : (
          <Badge ton={TONURI_STARE_SAPTAMANA[submisie.status]}>
            {ETICHETE_STARE_SAPTAMANA[submisie.status]}
          </Badge>
        )}
      </nav>

      {submisie?.status === "respinsa" && submisie.motivRespingere !== null ? (
        <p className="border-danger/40 bg-danger/8 text-danger rounded-panou text-corp border p-3">
          <strong>Motivul respingerii:</strong> {submisie.motivRespingere}
        </p>
      ) : null}

      <FormularSaptamana
        saptamanaStart={saptamanaStart}
        zileInitiale={zileInitiale}
        poateEdita={poateEdita}
      />
    </div>
  );
}
