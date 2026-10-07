// src/app/(app)/mentenanta/echipamente/[id]/documente-echipament.tsx
import { FileText } from "lucide-react";
import type { ReactElement } from "react";

import { marimeCitibila } from "@/components/ui/incarcare-fisier";
import { formatDateTime } from "@/lib/format/date";
import type { Atasament } from "@/lib/queries/maintenance";

import { ETICHETE_TIP_ATASAMENT } from "../../etichete";
import { ButonStergeFisier } from "../../sesizari/[id]/buton-sterge-fisier";

/**
 * Documentele echipamentului: cartea tehnică, certificatul CE, manualul,
 * contractul de service, facturi. URL-uri semnate de 10 minute (bucket privat).
 */
export function DocumenteEchipament({
  atasamente,
  urluri,
  poateSterge,
}: Readonly<{
  atasamente: readonly Atasament[];
  urluri: ReadonlyMap<string, string>;
  poateSterge: boolean;
}>): ReactElement {
  if (atasamente.length === 0) {
    return (
      <p className="text-muted-foreground text-corp">
        Niciun document. Cartea tehnică, certificatul CE și manualul se păstrează aici, ca să fie la
        îndemână la control.
      </p>
    );
  }
  return (
    <ul className="border-border divide-border rounded-panou divide-y border">
      {atasamente.map((a) => {
        const url = urluri.get(a.storage_path);
        return (
          <li key={a.id} className="flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0">
                {url === undefined ? (
                  <p className="text-corp truncate font-medium">{a.denumire}</p>
                ) : (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-corp block truncate font-medium underline-offset-2 hover:underline"
                  >
                    {a.denumire}
                  </a>
                )}
                <p className="text-muted-foreground text-nota">
                  {ETICHETE_TIP_ATASAMENT[a.tip]} · {formatDateTime(a.created_at)}
                  {a.marime_bytes === null ? "" : ` · ${marimeCitibila(a.marime_bytes)}`}
                </p>
              </div>
            </div>
            {poateSterge ? (
              <ButonStergeFisier id={a.id} denumire={a.denumire} fel="document" />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
