// src/lib/asistent/unelte/flota/scadente-flota.ts
/**
 * „Ce documente expiră?”, „când expiră RCA-ul la B123ABC?”.
 *
 * Citește sub RLS-ul celui care întreabă, din `vehicle_documents` (nu din
 * `expirables`, care îi dă zero rânduri lui manager și angajatului). Fiecare
 * secțiune se adaugă DOAR dacă rolul o poate citi, iar fraza de final pomenește
 * doar ce s-a verificat: „n-au niciun document care să expire” nu e „au totul în
 * regulă”, iar un angajat care nu vede reviziile nu află că „nu are revizii”.
 *
 *  - documentele care expiră (orice rol cu `vehicles:read`);
 *  - F6: tipurile obligatorii lipsă, după categoria și masa vehiculului;
 *  - F7: reviziile scadente pe dată sau pe kilometri (`vehicles:read >= team`);
 *  - F11: termenele de răspuns la amenzi (`vehicle_fines:read = all`).
 */
import "server-only";

import { z } from "zod";

import { meetsScope } from "@/config/permissions";
import { raspunsInAsteptare } from "@/domain/fleet/amenzi";
import { PRAG_FLOTA_AVERTIZARE_ZILE, tipuriObligatoriiPentru } from "@/domain/fleet/scadente";
import { stareaPlanului } from "@/domain/fleet/service";
import { formatNumar, textNumarat } from "@/lib/format/numar";
import { tipuriDocument } from "@/lib/queries/fleet";
import {
  amenziCuTermen,
  documenteCurente,
  planuriServiceActive,
  vehiculeFirmei,
  type VehiculScurt,
} from "@/lib/queries/flota-asistent";

import type { ContextUnealta, RezultatUnealta, Unealta } from "../tip";
import { ordoneazaScadente, type Scadenta } from "./calcul";
import {
  ARGUMENTE_NEVALIDE,
  MAX_RANDURI,
  NR_MINIM_CARACTERE,
  VEHICUL_NEGASIT,
  destinatieVehicul,
  normalizeazaNr,
  peZiua,
  plafoneaza,
  pragZile,
  referintaParc,
  referintePermise,
} from "./comun";

const parametri = z.object({
  zile: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      `Orizontul, în zile de la azi. Implicit ${String(PRAG_FLOTA_AVERTIZARE_ZILE)}, pragul de avertizare al flotei.`,
    ),
  nr_inmatriculare: z
    .string()
    .min(2)
    .max(16)
    .optional()
    .describe("Numărul de înmatriculare, întreg sau o parte din el. Lipsește = tot parcul."),
});

/** O scadență cu textul ei deja scris, legată de vehiculul la care trimite pastila. */
type Rand = Scadenta & Readonly<{ fel: "document" | "lipsa" | "revizie" | "amenda"; text: string }>;

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const parsat = parametri.safeParse(argument);
  if (!parsat.success) return ARGUMENTE_NEVALIDE;
  const zile = parsat.data.zile ?? PRAG_FLOTA_AVERTIZARE_ZILE;
  const azi = context.aziISO;
  const prag = pragZile(azi, zile);

  const cautat =
    parsat.data.nr_inmatriculare === undefined
      ? null
      : normalizeazaNr(parsat.data.nr_inmatriculare);
  if (cautat !== null && cautat.length < NR_MINIM_CARACTERE) {
    return {
      text: "Numărul de înmatriculare dat nu conține destule litere și cifre ca să-l caut.",
    };
  }

  // În parc = activ ȘI în service: RCA-ul unei mașini aflate la reparat expiră la fel.
  const vehicule = (await vehiculeFirmei(context.organizationId)).filter(
    (v) =>
      v.status !== "vandut" &&
      v.status !== "casat" &&
      (cautat === null || v.nr_inmatriculare.includes(cautat)),
  );
  if (vehicule.length === 0) {
    return cautat === null
      ? {
          text: "Nu vezi niciun vehicul aflat în parc.",
          referinte: referintePermise(context, [referintaParc(context.zona)]),
        }
      : {
          text: VEHICUL_NEGASIT,
          referinte: referintePermise(context, [referintaParc(context.zona)]),
        };
  }

  const ids = vehicule.map((v) => v.id);
  const poateRevizii = meetsScope(context.permisiuni.get("vehicles:read"), "team");
  const poateAmenzi = meetsScope(context.permisiuni.get("vehicle_fines:read"), "all");
  const [documente, tipuri, planuri, amenzi] = await Promise.all([
    documenteCurente(context.organizationId, ids),
    tipuriDocument(context.organizationId),
    poateRevizii ? planuriServiceActive(context.organizationId, ids) : Promise.resolve(null),
    poateAmenzi ? amenziCuTermen(context.organizationId, prag) : Promise.resolve(null),
  ]);

  const denumire = new Map(tipuri.map((t) => [t.id, t.denumire]));
  const randuri: Rand[] = [];

  for (const d of documente) {
    if (d.expira_la === null || d.expira_la > prag) continue;
    const ce = denumire.get(d.document_type_id) ?? "Documentul";
    const verb = d.expira_la < azi ? "a expirat" : "expiră";
    randuri.push({
      fel: "document",
      vehicleId: d.vehicle_id,
      ce,
      data: d.expira_la,
      text: `${ce} ${verb} ${peZiua(azi, d.expira_la)}`,
    });
  }

  // F6: tipurile obligatorii pentru categoria și masa vehiculului, fără niciun
  // document curent. Aceeași regulă ca semaforul listei (`tipuriObligatoriiPentru`).
  const tipuriPeVehicul = new Map<string, Set<string>>();
  for (const d of documente) {
    const set = tipuriPeVehicul.get(d.vehicle_id) ?? new Set<string>();
    set.add(d.document_type_id);
    tipuriPeVehicul.set(d.vehicle_id, set);
  }
  for (const v of vehicule) {
    const are = tipuriPeVehicul.get(v.id) ?? new Set<string>();
    for (const tipId of tipuriObligatoriiPentru(v, tipuri)) {
      if (are.has(tipId)) continue;
      const ce = denumire.get(tipId) ?? "un document obligatoriu";
      randuri.push({
        fel: "lipsa",
        vehicleId: v.id,
        ce,
        data: null,
        text: `lipsește documentul obligatoriu „${ce}”`,
      });
    }
  }

  // F7: scadența pe dată (în orizontul cerut) sau pe kilometri (în pragul planului).
  const kmPeVehicul = new Map(vehicule.map((v) => [v.id, v.km_curent]));
  for (const p of planuri ?? []) {
    const km = kmPeVehicul.get(p.vehicle_id);
    if (km === undefined) continue;
    const verdict = stareaPlanului(p, azi, km);
    if (p.urmatoarea_data !== null && p.urmatoarea_data <= prag) {
      const verb = p.urmatoarea_data < azi ? "a fost scadentă" : "e scadentă";
      randuri.push({
        fel: "revizie",
        vehicleId: p.vehicle_id,
        ce: p.denumire,
        data: p.urmatoarea_data,
        text: `revizia „${p.denumire}” ${verb} ${peZiua(azi, p.urmatoarea_data)}`,
      });
    } else if (
      verdict.kmRamasi !== null &&
      p.urmatorii_km !== null &&
      verdict.kmRamasi <= p.prag_avertizare_km
    ) {
      const rest =
        verdict.kmRamasi <= 0
          ? `depășită cu ${formatNumar(-verdict.kmRamasi)} km`
          : `mai sunt ${formatNumar(verdict.kmRamasi)} km`;
      randuri.push({
        fel: "revizie",
        vehicleId: p.vehicle_id,
        ce: p.denumire,
        data: null,
        kmRamasi: verdict.kmRamasi,
        text: `revizia „${p.denumire}” la ${formatNumar(p.urmatorii_km)} km: ${rest}`,
      });
    }
  }

  // F11: răspunsul către autoritate (art. 39), cât timp n-a plecat.
  const inLista = new Set(ids);
  for (const a of amenzi ?? []) {
    if (!inLista.has(a.vehicle_id) || a.termen_raspuns === null) continue;
    if (!raspunsInAsteptare(a.stadiu, a.raspuns_trimis_la)) continue;
    const verb = a.termen_raspuns < azi ? "a trecut" : "e";
    randuri.push({
      fel: "amenda",
      vehicleId: a.vehicle_id,
      ce: `PV ${a.numar_pv}`,
      data: a.termen_raspuns,
      text: `termenul de răspuns la amenda cu PV ${a.numar_pv} ${verb} ${peZiua(azi, a.termen_raspuns)}`,
    });
  }

  return compune(context, vehicule, ordoneazaScadente(randuri, azi), zile, {
    revizii: planuri !== null,
    amenzi: amenzi !== null,
  });
}

function compune(
  context: ContextUnealta,
  vehicule: readonly VehiculScurt[],
  randuri: readonly Rand[],
  zile: number,
  verificat: Readonly<{ revizii: boolean; amenzi: boolean }>,
): RezultatUnealta {
  const dupaId = new Map(vehicule.map((v) => [v.id, v]));
  const scrise = randuri.flatMap((r) => {
    const v = dupaId.get(r.vehicleId);
    if (v === undefined) return [];
    const nota = v.status === "in_service" ? " (în service acum)" : "";
    return [{ v, linie: `- ${v.nr_inmatriculare}${nota}: ${r.text} → vehicul.${v.id}` }];
  });
  const afisate = plafoneaza(scrise.map((s) => s.linie));
  // Pastilele doar pentru rândurile ARĂTATE: un vehicul din „…și încă N” n-are
  // identificator în text, deci n-are ce destinație să primească.
  const vazute = new Set(scrise.slice(0, MAX_RANDURI).map((s) => s.v.id));

  const cuScadente = new Set(randuri.map((r) => r.vehicleId));
  const faraNimic = vehicule.filter((v) => !cuScadente.has(v.id)).length;
  // Fraza de final spune DOAR ce s-a verificat pentru rolul ăsta.
  const ce = ["niciun document care să expire în următoarele " + textNumarat(zile, "zi", "zile")];
  ce.push("niciun document obligatoriu lipsă");
  if (verificat.revizii) ce.push("nicio revizie scadentă");
  if (verificat.amenzi) ce.push("niciun termen de răspuns la amenzi");
  const coada =
    faraNimic === 0
      ? ""
      : `\n\n${textNumarat(faraNimic, "vehicul", "vehicule")} din cele la care ai acces ${faraNimic === 1 ? "nu are" : "nu au"} ${listaRomana(ce)}.`;

  const antet =
    randuri.length === 0
      ? `Nicio scadență în următoarele ${textNumarat(zile, "zi", "zile")}, pe vehiculele la care ai acces.`
      : `Scadențele din următoarele ${textNumarat(zile, "zi", "zile")} (întâi ce a trecut deja):`;

  const efemere = vehicule
    .filter((v) => vazute.has(v.id))
    .map((v) => destinatieVehicul(context.zona, v.id, v.nr_inmatriculare));

  const referinte = referintePermise(context, [
    referintaParc(context.zona),
    ...(randuri.some((r) => r.fel === "amenda") ? ["flota.amenzi"] : []),
  ]);

  return {
    text: `${antet}${afisate.length === 0 ? "" : `\n${afisate.join("\n")}`}${coada}`,
    referinte,
    destinatiiEfemere: efemere,
  };
}

/** „a, b și c”. */
function listaRomana(parti: readonly string[]): string {
  if (parti.length <= 1) return parti.join("");
  return `${parti.slice(0, -1).join(", ")} și ${parti.at(-1) ?? ""}`;
}

export const unealtaScadenteFlota: Unealta = {
  nume: "scadente_flota",
  descriere:
    "Documentele vehiculelor (RCA, ITP, rovinietă și celelalte) care au expirat sau expiră curând, documentele obligatorii lipsă și, dacă rolul le vede, reviziile și termenele de răspuns la amenzi. Pentru tot parcul sau pentru un număr de înmatriculare.",
  parametri,
  featureKey: "fleet",
  permission: "vehicles:read",
  minScope: "own",
  executa,
};
