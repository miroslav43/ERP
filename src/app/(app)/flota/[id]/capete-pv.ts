// src/app/(app)/flota/[id]/capete-pv.ts
//
// Ce proces-verbal are fiecare capăt de alocare: predarea (la `de_la`) și
// restituirea (la `pana_la`). Pur, fără I/O; îl folosesc celula din tabelul de
// alocări și caseta „PV nou” deschisă prin parametru.
//
// ── TRANSFERUL ───────────────────────────────────────────────────────────────
// Când predarea către B a închis alocarea lui A (regula 2 din 0173), cele două
// capete sunt lipite: `A.pana_la = B.de_la`. Atunci predarea lui B și restituirea
// lui A sunt UN singur document, transferul — exact regula din
// `internal.pv_vehicul_inainte`. `alocaVehicul` NU întoarce id-ul alocării
// închise (DL13: `flota/actions.ts` rămâne neatins), deci pagina găsește aici
// singură predecesorul, din alocările deja citite.
//
// Două alocări lipite ale ACELUIAȘI om (o realocare făcută doar ca să schimbe
// `folosinta_personala`) nu sunt o predare: baza refuză transferul A → A
// (DL15), iar ecranul nu propune PV pe asemenea capete.

import type { AlocareVehicul } from "@/lib/queries/fleet";
import type { RandPv } from "@/lib/queries/fleet-pv";

export type AlocarePentruPv = Readonly<{
  id: string;
  employee_id: string;
  de_la: string;
  pana_la: string | null;
  sofer: string | null;
}>;

export type CapatPv = Readonly<{
  /** PV-ul viu (neanulat) al capătului, sau `null`. */
  pv: RandPv | null;
  /** Parametrii casetei „PV nou” pentru capătul ăsta, sau `null` când nu se propune. */
  nou: Readonly<{ predata: string | null; primita: string | null }> | null;
  /** Celălalt șofer al transferului, când capătul e lipit de alocarea altuia. */
  transferCu: string | null;
  /** Capăt lipit de o alocare a ACELUIAȘI om: nu e o predare. */
  acelasiSofer: boolean;
}>;

export type CapeteAlocare = Readonly<{
  predare: CapatPv;
  /** `null` cât alocarea e deschisă: restituirea n-a avut loc. */
  restituire: CapatPv | null;
}>;

const acelasiMoment = (a: string, b: string): boolean => Date.parse(a) === Date.parse(b);

export function capetePv(
  alocari: readonly AlocarePentruPv[],
  pvuri: readonly RandPv[],
): ReadonlyMap<string, CapeteAlocare> {
  const vii = pvuri.filter((p) => p.anulat_la === null);
  const harta = new Map<string, CapeteAlocare>();

  for (const a of alocari) {
    const predecesor =
      alocari.find(
        (b) => b.id !== a.id && b.pana_la !== null && acelasiMoment(b.pana_la, a.de_la),
      ) ?? null;
    const pvPredare = vii.find((p) => p.alocare_primita_id === a.id) ?? null;
    const predareLipitaDeAcelasi = predecesor !== null && predecesor.employee_id === a.employee_id;
    const predare: CapatPv = {
      pv: pvPredare,
      nou:
        pvPredare !== null || predareLipitaDeAcelasi
          ? null
          : { predata: predecesor?.id ?? null, primita: a.id },
      transferCu: predecesor !== null && !predareLipitaDeAcelasi ? (predecesor.sofer ?? "—") : null,
      acelasiSofer: predareLipitaDeAcelasi,
    };

    let restituire: CapatPv | null = null;
    if (a.pana_la !== null) {
      const sfarsit = a.pana_la;
      const succesor =
        alocari.find((b) => b.id !== a.id && acelasiMoment(b.de_la, sfarsit)) ?? null;
      const pvRestituire = vii.find((p) => p.alocare_predata_id === a.id) ?? null;
      const lipitaDeAcelasi = succesor !== null && succesor.employee_id === a.employee_id;
      restituire = {
        pv: pvRestituire,
        nou:
          pvRestituire !== null || lipitaDeAcelasi
            ? null
            : { predata: a.id, primita: succesor?.id ?? null },
        transferCu: succesor !== null && !lipitaDeAcelasi ? (succesor.sofer ?? "—") : null,
        acelasiSofer: lipitaDeAcelasi,
      };
    }
    harta.set(a.id, { predare, restituire });
  }
  return harta;
}

/** Câte capete (predări și restituiri) n-au PV viu și ar trebui să aibă. Semnalul din D3 (a). */
export function capeteFaraPv(capete: ReadonlyMap<string, CapeteAlocare>): number {
  let n = 0;
  for (const { predare, restituire } of capete.values()) {
    if (predare.nou !== null) n += 1;
    // Transferul se numără o singură dată: pe capătul de predare al succesorului.
    if (restituire !== null && restituire.nou !== null && restituire.transferCu === null) n += 1;
  }
  return n;
}

/** Adresa casetei „PV nou” pe fișa vehiculului. */
export function hrefPvNou(
  vehiculId: string,
  nou: Readonly<{ predata: string | null; primita: string | null }>,
): string {
  const p = new URLSearchParams({ pv: "nou" });
  if (nou.predata !== null) p.set("predata", nou.predata);
  if (nou.primita !== null) p.set("primita", nou.primita);
  return `/flota/${vehiculId}?${p.toString()}`;
}

/**
 * Parametrii casetei, din URL, completați cu capătul lipit: un `?pv=nou&primita=X`
 * venit după `alocaVehicul` devine transfer dacă alocarea lui X a închis-o pe
 * a altui om. `null` = parametrii nu desemnează un capăt al acestui vehicul.
 */
export function capatDinParametri(
  capete: ReadonlyMap<string, CapeteAlocare>,
  predata: string | null,
  primita: string | null,
): Readonly<{ predata: string | null; primita: string | null }> | null {
  if (primita !== null) {
    const nou = capete.get(primita)?.predare.nou ?? null;
    if (nou === null) return null;
    return predata === null || predata === nou.predata ? nou : null;
  }
  if (predata !== null) return capete.get(predata)?.restituire?.nou ?? null;
  return null;
}

/** Alocarea vine din backfill-ul din 0173 (`de_la` aproximat din `data_achizitie`). */
export function eAlocareDinIstoric(observatii: string | null): boolean {
  return observatii?.startsWith("Alocare preluată din fișa vehiculului") ?? false;
}

/** „Predare de la firmă către X”, „Transfer de la X către Y” — descrierea casetei. */
export function descriereParti(predator: string | null, primitor: string | null): string {
  if (predator !== null && primitor !== null) return `Transfer de la ${predator} către ${primitor}`;
  if (primitor !== null) return `Predare de la firmă către ${primitor}`;
  if (predator !== null) return `Restituire de la ${predator} către firmă`;
  return "Proces-verbal de predare-primire";
}

/** `capetePv` pe alocările citite de fișa vehiculului (`alocarileVehiculului`). */
export function capeteVehiculului(
  alocari: readonly AlocareVehicul[],
  pvuri: readonly RandPv[],
): ReadonlyMap<string, CapeteAlocare> {
  return capetePv(
    alocari.map((a) => ({
      id: a.id,
      employee_id: a.employee_id,
      de_la: a.de_la,
      pana_la: a.pana_la,
      sofer: a.sofer?.full_name ?? null,
    })),
    pvuri,
  );
}
