// src/app/(app)/flota/erori.test.ts
import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";

import { traduEroare } from "./erori";

function p0001(message: string) {
  return { code: "P0001", message, details: "", hint: "", name: "PostgrestError" };
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
    [
      "Completaţi ora şi kilometrajul de sosire înainte de a trimite foaia spre aprobare.",
      ["sosire_la", "km_sosire"],
    ],
    ["Şoferul selectat nu aparţine organizaţiei dumneavoastră.", ["employee_id"]],
    // 0196: mesajele noi, cu ș/ț corecte.
    [
      "Vehiculul ales nu vă este alocat în ziua plecării și nu este o mașină comună (pool). Foaia se întocmește pe vehiculul primit în folosință sau pe unul din pool.",
      ["vehicle_id"],
    ],
    ["Foaia se poate muta doar pe un șofer pentru care aveți drept de întocmire.", ["employee_id"]],
  ])("%s", (mesaj, campuri) => {
    const eroare = prinde(p0001(mesaj));
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual(campuri);
    expect(eroare.fieldErrors?.[campuri[0] ?? ""]).toEqual([mesaj]);
  });

  it.each([
    "Nu puteți aproba o foaie întocmită de dumneavoastră.",
    "Foaia de parcurs a unui coleg se poate doar aproba sau respinge, după ce a fost trimisă. O completează și o trimite șoferul ei.",
    // 0196 §C4: foaia aprobată și alimentările ei.
    "Foaia de parcurs este aprobată și nu se mai modifică. Dacă are o greșeală, cereți administratorului flotei să o storneze, apoi întocmiți una nouă.",
    "Foaia de parcurs aprobată se poate doar storna. Pentru corecții, stornați-o și întocmiți una nouă.",
    "Alimentarea face parte dintr-o foaie de parcurs aprobată și nu se mai modifică. Pentru corecții, foaia se stornează și se întocmește una nouă.",
    "Alimentarea nu se mută pe altă foaie de parcurs. Ștergeți-o și adăugați-o pe foaia corectă.",
    // 0196 §C5: foaia trimisă nu se rescrie. Începe cu „Foaia”, nu cu
    // „Kilometrajul”: refuzul ține de stare, nu de câmpul atins.
    "Foaia de parcurs este trimisă spre aprobare și nu se mai modifică. Retrageți-o în ciornă, corectați-o și trimiteți-o din nou.",
  ])("0196, fără câmp: %s", (mesaj) => {
    const eroare = prinde(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });

  it("un refuz fără câmp rămâne mesaj general, neschimbat", () => {
    const mesaj =
      "Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o şi întocmiţi una nouă.";
    const eroare = prinde(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });
});

/**
 * 0197: mesajele foii zilnice, copiate cuvânt cu cuvânt din
 * `0197_flota_foaia_zilnica.sql` (cu cifrele din `format()` completate). Dacă
 * un mesaj se schimbă în bază și nu și aici, caseta cursei pierde eroarea de pe
 * câmp: refuzul ajunge sub buton, iar câmpul vinovat rămâne alb.
 */
describe("traduEroare — 0197, cursele foii zilnice", () => {
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
    [
      "Ora de plecare a cursei se suprapune cu o cursă a aceluiași șofer de pe altă foaie de parcurs. Un om nu conduce două vehicule în același timp.",
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
    "Alimentările se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.",
    "Alimentarea a fost ștearsă și nu se mai modifică. Adăugați-o din nou dacă e cazul.",
    "Cursele se modifică doar cât foaia de parcurs este ciornă. Retrageți-o sau redeschideți-o în ciornă, apoi corectați-o.",
    "Cursa a fost ștearsă și nu se mai modifică. Adăugați-o din nou dacă e cazul.",
    "Cursa nu se mută pe altă foaie de parcurs. Ștergeți-o și adăugați-o pe foaia corectă.",
    "Foaia de parcurs selectată nu aparține organizației dumneavoastră.",
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
