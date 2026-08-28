// src/lib/reges/nomenclatoare.ts
import "server-only";

/**
 * Sincronizează nomenclatoarele naționale REGES în `reges_nomenclatoare`.
 *
 * DE CE OGLINDĂ LOCALĂ ȘI NU APEL LA FIECARE DESCHIDERE DE FORMULAR
 * Sunt ~56 de nomenclatoare, dintre care COR are câteva mii de poziții. Un
 * formular de contract care le-ar cere live ar depinde de disponibilitatea ITM
 * ca să poată fi deschis, iar `?tip=toate` întoarce un răspuns de ordinul
 * megabyte-ului. Se descarcă periodic și se citește din baza noastră.
 *
 * DE CE `.upsert()` MERGE AICI, DEȘI NU MERGE ÎN ALTĂ PARTE
 * Fiindcă indexul unic al tabelei e COMPLET, nu parțial. Peste tot altundeva în
 * proiect unicitatea e `where deleted_at is null`, iar PostgREST nu emite
 * predicatul în `ON CONFLICT` — de unde 42P10 (capcana 7). Tabela asta n-are
 * `deleted_at` deloc: e oglinda unei surse externe, iar o valoare dispărută din
 * amonte devine `activ = false`, nu rând șters.
 */

import type { AdminSupabase } from "@/lib/supabase/admin";
import { cheamaReges, type Mediu } from "./client";
import type { CredentialeReges } from "./credentiale";

/** Câte rânduri se scriu odată. COR are mii de poziții. */
const LOT = 500;

export type RezultatSincronizare =
  Readonly<{ ok: true; tipuri: number; randuri: number }> | Readonly<{ ok: false; mesaj: string }>;

/** Forma unei poziții de nomenclator. Câmpurile diferă de la tip la tip. */
type PozitieBruta = Readonly<Record<string, unknown>>;

function sirSau(valoare: unknown, implicit: string | null = null): string | null {
  return typeof valoare === "string" && valoare.trim() !== "" ? valoare.trim() : implicit;
}

function numarSau(valoare: unknown): number | null {
  return typeof valoare === "number" && Number.isFinite(valoare) ? valoare : null;
}

/**
 * Normalizează o poziție, oricare i-ar fi forma.
 *
 * Cheile diferă între nomenclatoare (`Id`/`id`, `Nume`/`nume`, `Cod`/`cod`), iar
 * documentația nu le enumeră. Se acceptă ambele scrieri și se păstrează
 * originalul întreg în `continut`: ce nu știm azi să citim rămâne acolo, în loc
 * să fie aruncat.
 */
function normalizeaza(tip: string, brut: PozitieBruta) {
  const id = sirSau(brut.id) ?? sirSau(brut.Id);
  const nume = sirSau(brut.nume) ?? sirSau(brut.Nume);
  if (id === null || nume === null) return null;

  return {
    organization_id: null,
    tip,
    reges_id: id,
    cod: sirSau(brut.cod) ?? sirSau(brut.Cod),
    nume,
    versiune: numarSau(brut.versiune) ?? numarSau(brut.Versiune),
    parinte_reges_id: sirSau(brut.parinteId) ?? sirSau(brut.ParinteId) ?? sirSau(brut.judetId),
    activ: true,
    continut: brut as never,
    sincronizat_la: new Date().toISOString(),
  };
}

/**
 * Descarcă toate nomenclatoarele și le scrie local.
 *
 * Răspunsul lui `?tip=toate` e un obiect `{ TipNomenclator: [poziții] }`. Nu e
 * documentat ca atare, deci se acceptă și forma de listă plată cu un câmp de
 * tip — dacă niciuna nu se potrivește, se raportează, nu se ghicește.
 */
export async function sincronizeazaNomenclatoare(
  db: AdminSupabase,
  cred: CredentialeReges,
  jeton: string,
): Promise<RezultatSincronizare> {
  const raspuns = await cheamaReges<unknown>({
    mediu: cred.mediu as Mediu,
    cale: "/api/Nomenclator",
    metoda: "GET",
    jeton,
    parametri: { tip: "toate" },
  });

  if (!raspuns.ok) return { ok: false, mesaj: raspuns.mesaj };
  if (typeof raspuns.date !== "object" || raspuns.date === null) {
    return { ok: false, mesaj: "Nomenclatoarele au venit într-o formă nerecunoscută." };
  }

  const peTipuri = raspuns.date as Record<string, unknown>;
  let tipuri = 0;
  let randuri = 0;

  for (const [tip, pozitii] of Object.entries(peTipuri)) {
    if (!Array.isArray(pozitii)) continue;
    tipuri += 1;

    const deScris = pozitii
      .map((p) => normalizeaza(tip, p as PozitieBruta))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    for (let i = 0; i < deScris.length; i += LOT) {
      const { error } = await db
        .from("reges_nomenclatoare")
        .upsert(deScris.slice(i, i + LOT), { onConflict: "organization_id,tip,reges_id" });
      if (error !== null) return { ok: false, mesaj: error.message };
      randuri += Math.min(LOT, deScris.length - i);
    }
  }

  if (tipuri === 0) {
    return { ok: false, mesaj: "Răspunsul nu conținea niciun nomenclator." };
  }
  return { ok: true, tipuri, randuri };
}

/** Pozițiile active dintr-un nomenclator, pentru listele derulante. */
export async function citesteNomenclator(
  db:
    | AdminSupabase
    | Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerSupabase>>,
  tip: string,
  organizationId: string | null = null,
): Promise<readonly Readonly<{ id: string; cod: string | null; nume: string }>[]> {
  const cerere = db
    .from("reges_nomenclatoare")
    .select("reges_id, cod, nume")
    .eq("tip", tip)
    .eq("activ", true)
    .order("nume", { ascending: true })
    // Sub `max_rows = 1000` al PostgREST-ului, care TRUNCHIAZĂ TĂCUT: COR-ul are
    // mii de poziții, deci listele lungi se caută, nu se derulează.
    .limit(500);

  const { data, error } =
    organizationId === null
      ? await cerere.is("organization_id", null)
      : await cerere.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
  if (error !== null) throw error;
  return (data ?? []).map((r) => ({ id: r.reges_id, cod: r.cod, nume: r.nume }));
}
