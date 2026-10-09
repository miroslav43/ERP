// src/app/(app)/mentenanta/sesizari/[id]/fisa-sesizare.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { esteTerminala, poateNotaInterna, type ActorSesizare } from "@/domain/maintenance/sesizari";
import type { OptiuneSelect } from "@/lib/queries/maintenance";

import { formatDurataMinute, minuteIntre } from "../../durata";
import {
  ETICHETE_MOTIV_RESPINGERE,
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_TIP_MENTENANTA,
  ETICHETE_URGENTA_SESIZARE,
  EXPLICATII_STATUS_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "../../etichete";
import { ActiuniSesizare } from "./actiuni-sesizare";
import { Cronologie } from "./cronologie";
import type { DateSesizare } from "./date-sesizare";
import { FormularComentariu } from "./formular-comentariu";
import { GalerieFoto } from "./galerie-foto";
import { IncarcareFoto } from "./incarcare-foto";
import { LinkEntitate } from "@/components/ui/link-entitate";

interface Proprietati {
  readonly date: DateSesizare;
  readonly zona: "app" | "portal";
  /** Fișa unui angajat, decisă de pagină per id (RLS + `deleted_at` + drept); în portal lipsește. */
  readonly legaturaFisa?: (idFisa: string | null) => string | null;
  readonly actor: ActorSesizare;
  readonly userId: string;
  /** Angajații pentru atribuire și pentru executantul intervenției (ce lasă RLS). */
  readonly angajati: readonly OptiuneSelect[];
  /** Ziua României, ISO. */
  readonly azi: string;
  /** Momentul randării, ISO — pentru durata opririi deschise. */
  readonly acum: string;
  /** Formularul de sesizare nouă, pe același utilaj; `null` = rolul nu-l deschide. */
  readonly hrefRaporteazaDinNou?: string | null;
}

const ECHIPA = "Echipa de mentenanță";

/**
 * Fișa sesizării — aceeași în aplicație și în portal. Ce diferă e actorul
 * (gestionar / tehnician / raportor), iar de el depind acțiunile și câteva
 * linkuri; datele vin deja filtrate de RLS prin `incarcaFisaSesizare`.
 */
export function FisaSesizare({
  date,
  hrefRaporteazaDinNou = null,
  zona,
  actor,
  userId,
  angajati,
  azi,
  acum,
  legaturaFisa = () => null,
}: Proprietati): ReactElement {
  const { sesizare, echipament, interventie, opriri } = date;
  const inAplicatie = zona === "app";
  const terminala = esteTerminala(sesizare.status);
  const radacinaSesizari = inAplicatie ? "/mentenanta/sesizari" : "/portal/sesizari";

  const numeFisa = (idFisa: string | null): string | null =>
    idFisa === null ? null : (date.numeAngajati.get(idFisa)?.full_name ?? ECHIPA);
  const numeCont = (idCont: string | null): string | null =>
    idCont === null ? null : (date.numeUtilizatori.get(idCont)?.full_name ?? null);

  const raportor =
    numeFisa(sesizare.raportat_de_employee_id) ??
    numeCont(sesizare.raportat_de_user_id) ??
    (sesizare.raportat_de_user_id === userId ? "Dvs." : "Administratorul organizației");
  const tehnician = numeFisa(sesizare.atribuit_employee_id);
  const atribuitaMie = date.fisaId !== null && sesizare.atribuit_employee_id === date.fisaId;

  const oprireDeschisa = opriri.find((o) => o.sfarsit === null) ?? null;
  const ultimaOprire = opriri[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-corp">
          <Link href={radacinaSesizari} className="underline-offset-2 hover:underline">
            {inAplicatie ? "Sesizări" : "Sesizările mele"}
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-nota font-medium tracking-wide">
              {sesizare.numar}
            </p>
            {/* Titlul e utilajul, deci trebuie să și ducă la el — dar doar pentru
                cine poate deschide fișa; un `employee` ar primi „acces restricționat”. */}
            <h1 className="text-titlu font-semibold">
              {echipament === null ? (
                "Echipament indisponibil"
              ) : inAplicatie && actor.poateGestiona ? (
                <Link
                  href={`/mentenanta/echipamente/${sesizare.equipment_id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {echipament.cod} — {echipament.denumire}
                </Link>
              ) : (
                `${echipament.cod} — ${echipament.denumire}`
              )}
            </h1>
            {echipament?.locatie ? (
              <p className="text-muted-foreground text-corp">{echipament.locatie}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
              {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
            </Badge>
            <Badge ton={TONURI_STATUS_SESIZARE[sesizare.status]}>
              {ETICHETE_STATUS_SESIZARE[sesizare.status]}
            </Badge>
          </div>
        </div>
        {actor.esteRaportor === true ? (
          <p className="text-muted-foreground text-corp mt-2">
            {EXPLICATII_STATUS_SESIZARE[sesizare.status]}
          </p>
        ) : null}
      </div>

      {sesizare.opreste_functionarea ? (
        oprireDeschisa !== null ? (
          <Callout fel="atentie" titlu="Utilajul nu funcționează">
            Stă de {formatDurataMinute(minuteIntre(oprireDeschisa.inceput, null, acum))}, din{" "}
            {formatDateTime(oprireDeschisa.inceput)}. Oprirea se închide la rezolvare, cu momentul
            real al repunerii în funcțiune.
          </Callout>
        ) : ultimaOprire !== null && ultimaOprire.sfarsit !== null ? (
          <Callout fel="neutru" titlu="Utilajul a stat">
            {formatDurataMinute(minuteIntre(ultimaOprire.inceput, ultimaOprire.sfarsit, acum))}, din{" "}
            {formatDateTime(ultimaOprire.inceput)} până la {formatDateTime(ultimaOprire.sfarsit)}.
          </Callout>
        ) : (
          <Callout fel="atentie" titlu="Utilajul nu funcționează">
            Defecțiunea oprește funcționarea echipamentului. Raportată la{" "}
            {formatDateTime(sesizare.raportat_la)}.
          </Callout>
        )
      ) : null}

      <section className="border-border rounded-panou space-y-3 border p-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">
              Raportată de
            </dt>
            <dd className="text-corp mt-0.5">
              <LinkEntitate href={legaturaFisa(sesizare.raportat_de_employee_id)}>
                {raportor}
              </LinkEntitate>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">
              Raportată la
            </dt>
            <dd className="text-corp mt-0.5">{formatDateTime(sesizare.raportat_la)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">Tehnician</dt>
            <dd className="text-corp mt-0.5">
              {tehnician === null ? (
                <span className="text-muted-foreground">Neatribuită</span>
              ) : (
                <>
                  <LinkEntitate href={legaturaFisa(sesizare.atribuit_employee_id)}>
                    {atribuitaMie ? `${tehnician} (dvs.)` : tehnician}
                  </LinkEntitate>
                  {sesizare.atribuit_la === null ? null : (
                    <span className="text-muted-foreground">
                      {" "}
                      · din {formatDateTime(sesizare.atribuit_la)}
                    </span>
                  )}
                </>
              )}
            </dd>
          </div>
          {sesizare.redeschisa_de_ori > 0 ? (
            <div>
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Redeschisă
              </dt>
              <dd className="text-corp mt-0.5">
                {sesizare.redeschisa_de_ori === 1
                  ? "o dată"
                  : `de ${String(sesizare.redeschisa_de_ori)} ori`}
                {sesizare.motiv_redeschidere === null ? "" : ` — ${sesizare.motiv_redeschidere}`}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">Descriere</dt>
            <dd className="text-corp mt-0.5 whitespace-pre-wrap">{sesizare.descriere}</dd>
          </div>
          {sesizare.motiv_respingere !== null ? (
            <div className="sm:col-span-2">
              <dt className="text-danger text-nota tracking-wide uppercase">
                Motivul respingerii
                {sesizare.motiv_respingere_tip === null
                  ? ""
                  : ` · ${ETICHETE_MOTIV_RESPINGERE[sesizare.motiv_respingere_tip]}`}
              </dt>
              <dd className="text-corp mt-0.5">{sesizare.motiv_respingere}</dd>
              {date.original === null ? null : (
                <dd className="text-corp mt-1">
                  Sesizarea originală:{" "}
                  <Link
                    href={`${radacinaSesizari}/${date.original.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {date.original.numar}
                  </Link>{" "}
                  ({ETICHETE_STATUS_SESIZARE[date.original.status]})
                </dd>
              )}
            </div>
          ) : null}
          {sesizare.rezolvat_la !== null ? (
            <div>
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Rezolvată la
              </dt>
              <dd className="text-corp mt-0.5">{formatDateTime(sesizare.rezolvat_la)}</dd>
            </div>
          ) : null}
          {sesizare.inchis_la !== null ? (
            <div>
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Închisă la
              </dt>
              <dd className="text-corp mt-0.5">{formatDateTime(sesizare.inchis_la)}</dd>
            </div>
          ) : null}
          {sesizare.nota_rezolvare !== null ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Ce s-a reparat
              </dt>
              <dd className="text-corp mt-0.5 whitespace-pre-wrap">{sesizare.nota_rezolvare}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="fotografii-sesizare" className="space-y-3">
        <h2 id="fotografii-sesizare" className="text-sectiune font-semibold">
          Fotografii
        </h2>
        <GalerieFoto
          atasamente={date.atasamente}
          urluri={date.urluri}
          userId={userId}
          poateGestiona={actor.poateGestiona}
        />
        {terminala ? (
          date.atasamente.length === 0 ? (
            <p className="text-muted-foreground text-corp">Fără fotografii.</p>
          ) : null
        ) : (
          <IncarcareFoto sesizareId={sesizare.id} existente={date.atasamente.length} />
        )}
      </section>

      {interventie === null ? null : (
        <section aria-labelledby="interventia-care-a-rezolvat" className="space-y-3">
          <h2 id="interventia-care-a-rezolvat" className="text-sectiune font-semibold">
            Rezolvată prin
          </h2>
          <div className="border-border rounded-panou space-y-1 border p-4">
            <p className="text-corp font-medium">{interventie.descriere}</p>
            <p className="text-muted-foreground text-nota">
              {ETICHETE_TIP_MENTENANTA[interventie.tip]} · {formatDate(interventie.data)} ·{" "}
              {interventie.executant_extern ?? (
                <LinkEntitate href={legaturaFisa(interventie.executant_employee_id)}>
                  {numeFisa(interventie.executant_employee_id) ?? "Executant necunoscut"}
                </LinkEntitate>
              )}
            </p>
            <p className="text-corp">
              Cost:{" "}
              {formatLei(
                interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera,
              )}{" "}
              · Rezultat: {ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]}
            </p>
            {interventie.piese === null ? null : (
              <p className="text-muted-foreground text-nota">Piese: {interventie.piese}</p>
            )}
            {inAplicatie && actor.poateGestiona ? (
              <p className="text-nota">
                <Link
                  href={`/mentenanta/interventii?echipament=${sesizare.equipment_id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Toate intervențiile pe acest utilaj
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      )}

      {terminala ? (
        <Callout
          fel={sesizare.status === "respins" ? "eroare" : "neutru"}
          titlu={
            sesizare.status === "respins"
              ? "Sesizare respinsă"
              : sesizare.status === "retrasa"
                ? "Sesizare retrasă"
                : "Sesizare închisă"
          }
        >
          {sesizare.status === "respins"
            ? "Sesizarea a fost închisă fără intervenție. O defecțiune care persistă se raportează din nou, cu detaliile cerute în motivul respingerii."
            : sesizare.status === "retrasa"
              ? "Raportorul a retras sesizarea; nu se mai intervine pe ea."
              : "Rezolvarea a fost confirmată; nu mai sunt acțiuni de făcut. Dacă defecțiunea reapare, se raportează una nouă."}
          {/* „se raportează din nou" cere un buton, nu o plecare prin meniu. */}
          {hrefRaporteazaDinNou === null ||
          hrefRaporteazaDinNou === undefined ||
          sesizare.status === "retrasa" ? null : (
            <>
              {" "}
              <Link href={hrefRaporteazaDinNou} className="underline underline-offset-2">
                Raportează din nou
              </Link>
              .
            </>
          )}
        </Callout>
      ) : (
        <section aria-labelledby="actiuni-sesizare" className="space-y-3">
          <h2 id="actiuni-sesizare" className="text-sectiune font-semibold">
            {actor.poateGestiona ? "Triaj și rezolvare" : "Acțiuni"}
          </h2>
          <ActiuniSesizare
            sesizareId={sesizare.id}
            status={sesizare.status}
            actor={actor}
            areFisa={date.fisaId !== null}
            atribuitaMie={atribuitaMie}
            atribuit={sesizare.atribuit_employee_id}
            descriere={sesizare.descriere}
            urgenta={sesizare.urgenta}
            angajati={angajati}
            azi={azi}
            oprireDeschisa={oprireDeschisa !== null}
          />
        </section>
      )}

      <section aria-labelledby="cronologie-sesizare" className="space-y-3">
        <h2 id="cronologie-sesizare" className="text-sectiune font-semibold">
          Cronologie
        </h2>
        <Cronologie
          istoric={date.istoric}
          comentarii={date.comentarii}
          numeAngajati={date.numeAngajati}
          numeUtilizatori={date.numeUtilizatori}
          userId={userId}
        />
        {terminala ? null : (
          <FormularComentariu sesizareId={sesizare.id} poateNotaInterna={poateNotaInterna(actor)} />
        )}
      </section>
    </div>
  );
}
