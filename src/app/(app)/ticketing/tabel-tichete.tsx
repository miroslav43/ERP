// src/app/(app)/ticketing/tabel-tichete.tsx
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format/date";
import type { RandTichet } from "@/lib/queries/ticketing";

import {
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  TONURI_PRIORITATE,
  TONURI_STATUS,
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
    <div className="border-border rounded-panou overflow-x-auto border">
      <table className="text-corp w-full">
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
              <td className="text-nota px-4 py-3 font-mono">
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
                <Badge ton={TONURI_PRIORITATE[tichet.prioritate]}>
                  {ETICHETE_PRIORITATE[tichet.prioritate]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge ton={TONURI_STATUS[tichet.status]}>{ETICHETE_STATUS[tichet.status]}</Badge>
              </td>
              <td className="text-muted-foreground text-nota px-4 py-3">
                {formatDateTime(tichet.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
