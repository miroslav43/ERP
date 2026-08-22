// src/domain/payroll/contract.ts
//
// Care contract e în vigoare în luna calculată. Funcție PURĂ — datele intră ca
// argument, inclusiv marginile lunii; nu se citește ceasul.
//
// DEFECTUL REPARAT: `angajatiActiviCuContract` alegea contractul cu
// `status = 'activ' && !este_act_aditional` — adică EXCLUDEA actele adiționale.
// O mărire de salariu se înregistrează exact printr-un act adițional (și se
// raportează în REVISAL ca `modificare_salariu`), deci mărirea nu ajungea
// niciodată în calcul: angajatul continua să fie plătit cu salariul din
// contractul inițial, fără nicio eroare.
//
// În această schemă un act adițional NU e un delta, ci un rând complet în
// `employment_contracts` (`salariu_baza`, `norma_ore_zi`, `norma_ore_saptamana`
// sunt `not null` pe orice rând, 0004_hr.sql:284). Contractul efectiv e deci
// pur și simplu rândul aplicabil cel mai recent, nu o fuziune de câmpuri.
//
// LIMITĂ ASUMATĂ: se alege contractul valabil în ULTIMA zi a lunii. O mărire
// intrată în vigoare pe 15 se aplică, deci, întregii luni. Proporționalizarea
// pe fracțiuni de lună cere ca zilele lucrătoare să fie tăiate pe intervale —
// până atunci, cazul e SEMNALAT, nu ascuns (`SAL_CONTRACT_SCHIMBAT_IN_LUNA`).

/** 'AAAA-LL-ZZ' — comparabilă lexicografic, niciodată convertită în `Date`. */
export type ZiIso = string;

export interface ContractCandidat {
  readonly id: string;
  readonly esteActAditional: boolean;
  readonly parentContractId: string | null;
  readonly status: string;
  readonly valabilDeLa: ZiIso;
  readonly valabilPana: ZiIso | null;
  readonly dataContract: ZiIso;
  readonly salariuBaza: number;
  readonly normaOreZi: number;
  readonly normaOreSaptamana: number;
}

export interface ContractEfectiv {
  /** Rândul care dă termenii — actul adițional, dacă există unul aplicabil. */
  readonly contractId: string;
  /** Contractul de bază al lanțului, cel raportat în REVISAL. */
  readonly contractDeBazaId: string;
  readonly salariuBaza: number;
  readonly normaOreZi: number;
  readonly normaOreSaptamana: number;
  /** Termenii s-au schimbat pe parcursul lunii, iar luna NU a fost proporționalizată. */
  readonly schimbatInLuna: boolean;
}

const esteActiv = (c: ContractCandidat): boolean => c.status === "activ";

const aplicabilLa = (c: ContractCandidat, zi: ZiIso): boolean =>
  c.valabilDeLa <= zi && (c.valabilPana === null || c.valabilPana >= zi);

/**
 * Ordonare deterministă: cel mai recent intrat în vigoare câștigă; la egalitate
 * decide data semnării, apoi actul adițional în fața contractului de bază, apoi
 * identificatorul. Fără ultimul criteriu, două acte adiționale înregistrate în
 * aceeași zi ar alege la întâmplare — și ar da alt salariu la fiecare recalcul.
 */
function maiRecent(a: ContractCandidat, b: ContractCandidat): number {
  if (a.valabilDeLa !== b.valabilDeLa) return a.valabilDeLa < b.valabilDeLa ? -1 : 1;
  if (a.dataContract !== b.dataContract) return a.dataContract < b.dataContract ? -1 : 1;
  if (a.esteActAditional !== b.esteActAditional) return a.esteActAditional ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function alegeLa(candidati: readonly ContractCandidat[], zi: ZiIso): ContractCandidat | null {
  const aplicabile = candidati.filter((c) => aplicabilLa(c, zi));
  if (aplicabile.length === 0) return null;
  return [...aplicabile].sort(maiRecent)[aplicabile.length - 1] ?? null;
}

/**
 * Contractul în vigoare în luna dată, sau `null` dacă angajatul n-are niciun
 * contract activ care să acopere sfârșitul lunii (angajat care pleacă înainte
 * de finalul lunii sau al cărui contract începe abia luna viitoare).
 *
 * `contracte` sunt TOATE rândurile angajatului — de bază și acte adiționale.
 * Filtrarea pe lanțul contractului de bază se face aici: un act adițional
 * atârnat de alt contract nu are ce căuta în calcul.
 */
export function contractEfectiv(
  contracte: readonly ContractCandidat[],
  primaZiALunii: ZiIso,
  ultimaZiALunii: ZiIso,
): ContractEfectiv | null {
  const active = contracte.filter(esteActiv);
  // Indexul unic parțial `contracts_employee_activ_uniq` (0004_hr.sql:346)
  // garantează cel mult un contract de bază activ per angajat.
  const baza = active.find((c) => !c.esteActAditional);
  if (baza === undefined) return null;

  const lant = active.filter((c) => !c.esteActAditional || c.parentContractId === baza.id);

  // Fereastra „intersectează luna", nu „acoperă ultima zi": un contract pe
  // durată determinată care expiră pe 15 trebuie totuși PLĂTIT pentru zilele
  // lucrate. Dacă am cere valabilitate în ultima zi, oricine pleacă la mijlocul
  // lunii ar rămâne fără contract efectiv, iar salarizarea s-ar bloca pe el.
  const intersecteazaLuna = lant.filter(
    (c) =>
      c.valabilDeLa <= ultimaZiALunii && (c.valabilPana === null || c.valabilPana >= primaZiALunii),
  );
  if (intersecteazaLuna.length === 0) return null;

  const laInceput = alegeLa(lant, primaZiALunii);
  const laSfarsit =
    alegeLa(lant, ultimaZiALunii) ??
    [...intersecteazaLuna].sort(maiRecent)[intersecteazaLuna.length - 1];
  if (laSfarsit === undefined) return null;

  return {
    contractId: laSfarsit.id,
    contractDeBazaId: baza.id,
    salariuBaza: laSfarsit.salariuBaza,
    normaOreZi: laSfarsit.normaOreZi,
    normaOreSaptamana: laSfarsit.normaOreSaptamana,
    schimbatInLuna: laInceput !== null && laInceput.id !== laSfarsit.id,
  };
}
