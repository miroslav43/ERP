// src/lib/asistent/unelte/flota/cine-are-masina.ts
/**
 * „Cine are mașina B123ABC azi?”, „cine conducea pe 3 octombrie la 14:20?”.
 *
 * Nu există un ecran pentru întrebarea asta: răspunsul combină foaia zilei,
 * cursele ei, alocarea și steagul de pool. Precedența e a lui `app.sofer_la`
 * (0206), reprodusă în `alegeSoferul` pe citiri sub RLS (D1, D3): învelișul
 * `public.sofer_sugerat` e SECURITY DEFINER și răspunde doar celui care
 * administrează amenzile.
 *
 * ── SUGESTIE, NU DESEMNARE ──────────────────────────────────────────────────
 * OUG 195/2002 art. 39 alin. (1) cere persoana căreia i s-a ÎNCREDINȚAT
 * vehiculul; desemnarea o face omul, pe ecranul amenzii (F11). Pentru o zi
 * trecută, textul încheie cu „Verifică pe foaie înainte de a răspunde poliției.”
 *
 * ── CE NU IESE (decizia I-T6) ───────────────────────────────────────────────
 * Locurile curselor nu se citesc deloc: doar intervalul orar și numărul foii.
 * Pastila duce la foaie, unde omul vede traseul sub propriul drept.
 */
import "server-only";

import { z } from "zod";

import { meetsScope } from "@/config/permissions";
import { adaugaZileIso } from "@/domain/calendar/grila-lunara";
import {
  formatDate,
  formatDateTime,
  momentDinOraRomaniei,
  oraInBucharest,
  toBucharestDateString,
} from "@/lib/format/date";
import { angajatiDupaId, type AngajatRezumat } from "@/lib/queries/fleet";
import {
  alocarileInceputeInainte,
  curseleFoilor,
  foiInInterval,
  rezervarileZilei,
  vehiculeDupaNumar,
  type VehiculScurt,
} from "@/lib/queries/flota-asistent";

import type { Destinatie } from "../../destinatii";
import type { ContextUnealta, RezultatUnealta, Unealta } from "../tip";
import { alegeSoferul, frazaFaraSofer, limiteleZilei, type CursaZi, type FoaieZi } from "./calcul";
import {
  ARGUMENTE_NEVALIDE,
  NR_MINIM_CARACTERE,
  VEHICUL_NEGASIT,
  destinatieFoaie,
  destinatieVehicul,
  normalizeazaNr,
  referintePermise,
} from "./comun";

/** Câte potriviri pe număr se enumeră înainte de a cere precizarea. */
const MAX_POTRIVIRI = 5;

const parametri = z.object({
  nr_inmatriculare: z
    .string()
    .min(2)
    .max(16)
    .describe("Numărul de înmatriculare, întreg sau o parte din el."),
  // Fără `.regex()`: Gemini, prin OpenRouter, nu primește `pattern` în schemă.
  // Forma se verifică în `executa`, cu un refuz scris, nu cu o excepție.
  data: z
    .string()
    .max(10)
    .optional()
    .describe("Ziua, AAAA-LL-ZZ. Lipsește = azi. Doar azi sau o zi trecută."),
  ora: z
    .string()
    .max(5)
    .optional()
    .describe("Ora, HH:MM, în ora României, când se întreabă de un moment anume (ora faptei)."),
});

const ZI = /^\d{4}-\d{2}-\d{2}$/u;
const ORA = /^([01]\d|2[0-3]):[0-5]\d$/u;
const FARA_ACCES = "un angajat la a cărui fișă nu ai acces";

function numele(id: string, angajati: ReadonlyMap<string, AngajatRezumat>): string {
  const a = angajati.get(id);
  if (a === undefined || a.full_name === null) return FARA_ACCES;
  return a.deleted_at === null ? a.full_name : `${a.full_name} (fișă ștearsă)`;
}

/** „09:10” în ziua întrebată; „01.10.2026, 09:10” în altă zi. */
function moment(iso: string, ziua: string): string {
  const d = new Date(iso);
  return toBucharestDateString(d) === ziua ? oraInBucharest(d) : formatDateTime(d);
}

function etichetaFoii(f: FoaieZi): string {
  return f.numar ?? `foaia din ${formatDate(f.data).slice(0, 5)} (încă netrimisă)`;
}

function intervalCursa(c: CursaZi, ziua: string): string {
  return `${moment(c.plecare_la, ziua)}–${c.sosire_la === null ? "fără sosire" : moment(c.sosire_la, ziua)}`;
}

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const parsat = parametri.safeParse(argument);
  if (!parsat.success) return ARGUMENTE_NEVALIDE;
  const cautat = normalizeazaNr(parsat.data.nr_inmatriculare);
  if (cautat.length < NR_MINIM_CARACTERE) {
    return {
      text: "Numărul de înmatriculare dat nu conține destule litere și cifre ca să-l caut.",
    };
  }

  const azi = context.aziISO;
  const ziua = parsat.data.data ?? azi;
  if (!ZI.test(ziua) || momentDinOraRomaniei(`${ziua}T00:00`) === null) {
    return { text: "Ziua trebuie scrisă AAAA-LL-ZZ, de exemplu 2026-10-03." };
  }
  if (ziua > azi) return { text: "Pot spune doar cine a avut mașina azi sau într-o zi trecută." };
  const ora = parsat.data.ora;
  if (ora !== undefined && !ORA.test(ora)) {
    return { text: "Ora trebuie scrisă HH:MM, de exemplu 14:20." };
  }
  const acum = new Date();
  const momentCerut =
    ora !== undefined
      ? momentDinOraRomaniei(`${ziua}T${ora}`)
      : ziua === azi
        ? acum.toISOString()
        : null;
  if (momentCerut !== null && Date.parse(momentCerut) > acum.getTime()) {
    return { text: "Ora aceea n-a venit încă; pot spune doar ce s-a întâmplat până acum." };
  }

  const gasite = await vehiculeDupaNumar(context.organizationId, cautat, MAX_POTRIVIRI + 1);
  const exact = gasite.find((v) => v.nr_inmatriculare === cautat);
  if (gasite.length === 0) return { text: VEHICUL_NEGASIT };
  if (exact === undefined && gasite.length > 1) {
    const lista = gasite.slice(0, MAX_POTRIVIRI).map((v) => `- ${v.nr_inmatriculare}`);
    const mai = gasite.length > MAX_POTRIVIRI ? "\n…și altele." : "";
    return {
      text: `Mai multe vehicule au „${cautat}” în număr. Care dintre ele?\n${lista.join("\n")}${mai}`,
    };
  }
  const vehicul = exact ?? (gasite[0] as VehiculScurt);
  const destVehicul = destinatieVehicul(context.zona, vehicul.id, vehicul.nr_inmatriculare);

  if (vehicul.data_iesire !== null && ziua > vehicul.data_iesire) {
    return {
      text: `${vehicul.nr_inmatriculare} a ieșit din parc pe ${formatDate(vehicul.data_iesire)}. Pot spune cine l-a avut doar într-o zi de dinainte. → vehicul.${vehicul.id}`,
      destinatiiEfemere: [destVehicul],
    };
  }
  if (vehicul.data_achizitie !== null && ziua < vehicul.data_achizitie) {
    return {
      text: `${vehicul.nr_inmatriculare} a intrat în parc pe ${formatDate(vehicul.data_achizitie)}, după ziua întrebată. → vehicul.${vehicul.id}`,
      destinatiiEfemere: [destVehicul],
    };
  }

  const { sfarsit } = limiteleZilei(ziua);
  const poateRezervari = meetsScope(context.permisiuni.get("vehicle_reservations:read"), "own");
  // Și foile de IERI: o cursă de noapte de pe foaia de ieri poate acoperi dimineața.
  const [foi, alocari, rezervari] = await Promise.all([
    foiInInterval(context.organizationId, adaugaZileIso(ziua, -1), ziua, {
      vehicleId: vehicul.id,
    }),
    alocarileInceputeInainte(context.organizationId, vehicul.id, sfarsit),
    poateRezervari
      ? rezervarileZilei(context.organizationId, vehicul.id, ziua)
      : Promise.resolve([]),
  ]);
  const curse = await curseleFoilor(
    context.organizationId,
    foi.filter((f) => f.status !== "respins").map((f) => f.id),
  );
  const ales = alegeSoferul({ ziua, moment: momentCerut, foi, curse, alocari, pool: vehicul.pool });

  const deNumit = [
    ...(ales.fel === "cursa" || ales.fel === "foaie" ? [ales.foaie.employee_id] : []),
    ...(ales.fel === "alocare" ? [ales.alocare.employee_id] : []),
    ...(ales.fel === "zi"
      ? [...ales.foi.map((f) => f.employee_id), ...ales.alocari.map((a) => a.employee_id)]
      : []),
    ...rezervari.map((r) => r.employee_id),
  ];
  const angajati = await angajatiDupaId(context.organizationId, deNumit);

  const vizibilitateCompleta =
    meetsScope(context.permisiuni.get("vehicles:read"), "all") &&
    meetsScope(context.permisiuni.get("trip_sheets:read"), "all");
  const poateFoaia = meetsScope(context.permisiuni.get("trip_sheets:read"), "own");
  const foiPomenite: FoaieZi[] = [];
  const peFoaie = (f: FoaieZi): string => {
    foiPomenite.push(f);
    return poateFoaia ? `${etichetaFoii(f)} → foaie.${f.id}` : etichetaFoii(f);
  };

  const nr = vehicul.nr_inmatriculare;
  const trecut = ziua < azi;
  const cand =
    ora !== undefined
      ? `${trecut ? `pe ${formatDate(ziua)} ` : ""}la ora ${ora}`
      : trecut
        ? `pe ${formatDate(ziua)}`
        : "acum";
  const bucati: string[] = [];

  switch (ales.fel) {
    case "cursa":
      bucati.push(
        `${nr} ${trecut ? "era" : "e"} ${cand} la ${numele(ales.foaie.employee_id, angajati)}, pe ${peFoaie(ales.foaie)} (cursa ${intervalCursa(ales.cursa, ziua)}).`,
      );
      break;
    case "alocare": {
      const { alocare } = ales;
      const pana = alocare.pana_la === null ? "" : ` până la ${moment(alocare.pana_la, ziua)}`;
      bucati.push(
        `${nr} ${trecut ? "era" : "e"} ${cand} în alocare (șofer: ${numele(alocare.employee_id, angajati)}, din ${moment(alocare.de_la, ziua)}${pana}).`,
      );
      break;
    }
    case "foaie":
      bucati.push(
        `Pe ${nr} e foaia zilei (șofer: ${numele(ales.foaie.employee_id, angajati)}, ${peFoaie(ales.foaie)}), dar nicio cursă de pe ea nu acoperă ${ora === undefined ? "ora de acum" : `ora ${ora}`}, iar mașina nu e alocată nimănui atunci.`,
      );
      break;
    case "zi": {
      const linii = [
        ...ales.foi.map((f) => {
          const aleFoii = curse
            .filter((c) => c.trip_sheet_id === f.id)
            .sort((a, b) => Date.parse(a.plecare_la) - Date.parse(b.plecare_la))
            .map((c) => intervalCursa(c, ziua));
          const intervale = aleFoii.length === 0 ? "fără curse" : `cursele ${aleFoii.join(", ")}`;
          return `- ${numele(f.employee_id, angajati)}, pe ${peFoaie(f)}: ${intervale}`;
        }),
        ...ales.alocari.map((a) => {
          const pana = a.pana_la === null ? "" : ` până la ${moment(a.pana_la, ziua)}`;
          return `- ${numele(a.employee_id, angajati)}, alocare din ${moment(a.de_la, ziua)}${pana}`;
        }),
      ];
      bucati.push(`Pe ${formatDate(ziua)}, ${nr} apare la:\n${linii.join("\n")}`);
      if (linii.length > 1) {
        bucati.push("Pentru un singur nume, spune și ora (de exemplu ora din procesul-verbal).");
      }
      break;
    }
    case "pool":
    case "nimic":
      bucati.push(
        `${trecut ? `Pe ${formatDate(ziua)}, ` : "Azi, "}${nr} ${frazaFaraSofer(ales.fel, vizibilitateCompleta)}.`,
      );
      break;
  }

  // F12d: rezervarea zilei, pomenită DUPĂ foaie și alocare. Nu e document justificativ.
  for (const r of rezervari) {
    const stare = r.status === "confirmata" ? "confirmată" : "cerută, neaprobată încă";
    bucati.push(`Rezervare pe ziua aceea: ${numele(r.employee_id, angajati)} (${stare}).`);
  }

  if (!vizibilitateCompleta && ales.fel !== "pool" && ales.fel !== "nimic") {
    bucati.push("Răspunsul ține cont doar de foile și alocările pe care le poți vedea.");
  }
  bucati.push(
    trecut
      ? "E o sugestie din foi și alocări, nu o desemnare. Verifică pe foaie înainte de a răspunde poliției."
      : "E o sugestie din foi și alocări, nu o desemnare.",
  );
  bucati.push(`Vehiculul: → vehicul.${vehicul.id}`);

  const efemere: Destinatie[] = [destVehicul];
  if (poateFoaia) {
    for (const f of new Map(foiPomenite.map((x) => [x.id, x])).values()) {
      efemere.push(destinatieFoaie(context.zona, f.id, etichetaFoii(f)));
    }
  }
  return {
    text: bucati.join("\n"),
    referinte: referintePermise(context, trecut ? ["flota.amenzi"] : []),
    destinatiiEfemere: efemere,
  };
}

export const unealtaCineAreMasina: Unealta = {
  nume: "cine_are_masina",
  descriere:
    "Cine are sau a avut un vehicul într-o zi (azi sau în trecut) și, opțional, la o oră anume: din cursele foii de parcurs, din alocare și din rezervări. Răspunsul e o sugestie, nu o desemnare.",
  parametri,
  featureKey: "fleet",
  permission: "vehicles:read",
  minScope: "team",
  executa,
};
