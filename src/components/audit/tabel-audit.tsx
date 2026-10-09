// src/components/audit/tabel-audit.tsx
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { comparaPayload, formateazaValoare } from "@/lib/audit/diff";
import {
  tonStatus,
  etichetaActiune,
  etichetaCamp,
  etichetaEntitate,
  etichetaStatus,
} from "@/lib/audit/etichete";
import type { RandJurnal } from "@/lib/queries/audit";
import { formatDateTime } from "@/lib/format/date";
type Props = Readonly<{
  randuri: readonly RandJurnal[];
  /**
   * Ruta obiectului unui rând, decisă de pagină (modul + drept); în consola de
   * platformă nu se trimite, iar entitatea rămâne text.
   */
  rutaEntitate?: (entityType: string | null, entityId: string | null) => string | null;
  /** Pagina rândului numit de o valoare din detalii (`employee_id` → fișă); pagina decide poarta. */
  rutaValoare?: (cale: readonly string[], valoare: unknown) => string | null;
  /** „Tot ce a făcut persoana asta": jurnalul filtrat pe cont. */
  hrefActor?: (actorId: string) => string;
  /** În consola de platformă: fișa firmei. */
  hrefOrganizatie?: (organizationId: string) => string;
  arataOrganizatia: boolean;
}>;

const ETICHETE_TIP: Readonly<Record<string, string>> = {
  adaugat: "adăugat",
  modificat: "modificat",
  sters: "șters",
};

const clasaCelula = "px-3 py-2 align-top text-corp text-foreground";

function Detaliu({
  rand,
  rutaValoare,
}: Readonly<{
  rand: RandJurnal;
  rutaValoare: (cale: readonly string[], valoare: unknown) => string | null;
}>) {
  const modificari = comparaPayload(rand.before, rand.after);
  // Cheile străine (`employee_id`, `vehicle_id`…) apăreau ca UUID brut; aici
  // valoarea devine link spre rândul legat, când pagina-țintă se deschide.
  const valoare = (cale: readonly string[], v: unknown, text: string) => {
    const href = rutaValoare(cale, v);
    return href === null ? (
      text
    ) : (
      <Link href={href} className="underline-offset-2 hover:underline">
        {text}
      </Link>
    );
  };
  return (
    <details className="group">
      {/* Clasa avea `focus:` fără niciun utilitar după prefix — reziduul unui
          `sed` care a scos `focus-visible:outline-2`. Tailwind o ignoră tăcut,
          deci rezumatul rămânea fără inel de focus. Se șterge: inelul vine din
          regula globală `:focus-visible` din `globals.css`. */}
      <summary className="text-primary rounded-control text-nota cursor-pointer list-none px-2 py-1 font-medium underline underline-offset-4">
        Vezi detaliile evenimentului
      </summary>
      <div className="border-border bg-background rounded-control mt-3 space-y-3 border p-3">
        <dl className="text-nota grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Identificator entitate</dt>
            <dd className="text-foreground break-all">{rand.entityId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Identificator cerere</dt>
            <dd className="text-foreground break-all">{rand.requestId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Adresă IP</dt>
            <dd className="text-foreground">{rand.ip ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cod de eroare</dt>
            <dd className="text-foreground">{rand.errorCode ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Aplicație / browser</dt>
            <dd className="text-foreground break-all">{rand.userAgent ?? "—"}</dd>
          </div>
        </dl>

        {modificari.length === 0 ? (
          <p className="text-muted-foreground text-nota">
            Evenimentul nu a înregistrat modificări de câmpuri.
          </p>
        ) : (
          <ul className="space-y-2">
            {modificari.map((modificare) => (
              <li
                key={modificare.cale.join(".")}
                className="border-border rounded-control text-nota border px-3 py-2"
              >
                <p className="text-foreground font-medium">
                  {etichetaCamp(modificare.cale)}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({ETICHETE_TIP[modificare.tip] ?? modificare.tip})
                  </span>
                  {modificare.mascat ? (
                    <span className="text-warning ml-2 inline-flex items-center gap-1">
                      <ShieldAlert aria-hidden="true" className="size-3" />
                      valoare ascunsă
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground mt-1 break-words">
                  <span className="line-through">
                    {valoare(
                      modificare.cale,
                      modificare.inainte,
                      formateazaValoare(modificare.inainte),
                    )}
                  </span>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only"> devine </span>
                  <span className="text-foreground">
                    {valoare(modificare.cale, modificare.dupa, formateazaValoare(modificare.dupa))}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function TabelAudit({
  randuri,
  arataOrganizatia,
  rutaEntitate = () => null,
  rutaValoare = () => null,
  hrefActor,
  hrefOrganizatie,
}: Props) {
  const numarColoane = arataOrganizatia ? 6 : 5;
  return (
    <div className="border-border rounded-panou overflow-x-auto border">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Evenimente din jurnalul de audit, de la cel mai recent la cel mai vechi
        </caption>
        <thead className="bg-surface">
          <tr>
            <th
              scope="col"
              className="text-eticheta text-foreground px-3 py-2 font-semibold tracking-wide uppercase"
            >
              Moment (ora României)
            </th>
            {arataOrganizatia ? (
              <th
                scope="col"
                className="text-eticheta text-foreground px-3 py-2 font-semibold tracking-wide uppercase"
              >
                Organizație
              </th>
            ) : null}
            <th
              scope="col"
              className="text-eticheta text-foreground px-3 py-2 font-semibold tracking-wide uppercase"
            >
              Autor
            </th>
            <th
              scope="col"
              className="text-eticheta text-foreground px-3 py-2 font-semibold tracking-wide uppercase"
            >
              Acțiune
            </th>
            <th
              scope="col"
              className="text-eticheta text-foreground px-3 py-2 font-semibold tracking-wide uppercase"
            >
              Entitate
            </th>
            <th
              scope="col"
              className="text-eticheta text-foreground px-3 py-2 font-semibold tracking-wide uppercase"
            >
              Rezultat
            </th>
          </tr>
        </thead>
        <tbody>
          {/*
            `<Fragment key>`, nu `<>`: forma scurtă NU acceptă `key`, iar
            cheile de pe cele două `<tr>` dinăuntru nu contează — React
            reconciliază lista după elementul ITERAT, adică după fragment, iar
            un fragment fără cheie se identifică prin poziție.

            Consecința se vede la filtrare și la paginare: `<details>` e
            necontrolat, deci starea „deschis” trăiește în DOM. Cine deschide
            detaliul evenimentului al treilea, apoi trece la pagina următoare,
            găsește deschis detaliul al treilea de acolo — un eveniment pe care
            nu l-a cerut, cu adresă IP și cod de eroare, într-un jurnal de
            audit. Cu cheia pe fragment, React desface rândul vechi și îl
            construiește pe cel nou închis.
          */}
          {randuri.map((rand) => (
            <Fragment key={rand.id}>
              <tr className="border-border border-t">
                <td className={`${clasaCelula} whitespace-nowrap`}>
                  {formatDateTime(new Date(rand.createdAt))}
                </td>
                {arataOrganizatia ? (
                  <td className={clasaCelula}>
                    {rand.organizationId !== null && hrefOrganizatie !== undefined ? (
                      <Link
                        href={hrefOrganizatie(rand.organizationId)}
                        className="underline-offset-2 hover:underline"
                      >
                        {rand.organizationName ?? "—"}
                      </Link>
                    ) : (
                      (rand.organizationName ?? "—")
                    )}
                  </td>
                ) : null}
                <td className={clasaCelula}>
                  {rand.actorId !== null && hrefActor !== undefined ? (
                    <Link
                      href={hrefActor(rand.actorId)}
                      className="block underline-offset-2 hover:underline"
                      title="Toate acțiunile acestui cont"
                    >
                      {rand.actorNume ?? "Sistem"}
                    </Link>
                  ) : (
                    <span className="block">{rand.actorNume ?? "Sistem"}</span>
                  )}
                  <span className="text-muted-foreground text-nota block">
                    {rand.actorEmail ?? (rand.actorId === null ? "acțiune automată" : "—")}
                  </span>
                </td>
                <td className={clasaCelula}>{etichetaActiune(rand.action)}</td>
                <td className={clasaCelula}>
                  {(() => {
                    const href = rutaEntitate(rand.entityType, rand.entityId);
                    return href === null ? (
                      etichetaEntitate(rand.entityType)
                    ) : (
                      <Link href={href} className="underline-offset-2 hover:underline">
                        {etichetaEntitate(rand.entityType)}
                      </Link>
                    );
                  })()}
                </td>
                <td className={clasaCelula}>
                  <Badge ton={tonStatus(rand.status)}>{etichetaStatus(rand.status)}</Badge>
                </td>
              </tr>
              <tr className="border-border/50 border-t">
                <td colSpan={numarColoane} className="px-3 pb-3">
                  <Detaliu rand={rand} rutaValoare={rutaValoare} />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
