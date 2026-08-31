// src/lib/asistent/unelte/cauta-om.ts
/**
 * „Unde e fișa lui Popescu?” → răspuns cu numele întreg și un buton care duce
 * direct acolo.
 *
 * Unealta asta acoperă un gol care există de mult în produs: breadcrumb-ul
 * randează orice UUID din adresă ca literalmente „Detaliu”, fiindcă e
 * `"use client"` și nu poate rezolva numele entității. Nicăieri în aplicație nu
 * există o traducere href → nume de om. Aici există.
 *
 * ── SCOPE-UL VINE DIN HARTĂ, NU DIN PRESUPUNERE ──────────────────────────────
 * `listeazaAngajati` primește scope-ul EFECTIV al celui care întreabă. Cu
 * `own` sau `team` fără fișă proprie, funcția întoarce singură zero rânduri;
 * cu `team`, RLS-ul taie la subordonați. Nu se rescrie nicio regulă aici — se
 * pasează cea reală și se lasă baza să decidă, ceea ce e singurul mod în care
 * răspunsul poate fi corect și pentru rolurile la care raționamentul nostru a
 * greșit deja de câteva ori.
 */
import "server-only";

import { z } from "zod";

import { scopeFor } from "@/lib/auth/permissions";
import { listeazaAngajati } from "@/lib/queries/employees";
import { filtreAngajatiSchema } from "@/schemas/employee";

import type { Destinatie } from "../destinatii";
import type { ContextUnealta, RezultatUnealta, Unealta } from "./tip";

const parametri = z.object({
  nume: z
    .string()
    .min(2)
    .max(80)
    .describe("Numele sau o parte din numele persoanei căutate. Diacriticele nu contează."),
});

const STARE: Readonly<Record<string, string>> = {
  activ: "activ",
  suspendat: "suspendat",
  incetat: "contract încetat",
};

/**
 * Fișa unui om, îmbrăcată ca destinație, ca să poată fi ținta unui marcaj.
 *
 * `permission`/`minScope` sunt cele ale listei de angajați: pastila nu e o cale
 * de ocolire, iar pagina își verifică oricum din nou dreptul.
 */
function caDestinatie(id: string, nume: string): Destinatie {
  return {
    id: `fisa.${id}`,
    href: `/angajati/${id}`,
    eticheta: nume,
    zona: "app",
    parinte: "angajati",
    fila: null,
    featureKey: null,
    permission: "employees:read",
    minScope: "team",
    descriere: `Fișa angajatului ${nume}.`,
    drum: ["Personal", "Angajați", nume],
  };
}

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const { nume } = parametri.parse(argument);
  const scope = scopeFor(context.permisiuni, "employees:read");
  if (scope === null) {
    return { text: "Nu are dreptul să vadă fișele de personal." };
  }

  const rezultat = await listeazaAngajati({
    organizationId: context.organizationId,
    scope,
    propriaFisaId: context.employeeId,
    filtre: filtreAngajatiSchema.parse({ q: nume, limita: 8 }),
  });

  if (rezultat.randuri.length === 0) {
    return {
      text: `Nu am găsit niciun angajat al cărui nume să conțină „${nume}”, printre cei la care are acces.`,
      referinte: ["angajati"],
    };
  }

  const efemere = rezultat.randuri.map((rand) => caDestinatie(rand.id, rand.full_name));
  const randuri = rezultat.randuri.map((rand, i) => {
    const departament = rand.department === null ? "" : `, ${rand.department.denumire}`;
    const functie = rand.functie === null ? "" : `, ${rand.functie}`;
    const stare = rand.status === "activ" ? "" : ` [${STARE[rand.status] ?? rand.status}]`;
    // Identificatorul destinației e pus lângă fiecare rând tocmai ca modelul să
    // poată trimite exact la omul potrivit, nu la lista de angajați.
    return `- ${rand.full_name} (marca ${rand.marca}${departament}${functie})${stare} → ${efemere[i]?.id ?? ""}`;
  });

  const coada =
    rezultat.total > rezultat.randuri.length
      ? `\n\nSunt ${rezultat.total} potriviri în total; mai sus sunt primele ${rezultat.randuri.length}.`
      : "";

  return {
    text: `Potriviri pentru „${nume}”:\n${randuri.join("\n")}${coada}`,
    referinte: ["angajati"],
    destinatiiEfemere: efemere,
  };
}

export const unealtaCautaOm: Unealta = {
  nume: "cauta_om",
  descriere:
    "Caută un angajat după nume și întoarce datele lui de identificare plus identificatorul de destinație către fișa lui, de forma fisa.<uuid>. Folosește acel identificator într-un marcaj ca să trimiți direct la fișa omului. Întoarce doar angajații la care cel care întreabă are acces.",
  parametri,
  featureKey: null,
  permission: "employees:read",
  minScope: "own",
  executa,
};
