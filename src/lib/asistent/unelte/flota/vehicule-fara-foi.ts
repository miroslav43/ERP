// src/lib/asistent/unelte/flota/vehicule-fara-foi.ts
/**
 * „Ce vehicule n-au foi luna asta?”
 *
 * ── DE CE `all` PE AMBELE CHEI (D4, decizia I-e1) ────────────────────────────
 * Sub `trip_sheets:read = team`, foile altor șoferi pe o mașină de pool sunt
 * invizibile, iar unealta ar afirma „fără foi” despre un vehicul cu foi: o
 * afirmație falsă, dată unui manager care o poate duce mai departe. Poarta cere
 * deci `vehicles:read` și `trip_sheets:read` la `all` (`permisiuniSuplimentare`).
 *
 * Parcul lunii e cel din `public.flota_fiscal_luna` (0205): vehiculele vii, intrate
 * înainte de sfârșitul lunii și ieșite după începutul ei. Clasificarea e mai
 * fină decât verdictul fiscal: „nicio foaie” față de „doar ciorne sau respinse”.
 *
 * F10 (decizia I-e2): lângă vehiculul încadrat la deducere integrală în scop
 * exclusiv economic, o propoziție neutră, cu temei și FĂRĂ verdict (⚠ formularea
 * se validează cu contabilul; promptul interzice sfatul fiscal).
 */
import "server-only";

import { z } from "zod";

import { perioadaLa } from "@/domain/fleet/fiscal";
import { etichetaLuna, intervalLuna } from "@/domain/fleet/rapoarte";
import { textNumarat } from "@/lib/format/numar";
import { foiInInterval, regimuriFiscale, vehiculeFirmei } from "@/lib/queries/flota-asistent";

import type { ContextUnealta, RezultatUnealta, Unealta } from "../tip";
import { clasificaVehiculeFaraFoi, inParcInInterval } from "./calcul";
import {
  ARGUMENTE_NEVALIDE,
  MAX_RANDURI,
  destinatieVehicul,
  lunaCeruta,
  lunaInViitor,
  plafoneaza,
  referintePermise,
} from "./comun";

const parametri = z.object({
  an: z.number().int().min(2020).max(2100).optional().describe("Anul. Implicit, anul curent."),
  luna: z.number().int().min(1).max(12).optional().describe("Luna, 1–12. Implicit, luna curentă."),
});

/**
 * Decizia I-e2 (b), formularea propusă în specificație. ⚠ De validat cu
 * contabilul: NOTES.md, „F12 — de confirmat”.
 */
export const MENTIUNE_DEDUCERE_INTEGRALA =
  "Pentru vehiculele marcate „deducere integrală”, normele Codului fiscal (HG 1/2016, titlul II pct. 16 alin. (2)) cer foaia de parcurs pentru justificare. Verifică încadrarea cu contabilul.";

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const parsat = parametri.safeParse(argument);
  if (!parsat.success) return ARGUMENTE_NEVALIDE;
  const luna = lunaCeruta(context.aziISO, parsat.data.an, parsat.data.luna);
  if (lunaInViitor(luna, context.aziISO)) {
    return { text: `Luna ${etichetaLuna(luna)} n-a început încă.` };
  }
  const { deLa, panaLa } = intervalLuna(luna);
  const curenta = luna === context.aziISO.slice(0, 7);
  const eticheta = `${etichetaLuna(luna)}${curenta ? " (până azi)" : ""}`;

  const vehicule = (await vehiculeFirmei(context.organizationId)).filter((v) =>
    inParcInInterval(v, deLa, panaLa),
  );
  if (vehicule.length === 0) {
    return { text: `Firma nu are vehicule în parc în ${etichetaLuna(luna)}.` };
  }
  const ids = vehicule.map((v) => v.id);
  const [foi, regimuri] = await Promise.all([
    foiInInterval(context.organizationId, deLa, panaLa),
    regimuriFiscale(context.organizationId, ids),
  ]);

  const clase = clasificaVehiculeFaraFoi(vehicule, foi, deLa, panaLa);
  // Regimul în vigoare la sfârșitul lunii, ca în `public.flota_fiscal_luna`.
  const integral = new Set(
    vehicule
      .filter(
        (v) =>
          perioadaLa(
            regimuri.filter((r) => r.vehicle_id === v.id),
            panaLa,
          )?.regim === "integral_exclusiv_economic",
      )
      .map((v) => v.id),
  );

  const faraFoi = vehicule
    .filter((v) => clase.get(v.id) !== "cu_foi")
    .sort((a, b) => a.nr_inmatriculare.localeCompare(b.nr_inmatriculare));
  if (faraFoi.length === 0) {
    return {
      text: `În ${eticheta}, toate cele ${textNumarat(vehicule.length, "vehicul", "vehicule")} din parc au cel puțin o foaie trimisă sau aprobată.`,
      referinte: referintePermise(context, ["flota.foi"]),
    };
  }

  const linii = faraFoi.map((v) => {
    const ce =
      clase.get(v.id) === "doar_ciorne"
        ? "doar ciorne sau foi respinse, nimic trimis"
        : "nicio foaie";
    // Statusul e cel de AZI: istoric nu există, deci nu se afirmă nimic despre luna trecută.
    const service = v.status === "in_service" ? " (în service acum)" : "";
    const fiscal = integral.has(v.id) ? " (deducere integrală)" : "";
    return `- ${v.nr_inmatriculare}: ${ce}${service}${fiscal} → vehicul.${v.id}`;
  });
  const aratate = faraFoi.slice(0, MAX_RANDURI);
  const cuMentiune = faraFoi.some((v) => integral.has(v.id));

  const bucati = [
    `În ${eticheta}, ${textNumarat(faraFoi.length, "vehicul", "vehicule")} din cele ${String(vehicule.length)} aflate în parc ${faraFoi.length === 1 ? "n-are" : "n-au"} nicio foaie trimisă sau aprobată:`,
    plafoneaza(linii).join("\n"),
  ];
  if (cuMentiune) bucati.push(MENTIUNE_DEDUCERE_INTEGRALA);

  return {
    text: bucati.join("\n"),
    referinte: referintePermise(context, ["flota.foi", ...(cuMentiune ? ["flota.fiscal"] : [])]),
    destinatiiEfemere: aratate.map((v) =>
      destinatieVehicul(context.zona, v.id, v.nr_inmatriculare),
    ),
  };
}

export const unealtaVehiculeFaraFoi: Unealta = {
  nume: "vehicule_fara_foi",
  descriere:
    "Vehiculele din parc care n-au nicio foaie de parcurs trimisă sau aprobată într-o lună (implicit luna curentă), cu cele aflate în service marcate.",
  parametri,
  featureKey: "fleet",
  permission: "vehicles:read",
  minScope: "all",
  permisiuniSuplimentare: [{ permission: "trip_sheets:read", minScope: "all" }],
  executa,
};
