// src/lib/unelte/umami-server.ts
import "server-only";

import { after } from "next/server";

import type { DateEveniment } from "./date-eveniment";
import {
  DOMENIU_MASURAT,
  evenimentCont,
  evenimentDescarcare,
  type EvenimentServer,
} from "./masurare";

/**
 * Trimiterea evenimentelor de server la Umami, DUPĂ ce răspunsul a plecat.
 *
 * ── CE ȘTIE UMAMI DESPRE NOI ──────────────────────────────────────────────
 * Am citit `api/send` din Umami 3.3.1: `payload.ip` și `payload.userAgent` bat
 * antetele cererii. `127.0.0.1` e o adresă locală, pe care `getLocation` o
 * ignoră: fără țară, fără oraș și fără IP-ul serverului, care ar fi dat „DE”,
 * adică țara auditurilor noastre. UA-ul fix trece de `isbot` (verificat pe
 * 5.1.31 și 5.2.2); un UA care conține „bot” sau „compatible;” ar fi primit
 * `{"beep":"boop"}` și nimic scris. Sesiunea Umami e `uuid(site, ip, ua, sare
 * lunară)`, deci toate evenimentele de server ale unei luni stau într-o singură
 * sesiune: nu se poate lega nimic de un om.
 *
 * ── `data` ────────────────────────────────────────────────────────────────
 * Câmpurile evenimentului (`ev.date`) pleacă în `payload.data`, adică drept
 * proprietăți de eveniment Umami — aceeași cale ca `umami.track(nume, date)`
 * din browser. Ce poate ajunge acolo decide `date-eveniment.ts`, pe listă albă.
 *
 * ── DE CE `after()` ───────────────────────────────────────────────────────
 * Descărcarea nu așteaptă statistica. `after` rulează sarcina după răspuns, în
 * Route Handlers și în Server Functions. În afara unei cereri — teste, scripturi —
 * aruncă sincron `E468`; numărarea tace atunci, nu cade.
 */
export const AGENT_SERVER = "Mozilla/5.0 (X11; Linux x86_64) Administrativo/1.0";
export const IP_FARA_LOCALIZARE = "127.0.0.1";
const TERMEN_MS = 3000;

export type ConfigUmami = Readonly<{ adresa: string; site: string }>;
export type Cerere = (adresa: string, optiuni: RequestInit) => Promise<Response>;
export type Trimitere = (ev: EvenimentServer) => Promise<boolean>;
export type Programator = (sarcina: () => Promise<unknown>) => void;
export type OptiuniNumarare = Readonly<{ programator?: Programator; trimite?: Trimitere }>;

export function configUmami(src: string | undefined, site: string | undefined): ConfigUmami | null {
  const script = src?.trim() ?? "";
  const id = site?.trim() ?? "";
  if (script === "" || id === "") return null;
  try {
    return { adresa: new URL("/api/send", script).toString(), site: id };
  } catch {
    return null;
  }
}

/**
 * Scrise ÎNTREGI, nu prin `process.env[cheie]`: Next înlocuiește la build doar
 * forma literală, iar imaginea de producție nu are variabilele la rulare
 * (`Dockerfile`: `ENV NEXT_PUBLIC_UMAMI_*` doar în etapa de build). Ca la
 * `ScriptUmami`, lipsa lor înseamnă „nu se trimite nimic”, nu o eroare.
 */
export function configUmamiDinMediu(): ConfigUmami | null {
  return configUmami(process.env.NEXT_PUBLIC_UMAMI_SRC, process.env.NEXT_PUBLIC_UMAMI_ID);
}

export type PayloadServer = Readonly<{
  website: string;
  hostname: string;
  url: string;
  name: string;
  ip: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  data?: DateEveniment;
}>;

export function corpEveniment(
  config: ConfigUmami,
  ev: EvenimentServer,
): Readonly<{ type: "event"; payload: PayloadServer }> {
  return {
    type: "event",
    payload: {
      website: config.site,
      hostname: DOMENIU_MASURAT,
      url: ev.cale,
      name: ev.nume,
      ip: IP_FARA_LOCALIZARE,
      userAgent: AGENT_SERVER,
      browser: "server",
      os: "server",
      device: "server",
      ...(ev.date !== undefined && Object.keys(ev.date).length > 0 ? { data: ev.date } : {}),
    },
  };
}

export async function trimiteEveniment(
  ev: EvenimentServer,
  deps: Readonly<{ config?: ConfigUmami | null; cerere?: Cerere }> = {},
): Promise<boolean> {
  const config = deps.config !== undefined ? deps.config : configUmamiDinMediu();
  if (config === null) return false;
  const cerere: Cerere = deps.cerere ?? fetch;
  try {
    const raspuns = await cerere(config.adresa, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": AGENT_SERVER },
      body: JSON.stringify(corpEveniment(config, ev)),
      signal: AbortSignal.timeout(TERMEN_MS),
    });
    const text = await raspuns.text();
    if (!raspuns.ok || text.includes('"beep"')) {
      console.warn("[masurare] Umami n-a scris evenimentul", {
        nume: ev.nume,
        status: raspuns.status,
      });
      return false;
    }
    return true;
  } catch (eroare: unknown) {
    console.warn("[masurare] evenimentul n-a plecat", {
      nume: ev.nume,
      motiv: eroare instanceof Error ? eroare.name : "necunoscut",
    });
    return false;
  }
}

export function programeaza(ev: EvenimentServer | null, optiuni: OptiuniNumarare = {}): boolean {
  if (ev === null) return false;
  const trimite: Trimitere = optiuni.trimite ?? ((e) => trimiteEveniment(e));
  const programator: Programator = optiuni.programator ?? after;
  try {
    programator(() => trimite(ev));
    return true;
  } catch {
    // `after` în afara unei cereri (E468): teste, scripturi. Nu se numără nimic.
    return false;
  }
}

/**
 * Învelișul rutelor de descărcare: `export const GET = cuNumarare(genereaza)`.
 * Răspunsul trece neatins; o eroare a rutei se propagă ca înainte; o eroare a
 * numărării nu ajunge niciodată la vizitator.
 */
export function cuNumarare<C extends Request, A extends unknown[]>(
  genereaza: (cerere: C, ...rest: A) => Promise<Response>,
  optiuni: OptiuniNumarare = {},
): (cerere: C, ...rest: A) => Promise<Response> {
  return async (cerere: C, ...rest: A): Promise<Response> => {
    const raspuns = await genereaza(cerere, ...rest);
    try {
      programeaza(evenimentDescarcare(cerere, raspuns), optiuni);
    } catch (eroare: unknown) {
      console.warn("[masurare] descărcarea nu s-a putut număra", {
        motiv: eroare instanceof Error ? eroare.name : "necunoscut",
      });
    }
    return raspuns;
  };
}

/** Contul nou, numărat pe server: Umami din browser l-a pierdut pe singurul venit dintr-o unealtă. */
export function numaraConversia(
  sursa: unknown,
  antete: Pick<Headers, "get">,
  optiuni: OptiuniNumarare = {},
): boolean {
  try {
    return programeaza(evenimentCont(sursa, antete), optiuni);
  } catch {
    return false;
  }
}
