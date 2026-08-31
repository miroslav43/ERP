// src/lib/asistent/unelte/de-aprobat.ts
/**
 * „Am ceva de semnat?”
 *
 * Se sprijină pe `contoarePanou`, care e deja conștientă și de module, și de
 * praguri de scope — inclusiv de capcana pe care panoul a călcat-o o dată:
 * poarta cozii de concedii era `leave:read = all`, iar `manager` are `team`,
 * așa că panoul îi spunea „nimic nu așteaptă semnătura dumneavoastră” fix
 * rolului a cărui treabă principală e să semneze.
 *
 * ── DE CE `null` NU E `0` ────────────────────────────────────────────────────
 * `Contor = number | null` face o distincție pe care unealta asta TREBUIE să o
 * păstreze: `0` înseamnă „se arată și e gol” — totul e în regulă — iar `null`
 * înseamnă „blocul nu se arată”, fiindcă modulul e stins sau rolul n-are
 * permisiunea. Turtite amândouă într-un „0”, asistentul ar răspunde liniștitor
 * „nu ai nimic de aprobat” cuiva care de fapt nu are cum să vadă coada. Aici
 * `null` pur și simplu nu se raportează.
 */
import "server-only";

import { z } from "zod";

import { contoarePanou, type CoadaPanou, type Contor } from "@/lib/queries/panou";

import type { ContextUnealta, RezultatUnealta, Unealta } from "./tip";

const parametri = z.object({});

/** Ce coadă, cum se numește pe românește și unde se rezolvă. */
const COZI: readonly Readonly<{
  cheie: keyof CoadaPanou;
  singular: string;
  plural: string;
  referinta: string;
}>[] = [
  {
    cheie: "cereriConcediu",
    singular: "o cerere de concediu",
    plural: "cereri de concediu",
    referinta: "concedii.aprobari",
  },
  {
    cheie: "saptamaniPontaj",
    singular: "o săptămână de pontaj",
    plural: "săptămâni de pontaj",
    referinta: "pontaj.aprobare",
  },
  {
    cheie: "deplasari",
    singular: "o deplasare",
    plural: "deplasări",
    referinta: "diurna.aprobari",
  },
  {
    cheie: "foiParcurs",
    singular: "o foaie de parcurs",
    plural: "foi de parcurs",
    referinta: "flota.aprobari",
  },
  {
    cheie: "tichete",
    singular: "un tichet IT",
    plural: "tichete IT",
    referinta: "ticketing.coada",
  },
  {
    cheie: "anomaliiKm",
    singular: "o anomalie de kilometraj",
    plural: "anomalii de kilometraj",
    referinta: "flota.anomalii",
  },
];

const areCifra = (contor: Contor): contor is number => contor !== null && contor > 0;

async function executa(context: ContextUnealta): Promise<RezultatUnealta> {
  const contoare = await contoarePanou(context.organizationId, {
    features: context.features,
    permissions: context.permisiuni,
  });

  const cuMunca = COZI.filter((coada) => areCifra(contoare.coada[coada.cheie]));
  if (cuMunca.length === 0) {
    // Nu se spune „nimic de aprobat” la modul absolut: cozile la care omul n-are
    // acces sunt `null` și n-au fost nici numărate. Formularea rămâne despre
    // ce vede el.
    return {
      text: "Nu așteaptă nimic decizia lui, pe cozile la care are acces.",
      referinte: ["panou"],
    };
  }

  const randuri = cuMunca.map((coada) => {
    const n = contoare.coada[coada.cheie] as number;
    return `- ${n} ${n === 1 ? coada.singular : coada.plural}`;
  });

  return {
    text: `Așteaptă decizia lui:\n${randuri.join("\n")}`,
    referinte: cuMunca.map((coada) => coada.referinta),
  };
}

export const unealtaDeAprobat: Unealta = {
  nume: "ce_am_de_aprobat",
  descriere:
    "Ce așteaptă decizia celui care întreabă: cereri de concediu, săptămâni de pontaj, deplasări, foi de parcurs, tichete, anomalii de kilometraj. Întoarce numere exacte, doar pentru cozile la care are drept de aprobare.",
  parametri,
  featureKey: null,
  permission: null,
  minScope: "own",
  executa,
};
