// src/app/(app)/flota/carduri/tranzactii/actions.ts
"use server";

/**
 * Reconcilierea tranzacțiilor de card (0214, F12b): recalcularea potrivirilor
 * pe o lună, legarea manuală de o alimentare declarată, ignorarea motivată.
 *
 * Toate cer `vehicles:update = all`, poarta `tranzactii_card_update`. Datele din
 * extras sunt imuabile (trigger): aici se schimbă doar legătura, starea și nota.
 * Fiecare UPDATE are `.select()`: un rând respins de USING întoarce zero
 * rânduri, fără eroare, iar asta e CONFLICT, nu reușită.
 *
 * NU sunt aici, până la răspunsul lui Miro: „Adaugă pe foaie” ([DECIZIA-2c],
 * implicita I-b2: doar raport) și „Trece la cheltuieli” ([DECIZIA-4c], implicita
 * I-b4: tranzacțiile care nu sunt combustibil rămân în raport).
 *
 * „use server”: se exportă DOAR funcții async (capcana 39).
 */

import { potrivesteTranzactii, type TranzactieDePotrivit } from "@/domain/fleet/carduri/potrivire";
import { intervalLuna } from "@/domain/fleet/rapoarte";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput } from "@/lib/actions/errors";
import {
  alimentareCuFoaie,
  cardurilePentruPotrivire,
  citesteTranzactie,
  contextPotrivire,
  tranzactiiDeRepotrivit,
} from "@/lib/queries/fleet-carduri";
import {
  ignoraTranzactieSchema,
  leagaTranzactieSchema,
  repotrivesteSchema,
} from "@/schemas/fleet-carduri";

import { traduEroareCarduri } from "../erori";

const CAI = ["/flota/carduri/tranzactii"] as const;
const MESAJ_CONFLICT =
  "Tranzacția s-a schimbat între timp sau a fost anulată odată cu importul. Reîncărcați pagina.";

export const repotrivesteTranzactii = createAction({
  name: "fleet.card_tx.rematch",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: repotrivesteSchema,
  audit: {
    action: "update",
    entityType: "fuel_card_transactions",
    allow: ["luna"],
  },
  revalidate: CAI,
  handler: async (ctx, input): Promise<Readonly<{ verificate: number; schimbate: number }>> => {
    const org = ctx.tenant.organizationId;
    const toate = await tranzactiiDeRepotrivit(org, input.luna);
    const { deLa, panaLa } = intervalLuna(input.luna);
    const [carduri, context] = await Promise.all([
      cardurilePentruPotrivire(org),
      contextPotrivire(org, deLa, panaLa),
    ]);
    const alimentariVii = new Set(context.alimentari.map((a) => a.id));

    /*
     * Care se repotrivesc: tot ce nu e potrivit sau ignorat, plus legăturile
     * spre o alimentare ștearsă logic între timp (FK-ul `set null` nu se
     * activează la `deleted_at`). O legătură `potrivita` vie rămâne neatinsă:
     * poate fi una făcută de mână, pe care automatul n-o mai poate reface.
     */
    const deRefacut = toate.filter(
      (t) =>
        t.stare_potrivire !== "potrivita" ||
        (t.fuel_entry_id !== null && !alimentariVii.has(t.fuel_entry_id)),
    );
    const idRefacute = new Set(deRefacut.map((t) => t.id));
    // Legăturile ținute de rândurile care NU se refac rămân ocupate.
    const ocupate = new Set(
      [...context.legaturi.entries()]
        .filter(([, txId]) => !idRefacute.has(txId))
        .map(([alimentare]) => alimentare),
    );
    const cardDupaId = new Map(carduri.map((c) => [c.id, c]));

    const deFacut: TranzactieDePotrivit[] = deRefacut.map((t) => {
      const card = t.card_id === null ? undefined : cardDupaId.get(t.card_id);
      return {
        emitent: t.emitent,
        // Un card deja recunoscut se păstrează (cifrele lui, amprenta lui).
        cifreCard: card?.ultimele_cifre ?? t.card_ultimele_cifre,
        amprentaCard: card?.amprenta_numar ?? null,
        nrInmatriculare: t.nr_inmatriculare_extras,
        efectuatLa: t.efectuat_la,
        dataRo: t.data_ro ?? "",
        areOra: t.are_ora,
        categorie: t.categorie,
        tipCombustibil:
          t.tip_combustibil === "benzina" ||
          t.tip_combustibil === "motorina" ||
          t.tip_combustibil === "gpl" ||
          t.tip_combustibil === "gnc"
            ? t.tip_combustibil
            : null,
        cantitate: t.cantitate,
        valoareBruta: t.valoare_bruta,
        moneda: t.moneda,
        kmDeclarat: t.km_declarat,
        numarBon: t.numar_bon,
      };
    });
    const rezultate = potrivesteTranzactii(deFacut, {
      carduri,
      vehicule: context.vehicule,
      alocari: context.alocari,
      foi: context.foi,
      alimentari: context.alimentari,
      alimentariDejaLegate: ocupate,
    });

    let schimbate = 0;
    for (const [i, t] of deRefacut.entries()) {
      const r = rezultate[i];
      if (r === undefined) continue;
      const neschimbat =
        r.stare === t.stare_potrivire &&
        r.cardId === t.card_id &&
        r.vehicleId === t.vehicle_id &&
        r.tripSheetId === t.trip_sheet_id &&
        r.fuelEntryId === t.fuel_entry_id &&
        r.motiv === t.motiv;
      if (neschimbat) continue;
      const { data, error } = await ctx.supabase
        .from("fuel_card_transactions")
        .update({
          card_id: r.cardId,
          vehicle_id: r.vehicleId,
          trip_sheet_id: r.tripSheetId,
          fuel_entry_id: r.fuelEntryId,
          stare_potrivire: r.stare,
          categorie: r.categorie,
          motiv: r.motiv,
          updated_by: ctx.user.id,
        })
        .eq("id", t.id)
        .eq("organization_id", org)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error !== null) traduEroareCarduri(error);
      if (data === null) throw businessRule(MESAJ_CONFLICT);
      schimbate += 1;
    }
    return { verificate: deRefacut.length, schimbate };
  },
});

export const leagaTranzactie = createAction({
  name: "fleet.card_tx.link",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: leagaTranzactieSchema,
  audit: {
    action: "update",
    entityType: "fuel_card_transactions",
    entityId: (input) => input.id,
    allow: ["id", "fuel_entry_id"],
  },
  revalidate: CAI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const org = ctx.tenant.organizationId;
    const [tx, alimentare] = await Promise.all([
      citesteTranzactie(org, input.id),
      alimentareCuFoaie(org, input.fuel_entry_id),
    ]);
    if (tx === null) throw businessRule(MESAJ_CONFLICT);
    if (tx.categorie !== "combustibil") {
      throw businessRule("Doar tranzacțiile de combustibil se leagă de o alimentare de pe foaie.");
    }
    const foaie = alimentare?.foaie ?? null;
    if (alimentare === null || foaie === null) {
      const mesaj = "Alimentarea aleasă nu mai există pe foaie.";
      throw invalidInput(mesaj, { fuel_entry_id: [mesaj] });
    }
    if (
      foaie.data !== tx.data_ro ||
      (tx.vehicle_id !== null && foaie.vehicle_id !== tx.vehicle_id)
    ) {
      const mesaj = "Alimentarea aleasă nu e pe foaia aceluiași vehicul, din ziua tranzacției.";
      throw invalidInput(mesaj, { fuel_entry_id: [mesaj] });
    }
    // Foaia și vehiculul le pune triggerul, din alimentare; aici doar legătura.
    const { data, error } = await ctx.supabase
      .from("fuel_card_transactions")
      .update({
        fuel_entry_id: alimentare.id,
        stare_potrivire: "potrivita",
        motiv: "Legată manual.",
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", org)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareCarduri(error);
    if (data === null) throw businessRule(MESAJ_CONFLICT);
    return { id: data.id };
  },
});

export const ignoraTranzactie = createAction({
  name: "fleet.card_tx.ignore",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: ignoraTranzactieSchema,
  audit: {
    action: "update",
    entityType: "fuel_card_transactions",
    entityId: (input) => input.id,
    // Nota NU intră în audit: poate numi un om („suspiciune: …”).
    allow: ["id"],
  },
  revalidate: CAI,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Ignorarea desface o eventuală legătură (`fctx_stare_ck`: doar
    // `potrivita`/`diferenta` au alimentare).
    const { data, error } = await ctx.supabase
      .from("fuel_card_transactions")
      .update({
        stare_potrivire: "ignorata",
        fuel_entry_id: null,
        nota: input.nota,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareCarduri(error);
    if (data === null) throw businessRule(MESAJ_CONFLICT);
    return { id: data.id };
  },
});
