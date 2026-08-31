// src/lib/asistent/openrouter.ts
/**
 * Client OpenRouter scris de mână, în forma lui `src/lib/anaf/client.ts`.
 *
 * Fără `ai`, fără `@ai-sdk/*`, fără `openai`. Motivul e scris deja în repo, la
 * clientul ANAF: „un singur endpoint HTTP nu justifică o dependență”. Aici e
 * chiar un singur endpoint, iar tot ce ne trebuie de la el — flux, apeluri de
 * unelte, un plafon de token — încape în fișierul ăsta. Un SDK ar fi adus în
 * schimb propriul model de mesaje, propriul retry și propriile presupuneri
 * despre cum se termină un flux.
 *
 * Ca și clientul ANAF, funcția NU ARUNCĂ NICIODATĂ: întoarce o uniune
 * discriminată. O pană la OpenRouter e o stare normală a lumii, nu o excepție,
 * iar ruta care o cheamă trebuie să poată răspunde omenește.
 *
 * ── TERMENUL E PE ANTET, NU PE CORP ──────────────────────────────────────────
 * Se refolosește `fetchCuTermen`, care oprește cronometrul în clipa în care
 * `fetch` se rezolvă — adică la sosirea antetelor — și lasă corpul să curgă fără
 * limită. Exact ce trebuie unui flux: o conexiune moartă se taie în zece
 * secunde, dar un model care scrie treizeci de secunde nu e o conexiune moartă.
 * Un `AbortSignal.timeout` simplu ar fi retezat răspunsul la mijloc de frază.
 */
import "server-only";

import { z } from "zod";

import { clientEnv, serverEnv } from "@/config/env";
import { esteTermenDepasit, fetchCuTermen, TERMEN_ANTET_MS } from "@/lib/supabase/fetch-cu-termen";

import { creeazaCititorSse, SEMNAL_FINAL } from "./sse";
import type { DeclaratieUnealta } from "./unelte";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ApelUnealta = Readonly<{ id: string; nume: string; argumente: string }>;

export type MesajOpenRouter =
  | Readonly<{ role: "system" | "user"; content: string }>
  | Readonly<{
      role: "assistant";
      content: string | null;
      tool_calls?: readonly Readonly<{
        id: string;
        type: "function";
        function: Readonly<{ name: string; arguments: string }>;
      }>[];
    }>
  | Readonly<{ role: "tool"; tool_call_id: string; content: string }>;

export type BucataFlux =
  | Readonly<{ tip: "text"; text: string }>
  | Readonly<{ tip: "apeluri"; apeluri: readonly ApelUnealta[] }>
  | Readonly<{ tip: "eroare"; mesaj: string }>;

export type IntrareFlux = Readonly<{
  mesaje: readonly MesajOpenRouter[];
  unelte: readonly DeclaratieUnealta[];
  maxTokens: number;
  /** Anularea venită de la client, când omul închide fereastra. */
  semnal?: AbortSignal;
}>;

export type RezultatFlux =
  Readonly<{ ok: true; flux: AsyncGenerator<BucataFlux> }> | Readonly<{ ok: false; mesaj: string }>;

/*
 * Se validează DOAR ce citim. `passthrough` implicit al lui Zod pe câmpurile
 * neenumerate e ce vrem: OpenRouter adaugă periodic câmpuri (`usage`,
 * `reasoning`, `provider`), iar un `strict()` ar transforma o îmbunătățire de
 * la ei într-o pană la noi.
 */
const bucataSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullish(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number().int(),
                  id: z.string().nullish(),
                  function: z
                    .object({ name: z.string().nullish(), arguments: z.string().nullish() })
                    .nullish(),
                }),
              )
              .nullish(),
          })
          .nullish(),
        finish_reason: z.string().nullish(),
      }),
    )
    .nullish(),
});

/** Apelurile de unelte sosesc fragmentate, pe `index`. Se cos la loc aici. */
class ColectorApeluri {
  private readonly peIndex = new Map<number, { id: string; nume: string; argumente: string }>();

  adauga(
    index: number,
    id: string | null | undefined,
    nume: string | null | undefined,
    argumente: string | null | undefined,
  ): void {
    const curent = this.peIndex.get(index) ?? { id: "", nume: "", argumente: "" };
    this.peIndex.set(index, {
      // `id` și `nume` sosesc o singură dată, în prima bucată; `arguments`
      // sosește pe felii de câteva caractere și se CONCATENEAZĂ.
      id: id ?? curent.id,
      nume: nume ?? curent.nume,
      argumente: curent.argumente + (argumente ?? ""),
    });
  }

  aduna(): readonly ApelUnealta[] {
    return [...this.peIndex.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([, apel]) => (apel.nume === "" ? [] : [apel]));
  }

  get gol(): boolean {
    return this.peIndex.size === 0;
  }
}

export async function deschideFlux(intrare: IntrareFlux): Promise<RezultatFlux> {
  const cheie = serverEnv.OPENROUTER_API_KEY;
  if (cheie === "") return { ok: false, mesaj: "Asistentul nu este configurat." };

  const corp = {
    model: serverEnv.OPENROUTER_MODEL_ASISTENT,
    messages: intrare.mesaje,
    stream: true,
    max_tokens: intrare.maxTokens,
    // Temperatură mică: sarcina e „alege ruta potrivită din lista dată”, nu
    // compunere liberă. Un model creativ inventează identificatori.
    temperature: 0.2,
    ...(intrare.unelte.length === 0 ? {} : { tools: intrare.unelte }),
  };

  let raspuns: Response;
  try {
    raspuns = await fetchCuTermen(TERMEN_ANTET_MS)(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${cheie}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        // Atribuirea cerută de OpenRouter, ca traficul să apară în consola lor
        // sub aplicația asta, nu ca „necunoscut”.
        "HTTP-Referer": clientEnv.NEXT_PUBLIC_APP_URL,
        "X-Title": "Administrativo",
      },
      body: JSON.stringify(corp),
      ...(intrare.semnal === undefined ? {} : { signal: intrare.semnal }),
    });
  } catch (eroare) {
    if (esteTermenDepasit(eroare)) {
      return { ok: false, mesaj: "Asistentul nu a răspuns la timp. Încearcă din nou." };
    }
    console.error("[asistent] apelul OpenRouter a eșuat", eroare);
    return { ok: false, mesaj: "Asistentul nu este disponibil acum." };
  }

  if (!raspuns.ok || raspuns.body === null) {
    // Corpul erorii se citește pentru jurnal, nu pentru utilizator: poate conține
    // fragmente din prompt, iar promptul conține lista de rute permise.
    const detaliu = await raspuns.text().catch(() => "");
    console.error(`[asistent] OpenRouter a răspuns ${raspuns.status}`, detaliu.slice(0, 500));
    if (raspuns.status === 429) {
      return { ok: false, mesaj: "Prea multe întrebări către asistent. Încearcă peste un minut." };
    }
    return { ok: false, mesaj: "Asistentul nu este disponibil acum." };
  }

  return { ok: true, flux: citeste(raspuns.body) };
}

async function* citeste(corp: ReadableStream<Uint8Array>): AsyncGenerator<BucataFlux> {
  const cititor = creeazaCititorSse();
  const decodor = new TextDecoder();
  const apeluri = new ColectorApeluri();
  const sursa = corp.getReader();

  try {
    for (;;) {
      const { done, value } = await sursa.read();
      const incarcaturi =
        done || value === undefined
          ? cititor.incheie()
          : cititor.adauga(decodor.decode(value, { stream: true }));

      for (const incarcatura of incarcaturi) {
        if (incarcatura === SEMNAL_FINAL) {
          if (!apeluri.gol) yield { tip: "apeluri", apeluri: apeluri.aduna() };
          return;
        }
        let brut: unknown;
        try {
          brut = JSON.parse(incarcatura);
        } catch {
          // Un cadru stricat nu are voie să oprească răspunsul: se sare peste.
          continue;
        }
        const parsat = bucataSchema.safeParse(brut);
        if (!parsat.success) continue;

        for (const alegere of parsat.data.choices ?? []) {
          const continut = alegere.delta?.content;
          if (typeof continut === "string" && continut !== "") {
            yield { tip: "text", text: continut };
          }
          for (const apel of alegere.delta?.tool_calls ?? []) {
            apeluri.adauga(apel.index, apel.id, apel.function?.name, apel.function?.arguments);
          }
        }
      }

      if (done) break;
    }
    // Flux încheiat fără `[DONE]` — se raportează totuși apelurile adunate.
    if (!apeluri.gol) yield { tip: "apeluri", apeluri: apeluri.aduna() };
  } catch (eroare) {
    console.error("[asistent] fluxul s-a rupt", eroare);
    yield { tip: "eroare", mesaj: "Legătura cu asistentul s-a întrerupt." };
  } finally {
    // Fără asta, o conexiune abandonată de client ar lăsa fluxul din amonte
    // deschis, iar token-ul s-ar consuma până la capăt fără să-l citească nimeni.
    await sursa.cancel().catch(() => undefined);
  }
}
