// src/app/(app)/mentenanta/echipamente/eticheta-qr.tsx
import QRCode from "qrcode";
import type { ReactElement } from "react";

import { clientEnv } from "@/config/env";
import { formatDate } from "@/lib/format/date";

export interface DateEticheta {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly locatie: string | null;
  /** Pentru utilajele folosite în afara sediului: dovada HG 1146 (ultima verificare, scadența), fără nume de persoane. */
  readonly ultimaVerificare: string | null;
  readonly urmatoareaScadenta: string | null;
  readonly folositInAfaraSediului: boolean;
}

/** Adresa codificată — FORMATUL autocolantelor deja lipite: ruta veche, cu `?echipament=`. */
export function adresaEticheta(equipmentId: string): string {
  return `${clientEnv.NEXT_PUBLIC_APP_URL}/mentenanta/sesizari/noua?echipament=${equipmentId}`;
}

/**
 * O etichetă QR pentru un utilaj: scanată cu telefonul, deschide caseta de
 * sesizare precompletată. SVG (rămâne citibil la orice mărime), corecție `H`
 * (30%: unsoare, zgârieturi), alb pe negru curat pentru scaner.
 *
 * Eticheta NU poartă numele responsabilului: pe un utilaj folosit la client, în
 * afara sediului, HG 1146 cere dovada verificării, nu identitatea cuiva.
 */
export async function EtichetaQr({
  date,
}: Readonly<{ date: DateEticheta }>): Promise<ReactElement> {
  const url = adresaEticheta(date.id);
  const qr = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="eticheta rounded-panou flex w-[86mm] break-inside-avoid flex-col items-center gap-2 border border-black bg-white p-3 text-center text-black">
      <p className="text-lg leading-tight font-semibold">{date.cod}</p>
      <p className="text-sm leading-tight">{date.denumire}</p>
      {/* `dangerouslySetInnerHTML` pe un SVG generat de `qrcode` din date proprii:
          nu intră niciun text de utilizator în el, doar URL-ul construit aici. */}
      <div
        aria-label={`Cod QR pentru sesizarea unei defecțiuni la ${date.cod}`}
        className="w-[48mm] [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <p className="text-xs leading-tight">Defecțiune? Scanați și descrieți ce ați observat.</p>
      {date.locatie === null ? null : <p className="text-xs opacity-70">{date.locatie}</p>}
      {date.folositInAfaraSediului ? (
        <p className="text-xs leading-tight">
          Verificat: {date.ultimaVerificare === null ? "—" : formatDate(date.ultimaVerificare)} ·
          Scadent: {date.urmatoareaScadenta === null ? "—" : formatDate(date.urmatoareaScadenta)}
        </p>
      ) : null}
    </div>
  );
}
