// src/domain/payroll/etape/facilitate-salariu-minim.ts
//
// Suma neimpozabilă de la salariul minim — OUG 89/2025 art. III, etapă pură din
// lanțul de salarizare.
//
// ── TEXTUL ──────────────────────────────────────────────────────────────────
// Citit cu `curl` (reverificat pe 21 oct 2026), forma consolidată la
// 16.08.2026, legislatie.just.ro doc. 305817 (cea mai nouă din istoricul de
// consolidări):
//   alin. (1) — salariaților cu CIM „încadrați cu normă întreagă, la locul unde
//     se află funcția de bază” nu li se datorează impozit și contribuții sociale
//     pentru 300 lei/lună (ian.–iun. 2026) și 200 lei/lună (iul.–dec. 2026),
//     dacă, cumulativ:
//     a) salariul de bază brut lunar din contract, fără sporuri, e EGAL cu
//        salariul minim în vigoare în luna veniturilor;
//     b) venitul brut din salarii al lunii, din același contract, FĂRĂ tichete
//        de masă, vouchere de vacanță și indemnizație de hrană, e de cel mult
//        4.300 lei (ian.–iun.), respectiv 4.600 lei (iul.–dec.), inclusiv.
//     Derogarea e de la art. 78 (impozit), 139 alin. (1) și 140 (baza CAS),
//     157 alin. (1) (baza CASS) și 220^4 alin. (1) (baza CAM) — NU și de la
//     art. 77: deducerea personală se ia pe brutul întreg.
//   alin. (2) — un salariu de bază diminuat în 2026 pierde condiția a);
//   alin. (4) — suma se diminuează după perioada din lună la minim, data
//     angajării, fracția din lună pentru care se determină venitul și data
//     încetării;
//   alin. (5) — salariul minim folosit ca bază minimă la timp parțial
//     (art. 146 alin. (5^6), art. 168 alin. (6^1)) scade cu aceeași sumă;
//   alin. (6) — se aplică doar veniturilor din ianuarie–decembrie 2026.
// Salariul minim: 4.050 lei până la 30 iunie 2026 (HG 1.506/2024 art. 1,
// abrogată de HG 146/2026 art. 2), 4.325 lei din 1 iulie 2026 (HG 146/2026
// art. 1, MO 196 din 13.03.2026).
//
// ── DE CE UN TABEL ÎN COD ȘI NU O SETARE A FIRMEI ──────────────────────────
// E o derogare NAȚIONALĂ, cu dată de expirare. O prelungire cere oricum un act
// normativ citit și un test. Condiția a) se compară cu minimul din tabel, nu cu
// `payroll_settings.salariu_minim_brut`: o firmă care a uitat să-și actualizeze
// setarea în iulie nu trebuie să piardă tăcut facilitatea.
//
// ── CE PRESUPUNE ETAPA (⚠ NOTES.md §3) ────────────────────────────────────
//   · fracția din alin. (4) = zile cu venit salarial (lucrate + concediu de
//     odihnă) / zile lucrătoare; zilele de concediu medical NU intră;
//   · suma se rotunjește la ban, nu la leu;
//   · funcția de bază și „salariul nediminuat în 2026” vin de la apelant —
//     aplicația nu are încă niciun câmp pentru ele.
//
// Funcție PURĂ: luna vine ca dată („AAAA-LL”), niciodată din ceasul de sistem.

import { rotunjesteLaBani } from "../../bani";
import type { ProblemaEtapa } from "./probleme";

export type { ProblemaEtapa };

export interface PerioadaFacilitateSalariuMinim {
  /** Prima zi a perioadei, „AAAA-LL-ZZ”, inclusiv. */
  readonly valabilDeLa: string;
  /** Ultima zi a perioadei, „AAAA-LL-ZZ”, inclusiv. */
  readonly valabilPana: string;
  /** Salariul de bază minim brut pe țară în vigoare în lunile perioadei. */
  readonly salariuMinim: number;
  /** Suma lunară scutită, în lei, la normă întreagă și lună întreagă. */
  readonly suma: number;
  /** Venitul brut maxim al lunii, inclusiv, fără tichete, vouchere și indemnizație de hrană. */
  readonly plafonVenitBrut: number;
  readonly temei: string;
}

export const FACILITATE_IANUARIE_IUNIE_2026: PerioadaFacilitateSalariuMinim = {
  valabilDeLa: "2026-01-01",
  valabilPana: "2026-06-30",
  salariuMinim: 4050,
  suma: 300,
  plafonVenitBrut: 4300,
  temei: "OUG 89/2025 art. III alin. (1); salariul minim din HG 1.506/2024",
};

export const FACILITATE_IULIE_DECEMBRIE_2026: PerioadaFacilitateSalariuMinim = {
  valabilDeLa: "2026-07-01",
  valabilPana: "2026-12-31",
  salariuMinim: 4325,
  suma: 200,
  plafonVenitBrut: 4600,
  temei: "OUG 89/2025 art. III alin. (1); salariul minim din HG 146/2026 art. 1",
};

export const PERIOADE_FACILITATE_SALARIU_MINIM: readonly PerioadaFacilitateSalariuMinim[] = [
  FACILITATE_IANUARIE_IUNIE_2026,
  FACILITATE_IULIE_DECEMBRIE_2026,
];

/** Numele pasului din `calc_breakdown` sub care motorul înregistrează suma. */
export const PAS_SUMA_NEIMPOZABILA = "sumaNeimpozabila";

const RE_LUNA = /^\d{4}-(0[1-9]|1[0-2])$/u;

/** Perioada în care cade luna veniturilor („AAAA-LL”), sau `null`. */
export function facilitatePentruLuna(luna: string): PerioadaFacilitateSalariuMinim | null {
  if (!RE_LUNA.test(luna)) return null;
  const ziua = `${luna}-01`;
  return (
    PERIOADE_FACILITATE_SALARIU_MINIM.find((p) => ziua >= p.valabilDeLa && ziua <= p.valabilPana) ??
    null
  );
}

export type MotivFaraFacilitate =
  | "luna_fara_facilitate"
  | "functie_secundara"
  | "norma_partiala"
  | "salariu_diferit_de_minim"
  | "venit_peste_plafon"
  | "fara_zile_platite";

export interface IntrareFacilitate {
  /** „AAAA-LL” — luna căreia îi sunt aferente veniturile, nu luna plății. */
  readonly luna: string;
  readonly salariuBaza: number;
  /** Venitul brut al lunii din același contract, FĂRĂ tichete, vouchere și indemnizație de hrană. */
  readonly venitBrut: number;
  readonly normaIntreaga: boolean;
  readonly functieDeBaza: boolean;
  /** Zilele cu venit salarial: lucrate + concediu de odihnă. */
  readonly zileCuVenitSalarial: number;
  readonly zileLucratoareLuna: number;
}

export interface RezultatFacilitate {
  /** Suma scutită, în lei, rotunjită la ban. 0 când nu se aplică. */
  readonly suma: number;
  readonly perioada: PerioadaFacilitateSalariuMinim | null;
  readonly motiv: MotivFaraFacilitate | null;
  readonly probleme: readonly ProblemaEtapa[];
}

/** Comparația sumelor în lei se face la ban. */
const LA_BAN = 0.005;

export function calculeazaFacilitateSalariuMinim(i: IntrareFacilitate): RezultatFacilitate {
  const perioada = facilitatePentruLuna(i.luna);
  const fara = (motiv: MotivFaraFacilitate): RezultatFacilitate => ({
    suma: 0,
    perioada,
    motiv,
    probleme: [],
  });
  if (perioada === null) return fara("luna_fara_facilitate");
  if (!i.functieDeBaza) return fara("functie_secundara");
  if (!i.normaIntreaga) return fara("norma_partiala");
  if (Math.abs(i.salariuBaza - perioada.salariuMinim) > LA_BAN) {
    return fara("salariu_diferit_de_minim");
  }
  if (i.venitBrut > perioada.plafonVenitBrut + LA_BAN) return fara("venit_peste_plafon");
  if (i.zileLucratoareLuna <= 0 || i.zileCuVenitSalarial <= 0) return fara("fara_zile_platite");

  const fractie = Math.min(1, i.zileCuVenitSalarial / i.zileLucratoareLuna);
  const suma = rotunjesteLaBani(perioada.suma * fractie);
  const detalii =
    fractie < 1
      ? `${suma.toFixed(2)} lei din ${String(perioada.suma)} (${String(i.zileCuVenitSalarial)}/${String(i.zileLucratoareLuna)} zile cu venit salarial), scutiți de impozit, CAS, CASS și CAM — ${perioada.temei}.`
      : `${suma.toFixed(2)} lei scutiți de impozit, CAS, CASS și CAM — ${perioada.temei}.`;
  return {
    suma,
    perioada,
    motiv: null,
    probleme: [{ cod: "SAL_FACILITATE_SALARIU_MINIM", detalii }],
  };
}

/**
 * Suma scutită dintr-un `calc_breakdown` salvat în bază (`payroll_entries`).
 *
 * Fluturașul PDF, e-mailul și D112 citesc rândul de aici, nu dintr-o coloană:
 * repararea facilității nu depinde de o migrare. Rândurile vechi n-au pasul,
 * deci dau 0 — exact ce s-a aplicat atunci.
 */
export function sumaNeimpozabilaDinBreakdown(breakdown: unknown): number {
  if (!Array.isArray(breakdown)) return 0;
  for (const pas of breakdown as readonly unknown[]) {
    if (typeof pas !== "object" || pas === null) continue;
    const { pas: nume, valoare } = pas as { pas?: unknown; valoare?: unknown };
    if (nume !== PAS_SUMA_NEIMPOZABILA) continue;
    return typeof valoare === "number" && Number.isFinite(valoare) && valoare > 0 ? valoare : 0;
  }
  return 0;
}
