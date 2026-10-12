// src/domain/attendance/totaluri.ts
/**
 * Totalurile de ore ale unei liste de zile pontate — ȘI regula despre ce
 * intră în ele.
 *
 * ── DE CE EXISTĂ (HR-013) ─────────────────────────────────────────────────
 * Ziua respinsă de aprobator ieșea din aprobare (`liniiDeAprobat` filtrează
 * `respins_la is null`), legenda foii o arăta „tăiată”, dar orele ei intrau în
 * „Ore”, „Supl.” și „Noapte”. Adunarea era scrisă de CINCI ori — de trei ori în
 * foaia colectivă (coloană, rând, total general), o dată pe pagina de start a
 * portalului și o dată în „Pontajul meu” — și nicăieri nu se uita la respingere.
 * Un total din care ziua respinsă iese într-un loc și rămâne în altul e mai rău
 * decât unul greșit peste tot: nu se mai pot compara cifrele.
 *
 * Respingerea nu șterge ziua (`public.decide_zi_pontaj`, 0067): ea rămâne pe
 * ecran, cu motivul, fiindcă e declarația omului și omul trebuie s-o corecteze.
 * Dar până o corectează, orele ei NU sunt ore ale firmei.
 *
 * Funcții PURE: primesc forma minimă, nu rândul din bază — foaia colectivă
 * lucrează pe `IntrareZiClient` (camelCase), portalul pe `ZiPontaj` (coloanele
 * din Postgres). `ziDeTotalizat` e adaptorul pentru al doilea.
 */

/** Ce trebuie știut despre o zi ca să se decidă dacă intră în totaluri. */
export interface ZiDeTotalizat {
  readonly oreLucrate: number;
  readonly oreSuplimentare: number;
  readonly oreNoapte: number;
  /** `respins_la is not null` — aprobatorul a cerut o corecție. */
  readonly respinsa: boolean;
}

export interface TotaluriOre {
  readonly lucrate: number;
  readonly suplimentare: number;
  readonly noapte: number;
}

/** O zi contează în totaluri cât timp nu e respinsă. Nedecisă sau aprobată, contează. */
export function conteazaInTotaluri(zi: Readonly<{ respinsa: boolean }>): boolean {
  return !zi.respinsa;
}

/** Sumele se rotunjesc la sutime, ca `verificaSold`: sferturile de oră în binar nu se adună exact. */
function laSutime(valoare: number): number {
  return Math.round(valoare * 100) / 100;
}

/** Totalurile zilelor care contează. Lista goală dă zerouri. */
export function totalurileZilelor(zile: readonly ZiDeTotalizat[]): TotaluriOre {
  let lucrate = 0;
  let suplimentare = 0;
  let noapte = 0;
  for (const zi of zile) {
    if (!conteazaInTotaluri(zi)) continue;
    lucrate += zi.oreLucrate;
    suplimentare += zi.oreSuplimentare;
    noapte += zi.oreNoapte;
  }
  return {
    lucrate: laSutime(lucrate),
    suplimentare: laSutime(suplimentare),
    noapte: laSutime(noapte),
  };
}

/**
 * Rândul din `attendance_entries`, așa cum îl citește portalul (`pontajulMeu`),
 * adus la forma de totalizat. Orele nule — zi deschisă cu ceasul și
 * neînchisă, sau absență — sunt zero ore.
 */
export function ziDeTotalizat(
  rand: Readonly<{
    ore_lucrate: number | null;
    ore_suplimentare: number | null;
    ore_noapte: number | null;
    respins_la: string | null;
  }>,
): ZiDeTotalizat {
  return {
    oreLucrate: rand.ore_lucrate ?? 0,
    oreSuplimentare: rand.ore_suplimentare ?? 0,
    oreNoapte: rand.ore_noapte ?? 0,
    respinsa: rand.respins_la !== null,
  };
}
