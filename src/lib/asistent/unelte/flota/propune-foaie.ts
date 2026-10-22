// src/lib/asistent/unelte/flota/propune-foaie.ts
/**
 * „Creează foaia de azi”, „deschide-mi foaia pe B123ABC”.
 *
 * ── NU CREEAZĂ NIMIC ────────────────────────────────────────────────────────
 * Întoarce o destinație efemeră `propune.foaie.<vehicul>` care deschide caseta
 * „Foaie nouă” PRECOMPLETATĂ. Omul verifică și apasă „Salvează”; asistentul
 * rămâne fără nicio Server Action (D8: promptul îi interzice să spună „am creat”).
 *
 * ── PROPUNE DOAR CE OFERĂ CASETA ────────────────────────────────────────────
 * Vehiculele candidate sunt EXACT cele din caseta zonei (`date-foaie-noua.ts`):
 * la `trip_sheets:create = all`, primele 100 de vehicule active ale parcului;
 * altfel `vehicululMeu` — mașina alocată lui și cele comune, active. Un vehicul
 * din afara listei ar deschide caseta fără preselecție, în tăcere, iar unul pe
 * care baza îl refuză (`foi_parcurs_inainte`) ar duce omul într-o eroare.
 * Baza rămâne bariera; asta e doar politețea de a nu propune refuzul.
 */
import "server-only";

import { z } from "zod";

import { meetsScope } from "@/config/permissions";
import { formatDate } from "@/lib/format/date";
import { listeazaVehicule, vehicululMeu } from "@/lib/queries/fleet";
import { ocupareaPool, setarileRezervarilor } from "@/lib/queries/fleet-rezervari";
import { foiInInterval } from "@/lib/queries/flota-asistent";
import { permisulAngajatului } from "@/lib/queries/soferi";

import type { ContextUnealta, RezultatUnealta, Unealta } from "../tip";
import {
  ARGUMENTE_NEVALIDE,
  NR_MINIM_CARACTERE,
  destinatieFoaie,
  destinatiePropunereFoaie,
  normalizeazaNr,
  referintePermise,
} from "./comun";

/** Câte mașini se enumeră când omul n-a spus pe care. */
const MAX_CANDIDATE = 6;

const parametri = z.object({
  nr_inmatriculare: z
    .string()
    .min(2)
    .max(16)
    .optional()
    .describe("Numărul de înmatriculare al mașinii. Lipsește = mașina lui, dacă are una singură."),
});

const STARE: Readonly<Record<string, string>> = {
  draft: "ciornă",
  trimis: "trimisă spre aprobare",
  aprobat: "aprobată",
};

const SURSA: Readonly<Record<string, string>> = {
  rezervare: "o rezervare",
  foaie: "foaia zilei",
  alocare: "o alocare",
};

type Candidat = Readonly<{ id: string; nr_inmatriculare: string; pool: boolean }>;

async function executa(context: ContextUnealta, argument: unknown): Promise<RezultatUnealta> {
  const parsat = parametri.safeParse(argument);
  if (!parsat.success) return ARGUMENTE_NEVALIDE;
  const cautat =
    parsat.data.nr_inmatriculare === undefined
      ? null
      : normalizeazaNr(parsat.data.nr_inmatriculare);
  if (cautat !== null && cautat.length < NR_MINIM_CARACTERE) {
    return {
      text: "Numărul de înmatriculare dat nu conține destule litere și cifre ca să-l caut.",
    };
  }

  // Fără `cereFisaProprie` în poartă: un `org_admin` fără fișă întocmește foi
  // pentru alții, cu scope `all`, din caseta aplicației („ales”). Caseta din
  // portal oferă însă mereu doar mașinile proprii și pe cele comune, oricare ar
  // fi scope-ul, deci acolo fișa e obligatorie.
  const laToate = context.permisiuni.get("trip_sheets:create") === "all";
  const propriu = context.zona === "portal" || !laToate;
  const { employeeId } = context;
  if (propriu && employeeId === null) {
    return {
      text: "Contul acesta nu are fișă de angajat, deci nu poate întocmi foi pe numele lui.",
    };
  }

  const candidati: readonly Candidat[] =
    !propriu || employeeId === null
      ? (
          await listeazaVehicule(context.organizationId, {
            status: "activ",
            categorie: null,
            conformitate: null,
            cauta: null,
            cursor: null,
            limita: 100,
          })
        ).randuri
      : await vehicululMeu(context.organizationId, employeeId).then(({ alocate, pool }) => [
          ...alocate,
          ...pool,
        ]);

  const potrivite =
    cautat === null ? candidati : candidati.filter((v) => v.nr_inmatriculare.includes(cautat));
  const exact = potrivite.find((v) => v.nr_inmatriculare === cautat);
  const unde = propriu ? "mașina alocată ție și cele comune" : "vehiculele active ale parcului";

  if (potrivite.length === 0) {
    return {
      text:
        cautat === null
          ? "Nu ai nicio mașină pe care să întocmești foaia azi: nici alocată ție, nici comună."
          : `Nu găsesc „${cautat}” printre mașinile pe care poți întocmi foaia azi (${unde}, doar cele active).`,
      referinte: referintePermise(context, ["flota.foi", "portal.masina"]),
    };
  }
  if (exact === undefined && potrivite.length > 1) {
    const lista = potrivite
      .slice(0, MAX_CANDIDATE)
      .map((v) => `- ${v.nr_inmatriculare}${v.pool ? " (mașină comună)" : ""}`);
    const mai = potrivite.length > MAX_CANDIDATE ? "\n…și altele; spune numărul." : "";
    return { text: `Pe care mașină întocmești foaia de azi?\n${lista.join("\n")}${mai}` };
  }
  const vehicul = exact ?? (potrivite[0] as Candidat);
  const azi = context.aziISO;

  // Foaia de azi există deja (vizibilă): o propunem pe ea, nu o casetă nouă,
  // fiindcă baza ține o singură foaie activă pe vehicul și zi (0200).
  const [existenta] = await foiInInterval(context.organizationId, azi, azi, {
    vehicleId: vehicul.id,
    statusuri: ["draft", "trimis", "aprobat"],
  });
  if (existenta !== undefined) {
    const eticheta = existenta.numar ?? `foaia din ${formatDate(azi).slice(0, 5)} (ciornă)`;
    return {
      text: `Foaia de azi pe ${vehicul.nr_inmatriculare} există deja: ${eticheta}, ${STARE[existenta.status] ?? existenta.status}. → foaie.${existenta.id}`,
      destinatiiEfemere: [destinatieFoaie(context.zona, existenta.id, eticheta)],
    };
  }

  const bucati: string[] = [];
  const poateRezerva = meetsScope(context.permisiuni.get("vehicle_reservations:create"), "own");
  if (vehicul.pool && propriu) {
    if (poateRezerva) {
      // F12d: ocuparea de azi a mașinii comune, fără identitatea colegilor.
      const [ocupare, setari] = await Promise.all([
        ocupareaPool(context.organizationId, azi, azi),
        setarileRezervarilor(context.organizationId),
      ]);
      const aleVehiculului = ocupare.filter((o) => o.vehicle_id === vehicul.id);
      const alAltuia = aleVehiculului.find((o) => !o.a_mea);
      if (alAltuia !== undefined) {
        return {
          text: `Azi mașina comună ${vehicul.nr_inmatriculare} e deja ocupată de un coleg (${SURSA[alAltuia.sursa] ?? "o ocupare"}), deci salvarea foii ar fi refuzată. Alege altă mașină sau altă zi.`,
          referinte: referintePermise(context, ["portal.masina.rezervari", "flota.rezervari"]),
        };
      }
      const rezervareConfirmata = aleVehiculului.some(
        (o) => o.a_mea && o.sursa === "rezervare" && o.status === "confirmata",
      );
      // Rezervarea obligatorie nu privește `trip_sheets:create = all` (0216 §8).
      if (setari.obligatorie && !laToate && !rezervareConfirmata) {
        return {
          text: `Firma cere rezervare confirmată pentru mașinile comune, iar azi nu ai una pe ${vehicul.nr_inmatriculare}; salvarea foii ar fi refuzată. Rezervă întâi mașina.`,
          referinte: referintePermise(context, ["portal.masina.rezervari", "flota.rezervari"]),
        };
      }
    } else {
      bucati.push(
        "Dacă un coleg a deschis deja foaia zilei pe mașina comună, salvarea va fi refuzată.",
      );
    }
  }

  // F9: avertisment, nu blocaj (ca decizia din plan): baza nu refuză foaia.
  if (employeeId !== null && meetsScope(context.permisiuni.get("driver_licenses:read"), "own")) {
    const permis = await permisulAngajatului(context.organizationId, employeeId);
    if (permis !== null && permis.expira_la < azi) {
      bucati.push(
        `Atenție: permisul tău de conducere a expirat pe ${formatDate(permis.expira_la)}.`,
      );
    } else if (permis !== null && permis.expira_la === azi) {
      bucati.push("Atenție: permisul tău de conducere expiră azi.");
    }
  }

  const propunere = destinatiePropunereFoaie(context.zona, vehicul.id, vehicul.nr_inmatriculare);
  return {
    text: [
      `Caseta foii noi se deschide cu ${vehicul.nr_inmatriculare} ales; kilometrajul de plecare se completează singur. Verifică și salvează. → ${propunere.id}`,
      ...bucati,
    ].join("\n"),
    destinatiiEfemere: [propunere],
  };
}

export const unealtaPropuneFoaia: Unealta = {
  nume: "propune_foaia_de_azi",
  descriere:
    "Pregătește foaia de parcurs de azi: întoarce un formular precompletat cu mașina aleasă, pe care omul îl verifică și îl salvează singur. Nu creează nimic. Dacă foaia de azi există deja, trimite la ea.",
  parametri,
  featureKey: "fleet",
  permission: "trip_sheets:create",
  minScope: "own",
  executa,
};
