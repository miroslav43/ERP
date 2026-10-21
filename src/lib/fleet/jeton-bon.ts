// src/lib/fleet/jeton-bon.ts
/**
 * Jetonul care duce propunerea citită de pe bon de la `citesteBonul` la
 * `adaugaAlimentare`, prin browser (F12a D12).
 *
 * ── CE ESTE ȘI CE NU ESTE ──────────────────────────────────────────────────
 * E doar TRANSPORTUL: dovedește că propunerea a venit de la server, pentru
 * acest om, această firmă, această foaie și această poză, în ultimele 2 ore.
 * NU e garda bazei: `fuel_entries.ocr_propunere` o scrie doar contextul de
 * serviciu, o singură dată (triggerul `alimentari_ocr_garda`, 0213), deci nici
 * un jeton furat, nici un INSERT direct prin PostgREST nu pun o propunere
 * inventată.
 *
 * ── CHEIA ──────────────────────────────────────────────────────────────────
 * Derivată prin HKDF din `TENANT_COOKIE_SECRET`, cu `info` propriu: un jeton nu
 * poate trece drept cookie de firmă și invers. Rotirea secretului invalidează
 * doar jetoanele vii (≤ 2 h), adică o citire de refăcut; propunerile salvate
 * nu mai depind de cheie. Forma HMAC-ului: tiparul din
 * `src/lib/tenant/tenant-cookie.ts`.
 *
 * Forma jetonului: `base64url(JSON)` + `.` + `base64url(HMAC-SHA256)`.
 */
import "server-only";

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { serverEnv } from "@/config/env";
import type { PropunereBon } from "@/domain/fleet/bon-ocr";
import { plafoneazaAvertismente } from "@/domain/fleet/bon-ocr";

const CHEIE = Buffer.from(
  hkdfSync(
    "sha256",
    Buffer.from(serverEnv.TENANT_COOKIE_SECRET, "base64"),
    Buffer.alloc(0),
    "administrativo/ocr-bon/v1",
    32,
  ),
);

export const VALABILITATE_JETON_MS = 2 * 60 * 60 * 1000;

/**
 * Plafonul propunerii semnate. Coloana are `pg_column_size <= 4096`
 * (`fuel_ocr_propunere_ck`, 0213): un 23514 ar pica tot UPDATE-ul de serviciu,
 * deci peste prag se scot avertismentele, nu se aruncă.
 */
export const PLAFON_PROPUNERE_OCTETI = 3500;

/** Ce poartă jetonul și ce ajunge, cu `v` și `cale`, în `ocr_propunere`. */
export type PropunereSemnata = PropunereBon &
  Readonly<{ model: string; citit_la: string; avertismente: readonly string[] }>;

export type LegaturaJeton = Readonly<{
  org: string;
  user: string;
  foaie: string;
  cale: string | null;
}>;

export type VerificareJeton =
  | Readonly<{ stare: "ok"; propunere: PropunereSemnata }>
  | Readonly<{ stare: "expirat" }>
  | Readonly<{ stare: "invalid" }>;

const propunereSchema = z.object({
  alimentat_la: z.string().nullable(),
  litri: z.number().nullable(),
  cost: z.number().nullable(),
  statie: z.string().nullable(),
  numar_bon: z.string().nullable(),
  cui_statie: z.string().nullable(),
  model: z.string(),
  citit_la: z.string(),
  avertismente: z.array(z.string()),
});

const corpSchema = z.object({
  v: z.literal(1),
  org: z.string(),
  user: z.string(),
  foaie: z.string(),
  cale: z.string(),
  exp: z.number(),
  p: propunereSchema,
});

function semnatura(corp: string): Buffer {
  return createHmac("sha256", CHEIE).update(corp, "utf8").digest();
}

export function semneazaPropunere(
  date: Readonly<{
    org: string;
    user: string;
    foaie: string;
    cale: string;
    propunere: PropunereBon;
    model: string;
    avertismente: readonly string[];
  }>,
  acum: Date = new Date(),
): string {
  let p: PropunereSemnata = {
    alimentat_la: date.propunere.alimentat_la,
    litri: date.propunere.litri,
    cost: date.propunere.cost,
    statie: date.propunere.statie,
    numar_bon: date.propunere.numar_bon,
    cui_statie: date.propunere.cui_statie,
    model: date.model.slice(0, 120),
    citit_la: acum.toISOString(),
    avertismente: plafoneazaAvertismente(date.avertismente),
  };
  if (
    Buffer.byteLength(JSON.stringify({ v: 1, ...p, cale: date.cale })) > PLAFON_PROPUNERE_OCTETI
  ) {
    p = { ...p, avertismente: [] };
  }
  const corp = JSON.stringify({
    v: 1,
    org: date.org,
    user: date.user,
    foaie: date.foaie,
    cale: date.cale,
    exp: acum.getTime() + VALABILITATE_JETON_MS,
    p,
  });
  const util = Buffer.from(corp, "utf8").toString("base64url");
  return `${util}.${semnatura(util).toString("base64url")}`;
}

/**
 * `invalid` pe orice nepotrivire: semnătură, formă, firmă, om, foaie sau cale.
 * `expirat` doar pe un jeton altfel valid, mai vechi de 2 ore — acela nu e o
 * greșeală a omului, deci alimentarea se salvează, fără propunere.
 */
export function verificaJeton(
  jeton: string,
  asteptat: LegaturaJeton,
  acum: Date = new Date(),
): VerificareJeton {
  const punct = jeton.indexOf(".");
  if (punct <= 0 || punct !== jeton.lastIndexOf(".") || punct === jeton.length - 1) {
    return { stare: "invalid" };
  }
  const util = jeton.slice(0, punct);
  const primita = Buffer.from(jeton.slice(punct + 1), "base64url");
  const asteptata = semnatura(util);
  // `timingSafeEqual` aruncă pe lungimi diferite: verificarea de lungime vine
  // întâi și nu scurge nimic, lungimea fiind fixă.
  if (primita.length !== asteptata.length || !timingSafeEqual(primita, asteptata)) {
    return { stare: "invalid" };
  }

  let brut: unknown;
  try {
    brut = JSON.parse(Buffer.from(util, "base64url").toString("utf8"));
  } catch {
    return { stare: "invalid" };
  }
  const corp = corpSchema.safeParse(brut);
  if (!corp.success) return { stare: "invalid" };
  const c = corp.data;
  if (
    c.org !== asteptat.org ||
    c.user !== asteptat.user ||
    c.foaie !== asteptat.foaie ||
    asteptat.cale === null ||
    c.cale !== asteptat.cale
  ) {
    return { stare: "invalid" };
  }
  if (acum.getTime() > c.exp) return { stare: "expirat" };
  return { stare: "ok", propunere: c.p };
}
