// src/lib/queries/revisal.ts
import { randomUUID } from "node:crypto";
import { mapPostgrestError } from "@/lib/actions/errors";
import { todayInBucharest } from "@/lib/format/date";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/tenant/types";
import {
  evalueazaTermen,
  type StareTermen,
  type StatusRevisal,
  type TipEvenimentRevisal,
  type ZiIso,
} from "@/domain/revisal/evenimente";

/**
 * Singurul loc din modulele REVISAL care depinde de forma exactă a lui `Tenant`.
 * Dacă în Faza 1a câmpul are alt nume, se corectează aici, o dată.
 */
export function idOrganizatie(tenant: Tenant): string {
  return tenant.organizationId;
}

export type FiltruStare = "toate" | "intarziate" | "de_transmis" | "transmise";

export interface FiltreRevisal {
  readonly stare: FiltruStare;
  readonly tip: TipEvenimentRevisal | "toate";
  readonly limita: number;
}

export const FILTRE_IMPLICITE: FiltreRevisal = { stare: "toate", tip: "toate", limita: 100 };

export interface RandRevisal {
  readonly id: string;
  readonly tip: TipEvenimentRevisal;
  readonly dataEvenimentului: ZiIso;
  readonly termenTransmitere: ZiIso;
  readonly status: StatusRevisal;
  readonly stare: StareTermen;
  readonly zileRamase: number;
  readonly zileIntarziere: number;
  readonly transmisLa: string | null;
  readonly numarInregistrare: string | null;
  readonly eroare: string | null;
  readonly angajatId: string;
  readonly angajatNume: string;
  readonly angajatMarca: string;
  readonly contractNumar: string | null;
}

export interface StatisticiRevisal {
  readonly intarziate: number;
  readonly astazi: number;
  readonly inTermen: number;
  readonly transmise: number;
}

export interface RezultatRevisal {
  readonly randuri: readonly RandRevisal[];
  readonly statistici: StatisticiRevisal;
  readonly azi: ZiIso;
}

/** Statusurile care nu s-au transmis încă — aceleași pe care `evalueazaTermen` le evaluează față de termen. */
const STATUSURI_NETRANSMISE = ["de_pregatit", "pregatit", "respins"] as const;
const STATUSURI_TRANSMISE = ["transmis", "confirmat"] as const;

/**
 * Cele patru cifre din capul ecranului, numărate în bază, pe TOT registrul.
 *
 * Erau calculate cu `randuri.reduce(...)` peste setul deja filtrat și deja
 * tăiat la `filtre.limita` (100). Efectul: pe filtrul „Transmise”, fișa
 * „Întârziate” arăta 0 chiar cu evenimente întârziate în registru, iar peste
 * 100 de evenimente toate patru erau mai mici decât realitatea — fără nicio
 * eroare. Într-un registru unde netransmiterea în termen e contravenție
 * separată pentru fiecare salariat, cifra mică e mai rea decât lipsa cifrei.
 *
 * `head: true` nu aduce niciun rând, deci plafonul PostgREST de 1000 nu atinge
 * numărătoarea; `count: "exact"` e singura variantă care nu estimează.
 */
async function numaraStatistici(
  supabase: ServerSupabase,
  organizationId: string,
  azi: ZiIso,
): Promise<StatisticiRevisal> {
  const baza = () =>
    supabase
      .from("revisal_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

  const [intarziate, astazi, inTermen, transmise] = await Promise.all([
    baza().in("status", STATUSURI_NETRANSMISE).lt("termen_transmitere", azi),
    baza().in("status", STATUSURI_NETRANSMISE).eq("termen_transmitere", azi),
    baza().in("status", STATUSURI_NETRANSMISE).gt("termen_transmitere", azi),
    baza().in("status", STATUSURI_TRANSMISE),
  ]);

  for (const rezultat of [intarziate, astazi, inTermen, transmise]) {
    if (rezultat.error) throw mapPostgrestError(rezultat.error, randomUUID());
  }

  return {
    intarziate: intarziate.count ?? 0,
    astazi: astazi.count ?? 0,
    inTermen: inTermen.count ?? 0,
    transmise: transmise.count ?? 0,
  };
}

const SELECT_EVENIMENTE =
  "id, event_type, data_evenimentului, termen_transmitere, status, transmis_la, numar_inregistrare, eroare, employee_id, contract_id";

export async function interogheazaEvenimenteRevisal(
  supabase: ServerSupabase,
  organizationId: string,
  filtre: FiltreRevisal,
): Promise<RezultatRevisal> {
  const azi: ZiIso = todayInBucharest();

  let cerere = supabase
    .from("revisal_events")
    .select(SELECT_EVENIMENTE)
    .eq("organization_id", organizationId) // apărare în adâncime; RLS filtrează oricum
    .is("deleted_at", null)
    .order("termen_transmitere", { ascending: true })
    .limit(filtre.limita);

  if (filtre.tip !== "toate") cerere = cerere.eq("event_type", filtre.tip);
  if (filtre.stare === "transmise") {
    cerere = cerere.in("status", STATUSURI_TRANSMISE);
  } else if (filtre.stare === "de_transmis" || filtre.stare === "intarziate") {
    cerere = cerere.in("status", STATUSURI_NETRANSMISE);
    if (filtre.stare === "intarziate") cerere = cerere.lt("termen_transmitere", azi);
  }

  // Sinteza pleacă în paralel cu lista: nu depinde de filtru, deci nu are de ce
  // să aștepte răspunsul lui.
  const [{ data, error }, statistici] = await Promise.all([
    cerere,
    numaraStatistici(supabase, organizationId, azi),
  ]);
  if (error) throw mapPostgrestError(error, randomUUID());
  const evenimente = data ?? [];

  const idAngajati = [...new Set(evenimente.map((e) => e.employee_id))];
  const idContracte = [
    ...new Set(evenimente.map((e) => e.contract_id).filter((id): id is string => id !== null)),
  ];

  const [angajati, contracte] = await Promise.all([
    idAngajati.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("employees").select("id, full_name, marca").in("id", idAngajati),
    idContracte.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("employment_contracts").select("id, numar").in("id", idContracte),
  ]);

  if (angajati.error) throw mapPostgrestError(angajati.error, randomUUID());
  if (contracte.error) throw mapPostgrestError(contracte.error, randomUUID());

  const numeAngajat = new Map((angajati.data ?? []).map((a) => [a.id, a]));
  const numarContract = new Map((contracte.data ?? []).map((c) => [c.id, c.numar]));

  const randuri: RandRevisal[] = evenimente.map((eveniment) => {
    const status = eveniment.status as StatusRevisal;
    const evaluare = evalueazaTermen(eveniment.termen_transmitere, azi, status);
    const angajat = numeAngajat.get(eveniment.employee_id);
    return {
      id: eveniment.id,
      tip: eveniment.event_type as TipEvenimentRevisal,
      dataEvenimentului: eveniment.data_evenimentului,
      termenTransmitere: eveniment.termen_transmitere,
      status,
      stare: evaluare.stare,
      zileRamase: evaluare.zileRamase,
      zileIntarziere: evaluare.zileIntarziere,
      transmisLa: eveniment.transmis_la,
      numarInregistrare: eveniment.numar_inregistrare,
      eroare: eveniment.eroare,
      angajatId: eveniment.employee_id,
      angajatNume: angajat?.full_name ?? "Angajat șters",
      angajatMarca: angajat?.marca ?? "—",
      contractNumar:
        eveniment.contract_id === null ? null : (numarContract.get(eveniment.contract_id) ?? null),
    };
  });

  return { randuri, statistici, azi };
}
