// src/app/(app)/flota/rapoarte/adrese.ts
import { intervalLuna } from "@/domain/fleet/rapoarte";

/** Adresele ecranului de rapoarte și ale descărcărilor lui. Pure: le folosesc și testele. */

function cu(baza: string, parametri: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (valoare !== null) q.set(cheie, valoare);
  }
  return `${baza}?${q.toString()}`;
}

export function adresaRaport(luna: string, vehicul: string | null): string {
  return cu("/flota/rapoarte", { luna, vehicul });
}

export function adresaExport(fel: "xlsx" | "pachet", luna: string, vehicul: string | null): string {
  return cu(fel === "xlsx" ? "/api/export/flota" : "/api/export/flota/pachet", { luna, vehicul });
}

/** Lista foilor APROBATE ale lunii, ca cifrele din raport să poată fi urmărite până la foaie. */
export function adresaFoileLunii(luna: string, vehicul: string | null): string {
  const { deLa, panaLa } = intervalLuna(luna);
  return cu("/flota/foi", { status: "aprobat", de_la: deLa, pana_la: panaLa, vehicul });
}
