// src/app/(app)/mentenanta/sesizarile-mele.tsx
import Link from "next/link";
import { Wrench } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/format/date";

import { numeleEchipamentelorMele } from "./actions";
import {
  CLASE_STATUS_SESIZARE,
  CLASE_URGENTA_SESIZARE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
} from "./etichete";

/**
 * Ecranul văzut de un angajat cu doar `maintenance:read = own` — ajunge aici
 * prin QR sau link direct; în meniu itemul are minScope „team”, deci nu-l
 * vede acolo (`config/navigation.ts`).
 */
export async function SesizarileMele() {
  const rezultat = await numeleEchipamentelorMele({});
  const sesizari = rezultat.ok ? rezultat.data : [];

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sesizările mele</h1>
          <p className="text-muted-foreground text-sm">
            Defecțiunile pe care le-ați raportat, cu starea lor curentă.
          </p>
        </div>
        <Link
          href="/mentenanta/sesizari/noua"
          className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
        >
          Sesizare nouă
        </Link>
      </header>

      {!rezultat.ok ? (
        <p
          role="alert"
          className="border-danger bg-danger/8 text-danger rounded-md border p-4 text-sm"
        >
          {rezultat.error.message}
        </p>
      ) : sesizari.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nu ați trimis nicio sesizare"
          description="Dacă un echipament s-a defectat, raportați-l — durează un minut."
          action={{ label: "Sesizare nouă", href: "/mentenanta/sesizari/noua" }}
        />
      ) : (
        <ul className="space-y-3">
          {sesizari.map((sesizare) => (
            <li key={sesizare.id} className="border-border rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {sesizare.echipament === null
                      ? "Echipament necunoscut"
                      : `${sesizare.echipament.cod} — ${sesizare.echipament.denumire}`}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">{sesizare.descriere}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Raportată la {formatDateTime(sesizare.raportat_la)}
                    {sesizare.opreste_functionarea ? " · Oprește funcționarea" : ""}
                  </p>
                  {sesizare.motiv_respingere !== null ? (
                    <p className="text-danger mt-1 text-xs">
                      Motivul respingerii: {sesizare.motiv_respingere}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_URGENTA_SESIZARE[sesizare.urgenta]}`}
                  >
                    {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_SESIZARE[sesizare.status]}`}
                  >
                    {ETICHETE_STATUS_SESIZARE[sesizare.status]}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
