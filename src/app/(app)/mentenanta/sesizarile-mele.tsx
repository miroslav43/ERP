// src/app/(app)/mentenanta/sesizarile-mele.tsx
import Link from "next/link";
import { Wrench } from "lucide-react";

import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { formatDateTime } from "@/lib/format/date";

import { numeleEchipamentelorMele } from "./actions";
import {
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
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
    <div className="space-y-6">
      <AntetPagina
        titlu="Sesizările mele"
        descriere="Defecțiunile pe care le-ați raportat, cu starea lor curentă."
        actiuni={
          <Link href="/mentenanta/sesizari/noua" className={buton({ varianta: "primar" })}>
            Sesizare nouă
          </Link>
        }
      />

      {!rezultat.ok ? (
        <p
          role="alert"
          className="border-danger bg-danger/8 text-danger rounded-control text-corp border p-4"
        >
          {rezultat.error.message}
        </p>
      ) : sesizari.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Wrench}
          titlu="Nu ați trimis nicio sesizare"
          descriere="Dacă un echipament s-a defectat, raportați-l — durează un minut."
          actiune={{ eticheta: "Sesizare nouă", href: "/mentenanta/sesizari/noua" }}
        />
      ) : (
        <ul className="space-y-3">
          {sesizari.map((sesizare) => (
            <li key={sesizare.id} className="border-border rounded-panou border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {sesizare.echipament === null
                      ? "Echipament necunoscut"
                      : `${sesizare.echipament.cod} — ${sesizare.echipament.denumire}`}
                  </p>
                  <p className="text-muted-foreground text-corp mt-1">{sesizare.descriere}</p>
                  <p className="text-muted-foreground text-nota mt-1">
                    Raportată la {formatDateTime(sesizare.raportat_la)}
                    {sesizare.opreste_functionarea ? " · Oprește funcționarea" : ""}
                  </p>
                  {sesizare.motiv_respingere !== null ? (
                    <p className="text-danger text-nota mt-1">
                      Motivul respingerii: {sesizare.motiv_respingere}
                    </p>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
