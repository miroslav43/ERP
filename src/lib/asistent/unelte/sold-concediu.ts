// src/lib/asistent/unelte/sold-concediu.ts
/**
 * „Câte zile de concediu mai am?” și „mi s-a aprobat cererea din august?”.
 *
 * Citește prin `createServerSupabase()` — clientul de sesiune, cu RLS activ —
 * folosind funcțiile care există deja în `queries/portal.ts`. Nicio interogare
 * nouă, deci niciun loc nou în care izolarea între firme să poată fi greșită.
 *
 * `drepturileMele` nu primește `employee_id`: își rezolvă singură fișa
 * apelantului, din `app.current_employee_id()`. `soldurileMele` îl primește, dar
 * din context, niciodată de la model.
 */
import "server-only";

import { z } from "zod";

import { cererileMele, drepturileMele, soldurileMele } from "@/lib/queries/portal";

import type { ContextUnealta, RezultatUnealta, Unealta } from "./tip";

const parametri = z.object({
  an: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe("Anul pentru care se cere soldul. Implicit, anul curent."),
});

/** Stările din `leave_requests`, scrise pe românește pentru model. */
const STARE: Readonly<Record<string, string>> = {
  ciorna: "ciornă",
  in_asteptare: "în așteptare",
  aprobata: "aprobată",
  respinsa: "respinsă",
  anulata: "anulată",
};

function zile(n: number): string {
  // „1 zi”, „2 zile”, „21 de zile” — regula românească a lui „de” peste 19.
  if (n === 1) return "o zi";
  const rest = Math.abs(n) % 100;
  return rest >= 20 || rest === 0 ? `${n} de zile` : `${n} zile`;
}

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const { an = Number(context.aziISO.slice(0, 4)) } = parametri.parse(argument);
  const { employeeId } = context;
  if (employeeId === null) {
    return { text: "Contul acesta nu are fișă de angajat, deci nu are sold de concediu." };
  }

  const [drepturi, solduri, cereri] = await Promise.all([
    drepturileMele(context.organizationId, an),
    soldurileMele(context.organizationId, an, employeeId),
    cererileMele(context.organizationId, employeeId, 8),
  ]);

  const numePeTip = new Map(drepturi.map((d) => [d.leave_type_id, d.denumire]));
  const scadeDinSold = new Set(
    drepturi.flatMap((d) => (d.scade_din_sold ? [d.leave_type_id] : [])),
  );

  const randuriSold = solduri
    .filter((s) => scadeDinSold.has(s.leave_type_id))
    .map((s) => {
      const denumire = numePeTip.get(s.leave_type_id) ?? "Tip necunoscut";
      const total = s.drept_anual + s.reportate;
      const ramase = s.ramase ?? total - s.folosite - s.in_asteptare;
      const asteptare =
        s.in_asteptare > 0 ? `, dintre care ${zile(s.in_asteptare)} în cereri neaprobate încă` : "";
      return `- ${denumire}: ${zile(ramase)} rămase din ${zile(total)} (folosite ${s.folosite})${asteptare}`;
    });

  const randuriCereri = cereri.map((c) => {
    const denumire = numePeTip.get(c.leave_type_id) ?? "concediu";
    const durata = c.zile_lucratoare === null ? "" : ` (${zile(c.zile_lucratoare)} lucrătoare)`;
    const motiv =
      c.motiv_respingere === null || c.motiv_respingere === ""
        ? ""
        : ` — motiv: ${c.motiv_respingere}`;
    return `- ${denumire}, ${c.data_inceput} → ${c.data_sfarsit}${durata}: ${STARE[c.status] ?? c.status}${motiv}`;
  });

  const bucati: string[] = [];
  bucati.push(
    randuriSold.length === 0
      ? `Pentru anul ${an} nu există niciun sold de concediu configurat pe fișa aceasta.`
      : `Soldul de concediu pe ${an}:\n${randuriSold.join("\n")}`,
  );
  if (randuriCereri.length > 0) {
    bucati.push(`Ultimele cereri:\n${randuriCereri.join("\n")}`);
  }

  return {
    text: bucati.join("\n\n"),
    referinte: ["portal.concedii", "concedii.sold"],
  };
}

export const unealtaSoldConcediu: Unealta = {
  nume: "sold_concediu",
  descriere:
    "Zilele de concediu ale celui care întreabă: câte i se cuvin, câte a folosit, câte i-au rămas, plus ultimele lui cereri și starea fiecăreia. Se cheamă doar pentru propria situație, nu pentru alți angajați.",
  parametri,
  featureKey: "leave",
  permission: "leave:read",
  minScope: "own",
  cereFisaProprie: true,
  executa,
};
