// src/app/(scanare)/mentenanta/sesizari/noua/page.tsx
import { redirect } from "next/navigation";
import { POARTA_PORTAL_ACTIVA } from "@/config/routes";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Adresa TIPĂRITĂ pe autocolantele cu cod QR lipite pe utilaje:
 * `/mentenanta/sesizari/noua?echipament=<id>`. Un autocolant nu se actualizează
 * cu un deploy — iar un 404 scanat cu mănuși, în hală, se citește ca „aplicația
 * nu merge". Formularul e casetă pe lista de sesizări (`?sesizare=noua`).
 *
 * ── DE CE ÎN `(scanare)`, NU ÎN `(app)` ─────────────────────────────────────
 * Învelișul `(app)` trimite orice `employee` pe `/portal`, fără cale și fără
 * interogare: un layout nu vede adresa cerută. Angajatul care scana eticheta
 * ajungea pe „Acasă" în portal, cu utilajul pierdut — exact omul pentru care e
 * făcut autocolantul (e2e/mentenanta.spec.ts, staging 39963701049). Aici nu
 * există niciun layout de rol, deci pagina alege singură lista potrivită și
 * păstrează parametrul. Cel nelogat e trimis de proxy la autentificare cu
 * adresa întreagă în `?next=`.
 *
 * Validarea id-ului o face lista; drepturile, pagina-țintă.
 */
export default async function PaginaSesizareNoua({ searchParams }: ProprietatiPagina) {
  const parametri = await searchParams;
  const { tenant } = await requireTenant();
  const tinta = new URLSearchParams({ sesizare: "noua" });
  const echipament = parametri["echipament"];
  if (typeof echipament === "string" && echipament.length > 0) {
    tinta.set("echipament", echipament);
  }
  const lista =
    POARTA_PORTAL_ACTIVA && tenant.role === "employee"
      ? "/portal/sesizari"
      : "/mentenanta/sesizari";
  redirect(`${lista}?${tinta.toString()}`);
}
