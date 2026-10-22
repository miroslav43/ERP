// src/lib/asistent/unelte/flota/scadente-soferi.ts
/**
 * „Ale cui permise expiră?”, „când îmi expiră permisul?” (F9, decizia I-e3).
 *
 * Unealtă separată de `scadente_flota` tocmai pentru HR: HR n-are `vehicles:read`
 * (decizia 3 a planului flotei), dar administrează permisele (`driver_licenses`,
 * cheie proprie). Pe `own`, doar rândul propriu, fără nume („permisul tău”); pe
 * `team`/`all`, numele vin prin `angajatiDupaId`, sub RLS.
 *
 * Ce NU iese: numărul permisului (aceeași regulă ca CNP-ul, `tip.ts`), și avizul
 * medical: `app.stare_aviz_sofer` stă în schema `app`, la care `.rpc()` nu ajunge.
 */
import "server-only";

import { z } from "zod";

import { meetsScope } from "@/config/permissions";
import { PRAG_FLOTA_AVERTIZARE_ZILE } from "@/domain/fleet/scadente";
import { textNumarat } from "@/lib/format/numar";
import { angajatiDupaId } from "@/lib/queries/fleet";
import { permiseCareExpira } from "@/lib/queries/flota-asistent";

import type { ContextUnealta, RezultatUnealta, Unealta } from "../tip";
import {
  ARGUMENTE_NEVALIDE,
  ID_PORTAL_MASINA,
  MAX_RANDURI,
  destinatieFisa,
  peZiua,
  plafoneaza,
  pragZile,
  referintePermise,
} from "./comun";

const parametri = z.object({
  zile: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(`Orizontul, în zile de la azi. Implicit ${String(PRAG_FLOTA_AVERTIZARE_ZILE)}.`),
});

function categorii(c: readonly string[]): string {
  return c.length === 0 ? "" : ` (${c.join(", ")})`;
}

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const parsat = parametri.safeParse(argument);
  if (!parsat.success) return ARGUMENTE_NEVALIDE;
  const zile = parsat.data.zile ?? PRAG_FLOTA_AVERTIZARE_ZILE;
  const azi = context.aziISO;
  const prag = pragZile(azi, zile);
  const orizont = `în următoarele ${textNumarat(zile, "zi", "zile")}`;
  const doarAlMeu = !meetsScope(context.permisiuni.get("driver_licenses:read"), "team");

  if (doarAlMeu) {
    if (context.employeeId === null) {
      return {
        text: "Contul acesta nu are fișă de angajat, deci nici permis de conducere înregistrat.",
      };
    }
    const propriu = (await permiseCareExpira(context.organizationId, prag)).filter(
      (p) => p.employee_id === context.employeeId,
    );
    const [permis] = propriu;
    const referinte = referintePermise(context, [ID_PORTAL_MASINA]);
    if (permis === undefined) {
      return {
        text: `Permisul tău de conducere nu expiră ${orizont} (sau nu e înregistrat).`,
        referinte,
      };
    }
    const verb = permis.expira_la < azi ? "a expirat" : "expiră";
    return {
      text: `Permisul tău de conducere${categorii(permis.categorii)} ${verb} ${peZiua(azi, permis.expira_la)}.`,
      referinte,
    };
  }

  const permise = [...(await permiseCareExpira(context.organizationId, prag))].sort((a, b) =>
    a.expira_la.localeCompare(b.expira_la),
  );
  if (permise.length === 0) {
    return {
      text: `Niciun permis de conducere dintre cele pe care le poți vedea nu expiră ${orizont}.`,
    };
  }
  const angajati = await angajatiDupaId(
    context.organizationId,
    permise.map((p) => p.employee_id),
  );
  // Fișa angajatului e în aplicație; din portal pastila n-ar avea unde duce.
  const poateFisa =
    context.zona === "app" && meetsScope(context.permisiuni.get("employees:read"), "team");
  const linii = permise.map((p) => {
    const a = angajati.get(p.employee_id);
    const nume = a?.full_name ?? "un angajat la a cărui fișă nu ai acces";
    const verb = p.expira_la < azi ? "a expirat" : "expiră";
    const pastila = poateFisa && a !== undefined && a.deleted_at === null ? ` → fisa.${a.id}` : "";
    return `- ${nume}: permisul${categorii(p.categorii)} ${verb} ${peZiua(azi, p.expira_la)}${pastila}`;
  });
  const efemere = poateFisa
    ? permise.slice(0, MAX_RANDURI).flatMap((p) => {
        const a = angajati.get(p.employee_id);
        return a === undefined || a.full_name === null || a.deleted_at !== null
          ? []
          : [destinatieFisa(a.id, a.full_name)];
      })
    : [];
  return {
    text: `Permisele de conducere care au expirat sau expiră ${orizont}:\n${plafoneaza(linii).join("\n")}`,
    destinatiiEfemere: [...new Map(efemere.map((d) => [d.id, d])).values()],
  };
}

export const unealtaScadenteSoferi: Unealta = {
  nume: "scadente_soferi",
  descriere:
    "Permisele de conducere ale șoferilor care au expirat sau expiră curând. Pentru un angajat, doar permisul lui.",
  parametri,
  featureKey: "fleet",
  permission: "driver_licenses:read",
  minScope: "own",
  executa,
};
