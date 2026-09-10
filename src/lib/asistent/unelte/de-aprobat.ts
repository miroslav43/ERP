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

/**
 * Ce coadă, cum se numește pe românește și unde se rezolvă.
 *
 * `numar` e un EXTRACTOR, nu o cheie. A fost `cheie: keyof CoadaPanou`, iar asta
 * ținea toate cozile obligate la aceeași formă: în ziua în care pontajul a
 * trebuit să numere două lucruri deodată (zile + fișe săptămânale), tipul s-a
 * rupt aici. Cu un extractor, fiecare coadă își spune singură cum se numără —
 * iar `regesDeTransmis`, care lipsea cu totul din listă, a putut intra.
 */
const COZI: readonly Readonly<{
  cheie: keyof CoadaPanou;
  numar: (coada: CoadaPanou) => Contor;
  singular: string;
  plural: string;
  referinta: string;
}>[] = [
  {
    cheie: "cereriConcediu",
    numar: (c) => c.cereriConcediu,
    singular: "o cerere de concediu",
    plural: "cereri de concediu",
    referinta: "concedii.aprobari",
  },
  {
    cheie: "pontaj",
    // Zile neaprobate + fișe săptămânale trimise: se aprobă din același ecran,
    // deci se raportează ca un singur număr.
    numar: (c) => (c.pontaj === null ? null : c.pontaj.zile + c.pontaj.fise),
    singular: "o zi de pontaj",
    plural: "zile de pontaj",
    referinta: "pontaj.aprobare",
  },
  {
    cheie: "deplasari",
    numar: (c) => c.deplasari,
    singular: "o deplasare",
    plural: "deplasări",
    referinta: "diurna.aprobari",
  },
  {
    cheie: "foiParcurs",
    numar: (c) => c.foiParcurs,
    singular: "o foaie de parcurs",
    plural: "foi de parcurs",
    referinta: "flota.aprobari",
  },
  {
    cheie: "tichete",
    numar: (c) => c.tichete,
    singular: "un tichet IT",
    plural: "tichete IT",
    referinta: "ticketing.coada",
  },
  {
    cheie: "regesDeTransmis",
    numar: (c) => c.regesDeTransmis,
    singular: "un eveniment de transmis în REGES",
    plural: "evenimente de transmis în REGES",
    referinta: "reges",
  },
  {
    cheie: "anomaliiKm",
    numar: (c) => c.anomaliiKm,
    singular: "o anomalie de kilometraj",
    plural: "anomalii de kilometraj",
    referinta: "flota.anomalii",
  },
];

const areCifra = (contor: Contor): contor is number => contor !== null && contor > 0;

async function executa(context: ContextUnealta): Promise<RezultatUnealta> {
  const contoare = await contoarePanou(context.organizationId, {
    userId: context.userId,
    features: context.features,
    permissions: context.permisiuni,
  });

  const cuMunca = COZI.filter((coada) => areCifra(coada.numar(contoare.coada)));
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
    const n = coada.numar(contoare.coada) as number;
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
