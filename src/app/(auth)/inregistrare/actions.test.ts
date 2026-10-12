import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * `createPublicAction` e înlocuit cu identitatea, ca testul să cheme direct
 * `handler`-ul: limitarea de rată și clientul anon nu sunt subiectul aici.
 * Restul dependențelor care ies din proces sunt false.
 */
const { rpc, numaraConversia } = vi.hoisted(() => ({
  rpc: vi.fn(),
  numaraConversia: vi.fn(),
}));

vi.mock("@/lib/actions/public-action", () => ({
  createPublicAction: (definitie: unknown) => definitie,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => ({ rpc }) }));
vi.mock("@/lib/auth/token-invitatie", () => ({
  generateazaTokenInvitatie: async () => ({ token: "tok", hash: "hash" }),
}));
vi.mock("@/lib/email/invitations", () => ({
  trimiteEmailInvitatie: async () => ({ ok: true }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "administrativo.ro", "user-agent": "Mozilla/5.0" }),
}));
vi.mock("@/lib/unelte/umami-server", () => ({ numaraConversia }));

import { inregistreazaFirma } from "./actions";
import { schemaInregistrare } from "./schema";

type Definitie = { handler: (ctx: unknown, input: unknown) => Promise<unknown> };
const definitie = inregistreazaFirma as unknown as Definitie;

const CTX = {
  supabase: {},
  meta: { ip: null, userAgent: null },
  requestId: "r-1",
  now: new Date("2026-10-08T10:00:00Z"),
};
const BAZA = {
  firma: "Firma Test SRL",
  cui: "14399840",
  prenume: "Ana",
  nume: "Pop",
  email: "ana@example.com",
  telefon: "",
  acceptTermeni: true,
};

beforeEach(() => {
  rpc.mockReset();
  numaraConversia.mockReset();
  rpc.mockResolvedValue({ data: { organization_id: "o-1", invitation_id: "i-1" }, error: null });
});

describe("conversia numărată pe server", () => {
  it("contul venit din foaia de pontaj se numără cu sursa lui", async () => {
    await definitie.handler(CTX, schemaInregistrare.parse({ ...BAZA, sursa: "foaie-de-pontaj" }));
    expect(numaraConversia).toHaveBeenCalledTimes(1);
    expect(numaraConversia.mock.calls[0]?.[0]).toBe("foaie-de-pontaj");
    expect((numaraConversia.mock.calls[0]?.[1] as Headers).get("host")).toBe("administrativo.ro");
  });

  it("fără sursă, contul se numără ca direct", async () => {
    await definitie.handler(CTX, schemaInregistrare.parse(BAZA));
    expect(numaraConversia).toHaveBeenCalledTimes(1);
    expect(numaraConversia.mock.calls[0]?.[0] ?? null).toBeNull();
  });

  it("o sursă stricată nu oprește înregistrarea", async () => {
    for (const sursa of ["x".repeat(500), 42, "__proto__", { a: 1 }]) {
      const input = schemaInregistrare.parse({ ...BAZA, sursa });
      await expect(definitie.handler(CTX, input)).resolves.toEqual({
        email: "ana@example.com",
        prinEmail: true,
      });
    }
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it("dacă baza refuză, nu se numără niciun cont", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "CUI existent." } });
    await expect(
      definitie.handler(CTX, schemaInregistrare.parse({ ...BAZA, sursa: "foaie-de-pontaj" })),
    ).rejects.toThrow("CUI existent.");
    expect(numaraConversia).not.toHaveBeenCalled();
  });
});
