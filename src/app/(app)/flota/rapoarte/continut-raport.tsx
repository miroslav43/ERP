// src/app/(app)/flota/rapoarte/continut-raport.tsx
import type { ReactElement } from "react";

import { incarcaRaportLunar } from "@/lib/queries/fleet-rapoarte";

import { PrezentareRaport } from "./prezentare-raport";

/**
 * Încarcă raportul lunii și îl dă prezentării. Separate pe criteriul testării:
 * citirea atinge baza (`server-only`), prezentarea nu, deci doar ea se poate
 * randa într-un DOM de test.
 */
export async function ContinutRaport({
  organizationId,
  luna,
  vehicul,
  poateExporta,
  poateAproba,
}: Readonly<{
  organizationId: string;
  luna: string;
  vehicul: string | null;
  poateExporta: boolean;
  poateAproba: boolean;
}>): Promise<ReactElement> {
  const raport = await incarcaRaportLunar(organizationId, luna, vehicul);
  return (
    <PrezentareRaport raport={raport} poateExporta={poateExporta} poateAproba={poateAproba} />
  );
}
