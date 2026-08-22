// src/lib/anaf/client.ts
// Client minimal peste `fetch` pentru serviciul public ANAF „PlatitorTvaRest" v9.
// Aceeași disciplină ca `src/lib/email/resend.ts`: un singur endpoint HTTP nu
// justifică o dependență, funcția NU aruncă niciodată, iar eșecul rețelei se
// întoarce ca rezultat discriminat.
//
// Serviciul e gratuit și fără autentificare, dar are un plafon de o cerere pe
// secundă PER IP SURSĂ, cu blocare temporară la depășire. IP-ul e al
// serverului, nu al utilizatorului — apărarea contra plafonului stă în ruta
// care cheamă funcția asta, nu aici.
//
// Endpoint-ul nu trimite anteturi CORS, deci nu poate fi apelat din browser:
// proxy-ul de pe server nu e o preferință de arhitectură, ci singura variantă.
import "server-only";

import { raspunsAnafSchema, type FirmaAnaf } from "@/domain/organization/anaf";
import { todayInBucharest } from "@/lib/format/date";

const ENDPOINT = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const TIMEOUT_MS = 10_000;

export type RezultatAnaf =
  | Readonly<{ ok: true; firma: FirmaAnaf }>
  | Readonly<{ ok: false; motiv: "negasit" | "indisponibil"; mesaj: string }>;

/**
 * Caută o firmă după CUI-ul deja normalizat (doar cifre, fără prefixul RO).
 *
 * `negasit` și `indisponibil` sunt stări DIFERITE, deliberat: prima înseamnă
 * „CUI-ul e valid ca cifră de control, dar nu există în registru" — utilizatorul
 * trebuie să-l recitească de pe certificat. A doua înseamnă „ANAF nu răspunde" —
 * utilizatorul completează mai departe de mână. Contopite, primul caz ar trimite
 * omul să aștepte degeaba.
 */
export async function cautaFirmaLaAnaf(cuiNormalizat: string): Promise<RezultatAnaf> {
  const cui = Number.parseInt(cuiNormalizat, 10);
  if (!Number.isSafeInteger(cui) || cui <= 0) {
    return { ok: false, motiv: "negasit", mesaj: "CUI-ul nu are o formă pe care ANAF o acceptă." };
  }

  try {
    const raspuns = await fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // Serviciul acceptă până la 100 de CUI-uri odată; noi cerem unul singur.
      // `data` e ziua pentru care se raportează starea de TVA.
      body: JSON.stringify([{ cui, data: todayInBucharest() }]),
    });

    if (!raspuns.ok) {
      return {
        ok: false,
        motiv: "indisponibil",
        mesaj:
          raspuns.status === 429
            ? "ANAF a limitat temporar interogările. Reîncercați peste un minut."
            : `ANAF a răspuns cu status ${raspuns.status}.`,
      };
    }

    const brut: unknown = await raspuns.json().catch(() => null);
    const parsat = raspunsAnafSchema.safeParse(brut);
    if (!parsat.success) {
      // Schema e deliberat tolerantă, deci ajungem aici doar dacă ANAF a
      // schimbat structura de bază — nu dacă a adăugat câmpuri.
      console.error("[anaf] răspuns neinterpretabil", parsat.error.issues);
      return {
        ok: false,
        motiv: "indisponibil",
        mesaj: "Răspunsul ANAF nu a putut fi interpretat.",
      };
    }

    const firma = parsat.data.found[0];
    if (firma === undefined) {
      return {
        ok: false,
        motiv: "negasit",
        mesaj: "ANAF nu are nicio firmă înregistrată cu acest CUI.",
      };
    }

    return { ok: true, firma };
  } catch (cauza) {
    const expirat =
      cauza instanceof Error && (cauza.name === "TimeoutError" || cauza.name === "AbortError");
    return {
      ok: false,
      motiv: "indisponibil",
      mesaj: expirat
        ? "ANAF nu a răspuns în 10 secunde."
        : "Conexiunea către ANAF a eșuat. Completați datele manual.",
    };
  }
}
