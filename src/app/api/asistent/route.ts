// src/app/api/asistent/route.ts
/**
 * Creierul asistentului: primește conversația, o duce la model, întoarce
 * răspunsul în flux.
 *
 * ── DE CE RUTĂ ȘI NU SERVER ACTION ───────────────────────────────────────────
 * O Server Action întoarce o valoare, o singură dată. Aici răspunsul trebuie să
 * apară pe ecran în timp ce se scrie — altfel omul se uită treizeci de secunde
 * la o rotiță. Streamingul cere un `ReadableStream`, deci un Route Handler.
 * Costul e că verificările nu mai vin gratis din `createAction`: se scriu aici,
 * pe rând. Proxy-ul lasă `/api/*` să treacă neatins (`src/proxy.ts`), deci ruta
 * chiar e singură.
 *
 * ── ORDINEA VERIFICĂRILOR NU E NEGOCIABILĂ ───────────────────────────────────
 * Cheia lipsă răspunde 404 înaintea autentificării: o rută oprită nu-și anunță
 * existența. Limita de rată vine ÎNAINTE de orice apel extern, altfel exact
 * abuzul pe care ar trebui să-l oprească e cel care costă bani. Zod vine după
 * autorizare, ca în `createAction` — un corp nevalid de la cineva neautorizat nu
 * merită nici măcar un mesaj de eroare precis.
 */
import { serverEnv } from "@/config/env";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { todayInBucharest } from "@/lib/format/date";
import { idFisaProprie } from "@/lib/queries/employees";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { cerereAsistentSchema } from "@/schemas/asistent";

import type { Destinatie } from "@/lib/asistent/destinatii";
import { destinatiiPermise } from "@/lib/asistent/filtreaza";
import { deschideFlux, type ApelUnealta, type MesajOpenRouter } from "@/lib/asistent/openrouter";
import { construiestePrompt } from "@/lib/asistent/prompt";
import { scrieCadru, type Cadru } from "@/lib/asistent/protocol";
import {
  declaraPentruModel,
  executaUnealta,
  uneltelePermise,
  TOATE_UNELTELE,
  type ContextUnealta,
} from "@/lib/asistent/unelte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Câte tururi de unelte are voie modelul înainte să fie obligat să răspundă.
 *
 * Trei acoperă „caută omul, apoi vezi ce are de aprobat”. Fără plafon, un model
 * confuz poate cere aceeași unealtă la nesfârșit, iar factura crește liniar cu
 * încăpățânarea lui.
 */
const MAX_RUNDE_UNELTE = 3;
const MAX_TOKENS = 800;

const text = (corp: string, status: number): Response =>
  new Response(corp, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

export async function POST(cerere: Request): Promise<Response> {
  // 1. Comutatorul global. 404, nu 403: ruta oprită nu există.
  if (serverEnv.OPENROUTER_API_KEY === "") return text("Not found", 404);

  // 2. Cine întreabă. `resolveTenant`, nu `requireTenant`: acela face
  //    `redirect()`, ceea ce într-o rută care răspunde JSON e o eroare de tip
  //    „302 în loc de 401”, greu de diagnosticat din client.
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") return text("Trebuie să te autentifici.", 401);
  if (rezolvare.status !== "ok") return text("Alege mai întâi o organizație.", 403);
  const { tenant, user } = rezolvare;

  // 3. Modulul, pentru firma asta.
  const features = await getEnabledFeatures(tenant.organizationId);
  if (!features.has("asistent")) return text("Not found", 404);

  // 4. Limitele. Trei niveluri, fiindcă abuzul are trei forme: un om curios, o
  //    firmă întreagă într-o zi proastă, și un incident care atinge tot serverul.
  const limite = await Promise.all([
    consumeRateLimit({ key: `asistent:utilizator:${user.id}`, limit: 30, windowSeconds: 3600 }),
    consumeRateLimit({
      key: `asistent:organizatie:${tenant.organizationId}`,
      limit: 300,
      windowSeconds: 86_400,
    }),
    consumeRateLimit({ key: "asistent:global", limit: 60, windowSeconds: 60 }),
  ]);
  if (limite.some((limita) => !limita.allowed)) {
    return text("Prea multe întrebări către asistent. Încearcă mai târziu.", 429);
  }

  // 5. Corpul.
  const brut: unknown = await cerere.json().catch(() => null);
  const parsat = cerereAsistentSchema.safeParse(brut);
  if (!parsat.success) return text("Cerere nevalidă.", 400);

  // Zona nu se ia pe cuvânt de la client: `employee` trăiește în portal, iar
  // restul în aplicație. Poarta asta e cea din layout-uri, repetată aici fiindcă
  // layout-ul nu e o barieră de securitate.
  const zona = tenant.role === "employee" ? "portal" : parsat.data.zona;

  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const destinatii = destinatiiPermise({ features, permisiuni, zona });
  const aziISO = todayInBucharest();

  const contextUnealta: ContextUnealta = {
    organizationId: tenant.organizationId,
    memberId: tenant.memberId,
    role: tenant.role,
    employeeId: await idFisaProprie(tenant.organizationId, user.id),
    numeUtilizator: user.fullName,
    permisiuni,
    features,
    aziISO,
  };
  const unelte = uneltelePermise(TOATE_UNELTELE, contextUnealta);

  const mesajeInitiale: MesajOpenRouter[] = [
    {
      role: "system",
      content: construiestePrompt({
        destinatii,
        unelte,
        zona,
        numeUtilizator: user.fullName,
        numeOrganizatie: tenant.name,
        aziISO,
      }),
    },
    ...parsat.data.mesaje.map((mesaj): MesajOpenRouter => ({
      role: mesaj.rol === "om" ? "user" : "assistant",
      content: mesaj.text,
    })),
  ];

  return fluxDeRaspuns(mesajeInitiale, unelte, contextUnealta, cerere.signal);
}

function fluxDeRaspuns(
  mesaje: MesajOpenRouter[],
  unelte: Parameters<typeof declaraPentruModel>[0],
  context: ContextUnealta,
  semnal: AbortSignal,
): Response {
  const codor = new TextEncoder();
  const declaratii = declaraPentruModel(unelte);

  const corp = new ReadableStream<Uint8Array>({
    async start(coada) {
      const trimite = (cadru: Cadru): void => {
        coada.enqueue(codor.encode(scrieCadru(cadru)));
      };

      try {
        await ruleaza(mesaje, declaratii, context, trimite, semnal);
      } catch (eroare) {
        console.error("[asistent] bucla a picat", eroare);
        trimite({ t: "eroare", m: "Ceva n-a mers. Încearcă din nou." });
      } finally {
        trimite({ t: "gata" });
        coada.close();
      }
    },
  });

  return new Response(corp, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      /*
       * Fără antetul ăsta, nginx-ul partajat din față tamponează tot răspunsul
       * și îl livrează dintr-o bucată: aplicația ar funcționa perfect, doar că
       * streamingul ar dispărea tăcut în producție și ar merge impecabil local.
       * Antetul îl citește nginx singur, deci nu cere modificare de configurație.
       */
      "x-accel-buffering": "no",
    },
  });
}

/** Bucla model → unelte → model, cu plafon de tururi. */
async function ruleaza(
  mesaje: MesajOpenRouter[],
  declaratii: ReturnType<typeof declaraPentruModel>,
  context: ContextUnealta,
  trimite: (cadru: Cadru) => void,
  semnal: AbortSignal,
): Promise<void> {
  for (let runda = 0; runda <= MAX_RUNDE_UNELTE; runda += 1) {
    // Ultimul tur se cere FĂRĂ unelte: e singurul mod de a garanta că bucla se
    // termină cu un răspuns în cuvinte, nu cu încă o cerere de unealtă.
    const ultimul = runda === MAX_RUNDE_UNELTE;
    const rezultat = await deschideFlux({
      mesaje,
      unelte: ultimul ? [] : declaratii,
      maxTokens: MAX_TOKENS,
      semnal,
    });
    if (!rezultat.ok) {
      trimite({ t: "eroare", m: rezultat.mesaj });
      return;
    }

    let raspuns = "";
    let apeluri: readonly ApelUnealta[] = [];
    for await (const bucata of rezultat.flux) {
      if (semnal.aborted) return;
      if (bucata.tip === "text") {
        raspuns += bucata.text;
        trimite({ t: "text", b: bucata.text });
      } else if (bucata.tip === "apeluri") {
        apeluri = bucata.apeluri;
      } else {
        trimite({ t: "eroare", m: bucata.mesaj });
        return;
      }
    }

    if (apeluri.length === 0) return;

    mesaje.push({
      role: "assistant",
      content: raspuns === "" ? null : raspuns,
      tool_calls: apeluri.map((apel) => ({
        id: apel.id,
        type: "function",
        function: { name: apel.nume, arguments: apel.argumente },
      })),
    });

    for (const apel of apeluri) {
      trimite({ t: "unealta", n: apel.nume });
      const rezultatUnealta = await executaUnealta(apel.nume, context, argument(apel.argumente));

      const efemere = rezultatUnealta.destinatiiEfemere ?? [];
      if (efemere.length > 0) {
        // Trimise ÎNAINTE de textul care le pomenește: clientul trebuie să le
        // aibă deja când sosește marcajul, altfel prima randare l-ar arunca.
        trimite({ t: "destinatii", d: efemere as readonly Destinatie[] });
      }

      const sugestii =
        rezultatUnealta.referinte === undefined || rezultatUnealta.referinte.length === 0
          ? ""
          : `\n\nDestinații potrivite pentru răspunsul acesta: ${rezultatUnealta.referinte.join(", ")}`;
      mesaje.push({
        role: "tool",
        tool_call_id: apel.id,
        content: `${rezultatUnealta.text}${sugestii}`,
      });
    }
  }
}

/** Argumentele sosesc ca șir JSON. Un șir stricat devine obiect gol, nu excepție. */
function argument(brut: string): unknown {
  if (brut.trim() === "") return {};
  try {
    return JSON.parse(brut);
  } catch {
    // Unealta își validează oricum intrarea cu Zod și va refuza clar.
    return {};
  }
}
