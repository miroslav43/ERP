// src/app/(portal)/portal/sesizari/noua/page.tsx
import { redirect } from "next/navigation";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Fosta pagină „Sesizare nouă" a portalului. Formularul e acum casetă pe
 * `/portal/sesizari` (`?sesizare=noua`).
 *
 * Rămâne ca redirect pentru legăturile vechi spre portal. Autocolantele QR duc
 * la `/mentenanta/sesizari/noua`, din `(scanare)`, care îl trimite pe angajat
 * direct pe `/portal/sesizari` cu `?echipament=` păstrat. Numele parametrului
 * nu se schimbă — ar însemna autocolante de reimprimat.
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
