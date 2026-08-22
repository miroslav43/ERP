#!/usr/bin/env node
/**
 * Creează un cont de administrator de platformă — și NIMIC altceva.
 *
 * Contul NU primește rând în `organization_members`. Asta e chiar rostul lui:
 * super-adminul controlează platforma (ce firme există, ce module au pornite,
 * înregistrări), nu operează vreo firmă. Cine e și una și alta comută explicit
 * din antetul consolei.
 *
 * E script, nu migrare: e un fapt de DATE, nu de schemă. O migrare care
 * inserează un utilizator anume ar rula pe orice mediu și ar acorda drepturi de
 * platformă unde nu trebuie.
 *
 * Vorbește direct cu API-ul, prin `fetch`, în loc de `@supabase/supabase-js`.
 * Motivul e practic: clientul JS instanțiază eager un client de realtime care
 * cere WebSocket nativ, adică Node 22+. VM-ul are Node 20, iar scriptul n-are
 * nicio nevoie de realtime — s-ar fi oprit înainte să facă ceva util.
 *
 * Idempotent: rulat de două ori pe aceeași adresă nu duplică nimic.
 *
 * Rulare:
 *   node scripts/creeaza-super-admin.mjs <email>
 */
import { readFileSync } from "node:fs";

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Utilizare: node scripts/creeaza-super-admin.mjs <email>");
  process.exit(1);
}

// Citim `.env.production` direct: scriptul e o unealtă de operare, rulată din
// afara aplicației, deci nu trece prin validarea din `src/config/env.ts`.
const mediu = Object.fromEntries(
  readFileSync(new URL("../.env.production", import.meta.url), "utf8")
    .split("\n")
    .filter((linie) => linie.trim() && !linie.trimStart().startsWith("#"))
    .map((linie) => {
      const taiere = linie.indexOf("=");
      return [
        linie.slice(0, taiere).trim(),
        linie
          .slice(taiere + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);

const BAZA = mediu.NEXT_PUBLIC_SUPABASE_URL;
// service_role: crearea unui utilizator și scrierea în `platform_admins` sunt
// operațiuni de platformă, imposibile sub RLS-ul unui utilizator obișnuit.
const CHEIE = mediu.SUPABASE_SERVICE_ROLE_KEY;
const ANTETE = { apikey: CHEIE, Authorization: `Bearer ${CHEIE}` };

async function cere(cale, optiuni = {}) {
  const raspuns = await fetch(`${BAZA}${cale}`, {
    ...optiuni,
    headers: { ...ANTETE, "Content-Type": "application/json", ...optiuni.headers },
  });
  const text = await raspuns.text();
  const corp = text ? JSON.parse(text) : null;
  if (!raspuns.ok) {
    const mesaj = corp?.msg ?? corp?.message ?? corp?.error_description ?? text;
    throw new Error(`${optiuni.method ?? "GET"} ${cale} → ${raspuns.status}: ${mesaj}`);
  }
  return corp;
}

try {
  // ── 1. Contul de autentificare ────────────────────────────────────────────
  const lista = await cere("/auth/v1/admin/users?per_page=1000");
  let utilizator = (lista.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (utilizator) {
    console.log(`•  Contul ${email} există deja (${utilizator.id}).`);
  } else {
    utilizator = await cere("/auth/v1/invite", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    console.log(`✓  Invitație trimisă către ${email} (${utilizator.id}).`);
    console.log("   Din e-mail își setează parola; linkul duce în /auth/callback.");
  }

  // ── 2. Accesul de platformă ───────────────────────────────────────────────
  const existente = await cere(
    `/rest/v1/platform_admins?select=id,revoked_at&user_id=eq.${utilizator.id}`,
  );
  const existent = existente[0];

  if (existent && existent.revoked_at === null) {
    console.log("•  Are deja acces de platformă activ. Nimic de făcut.");
  } else if (existent) {
    await cere(`/rest/v1/platform_admins?id=eq.${existent.id}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: null, revoked_by: null }),
    });
    console.log("✓  Acces de platformă reactivat.");
  } else {
    await cere("/rest/v1/platform_admins", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: utilizator.id, motiv: "cont propriu de super-admin" }),
    });
    console.log("✓  Acces de platformă acordat.");
  }

  // ── 3. Confirmă că e un cont de platformă PUR ─────────────────────────────
  const apartenente = await cere(
    `/rest/v1/organization_members?select=organization_id,role&user_id=eq.${utilizator.id}`,
  );
  if (apartenente.length > 0) {
    console.warn(
      `⚠  Contul are ${apartenente.length} apartenențe la firme ` +
        `(${apartenente.map((a) => a.role).join(", ")}). Un super-admin pur n-ar trebui să aibă niciuna.`,
    );
  } else {
    console.log("✓  Nicio apartenență la vreo firmă — cont de platformă pur.");
  }
} catch (eroare) {
  console.error("✗ ", eroare.message);
  process.exit(1);
}
