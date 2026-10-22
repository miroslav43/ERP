// src/domain/fleet/contabil/format-jurnal.ts
//
// Fișierele CSV ale exportului contabil al flotei (F12g):
//  · `jurnal_csv` — jurnalul de costuri: un rând per cost, cu tot ce s-a decis
//    (intră sau nu în notă și de ce). E citit de un om, deci rămâne UTF-8 cu
//    diacritice; e și „previzualizarea” celorlalte formate;
//  · `articole_csv` — articole contabile simple, coloanele ecranului Saga
//    „Articole contabile”: Data, Nr. doc, Cont debit, Cont credit, Suma,
//    Explicație. Textul trece prin `inAscii` (L7);
//  · `de-verificat.csv` — liniile care NU intră în note, cu motivul, plus
//    avertismentele; însoțește ZIP-urile Saga și WinMentor.
//
// Ultimele rânduri ale jurnalului spun totalurile și maparea conturilor folosite,
// ca fișierul să-și poarte singur configurarea (decizia L1).
import {
  ETICHETE_MOTIV,
  numarDocument,
  type LinieExclusa,
  type LinieInclusa,
  type ProblemaExport,
  type RezultatExport,
} from "./articole";
import type { ConfigurareExport } from "./configurare";
import { BOM, celulaText, dataRo, randuri, sumaCsv, type OptiuniCsv } from "./csv";
import {
  CATEGORII_CONTABILE,
  comparaLinii,
  ETICHETE_CATEGORIE_CONTABILA,
  ETICHETE_SURSA,
  type LinieCost,
} from "./linii";
import { inAscii } from "./text-ascii";

const COLOANE_JURNAL = [
  "Data",
  "Sursă",
  "Categorie",
  "Vehicul",
  "Șofer",
  "Document",
  "Furnizor",
  "CUI furnizor",
  "Litri",
  "Total",
  "Bază",
  "TVA deductibil",
  "TVA nedeductibil",
  "Regim",
  "Regim dedus",
  "Cont debit",
  "Cont credit",
  "Intră în notă",
  "Motiv",
  "ID",
] as const;

type Rand =
  | { readonly fel: "inclusa"; readonly linie: LinieCost; readonly inclusa: LinieInclusa }
  | { readonly fel: "exclusa"; readonly linie: LinieCost; readonly exclusa: LinieExclusa }
  | { readonly fel: "problema"; readonly linie: LinieCost; readonly problema: ProblemaExport };

/** Toate liniile, în ordinea comună (data, sursa, id). */
function toateLiniile(r: RezultatExport): Rand[] {
  const toate: Rand[] = [
    ...r.incluse.map((inclusa) => ({ fel: "inclusa" as const, linie: inclusa.linie, inclusa })),
    ...r.excluse.map((exclusa) => ({ fel: "exclusa" as const, linie: exclusa.linie, exclusa })),
    ...r.probleme.map((problema) => ({
      fel: "problema" as const,
      linie: problema.linie,
      problema,
    })),
  ];
  return toate.sort((a, b) => comparaLinii(a.linie, b.linie));
}

function litriCsv(litri: number | null, zecimale: "," | "."): string {
  return litri === null ? "" : sumaCsv(Math.round(litri * 100), zecimale);
}

const ETICHETA_REGIM = { integral: "integral", limitat_50: "limitat 50%" } as const;

/** Jurnalul de costuri al lunii, UTF-8 cu BOM, CRLF. */
export function jurnalCsv(
  rezultat: RezultatExport,
  configurare: ConfigurareExport,
  optiuni: OptiuniCsv,
): string {
  const s = optiuni.separator;
  const z = optiuni.zecimale;
  const lei = (bani: number) => sumaCsv(bani, z);
  const linii: string[] = [COLOANE_JURNAL.map(celulaText).join(s)];

  for (const rand of toateLiniile(rezultat)) {
    const l = rand.linie;
    const comune = [
      dataRo(l.data),
      celulaText(ETICHETE_SURSA[l.sursa]),
      celulaText(ETICHETE_CATEGORIE_CONTABILA[l.categorie]),
      celulaText(l.vehicul.nr ?? "vehicul necunoscut"),
      celulaText(l.sofer ?? ""),
      celulaText(l.document ?? numarDocument(l)),
      celulaText(l.furnizor ?? ""),
      l.cuiFurnizor ?? "",
      litriCsv(l.litri, z),
      lei(l.totalBani),
    ];
    if (rand.fel === "inclusa") {
      const i = rand.inclusa;
      linii.push(
        [
          ...comune,
          lei(i.bazaBani),
          lei(i.tvaDeductibilBani),
          lei(i.tvaNedeductibilBani),
          celulaText(i.regim === null ? "firmă neplătitoare de TVA" : ETICHETA_REGIM[i.regim]),
          i.regim === null ? "" : i.regimDedus ? "da" : "nu",
          i.contDebit,
          configurare.contDecontare,
          "da",
          celulaText(""),
          l.id,
        ].join(s),
      );
    } else {
      const motiv =
        rand.fel === "exclusa"
          ? ETICHETE_MOTIV[rand.exclusa.motiv]
          : `Problemă blocantă: ${rand.problema.detalii}`;
      linii.push([...comune, "", "", "", "", "", "", "", "nu", celulaText(motiv), l.id].join(s));
    }
  }

  const totalIncluse = rezultat.incluse.reduce(
    (t, i) => ({
      total: t.total + i.linie.totalBani,
      baza: t.baza + i.bazaBani,
      ded: t.ded + i.tvaDeductibilBani,
      neded: t.neded + i.tvaNedeductibilBani,
    }),
    { total: 0, baza: 0, ded: 0, neded: 0 },
  );
  const totalExcluse = [...rezultat.excluse, ...rezultat.probleme].reduce(
    (t, e) => t + e.linie.totalBani,
    0,
  );
  const gol = (n: number) => Array.from({ length: n }, () => "");

  linii.push("");
  linii.push(
    [
      celulaText("Total în note"),
      ...gol(8),
      lei(totalIncluse.total),
      lei(totalIncluse.baza),
      lei(totalIncluse.ded),
      lei(totalIncluse.neded),
    ].join(s),
  );
  linii.push([celulaText("Total în afara notelor"), ...gol(8), lei(totalExcluse)].join(s));

  linii.push("");
  linii.push(celulaText("Conturi folosite (propuse — de confirmat cu contabilul)"));
  for (const categorie of CATEGORII_CONTABILE) {
    linii.push(
      [celulaText(ETICHETE_CATEGORIE_CONTABILA[categorie]), configurare.conturi[categorie]].join(s),
    );
  }
  linii.push([celulaText("Cont de decontare (credit)"), configurare.contDecontare].join(s));
  linii.push([celulaText("TVA deductibil"), configurare.contTvaDeductibil].join(s));
  linii.push(
    [
      celulaText("TVA nedeductibil"),
      configurare.tvaNedeductibila === "pe_cheltuiala"
        ? celulaText("pe contul cheltuielii")
        : configurare.contTvaNedeductibila,
    ].join(s),
  );
  linii.push(
    [
      celulaText("Regimul vehiculului fără regim declarat"),
      celulaText(ETICHETA_REGIM[configurare.regimImplicit]),
    ].join(s),
  );
  linii.push([celulaText("Doar foile aprobate"), configurare.doarAprobate ? "da" : "nu"].join(s));
  linii.push(
    [celulaText("Facturile de service în note"), configurare.includeService ? "da" : "nu"].join(s),
  );

  if (rezultat.avertismente.length > 0) {
    linii.push("");
    linii.push(celulaText("Avertismente"));
    for (const a of rezultat.avertismente) linii.push(celulaText(a));
  }

  return BOM + randuri(linii);
}

/** Articolele contabile simple, câte un rând: `Data;Nr. doc;Cont debit;Cont credit;Suma;Explicatie`. */
export function articoleCsv(rezultat: RezultatExport, optiuni: OptiuniCsv): string {
  const s = optiuni.separator;
  const linii: string[] = [
    ["Data", "Nr. doc", "Cont debit", "Cont credit", "Suma", "Explicatie"].map(celulaText).join(s),
  ];
  for (const { articole } of rezultat.incluse) {
    for (const a of articole) {
      linii.push(
        [
          dataRo(a.data),
          celulaText(a.numarDocument),
          a.contDebit,
          a.contCredit,
          sumaCsv(a.sumaBani, optiuni.zecimale),
          celulaText(inAscii(a.explicatie, 48)),
        ].join(s),
      );
    }
  }
  return BOM + randuri(linii);
}

/** Ce NU intră în fișierele de import, cu motivul, plus avertismentele. */
export function deVerificatCsv(rezultat: RezultatExport, optiuni: OptiuniCsv): string {
  const s = optiuni.separator;
  const linii: string[] = [
    ["Data", "Sursă", "Vehicul", "Document", "Furnizor", "Total", "Motiv", "ID"]
      .map(celulaText)
      .join(s),
  ];
  for (const rand of toateLiniile(rezultat)) {
    if (rand.fel === "inclusa") continue;
    const l = rand.linie;
    const motiv =
      rand.fel === "exclusa"
        ? ETICHETE_MOTIV[rand.exclusa.motiv]
        : `Problemă blocantă: ${rand.problema.detalii}`;
    linii.push(
      [
        dataRo(l.data),
        celulaText(ETICHETE_SURSA[l.sursa]),
        celulaText(l.vehicul.nr ?? "vehicul necunoscut"),
        celulaText(l.document ?? numarDocument(l)),
        celulaText(l.furnizor ?? ""),
        sumaCsv(l.totalBani, optiuni.zecimale),
        celulaText(motiv),
        l.id,
      ].join(s),
    );
  }
  linii.push("");
  linii.push(celulaText("Avertismente"));
  for (const a of rezultat.avertismente) linii.push(celulaText(a));
  return BOM + randuri(linii);
}
