// src/app/(app)/ticketing/tabel-tichete.tsx
import Link from "next/link";

import { formatDateTime } from "@/lib/format/date";
import type { RandTichet } from "@/lib/queries/ticketing";

import {
  CLASE_PRIORITATE,
  CLASE_STATUS,
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
} from "./etichete";

/**
 * Tabelul e același pe „Tichetele mele” și pe „Coada echipei”; diferă doar ce
 * întoarce RLS-ul pentru fiecare. `aratSolicitantul` e singura deosebire de
 * afișare: în lista proprie, coloana ar repeta același nume pe fiecare rând.
 */
export function TabelTichete({
  randuri,
  aratSolicitantul = false,
}: Readonly<{ randuri: readonly RandTichet[]; aratSolicitantul?: boolean }>) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista tichetelor, cu starea și prioritatea lor.</caption>
        <thead className="bg-surface text-left">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Număr
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Tip
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Titlu
            </th>
            {aratSolicitantul && (
              <th scope="col" className="px-4 py-3 font-medium">
                Solicitant
              </th>
            )}
            <th scope="col" className="px-4 py-3 font-medium">
              Prioritate
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Stare
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Deschis la
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {randuri.map((tichet) => (
            <tr key={tichet.id} className="hover:bg-surface/60">
              <td className="px-4 py-3 font-mono text-xs">
                <Link href={`/ticketing/${tichet.id}`} className="text-primary hover:underline">
                  {tichet.numar_afisat}
                </Link>
              </td>
              <td className="text-muted-foreground px-4 py-3">{ETICHETE_TIP[tichet.tip]}</td>
              <td className="px-4 py-3">
                <Link href={`/ticketing/${tichet.id}`} className="hover:underline">
                  {tichet.titlu}
                </Link>
              </td>
              {aratSolicitantul && (
                <td className="text-muted-foreground px-4 py-3">
                  {tichet.solicitant?.full_name ?? "—"}
                </td>
              )}
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs ${CLASE_PRIORITATE[tichet.prioritate]}`}
                >
                  {ETICHETE_PRIORITATE[tichet.prioritate]}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs ${CLASE_STATUS[tichet.status]}`}
                >
                  {ETICHETE_STATUS[tichet.status]}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3 text-xs">
                {formatDateTime(tichet.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
