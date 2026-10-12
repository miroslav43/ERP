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
    `<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#12203c;">Ați fost invitat în ${escapeHtml(data.organizatie)}</h1>` +
    renderParagraph(
      `<strong>${escapeHtml(data.invitatDe)}</strong> v-a invitat să vă alăturați organizației <strong>${escapeHtml(data.organizatie)}</strong> pe Administrativo, cu rolul <strong>${escapeHtml(data.rolEticheta)}</strong>.`,
    ) +
    renderButton(link, "Acceptă invitația", ctx.appUrl) +
    renderParagraph(
      `Invitația este valabilă până la <strong>${escapeHtml(expira)}</strong>. După acest moment linkul nu mai funcționează și trebuie să cereți o invitație nouă.`,
    ) +
    renderParagraph(
      `Dacă butonul nu funcționează, copiați adresa în bara browserului:<br /><span style="color:#1d4ed8;word-break:break-all;">${escapeHtml(link)}</span>`,
    );
  const text = [
    `Ați fost invitat în ${data.organizatie}`,
    "",
    `${data.invitatDe} v-a invitat să vă alăturați organizației ${data.organizatie} pe Administrativo, cu rolul ${data.rolEticheta}.`,
    "",
    `Acceptă invitația: ${link}`,
    "",
    `Invitația este valabilă până la ${expira}.`,
    "Dacă nu ați așteptat acest mesaj, îl puteți ignora.",
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${data.invitatDe} vă invită în ${data.organizatie}.`,
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
