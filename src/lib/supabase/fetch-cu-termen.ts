// src/lib/supabase/fetch-cu-termen.ts
import "server-only";

/**
 * Termen pe apelurile server → Supabase.
 *
 * DE CE EXISTĂ FIȘIERUL ĂSTA
 * Pe 23 august 2026, între 16:44 și 16:56 UTC, ambele replici au răspuns 504 la
 * tot ce trecea prin aplicație. Autentificarea reușea la Supabase în sub o
 * secundă (`auth/v1/token` → 200 la 16:42:42.905), după care procesul nu mai
 * emitea NICIUN apel spre exterior. Nicio excepție în log, nicio replică
 * moartă, memorie la 72 MB din 1 GB. nginx a tăiat la `proxy_read_timeout`,
 * browserul a văzut 504, iar cererile agățate au blocat și oprirea curată —
 * ambele containere au ieșit cu 137, ucise după cele 15 secunde de grație.
 *
 * Cauza mecanică: `fetch` din Node NU are termen implicit. Un socket rămas
 * agățat — DNS, connect, TLS sau un server care acceptă și tace — așteaptă la
 * infinit. O singură cerere blocată devine o pagină blocată; câteva devin un
 * proces care nu mai poate fi oprit.
 *
 * CE ANUME LIMITEAZĂ: ANTETUL, NU CORPUL
 * Cronometrul se oprește în clipa în care `fetch` se rezolvă — adică atunci
 * când au sosit antetele. Corpul curge apoi fără limită de timp. Distincția e
 * deliberată: un `select` întoarce antetul în milisecunde, dar o descărcare din
 * `org-documents` (25 MB per fișier) sau un export de salarii poate curge
 * legitim zeci de secunde. Un termen pe durata TOTALĂ ar rupe exact
 * descărcările mari, adică ar înlocui un defect rar cu unul zilnic.
 *
 * Anularea venită de la apelant (`.abortSignal()` din postgrest-js, semnalul de
 * upload din storage-js) rămâne activă pe toată durata răspunsului, corp
 * inclus — de aceea ascultătorul NU se dezleagă în `finally`.
 */

/**
 * Zece secunde. Măsurat pe producție în ziua incidentului, cel mai lent apel
 * real către GoTrue a fost de 704 ms, iar mediana sub 130 ms. Pragul e cu un
 * ordin de mărime peste, ca să nu taie niciodată un apel sănătos, și totuși de
 * douăsprezece ori sub cele 120 s pe care le aștepta nginx.
 */
export const TERMEN_ANTET_MS = 10_000;

/**
 * Termenul sondei de disponibilitate din `src/app/readyz/route.ts`, unde ne
 * interesează exact opusul: să aflăm REPEDE că apelul nu se mai întoarce.
 */
export const TERMEN_SONDA_MS = 2_000;

/**
 * Eroarea aruncată când antetul nu sosește la timp.
 *
 * Tip propriu, nu `DOMException`: `/readyz` trebuie să deosebească „Supabase nu
 * răspunde deloc” (semnătura blocajului — replica trebuie repornită) de
 * „Supabase a răspuns cu o eroare” (pană la ei — o replică sănătoasă nu are de
 * ce să fie omorâtă pentru asta).
 */
export class EroareTermenSupabase extends Error {
  readonly esteTermenDepasit = true;

  constructor(termenMs: number) {
    super(`Supabase nu a trimis antetul de răspuns în ${termenMs} ms.`);
    this.name = "EroareTermenSupabase";
  }
}

/**
 * Recunoaște eroarea și după ce a trecut prin supabase-js, care o reîmpachetează
 * și îi pierde prototipul. Marcajul e o proprietate, nu `instanceof`.
 */
export function esteTermenDepasit(eroare: unknown): boolean {
  if (typeof eroare !== "object" || eroare === null) return false;
  if (!("esteTermenDepasit" in eroare)) return false;
  return (eroare as { readonly esteTermenDepasit: unknown }).esteTermenDepasit === true;
}

type ArgumenteFetch = Parameters<typeof fetch>;

/**
 * Împachetează `fetch` cu un termen pe antetul de răspuns.
 *
 * Se dă lui supabase-js prin `global.fetch`, deci acoperă tot ce trece prin
 * client: PostgREST, GoTrue, Storage, RPC-uri.
 */
export function fetchCuTermen(termenMs: number = TERMEN_ANTET_MS): typeof fetch {
  return async function fetchCuAntetLimitat(
    resursa: ArgumenteFetch[0],
    optiuni?: ArgumenteFetch[1],
  ): Promise<Response> {
    const semnalApelant = optiuni?.signal ?? null;

    // Apelantul a renunțat înainte să începem: îl lăsăm pe `fetch` să respingă
    // cu motivul lui, fără să mai construim un controller degeaba.
    if (semnalApelant !== null && semnalApelant.aborted) {
      return await fetch(resursa, optiuni);
    }

    const control = new AbortController();
    const propagaAnularea = (): void => {
      control.abort(semnalApelant?.reason);
    };
    semnalApelant?.addEventListener("abort", propagaAnularea, { once: true });

    const cronometru = setTimeout(() => {
      control.abort(new EroareTermenSupabase(termenMs));
    }, termenMs);

    try {
      return await fetch(resursa, { ...optiuni, signal: control.signal });
    } finally {
      // Numai cronometrul. Ascultătorul de anulare rămâne legat: după ce
      // antetul a sosit, corpul încă poate fi anulat de apelant, iar asta
      // trebuie să continue să funcționeze.
      clearTimeout(cronometru);
    }
  };
}
