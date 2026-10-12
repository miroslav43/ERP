// src/app/(app)/ssm/accidente/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatOraZi } from "@/lib/format/ore";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  citesteAccident,
  fiseAptitudineAngajat,
  instruirileAngajatului,
} from "@/lib/queries/ssm";
import { momentLimitaComunicareItm } from "@/domain/ssm/termen-itm";

import { ETICHETE_TIP_ACCIDENT, TONURI_TIP_ACCIDENT } from "../../etichete";
import { BandaTermenItm } from "../../numaratoare-itm";
import { FormularComunicareItm } from "./formular-comunicare-itm";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisa } from "@/lib/navigare/fisa";
import { NumarRegistru } from "@/components/registru/numar-registru";

export const metadata: Metadata = { title: "Accident de muncă" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaAccident({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  await requireUser();
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ssm"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta registrul de accidente. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const accident = await citesteAccident(tenant.organizationId, id);
  if (accident === null) notFound();

  const angajati = await angajatiDupaId(
    tenant.organizationId,
    accident.employee_id === null ? [] : [accident.employee_id],
  );
  const angajat = accident.employee_id === null ? undefined : angajati.get(accident.employee_id);
  const poateActualiza = can(permisiuni, "ssm:update", "team");
  // Situația SSM a victimei LA DATA producerii: ultima instruire și ultima
  // fișă de aptitudine de dinainte de accident — întrebarea comisiei de cercetare.
  const [instruiriVictima, fiseVictima] =
    accident.employee_id === null
      ? [[], []]
      : await Promise.all([
          instruirileAngajatului(tenant.organizationId, accident.employee_id),
          fiseAptitudineAngajat(tenant.organizationId, accident.employee_id),
        ]);
  const ultimaInstruire =
    instruiriVictima.find((i) => i.data_instruirii <= accident.data_producerii) ?? null;
  const ultimaFisa = fiseVictima.find((f) => f.data_examinarii <= accident.data_producerii) ?? null;
  const valabilaLaData = (panaLa: string | null): boolean =>
    panaLa === null || panaLa >= accident.data_producerii;

  const termenOre = accident.termen_comunicare_ore ?? 24;
  const momentLimita = momentLimitaComunicareItm(
    accident.data_producerii,
    accident.ora_producerii,
    termenOre,
  );
  const acum = new Date().toISOString();

  // `titlu` și `descriere` sunt șiruri, nu JSX: componenta le cere așa. Textul
  // rămâne cuvânt cu cuvânt, doar nuanțarea numărului intern se pierde.
  const titlu =
    accident.numar_intern === null
      ? formatDate(accident.data_producerii)
      : `${formatDate(accident.data_producerii)} · ${accident.numar_intern}`;
  const cineSiUnde = (
    <>
      <LinkEntitate href={hrefFisa(angajat, permisiuni)}>
        {angajat === undefined
          ? "Angajat neidentificat"
          : `${angajat.full_name ?? "—"} (${angajat.marca})`}
      </LinkEntitate>
      {` · ${accident.locul}`}
    </>
  );

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <p className="text-muted-foreground text-corp">
        <Link href="/ssm/accidente" className="underline-offset-2 hover:underline">
          Accidente de muncă
        </Link>
      </p>

      <AntetPagina
        titlu={titlu}
        descriere={cineSiUnde}
        actiuni={
          <Badge ton={TONURI_TIP_ACCIDENT[accident.tip]}>
            {ETICHETE_TIP_ACCIDENT[accident.tip]}
          </Badge>
        }
      />
      {/* Drumul înapoi spre registru: numărul de înregistrare, dacă există (prin RLS). */}
      <NumarRegistru tenant={tenant} entitateTip="work_accidents" entitateId={accident.id} />

      {accident.comunicat_la_itm_la === null ? (
        <BandaTermenItm momentLimita={momentLimita.toISOString()} acumInitial={acum} />
      ) : null}

      {/* Formularul de comunicare urcă IMEDIAT sub bandă: era ultimul lucru de
          pe pagină, sub împrejurări, deși e singura acțiune cu ceas legal de pe
          ecran. Numărătoarea și butonul care o oprește stau împreună. */}
      {poateActualiza ? (
        <FormularComunicareItm
          id={accident.id}
          comunicatLaItm={accident.comunicat_la_itm_la}
          numarProcesVerbal={accident.numar_proces_verbal}
          cercetareFinalizata={accident.cercetare_finalizata_la}
          zileIncapacitate={accident.zile_incapacitate}
        />
      ) : null}

      <section
        aria-label="Detalii accident"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2"
      >
        <Camp eticheta="Ora producerii" valoare={formatOraZi(accident.ora_producerii) ?? "—"} />
        <Camp eticheta="Zile de incapacitate" valoare={String(accident.zile_incapacitate)} />
        <Camp
          eticheta="Comunicat la ITM"
          // `comunicat_la_itm_la` e `timestamptz` și se completează cu un
          // `datetime-local`: se salvează un MOMENT, deci se afișează un moment.
          // `.slice(0, 10)` arunca exact ora, care e miezul obligației legale.
          valoare={
            accident.comunicat_la_itm_la === null
              ? "Nu"
              : formatDateTime(accident.comunicat_la_itm_la)
          }
        />
        <Camp eticheta="Număr proces verbal" valoare={accident.numar_proces_verbal ?? "—"} />
        <Camp
          eticheta="Cercetare finalizată"
          valoare={
            accident.cercetare_finalizata_la === null
              ? "În curs"
              : formatDate(accident.cercetare_finalizata_la)
          }
        />
      </section>

      {accident.employee_id === null ? null : (
        <section
          aria-labelledby="titlu-situatie-ssm"
          className="border-border rounded-panou border p-4"
        >
          <h2 id="titlu-situatie-ssm" className="text-corp font-medium">
            Situația SSM la data producerii
          </h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <Camp
              eticheta="Ultima instruire de dinainte"
              valoare={
                ultimaInstruire === null
                  ? "Nicio instruire înregistrată înainte de accident"
                  : `${formatDate(ultimaInstruire.data_instruirii)}${
                      valabilaLaData(ultimaInstruire.urmatoarea_scadenta)
                        ? " · valabilă la data producerii"
                        : ` · EXPIRATĂ din ${formatDate(ultimaInstruire.urmatoarea_scadenta ?? accident.data_producerii)}`
                    }`
              }
            />
            <Camp
              eticheta="Ultima fișă de aptitudine de dinainte"
              valoare={
                ultimaFisa === null
                  ? "Nicio fișă înregistrată înainte de accident"
                  : `${formatDate(ultimaFisa.data_examinarii)}${
                      valabilaLaData(ultimaFisa.valabil_pana)
                        ? " · valabilă la data producerii"
                        : ` · EXPIRATĂ din ${formatDate(ultimaFisa.valabil_pana ?? accident.data_producerii)}`
                    }`
              }
            />
          </dl>
          <p className="text-nota mt-3 flex flex-wrap gap-x-3">
            <Link
              href={`/ssm/instruiri?angajat=${accident.employee_id}`}
              className="underline-offset-2 hover:underline"
            >
              Instruirile lui
            </Link>
            <Link
              href={`/ssm/medicina-muncii?angajat=${accident.employee_id}`}
              className="underline-offset-2 hover:underline"
            >
              Fișele lui de aptitudine
            </Link>
          </p>
        </section>
      )}

      <section aria-label="Împrejurări" className="text-corp space-y-1">
        <p className="text-muted-foreground">Împrejurări:</p>
        <p className="whitespace-pre-wrap">{accident.imprejurari}</p>
        {accident.urmari === null ? null : (
          <>
            <p className="text-muted-foreground mt-3">Urmări:</p>
            <p className="whitespace-pre-wrap">{accident.urmari}</p>
          </>
        )}
      </section>
    </div>
  );
}

function Camp({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-nota">{eticheta}</dt>
      <dd className="text-corp font-medium">{valoare}</dd>
    </div>
  );
}
