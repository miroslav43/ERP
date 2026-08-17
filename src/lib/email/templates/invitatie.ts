// src/lib/email/templates/invitatie.ts
import {
  escapeHtml,
  formatDataOra,
  renderButton,
  renderLayout,
  renderParagraph,
  type RenderedEmail,
  type TemplateContext,
} from "./layout";

export type InvitatieData = Readonly<{
  organizatie: string;
  invitatDe: string;
  rolEticheta: string;
  token: string;
  expiraLa: string;
}>;

export const renderInvitatie = (data: InvitatieData, ctx: TemplateContext): RenderedEmail => {
  const link = `${ctx.appUrl}/invitatie/${encodeURIComponent(data.token)}`;
  const expira = formatDataOra(data.expiraLa);
  const subject = `Invitație în ${data.organizatie} pe Administrativo`;
  const bodyHtml =
    `<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#12203c;">Ai fost invitat în ${escapeHtml(data.organizatie)}</h1>` +
    renderParagraph(
      `<strong>${escapeHtml(data.invitatDe)}</strong> te-a invitat să te alături organizației <strong>${escapeHtml(data.organizatie)}</strong> pe Administrativo, cu rolul <strong>${escapeHtml(data.rolEticheta)}</strong>.`,
    ) +
    renderButton(link, "Acceptă invitația", ctx.appUrl) +
    renderParagraph(
      `Invitația este valabilă până la <strong>${escapeHtml(expira)}</strong>. După acest moment linkul nu mai funcționează și trebuie să ceri o invitație nouă.`,
    ) +
    renderParagraph(
      `Dacă butonul nu funcționează, copiază adresa în bara browserului:<br /><span style="color:#1d4ed8;word-break:break-all;">${escapeHtml(link)}</span>`,
    );
  const text = [
    `Ai fost invitat în ${data.organizatie}`,
    "",
    `${data.invitatDe} te-a invitat să te alături organizației ${data.organizatie} pe Administrativo, cu rolul ${data.rolEticheta}.`,
    "",
    `Acceptă invitația: ${link}`,
    "",
    `Invitația este valabilă până la ${expira}.`,
    "Dacă nu ai așteptat acest mesaj, îl poți ignora.",
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${data.invitatDe} te invită în ${data.organizatie}.`,
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
