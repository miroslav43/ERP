// src/domain/fleet/carduri/coloane.ts
//
// Câmpurile canonice ale unui extras de card și recunoașterea coloanelor.
//
// ── DE CE SINONIME ȘI NU FORMATE FIXE ─────────────────────────────────────
// Niciunul dintre emitenți (OMV/Routex, MOL, Lukoil, Rompetrol, DKV, Shell,
// Eurowag) nu publică lista coloanelor din extrasul de tranzacții (F12b §4,
// căutare din 12.10.2026, zero rezultate). Presetările de mai jos sunt deci
// liste de SINONIME de antet, NECALIBRATE; mecanismul sigur e maparea salvată
// per firmă și emitent (`fuel_card_import_profiles`). Primul extras real al
// unui client calibrează presetarea.
//
// Ordinea de precedență: profilul salvat > presetarea emitentului > sinonimele
// comune (ro/en/de/hu).

import { normalizeazaAntet } from "@/domain/import/mapare";

import type { EmitentCard } from "./emitenti";

export const CAMPURI_EXTRAS = [
  "id_tranzactie",
  "numar_card",
  "nr_inmatriculare",
  "data_ora",
  "data",
  "ora",
  "produs",
  "cantitate",
  "pret_unitar",
  "valoare_bruta",
  "valoare_neta",
  "tva",
  "moneda",
  "statie",
  "localitate",
  "tara",
  "km",
  "numar_bon",
] as const;
export type CampExtras = (typeof CAMPURI_EXTRAS)[number];

export const ETICHETE_CAMP_EXTRAS: Readonly<Record<CampExtras, string>> = {
  id_tranzactie: "ID tranzacție",
  numar_card: "Număr card",
  nr_inmatriculare: "Număr de înmatriculare",
  data_ora: "Data și ora",
  data: "Data",
  ora: "Ora",
  produs: "Produs",
  cantitate: "Cantitate (litri)",
  pret_unitar: "Preț unitar",
  valoare_bruta: "Valoare cu TVA",
  valoare_neta: "Valoare fără TVA",
  tva: "TVA",
  moneda: "Moneda",
  statie: "Stația",
  localitate: "Localitatea",
  tara: "Țara",
  km: "Kilometraj",
  numar_bon: "Număr bon",
};

/**
 * Grupurile obligatorii: din fiecare, cel puțin un câmp mapat. Fără card și
 * fără număr de înmatriculare, tranzacția nu duce la niciun vehicul; fără dată,
 * la nicio foaie; fără valoare, raportul n-are ce arăta.
 */
export const OBLIGATORII_EXTRAS: readonly (readonly CampExtras[])[] = [
  ["numar_card", "nr_inmatriculare"],
  ["data_ora", "data"],
  ["produs"],
  ["valoare_bruta", "valoare_neta"],
];

export const SINONIME_COMUNE: Readonly<Record<CampExtras, readonly string[]>> = {
  id_tranzactie: [
    "id tranzactie",
    "id tranzactiei",
    "numar tranzactie",
    "nr tranzactie",
    "transaction id",
    "transaction number",
    "transaktionsnummer",
    "tranzakcio azonosito",
  ],
  numar_card: [
    "numar card",
    "nr card",
    "card",
    "card number",
    "card no",
    "pan",
    "kartennummer",
    "karte",
    "kartyaszam",
  ],
  nr_inmatriculare: [
    "nr auto",
    "numar auto",
    "nr inmatriculare",
    "numar inmatriculare",
    "numar de inmatriculare",
    "registration",
    "registration number",
    "vehicle registration",
    "license plate",
    "licence plate",
    "vrn",
    "kennzeichen",
    "rendszam",
  ],
  data_ora: [
    "data si ora",
    "data ora",
    "data tranzactiei",
    "data tranzactie",
    "transaction date",
    "transaction date time",
    "date time",
    "datetime",
    "datum uhrzeit",
    "transaktionsdatum",
    "datum es ido",
  ],
  data: ["data", "date", "datum", "datum transaktion"],
  ora: ["ora", "ora tranzactiei", "time", "transaction time", "uhrzeit", "zeit", "ido"],
  produs: ["produs", "produs serviciu", "articol", "product", "product name", "produkt", "termek"],
  cantitate: [
    "cantitate",
    "litri",
    "cantitate litri",
    "quantity",
    "volume",
    "litres",
    "liters",
    "menge",
    "mennyiseg",
  ],
  pret_unitar: [
    "pret unitar",
    "pret",
    "pret litru",
    "unit price",
    "price",
    "price per unit",
    "einzelpreis",
    "egysegar",
  ],
  valoare_bruta: [
    "valoare",
    "valoare cu tva",
    "valoare totala",
    "suma",
    "total",
    "amount",
    "gross amount",
    "total amount",
    "brutto",
    "bruttobetrag",
    "gross",
    "brutto osszeg",
  ],
  valoare_neta: [
    "valoare fara tva",
    "valoare neta",
    "net amount",
    "net",
    "netto",
    "nettobetrag",
    "netto osszeg",
  ],
  tva: ["tva", "valoare tva", "vat", "vat amount", "mwst", "ust", "afa"],
  moneda: ["moneda", "valuta", "currency", "wahrung", "waehrung", "penznem"],
  statie: [
    "statie",
    "statia",
    "benzinarie",
    "site",
    "station",
    "station name",
    "tankstelle",
    "location",
    "kut",
  ],
  localitate: ["localitate", "oras", "city", "town", "ort", "stadt", "varos"],
  tara: ["tara", "country", "land", "orszag"],
  km: ["km", "kilometraj", "km bord", "odometer", "mileage", "km stand", "kilometerstand"],
  numar_bon: [
    "numar bon",
    "nr bon",
    "bon",
    "bon fiscal",
    "receipt",
    "receipt number",
    "belegnummer",
    "beleg",
    "bizonylatszam",
  ],
};

/**
 * Sinonimele în plus per emitent. TOATE necalibrate: niciun extras real n-a
 * trecut încă prin ele. Când primul client trimite un extras, presetarea lui se
 * corectează aici, iar maparea salvată a firmei rămâne oricum prima.
 */
export const PRESETARI: Readonly<
  Record<EmitentCard, Partial<Record<CampExtras, readonly string[]>>>
> = {
  // NECALIBRAT: de verificat pe un extras real
  omv_petrom: {
    numar_card: ["routex card", "card routex", "numar card routex"],
    statie: ["statie routex", "site name"],
  },
  // NECALIBRAT: de verificat pe un extras real
  mol: { numar_card: ["card id", "card no."], statie: ["kut neve", "station name"] },
  // NECALIBRAT: de verificat pe un extras real
  lukoil: { numar_card: ["numar card lukoil"], statie: ["benzinaria"] },
  // NECALIBRAT: de verificat pe un extras real
  rompetrol: { numar_card: ["numar card fleet"], statie: ["denumire statie"] },
  // NECALIBRAT: de verificat pe un extras real
  dkv: {
    numar_card: ["card number dkv", "kartennr"],
    nr_inmatriculare: ["kfz kennzeichen", "kfz"],
    statie: ["akzeptanzstelle"],
  },
  // NECALIBRAT: de verificat pe un extras real
  shell: {
    numar_card: ["card pan"],
    nr_inmatriculare: ["vehicle registration number"],
    statie: ["site name"],
  },
  // NECALIBRAT: de verificat pe un extras real
  eurowag: { numar_card: ["card no"], statie: ["pos name"] },
  // „Alt emitent”: doar sinonimele comune și maparea salvată.
  altul: {},
};

export type ProfilMapare = Readonly<{ mapare: Readonly<Partial<Record<CampExtras, string>>> }>;

export type MapareDetectata = Readonly<{
  /** Câmp canonic → antetul din fișier, așa cum apare. */
  mapare: Readonly<Partial<Record<CampExtras, string>>>;
  /** Etichetele grupurilor obligatorii fără nicio coloană („Număr card sau Număr de înmatriculare”). */
  lipsa: readonly string[];
  /** Câmpurile pentru care mai multe coloane se potrivesc la fel de bine. */
  ambigue: readonly Readonly<{ camp: CampExtras; coloane: readonly string[] }>[];
}>;

function chei(alias: string): readonly string[] {
  const n = normalizeazaAntet(alias);
  return [n, n.replace(/ /gu, "")];
}

/** Coloanele care se potrivesc EXACT cu unul dintre sinonime (sau cu forma lor fără spații). */
function potriviriExacte(
  antet: readonly string[],
  sinonime: readonly string[],
  ocupate: ReadonlySet<string>,
): string[] {
  const cautate = new Set(sinonime.flatMap(chei));
  return antet.filter((col) => {
    if (ocupate.has(col)) return false;
    const n = normalizeazaAntet(col);
    return cautate.has(n) || cautate.has(n.replace(/ /gu, ""));
  });
}

/** „Cantitate (litri)” → `cantitate`: antetul ÎNCEPE cu sinonimul, urmat de un cuvânt. */
function potriviriPrefix(
  antet: readonly string[],
  sinonime: readonly string[],
  ocupate: ReadonlySet<string>,
): string[] {
  const cautate = sinonime.map(normalizeazaAntet).filter((s) => s.length >= 3);
  return antet.filter((col) => {
    if (ocupate.has(col)) return false;
    const n = normalizeazaAntet(col);
    return cautate.some((s) => n.startsWith(`${s} `));
  });
}

/**
 * Maparea coloanelor unui extras. Antetele se compară normalizate (fără
 * diacritice, fără punctuație), ca „Data Tranzacţiei”, „DATA TRANZACTIEI” și
 * „data_tranzactiei” să ajungă la același câmp. O coloană nu servește două
 * câmpuri. Pe fiecare câmp: profilul salvat (dacă antetul lui mai există în
 * fișier), apoi presetarea emitentului, apoi sinonimele comune; potrivirea
 * exactă bate potrivirea pe prefix.
 */
export function detecteazaMapare(
  antet: readonly string[],
  emitent: EmitentCard,
  profilSalvat: ProfilMapare | null,
): MapareDetectata {
  const mapare: Partial<Record<CampExtras, string>> = {};
  const ocupate = new Set<string>();
  const ambigue: { camp: CampExtras; coloane: readonly string[] }[] = [];

  if (profilSalvat !== null) {
    for (const camp of CAMPURI_EXTRAS) {
      const coloana = profilSalvat.mapare[camp];
      if (coloana !== undefined && antet.includes(coloana) && !ocupate.has(coloana)) {
        mapare[camp] = coloana;
        ocupate.add(coloana);
      }
    }
  }

  const surse = (camp: CampExtras): readonly (readonly string[])[] => [
    PRESETARI[emitent][camp] ?? [],
    SINONIME_COMUNE[camp],
  ];

  // Întâi potrivirile exacte, pentru TOATE câmpurile; abia apoi prefixele. Altfel
  // „Data” ar lua prin prefix coloana „Data tranzacției”, pe care o vrea exact
  // câmpul `data_ora`.
  for (const etapa of [potriviriExacte, potriviriPrefix]) {
    for (const camp of CAMPURI_EXTRAS) {
      if (mapare[camp] !== undefined || ambigue.some((a) => a.camp === camp)) continue;
      for (const sinonime of surse(camp)) {
        if (sinonime.length === 0) continue;
        const gasite = etapa(antet, sinonime, ocupate);
        const [singura] = gasite;
        if (gasite.length === 1 && singura !== undefined) {
          mapare[camp] = singura;
          ocupate.add(singura);
          break;
        }
        if (gasite.length > 1) {
          ambigue.push({ camp, coloane: gasite });
          break;
        }
      }
    }
  }

  const lipsa = OBLIGATORII_EXTRAS.filter((grup) => grup.every((c) => mapare[c] === undefined)).map(
    (grup) => grup.map((c) => ETICHETE_CAMP_EXTRAS[c]).join(" sau "),
  );

  return { mapare, lipsa, ambigue };
}
