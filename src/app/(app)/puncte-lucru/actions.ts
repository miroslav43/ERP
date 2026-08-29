// src/app/(app)/puncte-lucru/actions.ts
"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { businessRule, mapPostgrestError, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaPunctLucruSchema,
  creeazaPunctLucruSchema,
  dezactiveazaPunctLucruSchema,
  rotesteCodPontajSchema,
} from "@/schemas/punct-lucru";

type PunctLucruIdentificat = Readonly<{ id: string }>;
type CodPontajGenerat = Readonly<{ id: string; cod: string }>;

const CAMPURI_AUDITATE = [
  "denumire",
  "adresa",
  "judet",
  "oras",
  "cod_postal",
  "sediu_principal",
  "observatii",
] as const;

export const creeazaPunctLucru = createAction<
  typeof creeazaPunctLucruSchema,
  PunctLucruIdentificat
>({
  name: "puncte_lucru.create",
  permission: "departments:create",
  minScope: "all",
  input: creeazaPunctLucruSchema,
  audit: {
    action: "create",
    entityType: "puncte_lucru",
    entityId: (_input, data) => data.id,
    allow: CAMPURI_AUDITATE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("puncte_lucru")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        activ: true,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    revalidatePath("/puncte-lucru");
    return { id: data.id };
  },
});

export const actualizeazaPunctLucru = createAction<
  typeof actualizeazaPunctLucruSchema,
  PunctLucruIdentificat
>({
  name: "puncte_lucru.update",
  permission: "departments:update",
  minScope: "all",
  input: actualizeazaPunctLucruSchema,
  audit: {
    action: "update",
    entityType: "puncte_lucru",
    entityId: (input) => input.id,
    allow: CAMPURI_AUDITATE,
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;
    const { data, error } = await db
      .from("puncte_lucru")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) throw notFound("Punctul de lucru nu a fost găsit.");
    revalidatePath("/puncte-lucru");
    return { id };
  },
});

export const dezactiveazaPunctLucru = createAction<
  typeof dezactiveazaPunctLucruSchema,
  PunctLucruIdentificat
>({
  name: "puncte_lucru.deactivate",
  permission: "departments:update",
  minScope: "all",
  input: dezactiveazaPunctLucruSchema,
  audit: {
    action: "update",
    entityType: "puncte_lucru",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    // Dezactivarea unui punct de lucru n-are precondiție de business — nicio
    // tabelă nu-l referă — dar tăcerea tot NU e acceptabilă aici: `activ` nu
    // apare în `USING`-ul lui `puncte_lucru_update`, deci o a doua apăsare
    // atinge din nou același rând. Zero rânduri nu înseamnă niciodată „era deja
    // dezactivat”, ci rând șters logic (`deleted_at is null` în `USING`) sau
    // lipsa lui `departments:update = all`. Un mesaj de reușită acolo ar lăsa
    // punctul de lucru selectabil mai departe.
    const { data: punctDezactivat, error } = await db
      .from("puncte_lucru")
      .update({ activ: false, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (punctDezactivat === null) {
      throw businessRule(
        "Punctul de lucru nu a fost dezactivat: a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    revalidatePath("/puncte-lucru");
    return { id: input.id };
  },
});

/**
 * Reactivarea unui punct de lucru dezactivat.
 *
 * `activ: true` apărea într-un singur loc în tot modulul — la CREARE. Un punct
 * de lucru dezactivat din greșeală rămânea vizibil în listă, cu pastila
 * „Inactiv”, și nu mai exista niciun drum înapoi din interfață: fluxul se putea
 * începe, dar nu se putea desface. Asta face și dezactivarea mai puțin gravă,
 * deci butonul ei nu mai are nevoie de confirmare.
 *
 * Nu are precondiție de business, spre deosebire de dezactivarea unei funcții
 * sau a unui departament: nicio tabelă nu referă `puncte_lucru`, deci nu există
 * nimic de verificat înainte.
 */
export const reactiveazaPunctLucru = createAction<
  typeof dezactiveazaPunctLucruSchema,
  PunctLucruIdentificat
>({
  name: "puncte_lucru.reactivate",
  permission: "departments:update",
  minScope: "all",
  input: dezactiveazaPunctLucruSchema,
  audit: {
    action: "update",
    entityType: "puncte_lucru",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const db = await createServerSupabase();
    // Aceeași grijă ca la dezactivare: `puncte_lucru_update` cere în `USING`
    // `departments:update = all` și `deleted_at is null`, iar un refuz al
    // politicii atinge zero rânduri FĂRĂ eroare. Fără `.select()`, ecranul ar
    // anunța o reactivare care nu s-a produs.
    const { data: reactivat, error } = await db
      .from("puncte_lucru")
      .update({ activ: true, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (reactivat === null) {
      throw businessRule(
        "Punctul de lucru nu a fost reactivat: a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    revalidatePath("/puncte-lucru");
    return { id: input.id };
  },
});

/**
 * Generează sau rotește codul de pe afișul de pontaj al unui punct de lucru.
 *
 * ── DE CE 24 DE OCTEȚI ──────────────────────────────────────────────────────
 * `randomBytes(24)` în `base64url` dă 32 de caractere, adică 192 de biți de
 * entropie. Codul e singura barieră dintre cineva aflat în altă parte și o
 * pontare validă, iar ruta `/portal/ponteaza/[cod]` e publică pentru orice
 * angajat autentificat — deci trebuie să fie neghicibil, nu doar unic.
 * Constrângerea din bază cere între 16 și 64 de caractere.
 *
 * ── ROTIREA INVALIDEAZĂ AFIȘELE VECHI ───────────────────────────────────────
 * E chiar scopul: un afiș fotografiat și trimis pe grupul de WhatsApp se
 * anulează tipărind unul nou. De aceea acțiunea se cheamă „rotește", nu
 * „generează" — cine o apasă trebuie să știe că afișele lipite devin inutile.
 */
export const rotesteCodPontaj = createAction<typeof rotesteCodPontajSchema, CodPontajGenerat>({
  name: "puncte_lucru.rotate_code",
  permission: "departments:update",
  minScope: "all",
  input: rotesteCodPontajSchema,
  audit: {
    action: "update",
    entityType: "puncte_lucru",
    entityId: (input) => input.id,
    // Codul NU intră în audit: e un secret, iar jurnalul de audit e citibil de
    // oricine are `audit:read`. Faptul că a fost rotit e tot ce contează.
    allow: [],
  },
  revalidate: ["/puncte-lucru"],
  handler: async (ctx, input) => {
    const cod = randomBytes(24).toString("base64url");
    const db = await createServerSupabase();
    // `.select()` după `.update()`: `puncte_lucru_update` cere `departments:update
    // = all` în `USING`, iar un refuz al politicii atinge zero rânduri FĂRĂ
    // eroare. Fără el, ecranul ar afișa un cod nou care nu s-a scris nicăieri —
    // iar afișul tipărit după el n-ar funcționa la nimeni.
    const { data, error } = await db
      .from("puncte_lucru")
      .update({ cod_pontaj: cod, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule(
        "Codul nu a fost generat: punctul de lucru a fost șters între timp sau nu aveți dreptul de a modifica structura organizatorică. Reîncărcați pagina.",
      );
    }
    return { id: input.id, cod };
  },
});
