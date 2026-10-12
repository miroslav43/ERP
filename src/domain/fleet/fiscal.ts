// src/domain/fleet/fiscal.ts

/**
 * Fiscalul flotei (F10, 0202): regimul de deducere al vehiculului, verdictul
 * lunii („deducere integrală fără foi”) și SUGESTIA de avantaj în natură.
 *
 * Funcții pure, fără I/O. Baza dă faptele (`public.flota_fiscal_luna`,
 * `public.avantaj_natura_flota`), aici se decide ce se spune. Nimic de aici nu
 * scrie pe statul de plată: avantajul se adaugă de mână, ca componentă
 * „Beneficiu în natură” (decizia planului: fiscalul e sugestie).
 *
 * ── TEMEIURILE (verificate pe 12 oct 2026, pe formele consolidate) ─────────
 * Codul fiscal (consolidarea din 08.08.2026): art. 25 alin. (3) lit. l) și
 * art. 298 alin. (1)–(3) — limitarea la 50%, pragurile de 3.500 kg și 9
 * scaune, excepțiile; art. 76 alin. (4) lit. ț) și ț^1) — folosința personală
 * neimpozabilă. Normele HG 1/2016 (consolidarea din 31.03.2026): titlul IV pct.
 * 12 alin. (5) lit. a) — 1,7% pe lună sau chiria; alin. (6) lit. a) — folosința
 * mixtă, proporțional cu km. Ce rămâne de confirmat cu contabilul e marcat ⚠ în
 * NOTES.md, secțiunea „Flotă — fiscal”.
 */

/** Oglinda lui `public.vehicle_fiscal_regime` (0202). */
export const REGIMURI_FISCALE = [
  "limitat_50",
  "integral_exclusiv_economic",
  "exceptat_categorie",
  "peste_3500_sau_9_locuri",
] as const;
export type RegimFiscal = (typeof REGIMURI_FISCALE)[number];

/** Oglinda lui `public.vehicle_exceptie_fiscala`: art. 25 alin. (3) lit. l) pct. 1–5. */
export const EXCEPTII_FISCALE = [
  "urgenta_paza_curierat",
  "agenti_vanzari_achizitii",
  "transport_persoane_plata",
  "servicii_plata",
  "marfa_comerciala",
] as const;
export type ExceptieFiscala = (typeof EXCEPTII_FISCALE)[number];

/** Oglinda lui `public.vehicle_titlu_folosinta`. */
export const TITLURI_FOLOSINTA = [
  "proprietate",
  "leasing_financiar",
  "leasing_operational",
  "inchiriat",
  "comodat",
  "chirie_persoana_fizica",
] as const;
export type TitluFolosinta = (typeof TITLURI_FOLOSINTA)[number];

/** Oglinda lui `public.regim_impozitare`. */
export const REGIMURI_IMPOZITARE = ["micro", "profit", "specific"] as const;
export type RegimImpozitare = (typeof REGIMURI_IMPOZITARE)[number];

export const ETICHETE_REGIM_FISCAL: Readonly<Record<RegimFiscal, string>> = {
  limitat_50: "Deducere 50% (folosit și în interes personal)",
  integral_exclusiv_economic: "Deducere integrală — exclusiv activitate economică",
  exceptat_categorie: "Deducere integrală — categorie exceptată",
  peste_3500_sau_9_locuri: "Deducere integrală — peste 3.500 kg sau peste 9 locuri",
};

export const ETICHETE_EXCEPTIE: Readonly<Record<ExceptieFiscala, string>> = {
  urgenta_paza_curierat: "Urgență, pază și protecție, curierat (pct. 1)",
  agenti_vanzari_achizitii: "Agenți de vânzări și de achiziții (pct. 2)",
  transport_persoane_plata: "Transport de persoane cu plată, taxi (pct. 3)",
  servicii_plata: "Servicii cu plată: închiriere, școală de șoferi (pct. 4)",
  marfa_comerciala: "Vehicul-marfă în scop comercial (pct. 5)",
};

export const ETICHETE_TITLU: Readonly<Record<TitluFolosinta, string>> = {
  proprietate: "Proprietatea firmei",
  leasing_financiar: "Leasing financiar",
  leasing_operational: "Leasing operațional",
  inchiriat: "Închiriat de la terți",
  comodat: "Mașină personală, în comodat",
  chirie_persoana_fizica: "Mașină personală, cu chirie",
};

export const ETICHETE_REGIM_IMPOZITARE: Readonly<Record<RegimImpozitare, string>> = {
  micro: "Impozit pe veniturile microîntreprinderilor",
  profit: "Impozit pe profit",
  specific: "Impozit specific unor activități",
};

/** HG 1/2016, titlul IV pct. 12 alin. (5) lit. a). */
export const PROCENT_AVANTAJ_LUNAR = 1.7;

/** Codul fiscal art. 25 alin. (3) lit. l) și art. 298 alin. (2). */
export const MASA_MAXIMA_LIMITARE_KG = 3500;
export const LOCURI_MAXIME_LIMITARE = 9;

export const TEMEI_ART_25 = "Codul fiscal, art. 25 alin. (3) lit. l) și art. 298";
const TEMEI_AVANTAJ = "HG 1/2016, titlul IV pct. 12 alin. (5) lit. a)";

/** Textul fix pentru folosința mixtă: km personali nu se înregistrează nicăieri. */
export const NOTA_FOLOSINTA_MIXTA =
  "Dacă mașina e folosită și în interes de serviciu, avantajul se proporționează cu kilometrii parcurși în interes personal din totalul kilometrilor (HG 1/2016, titlul IV pct. 12 alin. (6) lit. a)).";

export function procentDeducere(regim: RegimFiscal): 50 | 100 {
  return regim === "limitat_50" ? 50 : 100;
}

/**
 * Foaia de parcurs e cerută doar pentru deducerea integrală (HG 1/2016, titlul
 * II pct. 16 alin. (2) și titlul VII pct. 68).
 */
export function cereFoaie(regim: RegimFiscal): boolean {
  return regim !== "limitat_50";
}

/** Mașina unei persoane fizice, folosită de firmă: nu e bunul firmei. */
export function esteMasinaPersonala(titlu: TitluFolosinta): boolean {
  return titlu === "comodat" || titlu === "chirie_persoana_fizica";
}

/** Perioada în vigoare la `zi` (`AAAA-LL-ZZ`): cel mai mare început ≤ zi. */
export function perioadaLa<T extends Readonly<{ valabil_de_la: string }>>(
  perioade: readonly T[],
  zi: string,
): T | null {
  let ales: T | null = null;
  for (const p of perioade) {
    if (p.valabil_de_la <= zi && (ales === null || p.valabil_de_la > ales.valabil_de_la)) ales = p;
  }
  return ales;
}

export interface DateVehiculFiscal {
  readonly masa_maxima_kg: number | null;
  readonly numar_locuri: number | null;
  readonly categorie: string;
}

function estePesteLimitare(v: DateVehiculFiscal): boolean {
  return (
    (v.masa_maxima_kg !== null && v.masa_maxima_kg > MASA_MAXIMA_LIMITARE_KG) ||
    (v.numar_locuri !== null && v.numar_locuri > LOCURI_MAXIME_LIMITARE)
  );
}

/** Regimul pe care fișa vehiculului îl impune singură, sau `null` (decide firma). */
export function regimSugerat(v: DateVehiculFiscal): RegimFiscal | null {
  return estePesteLimitare(v) ? "peste_3500_sau_9_locuri" : null;
}

/**
 * Ce merită spus despre un regim, pe datele fișei. Doar avertismente: baza
 * refuză numai „peste 3.500 kg” pe un vehicul pe care îl ȘTIE ușor.
 */
export function avertismenteRegim(regim: RegimFiscal, v: DateVehiculFiscal): readonly string[] {
  const rezultat: string[] = [];
  if (regim === "limitat_50" && estePesteLimitare(v)) {
    rezultat.push(
      "Vehiculul are peste 3.500 kg sau peste 9 locuri: limitarea la 50% nu i se aplică (art. 25 alin. (3) lit. l) din Codul fiscal). Verificați regimul cu contabilul.",
    );
  }
  if (regim === "peste_3500_sau_9_locuri" && v.masa_maxima_kg === null && v.numar_locuri === null) {
    rezultat.push(
      "Fișa vehiculului nu are masa maximă autorizată și numărul de locuri: completați-le, ca încadrarea să se poată verifica.",
    );
  }
  if (v.categorie === "remorca" || v.categorie === "semiremorca") {
    rezultat.push(
      "Limitarea privește vehiculele rutiere motorizate; încadrarea unei remorci se stabilește cu contabilul.",
    );
  }
  return rezultat;
}

// ── Verdictul lunii ─────────────────────────────────────────────────────────

/** Un rând din `public.flota_fiscal_luna`, cu nullabilitatea adevărată. */
export interface LunaVehicul {
  readonly regim: RegimFiscal | null;
  readonly titlu_folosinta: TitluFolosinta | null;
  readonly zile_luna: number;
  readonly zile_integral: number;
  readonly zile_fara_regim: number;
  readonly foi_aprobate: number;
  readonly foi_neaprobate: number;
}

export type StareLuna = "nestabilit" | "limitat" | "fara_foi" | "foi_neaprobate" | "acoperit";

export interface VerdictLuna {
  readonly stare: StareLuna;
  readonly ton: "neutru" | "atentie" | "pericol" | "ok";
  readonly mesaj: string;
}

/** Numeralul românesc: „de” după 20, 21…, 100, 120 — nu după 1–19, 101–119. */
function numar(n: number, plural: string): string {
  const rest = n % 100;
  const cuDe = rest >= 20 || (rest === 0 && n > 0);
  return `${String(n)} ${cuDe ? "de " : ""}${plural}`;
}

function zile(n: number): string {
  return n === 1 ? "o zi" : numar(n, "zile");
}

/** „o foaie aprobată” / „3 foi aprobate”: adjectivul se acordă cu numărul. */
function foi(n: number, singular: string, plural: string): string {
  return n === 1 ? `o foaie ${singular}` : numar(n, `foi ${plural}`);
}

/**
 * Riscul fiscal al lunii pe un vehicul. Zilele se numără după regimul în
 * vigoare în fiecare zi, dar FOILE se numără pe luna întreagă (`public.
 * flota_fiscal_luna` nu le leagă de zile): „fără foi” înseamnă nicio foaie în
 * lună, iar la o lună mixtă (50% apoi integral) o foaie din zilele de 50%
 * acoperă în verdict și zilele cu deducere integrală. Verdictul e deci un
 * semnal de control, nu o dovadă zi cu zi (⚠ în NOTES.md, „Flotă — fiscal”).
 */
export function verdictLuna(r: LunaVehicul): VerdictLuna {
  const faraRegim =
    r.zile_fara_regim > 0 && r.zile_fara_regim < r.zile_luna
      ? ` ${zile(r.zile_fara_regim)} fără regim stabilit.`
      : "";
  if (r.zile_integral === 0) {
    if (r.zile_fara_regim >= r.zile_luna) {
      return {
        stare: "nestabilit",
        ton: "atentie",
        mesaj: "Regimul fiscal nu e stabilit: nu se știe dacă luna cere foi de parcurs.",
      };
    }
    return {
      stare: "limitat",
      ton: "neutru",
      mesaj: `Deducere 50%: foaia de parcurs nu e cerută.${faraRegim}`,
    };
  }
  const integral = `Deducere integrală în ${zile(r.zile_integral)}`;
  if (r.foi_aprobate === 0 && r.foi_neaprobate === 0) {
    return {
      stare: "fara_foi",
      ton: "pericol",
      mesaj: `${integral}, fără nicio foaie de parcurs în lună: deducerea nu are justificare.${faraRegim}`,
    };
  }
  if (r.foi_aprobate === 0) {
    return {
      stare: "foi_neaprobate",
      ton: "atentie",
      mesaj: `${integral}; ${foi(r.foi_neaprobate, "neaprobată", "neaprobate")} încă, niciuna aprobată.${faraRegim}`,
    };
  }
  const deAprobat =
    r.foi_neaprobate === 0 ? "" : `, plus ${foi(r.foi_neaprobate, "de aprobat", "de aprobat")}`;
  return {
    stare: "acoperit",
    ton: "ok",
    mesaj: `${integral}: ${foi(r.foi_aprobate, "aprobată", "aprobate")}${deAprobat}.${faraRegim}`,
  };
}

// ── Sugestia de avantaj în natură ───────────────────────────────────────────

/** Faptele unei alocări cu folosință personală (`public.avantaj_natura_flota`). */
export interface FapteAvantaj {
  readonly vehicul_nr: string;
  readonly regim: RegimFiscal | null;
  readonly titlu_folosinta: TitluFolosinta | null;
  readonly valoare_intrare: number | null;
  readonly chirie_lunara: number | null;
  readonly regim_impozitare: RegimImpozitare | null;
}

export type SugestieAvantaj =
  | Readonly<{ fel: "neaplicabil"; motiv: string; temei: string }>
  | Readonly<{ fel: "incomplet"; motiv: string }>
  | Readonly<{
      fel: "sugestie";
      baza: "valoare_intrare" | "chirie";
      valoareBaza: number;
      /** `null` când avantajul e chiria însăși. */
      procent: number | null;
      valoareLunara: number;
      formula: string;
      temei: string;
      avertismente: readonly string[];
    }>;

function lei(n: number): string {
  return `${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;
}

function bani(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sugestia lunară pentru o mașină cu folosință personală. Ordinea regulilor e
 * ordinea în care un contabil ar întreba: ce regim are firma, ce regim are
 * mașina, a cui e mașina, pe ce bază se evaluează.
 */
export function sugereazaAvantaj(f: FapteAvantaj): SugestieAvantaj {
  if (f.regim_impozitare === null) {
    return {
      fel: "incomplet",
      motiv:
        "Regimul de impozitare al firmei nu e stabilit. Completați-l pe pagina fiscală a parcului auto.",
    };
  }
  if (f.regim_impozitare === "micro" || f.regim_impozitare === "specific") {
    // Regula planului: firmă micro/specific = nicio sugestie. Textul lit. ț^1)
    // privește însă „vehiculele prevăzute la art. 25 alin. (3) lit. l)”, adică
    // cele de până la 3.500 kg și 9 scaune: la un vehicul peste limite scutirea
    // nu rezultă din text. ⚠ de confirmat cu contabilul (NOTES.md).
    const peste = f.regim === "peste_3500_sau_9_locuri";
    return {
      fel: "neaplicabil",
      motiv: `Firma aplică impozitul microîntreprinderilor sau impozitul specific: folosința personală a mașinii nu e venit impozabil.${
        peste
          ? " Atenție: scutirea privește vehiculele din art. 25 alin. (3) lit. l) (până la 3.500 kg și 9 scaune), iar acesta le depășește: cereți confirmarea contabilului."
          : ""
      }`,
      temei: "Codul fiscal, art. 76 alin. (4) lit. ț^1)",
    };
  }
  if (f.regim === null || f.titlu_folosinta === null) {
    return {
      fel: "incomplet",
      motiv: `Vehiculul ${f.vehicul_nr} n-are regim fiscal stabilit. Completați-l pe fișa vehiculului.`,
    };
  }
  if (f.regim === "limitat_50") {
    return {
      fel: "neaplicabil",
      motiv: `Vehiculul ${f.vehicul_nr} are deducere 50%: folosința personală nu e venit impozabil.`,
      temei: "Codul fiscal, art. 76 alin. (4) lit. ț)",
    };
  }
  if (esteMasinaPersonala(f.titlu_folosinta)) {
    return {
      fel: "neaplicabil",
      motiv: `Vehiculul ${f.vehicul_nr} e mașina unei persoane fizice, folosită de firmă (comodat sau chirie): nu e un bun al firmei pus la dispoziția angajatului.`,
      temei: "HG 1/2016, titlul IV pct. 12 alin. (5) — bunuri din patrimoniul afacerii",
    };
  }

  const avertismente: string[] = [];
  if (f.regim === "integral_exclusiv_economic") {
    avertismente.push(
      "Folosința personală contrazice regimul „exclusiv în scopul activității economice”: deducerea integrală e expusă. Discutați încadrarea cu contabilul.",
    );
  }

  if (f.titlu_folosinta === "inchiriat" || f.titlu_folosinta === "leasing_operational") {
    if (f.chirie_lunara === null) {
      return {
        fel: "incomplet",
        motiv: `Vehiculul ${f.vehicul_nr} e închiriat: completați chiria lunară în regimul lui fiscal.`,
      };
    }
    if (f.titlu_folosinta === "leasing_operational") {
      avertismente.push(
        "Leasingul operațional e evaluat aici ca o închiriere, la nivelul ratei lunare: de confirmat cu contabilul.",
      );
    }
    const valoare = bani(f.chirie_lunara);
    return {
      fel: "sugestie",
      baza: "chirie",
      valoareBaza: valoare,
      procent: null,
      valoareLunara: valoare,
      formula: `chiria lunară: ${lei(valoare)}`,
      temei: `${TEMEI_AVANTAJ}, teza a doua`,
      avertismente,
    };
  }

  if (f.valoare_intrare === null) {
    return {
      fel: "incomplet",
      motiv: `Vehiculul ${f.vehicul_nr} n-are valoarea de achiziție pe fișă: completați-o, ca să se poată calcula 1,7%.`,
    };
  }
  const valoareLunara = bani((f.valoare_intrare * PROCENT_AVANTAJ_LUNAR) / 100);
  return {
    fel: "sugestie",
    baza: "valoare_intrare",
    valoareBaza: f.valoare_intrare,
    procent: PROCENT_AVANTAJ_LUNAR,
    valoareLunara,
    formula: `1,7% × ${lei(f.valoare_intrare)} = ${lei(valoareLunara)} pe lună`,
    temei: TEMEI_AVANTAJ,
    avertismente,
  };
}

/** Folosința mixtă: avantajul × km personali / km totali, sau `null` dacă cifrele nu se pot folosi. */
export function proportiePeKm(
  valoareLunara: number,
  kmPersonali: number,
  kmTotali: number,
): number | null {
  if (!(kmTotali > 0) || !(kmPersonali >= 0) || kmPersonali > kmTotali) return null;
  return bani((valoareLunara * kmPersonali) / kmTotali);
}

// ── Luna paginii fiscale ────────────────────────────────────────────────────

/** `AAAA-LL` mutată cu `delta` luni (negativ = înapoi). Intrarea e validă (vezi `lunaDinParametru`). */
export function mutaLuna(luna: string, delta: number): string {
  const [an, lunaNr] = luna.split("-").map(Number) as [number, number];
  const total = an * 12 + (lunaNr - 1) + delta;
  const anNou = Math.floor(total / 12);
  const lunaNoua = (total % 12) + 1;
  return `${String(anNou).padStart(4, "0")}-${String(lunaNoua).padStart(2, "0")}`;
}

/** Ultima zi a lunii `AAAA-LL`, ca `AAAA-LL-ZZ`. */
export function ultimaZiALunii(luna: string): string {
  const [an, lunaNr] = luna.split("-").map(Number) as [number, number];
  const zi = new Date(Date.UTC(an, lunaNr, 0)).getUTCDate();
  return `${luna}-${String(zi).padStart(2, "0")}`;
}
