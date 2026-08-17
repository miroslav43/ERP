// src/lib/email/templates/cerere-demo-primita.ts
import {
  escapeHtml,
  nl2br,
  renderButton,
  renderLayout,
  renderParagraph,
  renderRow,
  type RenderedEmail,
  type TemplateContext,
} from "./layout";

export type CerereDemoData = Readonly<{
  demoId: string;
  nume: string;
  firma: string;
  email: string;
  telefon: string | null;
  nrAngajati: string;
  mesaj: string | null;
}>;

export const renderCerereDemoPrimita = (
  data: CerereDemoData,
  ctx: TemplateContext,
): RenderedEmail => {
  const link = `${ctx.appUrl}/super-admin/cereri-demo`;
  const subject = `Cerere demo nouă: ${data.firma}`;
  const randuri = [
    renderRow("Persoană", escapeHtml(data.nume)),
    renderRow("Firmă", escapeHtml(data.firma)),
    renderRow(
      "Email",
      `<a href="mailto:${escapeHtml(data.email)}" style="color:#1d4ed8;">${escapeHtml(data.email)}</a>`,
    ),
    renderRow("Telefon", data.telefon === null ? "—" : escapeHtml(data.telefon)),
    renderRow("Angajați", escapeHtml(data.nrAngajati)),
  ].join("");
  const bodyHtml =
    `<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#12203c;">Cerere demo nouă</h1>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;">${randuri}</table>` +
    (data.mesaj === null || data.mesaj.trim() === ""
      ? renderParagraph("<em>Fără mesaj.</em>")
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0;"><tr>` +
        `<td style="padding:14px 16px;background-color:#f4f5f7;border-left:3px solid #1d4ed8;font-family:Arial,Helvetica,sans-serif;` +
        `font-size:14px;line-height:22px;color:#1f2937;">${nl2br(data.mesaj)}</td></tr></table>`) +
    renderButton(link, "Vezi cererea în panou", ctx.appUrl);
  const text = [
    "Cerere demo nouă",
    "",
    `Persoană: ${data.nume}`,
    `Firmă: ${data.firma}`,
    `Email: ${data.email}`,
    `Telefon: ${data.telefon ?? "—"}`,
    `Angajați: ${data.nrAngajati}`,
    "",
    `Mesaj: ${data.mesaj === null || data.mesaj.trim() === "" ? "—" : data.mesaj}`,
    "",
    `Deschide panoul: ${link}`,
  ].join("\n");
  return {
    subject,
    html: renderLayout({
      title: subject,
      preheader: `${data.firma} a cerut o demonstrație.`,
      bodyHtml,
      appUrl: ctx.appUrl,
    }),
    text,
  };
};
