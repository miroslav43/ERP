// src/app/(portal)/portal/sesizari/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { fisaMea } from "@/lib/queries/portal";
import { esteDeschisa } from "@/domain/maintenance/sesizari";
import {
  cautaEchipament,
  numeleEchipamentelorMele,
  type SesizareProprie,
} from "@/app/(app)/mentenanta/actions";
import {
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "@/app/(app)/mentenanta/etichete";
import { DialogSesizareNoua } from "@/app/(app)/mentenanta/sesizari/dialog-sesizare-noua";
import { todayInBucharest } from "@/lib/format/date";

import { EchipamenteleMele } from "./echipamentele-mele";

export const metadata: Metadata = { title: "Sesizările mele" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function CardSesizare({ sesizare }: Readonly<{ sesizare: SesizareProprie }>) {
  return (
    <li className="bg-surface border-border rounded-panou border">
      <Link href={`/portal/sesizari/${sesizare.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-nota tabular-nums">{sesizare.numar}</p>
            <p className="text-foreground text-corp font-medium">
              {sesizare.echipament === null
                ? "Echipament indisponibil"
                : `${sesizare.echipament.cod} · ${sesizare.echipament.denumire}`}
            </p>
            <p className="text-muted-foreground text-nota mt-0.5">
              Raportată {formatDateTime(sesizare.raportat_la)}
            </p>
          </div>
          <Badge className="shrink-0" ton={TONURI_STATUS_SESIZARE[sesizare.status]}>
            {ETICHETE_STATUS_SESIZARE[sesizare.status]}
          </Badge>
        </div>

        <p className="text-foreground text-corp mt-2 line-clamp-3">{sesizare.descriere}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
            {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
          </Badge>
          {sesizare.opreste_functionarea ? (
            <Badge ton="pericol" cuAvertisment>
              Oprește funcționarea
            </Badge>
          ) : null}
          {sesizare.rezolvat_la === null ? null : (
            <span className="text-muted-foreground text-nota">
              Rezolvată {formatDateTime(sesizare.rezolvat_la)}
            </span>
          )}
        </div>

        {/* Motivul respingerii, întotdeauna vizibil: fără el, omul
            raportează a doua oară aceeași defecțiune. */}
        {sesizare.motiv_respingere === null ? null : (
          <p className="border-danger text-foreground text-corp mt-3 border-l-2 pl-3">
            {sesizare.motiv_respingere}
          </p>
        )}
      </Link>
    </li>
  );
}

/**
 * Sesizările angajatului: cele pe care le-a RAPORTAT și cele care i-au fost
 * ATRIBUITE ca tehnician (0181). RLS le dă pe amândouă din aceeași citire;
 * aici doar se despart, fiindcă înseamnă lucruri diferite pentru om: una o
 * urmărește, pe cealaltă o lucrează.
 */
export default async function PaginaSesizariPortal({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni, module] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);
  // Trimiterea spre „Tichetele IT" era text simplu; linkul trece prin poarta
  // paginii-țintă (modulul de tichete pornit + `tickets:create`).
  const hrefTichetNou =
    module.has("ticketing") && can(permisiuni, "tickets:create", "own")
      ? "/portal/tichetele-mele/nou"
      : null;

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune." />
      </div>
    );
  }

  const poateRaporta = can(permisiuni, "maintenance:create", "own");

  /*
   * Caseta „Sesizare nouă" (fosta rută `/portal/sesizari/noua`): `?sesizare=noua`
   * o deschide, `?echipament=<id>` o precompletează. Numele parametrului e
   * `echipament` și AICI, identic cu ruta din aplicația mare: autocolantele cu
   * cod QR sunt lipite fizic pe utilaje și codifică deja forma asta. Un
   * identificator stricat e mai probabil un autocolant deteriorat decât o
   * intenție — nu dă 404, ci banda de atenție din casetă, cu căutarea sub ea.
   */
  const parametri = await searchParams;
  const deschideCaseta = parametri["sesizare"] === "noua";
  const echipamentBrut =
    typeof parametri["echipament"] === "string" && parametri["echipament"].length > 0
      ? parametri["echipament"]
      : null;

  // Acțiune, nu citire: `equipment` cere `maintenance:read >= team` (capcana
  // #27) — un angajat nu poate citi denumirea utilajului pe care chiar el l-a
  // sesizat. Acțiunea rezolvă denumirile cu client admin, filtrat pe organizație.
  const [prefill, rezultat, stareFisa] = await Promise.all([
    poateRaporta && deschideCaseta && echipamentBrut !== null && UUID.test(echipamentBrut)
      ? cautaEchipament({ q: echipamentBrut })
      : Promise.resolve(null),
    numeleEchipamentelorMele({}),
    fisaMea(tenant.organizationId, user.id),
  ]);
  const echipamentPrefill = prefill !== null && prefill.ok ? (prefill.data[0] ?? null) : null;
  const fisaId = stareFisa.stare === "ok" ? stareFisa.fisa.id : null;

  const toate = rezultat.ok ? rezultat.data : [];
  const deLucrat = toate.filter(
    (s) => fisaId !== null && s.atribuit_employee_id === fisaId && esteDeschisa(s.status),
  );
  const raportate = toate.filter(
    (s) =>
      !deLucrat.includes(s) &&
      ((fisaId !== null && s.raportat_de_employee_id === fisaId) ||
        s.raportat_de_user_id === user.id),
  );
  // Un manager cu `read = team` vede și sesizările echipei; le ținem separat,
  // ca „ale mele” să însemne exact asta.
  const aleEchipei = toate.filter((s) => !deLucrat.includes(s) && !raportate.includes(s));

  return (
    <div className={`${LATIMI.lista} space-y-6 p-4`}>
      <AntetPagina
        titlu="Sesizările mele"
        descriere="Defecțiunile pe care le-ați raportat și cele pe care le aveți de rezolvat."
        {...(poateRaporta
          ? {
              actiuni: (
                <DialogSesizareNoua
                  key={deschideCaseta ? `sesizare-noua:${echipamentBrut ?? ""}` : "lista"}
                  deschisInitial={deschideCaseta}
                  echipamentPrefill={echipamentPrefill}
                  prefillEsuat={
                    deschideCaseta && echipamentBrut !== null && echipamentPrefill === null
                  }
                  zona="portal"
                />
              ),
            }
          : {})}
      />

      {fisaId === null ? null : (
        <EchipamenteleMele
          organizationId={tenant.organizationId}
          fisaId={fisaId}
          azi={todayInBucharest()}
          poateRaporta={poateRaporta}
        />
      )}

      {!rezultat.ok ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-4"
        >
          {rezultat.error.message}
        </p>
      ) : toate.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Wrench}
          titlu="Nu ați trimis nicio sesizare"
          descriere="Dacă un utilaj s-a defectat, raportați-l — durează un minut. Puteți scana și codul QR de pe echipament. Pentru calculator, imprimantă sau telefon, folosiți Tichetele IT."
          {...(poateRaporta
            ? { actiune: { eticheta: "Sesizare nouă", href: "/portal/sesizari?sesizare=noua" } }
            : {})}
        >
          {hrefTichetNou === null ? null : (
            <Link href={hrefTichetNou} className="underline underline-offset-2">
              Deschide un tichet IT
            </Link>
          )}
        </StareGoala>
      ) : (
        <>
          {deLucrat.length > 0 ? (
            <section aria-labelledby="de-lucrat" className="space-y-2">
              <h2 id="de-lucrat" className="text-corp font-semibold">
                De rezolvat de mine
              </h2>
              <ul className="space-y-2">
                {deLucrat.map((s) => (
                  <CardSesizare key={s.id} sesizare={s} />
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="raportate" className="space-y-2">
            <h2 id="raportate" className="text-corp font-semibold">
              Raportate de mine
            </h2>
            {raportate.length === 0 ? (
              <p className="text-muted-foreground text-corp">Nu ați raportat nicio defecțiune.</p>
            ) : (
              <ul className="space-y-2">
                {raportate.map((s) => (
                  <CardSesizare key={s.id} sesizare={s} />
                ))}
              </ul>
            )}
            <p className="text-muted-foreground text-nota">
              Pentru calculator, imprimantă sau telefon, folosiți{" "}
              {hrefTichetNou === null ? (
                "Tichetele IT"
              ) : (
                <Link href={hrefTichetNou} className="underline underline-offset-2">
                  Tichetele IT
                </Link>
              )}
              .
            </p>
          </section>

          {aleEchipei.length > 0 ? (
            <section aria-labelledby="ale-echipei" className="space-y-2">
              <h2 id="ale-echipei" className="text-corp font-semibold">
                Ale echipei
              </h2>
              <ul className="space-y-2">
                {aleEchipei.map((s) => (
                  <CardSesizare key={s.id} sesizare={s} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
