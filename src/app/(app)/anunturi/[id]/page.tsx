// src/app/(app)/anunturi/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Pin } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Nivel } from "@/components/ui/nivel";
import { StareGoala } from "@/components/ui/stare-goala";
import { stareAnunt } from "@/domain/announcements/anunt";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime, toBucharestDateString } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteAnunt, cititoriAnunt, numarAngajatiCuCont } from "@/lib/queries/announcements";

import { MarcheazaCitit } from "./marcheaza-citit";
import { PublicaButon } from "./publica-buton";

export const metadata: Metadata = { title: "Anunț" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaAnunt({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "announcements");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </div>
    );
  }

  const anunt = await citesteAnunt(tenant.organizationId, id);
  if (anunt === null) notFound();

  const poateAdministra = can(permisiuni, "announcements:update", "all");
  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);

  const stare = stareAnunt(anunt, new Date());
  const publicat = stare === "activ" || stare === "expirat";

  // Numitorul e numărul de angajați activi CU CONT, nu numărul de angajați
  // activi: confirmarea se scrie din portal, iar un angajat fără `user_id` nu
  // se poate autentifica, deci nu poate confirma niciodată. Cu vechiul numitor,
  // „3 / 47” nu putea ajunge la 47 nici dacă toată lumea citea.
  const [cititori, totalConturi] = poateAdministra
    ? await Promise.all([cititoriAnunt(anunt.id), numarAngajatiCuCont(tenant.organizationId)])
    : [null, null];

  const expirare =
    anunt.expira_la === null
      ? ""
      : ` · ${stare === "expirat" ? "a expirat" : "expiră"} ${formatDate(toBucharestDateString(new Date(anunt.expira_la)))}`;

  const descriere =
    stare === "ciorna"
      ? "Ciornă — nepublicată încă."
      : `${stare === "programat" ? "Se publică" : "Publicat"} ${formatDateTime(anunt.publicat_la as string)}${expirare}`;

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        firimituri={[{ eticheta: "Anunțuri", href: "/anunturi" }]}
        titlu={anunt.titlu}
        descriere={descriere}
        actiuni={
          <>
            {anunt.fixat ? (
              <Badge ton="neutru">
                <Pin aria-hidden="true" className="size-3" />
                Fixat
              </Badge>
            ) : null}
            {stare === "ciorna" ? <Badge ton="ciorna">Ciornă</Badge> : null}
            {stare === "programat" ? <Badge ton="atentie">Programat</Badge> : null}
            {stare === "expirat" ? (
              <Badge ton="neutru" cuAvertisment>
                Expirat
              </Badge>
            ) : null}
            {!publicat && poateAdministra ? <PublicaButon id={anunt.id} /> : null}
          </>
        }
      />

      {/*
        Cele două stări care schimbă ÎNȚELESUL paginii pentru administrator își
        spun consecința în cuvinte, nu doar prin pastilă. „Ciornă" pe un ecran
        care arată textul terminat se citește ca o etichetă tehnică; ce contează
        e că firma nu vede nimic încă.
      */}
      {stare === "ciorna" && poateAdministra ? (
        <Callout fel="atentie" titlu="Nepublicat">
          Anunțul nu apare pe avizierul angajaților și nu s-a trimis nicio notificare. Publicarea o
          trimite fiecărui membru activ al firmei.
        </Callout>
      ) : null}

      {stare === "programat" && poateAdministra ? (
        <Callout fel="informativ" titlu="Programat">
          Anunțul are dată de publicare în viitor, deci angajații nu îl văd încă. Notificările
          pleacă la publicare.
        </Callout>
      ) : null}

      {stare === "expirat" ? (
        <Callout fel="neutru" titlu="Expirat">
          Anunțul a ieșit de pe avizierul angajaților. Rămâne vizibil pentru cine administrează
          avizierul, împreună cu confirmările de citire strânse cât a fost activ.
        </Callout>
      ) : null}

      {/*
        `whitespace-pre-wrap` păstrează rândurile scrise în casetă; `leading-relaxed`
        e singura abatere de la corpul obișnuit al produsului și are un motiv:
        aici textul e de CITIT în întregime, nu de scanat ca o celulă de tabel.
      */}
      <article className="border-border bg-surface rounded-panou text-corp border p-5 leading-relaxed whitespace-pre-wrap">
        {anunt.continut}
      </article>

      {publicat && propriaFisaId !== null ? <MarcheazaCitit id={anunt.id} /> : null}

      {poateAdministra && cititori !== null ? (
        <section aria-labelledby="cititori" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="cititori" className="text-sectiune font-semibold">
              Confirmări de citire
            </h2>
            <p className="text-muted-foreground text-nota tabular-nums">
              {cititori.length}
              {totalConturi === null ? "" : ` din ${String(totalConturi)}`}
            </p>
          </div>

          {totalConturi === null || totalConturi === 0 ? null : (
            <>
              <Nivel
                valoare={cititori.length}
                din={totalConturi}
                eticheta="Confirmări de citire"
                text={`${String(cititori.length)} confirmări din ${String(totalConturi)} angajați cu cont`}
                marime="subtire"
              />
              <p className="text-muted-foreground text-nota">
                Numitorul e numărul angajaților activi care au cont în aplicație — ceilalți nu au de
                unde confirma.
              </p>
            </>
          )}

          {cititori.length === 0 ? (
            <StareGoala
              fel="initiala"
              compact
              titlu="Nicio confirmare încă"
              descriere={
                publicat
                  ? "Confirmarea se scrie automat când angajatul deschide anunțul din portal."
                  : "Confirmările apar după publicare."
              }
            />
          ) : (
            <ul className="divide-border border-border rounded-panou text-corp divide-y border">
              {cititori.map((c) => (
                <li
                  key={c.employee_id}
                  className="flex items-center justify-between gap-3 px-4 py-2"
                >
                  <span className="min-w-0 truncate">
                    {c.angajat?.full_name ?? c.angajat?.marca ?? "—"}
                  </span>
                  <span className="text-muted-foreground text-nota shrink-0 tabular-nums">
                    {formatDateTime(c.citit_la)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
