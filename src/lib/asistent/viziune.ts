// src/lib/asistent/viziune.ts
/**
 * Clientul de viziune OpenRouter: o imagine + o schemă JSON → un răspuns
 * structurat, dintr-o bucată. Îl folosește citirea bonului de combustibil
 * (flota, F12a); trăiește lângă asistent fiindcă împarte cu el cheia,
 * modulul (`asistent`) și sub-împuternicitul.
 *
 * Separat de `openrouter.ts`, deliberat: acela e scris pentru FLUX (SSE, unelte,
 * `content: string`), iar extinderea lui `MesajOpenRouter` la conținut
 * multimodal ar fi atins bucla asistentului. Se reutilizează doar endpoint-ul.
 * Fără SDK, din același motiv ca acolo.
 *
 * ── CE SE TRIMITE, EXACT ───────────────────────────────────────────────────
 *  · `stream: false`, `max_tokens: 1500`, `reasoning.effort: "low"` (modelul
 *    are raționament obligatoriu; „low” e pe lista lui și plafonează costul);
 *  · `response_format: json_schema` cu `strict: true`;
 *  · `provider: { require_parameters, data_collection: "deny", zdr: true }` —
 *    Zero Data Retention: fără el, bonul ar sta 55 de zile la Google (F12a E14);
 *  · FĂRĂ `temperature`: endpoint-urile Vertex (singurele ZDR ale modelului) nu
 *    o suportă, deci cu `require_parameters` + `zdr` n-ar mai rămâne niciun
 *    endpoint (F12a E3, D16). Testul fixează lipsa ei.
 *
 * ── TERMENUL E PE TOT RĂSPUNSUL ────────────────────────────────────────────
 * Fără flux, antetele vin abia după generare, deci `fetchCuTermen` (care taie
 * la antete, după 10 s) ar tăia orice citire. Aici: `AbortSignal.timeout(30 s)`.
 *
 * ── CE NU SE JURNALIZEAZĂ ──────────────────────────────────────────────────
 * Nici imaginea, nici răspunsul. Doar modelul, costul, tokenii și durata, cu
 * prefixul `[ocr-bon]`; corpul unei erori, tăiat la 500 de caractere.
 *
 * Ca `deschideFlux`, funcția NU ARUNCĂ NICIODATĂ: o pană la OpenRouter e o
 * stare normală a lumii, iar omul completează atunci manual.
 */
import "server-only";

import { z } from "zod";

import { clientEnv, serverEnv } from "@/config/env";

import { ENDPOINT_OPENROUTER } from "./openrouter";

export const TERMEN_VIZIUNE_MS = 30_000;

export type MotivEsecViziune =
  "neconfigurat" | "termen" | "limita" | "indisponibil" | "fara_endpoint";

export type RezultatViziune =
  | Readonly<{
      ok: true;
      continut: string;
      model: string;
      cost: number | null;
      tokeni: Readonly<{ intrare: number; iesire: number }>;
    }>
  | Readonly<{ ok: false; motiv: MotivEsecViziune; mesaj: string }>;

export type IntrareViziune = Readonly<{
  /** Instrucțiunea de sistem. */
  prompt: string;
  /** Textul utilizatorului, trimis ÎNAINTEA imaginii. */
  instructiune: string;
  jpegBase64: string;
  schema: Readonly<{ name: string; schema: unknown }>;
  /** Anularea venită de sus; termenul de 30 s se aplică oricum. */
  semnal?: AbortSignal;
}>;

/*
 * Se validează DOAR ce citim. Câmpurile neenumerate trec: OpenRouter adaugă
 * periodic câmpuri, iar un `strict()` ar transforma o îmbunătățire de la ei
 * într-o pană la noi.
 */
const raspunsSchema = z.object({
  model: z.string().nullish(),
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      cost: z.number().nullish(),
      completion_tokens_details: z.object({ reasoning_tokens: z.number().nullish() }).nullish(),
    })
    .nullish(),
});

const MESAJE: Readonly<Record<MotivEsecViziune, string>> = {
  neconfigurat: "Citirea automată a bonului nu este configurată.",
  termen: "Citirea bonului a durat prea mult. Încercați din nou sau completați manual.",
  limita: "Serviciul de citire e ocupat acum. Încercați peste un minut sau completați manual.",
  indisponibil: "Citirea automată nu este disponibilă acum. Completați manual.",
  fara_endpoint:
    "Citirea automată nu este disponibilă acum: niciun furnizor nu acceptă condițiile de confidențialitate cerute. Completați manual.",
};

function esec(motiv: MotivEsecViziune): RezultatViziune {
  return { ok: false, motiv, mesaj: MESAJE[motiv] };
}

function esteTermen(eroare: unknown): boolean {
  return (
    eroare instanceof DOMException &&
    (eroare.name === "TimeoutError" || eroare.name === "AbortError")
  );
}

export async function citesteImagineStructurat(intrare: IntrareViziune): Promise<RezultatViziune> {
  const cheie = serverEnv.OPENROUTER_API_KEY;
  if (cheie === "") return esec("neconfigurat");

  const model = serverEnv.OPENROUTER_MODEL_VIZIUNE;
  const corp = {
    model,
    messages: [
      { role: "system", content: intrare.prompt },
      {
        role: "user",
        content: [
          { type: "text", text: intrare.instructiune },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${intrare.jpegBase64}` } },
        ],
      },
    ],
    stream: false,
    max_tokens: 1500,
    reasoning: { effort: "low" },
    response_format: {
      type: "json_schema",
      json_schema: { name: intrare.schema.name, strict: true, schema: intrare.schema.schema },
    },
    provider: { require_parameters: true, data_collection: "deny", zdr: true },
  };

  const semnal = AbortSignal.any([
    AbortSignal.timeout(TERMEN_VIZIUNE_MS),
    ...(intrare.semnal === undefined ? [] : [intrare.semnal]),
  ]);
  const start = Date.now();

  let raspuns: Response;
  try {
    raspuns = await fetch(ENDPOINT_OPENROUTER, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${cheie}`,
        "Content-Type": "application/json",
        "HTTP-Referer": clientEnv.NEXT_PUBLIC_APP_URL,
        "X-Title": "Administrativo",
      },
      body: JSON.stringify(corp),
      signal: semnal,
    });
  } catch (eroare) {
    if (esteTermen(eroare)) {
      console.error("[ocr-bon] termen depășit", { model, durata_ms: Date.now() - start });
      return esec("termen");
    }
    console.error("[ocr-bon] apelul OpenRouter a eșuat", {
      model,
      eroare: eroare instanceof Error ? eroare.name : "necunoscută",
    });
    return esec("indisponibil");
  }

  let text: string;
  try {
    text = await raspuns.text();
  } catch (eroare) {
    if (esteTermen(eroare)) return esec("termen");
    console.error("[ocr-bon] corpul răspunsului nu s-a putut citi", { status: raspuns.status });
    return esec("indisponibil");
  }

  if (!raspuns.ok) {
    // Corpul erorii merge în jurnal, tăiat, nu la om — și fără imagine, dacă
    // providerul ar repeta cererea în mesajul de eroare.
    console.error(
      `[ocr-bon] OpenRouter a răspuns ${String(raspuns.status)}`,
      text
        .replaceAll(intrare.jpegBase64, "[imagine]")
        .replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gu, "[imagine]")
        .slice(0, 500),
    );
    if (raspuns.status === 429) return esec("limita");
    if (
      raspuns.status === 404 ||
      (raspuns.status === 503 && /no available model provider/i.test(text))
    ) {
      return esec("fara_endpoint");
    }
    return esec("indisponibil");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("[ocr-bon] răspunsul nu e JSON", {
      status: raspuns.status,
      lungime: text.length,
    });
    return esec("indisponibil");
  }
  const citit = raspunsSchema.safeParse(json);
  if (!citit.success) {
    console.error("[ocr-bon] răspunsul nu are forma așteptată", { model });
    return esec("indisponibil");
  }

  const usage = citit.data.usage;
  const rezultat = {
    ok: true as const,
    continut: citit.data.choices[0]?.message.content ?? "",
    model: citit.data.model ?? model,
    cost: usage?.cost ?? null,
    tokeni: { intrare: usage?.prompt_tokens ?? 0, iesire: usage?.completion_tokens ?? 0 },
  };
  console.info("[ocr-bon] citire", {
    model: rezultat.model,
    cost: rezultat.cost,
    tokeni_intrare: rezultat.tokeni.intrare,
    tokeni_iesire: rezultat.tokeni.iesire,
    tokeni_rationament: usage?.completion_tokens_details?.reasoning_tokens ?? null,
    durata_ms: Date.now() - start,
  });
  return rezultat;
}
