import { PERIOADE, PERIOADE_2026, type Perioada } from "@/content/legal/salarizare-publica";
import { calculeazaDinBrut, dinNet, OPTIUNI_IMPLICITE } from "@/lib/unelte/salariu";

/**
 * Tabelele fixe ale paginii, calculate de același motor ca rezultatul, ca
 * pagina să nu se poată contrazice. Răspund direct la căutările „salariul minim
 * 2026”, „5000 brut în net”, „brut din net 4000”. Fiecare rând duce la calculul
 * complet (`?suma=`), iar canonicalul rămâne pagina fără parametri. Paginile
 * separate pe sume (ca la concurență) nu se fac: conținut subțire, care ar
 * canibaliza canonicalul și ghidul salariului minim.
 */

export type ColoanaSalariuMinim = Readonly<{
  perioada: Perioada;
  eticheta: string;
  brut: number;
  oreLuna: string;
  leiPeOra: string;
  act: string;
  neimpozabil: number;
  net: number;
  costTotal: number;
}>;

export function salariulMinim2026(): readonly ColoanaSalariuMinim[] {
  return PERIOADE.map((perioada) => {
    const v = PERIOADE_2026[perioada];
    const r = calculeazaDinBrut(v.salariuMinim, { ...OPTIUNI_IMPLICITE, perioada });
    return {
      perioada,
      eticheta: v.eticheta,
      brut: v.salariuMinim,
      oreLuna: v.oreLunaMedie,
      leiPeOra: v.leiPeOra,
      act: v.actSalariuMinim,
      neimpozabil: r.sumaNeimpozabila,
      net: r.net,
      costTotal: r.costTotal,
    };
  });
}

export const TREPTE_BRUT = [
  4325, 4500, 5000, 5500, 6000, 6500, 7000, 8000, 9000, 10000, 12000, 15000, 20000,
] as const;
export const TREPTE_NET = [3000, 3500, 4000, 5000, 6000, 7000] as const;

export type RandBrutNet = Readonly<{
  brut: number;
  net: number;
  netDouaPersoane: number;
  costTotal: number;
}>;

/** Brut → net în iulie–decembrie 2026, fără persoane și cu două persoane în întreținere. */
export function grilaBrutNet(): readonly RandBrutNet[] {
  return TREPTE_BRUT.map((brut) => {
    const r = calculeazaDinBrut(brut, OPTIUNI_IMPLICITE);
    return {
      brut,
      net: r.net,
      netDouaPersoane: calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, persoane: 2 }).net,
      costTotal: r.costTotal,
    };
  });
}

export type RandNetBrut = Readonly<{ net: number; brut: number; costTotal: number }>;

/** Net → brut în iulie–decembrie 2026, fără persoane. */
export function grilaNetBrut(): readonly RandNetBrut[] {
  return TREPTE_NET.map((net) => {
    const r = dinNet(net, 0, true);
    return { net, brut: r.brut, costTotal: r.costTotal };
  });
}
