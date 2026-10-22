// src/lib/asistent/unelte/flota/consum-norma.ts
/**
 * „Cât a consumat B123ABC față de normă în septembrie?”
 *
 * ── O SINGURĂ CIFRĂ, CU RAPORTUL (D5, D9) ───────────────────────────────────
 * Citirea și formula sunt ale rapoartelor F8: `foiAprobateLuna` (foile APROBATE
 * ale lunii, cu alimentările lor, prin `citesteTot`) și `consumPeVehicul`
 * (real = Σ litri / Σ km; norma = media ponderată cu km a instantaneelor de pe
 * foi). Asistentul nu are voie să dea altă cifră decât `/flota/rapoarte` pe
 * aceeași lună. Singurul adaos: pe foile vechi fără instantaneu de normă, norma
 * de rezervă (`cuNormaDeRezerva`), în precedența cu care 0205 fixează
 * instantaneul.
 *
 * Foile trimise și neaprobate nu intră în cifră (decizia I-e6), dar se numără:
 * un total mic nu trebuie luat drept un consum mic.
 *
 * ── VIZIBILITATEA (`team`) ──────────────────────────────────────────────────
 * Un manager vede doar foile echipei. Pe o mașină de pool condusă și de alții,
 * „consumul vehiculului” ar fi fals; textul spune deci „pe foile echipei tale”.
 */
import "server-only";

import { z } from "zod";

import { abatereNotabila } from "@/domain/fleet/consum";
import {
  consumPeVehicul,
  ETICHETA_VEHICUL_STERS,
  etichetaLuna,
  intervalLuna,
} from "@/domain/fleet/rapoarte";
import { meetsScope } from "@/config/permissions";
import { formatNumar, textNumarat } from "@/lib/format/numar";
import { vehiculeDupaId } from "@/lib/queries/fleet";
import { foiAprobateLuna } from "@/lib/queries/fleet-rapoarte";
import { foiInInterval, normeConsum } from "@/lib/queries/flota-asistent";

import type { ContextUnealta, RezultatUnealta, Unealta } from "../tip";
import { cuNormaDeRezerva, KM_MINIM_ORIENTATIV, type NormaPerioada } from "./calcul";
import {
  ARGUMENTE_NEVALIDE,
  MAX_RANDURI,
  NR_MINIM_CARACTERE,
  destinatieVehicul,
  lunaCeruta,
  lunaInViitor,
  normalizeazaNr,
  plafoneaza,
  referintePermise,
} from "./comun";

const parametri = z.object({
  an: z.number().int().min(2020).max(2100).optional().describe("Anul. Implicit, anul curent."),
  luna: z.number().int().min(1).max(12).optional().describe("Luna, 1–12. Implicit, luna curentă."),
  nr_inmatriculare: z
    .string()
    .min(2)
    .max(16)
    .optional()
    .describe("Numărul de înmatriculare, întreg sau o parte din el. Lipsește = toate vehiculele."),
});

export const AVERTISMENT_ATRIBUIRE =
  "Combustibilul e atribuit foii pe care s-a alimentat, deci cifra lunară e o aproximare.";

const VEHICUL_FARA_NUMAR = "vehicul fără număr vizibil";

const procente = (p: number): string => `${p > 0 ? "+" : ""}${formatNumar(Math.round(p))}%`;
const zecimala = (n: number): string => formatNumar(Math.round(n * 10) / 10);

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const parsat = parametri.safeParse(argument);
  if (!parsat.success) return ARGUMENTE_NEVALIDE;
  const luna = lunaCeruta(context.aziISO, parsat.data.an, parsat.data.luna);
  if (lunaInViitor(luna, context.aziISO)) {
    return { text: `Luna ${etichetaLuna(luna)} n-a început încă.` };
  }
  const cautat =
    parsat.data.nr_inmatriculare === undefined
      ? null
      : normalizeazaNr(parsat.data.nr_inmatriculare);
  if (cautat !== null && cautat.length < NR_MINIM_CARACTERE) {
    return {
      text: "Numărul de înmatriculare dat nu conține destule litere și cifre ca să-l caut.",
    };
  }

  const interval = intervalLuna(luna);
  const toate = meetsScope(context.permisiuni.get("trip_sheets:read"), "all");
  const peCe = toate ? "pe toate foile aprobate" : "pe foile echipei tale";

  const [aprobate, trimise] = await Promise.all([
    foiAprobateLuna(context.organizationId, interval, null),
    foiInInterval(context.organizationId, interval.deLa, interval.panaLa, {
      statusuri: ["trimis"],
    }),
  ]);
  const idVehicule = [...new Set([...aprobate, ...trimise].map((f) => f.vehicle_id))];
  // Normele F10 le vede doar `vehicles:read = all`; altfel rezerva e consumul declarat.
  const [vehicule, norme] = await Promise.all([
    vehiculeDupaId(context.organizationId, idVehicule),
    meetsScope(context.permisiuni.get("vehicles:read"), "all")
      ? normeConsum(context.organizationId, idVehicule)
      : Promise.resolve([]),
  ]);

  // Numărul: cel de azi al vehiculului vizibil, altfel instantaneul de pe foaie.
  const numarFoii = new Map<string, string>();
  for (const f of aprobate) {
    if (f.vehicul_nr !== null && !numarFoii.has(f.vehicle_id))
      numarFoii.set(f.vehicle_id, f.vehicul_nr);
  }
  const numarul = (id: string): string | null =>
    vehicule.get(id)?.nr_inmatriculare ?? numarFoii.get(id) ?? null;
  const potrivit = (id: string): boolean =>
    cautat === null || normalizeazaNr(numarul(id) ?? "").includes(cautat);

  const foi = aprobate.filter((f) => potrivit(f.vehicle_id));
  const trimisePeVehicul = new Map<string, number>();
  for (const f of trimise) {
    if (!potrivit(f.vehicle_id)) continue;
    trimisePeVehicul.set(f.vehicle_id, (trimisePeVehicul.get(f.vehicle_id) ?? 0) + 1);
  }
  const totalTrimise = [...trimisePeVehicul.values()].reduce((s, n) => s + n, 0);
  const notaTrimise =
    totalTrimise === 0
      ? ""
      : totalTrimise === 1
        ? " Mai e o foaie trimisă și neaprobată încă, care nu intră în cifră."
        : ` Mai sunt ${textNumarat(totalTrimise, "foaie", "foi")} trimise și neaprobate încă, care nu intră în cifră.`;

  if (foi.length === 0) {
    const ce = cautat === null ? "" : ` pe un vehicul cu „${cautat}” în număr`;
    return {
      text: `În ${etichetaLuna(luna)} nu e nicio foaie aprobată${ce}${toate ? "" : " printre foile echipei tale"}.${notaTrimise}`,
      referinte: referintePermise(context, ["flota.foi"]),
    };
  }

  const normePeVehicul = new Map<string, NormaPerioada[]>();
  for (const n of norme) {
    const lista = normePeVehicul.get(n.vehicle_id) ?? [];
    lista.push(n);
    normePeVehicul.set(n.vehicle_id, lista);
  }
  const declarat = new Map([...vehicule.values()].map((v) => [v.id, v.consum_mediu_declarat]));
  const completate = cuNormaDeRezerva(foi, normePeVehicul, declarat);

  const etichete = new Map<string, string>();
  for (const id of idVehicule) {
    const nr = numarul(id);
    if (nr !== null) etichete.set(id, nr);
  }
  const randuri = consumPeVehicul(completate.foi, etichete);

  const linii = randuri.map((r) => {
    const nume = r.vehicul === ETICHETA_VEHICUL_STERS ? VEHICUL_FARA_NUMAR : r.vehicul;
    const cantitate = `${formatNumar(r.km)} km, ${zecimala(r.litri)} ${r.unitate}`;
    const real =
      r.consumReal === null
        ? r.litri === 0
          ? "fără alimentări pe foi"
          : "fără kilometri pe foi"
        : `${zecimala(r.consumReal)} ${r.unitate}/100 km`;
    let fataDeNorma: string;
    if (r.normaMedie === null) {
      fataDeNorma = `, fără normă declarată pe ${textNumarat(r.foiFaraNorma, "foaie", "foi")}, deci abaterea nu se calculează`;
    } else if (r.abatere === null) {
      fataDeNorma = `; norma ${zecimala(r.normaMedie)}`;
    } else {
      const ab = ` față de norma ${zecimala(r.normaMedie)} (${procente(r.abatere)})`;
      fataDeNorma = abatereNotabila(r.abatere) ? ` **${ab.trim()}**` : ab;
    }
    const orientativ = r.km < KM_MINIM_ORIENTATIV ? " (cifră orientativă: puțini kilometri)" : "";
    const inAsteptare = trimisePeVehicul.get(r.vehicleId) ?? 0;
    const plus =
      inAsteptare === 0
        ? ""
        : inAsteptare === 1
          ? " (plus o foaie trimisă, neaprobată)"
          : ` (plus ${textNumarat(inAsteptare, "foaie", "foi")} trimise, neaprobate)`;
    const pastila = vehicule.has(r.vehicleId) ? ` → vehicul.${r.vehicleId}` : "";
    return `- ${nume}: ${cantitate} → ${real}${fataDeNorma}${orientativ}${plus}${pastila}`;
  });

  const bucati = [`Consumul din ${etichetaLuna(luna)}, ${peCe}:`, plafoneaza(linii).join("\n")];
  bucati.push(AVERTISMENT_ATRIBUIRE + notaTrimise);
  if (completate.cuRezerva > 0) {
    bucati.push(
      `Pe ${textNumarat(completate.cuRezerva, "foaie veche", "foi vechi")} fără normă fixată la trimitere s-a folosit norma valabilă a vehiculului.`,
    );
  }

  const aratate = randuri.slice(0, MAX_RANDURI);
  return {
    text: bucati.join("\n"),
    referinte: referintePermise(context, ["flota.rapoarte", "flota.foi"]),
    destinatiiEfemere: aratate.flatMap((r) => {
      const v = vehicule.get(r.vehicleId);
      return v === undefined ? [] : [destinatieVehicul(context.zona, v.id, v.nr_inmatriculare)];
    }),
  };
}

export const unealtaConsumFataDeNorma: Unealta = {
  nume: "consum_fata_de_norma",
  descriere:
    "Consumul real de combustibil al vehiculelor într-o lună (implicit luna curentă), din foile de parcurs aprobate, comparat cu norma de consum. Pentru toate vehiculele sau pentru un număr de înmatriculare.",
  parametri,
  featureKey: "fleet",
  permission: "trip_sheets:read",
  minScope: "team",
  executa,
};
