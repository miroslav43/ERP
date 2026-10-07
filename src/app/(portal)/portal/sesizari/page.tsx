// src/app/(portal)/portal/sesizari/page.tsx
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { cautaEchipament, numeleEchipamentelorMele } from "@/app/(app)/mentenanta/actions";
import {
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "@/app/(app)/mentenanta/etichete";
import { DialogSesizareNoua } from "@/app/(app)/mentenanta/sesizari/dialog-sesizare-noua";

export const metadata: Metadata = { title: "Sesizările mele" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export default async function PaginaSesizariPortal({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

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
  const prefill =
    poateRaporta && deschideCaseta && echipamentBrut !== null && UUID.test(echipamentBrut)
      ? await cautaEchipament({ q: echipamentBrut })
      : null;
  const echipamentPrefill = prefill !== null && prefill.ok ? (prefill.data[0] ?? null) : null;

  // Acțiune, nu citire: `equipment` are coloană de scope `null` în bucla de
  // politici din `0011_ssm.sql`, deci cere `maintenance:read >= team` — un
  // angajat nu poate citi denumirea utilajului pe care chiar el l-a sesizat.
  // Acțiunea rezolvă denumirile cu client admin, filtrat pe organizație, și e
  // păzită de `maintenance:read` / `own`.
  const rezultat = await numeleEchipamentelorMele({});
  const sesizari = rezultat.ok ? rezultat.data : [];

  return (
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        titlu="Sesizările mele"
        descriere="Defecțiunile pe care le-ați raportat și starea lor."
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

      {!rezultat.ok ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-4"
        >
          {rezultat.error.message}
        </p>
      ) : sesizari.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Wrench}
          titlu="Nu ați trimis nicio sesizare"
          descriere="Dacă un utilaj s-a defectat, raportați-l — durează un minut. Puteți scana și codul QR de pe echipament. Pentru calculator, imprimantă sau telefon, folosiți Tichetele IT."
          {...(poateRaporta
            ? { actiune: { eticheta: "Sesizare nouă", href: "/portal/sesizari?sesizare=noua" } }
            : {})}
        />
      ) : (
        <ul className="space-y-2">
          {sesizari.map((sesizare) => (
            <li key={sesizare.id} className="bg-surface border-border rounded-panou border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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

              <p className="text-foreground text-corp mt-2">{sesizare.descriere}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
                  {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                </Badge>
                {sesizare.opreste_functionarea ? (
                  <span className="border-danger text-danger text-nota rounded border px-2 py-0.5">
                    Oprește funcționarea
                  </span>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
