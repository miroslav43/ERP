// src/lib/reges/client.ts
import "server-only";

/**
 * Clientul HTTP pentru API-ul REGES-Online al Inspecției Muncii.
 *
 * DISCIPLINA, aceeași ca la `src/lib/anaf/client.ts`: `server-only`, termen
 * explicit prin `AbortSignal.timeout`, rezultat DISCRIMINAT, și NU aruncă
 * niciodată. O integrare externă care aruncă transformă o pană la ITM într-un
 * 500 pe tot ecranul.
 *
 * RETRY DOAR PE CE ARE ROST SĂ FIE REÎNCERCAT
 * Rețea căzută și 5xx: da. 400: NICIODATĂ. Un mesaj respins de schemă va fi
 * respins identic și a zecea oară, iar reîncercarea doar consumă cota și umple
 * jurnalul. 401 se reîncearcă exact o dată, după reîmprospătarea jetonului —
 * mai mult ar însemna că problema e la credențiale, nu la expirare.
 *
 * DE CE NU FOLOSEȘTE `fetchCuTermen`
 * Acela e injectat în clienții Supabase și taie doar antetul, lăsând corpul să
 * curgă (exporturi mari). Aici corpurile sunt mesaje mici, deci termenul se pune
 * pe cererea întreagă — un răspuns REGES care nu se mai termină e o pană, nu o
 * descărcare.
 */

export const BAZE_API = {
  test: "https://api.dev.inspectiamuncii.org",
  // ⚠ NEVERIFICATĂ. SSO-ul de producție l-am interogat direct și răspunde; baza
  // API-ului nu. Se confirmă din portalul de producție înainte de go-live.
  productie: "https://api.inspectiamuncii.ro",
} as const;

export const BAZE_SSO = {
  // Ambele medii sunt Keycloak, realm `API`. Verificate prin documentele de
  // discovery: `grant_types_supported` conține `password` și `refresh_token`.
  test: "https://sso.dev.inspectiamuncii.org/realms/API",
  productie: "https://sso.inspectiamuncii.ro/realms/API",
} as const;

export type Mediu = keyof typeof BAZE_API;

const TERMEN_MS = 20_000;
const REINCERCARI_RETEA = 2;
const PAUZA_MS = [500, 1500] as const;

export type RaspunsReges<T> =
  | Readonly<{ ok: true; date: T; status: number; durataMs: number }>
  | Readonly<{
      ok: false;
      /**
       * `validare` = 400, mesajul nu respectă schema. NU se reîncearcă.
       * `neautorizat` = 401/403, jetonul e expirat sau cheile sunt greșite.
       * `indisponibil` = 5xx, timeout, rețea. Se poate reîncerca mai târziu.
       * `neasteptat` = orice altceva, inclusiv un corp care nu e JSON.
       */
      motiv: "validare" | "neautorizat" | "indisponibil" | "neasteptat";
      mesaj: string;
      status: number | null;
      durataMs: number;
    }>;

export type CerereReges = Readonly<{
  mediu: Mediu;
  cale: string;
  metoda: "GET" | "POST";
  jeton: string;
  corp?: unknown;
  /** Parametri de query. `consumerId` trece pe aici — Swagger îl declară query, nu corp. */
  parametri?: Readonly<Record<string, string | number>>;
}>;

function construiesteUrl(cerere: CerereReges): string {
  const url = new URL(cerere.cale, BAZE_API[cerere.mediu]);
  for (const [cheie, valoare] of Object.entries(cerere.parametri ?? {})) {
    url.searchParams.set(cheie, String(valoare));
  }
  return url.toString();
}

const asteapta = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Extrage un mesaj lizibil dintr-un corp de eroare, oricare i-ar fi forma. */
function mesajDinCorp(brut: string, status: number): string {
  if (brut.trim() === "") return `Inspecția Muncii a răspuns cu ${status}, fără explicație.`;
  try {
    const corp: unknown = JSON.parse(brut);
    if (typeof corp === "string") return corp;
    if (typeof corp === "object" && corp !== null) {
      const o = corp as Record<string, unknown>;
      // ASP.NET întoarce ProblemDetails; `errors` e un dicționar câmp → mesaje.
      if (typeof o.detail === "string") return o.detail;
      if (typeof o.title === "string" && typeof o.errors !== "object") return o.title;
      if (typeof o.errors === "object" && o.errors !== null) {
        const bucati = Object.entries(o.errors as Record<string, unknown>).map(
          ([camp, mesaje]) =>
            `${camp}: ${Array.isArray(mesaje) ? mesaje.join("; ") : String(mesaje)}`,
        );
        if (bucati.length > 0) return bucati.join(" · ");
      }
    }
  } catch {
    // Corp care nu e JSON — se întoarce ca atare, tăiat.
  }
  return brut.length > 1000 ? `${brut.slice(0, 1000)}…` : brut;
}

async function odata<T>(cerere: CerereReges): Promise<RaspunsReges<T>> {
  const inceput = Date.now();
  try {
    const raspuns = await fetch(construiesteUrl(cerere), {
      method: cerere.metoda,
      cache: "no-store",
      signal: AbortSignal.timeout(TERMEN_MS),
      headers: {
        Authorization: `Bearer ${cerere.jeton}`,
        Accept: "application/json",
        ...(cerere.corp === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(cerere.corp === undefined ? {} : { body: JSON.stringify(cerere.corp) }),
    });

    const durataMs = Date.now() - inceput;
    const brut = await raspuns.text();

    if (raspuns.ok) {
      if (brut.trim() === "") {
        return { ok: true, date: undefined as T, status: raspuns.status, durataMs };
      }
      try {
        return { ok: true, date: JSON.parse(brut) as T, status: raspuns.status, durataMs };
      } catch {
        return {
          ok: false,
          motiv: "neasteptat",
          mesaj: "Răspunsul Inspecției Muncii nu e JSON valid.",
          status: raspuns.status,
          durataMs,
        };
      }
    }

    const motiv =
      raspuns.status === 400 || raspuns.status === 422
        ? "validare"
        : raspuns.status === 401 || raspuns.status === 403
          ? "neautorizat"
          : raspuns.status >= 500
            ? "indisponibil"
            : "neasteptat";

    return {
      ok: false,
      motiv,
      mesaj: mesajDinCorp(brut, raspuns.status),
      status: raspuns.status,
      durataMs,
    };
  } catch (eroare) {
    const durataMs = Date.now() - inceput;
    const numeEroare = eroare instanceof Error ? eroare.name : "";
    const esteTermen = numeEroare === "TimeoutError" || numeEroare === "AbortError";
    return {
      ok: false,
      motiv: "indisponibil",
      mesaj: esteTermen
        ? `Inspecția Muncii nu a răspuns în ${TERMEN_MS / 1000} secunde.`
        : "Nu s-a putut deschide legătura cu Inspecția Muncii.",
      status: null,
      durataMs,
    };
  }
}

/**
 * Trimite cererea, reîncercând DOAR eșecurile care se pot repara singure.
 *
 * Un 400 se întoarce imediat: al doilea apel identic ar primi același refuz și
 * ar consuma cotă degeaba.
 */
export async function cheamaReges<T>(cerere: CerereReges): Promise<RaspunsReges<T>> {
  let ultim = await odata<T>(cerere);
  for (let i = 0; i < REINCERCARI_RETEA && !ultim.ok && ultim.motiv === "indisponibil"; i += 1) {
    await asteapta(PAUZA_MS[i] ?? 1500);
    ultim = await odata<T>(cerere);
  }
  return ultim;
}
