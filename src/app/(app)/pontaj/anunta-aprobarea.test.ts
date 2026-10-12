// src/app/(app)/pontaj/anunta-aprobarea.test.ts
//
// Vestea aprobării, pe zi și în bloc, scrisă prin clientul admin. Acțiunile
// (`actions-aprobare.test.ts`) mochează modulul ăsta; aici se verifică ce
// scrie el efectiv și că nu aruncă niciodată.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { anuntaAprobareaZilei, anuntaAprobareaZilelor } from "./anunta-aprobarea";

const ORG = "11111111-1111-4111-8111-111111111111";
const ZI = "55555555-5555-4555-8555-555555555555";
const LOT = "99999999-9999-4999-8999-999999999999";
const ANGAJAT_A = "77777777-7777-4777-8777-777777777777";
const ANGAJAT_B = "88888888-8888-4888-8888-888888888888";
const USER_A = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("anuntaAprobareaZilei", () => {
  it("scrie vestea pe ziua aprobată, către contul angajatului, filtrat pe firmă", async () => {
    const admin = clientFals();
    admin.raspunde("attendance_entries", "select", {
      data: { data: "2026-07-03", employee_id: ANGAJAT_A },
    });
    admin.raspunde("employees", "select", { data: { user_id: USER_A } });
    admin.raspunde("notifications", "insert", { data: null });

    expect(await anuntaAprobareaZilei(admin.client, ORG, ZI)).toBe(true);

    const [intrare] = admin.apeluriPe("attendance_entries", "select");
    expect(areFiltru(intrare, "eq", "id", ZI)).toBe(true);
    expect(areFiltru(intrare, "eq", "organization_id", ORG)).toBe(true);
    const [fisa] = admin.apeluriPe("employees", "select");
    expect(areFiltru(fisa, "eq", "id", ANGAJAT_A)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG)).toBe(true);
    const [insert] = admin.apeluriPe("notifications", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG,
      user_id: USER_A,
      kind: "success",
      title: "Ziua de pontaj a fost aprobată",
      body: "Ziua de 03.07.2026 a fost aprobată.",
      link: "/portal/pontajul-meu/zi/2026-07-03",
      entity_type: "attendance_entry",
      entity_id: ZI,
    });
  });

  it("fișă fără cont ⇒ false, fără insert", async () => {
    const admin = clientFals();
    admin.raspunde("attendance_entries", "select", {
      data: { data: "2026-07-03", employee_id: ANGAJAT_A },
    });
    admin.raspunde("employees", "select", { data: { user_id: null } });
    expect(await anuntaAprobareaZilei(admin.client, ORG, ZI)).toBe(false);
    expect(admin.apeluriPe("notifications")).toHaveLength(0);
  });

  it("insert picat ⇒ false, nu aruncă", async () => {
    const admin = clientFals();
    admin.raspunde("attendance_entries", "select", {
      data: { data: "2026-07-03", employee_id: ANGAJAT_A },
    });
    admin.raspunde("employees", "select", { data: { user_id: USER_A } });
    admin.raspunde("notifications", "insert", { error: eroarePostgrest("XX000") });
    expect(await anuntaAprobareaZilei(admin.client, ORG, ZI)).toBe(false);
  });
});

describe("anuntaAprobareaZilelor", () => {
  const linii = [
    { id: "a1", employee_id: ANGAJAT_A },
    { id: "a2", employee_id: ANGAJAT_A },
    { id: "b1", employee_id: ANGAJAT_B },
  ] as const;

  it("un rând per angajat CU cont, cu numărul lui de zile și luna; întoarce destinatarii", async () => {
    const admin = clientFals();
    admin.raspunde("employees", "select", {
      data: [
        { id: ANGAJAT_A, user_id: USER_A },
        { id: ANGAJAT_B, user_id: null },
      ],
    });
    admin.raspunde("notifications", "insert", { data: null });

    expect(await anuntaAprobareaZilelor(admin.client, ORG, LOT, linii, 2026, 7)).toBe(1);

    const [fise] = admin.apeluriPe("employees", "select");
    expect(areFiltru(fise, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(fise, "in", "id", [ANGAJAT_A, ANGAJAT_B])).toBe(true);
    const [insert] = admin.apeluriPe("notifications", "insert");
    expect(insert?.payload).toEqual([
      {
        organization_id: ORG,
        user_id: USER_A,
        kind: "success",
        title: "Zilele de pontaj au fost aprobate",
        body: "2 zile din iulie 2026 au fost aprobate.",
        link: "/portal/pontajul-meu?an=2026&luna=7",
        entity_type: "attendance_approval_batch",
        entity_id: LOT,
      },
    ]);
  });

  it("o singură zi: textul la singular", async () => {
    const admin = clientFals();
    admin.raspunde("employees", "select", { data: [{ id: ANGAJAT_B, user_id: USER_A }] });
    admin.raspunde("notifications", "insert", { data: null });
    await anuntaAprobareaZilelor(
      admin.client,
      ORG,
      LOT,
      [{ id: "b1", employee_id: ANGAJAT_B }],
      2026,
      1,
    );
    const [insert] = admin.apeluriPe("notifications", "insert");
    expect((insert?.payload as { body: string }[])[0]?.body).toBe(
      "O zi din ianuarie 2026 a fost aprobată.",
    );
  });

  // QA oct 2026: o lună tipică are 21–23 de zile lucrate, deci „21 zile” era
  // cazul obișnuit, nu o excepție. Peste 19, româna cere „de”.
  it("peste 19 zile: acordul cu „de”", async () => {
    const admin = clientFals();
    admin.raspunde("employees", "select", { data: [{ id: ANGAJAT_B, user_id: USER_A }] });
    admin.raspunde("notifications", "insert", { data: null });
    const multe = Array.from({ length: 21 }, (_, i) => ({
      id: `z${String(i)}`,
      employee_id: ANGAJAT_B,
    }));
    await anuntaAprobareaZilelor(admin.client, ORG, LOT, multe, 2026, 10);
    const [insert] = admin.apeluriPe("notifications", "insert");
    expect((insert?.payload as { body: string }[])[0]?.body).toBe(
      "21 de zile din octombrie 2026 au fost aprobate.",
    );
  });

  it("nicio linie ⇒ 0, fără nicio citire", async () => {
    const admin = clientFals();
    expect(await anuntaAprobareaZilelor(admin.client, ORG, LOT, [], 2026, 7)).toBe(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("nimeni cu cont ⇒ 0, fără insert", async () => {
    const admin = clientFals();
    admin.raspunde("employees", "select", { data: [{ id: ANGAJAT_A, user_id: null }] });
    expect(await anuntaAprobareaZilelor(admin.client, ORG, LOT, linii, 2026, 7)).toBe(0);
    expect(admin.apeluriPe("notifications")).toHaveLength(0);
  });

  it("citire sau insert picat ⇒ 0, nu aruncă", async () => {
    const unu = clientFals();
    unu.raspunde("employees", "select", { error: eroarePostgrest("XX000") });
    expect(await anuntaAprobareaZilelor(unu.client, ORG, LOT, linii, 2026, 7)).toBe(0);

    const doi = clientFals();
    doi.raspunde("employees", "select", { data: [{ id: ANGAJAT_A, user_id: USER_A }] });
    doi.raspunde("notifications", "insert", { error: eroarePostgrest("XX000") });
    expect(await anuntaAprobareaZilelor(doi.client, ORG, LOT, linii, 2026, 7)).toBe(0);
  });
});
