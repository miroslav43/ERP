// src/lib/email/templates/bun-venit.ts
import {
  escapeHtml,
  renderButton,
  renderLayout,
  renderParagraph,
  type RenderedEmail,
  type TemplateContext,
} from "./layout";

export type BunVenitData = Readonly<{
  nume: string;
  organizatie: string;
  rolEticheta: string;
}>;

export const renderBunVenit = (data: BunVenitData, ctx: TemplateContext): RenderedEmail => {
  const link = `${ctx.appUrl}/panou`;
  const subject = `Bun venit în ${data.organizatie}`;
  const bodyHtml =
    `<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#12203c;">Bun venit, ${escapeHtml(data.nume)}!</h1>` +
    renderParagraph(
      `Contul dumneavoastră este activ în organizația <strong>${escapeHtml(data.organizatie)}</strong>, cu rolul <strong>${escapeHtml(data.rolEticheta)}</strong>.`,
    ) +
    renderParagraph(
      "În panou vedeți exact modulele pe care administratorul organizației le-a activat. Dacă vă lipsește ceva, cereți-i acces — modulele se pornesc din administrare, nu din contul dumneavoastră.",
    ) +
    renderButton(link, "Deschide panoul", ctx.appUrl) +
    renderParagraph(
      "Vă recomandăm să vă completați profilul (nume, funcție, telefon) ca să vă recunoască ușor colegii.",
    );
  const text = [
    `Bun venit, ${data.nume}!`,
    "",
    `Contul dumneavoastră este activ în organizația ${data.organizatie}, cu rolul ${data.rolEticheta}.`,
    "În panou vedeți exact modulele activate de administratorul organizației.",
    "",
    `Deschide panoul: ${link}`,
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Contul dumneavoastră din ${data.organizatie} este activ.`,
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
