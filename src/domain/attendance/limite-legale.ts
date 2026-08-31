// src/domain/attendance/limite-legale.ts
/**
 * Limitele de dreptul muncii ale firmei, verificate pe pontajul DEJA SCRIS.
 *
 * ── DE CE AVERTIZEAZĂ ȘI NU REFUZĂ ────────────────────────────────────────
 * Un repaus prea scurt sau o săptămână peste plafon sunt fapte care s-au
 * întâmplat deja. O acțiune care le respinge nu le face să nu se fi întâmplat:
 * omul rescrie ziua strâmb ca să treacă, iar angajatorul pierde exact
 * informația de care are nevoie ca să repare programul. Refuzurile rămân cele
 * de azi — perioadă blocată, zi din concediu, drept de scriere lipsă.
 *
 * ── DE CE ÎN TYPESCRIPT, CÂND SQL-UL LE ARE DEJA ──────────────────────────
 * `app.verifica_pontaj(org, an, luna)` (`0013_attendance.sql:582`) calculează
 * `repaus_zilnic`, `saptamana_peste_maxim` și `medie_perioada_referinta` din
 * 2026. Nu o cheamă nimeni, fiindcă trăiește în schema `app`, iar PostgREST
 * expune doar `public`: `.rpc()` n-o poate atinge. E și o verificare de LUNĂ
 * întreagă, nu de zi — nu răspunde la „ce tocmai am salvat".
 *
 * Codurile și aritmetica sunt aceleași cu ale ei, deliberat. Dacă schema `app`
 * devine cândva accesibilă, cele două trebuie să spună același lucru despre
 * aceeași lună; două formule ar face din diferența dintre ele un defect pe care
 * nimeni nu-l poate arbitra.
 *
 * ── FUNCȚII PURE ──────────────────────────────────────────────────────────
 * Fără acces la bază și fără `Date` construit în fusul serverului: șiruri
 * `YYYY-MM-DD` în UTC, ca tot modulul (`zi-de-pontat.ts`, `saptamana.ts`).
 * Apelantul aduce zilele; aici se decide doar ce e în neregulă cu ele.
 *
 * ── FIRMA NECONFIGURATĂ ───────────────────────────────────────────────────
 * `limite === null` întoarce ZERO avertismente. Nu există valori de rezervă
 * aici: `attendance_settings` a fost creată dinadins fără implicite (0013,
 * secțiunea 2, „DE VERIFICAT DE JURIST" pe fiecare coloană), iar un plafon
 * inventat ar produce un avertisment juridic pe o cifră pe care n-a confirmat-o
 * nimeni. Ecranele spun în schimb că firma n-a configurat nimic —
 * `rezumatRegulaPontaj` face asta din `areSetari`.
 */

import { formatOre } from "@/lib/format/ore";

import { minuteDinOra } from "./calcul-ore";
import { adaugaZile, lunieaSaptamanii, zileleSaptamanii } from "./saptamana";

/** Minutele unei zile calendaristice — apare de destule ori cât să aibă nume. */
const MINUTE_ZI = 24 * 60;

const ZILE_SAPTAMANA = 7;

/** Sâmbătă și duminică în numerotarea `getUTCDay()`, ca în `zi-de-pontat.ts`. */
const WEEKEND: ReadonlySet<number> = new Set([0, 6]);

/**
 * Codurile sunt cele din `app.verifica_pontaj`, plus cele care lipseau de
 * acolo. Se scriu o dată, ca ecranele să poată filtra pe ele fără șiruri
 * repetate prin componente.
 */
export const CODURI_AVERTISMENT = [
  "repaus_zilnic",
  "repaus_saptamanal",
  "saptamana_peste_maxim",
  "saptamana_peste_norma",
  "medie_perioada_referinta",
  "suplimentare_nepermise",
  "noapte_nepermisa",
  "zi_de_repaus_lucrata",
  "sarbatoare_lucrata",
  "compensare_sarbatoare",
] as const;
export type CodAvertisment = (typeof CODURI_AVERTISMENT)[number];

/**
 * `avertisment` = o limită legală a firmei a fost depășită. `informativ` = s-a
 * ieșit din programul obișnuit, ceea ce e perfect legal (exact asta sunt orele
 * suplimentare) și merită doar spus.
 *
 * Distincția nu e cosmetică: ecranul aprobatorului le arată pe primele, iar
 * dacă cele două ar arăta la fel, cele informative — mult mai numeroase — ar
 * ascunde depășirile reale.
 */
export type SeveritateAvertisment = "avertisment" | "informativ";

export interface AvertismentPontaj {
  readonly cod: CodAvertisment;
  readonly severitate: SeveritateAvertisment;
  /** Ziua sau lunea săptămânii la care se referă — ancora, ca în SQL. */
  readonly zi: string;
  /** Textul spune REGULA FIRMEI și cifra depășită. Niciodată „eroare". */
  readonly mesaj: string;
}

/** Partea din `attendance_settings` care descrie limitele, nu calculul orelor. */
export interface LimiteFirmei {
  readonly orePeSaptamana: number;
  readonly oreMaximeSaptamanale: number;
  readonly perioadaReferintaLuni: number;
  readonly repausZilnicMinimOre: number;
  readonly repausSaptamanalMinimOre: number;
  /**
   * În câte zile trebuie acordată ziua liberă pentru munca din sărbătoare.
   *
   * E singurul dintre cele două termene de compensare care are ce păzi:
   * triggerul `internal.pontaj_genereaza_compensare_sarbatoare` (0013:387) îl
   * citește deja și scrie rândul în `holiday_compensation`, de unde salarizarea
   * chiar plătește. Perechea lui, `termen_compensare_suplimentare_zile`, n-are
   * niciun scriitor în `overtime_compensation` — nici trigger, nici cod — deci
   * n-ar avea ce număra.
   */
  readonly termenCompensareSarbatoareZile: number;
  readonly admiteOreSuplimentare: boolean;
  readonly lucreazaNoaptea: boolean;
  readonly lucreazaWeekend: boolean;
  readonly lucreazaSarbatori: boolean;
}

/**
 * Rândul de setări → limitele, sau `null` când firma n-a configurat nimic.
 *
 * Tipat STRUCTURAL, ca `configZiDin`: domeniul nu depinde de stratul de citiri.
 */
export function limiteleFirmei(
  setari: Readonly<{
    ore_pe_saptamana: number;
    ore_maxime_saptamanale: number;
    perioada_referinta_luni: number;
    repaus_zilnic_minim_ore: number;
    repaus_saptamanal_minim_ore: number;
    termen_compensare_sarbatoare_zile: number;
    admite_ore_suplimentare: boolean;
    lucreaza_noaptea: boolean;
    lucreaza_weekend: boolean;
    lucreaza_sarbatori: boolean;
  }> | null,
): LimiteFirmei | null {
  if (setari === null) return null;
  return {
    orePeSaptamana: setari.ore_pe_saptamana,
    oreMaximeSaptamanale: setari.ore_maxime_saptamanale,
    perioadaReferintaLuni: setari.perioada_referinta_luni,
    repausZilnicMinimOre: setari.repaus_zilnic_minim_ore,
    repausSaptamanalMinimOre: setari.repaus_saptamanal_minim_ore,
    termenCompensareSarbatoareZile: setari.termen_compensare_sarbatoare_zile,
    admiteOreSuplimentare: setari.admite_ore_suplimentare,
    lucreazaNoaptea: setari.lucreaza_noaptea,
    lucreazaWeekend: setari.lucreaza_weekend,
    lucreazaSarbatori: setari.lucreaza_sarbatori,
  };
}

/**
 * O zi așa cum a rămas în `attendance_entries` după scriere.
 *
 * `esteSarbatoare` vine de la apelant, nu se derivă aici: `tip_zi` e deja
 * calculat de `tipZiAutomat` din sărbătorile NAȚIONALE plus zilele proprii ale
 * firmei (`zile_recuperare`, `liber_suplimentar`), iar o a doua derivare, din
 * calendarul național singur, ar contrazice ce scrie în rând.
 */
export interface ZiLucrata {
  readonly data: string;
  /** `"08:30"` sau `"08:30:00"` — se normalizează aici, o dată. */
  readonly oraInceput: string | null;
  readonly oraSfarsit: string | null;
  readonly oreLucrate: number;
  readonly oreSuplimentare: number;
  readonly oreNoapte: number;
  readonly esteSarbatoare: boolean;
}

/**
 * Ce s-a lucrat în perioada de referință, deja agregat de apelant.
 *
 * `saptamani` e numărul de săptămâni DISTINCTE cu pontaj, nu numărul de
 * săptămâni calendaristice ale perioadei — exact ce numără
 * `count(distinct date_trunc('week', data))` în `app.verifica_pontaj`. Un
 * angajat intrat în firmă acum trei săptămâni nu trebuie să apară sub medie
 * doar fiindcă perioada de referință are patru luni.
 */
export interface MediaReferinta {
  readonly ore: number;
  readonly saptamani: number;
}

// ── Ajutoare ────────────────────────────────────────────────────────────────

/** `"08:30:00"` și `"08:30"` intră la fel; orice altceva iese `null`. */
function minute(ora: string | null): number | null {
  if (ora === null) return null;
  return minuteDinOra(ora.slice(0, 5));
}

/** `"2026-08-24"` → `"24.08.2026"`, fără `Intl` și fără fus. */
function ziRomaneste(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** Durata pe ceas, ca peste tot în produs: `8.5` → `8:30`. */
function ore(valoare: number): string {
  return formatOre(valoare);
}

/**
 * Sâmbătă sau duminică, după DATĂ, nu după poziția în listă.
 *
 * Exportată fiindcă `trimiteSaptamanaPontaj` are nevoie de exact aceeași
 * întrebare, iar acolo indicele nu e de încredere: schema acceptă
 * `.min(1).max(7)` zile, deci o cerere fabricată poate trimite trei zile în
 * care poziția 5 nu mai e sâmbăta. `INDICI_WEEKEND` din `saptamana.ts` rămâne
 * pentru formular, unde cele șapte rânduri sunt construite de noi.
 */
export function esteWeekend(iso: string): boolean {
  return WEEKEND.has(new Date(`${iso}T00:00:00Z`).getUTCDay());
}

/** Poziția zilei în săptămâna care începe la `saptamanaStart`, sau `null`. */
function indiceInSaptamana(saptamanaStart: string, zi: string): number | null {
  const start = new Date(`${saptamanaStart}T00:00:00Z`).getTime();
  const data = new Date(`${zi}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(data)) return null;
  const index = Math.round((data - start) / (MINUTE_ZI * 60 * 1000));
  return index >= 0 && index < ZILE_SAPTAMANA ? index : null;
}

function total(zile: readonly ZiLucrata[]): number {
  return Math.round(zile.reduce((suma, zi) => suma + zi.oreLucrate, 0) * 100) / 100;
}

// ── Verificările, una câte una ──────────────────────────────────────────────

/**
 * Ce e în neregulă cu ZIUA în sine: felul de muncă pe care firma a declarat că
 * nu-l are.
 *
 * Comutatoarele din 0080 (`lucreaza_noaptea`, `lucreaza_weekend`,
 * `lucreaza_sarbatori`, `admite_ore_suplimentare`) orientau până acum doar
 * ecranul — `meritaPontata` decidea dacă apare cardul din portal. Pontajul le
 * contrazicea tăcut: `salveazaZiPontaj` scria liniștit ore suplimentare la o
 * firmă care declarase că nu are, iar contradicția ieșea la iveală abia pe
 * fluturaș, în alt modul și peste o lună.
 *
 * NU se refuză nimic: sporurile din art. 123, 137 alin. (2) și 142 alin. (2)
 * rămân obligatorii dacă munca s-a prestat totuși. Se spune doar că s-a
 * prestat ceva ce firma a declarat că nu se prestează.
 */
function verificaFelulMuncii(zi: ZiLucrata, limite: LimiteFirmei): readonly AvertismentPontaj[] {
  const gasite: AvertismentPontaj[] = [];

  if (!limite.admiteOreSuplimentare && zi.oreSuplimentare > 0) {
    gasite.push({
      cod: "suplimentare_nepermise",
      severitate: "avertisment",
      zi: zi.data,
      mesaj: `Firma a declarat că nu se lucrează ore suplimentare, iar ziua de ${ziRomaneste(zi.data)} are ${ore(zi.oreSuplimentare)} h peste normă.`,
    });
  }

  if (!limite.lucreazaNoaptea && zi.oreNoapte > 0) {
    gasite.push({
      cod: "noapte_nepermisa",
      severitate: "avertisment",
      zi: zi.data,
      mesaj: `Firma a declarat că nu se lucrează în tura de noapte, iar ziua de ${ziRomaneste(zi.data)} are ${ore(zi.oreNoapte)} h în intervalul nocturn.`,
    });
  }

  if (!limite.lucreazaWeekend && zi.oreLucrate > 0 && esteWeekend(zi.data)) {
    gasite.push({
      cod: "zi_de_repaus_lucrata",
      severitate: "avertisment",
      zi: zi.data,
      mesaj: `Firma a declarat că nu se lucrează în repausul săptămânal, iar ${ziRomaneste(zi.data)} cade în weekend, cu ${ore(zi.oreLucrate)} h lucrate.`,
    });
  }

  if (!limite.lucreazaSarbatori && zi.oreLucrate > 0 && zi.esteSarbatoare) {
    gasite.push({
      cod: "sarbatoare_lucrata",
      severitate: "avertisment",
      zi: zi.data,
      mesaj: `Firma a declarat că nu se lucrează de sărbătorile legale, iar ${ziRomaneste(zi.data)} este sărbătoare, cu ${ore(zi.oreLucrate)} h lucrate.`,
    });
  }

  /*
    Termenul de acordare a zilei libere pentru sărbătoare — INFORMATIV, fiindcă
    nu s-a depășit nimic: abia s-a născut o obligație.

    E singurul loc din produs în care `termen_compensare_sarbatoare_zile` ajunge
    pe ecran. Cifra e reală, nu decorativă: triggerul din 0013 tocmai a scris
    rândul din `holiday_compensation` cu EXACT acest termen (`data + termen`),
    iar de acolo îl citește salarizarea. Ce se spune aici e ce s-a scris acolo.
  */
  if (zi.esteSarbatoare && zi.oreLucrate > 0) {
    gasite.push({
      cod: "compensare_sarbatoare",
      severitate: "informativ",
      zi: zi.data,
      mesaj: `Pentru cele ${ore(zi.oreLucrate)} h din sărbătoarea de ${ziRomaneste(zi.data)} se cuvine o zi liberă, de acordat până la ${ziRomaneste(adaugaZile(zi.data, limite.termenCompensareSarbatoareZile))}. După termen, compensarea se face prin spor.`,
    });
  }

  return gasite;
}

/**
 * Repausul dintre ziua de ieri și cea de azi (art. 135: minimum 12 ore).
 *
 * Formula e cea din `app.verifica_pontaj`, inclusiv aproximarea: când ambele
 * intervale se cunosc, repausul e diferența exactă; când nu, e `24 − orele
 * lucrate ieri`. Mesajul spune „estimat" exact în al doilea caz, ca cifra să nu
 * pretindă o precizie pe care n-o are.
 *
 * Se compară doar zile CALENDARISTIC consecutive, tot ca în SQL: între luni și
 * miercuri au trecut oricum peste 24 de ore.
 */
function verificaRepausZilnic(
  zi: ZiLucrata,
  ziuaDinainte: ZiLucrata | null,
  limite: LimiteFirmei,
): readonly AvertismentPontaj[] {
  if (ziuaDinainte === null) return [];
  if (zi.oreLucrate <= 0 || ziuaDinainte.oreLucrate <= 0) return [];
  if (ziuaDinainte.data !== adaugaZile(zi.data, -1)) return [];

  const sfarsitIeri = minute(ziuaDinainte.oraSfarsit);
  const inceputAzi = minute(zi.oraInceput);
  const exact = sfarsitIeri !== null && inceputAzi !== null;
  const repaus = exact ? (MINUTE_ZI - sfarsitIeri + inceputAzi) / 60 : 24 - ziuaDinainte.oreLucrate;

  if (repaus >= limite.repausZilnicMinimOre) return [];

  return [
    {
      cod: "repaus_zilnic",
      severitate: "avertisment",
      zi: zi.data,
      mesaj: `Repausul${exact ? "" : " estimat"} între ${ziRomaneste(ziuaDinainte.data)} și ${ziRomaneste(zi.data)} este de ${ore(repaus)} h, sub minimul de ${ore(limite.repausZilnicMinimOre)} h stabilit de firmă.`,
    },
  ];
}

/**
 * Cea mai lungă pauză neîntreruptă dintr-o săptămână, în ore.
 *
 * ── CE FACE CU O ZI FĂRĂ INTERVAL ─────────────────────────────────────────
 * O zi cu ore dar fără interval (foaia colectivă, unde se tastează direct
 * cifra) e considerată ocupată ÎN ÎNTREGIME. E o subestimare a repausului, dar
 * e singura care nu inventează o oră: orice altă alegere — „programul începe la
 * 8" — ar fi exact valoarea de rezervă pe care ecranele astea o refuză. La un
 * prag de 48 de ore, verdictul e oricum același în aproape toate cazurile:
 * o sâmbătă lucrată taie repausul sub prag și cu, și fără oră cunoscută.
 *
 * ── LIMITA FERESTREI ──────────────────────────────────────────────────────
 * Se privește o singură săptămână ISO. Cine se odihnește duminică și lunea
 * următoare are 48 de ore reale, dar tăiate de granița ferestrei — de aceea
 * mesajul spune explicit „în săptămâna …", nu „nu ați avut repaus".
 */
function celMaiLungRepaus(saptamanaStart: string, zile: readonly ZiLucrata[]): number {
  const ocupate: (readonly [number, number])[] = [];
  for (const zi of zile) {
    if (zi.oreLucrate <= 0) continue;
    const index = indiceInSaptamana(saptamanaStart, zi.data);
    if (index === null) continue;
    const baza = index * MINUTE_ZI;
    const inceput = minute(zi.oraInceput);
    const sfarsit = minute(zi.oraSfarsit);
    ocupate.push(
      inceput !== null && sfarsit !== null && sfarsit > inceput
        ? [baza + inceput, baza + sfarsit]
        : [baza, baza + MINUTE_ZI],
    );
  }

  const sortate = [...ocupate].sort((a, b) => a[0] - b[0]);
  const fereastra = ZILE_SAPTAMANA * MINUTE_ZI;
  let maxim = 0;
  let liberDe = 0;
  for (const [inceput, sfarsit] of sortate) {
    if (inceput > liberDe) maxim = Math.max(maxim, inceput - liberDe);
    liberDe = Math.max(liberDe, sfarsit);
  }
  maxim = Math.max(maxim, fereastra - liberDe);
  return Math.round((maxim / 60) * 100) / 100;
}

/**
 * Ce e în neregulă cu SĂPTĂMÂNA: totalul și repausul săptămânal.
 *
 * `saptamana_peste_norma` e informativ, nu avertisment: norma săptămânală
 * depășită înseamnă ore suplimentare, care sunt legale. Se tace când s-a depășit
 * și plafonul — acolo vorbește deja avertismentul serios, iar două rânduri
 * despre aceeași săptămână l-ar dilua.
 */
function verificaSaptamanaLucrata(
  saptamanaStart: string,
  zile: readonly ZiLucrata[],
  limite: LimiteFirmei,
): readonly AvertismentPontaj[] {
  const gasite: AvertismentPontaj[] = [];
  const oreSaptamana = total(zile);
  const capat = zileleSaptamanii(saptamanaStart)[ZILE_SAPTAMANA - 1] ?? saptamanaStart;
  const interval = `${ziRomaneste(saptamanaStart)}–${ziRomaneste(capat)}`;

  if (oreSaptamana > limite.oreMaximeSaptamanale) {
    gasite.push({
      cod: "saptamana_peste_maxim",
      severitate: "avertisment",
      zi: saptamanaStart,
      mesaj: `Săptămâna ${interval} însumează ${ore(oreSaptamana)} h, peste maximul de ${ore(limite.oreMaximeSaptamanale)} h cu tot cu orele suplimentare, stabilit de firmă.`,
    });
  } else if (oreSaptamana > limite.orePeSaptamana) {
    gasite.push({
      cod: "saptamana_peste_norma",
      severitate: "informativ",
      zi: saptamanaStart,
      mesaj: `Săptămâna ${interval} însumează ${ore(oreSaptamana)} h, peste norma de ${ore(limite.orePeSaptamana)} h pe săptămână. Diferența sunt ore suplimentare.`,
    });
  }

  // Un repaus se măsoară doar într-o săptămână în care s-a și lucrat: pe una
  // goală „cea mai lungă pauză" ar fi 168 de ore, adică un avertisment care
  // nu se poate declanșa, sau zero, adică unul fals.
  if (zile.some((zi) => zi.oreLucrate > 0)) {
    const repaus = celMaiLungRepaus(saptamanaStart, zile);
    if (repaus < limite.repausSaptamanalMinimOre) {
      gasite.push({
        cod: "repaus_saptamanal",
        severitate: "avertisment",
        zi: saptamanaStart,
        mesaj: `În săptămâna ${interval}, cea mai lungă pauză neîntreruptă este de ${ore(repaus)} h, sub repausul săptămânal de ${ore(limite.repausSaptamanalMinimOre)} h stabilit de firmă.`,
      });
    }
  }

  return gasite;
}

/**
 * Media săptămânală pe perioada de referință (art. 114: plafonul de 48 de ore
 * se poate respecta CA MEDIE, pe 4 luni — sau mai mult, prin contract colectiv).
 *
 * Aceeași formulă ca în SQL: `ore / săptămâni distincte cu pontaj`, comparată cu
 * plafonul maxim. Fără rânduri, `saptamani = 0` și nu se verifică nimic — nu se
 * împarte la zero ca să iasă un avertisment despre un angajat fără pontaj.
 */
function verificaMediaReferintei(
  zi: string,
  referinta: MediaReferinta | null,
  limite: LimiteFirmei,
): readonly AvertismentPontaj[] {
  if (referinta === null || referinta.saptamani <= 0) return [];
  const media = referinta.ore / referinta.saptamani;
  if (media <= limite.oreMaximeSaptamanale) return [];
  return [
    {
      cod: "medie_perioada_referinta",
      severitate: "avertisment",
      zi,
      mesaj: `Media pe perioada de referință de ${String(limite.perioadaReferintaLuni)} luni este de ${ore(media)} h pe săptămână, peste maximul de ${ore(limite.oreMaximeSaptamanale)} h.`,
    },
  ];
}

// ── Cele trei intrări publice ───────────────────────────────────────────────

/**
 * Avertismentele de după salvarea UNEI zile.
 *
 * `saptamana` sunt zilele săptămânii ISO care conține ziua, INCLUSIV ea, așa
 * cum arată baza DUPĂ scriere — altfel totalul săptămânii ar fi cel de dinainte
 * de ce tocmai s-a salvat.
 */
export function avertismenteZi(params: {
  readonly zi: ZiLucrata;
  readonly ziuaDinainte: ZiLucrata | null;
  readonly saptamana: readonly ZiLucrata[];
  readonly referinta: MediaReferinta | null;
  readonly limite: LimiteFirmei | null;
}): readonly AvertismentPontaj[] {
  const { limite } = params;
  if (limite === null) return [];
  return [
    ...verificaFelulMuncii(params.zi, limite),
    ...verificaRepausZilnic(params.zi, params.ziuaDinainte, limite),
    ...verificaSaptamanaLucrata(lunieaSaptamanii(params.zi.data), params.saptamana, limite),
    ...verificaMediaReferintei(params.zi.data, params.referinta, limite),
  ];
}

/**
 * Avertismentele unei săptămâni întregi, pentru planul trimis spre aprobare.
 *
 * `ziuaDinainte` e duminica dinaintea săptămânii: fără ea, repausul dintre
 * ultima zi a săptămânii trecute și lunea asta n-ar fi verificat de nimeni —
 * exact granița pe care se sparge un program de tură.
 */
export function avertismenteSaptamana(params: {
  readonly saptamanaStart: string;
  readonly zile: readonly ZiLucrata[];
  readonly ziuaDinainte: ZiLucrata | null;
  readonly referinta: MediaReferinta | null;
  readonly limite: LimiteFirmei | null;
}): readonly AvertismentPontaj[] {
  const { limite } = params;
  if (limite === null) return [];

  const ordonate = [...params.zile].sort((a, b) => a.data.localeCompare(b.data));
  const gasite: AvertismentPontaj[] = [
    ...verificaSaptamanaLucrata(params.saptamanaStart, ordonate, limite),
    ...verificaMediaReferintei(params.saptamanaStart, params.referinta, limite),
  ];

  let anterioara = params.ziuaDinainte;
  for (const zi of ordonate) {
    gasite.push(...verificaFelulMuncii(zi, limite));
    gasite.push(...verificaRepausZilnic(zi, anterioara, limite));
    anterioara = zi;
  }
  return gasite;
}

/**
 * Avertismentele unui angajat pe zilele deja încărcate în ecran — foaia
 * colectivă a lunii.
 *
 * Nu cere nicio citire nouă: pagina are deja toate intrările lunii, iar
 * verificarea se face pe ele. Consecința, spusă pe față: repausul dintre ultima
 * zi a lunii trecute și prima a acesteia nu se vede, iar media pe perioada de
 * referință lipsește cu totul — pentru ea ar trebui aduse alte patru luni de
 * pontaj pentru fiecare angajat din tabel. Le calculează acțiunea, la salvare.
 */
export function avertismenteLuna(params: {
  readonly zile: readonly ZiLucrata[];
  readonly limite: LimiteFirmei | null;
}): readonly AvertismentPontaj[] {
  const { limite } = params;
  if (limite === null || params.zile.length === 0) return [];

  const ordonate = [...params.zile].sort((a, b) => a.data.localeCompare(b.data));

  const peSaptamani = new Map<string, ZiLucrata[]>();
  for (const zi of ordonate) {
    const luni = lunieaSaptamanii(zi.data);
    const grup = peSaptamani.get(luni);
    if (grup === undefined) peSaptamani.set(luni, [zi]);
    else grup.push(zi);
  }

  const gasite: AvertismentPontaj[] = [];
  for (const [luni, zileSaptamanii] of peSaptamani) {
    gasite.push(...verificaSaptamanaLucrata(luni, zileSaptamanii, limite));
  }

  let anterioara: ZiLucrata | null = null;
  for (const zi of ordonate) {
    gasite.push(...verificaFelulMuncii(zi, limite));
    gasite.push(...verificaRepausZilnic(zi, anterioara, limite));
    anterioara = zi;
  }

  return gasite;
}
