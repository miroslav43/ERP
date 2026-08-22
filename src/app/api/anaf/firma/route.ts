// src/app/api/anaf/firma/route.ts
// Proxy autentificat peste registrul public ANAF, pentru precompletarea
// datelor firmei la înrolare.
//
// DE CE Route Handler și nu Server Action, contrar tiparului implicit al
// proiectului: cele două asistente care au nevoie de el au contexte de
// autorizare incompatibile. `createAction` cere obligatoriu tenant +
// permisiune, dar consola de super-admin creează o firmă care încă NU există,
// deci n-are tenant. `createPlatformAction` cere administrator de platformă,
// dar în `/bun-venit` apelantul e `org_admin`. Ar fi ieșit două acțiuni
// duplicate pentru aceeași citire. Iar citire este: nu scrie nimic, deci nu
// are ce audita și nu are ce revalida. Precedentul din repo e
// `src/app/api/export/audit/route.ts`, care își face singur autorizarea.
import { precompletareDinAnaf } from "@/domain/organization/anaf";
import { validateazaCui } from "@/domain/organization/cui";
import { cautaFirmaLaAnaf } from "@/lib/anaf/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

/** Câte interogări își permite un singur utilizator într-o oră. */
const LIMITA_UTILIZATOR = { max: 20, windowSeconds: 3600 } as const;

/**
 * Plafonul ANAF e de o cerere pe secundă PER IP SURSĂ, iar IP-ul e al
 * serverului — o singură cotă, împărțită de toți utilizatorii. O limitare doar
 * pe utilizator ar lăsa zece înrolări simultane să ne blocheze IP-ul pentru
 * toată lumea, inclusiv pentru cine nu a apăsat nimic.
 */
const LIMITA_GLOBALA = { max: 30, windowSeconds: 60 } as const;

const json = (corp: unknown, status: number): Response =>
  new Response(JSON.stringify(corp), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const eroare = (mesaj: string, status: number): Response => json({ ok: false, mesaj }, status);

export async function GET(cerere: Request): Promise<Response> {
  // 1. Autentificare. Fără ea, ruta e un proxy deschis peste IP-ul nostru, iar
  // primul care o descoperă ne blochează accesul la ANAF, nu pe al lui.
  const utilizator = await getCurrentUser();
  if (utilizator === null) {
    return eroare("Trebuie să fiți autentificat pentru a interoga registrul ANAF.", 401);
  }

  // 2. Validarea CUI-ului ÎNAINTE de apel: un CUI cu cifra de control greșită
  // nu merită o cerere din cota comună.
  const brut = new URL(cerere.url).searchParams.get("cui") ?? "";
  const verificare = validateazaCui(brut);
  if (!verificare.valid) {
    return eroare(verificare.mesaj, 400);
  }

  // 3. Ambele limite, în paralel.
  const limite = await Promise.all([
    consumeRateLimit({
      key: `anaf:utilizator:${utilizator.id}`,
      limit: LIMITA_UTILIZATOR.max,
      windowSeconds: LIMITA_UTILIZATOR.windowSeconds,
    }),
    consumeRateLimit({
      key: "anaf:global",
      limit: LIMITA_GLOBALA.max,
      windowSeconds: LIMITA_GLOBALA.windowSeconds,
    }),
  ]);
  if (limite.some((limita) => !limita.allowed)) {
    return eroare("Prea multe interogări ANAF. Reîncercați peste un minut.", 429);
  }

  const rezultat = await cautaFirmaLaAnaf(verificare.normalizat);
  if (!rezultat.ok) {
    // `negasit` e vina datelor introduse (404), `indisponibil` e a ANAF-ului
    // (502) — utilizatorul trebuie să știe dacă recitește certificatul sau
    // dacă trece pur și simplu la completarea manuală.
    return eroare(rezultat.mesaj, rezultat.motiv === "negasit" ? 404 : 502);
  }

  // Maparea rulează pe server: componenta client primește direct valorile de
  // formular, deci traducerea e testată o singură dată, într-un singur loc.
  const { denumire, valori, avertismente } = precompletareDinAnaf(rezultat.firma);
  return json({ ok: true, denumire, valori, avertismente }, 200);
}
