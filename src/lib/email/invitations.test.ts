// src/lib/email/invitations.test.ts
//
// `trimiteEmailInvitatie` e un wrapper subțire peste `sendEmail`; aici se
// verifică doar că firma, șablonul și cheia de idempotență ajung neschimbate.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("./send", () => ({ sendEmail }));

import { trimiteEmailInvitatie } from "./invitations";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const INVITATION_ID = "55555555-5555-4555-8555-555555555555";
const DB = {} as never;

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, status: "queued", logId: null, providerId: null });
});

describe("trimiteEmailInvitatie", () => {
  it("trece firma, șablonul și id-ul invitației mai departe la sendEmail", async () => {
    await trimiteEmailInvitatie({
      db: DB,
      destinatar: "ana@exemplu.ro",
      organizatie: "Firma Test SRL",
      organizationId: ORG_ID,
      invitatDe: "Ion Pop",
      rol: "org_admin",
      token: "tok",
      expiraLa: "2026-10-20T10:00:00.000Z",
      invitationId: INVITATION_ID,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
      db: DB,
      to: "ana@exemplu.ro",
      entityId: INVITATION_ID,
      organizationId: ORG_ID,
      template: "invitatie",
      data: { organizatie: "Firma Test SRL", rolEticheta: "Administrator", token: "tok" },
    });
  });
});
