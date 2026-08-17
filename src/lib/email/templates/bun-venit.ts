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
      `Contul tău este activ în organizația <strong>${escapeHtml(data.organizatie)}</strong>, cu rolul <strong>${escapeHtml(data.rolEticheta)}</strong>.`,
    ) +
    renderParagraph(
      "În panou vezi exact modulele pe care administratorul organizației le-a activat. Dacă îți lipsește ceva, cere-i acces — modulele se pornesc din administrare, nu din contul tău.",
    ) +
    renderButton(link, "Deschide panoul", ctx.appUrl) +
    renderParagraph(
      "Îți recomandăm să îți completezi profilul (nume, funcție, telefon) ca să te recunoască ușor colegii.",
    );
  const text = [
    `Bun venit, ${data.nume}!`,
    "",
    `Contul tău este activ în organizația ${data.organizatie}, cu rolul ${data.rolEticheta}.`,
    "În panou vezi exact modulele activate de administratorul organizației.",
    "",
    `Deschide panoul: ${link}`,
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `Contul tău din ${data.organizatie} este activ.`,
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
