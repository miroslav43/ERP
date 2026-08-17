// src/lib/email/templates.test.ts
import { describe, expect, it } from "vitest";
import { resolveEmailConfig } from "./config";
import {
  EMAIL_TEMPLATE_KEYS,
  SAMPLE_MESSAGES,
  renderEmail,
  type EmailTemplateKey,
} from "./templates";
import { escapeHtml, safeUrl } from "./templates/layout";

const APP_URL = "https://app.administrativo.ro";
const ctx = { appUrl: APP_URL } as const;
const hrefuri = (html: string): readonly string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");

describe.each(EMAIL_TEMPLATE_KEYS)("șablonul %s", (cheie: EmailTemplateKey) => {
  const randat = renderEmail(SAMPLE_MESSAGES[cheie], ctx);

  it("are subiect și versiune text nevidă", () => {
    expect(randat.subject.trim().length).toBeGreaterThan(5);
    expect(randat.text.trim().length).toBeGreaterThan(40);
  });

  it("declară charset utf-8 și rămâne sub 600px", () => {
    expect(randat.html).toContain('<meta charset="utf-8" />');
    expect(randat.html).toContain("max-width:600px");
    expect(randat.html).not.toMatch(/display:\s*(flex|grid)/);
  });

  it("folosește diacritice cu virgulă, nu cu sedilă", () => {
    expect(randat.html).toMatch(/[ăâîșț]/);
    expect(randat.html).not.toMatch(/[şţŞŢ]/);
    expect(randat.text).not.toMatch(/[şţŞŢ]/);
  });

  it("are doar linkuri absolute pornind din NEXT_PUBLIC_APP_URL", () => {
    const linkuri = hrefuri(randat.html);
    expect(linkuri.length).toBeGreaterThan(0);
    for (const link of linkuri) {
      expect(link.startsWith(`${APP_URL}/`) || link === APP_URL || link.startsWith("mailto:")).toBe(
        true,
      );
    }
    expect(randat.text).toContain(`${APP_URL}/`);
  });
});

describe("siguranța conținutului", () => {
  it("escapează HTML-ul venit de la utilizator", () => {
    const randat = renderEmail(
      {
        template: "invitatie",
        data: {
          organizatie: '<script>alert("x")</script>',
          invitatDe: "Ana & Co",
          rolEticheta: "Manager",
          token: "t",
          expiraLa: "2026-01-15T12:00:00.000Z",
        },
      },
      ctx,
    );
    expect(randat.html).not.toContain("<script>");
    expect(randat.html).toContain("&lt;script&gt;");
    expect(randat.html).toContain("Ana &amp; Co");
  });

  it("respinge scheme periculoase în linkuri", () => {
    expect(safeUrl("javascript:alert(1)", APP_URL)).toBe(APP_URL);
    expect(safeUrl("https://exemplu.ro/x", APP_URL)).toBe("https://exemplu.ro/x");
    expect(escapeHtml('a"b')).toBe("a&quot;b");
  });
});

describe("configurarea emailului", () => {
  it("implicit rulează în modul test și normalizează URL-ul aplicației", () => {
    const config = resolveEmailConfig({ NEXT_PUBLIC_APP_URL: `${APP_URL}/` });
    expect(config.mode).toBe("test");
    expect(config.appUrl).toBe(APP_URL);
    expect(config.apiKey).toBeNull();
  });

  it("refuză un URL invalid cu mesaj lizibil", () => {
    expect(() => resolveEmailConfig({ NEXT_PUBLIC_APP_URL: "nu-e-url" })).toThrow(
      /Configurare email invalidă/,
    );
  });
});
