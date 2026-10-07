// src/app/(app)/mentenanta/sesizari/[id]/date-sesizare.ts
import "server-only";

import type { ActorSesizare } from "@/domain/maintenance/sesizari";
import {
  angajatiDupaId,
  angajatiDupaUserId,
  atasamente,
  citesteInterventie,
  citesteSesizare,
  comentariiSesizare,
  istoricSesizare,
  opririSesizare,
  urlSemnate,
  type AngajatRezumat,
  type Atasament,
  type ComentariuSesizare,
  type IstoricSesizare,
  type Oprire,
  type RandInterventie,
  type RandSesizare,
} from "@/lib/queries/maintenance";
import { fisaMea } from "@/lib/queries/portal";

import { cautaEchipament, type EchipamentCautat } from "../../actions";

/**
 * Tot ce are nevoie fișa unei sesizări, încărcat o dată — pentru pagina din
 * aplicație ȘI pentru cea din portal, care arată aceeași fișă cu drepturi
 * diferite. Ce nu are voie să vadă apelantul lipsește din bază, nu de aici:
 * notele interne, intervenția cu costuri și numele colegilor le filtrează RLS.
 */
export interface DateSesizare {
  readonly sesizare: RandSesizare;
  readonly echipament: EchipamentCautat | null;
  readonly interventie: RandInterventie | null;
  readonly comentarii: readonly ComentariuSesizare[];
  readonly istoric: readonly IstoricSesizare[];
  readonly atasamente: readonly Atasament[];
  /** `storage_path` → URL semnat (10 minute). */
  readonly urluri: ReadonlyMap<string, string>;
  readonly opriri: readonly Oprire[];
  /** Nume după id de FIȘĂ (raportor, tehnician, executant, autori). */
  readonly numeAngajati: ReadonlyMap<string, AngajatRezumat>;
  /** Nume după id de CONT (actorii din istoric, autorii fără fișă). */
  readonly numeUtilizatori: ReadonlyMap<string, AngajatRezumat>;
  /** Sesizarea originală, când aceasta a fost respinsă ca duplicat. */
  readonly original: RandSesizare | null;
  /** Fișa principală a apelantului; `null` pentru un cont fără fișă. */
  readonly fisaId: string | null;
}

export async function incarcaFisaSesizare(
  organizationId: string,
  id: string,
  userId: string,
): Promise<DateSesizare | null> {
  const sesizare = await citesteSesizare(organizationId, id);
  if (sesizare === null) return null;

  // Un singur val de citiri independente; fiecare e un dus-întors spre
  // PostgREST, deci serializate ar fi costat de opt ori latența.
  const [
    echipamentRezultat,
    interventie,
    comentarii,
    istoric,
    fisiere,
    opriri,
    stareFisa,
    original,
  ] = await Promise.all([
    // `equipment` cere `team` pentru un `employee` (capcana #27); acțiunea de
    // căutare, cu id exact, întoarce exact rândul, cu client admin filtrat pe
    // organizație — același drum ca prefill-ul din QR.
    cautaEchipament({ q: sesizare.equipment_id }),
    sesizare.intervention_id === null
      ? Promise.resolve(null)
      : citesteInterventie(organizationId, sesizare.intervention_id),
    comentariiSesizare(organizationId, id),
    istoricSesizare(organizationId, id),
    atasamente(organizationId, "fault_report", id),
    opririSesizare(organizationId, id),
    fisaMea(organizationId, userId),
    sesizare.duplicat_al_id === null
      ? Promise.resolve(null)
      : citesteSesizare(organizationId, sesizare.duplicat_al_id),
  ]);

  const idFise = [
    sesizare.raportat_de_employee_id,
    sesizare.atribuit_employee_id,
    interventie?.executant_employee_id ?? null,
    ...comentarii.map((c) => c.autor_employee_id),
    // Istoricul atribuirii reține id-urile de fișă ca text.
    ...istoric
      .filter((i) => i.camp === "atribuit_employee_id")
      .flatMap((i) => [i.valoare_veche, i.valoare_noua]),
  ].filter((v): v is string => v !== null);
  const idConturi = [
    sesizare.raportat_de_user_id,
    ...comentarii.map((c) => c.autor_user_id),
    ...istoric.map((i) => i.actor_user_id),
  ].filter((v): v is string => v !== null);

  const [numeAngajati, numeUtilizatori, urluri] = await Promise.all([
    angajatiDupaId(organizationId, idFise),
    angajatiDupaUserId(organizationId, idConturi),
    urlSemnate(fisiere),
  ]);

  return {
    sesizare,
    echipament:
      echipamentRezultat.ok && echipamentRezultat.data.length > 0
        ? (echipamentRezultat.data[0] ?? null)
        : null,
    interventie,
    comentarii,
    istoric,
    atasamente: fisiere,
    urluri,
    opriri,
    numeAngajati,
    numeUtilizatori,
    original,
    fisaId: stareFisa.stare === "ok" ? stareFisa.fisa.id : null,
  };
}

/** Cine e apelantul față de această sesizare — intrarea mașinii de stări. */
export function actorPentru(
  date: DateSesizare,
  poateGestiona: boolean,
  userId: string,
): ActorSesizare {
  const { sesizare, fisaId } = date;
  const esteRaportor =
    (fisaId !== null && sesizare.raportat_de_employee_id === fisaId) ||
    sesizare.raportat_de_user_id === userId;
  const esteTehnician = fisaId !== null && sesizare.atribuit_employee_id === fisaId;
  return { poateGestiona, esteRaportor, esteTehnician };
}
