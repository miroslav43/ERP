// src/app/(portal)/portal/sesizari/noua/page.tsx
import { redirect } from "next/navigation";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Fosta pagină „Sesizare nouă" a portalului. Formularul e acum casetă pe
 * `/portal/sesizari` (`?sesizare=noua`).
 *
 * Rămâne ca redirect din același motiv ca ruta din aplicația mare: autocolantele
 * QR de pe utilaje duc aici (prin învelișul `(app)`, care trimite angajatul în
 * portal cu tot cu `?echipament=`). Numele parametrului nu se schimbă — ar
 * însemna autocolante de reimprimat.
 */
export default async function PaginaSesizareNouaPortal({ searchParams }: ProprietatiPagina) {
  const parametri = await searchParams;
  const tinta = new URLSearchParams({ sesizare: "noua" });
  const echipament = parametri["echipament"];
  if (typeof echipament === "string" && echipament.length > 0) {
    tinta.set("echipament", echipament);
  }
  redirect(`/portal/sesizari?${tinta.toString()}`);
}
