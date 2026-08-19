import "server-only";
import { mapeazaRaspunsAnaf, type RezultatAnafGasit } from "@/domain/organization/anaf";

const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const TIMEOUT_MS = 8000;

export type RezultatCautareAnaf =
  | Readonly<{ stare: "gasit"; rezultat: RezultatAnafGasit }>
  | Readonly<{ stare: "negasit" }>
  | Readonly<{ stare: "indisponibil" }>;

/**
 * Apelul public ANAF (fără cheie, fără autentificare). Orice eșec — timeout,
 * rețea, HTTP non-200, JSON invalid — degradează la „indisponibil", niciodată
 * excepție: ecranul 1 trebuie să poată trece mereu la completare manuală.
 */
export async function cautaFirmaAnaf(cuiNormalizat: string): Promise<RezultatCautareAnaf> {
  const azi = new Date().toISOString().slice(0, 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const raspuns = await fetch(ANAF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ cui: Number(cuiNormalizat), data: azi }]),
      signal: controller.signal,
    });
    if (!raspuns.ok) return { stare: "indisponibil" };
    const json: unknown = await raspuns.json();
    const rezultat = mapeazaRaspunsAnaf(cuiNormalizat, json);
    return rezultat.gasit ? { stare: "gasit", rezultat } : { stare: "negasit" };
  } catch {
    return { stare: "indisponibil" };
  } finally {
    clearTimeout(timer);
  }
}
