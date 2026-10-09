// src/lib/unelte/masurare.ts
import { PAGINI } from "@/content/landing/harta";

import { dateCalcul, dateDescarcare, type DateEveniment } from "./date-eveniment";

/**
 * Numărarea uneltelor gratuite pe server: ce s-a cerut, nu cine a cerut.
 *
 * ── DE CE PE SERVER ───────────────────────────────────────────────────────
 * Auditul din 8 oct 2026, pe 35 de zile: zero evenimente de descărcare de la
 * vizitatori externi în Umami, iar singurul om care și-a făcut cont dintr-o
 * unealtă (30 sept, foaia de pontaj) lipsește cu totul din Umami — avea
 * măsurarea blocată. Descărcarea și înregistrarea trec oricum prin server, deci
 * se pot număra acolo, fără să depindă de browser.
 *
 * ── CE PLEACĂ ȘI CE NU ────────────────────────────────────────────────────
 * Pleacă un nume: `dl:<unealtă>:<format>:<clasă>`, `calc:calculator-salariu:
 * <clasă>` sau `cont:<sursă>`, plus, la descărcări și la calcul, câteva câmpuri
 * care nu identifică pe nimeni (luna, anul, câți angajați, programul ales,
 * treapta brutului) — lista albă și regula ei sunt în `date-eveniment.ts`. NU
 * pleacă adresa IP, identificarea browserului, cookie-urile, nume, firmă, CUI,
 * traseu, text liber sau sume exacte.
 * IP-ul și antetele se citesc aici o singură dată, ca să aleagă clasa, și se
 * aruncă. Cookie-ul de sesiune NU se citește deloc: ar fi deosebit echipa de
 * vizitatori, dar ar fi însemnat folosirea unui cookie de autentificare în alt
 * scop decât autentificarea.
 *
 * ── DE CE FĂRĂ `server-only` ──────────────────────────────────────────────
 * E pur — antete, șiruri, adrese —, deci îl testează direct proiectul `unit`,
 * iar pagina de înregistrare îl folosește la randare. Trimiterea, care chiar
 * iese în rețea, stă în `umami-server.ts`.
 */

/** Singurul domeniu numărat. Aceeași valoare ca `data-domains` din `ScriptUmami` (test). */
export const DOMENIU_MASURAT = "administrativo.ro";

/** `utm_source` al adreselor de înregistrare puse pe unelte (`cta-unelte.ts`). */
export const SURSA_UTM_UNEALTA = "unealta";

/** `website_event.event_name` e `varchar(50)` în Umami 3.3.1 (`prisma/schema.prisma`). */
export const LUNGIME_MAXIMA_NUME = 50;

/**
 * Adresele serverului însuși, de unde pleacă auditurile noastre (curl,
 * playwright). În jurnalul din 8 oct 2026, 258 din 275 de cereri spre
 * `/api/unelte` veneau de la adresa IPv6 de mai jos.
 */
export const IP_SERVER: ReadonlySet<string> = new Set(["62.171.154.194", "2a02:c207:2316:2304::1"]);

export type Clasa = "audit" | "robot" | "om" | "neconfirmat";

export const CLASE: readonly Clasa[] = ["om", "neconfirmat", "robot", "audit"];

export const FORMATE_NUMARATE: ReadonlySet<string> = new Set(["pdf", "docx", "xlsx"]);

/** Uneltele, din harta paginilor publice: o unealtă nouă se numără fără altă listă. */
export const SLUGURI_UNELTE: ReadonlySet<string> = new Set(
  PAGINI.flatMap((p) => {
    const slug = /^\/unelte\/([a-z0-9-]+)$/u.exec(p.cale)?.[1];
    return slug === undefined ? [] : [slug];
  }),
);

/** Rutele de API al căror segment diferă de adresa paginii. */
const ALIAS_API: Readonly<Record<string, string>> = {
  "cerere-concediu": "cerere-concediu-de-odihna",
};

export type ParametriPagina = Readonly<Record<string, string | string[] | undefined>>;

export type EvenimentServer = Readonly<{ nume: string; cale: string; date?: DateEveniment }>;

/** Pagina calculatorului de salariu: singura unealtă care calculează pe pagină, fără descărcare. */
export const CALE_CALCULATOR = "/unelte/calculator-salariu";

/** `date` doar când are ceva: un obiect gol n-ar spune nimic în Umami. */
function cuDate(
  ev: Readonly<{ nume: string; cale: string }>,
  date: DateEveniment,
): EvenimentServer {
  return Object.keys(date).length > 0 ? { ...ev, date } : ev;
}

/** UA-ul cu care se recunoaște scriptul nostru de audit SEO (86.125.92.115, 8 oct 2026). */
const AGENT_AUDIT = /SEO-audit-check/iu;

/**
 * Boți, crawlere, previzualizări de link și clienți HTTP. Lista e scrisă pentru
 * ce trece prin `/api/unelte`, nu ca bibliotecă generală: ce scapă de ea cade în
 * „neconfirmat”, fiindcă un bot nu trimite `Sec-Fetch-User`.
 */
const AGENT_ROBOT =
  /bot|crawl|spider|slurp|scan|preview|headless|playwright|puppeteer|phantomjs|selenium|lighthouse|pagespeed|inspectiontool|mediapartners|externalagent|facebookexternalhit|whatsapp|curl\/|wget|python|httpx|aiohttp|go-http-client|java\/|okhttp|axios|node-fetch|undici|^node|libwww|scrapy|claude|chatgpt|perplexity/iu;

/** Telefoane cu „bot” în numele modelului; scoase înainte de potrivire. */
const MODEL_CU_BOT = /\bcubot\b/giu;

export function ipClient(antete: Pick<Headers, "get">): string | null {
  const brut = antete.get("cf-connecting-ip") ?? antete.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ip = brut
    .trim()
    .toLowerCase()
    .replace(/^::ffff:(?=\d{1,3}(?:\.\d{1,3}){3}$)/u, "");
  return ip === "" ? null : ip;
}

export function esteRobot(agent: string): boolean {
  const curat = agent.replace(MODEL_CU_BOT, "").trim();
  return curat === "" || AGENT_ROBOT.test(curat);
}

/**
 * Clasa unei cereri. Ordinea e regula: un audit rămâne audit chiar dacă arată
 * ca un om, iar „om” cere semnul pe care îl pune doar o navigare pornită de un
 * clic — `Sec-Fetch-User: ?1`. Butoanele de descărcare sunt `formAction` într-un
 * formular GET, deci un clic real îl trimite. Fără el: „neconfirmat”.
 */
export function clasificaCererea(antete: Pick<Headers, "get">, parametri: URLSearchParams): Clasa {
  const agent = antete.get("user-agent") ?? "";
  const ip = ipClient(antete);
  if (parametri.has("m") || (ip !== null && IP_SERVER.has(ip)) || AGENT_AUDIT.test(agent)) {
    return "audit";
  }
  if (esteRobot(agent)) return "robot";
  return antete.get("sec-fetch-user") === "?1" ? "om" : "neconfirmat";
}

/** nginx trimite `Host: $host`; staging și localhost nu se numără în statistica producției. */
export function gazdaMasurata(antete: Pick<Headers, "get">): boolean {
  const gazda = (antete.get("host") ?? "").trim().toLowerCase().replace(/:\d+$/u, "");
  return gazda === DOMENIU_MASURAT;
}

export function unealtaDinCale(cale: string): string | null {
  const segment = /^\/api\/unelte\/([a-z0-9-]+)(?:\/|$)/u.exec(cale)?.[1];
  if (segment === undefined) return null;
  if (SLUGURI_UNELTE.has(segment)) return segment;
  const alias = Object.hasOwn(ALIAS_API, segment) ? ALIAS_API[segment] : undefined;
  return alias !== undefined && SLUGURI_UNELTE.has(alias) ? alias : null;
}

/** Formatul, din numele fișierului atașat; `null` dacă răspunsul nu e o descărcare. */
export function formatDinRaspuns(raspuns: Response): string | null {
  const dispozitie = raspuns.headers.get("content-disposition") ?? "";
  if (!/^\s*attachment\b/iu.test(dispozitie)) return null;
  const nume = /filename\*?=(?:utf-8'')?"?([^";]+)"?/iu.exec(dispozitie)?.[1] ?? "";
  const extensie = /\.([a-z0-9]{1,5})$/iu.exec(nume.trim())?.[1]?.toLowerCase() ?? "";
  return FORMATE_NUMARATE.has(extensie) ? extensie : "alt";
}

export function numeEvenimentDescarcare(unealta: string, format: string, clasa: Clasa): string {
  return `dl:${unealta}:${format}:${clasa}`;
}

export function numeEvenimentCalcul(clasa: Clasa): string {
  return `calc:calculator-salariu:${clasa}`;
}

export function numeEvenimentCont(sursa: string | null): string {
  return `cont:${sursa ?? "direct"}`;
}

export function sursaConversiei(brut: unknown): string | null {
  return typeof brut === "string" && SLUGURI_UNELTE.has(brut) ? brut : null;
}

/** Sursa unei înregistrări, din adresa pusă de `adresaInregistrare` pe unelte. */
export function sursaDinParametri(p: ParametriPagina): string | null {
  if (p["utm_source"] !== SURSA_UTM_UNEALTA) return null;
  return sursaConversiei(p["utm_campaign"]);
}

export function evenimentDescarcare(cerere: Request, raspuns: Response): EvenimentServer | null {
  if (cerere.method !== "GET" || raspuns.status !== 200) return null;
  if (!gazdaMasurata(cerere.headers)) return null;
  const adresa = new URL(cerere.url);
  const unealta = unealtaDinCale(adresa.pathname);
  const format = formatDinRaspuns(raspuns);
  if (unealta === null || format === null) return null;
  const clasa = clasificaCererea(cerere.headers, adresa.searchParams);
  return cuDate(
    { nume: numeEvenimentDescarcare(unealta, format, clasa), cale: `/unelte/${unealta}` },
    dateDescarcare(unealta, adresa.searchParams),
  );
}

/**
 * Un calcul de salariu, numărat la randarea paginii. Doar când adresa are o
 * sumă, adică după „Calculează” sau dintr-un rând al tabelelor; pagina goală e
 * o simplă vizită și o numără deja Umami din browser. Suma NU pleacă: pleacă
 * treapta brutului rezultat (`dateCalcul`).
 */
export function evenimentCalcul(
  antete: Pick<Headers, "get">,
  parametri: URLSearchParams,
  brutRezultat: number | null,
): EvenimentServer | null {
  if (!gazdaMasurata(antete) || !parametri.has("suma")) return null;
  const clasa = clasificaCererea(antete, parametri);
  return cuDate(
    { nume: numeEvenimentCalcul(clasa), cale: CALE_CALCULATOR },
    dateCalcul(parametri, brutRezultat),
  );
}

/**
 * Contul nou. Clasa nu intră în nume — înregistrarea are deja limitare de rată
 * și e mereu un om sau un test —, dar auditurile și roboții nu se numără.
 */
export function evenimentCont(
  sursa: unknown,
  antete: Pick<Headers, "get">,
): EvenimentServer | null {
  if (!gazdaMasurata(antete)) return null;
  const clasa = clasificaCererea(antete, new URLSearchParams());
  if (clasa === "audit" || clasa === "robot") return null;
  return { nume: numeEvenimentCont(sursaConversiei(sursa)), cale: "/inregistrare" };
}
