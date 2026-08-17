// src/components/audit/tabel-audit.tsx
import { ShieldAlert } from "lucide-react";

import { comparaPayload, formateazaValoare } from "@/lib/audit/diff";
import {
  clasaStatus,
  etichetaActiune,
  etichetaCamp,
  etichetaEntitate,
  etichetaStatus,
} from "@/lib/audit/etichete";
import type { RandJurnal } from "@/lib/queries/audit";
import { formatDateTime } from "@/lib/format/date";
type Props = Readonly<{
  randuri: readonly RandJurnal[];
  arataOrganizatia: boolean;
}>;

const ETICHETE_TIP: Readonly<Record<string, string>> = {
  adaugat: "adăugat",
  modificat: "modificat",
  sters: "șters",
};

const clasaCelula = "px-3 py-2 align-top text-sm text-foreground";

function Detaliu({ rand }: Readonly<{ rand: RandJurnal }>) {
  const modificari = comparaPayload(rand.before, rand.after);
  return (
    <details className="group">
      <summary className="text-primary focus-visible:ring-ring cursor-pointer list-none rounded-md px-2 py-1 text-xs font-medium underline underline-offset-4 focus:outline-none focus-visible:ring-2">
        Vezi detaliile evenimentului
      </summary>
      <div className="border-border bg-background mt-3 space-y-3 rounded-md border p-3">
        <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
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
          <p className="text-muted-foreground text-xs">
            Evenimentul nu a înregistrat modificări de câmpuri.
          </p>
        ) : (
          <ul className="space-y-2">
            {modificari.map((modificare) => (
              <li
                key={modificare.cale.join(".")}
                className="border-border rounded-md border px-3 py-2 text-xs"
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
                  <span className="line-through">{formateazaValoare(modificare.inainte)}</span>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only"> devine </span>
                  <span className="text-foreground">{formateazaValoare(modificare.dupa)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function TabelAudit({ randuri, arataOrganizatia }: Props) {
  const numarColoane = arataOrganizatia ? 6 : 5;
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Evenimente din jurnalul de audit, de la cel mai recent la cel mai vechi
        </caption>
        <thead className="bg-surface">
          <tr>
            <th scope="col" className="text-muted-foreground px-3 py-2 text-xs font-semibold">
              Moment (ora României)
            </th>
            {arataOrganizatia ? (
              <th scope="col" className="text-muted-foreground px-3 py-2 text-xs font-semibold">
                Organizație
              </th>
            ) : null}
            <th scope="col" className="text-muted-foreground px-3 py-2 text-xs font-semibold">
              Autor
            </th>
            <th scope="col" className="text-muted-foreground px-3 py-2 text-xs font-semibold">
              Acțiune
            </th>
            <th scope="col" className="text-muted-foreground px-3 py-2 text-xs font-semibold">
              Entitate
            </th>
            <th scope="col" className="text-muted-foreground px-3 py-2 text-xs font-semibold">
              Rezultat
            </th>
          </tr>
        </thead>
        <tbody>
          {randuri.map((rand) => (
            <>
              <tr key={rand.id} className="border-border border-t">
                <td className={`${clasaCelula} whitespace-nowrap`}>
                  {formatDateTime(new Date(rand.createdAt))}
                </td>
                {arataOrganizatia ? (
                  <td className={clasaCelula}>{rand.organizationName ?? "—"}</td>
                ) : null}
                <td className={clasaCelula}>
                  <span className="block">{rand.actorNume ?? "Sistem"}</span>
                  <span className="text-muted-foreground block text-xs">
                    {rand.actorEmail ?? (rand.actorId === null ? "acțiune automată" : "—")}
                  </span>
                </td>
                <td className={clasaCelula}>{etichetaActiune(rand.action)}</td>
                <td className={clasaCelula}>{etichetaEntitate(rand.entityType)}</td>
                <td className={`${clasaCelula} font-medium ${clasaStatus(rand.status)}`}>
                  {etichetaStatus(rand.status)}
                </td>
              </tr>
              <tr key={`${rand.id}-detaliu`} className="border-border/50 border-t">
                <td colSpan={numarColoane} className="px-3 pb-3">
                  <Detaliu rand={rand} />
                </td>
              </tr>
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
