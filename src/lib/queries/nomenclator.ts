// src/lib/queries/nomenclator.ts
//
// Citirile nomenclatorului dosarelor — Ordin 217/1996 art. 10-11.
//
// ── DE CE NU E PAGINAT ──────────────────────────────────────────────────────
// Restul stratului de citire folosește cursor keyset, fiindcă `max_rows = 1000`
// trunchiază TĂCUT. Aici nu: nomenclatorul e un tabel de câteva zeci de rânduri
// care se citește ÎNTREG, exact ca formularul din anexa nr. 1 pe care îl vede
// inspectorul. Cel implicit are 38 de dosare; o firmă care ajunge la o mie de
// dosare are altă problemă decât paginarea.
//
// Plafonul rămâne totuși explicit, ca trunchierea să nu fie tăcută dacă apare.

import { createServerSupabase } from "@/lib/supabase/server";

/** Peste atât, ecranul spune că lista e trunchiată în loc s-o arate scurtată. */
export const MAX_DOSARE = 500;

export type DosarNomenclator = Readonly<{
  id: string;
  compartimentCifra: string;
  compartimentDenumire: string;
  subdiviziuneLitera: string | null;
  subdiviziuneDenumire: string | null;
  dosarCifra: number;
  continut: string;
  termenPastrare: string;
  indicativ: string;
  /** Tipurile de document care se clasează în dosarul acesta. */
  tipuri: readonly string[];
}>;

export type AvizNomenclator = Readonly<{
  avizatLa: string | null;
  numarAviz: string | null;
  directiaJudeteana: string | null;
  observatii: string | null;
}>;

type DosarBrut = {
  readonly id: string;
  readonly compartiment_cifra: string;
  readonly compartiment_denumire: string;
  readonly subdiviziune_litera: string | null;
  readonly subdiviziune_denumire: string | null;
  readonly dosar_cifra: number;
  readonly continut: string;
  readonly termen_pastrare: string;
  readonly indicativ: string;
};

type TipBrut = { readonly tip_document: string; readonly dosar_id: string };

/**
 * Nomenclatorul întreg, în ordinea din anexa nr. 1: compartimentele în ordinea
 * schemei de organizare, dosarele numerotate de la 1 la fiecare compartiment.
 *
 * Ordonarea pe `compartiment_cifra` e ALFABETICĂ, nu pe valoarea cifrei romane:
 * „II" vine înaintea lui „III", dar „V" vine după „IV" și înaintea lui „VI" —
 * ceea ce e corect pentru I-VIII, singurul interval pe care îl produce
 * nomenclatorul implicit. O firmă care ajunge la „IX" și „X" va vedea ordinea
 * greșită; atunci se sortează în TypeScript, cu o conversie din cifre romane.
 */
export async function citesteNomenclator(
  organizationId: string,
): Promise<readonly DosarNomenclator[]> {
  const db = await createServerSupabase();

  const [dosare, tipuri] = await Promise.all([
    db
      .from("nomenclator_dosare")
      .select(
        "id, compartiment_cifra, compartiment_denumire, subdiviziune_litera, " +
          "subdiviziune_denumire, dosar_cifra, continut, termen_pastrare, indicativ",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("compartiment_cifra", { ascending: true })
      .order("subdiviziune_litera", { ascending: true, nullsFirst: true })
      .order("dosar_cifra", { ascending: true })
      .limit(MAX_DOSARE)
      .returns<DosarBrut[]>(),
    db
      .from("nomenclator_tipuri")
      .select("tip_document, dosar_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .returns<TipBrut[]>(),
  ]);

  if (dosare.error !== null) throw dosare.error;
  if (tipuri.error !== null) throw tipuri.error;

  const peDosar = new Map<string, string[]>();
  for (const t of tipuri.data ?? []) {
    const lista = peDosar.get(t.dosar_id);
    if (lista === undefined) peDosar.set(t.dosar_id, [t.tip_document]);
    else lista.push(t.tip_document);
  }

  return (dosare.data ?? []).map((d) => ({
    id: d.id,
    compartimentCifra: d.compartiment_cifra,
    compartimentDenumire: d.compartiment_denumire,
    subdiviziuneLitera: d.subdiviziune_litera,
    subdiviziuneDenumire: d.subdiviziune_denumire,
    dosarCifra: d.dosar_cifra,
    continut: d.continut,
    termenPastrare: d.termen_pastrare,
    indicativ: d.indicativ,
    tipuri: (peDosar.get(d.id) ?? []).sort((a, b) => a.localeCompare(b, "ro")),
  }));
}

/**
 * Avizul Arhivelor Naționale. Art. 5 lit. a) și art. 11 cer confirmarea
 * nomenclatorului; aplicația nu o poate obține, dar poate arăta că lipsește.
 */
export async function citesteAvizNomenclator(
  organizationId: string,
): Promise<AvizNomenclator | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("nomenclator_config")
    .select("avizat_la, numar_aviz, directia_judeteana, observatii")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<{
      avizat_la: string | null;
      numar_aviz: string | null;
      directia_judeteana: string | null;
      observatii: string | null;
    }>();
  if (error !== null) throw error;
  if (data === null) return null;

  return {
    avizatLa: data.avizat_la,
    numarAviz: data.numar_aviz,
    directiaJudeteana: data.directia_judeteana,
    observatii: data.observatii,
  };
}
