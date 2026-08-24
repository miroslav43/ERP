// src/domain/departments/arbore.ts
/**
 * Construcția arborelui de departamente, separată de ecran.
 *
 * A trăit în `departamente/page.tsx`, unde nu putea fi testată și de unde ar fi
 * fost copiată a doua oară pentru organigramă. Aici e pură: primește rânduri, dă
 * noduri, nu știe nimic despre Supabase și nici despre React.
 *
 * Două lucruri pe care le garantează și care nu se văd din semnătură:
 *
 * 1. **Niciun rând nu se pierde.** Un nod al cărui părinte nu e în setul primit
 *    — șters logic, sau invizibil prin RLS — urcă la rădăcină. Alternativa (să
 *    fie sărit) ar face ca un departament întreg să dispară de pe ecran fără
 *    nicio eroare.
 * 2. **Nu intră în buclă infinită.** Trigger-ul `tg_departments_path` respinge
 *    ciclurile în bază, dar funcția asta nu-l poate invoca drept garanție:
 *    primește ce i se dă. Setul `vizitate` oprește recursia, iar bucla de la
 *    final promovează la rădăcină orice nod rămas neatins.
 *
 * Nu e o ierarhie de OAMENI. `parent_id` leagă departamente între ele;
 * `manager_employee_id` de pe fișa angajatului leagă oameni de oameni, și e
 * arborele afișat de `/organigrama`. Cele două se pot contrazice legitim — un om
 * poate raporta la cineva din alt departament — deci nu se deduc una din alta.
 */

export interface RandArbore {
  readonly id: string;
  readonly parent_id: string | null;
}

export interface NodArbore<T extends RandArbore> {
  readonly date: T;
  readonly copii: readonly NodArbore<T>[];
  /** 1 pentru rădăcini. Folosit de indentarea din vizualizarea listă. */
  readonly nivel: number;
  /** Angajați repartizați FIX în acest departament. */
  readonly efectivDirect: number;
  /** Efectivul direct plus al tuturor descendenților. */
  readonly efectivCumulat: number;
}

export function construiesteArbore<T extends RandArbore>(
  randuri: readonly T[],
  efectivPeDepartament: ReadonlyMap<string, number>,
): readonly NodArbore<T>[] {
  const existente = new Set(randuri.map((r) => r.id));

  const copiiPeParinte = new Map<string, T[]>();
  const radacini: T[] = [];
  for (const r of randuri) {
    const areParinteVizibil = r.parent_id !== null && existente.has(r.parent_id);
    if (!areParinteVizibil) {
      radacini.push(r);
      continue;
    }
    const cheie = r.parent_id as string;
    const lista = copiiPeParinte.get(cheie);
    if (lista === undefined) copiiPeParinte.set(cheie, [r]);
    else lista.push(r);
  }

  const vizitate = new Set<string>();

  function construieste(r: T, nivel: number): NodArbore<T> {
    vizitate.add(r.id);
    const copii = (copiiPeParinte.get(r.id) ?? [])
      .filter((c) => !vizitate.has(c.id))
      .map((c) => construieste(c, nivel + 1));
    const efectivDirect = efectivPeDepartament.get(r.id) ?? 0;
    return {
      date: r,
      copii,
      nivel,
      efectivDirect,
      efectivCumulat: copii.reduce((total, c) => total + c.efectivCumulat, efectivDirect),
    };
  }

  const arbore = radacini.map((r) => construieste(r, 1));

  // Coada pentru cicluri: un nod prins într-un ciclu nu e rădăcină (are părinte
  // vizibil) și nu e atins de nicio recursie pornită dintr-o rădăcină.
  //
  // Bucla verifică `vizitate` la FIECARE iterație, nu o dată la început:
  // `construieste` marchează pe parcurs, iar un `.filter().map()` ar evalua
  // filtrul integral ÎNAINTE de prima construcție — deci al doilea nod al
  // aceluiași ciclu ar fi construit a doua oară, ca rădăcină duplicată.
  const suplimentare: NodArbore<T>[] = [];
  for (const r of randuri) {
    if (!vizitate.has(r.id)) suplimentare.push(construieste(r, 1));
  }
  return [...arbore, ...suplimentare];
}
