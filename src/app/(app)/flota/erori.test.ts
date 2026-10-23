// src/app/(app)/flota/erori.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { cuVirgula } from "@/lib/text/diacritice";

import { traduEroare, traduEroareAlocare, traduEroareFiscal, traduEroareUit } from "./erori";

function p0001(message: string) {
  return { code: "P0001", message, details: "", hint: "", name: "PostgrestError" };
}

/*
 * Literele cu SEDILĂ (U+015E, U+015F, U+0162, U+0163) se construiesc din coduri:
 * fișierul nu le conține literal, deci verificarea cu `grep -P` pe fișierele
 * atinse rămâne curată, iar testele forma veche tot o exercită.
 */
const [S_SEDILA, s_SEDILA, T_SEDILA, t_SEDILA] = [0x15e, 0x15f, 0x162, 0x163].map((c) =>
  String.fromCodePoint(c),
) as [string, string, string, string];
const SEDILE = new RegExp(`[${S_SEDILA}${s_SEDILA}${T_SEDILA}${t_SEDILA}]`, "u");

/** Forma veche a unui mesaj (0012/0018/0172): ș/ț cu virgulă → aceleași litere cu sedilă. */
function cuSedila(text: string): string {
  return text
    .replaceAll("ș", s_SEDILA)
    .replaceAll("ț", t_SEDILA)
    .replaceAll("Ș", S_SEDILA)
    .replaceAll("Ț", T_SEDILA);
}

function prinde(error: unknown): ActionDenied {
  try {
    traduEroare(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroare n-a aruncat");
}

describe("traduEroare — refuzurile bazei ajung pe câmpul vinovat", () => {
  it.each([
    ["Kilometrajul de sosire trebuie să fie mai mare decât cel de plecare.", ["km_sosire"]],
    ["Ora de sosire trebuie să fie după ora de plecare.", ["sosire_la"]],
    ["Data alimentării este în afara intervalului foii de parcurs.", ["alimentat_la"]],
    // 0199/0200 rescriu triggerele din 0012/0018 cu ș/ț cu virgulă: tiparele se
    // potrivesc pe forma pe care o trimite acum baza.
    [
      "Completați ora și kilometrajul de sosire înainte de a trimite foaia spre aprobare.",
      ["sosire_la", "km_sosire"],
    ],
    ["Șoferul selectat nu aparține organizației dumneavoastră.", ["employee_id"]],
    // Plasa pentru o bază rămasă pe forma veche (0018, cu sedilă): același câmp.
    [cuSedila("Șoferul selectat nu aparține organizației dumneavoastră."), ["employee_id"]],
    // 0199: mesajele noi, cu ș/ț corecte.
    [
      "Vehiculul ales nu vă este alocat în ziua plecării și nu este o mașină comună (pool). Foaia se întocmește pe vehiculul primit în folosință sau pe unul din pool.",
      ["vehicle_id"],
    ],
    ["Foaia se poate muta doar pe un șofer pentru care aveți drept de întocmire.", ["employee_id"]],
  ])("%s", (mesaj, campuri) => {
    const eroare = prinde(p0001(mesaj));
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual(campuri);
    // Un mesaj rămas cu sedilă (funcțiile din 0012/0018/0172 nerescrise) ajunge
    // la om cu virgulă; unul deja corect trece neschimbat.
    expect(eroare.fieldErrors?.[campuri[0] ?? ""]).toEqual([cuVirgula(mesaj)]);
  });

  it.each([
    "Nu puteți aproba o foaie întocmită de dumneavoastră.",
    "Foaia de parcurs a unui coleg se poate doar aproba sau respinge, după ce a fost trimisă. O completează și o trimite șoferul ei.",
    // 0199 §C4: foaia aprobată și alimentările ei.
    "Foaia de parcurs este aprobată și nu se mai modifică. Dacă are o greșeală, cereți administratorului flotei să o storneze, apoi întocmiți una nouă.",
    "Foaia de parcurs aprobată se poate doar storna. Pentru corecții, stornați-o și întocmiți una nouă.",
    "Alimentarea face parte dintr-o foaie de parcurs aprobată și nu se mai modifică. Pentru corecții, foaia se stornează și se întocmește una nouă.",
    "Alimentarea nu se mută pe altă foaie de parcurs. Ștergeți-o și adăugați-o pe foaia corectă.",
    // 0199 §C5: foaia trimisă nu se rescrie. Începe cu „Foaia”, nu cu
    // „Kilometrajul”: refuzul ține de stare, nu de câmpul atins.
    "Foaia de parcurs este trimisă spre aprobare și nu se mai modifică. Retrageți-o în ciornă, corectați-o și trimiteți-o din nou.",
  ])("0199, fără câmp: %s", (mesaj) => {
    const eroare = prinde(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });

  it.each([
    // 0213 (F12a): garda propunerii citite de pe bon. Banner, NU câmp: coloana
    // `ocr_propunere` n-are casetă în formular, iar un câmp ascuns ar pierde
    // mesajul sub „Corectați câmpurile marcate” (F12a §8.7).
    "Propunerea citită de pe bon o scrie doar aplicația, la salvarea alimentării.",
    "Propunerea citită de pe bon nu se mai poate modifica după salvarea alimentării.",
    // 0202 §6, ajuns din `adaugaAlimentare` de când poza se leagă la adăugare.
    "Poza bonului nu aparține acestei foi de parcurs. Încărcați-o din nou de pe foaie.",
  ])("0202/0213, fără câmp: %s", (mesaj) => {
    const eroare = prinde(p0001(mesaj));
    expect(eroare.code).toBe("CONFLICT");
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });

  it("un refuz fără câmp rămâne mesaj general, neschimbat (0199/0200, cu virgulă)", () => {
    const mesaj =
      "Foaia de parcurs este aprobată. Pentru corecții, stornați-o și întocmiți una nouă.";
    const eroare = prinde(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });

  it("un refuz fără câmp rămas cu sedilă ajunge doar cu diacriticele corectate", () => {
    const corect =
      "Foaia de parcurs este aprobată. Pentru corecții, stornați-o și întocmiți una nouă.";
    const eroare = prinde(p0001(cuSedila(corect)));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(corect);
  });

  const KM_REGRES =
    "Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (10000 km). Un odometru nu poate da înapoi: verificați cifra introdusă sau corectați foaia de parcurs anterioară.";
  it.each([
    // 0199/0200: forma de acum a bazei.
    ["virgulă (0199/0200)", KM_REGRES],
    // 0018: forma veche, cu sedilă (QA ADM-021).
    ["sedilă (0018)", cuSedila(KM_REGRES)],
  ])("kilometrajul în regres, forma cu %s: cifrele rămân, pe câmp, fără sedilă", (_, mesaj) => {
    const eroare = prinde(p0001(mesaj));
    const pecamp = eroare.fieldErrors?.km_plecare?.[0] ?? "";
    expect(pecamp).toBe(KM_REGRES);
    expect(pecamp).not.toMatch(SEDILE);
    expect(eroare.message).not.toMatch(SEDILE);
  });
});

/*
 * Mesajele P0001 din 0199–0202 (rescrierile triggerelor din 0012/0018) se scriu
 * cu ș/ț cu VIRGULĂ dedesubt (U+0219/U+021B), nu cu sedilă (U+015F/U+0163): așa
 * cere regula proiectului, iar tiparele de mai sus se potrivesc pe forma asta.
 * Migrările nu sunt încă aplicate nicăieri, deci se corectează pe loc; poarta
 * le ține corectate.
 */
describe("migrările flotei 0199–0202 — fără sedile", () => {
  const MIGRARI = [
    "0199_flota_roluri.sql",
    "0200_flota_foaia_zilnica.sql",
    "0201_flota_conformitate_zilnica.sql",
    "0202_flota_tipuri_si_fisiere.sql",
  ];

  it.each(MIGRARI)("%s nu conține litere cu sedilă", (fisier) => {
    const text = readFileSync(join(process.cwd(), "supabase", "migrations", fisier), "utf8");
    const linii = text
      .split("\n")
      .map((linie, i) => [i + 1, linie] as const)
      .filter(([, linie]) => SEDILE.test(linie))
      .map(([nr, linie]) => `${nr}: ${linie.trim()}`);
    expect(linii).toEqual([]);
  });
});

describe("traduEroareAlocare — P0001 ajunge cu virgulă dedesubt", () => {
  it("un refuz general din alocări nu păstrează sedila", () => {
    // 0172 (alocările), nerescrisă: forma veche, cu sedilă.
    const mesaj = cuSedila("Vehiculul selectat nu aparține organizației.");
    let prinsa: unknown;
    try {
      traduEroareAlocare(p0001(mesaj));
    } catch (e) {
      prinsa = e;
    }
    expect(prinsa).toBeInstanceOf(ActionDenied);
    expect((prinsa as ActionDenied).message).toBe("Vehiculul selectat nu aparține organizației.");
  });
});

/**
 * 0200: mesajele foii zilnice, copiate cuvânt cu cuvânt din
 * `0200_flota_foaia_zilnica.sql` (cu cifrele din `format()` completate). Dacă
 * un mesaj se schimbă în bază și nu și aici, caseta cursei pierde eroarea de pe
 * câmp: refuzul ajunge sub buton, iar câmpul vinovat rămâne alb.
 */
describe("traduEroare — 0200, cursele foii zilnice", () => {
  it.each([
    ["Scrieți locul de plecare al cursei.", ["de_la_loc"]],
    ["Scrieți locul de sosire al cursei.", ["pana_la_loc"]],
    ["Scrieți scopul cursei.", ["scop"]],
    [
      "Sosirea cursei se completează întreagă: ora și kilometrajul la sosire.",
      ["sosire_la", "km_sosire"],
    ],
    ["Ora de sosire a cursei trebuie să fie după ora de plecare.", ["sosire_la"]],
    [
      "Kilometrajul la sosirea cursei trebuie să fie mai mare decât cel de la plecare.",
      ["km_sosire"],
    ],
    [
      "Ora de plecare a cursei trebuie să fie în ziua foii de parcurs (05.10.2026).",
      ["plecare_la"],
    ],
    [
      "Ora de sosire a cursei poate fi cel târziu a doua zi după ziua foii. O deplasare mai lungă se scrie pe foile zilelor următoare.",
      ["sosire_la"],
    ],
    [
      "Ora de plecare a cursei coincide cu a altei curse de pe foaie. Verificați orele.",
      ["plecare_la"],
    ],
    [
      "Ora de plecare a cursei este după o cursă neîncheiată. Completați întâi sosirea cursei precedente.",
      ["plecare_la"],
    ],
    [
      "Ora de plecare a cursei este înainte de sosirea cursei precedente (09:00). Cursele nu se suprapun.",
      ["plecare_la"],
    ],
    [
      "Kilometrajul de plecare al cursei (10020 km) este mai mic decât cel de la sosirea cursei precedente (10040 km). Un odometru nu poate da înapoi.",
      ["km_plecare"],
    ],
    [
      "Sosirea cursei lipsește, dar după ea mai urmează o cursă. Doar ultima cursă a zilei poate rămâne neîncheiată.",
      ["sosire_la"],
    ],
    [
      "Ora de sosire a cursei este după plecarea cursei următoare (10:00). Cursele nu se suprapun.",
      ["sosire_la"],
    ],
    [
      "Kilometrajul la sosirea cursei (10070 km) este mai mare decât cel de la plecarea cursei următoare (10060 km).",
      ["km_sosire"],
    ],
    // 0200 §E3: suprapunerea se judecă față de foile declarate, cu foaia numită.
    [
      "Ora de plecare a cursei se suprapune cu o cursă a aceluiași șofer de pe foaia FP-2026-00004 (trimisă), de la 09:00 la 12:00. Un om nu conduce două vehicule în același timp.",
      ["plecare_la"],
    ],
    [
      "Vehiculul nu se schimbă pe o foaie care are deja curse. Ștergeți cursele sau întocmiți foaia pe vehiculul corect.",
      ["vehicle_id"],
    ],
  ])("pe câmp: %s", (mesaj, campuri) => {
    const eroare = prinde(p0001(mesaj));
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual(campuri);
    expect(eroare.message).toBe(mesaj);
  });

  it.each([
    "Orele și kilometrajul foii se scriu pe curse. Modificați cursa, iar foaia se recalculează singură.",
    "Foaia de parcurs a fost ștearsă sau stornată și nu se mai modifică. Întocmiți una nouă.",
    "Foaia de parcurs este respinsă și nu se mai modifică așa. Redeschideți-o în ciornă, corectați-o și trimiteți-o din nou.",
    "Încheiați toate cursele (ora și kilometrajul la sosire) înainte de a trimite foaia spre aprobare.",
    "Adăugați cursele zilei (de unde, până unde, scopul și kilometrii) înainte de a trimite foaia spre aprobare.",
    // Revizia F4: la trimitere, pe caseta de trimitere nu există câmpul datei.
    "O alimentare de pe foaie este în afara intervalului curselor (alimentarea din 10.10.2026 08:30). Corectați data alimentării sau cursele, apoi trimiteți foaia din nou.",
    "Alimentările se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.",
    "Alimentarea a fost ștearsă și nu se mai modifică. Adăugați-o din nou dacă e cazul.",
    "Cursele se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.",
    "Cursa a fost ștearsă și nu se mai modifică. Adăugați-o din nou dacă e cazul.",
    "Cursa nu se mută pe altă foaie de parcurs. Ștergeți-o și adăugați-o pe foaia corectă.",
    "Foaia de parcurs selectată nu aparține organizației dumneavoastră.",
    // 0200 §E1: plafoanele. Încep cu „O foaie”/„Firma”, nu cu un câmp: refuzul
    // ține de foaia întreagă, nu de caseta cursei sau a alimentării.
    "O foaie de parcurs are cel mult 40 de curse, iar aceasta le are deja. Grupați opririle apropiate într-o singură cursă sau ștergeți o cursă greșită.",
    "O foaie de parcurs are cel mult 20 de alimentări, iar aceasta le are deja. Corectați o alimentare existentă sau ștergeți una greșită.",
    "Firma are deja 100 de șabloane de traseu, cât se pot folosi. Ștergeți un șablon pe care nu-l mai folosiți, apoi adăugați-l pe cel nou.",
    // 0200 §E3: poarta de la trimitere, pe caseta care n-are câmpurile cursei.
    // Cu valorile cele mai lungi (foaie veche fără număr, înmatriculare de 16
    // caractere): mesajul trebuie să încapă întreg în cele 300 de caractere.
    "Foaia nu se poate trimite: cursa de la 09:00 se suprapune cu foaia din 05.10.2026 (aprobată) a aceluiași șofer, pe vehiculul ABCDEFGHIJKLMNOP. Corectați orele curselor; dacă greșită e cealaltă foaie, cereți retragerea sau stornarea ei.",
    // 0200 §E4: foaia numerotată. Începe cu „Foaia”, nu cu „Vehiculul”: altfel
    // ar ajunge pe `vehicle_id`, o casetă pe care formularele foii n-o au.
    "Foaia are deja numărul FP-2026-00012; o poate anula doar administratorul flotei.",
    "Foaia are deja numărul FP-2026-00012: vehiculul, șoferul și ziua ei nu se mai schimbă. Dacă sunt greșite, administratorul flotei o anulează, iar foaia corectă se întocmește din nou.",
  ])("fără câmp: %s", (mesaj) => {
    const eroare = prinde(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });

  it.each([
    ["ts_vehicul_zi_uq", "plecare_la", /deja o foaie de parcurs în ziua aceasta/],
    ["fuel_bon_uq", "numar_bon", /Bonul acesta este deja trecut/],
    ["trt_org_denumire_uq", "denumire", /deja un șablon de traseu/],
  ])("23505 pe %s ajunge pe `%s`, nu „vehicul cu același număr”", (index, camp, tipar) => {
    const eroare = prinde({
      code: "23505",
      message: `duplicate key value violates unique constraint "${index}"`,
      details: "",
      hint: "",
      name: "PostgrestError",
    });
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual([camp]);
    expect(eroare.message).toMatch(tipar);
  });

  it("23505 pe vehicul rămâne mesajul de vehicul", () => {
    const eroare = prinde({
      code: "23505",
      message: 'duplicate key value violates unique constraint "vehicles_org_nr_uq"',
      details: "",
      hint: "",
      name: "PostgrestError",
    });
    expect(eroare.message).toMatch(/Există deja un vehicul/);
  });
});

/**
 * 0205: fiscalul flotei. Mesajele P0001 sunt copiate din `flota_fiscal_inainte`
 * (cu cifrele din `format()` completate), iar numele restricțiilor din CHECK-urile
 * și indexurile tabelelor `vehicle_fiscal_regimes` / `vehicle_consumption_norms`.
 */
describe("traduEroareFiscal — 0205", () => {
  function prindeFiscal(error: unknown): ActionDenied {
    try {
      traduEroareFiscal(error);
    } catch (e) {
      if (e instanceof ActionDenied) return e;
      throw e;
    }
    throw new Error("traduEroareFiscal n-a aruncat");
  }

  it.each([
    [
      "Regimul „peste 3.500 kg sau peste 9 locuri” nu se potrivește: fișa vehiculului are 2200 kg și 5 locuri. Corectați fișa sau alegeți alt regim.",
      ["regim"],
    ],
    ["Data de la care se aplică poate fi cel mult peste un an.", ["valabil_de_la"]],
    ["Data deciziei interne nu poate fi în viitor.", ["decizie_data"]],
  ])("P0001 pe câmp: %s", (mesaj, campuri) => {
    const eroare = prindeFiscal(p0001(mesaj));
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual(campuri);
    expect(eroare.message).toBe(mesaj);
  });

  it.each([
    "Rândul a fost șters și nu se mai modifică. Adăugați unul nou.",
    "Rândul nu se mută pe alt vehicul. Ștergeți-l și adăugați-l pe vehiculul corect.",
    "Vehiculul ales nu aparține organizației dumneavoastră.",
  ])("P0001 fără câmp rămâne mesaj general: %s", (mesaj) => {
    const eroare = prindeFiscal(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });

  it.each([
    ["23505", "vfr_vehicul_de_la_uq", "valabil_de_la", /are deja un regim fiscal/],
    ["23505", "vcn_vehicul_de_la_uq", "valabil_de_la", /are deja o normă de consum/],
    ["23503", "vfr_proprietar_fk", "proprietar_employee_id", /nu aparține organizației/],
    ["23514", "vfr_exceptie_ck", "exceptie", /Categoria exceptată/],
    ["23514", "vfr_proprietar_ck", "proprietar_employee_id", /mașina personală/],
    ["23514", "vfr_chirie_ck", "chirie_lunara", /Chiria se completează/],
    ["23514", "vfr_motiv_ck", "motiv", /între 3 și 1\.000/],
    ["23514", "vcn_l_100km_ck", "l_100km", /0,01 și 300/],
  ])("%s pe %s ajunge pe `%s`", (cod, restrictie, camp, tipar) => {
    const eroare = prindeFiscal({
      code: cod,
      message: `violates constraint "${restrictie}"`,
      details: "",
      hint: "",
      name: "PostgrestError",
    });
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual([camp]);
    expect(eroare.message).toMatch(tipar);
  });

  it("o eroare necunoscută cade pe traducerea generală", () => {
    expect(() => {
      traduEroareFiscal(new Error("altceva"));
    }).toThrow();
  });
});

describe("traduEroareUit — 0217, codul UIT pe cursă", () => {
  function prindeUit(error: unknown): ActionDenied {
    try {
      traduEroareUit(error);
    } catch (e) {
      if (e instanceof ActionDenied) return e;
      throw e;
    }
    throw new Error("traduEroareUit n-a aruncat");
  }

  const restrictie = (cod: string, nume: string) => ({
    code: cod,
    message: `duplicate key value violates unique constraint "${nume}"`,
    details: "",
    hint: "",
    name: "PostgrestError",
  });

  it("23505 pe (cursa_id, uit) spune ce e despre UIT, NU „Există deja un vehicul…”", () => {
    const eroare = prindeUit(restrictie("23505", "tsu_cursa_uit_uq"));
    expect(eroare.message).toBe("Codul UIT e deja trecut pe această cursă.");
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual(["uit"]);
    expect(eroare.message).not.toMatch(/vehicul/u);
  });

  it.each([
    ["tsu_uit_format", "uit", /format valid/u],
    ["tsu_valabilitate_ck", "valabilitate_zile", /între 1 și 31/u],
    ["tsu_observatii_len", "observatii", /200 de caractere/u],
  ])("23514 pe %s ajunge pe `%s`", (nume, camp, tipar) => {
    const eroare = prindeUit(restrictie("23514", nume));
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual([camp]);
    expect(eroare.message).toMatch(tipar);
  });

  it.each([
    "Codul UIT nu se mută pe altă cursă. Ștergeți-l și adăugați-l pe cursa corectă.",
    "Codul UIT nu se corectează pe loc. Ștergeți-l și adăugați codul corect.",
  ])("P0001 pe câmpul `uit`: %s", (mesaj) => {
    const eroare = prindeUit(p0001(mesaj));
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual(["uit"]);
    expect(eroare.message).toBe(mesaj);
  });

  it.each([
    "Codurile UIT se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.",
    "Cursa aleasă nu aparține acestei foi de parcurs.",
    "Cursa nu există în această organizație.",
    "Cursa a fost ștearsă. Reîncărcați foaia.",
  ])("P0001 fără câmp rămâne mesaj general: %s", (mesaj) => {
    const eroare = prindeUit(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });

  it("o eroare necunoscută cade pe traducerea generală", () => {
    expect(() => {
      traduEroareUit(new Error("altceva"));
    }).toThrow("altceva");
  });
});
