// src/schemas/employee.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  actualizeazaAngajatSchema,
  CAMPURI_EDITABILE_ANGAJAT,
  creeazaContractSchema,
  inroleazaAngajatSchema,
  modificaSalariuContractSchema,
  mutaAngajatiSchema,
} from "./employee";

describe("zilele de concediu anual pe contract", () => {
  // „21 de zile" era codificat în schemă, iar regula firmei dădea 20 (QA 8 oct
  // 2026, HR-023). Schema nu mai are implicit: lipsa înseamnă `null`, iar
  // acțiunea completează din `organizations.zile_concediu_anual_implicit`.
  const CONTRACT = {
    employee_id: "55555555-5555-4555-8555-555555555555",
    numar: "12/2026",
    data_contract: "2026-09-28",
    valabil_de_la: "2026-10-01",
    salariu_baza: 5000,
  };

  it("contract nou fără zile: `null`, nu 21", () => {
    expect(creeazaContractSchema.parse(CONTRACT).zile_concediu_anual).toBeNull();
  });

  it("contract nou cu câmpul golit: `null`", () => {
    expect(
      creeazaContractSchema.parse({ ...CONTRACT, zile_concediu_anual: "" }).zile_concediu_anual,
    ).toBeNull();
  });

  it("contract nou cu zile explicite: valoarea trimisă", () => {
    expect(
      creeazaContractSchema.parse({ ...CONTRACT, zile_concediu_anual: "25" }).zile_concediu_anual,
    ).toBe(25);
  });

  it("contract nou cu zile fracționare: respins (coloana e întreagă)", () => {
    const r = creeazaContractSchema.safeParse({ ...CONTRACT, zile_concediu_anual: 20.5 });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path.includes("zile_concediu_anual"))).toBe(true);
  });

  it("la înrolare câmpul e obligatoriu: asistentul îl precompletează din firmă", () => {
    const r = inroleazaAngajatSchema.safeParse({ ...CONTRACT, zile_concediu_anual: "" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const eroare = r.error.issues.find((i) => i.path.includes("zile_concediu_anual"));
    expect(eroare?.message).toBe("Zilele de concediu anual sunt obligatorii.");
  });

  it("la înrolare câmpul lipsă e tot o eroare pe câmp", () => {
    const r = inroleazaAngajatSchema.safeParse(CONTRACT);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path.includes("zile_concediu_anual"))).toBe(true);
  });
});

describe("salariul de bază pe contract și act adițional", () => {
  // Un contract de muncă fără salariu nu există; 0 lei trecea (QA 8 oct 2026,
  // HR-021: act adițional de 0 lei „activ"). Pragul firmei se verifică în
  // acțiune, cu setările; aici doar că suma e pozitivă.
  const CONTRACT = {
    employee_id: "55555555-5555-4555-8555-555555555555",
    numar: "12/2026",
    data_contract: "2026-09-28",
    valabil_de_la: "2026-10-01",
  };

  it("contract nou cu salariu 0: respins pe câmp", () => {
    const r = creeazaContractSchema.safeParse({ ...CONTRACT, salariu_baza: 0 });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path.includes("salariu_baza"))).toBe(true);
  });

  it("contract nou cu salariu pozitiv: acceptat", () => {
    expect(creeazaContractSchema.safeParse({ ...CONTRACT, salariu_baza: 1 }).success).toBe(true);
  });

  it("act adițional cu salariu 0: respins pe câmp", () => {
    const r = modificaSalariuContractSchema.safeParse({
      contract_id: "55555555-5555-4555-8555-555555555555",
      salariu_baza: 0,
      valabil_de_la: "2026-11-01",
      data_act: "2026-10-20",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path.includes("salariu_baza"))).toBe(true);
  });
});

// ── Validările din valul 2 al remedierii QA (8 oct 2026) ─────────────────────

describe("actualizeazaAngajatSchema — CNP și telefon", () => {
  const FISA = {
    id: "3f5e1a2b-8c4d-4e6f-9a1b-2c3d4e5f6a7b",
    last_name: "Popescu",
    first_name: "Ion",
  };

  // HR-002: un CNP cu anul 2096 (cifra de control corectă) trecea și ajungea criptat în bază.
  it("CNP cu data nașterii în viitor: issue pe `cnp`", () => {
    const r = actualizeazaAngajatSchema.safeParse({ ...FISA, cnp: "5960101123453" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "cnp");
    expect(issue?.message).toContain("în viitor");
  });

  it("CNP din 1996 rămâne acceptat", () => {
    expect(actualizeazaAngajatSchema.safeParse({ ...FISA, cnp: "1960229123452" }).success).toBe(
      true,
    );
  });

  // ADM-007 / ANG-030: „abc" se salva ca telefon.
  it("telefon cu litere: issue pe `telefon`", () => {
    const r = actualizeazaAngajatSchema.safeParse({ ...FISA, telefon: "abc" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path[0] === "telefon")).toBe(true);
  });

  it("telefonul de serviciu și cel de urgență au aceeași regulă", () => {
    const r = actualizeazaAngajatSchema.safeParse({
      ...FISA,
      telefon_serviciu: "abc-12",
      contact_urgenta_telefon: "xyz",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const cai = r.error.issues.map((i) => i.path[0]);
    expect(cai).toContain("telefon_serviciu");
    expect(cai).toContain("contact_urgenta_telefon");
  });

  it("telefon cu spații și prefix: acceptat", () => {
    const r = actualizeazaAngajatSchema.safeParse({ ...FISA, telefon: "+40 722 123 456" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.telefon).toBe("+40 722 123 456");
  });
});

describe("inroleazaAngajatSchema — normă, examen, telefon", () => {
  const INROLARE = {
    first_name: "Ion",
    last_name: "Popescu",
    cnp: "1960229123452",
    numar_act: "123456",
    act_eliberat_de: "SPCLEP Cluj",
    act_eliberat_la: "2020-01-01",
    reges_tip_act: "CarteIdentitate",
    serie_act: "CJ",
    adresa_strada: "Str. Memorandumului 1",
    adresa_oras: "Cluj-Napoca",
    adresa_judet: "Cluj",
    hired_on: "2026-01-01",
    data_contract: "2026-01-01",
    valabil_de_la: "2026-01-01",
    salariu_baza: 4000,
    // Obligatoriu la înrolare din 0193 (concediul proporțional): asistentul îl
    // precompletează din firmă, deci un formular real îl trimite mereu.
    zile_concediu_anual: 20,
  };

  it("fixture-ul de bază trece", () => {
    expect(inroleazaAngajatSchema.safeParse(INROLARE).success).toBe(true);
  });

  // HR-030: „câmpul permite max. 12" — art. 112 Codul muncii: 8 h/zi.
  it("norma zilnică de 12 ore: issue pe `norma_ore_zi`", () => {
    const r = inroleazaAngajatSchema.safeParse({ ...INROLARE, norma_ore_zi: 12 });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "norma_ore_zi");
    expect(issue?.message).toContain("8 ore");
  });

  it("norma zilnică de 8 ore cu 40 pe săptămână: acceptată", () => {
    expect(
      inroleazaAngajatSchema.safeParse({ ...INROLARE, norma_ore_zi: 8, norma_ore_saptamana: 40 })
        .success,
    ).toBe(true);
  });

  it("coerență: 8 ore pe zi cu 20 pe săptămână depășește săptămâna — issue pe `norma_ore_zi`", () => {
    const r = inroleazaAngajatSchema.safeParse({
      ...INROLARE,
      norma_ore_zi: 8,
      norma_ore_saptamana: 20,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "norma_ore_zi");
    expect(issue?.message).toContain("săptămânal");
  });

  it("coerență: 6 ore pe zi cu 30 pe săptămână: acceptată", () => {
    expect(
      inroleazaAngajatSchema.safeParse({ ...INROLARE, norma_ore_zi: 6, norma_ore_saptamana: 30 })
        .success,
    ).toBe(true);
  });

  it("coerență și pe contractul de bază", () => {
    const r = creeazaContractSchema.safeParse({
      employee_id: "55555555-5555-4555-8555-555555555555",
      numar: "12/2026",
      data_contract: "2026-09-28",
      valabil_de_la: "2026-10-01",
      salariu_baza: 4000,
      norma_ore_zi: 8,
      norma_ore_saptamana: 20,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path[0] === "norma_ore_zi")).toBe(true);
  });

  // HR-017, oglinda regulii din `ssm.ts`: înrolarea inserează aceeași fișă.
  it("valabilitatea fișei anterioară examinării: issue pe `examen_valabil_pana`", () => {
    const r = inroleazaAngajatSchema.safeParse({
      ...INROLARE,
      examen_data: "2026-10-08",
      examen_valabil_pana: "2026-01-01",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "examen_valabil_pana");
    expect(issue?.message).toContain("anterioară datei examinării");
  });

  it("valabilitatea fișei ulterioară examinării: acceptată", () => {
    expect(
      inroleazaAngajatSchema.safeParse({
        ...INROLARE,
        examen_data: "2026-10-08",
        examen_valabil_pana: "2027-10-08",
      }).success,
    ).toBe(true);
  });

  it("valabilitate fără dată de examinare: nu se compară", () => {
    expect(
      inroleazaAngajatSchema.safeParse({ ...INROLARE, examen_valabil_pana: "2026-01-01" }).success,
    ).toBe(true);
  });

  // ONB-034: telefonul din asistent are aceeași regulă ca fișa.
  it("telefon cu litere: issue pe `telefon`", () => {
    const r = inroleazaAngajatSchema.safeParse({ ...INROLARE, telefon: "abc" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path[0] === "telefon")).toBe(true);
  });
});

/**
 * Poarta care apără fișa de personal de o ștergere tăcută.
 *
 * `actualizeazaAngajatSchema` e un `.pick()` din schema de creare, iar câmpurile
 * picate își păstrează `.default(...)`. Consecința, măsurată pe cod real: dintr-un
 * obiect cu 13 chei trimis de formular, Zod scotea 34, iar handler-ul le trimitea
 * pe toate la `.update()`. Cele 22 pe care formularul nu le arăta se scriau ca
 * `null` — adresa, actul de identitate, contactul de urgență, starea civilă,
 * managerul direct — sau reveneau la implicit („RO", „normale", pilonul II bifat).
 * Nicio eroare: `UPDATE`-ul reușea, doar că golea.
 *
 * Testele de mai jos nu verifică o convenție de stil. Verifică faptul că lista
 * pe care o parcurge formularul și mulțimea de chei pe care schema le scrie sunt
 * ACEEAȘI mulțime. Când cineva adaugă un câmp în `.pick()` fără să-i dea un
 * control, testul pică aici, nu producția peste o lună.
 */
describe("actualizeazaAngajatSchema", () => {
  it("acceptă exact câmpurile pe care formularul de editare le parcurge, plus id", () => {
    const dinSchema = Object.keys(actualizeazaAngajatSchema.shape).sort();
    const dinFormular = [...CAMPURI_EDITABILE_ANGAJAT, "id"].sort();
    expect(dinSchema).toStrictEqual(dinFormular);
  });

  it("substituie implicitele pentru orice cheie absentă — de aceea lista trebuie să fie completă", () => {
    const rezultat = actualizeazaAngajatSchema.safeParse({
      id: "3f5e1a2b-8c4d-4e6f-9a1b-2c3d4e5f6a7b",
      last_name: "Popescu",
      first_name: "Ion",
    });
    expect(rezultat.success).toBe(true);
    if (!rezultat.success) return;

    // Dovada comportamentului, nu o dorință: o cheie lipsă NU rămâne absentă din
    // ieșire, deci nu poate însemna „lasă coloana neatinsă" la un UPDATE.
    expect(Object.keys(rezultat.data).length).toBe(CAMPURI_EDITABILE_ANGAJAT.length + 1);
    expect(rezultat.data.adresa_strada).toBeNull();
    expect(rezultat.data.manager_employee_id).toBeNull();
    expect(rezultat.data.contact_urgenta_nume).toBeNull();
    expect(rezultat.data.cetatenie).toBe("RO");
    expect(rezultat.data.conditii_munca).toBe("normale");
  });
});

/**
 * Schema mutării între departamente.
 *
 * Contrastul cu testele de mai sus e chiar ideea ei: `actualizeazaAngajatSchema`
 * are 36 de câmpuri și trebuie apărată cu o poartă care numără mulțimi, fiindcă
 * orice cheie lipsă golește o coloană. Schema asta are DOUĂ câmpuri, deci nu are
 * ce goli — și de-asta mutarea nu trece prin cealaltă.
 */
describe("mutaAngajatiSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("respinge lista goală de angajați", () => {
    expect(mutaAngajatiSchema.safeParse({ employee_ids: [], department_id: null }).success).toBe(
      false,
    );
  });

  it("respinge un identificator care nu e UUID", () => {
    expect(
      mutaAngajatiSchema.safeParse({ employee_ids: ["nu-e-uuid"], department_id: null }).success,
    ).toBe(false);
  });

  it("acceptă department_id null — scoaterea din departament", () => {
    expect(
      mutaAngajatiSchema.safeParse({ employee_ids: [UUID], department_id: null }).success,
    ).toBe(true);
  });

  it("pune department_id pe null când lipsește din intrare", () => {
    expect(mutaAngajatiSchema.parse({ employee_ids: [UUID] }).department_id).toBeNull();
  });

  it("respinge un department_id care nu e UUID", () => {
    expect(
      mutaAngajatiSchema.safeParse({ employee_ids: [UUID], department_id: "primul" }).success,
    ).toBe(false);
  });

  it("deduplică identificatorii repetați", () => {
    // Handler-ul compară numărul de rânduri întoarse de `.in("id", …)` cu
    // lungimea listei, ca să prindă un refuz parțial al politicii. Cu `[X, X]`
    // baza întoarce UN rând iar lungimea e doi, deci o scriere perfect reușită
    // ar fi raportată drept refuz („nu aveți dreptul"). Din interfață nu se
    // poate întâmpla — selecția e un `Set` — dar acțiunea e un endpoint POST
    // invocabil direct.
    const rezultat = mutaAngajatiSchema.parse({ employee_ids: [UUID, UUID, UUID] });
    expect(rezultat.employee_ids).toEqual([UUID]);
  });

  it("plafonează mutarea în masă la 200", () => {
    const prea = Array.from({ length: 201 }, () => UUID);
    expect(mutaAngajatiSchema.safeParse({ employee_ids: prea, department_id: null }).success).toBe(
      false,
    );
    const exact = Array.from({ length: 200 }, () => UUID);
    expect(mutaAngajatiSchema.safeParse({ employee_ids: exact, department_id: null }).success).toBe(
      true,
    );
  });
});

/**
 * Cealaltă jumătate a porții — cea pe care antetul de mai sus o promitea, dar
 * nu o verifica.
 *
 * `construiestePayload` din `formular-angajat.tsx` parcurge
 * `CAMPURI_EDITABILE_ANGAJAT` și citește `FormData` pentru fiecare cheie. O
 * cheie fără control randat produce ȘIRUL GOL, care ajunge la schemă, devine
 * `null` și SUPRASCRIE valoarea din bază. Nicio eroare: `UPDATE`-ul reușește,
 * doar că golește.
 *
 * Comentariul din formular o spunea în scris — „trebuie să primească și un
 * control randat mai jos, altfel prima salvare îl golește" — și tot s-a
 * întâmplat: `act_eliberat_la` și `reges_tip_act` au fost adăugate în listă
 * fără controale, iar prima salvare a oricărei fișe le-ar fi șters.
 *
 * Testul citește FIȘIERUL, nu randează componenta: proiectul `ui` din
 * `vitest.config.mts` acoperă doar `src/components/`, iar pentru pagini unealta
 * e Playwright. Aici e de ajuns o potrivire de `nume="…"`, fiindcă `<Camp>` e
 * singurul mod în care formularul randează un control.
 */
describe("formularul de editare randează tot ce trimite", () => {
  const FORMULAR = join(process.cwd(), "src/app/(app)/angajati/formular-angajat.tsx");
  const sursa = readFileSync(FORMULAR, "utf8");

  it("găsește formularul", () => {
    // Fără asta, o redenumire de fișier ar face testul verde pe un șir gol.
    expect(sursa.length).toBeGreaterThan(1000);
  });

  it("fiecare câmp editabil are un control randat", () => {
    // Două forme, amândouă legitime: `<Camp nume="…">` pentru controalele
    // obișnuite și `name="…"` direct pentru bifă, care nu trece prin `Camp` —
    // o casetă de bifat n-are eticheta deasupra, ci lângă ea.
    const fara = CAMPURI_EDITABILE_ANGAJAT.filter(
      (cheie) =>
        !new RegExp(`nume="${cheie}"`, "u").test(sursa) &&
        !new RegExp(`name="${cheie}"`, "u").test(sursa),
    );
    expect(
      fara,
      `Câmpuri trimise de \`construiestePayload\` fără control în formular: ${fara.join(", ")}. ` +
        `Prima salvare le va goli, fără nicio eroare.`,
    ).toEqual([]);
  });
});
