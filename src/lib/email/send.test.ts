// src/lib/email/send.test.ts
//
// `sendEmail` pe clientul fals: ce ajunge în rândul din `email_log`. Rata,
// configurarea și Resend sunt înlocuite — aici contează payload-ul inserat și
// cum se traduce un eșec al bazei în rezultat, nu rețeaua.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeRateLimit, trimiteViaResend } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  trimiteViaResend: vi.fn(),
}));
vi.mock("@/lib/utils/rate-limit", () => ({ consumeRateLimit }));
vi.mock("@/lib/email/config", () => ({
  getEmailConfig: () => ({ mode: "test", apiKey: null, appUrl: "https://administrativo.ro" }),
}));
vi.mock("@/lib/email/resend", () => ({ trimiteViaResend }));

import { SAMPLE_MESSAGES } from "@/lib/email/templates";
import { clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { sendEmail } from "./send";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ID_1 = "55555555-5555-4555-8555-555555555555";
const INVITATIE = SAMPLE_MESSAGES.invitatie;

beforeEach(() => {
  consumeRateLimit.mockReset();
  trimiteViaResend.mockReset();
  consumeRateLimit.mockResolvedValue({ allowed: true });
});

describe("rândul din email_log poartă firma", () => {
  it("scrie organization_id-ul firmei în numele căreia pleacă mesajul", async () => {
    const fals = clientFals();
    fals.raspunde("email_log", "insert", { data: { id: ID_1 } });

    const r = await sendEmail({
      db: fals.client,
      to: "ana@exemplu.ro",
      entityId: "inv-1",
      organizationId: ORG_ID,
      ...INVITATIE,
    });

    expect(r).toEqual({ ok: true, status: "queued", logId: ID_1, providerId: null });
    const [insert] = fals.apeluriPe("email_log", "insert");
    expect(insert?.payload).toMatchObject({
      destinatar: "ana@exemplu.ro",
      template: "invitatie",
      status: "queued",
      organization_id: ORG_ID,
    });
  });

  it("un e-mail de cont scrie organization_id NULL explicit, nu lasă cheia lipsă", async () => {
    const fals = clientFals();
    fals.raspunde("email_log", "insert", { data: { id: ID_1 } });

    await sendEmail({
      db: fals.client,
      to: "ana@exemplu.ro",
      entityId: "u-1",
      organizationId: null,
      ...SAMPLE_MESSAGES["resetare-parola"],
    });

    const [insert] = fals.apeluriPe("email_log", "insert");
    expect(insert?.payload).toHaveProperty("organization_id", null);
  });

  it("dacă jurnalul nu se poate scrie, rezultatul spune `baza_de_date`", async () => {
    const fals = clientFals();
    fals.raspunde("email_log", "insert", { error: eroarePostgrest("42501", "permission denied") });

    const r = await sendEmail({
      db: fals.client,
      to: "ana@exemplu.ro",
      entityId: "inv-1",
      organizationId: ORG_ID,
      ...INVITATIE,
    });

    expect(r).toMatchObject({ ok: false, motiv: "baza_de_date", logId: null });
    expect(trimiteViaResend).not.toHaveBeenCalled();
  });
});
