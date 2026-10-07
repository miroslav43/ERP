// src/app/(app)/mentenanta/sesizari/noua/page.tsx
import { redirect } from "next/navigation";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Fosta pagină „Sesizare nouă". Formularul s-a mutat în casetă, pe lista de
 * sesizări (`?sesizare=noua`, vezi `../dialog-sesizare-noua.tsx`).
 *
 * ── DE CE REDIRECT, NU ȘTERGERE ──────────────────────────────────────────────
 * Spre deosebire de `/flota/nou` sau `/mentenanta/echipamente/nou`, adresa asta
 * e TIPĂRITĂ: autocolantele cu cod QR lipite pe utilaje codifică
 * `/mentenanta/sesizari/noua?echipament=<id>`. Un autocolant nu se actualizează
 * cu un deploy — iar un 404 scanat cu mănuși, în hală, se citește ca „aplicația
 * nu merge". Parametrul se păstrează ca atare; validarea lui o face lista.
 *
 * Pentru un `employee`, învelișul `(app)` îl trimite oricum în portal înainte de
 * a ajunge aici (`config/routes.ts`), unde `/portal/sesizari/noua` face același
 * redirect spre `/portal/sesizari?sesizare=noua`.
 */
export default async function PaginaSesizareNoua({ searchParams }: ProprietatiPagina) {
  const parametri = await searchParams;
  const tinta = new URLSearchParams({ sesizare: "noua" });
  const echipament = parametri["echipament"];
  if (typeof echipament === "string" && echipament.length > 0) {
    tinta.set("echipament", echipament);
  }
  redirect(`/mentenanta/sesizari?${tinta.toString()}`);
}
